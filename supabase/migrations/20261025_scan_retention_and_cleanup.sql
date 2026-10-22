-- ==============================================================================
-- MedSync Database Migration: 90-Day Scan Retention & DPDP Section 12 Storage Cleanup
-- File: supabase/migrations/20261025_scan_retention_and_cleanup.sql
-- ==============================================================================

-- 1. Create a queue table to track storage files awaiting physical removal
CREATE TABLE IF NOT EXISTS public.storage_deletion_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL DEFAULT 'prescriptions',
  file_path TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.storage_deletion_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages storage deletion queue" ON public.storage_deletion_queue;
CREATE POLICY "Service role manages storage deletion queue"
  ON public.storage_deletion_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Cleanup function for scans older than 90 days (Storage Limitation Principle)
CREATE OR REPLACE FUNCTION public.cleanup_expired_scans()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  v_count integer := 0;
  v_rec record;
BEGIN
  -- Identify pending_reviews older than 90 days that have image_url
  FOR v_rec IN
    SELECT id, image_url
    FROM public.pending_reviews
    WHERE created_at < (timezone('utc'::text, now()) - INTERVAL '90 days')
      AND image_url IS NOT NULL
  LOOP
    -- Queue file for physical storage removal
    INSERT INTO public.storage_deletion_queue (bucket_id, file_path)
    VALUES ('prescriptions', v_rec.image_url);

    -- Delete physical object from storage.objects if present
    DELETE FROM storage.objects 
    WHERE bucket_id = 'prescriptions' AND name = v_rec.image_url;

    -- Delete review metadata record
    DELETE FROM public.pending_reviews WHERE id = v_rec.id;
    v_count := v_count + 1;
  END LOOP;

  -- Also clean up scan_usage logs older than 90 days
  DELETE FROM public.scan_usage WHERE scan_date < (CURRENT_DATE - 90);

  RETURN v_count;
END;
$$;

-- 3. Enhance delete_user_account to queue storage deletions and purge user data
DROP FUNCTION IF EXISTS public.delete_user_account() CASCADE;
DROP FUNCTION IF EXISTS public.delete_user_account CASCADE;

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to delete account.';
  END IF;

  -- 1. Queue user prescription photos for physical file deletion
  INSERT INTO public.storage_deletion_queue (bucket_id, file_path)
  SELECT 'prescriptions', name
  FROM storage.objects
  WHERE bucket_id = 'prescriptions'
    AND (storage.foldername(name))[1] = v_user_id::text;

  -- Purge physical storage photos directly
  DELETE FROM storage.objects 
  WHERE bucket_id = 'prescriptions' 
    AND (storage.foldername(name))[1] = v_user_id::text;

  -- 2. Cascade delete application rows
  DELETE FROM public.medication_logs WHERE patient_id = v_user_id;
  DELETE FROM public.medications WHERE patient_id = v_user_id;

  -- 3. If patient deletes account, delete their reviews.
  --    If doctor deletes account, NULL their assignment without destroying patient's prescription slip
  DELETE FROM public.pending_reviews WHERE patient_id = v_user_id;
  UPDATE public.pending_reviews SET target_doctor_id = NULL WHERE target_doctor_id = v_user_id;

  -- 4. Purge pairings, push tokens, consents, scan usage, and profile
  DELETE FROM public.patient_caregivers WHERE patient_id = v_user_id OR caregiver_id = v_user_id;
  DELETE FROM public.user_push_tokens WHERE user_id = v_user_id;
  DELETE FROM public.user_consents WHERE user_id = v_user_id;
  DELETE FROM public.scan_usage WHERE user_id = v_user_id;
  DELETE FROM public.profiles WHERE id = v_user_id;

  -- 5. Purge auth identity from auth.users (permits immediate re-registration)
  DELETE FROM auth.users WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Account and personal health data completely purged');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- 4. Register daily automated maintenance job with pg_cron if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Check if job already scheduled
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'medsync-daily-scan-cleanup') THEN
      PERFORM cron.schedule(
        'medsync-daily-scan-cleanup',
        '0 3 * * *', -- 03:00 UTC daily
        'SELECT public.cleanup_expired_scans();'
      );
    END IF;
  END IF;
END $$;
