// src/hooks/useCaregiverRoster.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { patientService } from '../services/patientService';
import { prescriptionService } from '../services/prescriptionService';
import { MissedAlertItem, PatientItem } from '../types/patient';
import { PendingReview } from '../types/review';
import { showErrorAlert } from '../utils/errorHandler';

export function useCaregiverRoster(caregiverId?: string | null) {
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [missedAlerts, setMissedAlerts] = useState<MissedAlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [linking, setLinking] = useState<boolean>(false);

  const fetchRosterData = useCallback(async () => {
    if (!caregiverId) {
      setLoading(false);
      return;
    }

    const [patientsRes, reviewsRes, alertsRes] = await Promise.all([
      patientService.fetchLinkedPatients(caregiverId),
      prescriptionService.fetchPendingReviewsForCaregiver(caregiverId),
      patientService.checkMissedDoses(caregiverId),
    ]);

    if (patientsRes.success) setPatients(patientsRes.data || []);
    if (reviewsRes.success) setReviews(reviewsRes.data || []);
    if (alertsRes.success) setMissedAlerts(alertsRes.data || []);

    setLoading(false);
  }, [caregiverId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRosterData();
    setRefreshing(false);
  }, [fetchRosterData]);

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

  useEffect(() => {
    if (!caregiverId) return;

    fetchRosterData();

    // Subscribe to real-time reviews & patient links with unique channel identifier
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
          { event: '*', schema: 'public', table: 'medication_logs' },
          () => {
            patientService.checkMissedDoses(caregiverId).then((res) => {
              if (res.success) setMissedAlerts(res.data || []);
            });
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('[useCaregiverRoster] Realtime channel subscription failed:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [caregiverId, fetchRosterData]);

  return {
    patients,
    reviews,
    missedAlerts,
    loading,
    refreshing,
    linking,
    onRefresh,
    linkPatientWithCode,
    toggleAlertOverride,
    refetch: fetchRosterData,
  };
}
