-- scripts/seed_demo_accounts.sql
-- Run this in your Supabase SQL Editor to seed dummy doctor and patients.

-- 1. Ensure profiles table allows 'doctor' role and has required clinical columns
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('patient', 'caregiver', 'doctor'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blood_group text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allergies text;
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS duration text;
ALTER TABLE public.pending_reviews ALTER COLUMN time_ago SET DEFAULT 'Just now';

DO $$
DECLARE
  v_doctor_id UUID := '00000000-0000-0000-0000-000000000001';
  v_patient_id UUID := '00000000-0000-0000-0000-000000000002';
  v_patient2_id UUID := '00000000-0000-0000-0000-000000000003';
  v_patient3_id UUID := '00000000-0000-0000-0000-000000000004';
BEGIN
  -- 2. Seed Auth Users (Satisfies profiles_id_fkey and enables one-tap demo sign-in)
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
  VALUES 
    (
      v_doctor_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'doctor@medsync.demo',
      crypt('Password123!', gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Dr. Evelyn Reed, MD"}'
    ),
    (
      v_patient_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'patient@medsync.demo',
      crypt('Password123!', gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Martha Davis"}'
    ),
    (
      v_patient2_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'james@medsync.demo',
      crypt('Password123!', gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"James Wilson"}'
    ),
    (
      v_patient3_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'clara@medsync.demo',
      crypt('Password123!', gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Clara Rodriguez"}'
    )
  ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change = '';

  -- 3. Seed Auth Identities for Supabase GoTrue Auth
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES
    (v_doctor_id, v_doctor_id, json_build_object('sub', v_doctor_id::text, 'email', 'doctor@medsync.demo', 'email_verified', true), 'email', v_doctor_id::text, now(), now(), now()),
    (v_patient_id, v_patient_id, json_build_object('sub', v_patient_id::text, 'email', 'patient@medsync.demo', 'email_verified', true), 'email', v_patient_id::text, now(), now(), now()),
    (v_patient2_id, v_patient2_id, json_build_object('sub', v_patient2_id::text, 'email', 'james@medsync.demo', 'email_verified', true), 'email', v_patient2_id::text, now(), now(), now()),
    (v_patient3_id, v_patient3_id, json_build_object('sub', v_patient3_id::text, 'email', 'clara@medsync.demo', 'email_verified', true), 'email', v_patient3_id::text, now(), now(), now())
  ON CONFLICT (id) DO UPDATE SET
    provider_id = EXCLUDED.provider_id,
    identity_data = EXCLUDED.identity_data;

  -- 4. Create or Update Doctor Profile
  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    is_verified_doctor,
    alerts_enabled
  )
  VALUES (
    v_doctor_id,
    'Dr. Evelyn Reed, MD',
    'doctor',
    true,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_verified_doctor = true;

  -- 5. Create or Update Senior Patient Profiles
  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    blood_group,
    allergies,
    alerts_enabled
  )
  VALUES 
    (v_patient_id, 'Martha Davis', 'patient', 'O+', 'Penicillin, Sulfa Drugs', true),
    (v_patient2_id, 'James Wilson', 'patient', 'A+', 'Aspirin', true),
    (v_patient3_id, 'Clara Rodriguez', 'patient', 'B+', 'None Reported', true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    blood_group = EXCLUDED.blood_group,
    allergies = EXCLUDED.allergies;

  -- 6. Link Patients to Doctor
  INSERT INTO public.patient_caregivers (patient_id, caregiver_id, status, pairing_code, override_alerts)
  VALUES 
    (v_patient_id, v_doctor_id, 'active', 'MARTHA74', true),
    (v_patient2_id, v_doctor_id, 'active', 'JAMES68', true),
    (v_patient3_id, v_doctor_id, 'active', 'CLARA81', true)
  ON CONFLICT DO NOTHING;

  -- 7. Sample Active Medications for Martha Davis
  INSERT INTO public.medications (patient_id, medicine_name, dosage, time, status, duration, pills_remaining, total_pills, food_warning, is_active)
  VALUES 
    (v_patient_id, 'Amlodipine', '5mg', '08:00', 'pending', '30 days', 28, 30, 'Take after breakfast with water', true),
    (v_patient_id, 'Vitamin D3', '1000 IU', '08:30', 'pending', '30 days', 30, 30, 'Take with morning meal', true),
    (v_patient_id, 'Metformin', '500mg', '13:00', 'pending', '30 days', 16, 30, 'Take with lunch to avoid upset stomach', true),
    (v_patient_id, 'Atorvastatin', '20mg', '21:00', 'pending', '30 days', 3, 30, 'Take at bedtime (Low Stock)', true)
  ON CONFLICT DO NOTHING;

  -- 8. Sample Pending Prescription Review for Dr. Evelyn Reed
  INSERT INTO public.pending_reviews (
    patient_id,
    patient_name,
    medication,
    dosage,
    duration,
    doctor_notes,
    image_url,
    time_ago,
    status
  )
  VALUES (
    v_patient_id,
    'Martha Davis',
    'Amlodipine & Atorvastatin',
    '5mg / 20mg',
    '30 days',
    'Rx: Amlodipine 5mg PO daily in morning. Atorvastatin 20mg PO at bedtime. Refills: 3.',
    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',
    '10 mins ago',
    'pending'
  )
  ON CONFLICT DO NOTHING;

END $$;
