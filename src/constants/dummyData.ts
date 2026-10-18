// src/constants/dummyData.ts
// Dummy data has been cleared per user specification. All records are sourced live from Supabase.

export interface DummyMedication {
  id: number;
  medicine_name: string;
  dosage: string;
  time: string;
  status: 'pending' | 'taken' | 'skipped' | 'missed';
  food_warning?: string;
  pills_remaining: number;
  total_pills: number;
  period: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface DummyPatient {
  id: string;
  full_name: string;
  role: 'patient';
  email: string;
  age: number;
  blood_group: string;
  allergies: string;
  emergency_contact: string;
  doctor_name: string;
  pairing_code: string;
  adherenceRate: number;
  streak: number;
  medications: DummyMedication[];
}

export interface DummyDoctor {
  id: string;
  full_name: string;
  role: 'doctor';
  email: string;
  specialty: string;
  clinic: string;
  phone: string;
  license_number: string;
  is_verified_doctor: boolean;
  pairing_code: string;
  patients: any[];
  pending_reviews: any[];
}
