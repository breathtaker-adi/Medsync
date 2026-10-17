// src/constants/dummyData.ts

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
  patients: {
    id: string;
    full_name: string;
    age: number;
    blood_group: string;
    allergies: string;
    condition: string;
    adherenceRate: number;
    missed_count: number;
    active_medications_count: number;
    last_taken: string;
  }[];
  pending_reviews: {
    id: string;
    patient_id: string;
    patient_name: string;
    image_url: string;
    extracted_text: string;
    created_at: string;
    suggested_medications: {
      name: string;
      dosage: string;
      time: string;
      instructions: string;
    }[];
  }[];
}

export const DUMMY_DOCTOR: DummyDoctor = {
  id: '00000000-0000-0000-0000-000000000001',
  full_name: 'Dr. Evelyn Reed, MD',
  role: 'doctor',
  email: 'doctor@medsync.demo',
  specialty: 'Geriatric Medicine & Cardiology',
  clinic: 'St. Jude Senior Care & Cardiology Clinic',
  phone: '+1 (555) 349-8201',
  license_number: 'MD-88392-GER',
  is_verified_doctor: true,
  pairing_code: 'DOC-REED',
  patients: [
    {
      id: '00000000-0000-0000-0000-000000000002',
      full_name: 'Martha Davis',
      age: 74,
      blood_group: 'O+',
      allergies: 'Penicillin, Sulfa Drugs',
      condition: 'Hypertension & Hyperlipidemia',
      adherenceRate: 96,
      missed_count: 0,
      active_medications_count: 4,
      last_taken: 'Today, 08:00 AM (Amlodipine)',
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      full_name: 'James Wilson',
      age: 68,
      blood_group: 'A+',
      allergies: 'Aspirin',
      condition: 'Type 2 Diabetes Regimen',
      adherenceRate: 72,
      missed_count: 2,
      active_medications_count: 3,
      last_taken: 'Yesterday, 01:00 PM (Metformin)',
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      full_name: 'Clara Rodriguez',
      age: 81,
      blood_group: 'B+',
      allergies: 'None Reported',
      condition: 'Post-Surgery Recovery & Osteoarthritis',
      adherenceRate: 100,
      missed_count: 0,
      active_medications_count: 2,
      last_taken: 'Today, 08:15 AM (Calcium + D)',
    },
  ],
  pending_reviews: [
    {
      id: 'rev-001',
      patient_id: '00000000-0000-0000-0000-000000000002',
      patient_name: 'Martha Davis',
      image_url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',
      extracted_text: 'Rx: Amlodipine 5mg PO daily. Atorvastatin 20mg PO at bedtime. Refills: 3.',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      suggested_medications: [
        {
          name: 'Amlodipine',
          dosage: '5mg',
          time: '08:00',
          instructions: 'Take 1 tablet in the morning after breakfast.',
        },
        {
          name: 'Atorvastatin',
          dosage: '20mg',
          time: '21:00',
          instructions: 'Take 1 tablet at bedtime with a glass of water.',
        },
      ],
    },
  ],
};

export const DUMMY_PATIENT: DummyPatient = {
  id: '00000000-0000-0000-0000-000000000002',
  full_name: 'Martha Davis',
  role: 'patient',
  email: 'patient@medsync.demo',
  age: 74,
  blood_group: 'O+',
  allergies: 'Penicillin, Sulfa Drugs',
  emergency_contact: 'Sarah Davis (Daughter) • +1 (555) 782-9912',
  doctor_name: 'Dr. Evelyn Reed, MD',
  pairing_code: 'MARTHA74',
  adherenceRate: 92,
  streak: 6,
  medications: [
    {
      id: 101,
      medicine_name: 'Amlodipine',
      dosage: '5mg (1 Tablet)',
      time: '08:00',
      status: 'taken',
      food_warning: 'Take after breakfast with water',
      pills_remaining: 28,
      total_pills: 30,
      period: 'morning',
    },
    {
      id: 102,
      medicine_name: 'Vitamin D3',
      dosage: '1000 IU (1 Capsule)',
      time: '08:30',
      status: 'taken',
      food_warning: 'Take with morning meal',
      pills_remaining: 30,
      total_pills: 30,
      period: 'morning',
    },
    {
      id: 103,
      medicine_name: 'Metformin',
      dosage: '500mg (1 Tablet)',
      time: '13:00',
      status: 'pending',
      food_warning: 'Take with food to prevent upset stomach',
      pills_remaining: 16,
      total_pills: 30,
      period: 'afternoon',
    },
    {
      id: 104,
      medicine_name: 'Atorvastatin',
      dosage: '20mg (1 Tablet)',
      time: '21:00',
      status: 'pending',
      food_warning: 'Take before sleep at bedtime',
      pills_remaining: 3, // Low stock demo!
      total_pills: 30,
      period: 'night',
    },
  ],
};
