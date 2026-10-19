// src/types/patient.ts

export interface PatientSummary {
  id: string;
  full_name: string | null;
  blood_group?: string | null;
  allergies?: string | null;
  adherence?: number;
}

export interface PatientCaregiverLink {
  id?: string;
  patient_id: string;
  caregiver_id: string | null;
  pairing_code?: string | null;
  status?: 'pending' | 'accepted' | 'active';
  override_alerts?: boolean;
  created_at?: string;
}

export interface MissedAlertItem {
  patient_id: string;
  patient_name: string;
  missed_count: number;
}

export interface PatientItem {
  id: string;
  patient_name: string;
  full_name: string | null;
  patient_id: string;
  condition: string;
  adherence: number;
  doctor_id?: string;
  override_alerts?: boolean;
  blood_group?: string | null;
  allergies?: string | null;
  phone?: string | null;
  email?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  age?: number | null;
}
