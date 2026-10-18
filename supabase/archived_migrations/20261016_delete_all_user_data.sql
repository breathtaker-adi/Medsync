-- =============================================================================
-- MedSync Migration: Purge All User Data
-- Date: 2026-10-16
-- Description:
-- Resets the database to a blank state by removing all auth users, profiles,
-- clinical regimens, logs, reviews, pairing links, and prescription storage files.
-- Tables, policies, views, triggers, and functions remain intact.
-- =============================================================================

BEGIN;

TRUNCATE TABLE public.medication_logs CASCADE;
TRUNCATE TABLE public.pending_reviews CASCADE;
TRUNCATE TABLE public.medications CASCADE;
TRUNCATE TABLE public.patient_caregivers CASCADE;

DELETE FROM public.profiles;

DELETE FROM auth.users;

SET LOCAL storage.allow_delete_query = 'true';
DELETE FROM storage.objects WHERE bucket_id = 'prescriptions';

COMMIT;
