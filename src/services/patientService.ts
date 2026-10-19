// src/services/patientService.ts
import { supabase } from '../lib/supabase';
import { Result, ok, err } from '../types/api';
import { MissedAlertItem, PatientItem, PatientSummary } from '../types/patient';
import { UserProfile } from '../types/auth';
import { handleAppError, getErrorMessage } from '../utils/errorHandler';

function generateRandomPairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const patientService = {
  /**
   * Fetch all patients linked to a specific caregiver/doctor
   */
  async fetchLinkedPatients(caregiverId: string): Promise<Result<PatientItem[]>> {
    try {
      const { data: links, error: linkErr } = await supabase
        .from('patient_caregivers')
        .select('patient_id, override_alerts')
        .eq('caregiver_id', caregiverId);

      if (linkErr) {
        return err(new Error(getErrorMessage(linkErr)));
      }

      if (!links || links.length === 0) {
        return ok([]);
      }

      const patientIds = links.map((l) => l.patient_id);

      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name, blood_group, allergies, phone, email, emergency_contact_name, emergency_contact_phone, age')
        .in('id', patientIds);

      if (profErr) {
        return err(new Error(getErrorMessage(profErr)));
      }

      const roster: PatientItem[] = (profiles || []).map((prof: any) => {
        const link = links.find((l) => l.patient_id === prof.id);
        const name = prof.full_name || 'Anonymous Patient';
        return {
          id: prof.id,
          patient_name: name,
          full_name: name,
          patient_id: prof.id,
          condition: prof.blood_group ? `Blood Group: ${prof.blood_group}` : 'Caregiver Monitored',
          adherence: 100,
          override_alerts: link?.override_alerts ?? false,
          blood_group: prof.blood_group,
          allergies: prof.allergies,
          phone: prof.phone || null,
          email: prof.email || null,
          emergency_contact_name: prof.emergency_contact_name || null,
          emergency_contact_phone: prof.emergency_contact_phone || null,
          age: prof.age || null,
        };
      });

      return ok(roster);
    } catch (caught: any) {
      handleAppError(caught, { action: 'fetchLinkedPatients' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Update supervisor alert override setting for a linked patient
   */
  async updateAlertOverride(
    caregiverId: string,
    patientId: string,
    overrideAlerts: boolean
  ): Promise<Result<void>> {
    try {
      const { error } = await supabase
        .from('patient_caregivers')
        .update({ override_alerts: overrideAlerts })
        .eq('caregiver_id', caregiverId)
        .eq('patient_id', patientId);

      if (error) {
        return err(new Error(getErrorMessage(error)));
      }
      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'updateAlertOverride' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Fetch patient profile with caregiver relationship verification
   */
  async fetchPatientDetails(
    patientId: string,
    caregiverId: string
  ): Promise<Result<{ profile: UserProfile; medications: any[] }>> {
    try {
      // 1. Authorization check
      const { data: link, error: linkErr } = await supabase
        .from('patient_caregivers')
        .select('id')
        .eq('caregiver_id', caregiverId)
        .eq('patient_id', patientId)
        .maybeSingle();

      if (linkErr || !link) {
        return err(new Error('You are not authorized to view this patient profile.'));
      }

      // 2. Fetch profile & medications in parallel
      const [profileRes, medsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', patientId).single(),
        supabase.from('medications').select('*').eq('patient_id', patientId),
      ]);

      if (profileRes.error) {
        return err(new Error(getErrorMessage(profileRes.error)));
      }

      return ok({
        profile: profileRes.data as UserProfile,
        medications: medsRes.data || [],
      });
    } catch (caught: any) {
      handleAppError(caught, { action: 'fetchPatientDetails' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Claim an 8-character pairing code using secure RPC or direct fallback
   */
  async claimPairingCode(
    caregiverId: string,
    pairingCode: string
  ): Promise<Result<{ patientId?: string }>> {
    const formattedCode = pairingCode.trim().toUpperCase();

    try {
      // 1. Secure RPC claim
      const { data: rpcData, error: rpcError } = await supabase.rpc('claim_pairing_code', {
        p_code: formattedCode,
      });

      if (!rpcError && rpcData?.success) {
        return ok({ patientId: rpcData.patient_id });
      }

      // 2. Fallback direct update
      const { data, error } = await supabase
        .from('patient_caregivers')
        .select('patient_id, caregiver_id, created_at')
        .eq('pairing_code', formattedCode)
        .single();

      if (error || !data) {
        return err(new Error('Invalid pairing code or patient not found.'));
      }

      if (data.created_at) {
        const isExpired = Date.now() - new Date(data.created_at).getTime() > 15 * 60 * 1000;
        if (isExpired) {
          return err(new Error('This pairing code has expired (15-minute validity). Please request a new code.'));
        }
      }

      if (data.caregiver_id) {
        return err(new Error('This patient is already linked to a caregiver or doctor.'));
      }

      const { error: updateError } = await supabase
        .from('patient_caregivers')
        .update({ caregiver_id: caregiverId, status: 'active' })
        .eq('pairing_code', formattedCode);

      if (updateError) {
        return err(new Error(getErrorMessage(updateError)));
      }

      return ok({ patientId: data.patient_id });
    } catch (caught: any) {
      handleAppError(caught, { action: 'claimPairingCode' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Patient revokes a linked caregiver/doctor relationship
   */
  async revokeCaregiverLink(linkId: number): Promise<Result<void>> {
    try {
      // 1. Attempt atomic disconnect RPC first
      const { error: rpcError } = await supabase.rpc('disconnect_doctor', {
        p_link_id: linkId,
      });

      if (!rpcError) {
        return ok(undefined);
      }

      // 2. Direct fallback: update status to 'revoked'
      const { error: updateError } = await supabase
        .from('patient_caregivers')
        .update({ status: 'revoked' })
        .eq('id', linkId);

      // 3. Attempt physical delete if permitted by RLS
      await supabase
        .from('patient_caregivers')
        .delete()
        .eq('id', linkId);

      if (updateError) {
        return err(new Error(getErrorMessage(updateError)));
      }

      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'revokeCaregiverLink' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Generate a fresh 15-minute pairing code for a patient
   */
  async generatePairingCode(patientId: string): Promise<Result<string>> {
    try {
      // 1. Attempt secure server-side RPC code creation
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_pairing_code');
      if (!rpcError && rpcData?.pairing_code) {
        return ok(rpcData.pairing_code);
      }

      // 2. Client-side fallback if RPC is not deployed yet
      const { data: existing } = await supabase
        .from('patient_caregivers')
        .select('pairing_code, created_at, caregiver_id')
        .eq('patient_id', patientId)
        .is('caregiver_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.pairing_code && existing?.created_at) {
        const isExpired = Date.now() - new Date(existing.created_at).getTime() > 15 * 60 * 1000;
        if (!isExpired) {
          return ok(existing.pairing_code);
        }
      }

      const newCode = generateRandomPairingCode();

      const { error } = await supabase.from('patient_caregivers').insert({
        patient_id: patientId,
        pairing_code: newCode,
        status: 'pending',
      });

      if (error) {
        return err(new Error(getErrorMessage(error)));
      }

      return ok(newCode);
    } catch (caught: any) {
      handleAppError(caught, { action: 'generatePairingCode' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Check for missed dose alerts across linked patients
   */
  async checkMissedDoses(caregiverId: string): Promise<Result<MissedAlertItem[]>> {
    try {
      // 1. Fetch caregiver alert settings
      const { data: caregiverProfile } = await supabase
        .from('profiles')
        .select('alerts_enabled')
        .eq('id', caregiverId)
        .maybeSingle();

      const globalAlertsOn = caregiverProfile?.alerts_enabled ?? true;

      // 2. Fetch linked patients
      let query = supabase
        .from('patient_caregivers')
        .select('patient_id, override_alerts')
        .eq('caregiver_id', caregiverId);

      if (!globalAlertsOn) {
        query = query.eq('override_alerts', true);
      }

      const { data: links } = await query;
      if (!links || links.length === 0) {
        return ok([]);
      }

      const patientIds = links.map((l) => l.patient_id);
      const today = new Date().toISOString().split('T')[0];

      // 3. Query logs for missed or skipped status
      const { data: logs } = await supabase
        .from('medication_logs')
        .select('patient_id, status')
        .in('patient_id', patientIds)
        .eq('log_date', today)
        .in('status', ['missed', 'skipped']);

      if (!logs || logs.length === 0) {
        return ok([]);
      }

      // Group by patient
      const counts: Record<string, number> = {};
      logs.forEach((log) => {
        counts[log.patient_id] = (counts[log.patient_id] || 0) + 1;
      });

      // Filter patients with 2+ missed doses
      const criticalPatientIds = Object.keys(counts).filter((id) => counts[id] >= 2);
      if (criticalPatientIds.length === 0) {
        return ok([]);
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', criticalPatientIds);

      const alerts: MissedAlertItem[] = (profiles || []).map((p) => ({
        patient_id: p.id,
        patient_name: p.full_name || 'Patient',
        missed_count: counts[p.id],
      }));

      return ok(alerts);
    } catch (caught: any) {
      handleAppError(caught, { action: 'checkMissedDoses' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Fetch active, non-expired pairing code for patient if one exists
   */
  async getActivePairingCode(patientId: string): Promise<Result<string | null>> {
    try {
      const { data, error } = await supabase
        .from('patient_caregivers')
        .select('pairing_code, created_at, caregiver_id')
        .eq('patient_id', patientId)
        .is('caregiver_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return err(new Error(getErrorMessage(error)));
      }

      if (data?.pairing_code && data?.created_at) {
        const isExpired = Date.now() - new Date(data.created_at).getTime() > 15 * 60 * 1000;
        if (!isExpired) {
          return ok(data.pairing_code);
        }
      }

      return ok(null);
    } catch (caught: any) {
      handleAppError(caught, { action: 'getActivePairingCode' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Fetch practice roster metrics for doctor dashboard & settings
   */
  async getDoctorRosterStats(caregiverId: string): Promise<Result<{ patientCount: number; pendingReviewCount: number }>> {
    try {
      const [patientRes, reviewRes] = await Promise.all([
        supabase
          .from('patient_caregivers')
          .select('id', { count: 'exact', head: true })
          .eq('caregiver_id', caregiverId),
        supabase
          .from('pending_reviews')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ]);

      const patientCount = patientRes.count || 0;
      const pendingReviewCount = reviewRes.count || 0;

      return ok({ patientCount, pendingReviewCount });
    } catch (caught: any) {
      handleAppError(caught, { action: 'getDoctorRosterStats' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Fetch 30-day health report logs and medications for PDF generation
   */
  async fetchHealthReportData(
    patientId: string,
    days: number = 30
  ): Promise<Result<{ logs: any[]; medications: any[] }>> {
    try {
      const boundaryDate = new Date();
      boundaryDate.setDate(boundaryDate.getDate() - days);
      const boundaryDateStr = boundaryDate.toISOString().split('T')[0];

      const [logsRes, medsRes] = await Promise.all([
        supabase
          .from('medication_logs')
          .select('medication_id, log_date, scheduled_time, status, notes')
          .eq('patient_id', patientId)
          .gte('log_date', boundaryDateStr)
          .order('log_date', { ascending: false }),
        supabase
          .from('medications')
          .select('id, medicine_name')
          .eq('patient_id', patientId),
      ]);

      if (logsRes.error) {
        return err(new Error(getErrorMessage(logsRes.error)));
      }
      if (medsRes.error) {
        return err(new Error(getErrorMessage(medsRes.error)));
      }

      return ok({
        logs: logsRes.data || [],
        medications: medsRes.data || [],
      });
    } catch (caught: any) {
      handleAppError(caught, { action: 'fetchHealthReportData' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Fetch linked and verified doctors available for prescription review targeting
   */
  async fetchAvailableDoctors(
    patientId: string
  ): Promise<Result<Array<{ id: string; full_name: string; specialty?: string; clinic_affiliation?: string; isLinked: boolean }>>> {
    try {
      const { data: links } = await supabase
        .from('patient_caregivers')
        .select('caregiver_id')
        .eq('patient_id', patientId)
        .eq('status', 'active');

      const linkedIds = new Set((links || []).map((l: any) => l.caregiver_id).filter(Boolean));

      const { data: doctors, error: docErr } = await supabase
        .from('profiles')
        .select('id, full_name, specialty, clinic_affiliation, role, is_verified_doctor')
        .or('role.eq.doctor,is_verified_doctor.eq.true');

      if (docErr) {
        return err(new Error(getErrorMessage(docErr)));
      }

      const formatted = (doctors || []).map((d: any) => ({
        id: d.id,
        full_name: d.full_name || 'Medical Doctor',
        specialty: d.specialty || 'General Practice',
        clinic_affiliation: d.clinic_affiliation || 'Verified Clinic',
        isLinked: linkedIds.has(d.id),
      }));

      // Sort linked doctors first
      formatted.sort((a, b) => (b.isLinked ? 1 : 0) - (a.isLinked ? 1 : 0));

      return ok(formatted);
    } catch (caught: any) {
      handleAppError(caught, { action: 'fetchAvailableDoctors' });
      return err(new Error(getErrorMessage(caught)));
    }
  },
};
