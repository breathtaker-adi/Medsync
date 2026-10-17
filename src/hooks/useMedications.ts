// src/hooks/useMedications.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { medicationService } from '../services/medicationService';
import { notificationService } from '../services/notificationService';
import { Medication, MedicationLog } from '../types/medication';
import { showErrorAlert } from '../utils/errorHandler';

export function useMedications(patientId?: string | null) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchDailyMedications = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    const [medsRes, logsRes] = await Promise.all([
      medicationService.fetchMedications(patientId),
      medicationService.fetchLogsForDate(patientId, today),
    ]);

    if (!medsRes.success) {
      setLoading(false);
      return;
    }

    const medsList = medsRes.data || [];
    const logsList = logsRes.success ? logsRes.data || [] : [];
    const logMap = new Map<number, MedicationLog>();
    logsList.forEach((log) => logMap.set(log.medication_id, log));

    // Determine overdue and intake status
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const enriched = medsList.map((med) => {
      const log = logMap.get(med.id);
      const status = log ? log.status : 'pending';

      // Parse time (e.g. "08:00 AM")
      let isOverdue = false;
      if (status === 'pending' && med.time) {
        try {
          const match = med.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (match) {
            let hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const period = match[3].toUpperCase();
            if (period === 'PM' && hours < 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
            const medMinutes = hours * 60 + minutes;
            if (currentMinutes > medMinutes + 30) {
              isOverdue = true;
            }
          }
        } catch {}
      }

      return {
        ...med,
        status,
        isOverdue,
        snooze_count: log?.snooze_count || 0,
      };
    });

    setMedications(enriched);
    setLoading(false);
  }, [patientId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDailyMedications();
    setRefreshing(false);
  }, [fetchDailyMedications]);

  const handleTakeDose = async (med: Medication, notes?: string) => {
    if (!patientId) return;

    // Optimistic UI update
    setMedications((prev) =>
      prev.map((item) =>
        item.id === med.id
          ? {
              ...item,
              status: 'taken',
              pills_remaining:
                item.pills_remaining != null ? Math.max(0, item.pills_remaining - 1) : item.pills_remaining,
            }
          : item
      )
    );

    const res = await medicationService.recordDoseAction({
      medication: med,
      patientId,
      status: 'taken',
      scheduledTime: med.time,
      notes,
    });

    if (!res.success) {
      showErrorAlert(res.error, 'Update Failed');
      fetchDailyMedications(); // Revert on failure
    }
  };

  const handleSkipDose = async (med: Medication, reason?: string) => {
    if (!patientId) return;

    setMedications((prev) =>
      prev.map((item) => (item.id === med.id ? { ...item, status: 'skipped' } : item))
    );

    const res = await medicationService.recordDoseAction({
      medication: med,
      patientId,
      status: 'skipped',
      scheduledTime: med.time,
      notes: reason,
    });

    if (!res.success) {
      showErrorAlert(res.error, 'Update Failed');
      fetchDailyMedications();
    }
  };

  const handleSnoozeDose = async (med: Medication, minutes = 20) => {
    if (!patientId) return;

    await notificationService.scheduleSnoozeNotification(med, minutes);

    const res = await medicationService.snoozeDose(
      med.id,
      patientId,
      med.time,
      med.snooze_count || 0
    );

    if (res.success) {
      setMedications((prev) =>
        prev.map((item) =>
          item.id === med.id ? { ...item, snooze_count: (item.snooze_count || 0) + 1 } : item
        )
      );
    }
  };

  // Real-time synchronization
  useEffect(() => {
    if (!patientId) return;

    fetchDailyMedications();

    const channelName = `patient_meds_${patientId}_${Date.now()}`;
    let channel: any = null;

    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'medication_logs', filter: `patient_id=eq.${patientId}` },
          () => {
            fetchDailyMedications();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'medications', filter: `patient_id=eq.${patientId}` },
          () => {
            fetchDailyMedications();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('[useMedications] Realtime subscription failed:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [patientId, fetchDailyMedications]);

  return {
    medications,
    loading,
    refreshing,
    onRefresh,
    handleTakeDose,
    handleSkipDose,
    handleSnoozeDose,
    refetch: fetchDailyMedications,
  };
}
