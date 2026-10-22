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

-- Only service role can read or mutate the deletion queue
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
AS $$
DECLARE
  v_count integer := 0;
  v_rec record;
BEGIN
  -- Identify unverified scans or temporary drafts older than 90 days
  FOR v_rec IN
    SELECT id, user_id, image_path
    FROM public.ocr_scans
    WHERE created_at < (timezone('utc'::text, now()) - INTERVAL '90 days')
      AND image_path IS NOT NULL
  LOOP
    -- Queue file for physical storage removal
    INSERT INTO public.storage_deletion_queue (bucket_id, file_path)
    VALUES ('prescriptions', v_rec.image_path)
    ON CONFLICT DO NOTHING;

    -- Delete metadata record
    DELETE FROM public.ocr_scans WHERE id = v_rec.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 3. Enhance delete_user_account to queue all prescription photos for storage deletion
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_rec record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to delete account.';
  END IF;

  -- Queue all user prescription images for physical file deletion
  FOR v_rec IN
    SELECT image_url FROM public.prescriptions WHERE patient_id = v_user_id AND image_url IS NOT NULL
    UNION
    SELECT image_path FROM public.ocr_scans WHERE user_id = v_user_id AND image_path IS NOT NULL
  LOOP
    INSERT INTO public.storage_deletion_queue (bucket_id, file_path)
    VALUES ('prescriptions', v_rec.image_url);
  END LOOP;

  -- Cascade delete application rows
  DELETE FROM public.caregiver_links WHERE patient_id = v_user_id OR caregiver_id = v_user_id;
  DELETE FROM public.doses WHERE patient_id = v_user_id;
  DELETE FROM public.prescriptions WHERE patient_id = v_user_id;
  DELETE FROM public.adherence_logs WHERE patient_id = v_user_id;
  DELETE FROM public.ocr_scans WHERE user_id = v_user_id;
  DELETE FROM public.profiles WHERE id = v_user_id;
END;
$$;

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
