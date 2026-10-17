// src/types/medication.ts

export type MedicationStatus = 'pending' | 'taken' | 'skipped' | 'missed' | (string & {});

export interface Medication {
  id: number;
  medicine_name: string;
  dosage: string;
  time: string;
  status: MedicationStatus;
  description?: string | null;
  duration?: string | null;
  pills_remaining?: number | null;
  total_pills?: number | null;
  food_warning?: string | null;
  is_active?: boolean;
  snooze_count?: number;
  isOverdue?: boolean;
  camera_verified?: boolean;
  patient_id?: string;
  created_at?: string;
}

export interface MedicationLog {
  id?: number;
  medication_id: number;
  patient_id: string;
  log_date: string;
  scheduled_time: string;
  status: MedicationStatus;
  notes?: string | null;
  snooze_count?: number;
  created_at?: string;
  medication?: {
    medicine_name: string;
    dosage: string;
  };
}

export function createNewMedication(
  name: string,
  dosage: string,
  time: string
): Omit<Medication, 'id'> {
  return {
    medicine_name: name,
    dosage: dosage,
    time: time,
    status: 'pending',
    description: null,
    duration: null,
  };
}