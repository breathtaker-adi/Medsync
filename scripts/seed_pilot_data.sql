-- =============================================================================
-- MedSync Pilot Testing Seed Script (3 Patients + 1 Doctor)
-- Description:
-- Sets up sample paired relationships and realistic schedules for clinical pilot.
-- Run in Supabase SQL editor on your staging/test environment.
-- =============================================================================

-- 1. Example Pilot Roles (Replace IDs with actual test auth.uid() values after sign-up)
-- Doctor: Dr. Evelyn Reed (Verified Doctor)
-- Patient 1: Martha Davis (Daily blood pressure & cholesterol)
-- Patient 2: James Wilson (Diabetes & Metformin regimen)
-- Patient 3: Clara Rodriguez (Antibiotics recovery course)

-- Example: Set doctor verification for the pilot clinician
-- UPDATE public.profiles
-- SET role = 'doctor', is_verified_doctor = true
-- WHERE id = 'YOUR_DOCTOR_UUID';

-- Example: Create active pairing for Pilot Patient 1 with Doctor
-- INSERT INTO public.patient_caregivers (patient_id, caregiver_id, status, pairing_code)
-- VALUES ('PATIENT_1_UUID', 'DOCTOR_UUID', 'active', 'PILOT001')
-- ON CONFLICT DO NOTHING;

-- Example: Sample Medications for Pilot Patient 1
-- INSERT INTO public.medications (patient_id, medicine_name, dosage, time, status, duration, pills_remaining, total_pills, is_active)
-- VALUES 
--   ('PATIENT_1_UUID', 'Amlodipine', '5mg', '08:00', 'pending', '30 days', 28, 30, true),
--   ('PATIENT_1_UUID', 'Atorvastatin', '20mg', '20:00', 'pending', '30 days', 28, 30, true)
-- ON CONFLICT DO NOTHING;
