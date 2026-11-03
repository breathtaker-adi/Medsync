// src/hooks/useCaregiverRoster.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { medicationService } from '../services/medicationService';
import { notificationService } from '../services/notificationService';
import { patientService } from '../services/patientService';
import { prescriptionService } from '../services/prescriptionService';
import { Medication } from '../types/medication';
import { MissedAlertItem, PatientItem } from '../types/patient';
import { PendingReview } from '../types/review';
import { showErrorAlert } from '../utils/errorHandler';

export function useCaregiverRoster(caregiverId?: string | null) {
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [linkedPatientIds, setLinkedPatientIds] = useState<string[]>([]);
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [missedAlerts, setMissedAlerts] = useState<MissedAlertItem[]>([]);
  const [personalMeds, setPersonalMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [linking, setLinking] = useState<boolean>(false);

  const checkMissedDosesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRosterData = useCallback(async () => {
    if (!caregiverId) {
      setLoading(false);
      return;
    }

    const [patientsRes, reviewsRes, alertsRes, personalMedsRes] = await Promise.all([
      patientService.fetchLinkedPatients(caregiverId),
      prescriptionService.fetchPendingReviewsForCaregiver(caregiverId),
      patientService.checkMissedDoses(caregiverId),
      medicationService.fetchMedications(caregiverId),
    ]);

    if (patientsRes.success && patientsRes.data) {
      setPatients(patientsRes.data);
      const ids = patientsRes.data.map((p) => p.patient_id).filter(Boolean);
      setLinkedPatientIds(ids);
    }
    if (reviewsRes.success) setReviews(reviewsRes.data || []);
    if (alertsRes.success) setMissedAlerts(alertsRes.data || []);

    if (personalMedsRes.success && personalMedsRes.data) {
      setPersonalMeds(personalMedsRes.data);
      // Automatically arm alarms for caregiver's personal medications
      notificationService.scheduleAllAlarms(personalMedsRes.data).catch(() => {});
    }

    setLoading(false);
  }, [caregiverId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRosterData();
    setRefreshing(false);
  }, [fetchRosterData]);

  const takePersonalDose = async (med: Medication): Promise<boolean> => {
    if (!caregiverId) return false;
    if (!med.time) {
      showErrorAlert('This medication does not have a scheduled dose time.', 'Dose Log Error');
      return false;
    }
    const res = await medicationService.recordDoseAction({
      medication: med,
      patientId: caregiverId,
      status: 'taken',
      scheduledTime: med.time,
    });
    if (res.success) {
      await fetchRosterData();
      return true;
    } else {
      showErrorAlert(res.error, 'Dose Log Error');
      return false;
    }
  };

  const linkPatientWithCode = async (code: string): Promise<boolean> => {
    if (!caregiverId) return false;
    setLinking(true);

    const res = await patientService.claimPairingCode(caregiverId, code);
    setLinking(false);

    if (res.success) {
      await fetchRosterData();
      return true;
    } else {
      showErrorAlert(res.error, 'Linking Error');
      return false;
    }
  };

  const toggleAlertOverride = async (patientId: string, overrideAlerts: boolean): Promise<boolean> => {
    if (!caregiverId) return false;
    setPatients((prev) =>
      prev.map((p) => (p.patient_id === patientId ? { ...p, override_alerts: overrideAlerts } : p))
    );
    const res = await patientService.updateAlertOverride(caregiverId, patientId, overrideAlerts);
    if (!res.success) {
      showErrorAlert(res.error, 'Alert Preference Error');
      await fetchRosterData();
      return false;
    }
    const alertsRes = await patientService.checkMissedDoses(caregiverId);
    if (alertsRes.success) setMissedAlerts(alertsRes.data || []);
    return true;
  };

  // Initial load
  useEffect(() => {
    if (caregiverId) {
      fetchRosterData();
    }
  }, [caregiverId, fetchRosterData]);

  // Realtime subscription scoped to caregiver and linked patients
  useEffect(() => {
    if (!caregiverId) return;

    const channelName = `caregiver_roster_${caregiverId}_${Date.now()}`;
    let channel: any = null;

    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pending_reviews' },
          () => {
            fetchRosterData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'patient_caregivers', filter: `caregiver_id=eq.${caregiverId}` },
          () => {
            fetchRosterData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'medications', filter: `patient_id=eq.${caregiverId}` },
          () => {
            medicationService.fetchMedications(caregiverId).then((res) => {
              if (res.success && res.data) {
                setPersonalMeds(res.data);
                notificationService.scheduleAllAlarms(res.data).catch(() => {});
              }
            });
          }
        );

      // Scoped subscription: only listen to medication_logs for linked patients
      const linkedCsv = linkedPatientIds.join(',');
      if (linkedCsv) {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'medication_logs',
            filter: `patient_id=in.(${linkedCsv})`,
          },
          () => {
            if (checkMissedDosesDebounceRef.current) {
              clearTimeout(checkMissedDosesDebounceRef.current);
            }
            checkMissedDosesDebounceRef.current = setTimeout(() => {
              patientService.checkMissedDoses(caregiverId).then((res: any) => {
                if (res.success) setMissedAlerts(res.data || []);
              });
            }, 1500);
          }
        );
      }

      channel.subscribe();
    } catch (err) {
      console.warn('[useCaregiverRoster] Realtime channel subscription failed:', err);
    }

    return () => {
      if (checkMissedDosesDebounceRef.current) {
        clearTimeout(checkMissedDosesDebounceRef.current);
      }
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [caregiverId, linkedPatientIds.join(','), fetchRosterData]);

  return {
    patients,
    reviews,
    missedAlerts,
    personalMeds,
    takePersonalDose,
    loading,
    refreshing,
    linking,
    onRefresh,
    linkPatientWithCode,
    toggleAlertOverride,
    refetch: fetchRosterData,
  };
}
