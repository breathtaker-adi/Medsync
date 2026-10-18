-- =============================================================================
-- MedSync Database Utility: Complete Data Purge
-- Description:
-- Safely truncates all clinical and operational user data, deletes user profiles,
-- deletes Supabase auth users, and removes uploaded prescription files.
-- All schemas, tables, triggers, and functions remain intact for new registrations.
-- =============================================================================

BEGIN;

-- 1. Truncate operational and activity tables (cascading handles foreign key dependencies)
TRUNCATE TABLE public.user_push_tokens CASCADE;
TRUNCATE TABLE public.medication_logs CASCADE;
TRUNCATE TABLE public.pending_reviews CASCADE;
TRUNCATE TABLE public.medications CASCADE;
TRUNCATE TABLE public.patient_caregivers CASCADE;

-- Legacy table cleanup if present
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'patients') THEN
    TRUNCATE TABLE public.patients CASCADE;
  END IF;
END $$;

-- 2. Clear all user profiles
DELETE FROM public.profiles;

-- 3. Delete all auth users from Supabase Auth
-- Cascades cleanly to auth.identities, auth.sessions, auth.mfa_*, etc.
DELETE FROM auth.users;

-- 4. Clean up all uploaded prescription files in storage
SET LOCAL storage.allow_delete_query = 'true';
DELETE FROM storage.objects WHERE bucket_id = 'prescriptions';

COMMIT;
