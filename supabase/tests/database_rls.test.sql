-- ==============================================================================
-- MedSync Database Integration Tests: Real Two-User Postgres RLS & Security Verification
-- File: supabase/tests/database_rls.test.sql
-- Run with: supabase test db
-- Requires: pgTAP extension
-- ==============================================================================

BEGIN;
SELECT plan(8);

-- 1. Setup pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- 2. Create two test user identities in auth.users
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'patient_a@medsync.test', '{"role":"patient"}'),
  ('22222222-2222-2222-2222-222222222222', 'intruder_b@medsync.test', '{"role":"patient"}'),
  ('33333333-3333-3333-3333-333333333333', 'caregiver_c@medsync.test', '{"role":"caregiver"}')
ON CONFLICT (id) DO NOTHING;

-- 3. Test 1: Verify RLS is enabled on all critical application tables
SELECT table_has_rls('public', 'profiles', 'profiles has RLS enabled');
SELECT table_has_rls('public', 'prescriptions', 'prescriptions has RLS enabled');
SELECT table_has_rls('public', 'doses', 'doses has RLS enabled');
SELECT table_has_rls('public', 'caregiver_links', 'caregiver_links has RLS enabled');

-- 4. Setup Test Data as Patient A
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

INSERT INTO public.prescriptions (id, patient_id, medicine_name, dosage, frequency)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'Metformin 500mg',
  '500mg',
  'Twice daily'
);

-- Test 2: Patient A can read their own prescription
SELECT is(
  (SELECT count(*)::int FROM public.prescriptions WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'Patient A can view their own prescription'
);

-- 5. Test 3: Switch identity to Intruder B and verify RLS isolation (IDOR protection)
SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.prescriptions WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'Intruder B cannot read Patient A prescription via RLS isolation'
);

-- 6. Test 4: Privilege Escalation Prevention via protect_profile_fields trigger
SELECT throws_ok(
  $$UPDATE public.profiles SET is_verified_doctor = true WHERE id = '22222222-2222-2222-2222-222222222222'$$,
  'Direct privilege escalation is strictly prohibited.',
  'Client cannot self-escalate is_verified_doctor flag'
);

-- 7. Test 5: Revoked Caregiver Link Access Check
-- Link caregiver C to patient A, but with status = 'revoked'
RESET ROLE;
INSERT INTO public.caregiver_links (patient_id, caregiver_id, status)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'revoked'
);

-- Switch to Caregiver C
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.prescriptions WHERE patient_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'Revoked caregiver cannot inspect patient prescription data'
);

SELECT * FROM finish();
ROLLBACK;
