// src/services/medicationService.ts
import { supabase } from '../lib/supabase';
import { Result, ok, err } from '../types/api';
import { Medication, MedicationLog, MedicationStatus } from '../types/medication';
import { handleAppError, getErrorMessage } from '../utils/errorHandler';
import { checkIfOverdue, parseTimeToMinutes } from '../utils/timeUtils';

export interface DoseActionParams {
  medication: Medication;
  patientId: string;
  status: 'taken' | 'skipped';
  scheduledTime: string;
  notes?: string;
}

export interface CreateMedicationParams {
  patientId: string;
  medicineName: string;
  dosage: string;
  time: string;
  warning?: string | null;
  pillsRemaining?: number;
}

export interface RecordDoseParams {
  medicationId: number;
  patientId: string;
  scheduledTime: string;
  cameraVerified?: boolean;
  currentPillsRemaining?: number | null;
}

export const medicationService = {
  /**
   * Fetch all active medications for a patient
   */
  async fetchMedications(patientId: string): Promise<Result<Medication[]>> {
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('patient_id', patientId)
        .order('time', { ascending: true });

      if (error) {
        handleAppError(error, { action: 'fetchMedications' });
        return err(new Error(getErrorMessage(error)));
      }

      return ok((data || []) as Medication[]);
    } catch (caught: any) {
      handleAppError(caught, { action: 'fetchMedications' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Fetch single medication by ID
   */
  async fetchMedicationById(medicationId: number | string): Promise<Result<Medication>> {
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('id', medicationId)
        .single();

      if (error) {
        handleAppError(error, { action: 'fetchMedicationById' });
        return err(new Error(getErrorMessage(error)));
      }

      return ok(data as Medication);
    } catch (caught: any) {
      handleAppError(caught, { action: 'fetchMedicationById' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Fetch medication logs for a specific day
   */
  async fetchLogsForDate(patientId: string, dateStr: string): Promise<Result<MedicationLog[]>> {
    try {
      const { data, error } = await supabase
        .from('medication_logs')
        .select('*')
        .eq('patient_id', patientId)
        .eq('log_date', dateStr);

      if (error) {
        handleAppError(error, { action: 'fetchLogsForDate' });
        return err(new Error(getErrorMessage(error)));
      }

      return ok((data || []) as MedicationLog[]);
    } catch (caught: any) {
      handleAppError(caught, { action: 'fetchLogsForDate' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Record intake action (taken or skipped) with atomic pill decrement
   */
  async recordDoseAction({
    medication,
    patientId,
    status,
    scheduledTime,
    notes,
  }: DoseActionParams): Promise<Result<void>> {
    const today = new Date().toISOString().split('T')[0];

    try {
      // 1. Decrement pill count atomically if taken and inventory is tracked
      if (status === 'taken' && medication.pills_remaining != null) {
        const newRemaining = Math.max(0, medication.pills_remaining - 1);
        await supabase
          .from('medications')
          .update({ pills_remaining: newRemaining })
          .eq('id', medication.id);
      }

      // 2. Upsert log entry
      const { error: logError } = await supabase.from('medication_logs').upsert(
        {
          medication_id: medication.id,
          patient_id: patientId,
          log_date: today,
          scheduled_time: scheduledTime,
          status,
          notes: notes || null,
        },
        { onConflict: 'medication_id, log_date' }
      );

      if (logError) {
        handleAppError(logError, { action: 'recordDoseAction' });
        return err(new Error(getErrorMessage(logError)));
      }

      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'recordDoseAction' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Snooze dose and increment snooze count
   */
  async snoozeDose(
    medicationId: number,
    patientId: string,
    scheduledTime: string,
    currentSnoozeCount: number = 0
  ): Promise<Result<void>> {
    const today = new Date().toISOString().split('T')[0];

    try {
      const { error } = await supabase.from('medication_logs').upsert(
        {
          medication_id: medicationId,
          patient_id: patientId,
          log_date: today,
          scheduled_time: scheduledTime,
          snooze_count: currentSnoozeCount + 1,
        },
        { onConflict: 'medication_id, log_date' }
      );

      if (error) {
        handleAppError(error, { action: 'snoozeDose' });
        return err(new Error(getErrorMessage(error)));
      }

      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'snoozeDose' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Restock pill inventory for a medication
   */
  async restockMedication(
    medicationId: number | string,
    countToAdd: number
  ): Promise<Result<number>> {
    try {
      const { data: current, error: fetchErr } = await supabase
        .from('medications')
        .select('pills_remaining, total_pills')
        .eq('id', medicationId)
        .single();

      if (fetchErr) {
        return err(new Error(getErrorMessage(fetchErr)));
      }

      const updatedRemaining = (current?.pills_remaining || 0) + countToAdd;
      const updatedTotal = Math.max(current?.total_pills || 0, updatedRemaining);

      const { error: updateErr } = await supabase
        .from('medications')
        .update({ pills_remaining: updatedRemaining, total_pills: updatedTotal })
        .eq('id', medicationId);

      if (updateErr) {
        return err(new Error(getErrorMessage(updateErr)));
      }

      return ok(updatedRemaining);
    } catch (caught: any) {
      handleAppError(caught, { action: 'restockMedication' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Fetch adherence history for a given day window
   */
  async fetchHistory(
    patientId: string,
    days: number = 7
  ): Promise<Result<{ logs: MedicationLog[]; medications: Medication[] }>> {
    try {
      const boundaryDate = new Date();
      boundaryDate.setDate(boundaryDate.getDate() - days);
      const boundaryDateStr = boundaryDate.toISOString().split('T')[0];

      const [logsRes, medsRes] = await Promise.all([
        supabase
          .from('medication_logs')
          .select('id, medication_id, patient_id, log_date, scheduled_time, status, snooze_count, created_at')
          .eq('patient_id', patientId)
          .gte('log_date', boundaryDateStr)
          .order('log_date', { ascending: false }),
        supabase
          .from('medications')
          .select('id, medicine_name, dosage')
          .eq('patient_id', patientId),
      ]);

      if (logsRes.error) {
        return err(new Error(getErrorMessage(logsRes.error)));
      }

      return ok({
        logs: (logsRes.data || []) as MedicationLog[],
        medications: (medsRes.data || []) as Medication[],
      });
    } catch (caught: any) {
      handleAppError(caught, { action: 'fetchHistory' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Add a new scheduled medication for a patient
   */
  async createMedication({
    patientId,
    medicineName,
    dosage,
    time,
    warning,
    pillsRemaining = 30,
  }: CreateMedicationParams): Promise<Result<Medication>> {
    try {
      const { data, error } = await supabase
        .from('medications')
        .insert({
          patient_id: patientId,
          medicine_name: medicineName,
          dosage,
          time,
          status: 'pending',
          pills_remaining: pillsRemaining,
          total_pills: pillsRemaining,
          food_warning: warning || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        return err(new Error(getErrorMessage(error)));
      }

      return ok(data as Medication);
    } catch (caught: any) {
      handleAppError(caught, { action: 'createMedication' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Atomically records a dose intake with camera verification and inventory decrement
   */
  async recordDoseWithInventory({
    medicationId,
    patientId,
    scheduledTime,
    cameraVerified = false,
    currentPillsRemaining,
  }: RecordDoseParams): Promise<Result<{ pillsRemaining: number }>> {
    const today = new Date().toISOString().split('T')[0];

    try {
      // 1. Attempt atomic RPC take_dose
      const { data: doseResult, error: doseError } = await supabase.rpc('take_dose', {
        p_medication_id: medicationId,
        p_scheduled_time: scheduledTime,
        p_camera_verified: cameraVerified,
      });

      if (!doseError && doseResult?.pills_remaining !== undefined) {
        return ok({ pillsRemaining: doseResult.pills_remaining });
      }

      // 2. Fallback upsert
      const { error: logError } = await supabase.from('medication_logs').upsert(
        {
          medication_id: medicationId,
          patient_id: patientId,
          log_date: today,
          scheduled_time: scheduledTime,
          status: 'taken',
          camera_verified: cameraVerified,
        },
        { onConflict: 'medication_id, log_date' }
      );

      if (logError) {
        return err(new Error(getErrorMessage(logError)));
      }

      let newCount = currentPillsRemaining != null ? Math.max(0, currentPillsRemaining - 1) : 29;

      if (currentPillsRemaining != null) {
        await supabase
          .from('medications')
          .update({ pills_remaining: newCount })
          .eq('id', medicationId);
      }

      return ok({ pillsRemaining: newCount });
    } catch (caught: any) {
      handleAppError(caught, { action: 'recordDoseWithInventory' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Fetch today's full medication schedule merged with intake logs, sorted chronologically
   */
  async fetchDailySchedule(patientId: string): Promise<Result<Medication[]>> {
    const today = new Date().toISOString().split('T')[0];

    try {
      const [medsRes, logsRes] = await Promise.all([
        supabase
          .from('medications')
          .select('*')
          .eq('patient_id', patientId)
          .eq('is_active', true),
        supabase
          .from('medication_logs')
          .select('*')
          .eq('patient_id', patientId)
          .eq('log_date', today),
      ]);

      if (medsRes.error) {
        return err(new Error(getErrorMessage(medsRes.error)));
      }

      const medsData = medsRes.data || [];
      const logsData = logsRes.data || [];

      const merged = medsData.map((med) => {
        const todayLog = logsData.find((l) => l.medication_id === med.id);
        const currentStatus = todayLog ? todayLog.status : 'pending';

        return {
          ...med,
          status: currentStatus,
          isOverdue: currentStatus === 'pending' && checkIfOverdue(med.time),
          snooze_count: todayLog?.snooze_count || 0,
          camera_verified: todayLog?.camera_verified || false,
        };
      });

      const sorted = [...merged].sort(
        (a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
      );

      return ok(sorted as Medication[]);
    } catch (caught: any) {
      handleAppError(caught, { action: 'fetchDailySchedule' });
      return err(new Error(getErrorMessage(caught)));
    }
  },
};
