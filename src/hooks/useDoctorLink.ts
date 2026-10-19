// src/hooks/useDoctorLink.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { patientService } from '../services/patientService';
import { useAuth } from '../context/AuthContext';

export interface ConnectedDoctor {
  link_id: number;
  doctor_id: string;
  full_name: string;
  specialty?: string;
  clinic_affiliation?: string;
  medical_license_number?: string;
  medical_council?: string;
  is_verified_doctor?: boolean;
  status: string;
  created_at: string;
}

export function useDoctorLink() {
  const { session } = useAuth();
  const [doctors, setDoctors] = useState<ConnectedDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  const fetchConnectedDoctors = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch active links from patient_caregivers (strictly status = 'active')
      const { data: links, error: linkErr } = await supabase
        .from('patient_caregivers')
        .select('id, caregiver_id, status, created_at')
        .eq('patient_id', session.user.id)
        .eq('status', 'active')
        .not('caregiver_id', 'is', null);

      if (linkErr) {
        console.error('Error fetching doctor links:', linkErr);
      }

      const activeLinks = links || [];
      const doctorIds = activeLinks.map((l: any) => l.caregiver_id);

      if (doctorIds.length === 0) {
        setDoctors([]);
        setLoading(false);
        return;
      }

      // 2. Fetch doctor profiles
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select(
          'id, full_name, specialty, clinic_affiliation, medical_license_number, medical_council, is_verified_doctor, role'
        )
        .in('id', doctorIds);

      if (profErr) {
        console.error('Error fetching doctor profiles:', profErr);
      }

      const doctorList: ConnectedDoctor[] = activeLinks.map((link: any) => {
        const prof = (profiles || []).find((p: any) => p.id === link.caregiver_id);
        const name = prof?.full_name
          ? prof.full_name.startsWith('Dr.')
            ? prof.full_name
            : `Dr. ${prof.full_name}`
          : 'Supervising Physician';

        return {
          link_id: link.id,
          doctor_id: link.caregiver_id,
          full_name: name,
          specialty: prof?.specialty || 'General Practice',
          clinic_affiliation: prof?.clinic_affiliation || 'Clinical Practice',
          medical_license_number: prof?.medical_license_number,
          medical_council: prof?.medical_council,
          is_verified_doctor: prof?.is_verified_doctor ?? false,
          status: link.status || 'active',
          created_at: link.created_at,
        };
      });

      setDoctors(doctorList);
    } catch (err) {
      console.error('Doctor link fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const fetchExistingPairingCode = useCallback(async () => {
    if (!session?.user?.id) return;

    const { data } = await supabase
      .from('patient_caregivers')
      .select('pairing_code, created_at')
      .eq('patient_id', session.user.id)
      .is('caregiver_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.pairing_code && data?.created_at) {
      const isExpired = Date.now() - new Date(data.created_at).getTime() > 15 * 60 * 1000;
      if (!isExpired) {
        setPairingCode(data.pairing_code);
      }
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchConnectedDoctors();
    fetchExistingPairingCode();
  }, [fetchConnectedDoctors, fetchExistingPairingCode]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchConnectedDoctors(), fetchExistingPairingCode()]);
    setRefreshing(false);
  };

  const generateCode = async (): Promise<string | null> => {
    if (!session?.user?.id) return null;
    setGeneratingCode(true);

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let newCode = '';
    for (let i = 0; i < 8; i++) {
      newCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const { error } = await supabase.from('patient_caregivers').insert({
      patient_id: session.user.id,
      caregiver_id: null,
      pairing_code: newCode,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    setGeneratingCode(false);

    if (error) {
      return null;
    }

    setPairingCode(newCode);
    return newCode;
  };

  const disconnectDoctor = async (doctor: ConnectedDoctor): Promise<boolean> => {
    // Optimistically update local state
    setDoctors((prev) => prev.filter((d) => d.link_id !== doctor.link_id));

    const res = await patientService.revokeCaregiverLink(doctor.link_id);

    // Clear target_doctor_id on any pending reviews
    if (session?.user?.id && doctor.doctor_id) {
      await supabase
        .from('pending_reviews')
        .update({ target_doctor_id: null })
        .eq('patient_id', session.user.id)
        .eq('target_doctor_id', doctor.doctor_id)
        .eq('status', 'pending');
    }

    if (!res.success) {
      await fetchConnectedDoctors();
      return false;
    }

    return true;
  };

  return {
    doctors,
    loading,
    refreshing,
    pairingCode,
    generatingCode,
    refresh,
    generateCode,
    disconnectDoctor,
  };
}
