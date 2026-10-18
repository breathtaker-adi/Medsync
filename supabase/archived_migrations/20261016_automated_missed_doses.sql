-- =============================================================================
-- MedSync Migration: Automated Missed Doses & Cron Support
-- Date: 2026-10-16
-- Description:
-- Adds database functions to evaluate overdue doses and auto-transition
-- status from 'pending' to 'missed', preventing stale data and triggering
-- clinician alerts without requiring the caregiver app to be opened.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.evaluate_missed_doses()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count int := 0;
BEGIN
    -- 1. Mark pending logs as missed if the scheduled date has passed
    -- or if the scheduled time today has passed by more than 60 minutes
    WITH updated AS (
        UPDATE medication_logs
        SET status = 'missed'
        WHERE status = 'pending'
          AND (
            log_date < CURRENT_DATE
            OR (
                log_date = CURRENT_DATE
                AND scheduled_time IS NOT NULL
                AND scheduled_time <> ''
                AND scheduled_time::time < (CURRENT_TIME - INTERVAL '60 minutes')
            )
          )
        RETURNING id
    )
    SELECT count(*) INTO v_updated_count FROM updated;

    RETURN v_updated_count;
END;
$$;

-- Grant execution to service_role and authenticated users
GRANT EXECUTE ON FUNCTION public.evaluate_missed_doses() TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_missed_doses() TO authenticated;

-- Optional pg_cron setup (if pg_cron extension is enabled on the Supabase project)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        -- Run every hour at the top of the hour
        PERFORM cron.schedule(
            'medsync-hourly-missed-check',
            '0 * * * *',
            'SELECT public.evaluate_missed_doses();'
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Ignore if pg_cron is not supported or already scheduled
END;
$$;
