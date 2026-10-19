-- =============================================================================
-- MedSync Migration: Complete Security Hardening & DPDP Act 2023 Compliance
-- Date: 2026-10-23
-- Description:
-- 1. Tightens prescriptions storage RLS to exact object name match and drops LIKE wildcard vulnerability
-- 2. Restricts pending_reviews INSERT policy to enforce pending status, null doctor notes, and user path
-- 3. Drops direct doctor UPDATE policy on pending_reviews (approvals/rejections strictly via atomic RPCs)
-- 4. Creates protect_profile_fields trigger preventing users from elevating role or is_verified_doctor
-- 5. Hardens take_dose RPC with medication ownership verification and row lock
-- 6. Fixes evaluate_missed_doses midnight bug by comparing full datetime (log_date + scheduled_time::time)
-- 7. Adds medications chk_time_format constraint and revokes generate_daily_medication_logs from authenticated
-- 8. Adds full RLS policies, chk_pc_status constraint, and uq_open_pairing_code partial index to patient_caregivers
-- 9. Adds RLS policies to user_consents table
-- 10. Adds status = 'active' requirement to all caregiver policy branches
-- 11. Restricts approve_review and reject_review to require active pairing if target_doctor_id is null
-- 12. Fixes delete_user_account to null target_doctor_id on patients' pending reviews instead of deleting them
-- 13. Creates scan_usage table for edge function quota tracking
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. STORAGE: EXACT OBJECT MATCH & REVOKE WILDCARDS
-- -----------------------------------------------------------------------------
UPDATE storage.buckets SET public = false WHERE id = 'prescriptions';

DROP POLICY IF EXISTS "read own, targeted or linked" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads on prescriptions" ON storage.objects;
DROP POLICY IF EXISTS "Public can view prescriptions" ON storage.objects;

CREATE POLICY "read own, targeted or linked" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'prescriptions' AND (
        -- Patient owns the folder
        (storage.foldername(name))[1] = auth.uid()::text
        -- Targeted doctor has access via exact match on image_url
        OR EXISTS (
            SELECT 1 FROM public.pending_reviews r
            WHERE r.image_url = name 
              AND r.target_doctor_id = auth.uid()
        )
        -- Active linked caregiver or doctor
        OR EXISTS (
            SELECT 1 FROM public.patient_caregivers pc
            WHERE pc.caregiver_id = auth.uid() 
              AND pc.status = 'active'
              AND pc.patient_id::text = (storage.foldername(name))[1]
        )
    )
);

-- -----------------------------------------------------------------------------
-- 2. PENDING REVIEWS: RESTRICT INSERT & REVOKE DIRECT UPDATES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Patients can insert reviews" ON public.pending_reviews;
DROP POLICY IF EXISTS "Patients insert own pending reviews" ON public.pending_reviews;
DROP POLICY IF EXISTS "Patients insert pending reviews" ON public.pending_reviews;

CREATE POLICY "Patients can insert reviews" ON public.pending_reviews
FOR INSERT TO authenticated
WITH CHECK (
    patient_id = auth.uid() 
    AND status = 'pending'
    AND doctor_notes IS NULL
    AND image_url LIKE auth.uid()::text || '/%'
);

-- Drop direct update policies: all reviews must go through approve_review / reject_review RPCs
DROP POLICY IF EXISTS "Supervisors update pending reviews" ON public.pending_reviews;
DROP POLICY IF EXISTS "Doctors can update reviews" ON public.pending_reviews;

-- -----------------------------------------------------------------------------
-- 3. PROFILES: PROTECT SENSITIVE ROLE & VERIFICATION FIELDS (TRIGGER)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_profile_fields() CASCADE;

CREATE OR REPLACE FUNCTION public.protect_profile_fields() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
BEGIN
    -- Only protect when called by non-superuser / client roles
    IF current_user IN ('anon', 'authenticated') THEN
        NEW.id := OLD.id;
        NEW.role := OLD.role;
        NEW.email := OLD.email;
        NEW.is_verified_doctor := OLD.is_verified_doctor;
        IF OLD.is_verified_doctor IS TRUE THEN
            NEW.medical_license_number := OLD.medical_license_number;
            NEW.medical_council := OLD.medical_council;
        END IF;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields 
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- -----------------------------------------------------------------------------
-- 4. TAKE_DOSE: OWNERSHIP CHECK & CONCURRENCY LOCK
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.take_dose(bigint, text, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.take_dose(bigint, text) CASCADE;
DROP FUNCTION IF EXISTS public.take_dose(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.take_dose CASCADE;

CREATE OR REPLACE FUNCTION public.take_dose(
    p_medication_id bigint,
    p_scheduled_time text DEFAULT '00:00',
    p_camera_verified boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
    v_pills_remaining int;
    v_log_status text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    -- Strict ownership and active status check with row lock
    PERFORM 1 FROM public.medications
    WHERE id = p_medication_id AND patient_id = v_user_id AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Medication not found or not owned by user';
    END IF;

    -- Check if dose was already taken today
    SELECT status INTO v_log_status FROM public.medication_logs 
    WHERE medication_id = p_medication_id AND log_date = v_today;

    IF v_log_status = 'taken' THEN
        SELECT pills_remaining INTO v_pills_remaining FROM public.medications WHERE id = p_medication_id;
        RETURN jsonb_build_object('success', true, 'pills_remaining', v_pills_remaining, 'already_taken', true);
    END IF;

    -- Record intake log
    INSERT INTO public.medication_logs (medication_id, patient_id, log_date, scheduled_time, status, camera_verified)
    VALUES (p_medication_id, v_user_id, v_today, p_scheduled_time, 'taken', p_camera_verified)
    ON CONFLICT (medication_id, log_date) DO UPDATE 
    SET status = 'taken', camera_verified = EXCLUDED.camera_verified, updated_at = now();

    -- Decrement pill inventory safely
    UPDATE public.medications
    SET pills_remaining = GREATEST(0, pills_remaining - 1), updated_at = now()
    WHERE id = p_medication_id AND patient_id = v_user_id
    RETURNING pills_remaining INTO v_pills_remaining;

    RETURN jsonb_build_object('success', true, 'pills_remaining', v_pills_remaining, 'already_taken', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.take_dose(bigint, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.take_dose(bigint, text, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. EVALUATE_MISSED_DOSES: MIDNIGHT ROLLOVER FIX
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.evaluate_missed_doses() CASCADE;
DROP FUNCTION IF EXISTS public.evaluate_missed_doses CASCADE;

CREATE OR REPLACE FUNCTION public.evaluate_missed_doses()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_updated_count int := 0;
BEGIN
    -- 1. Initialize today's active medicines
    PERFORM public.generate_daily_medication_logs();

    -- 2. Mark overdue pending doses comparing full timestamp (log_date + scheduled_time)
    WITH updated AS (
        UPDATE public.medication_logs
        SET status = 'missed', updated_at = now()
        WHERE status = 'pending'
          AND scheduled_time IS NOT NULL 
          AND scheduled_time <> ''
          AND (log_date + scheduled_time::time) < ((now() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '60 minutes')
        RETURNING id
    )
    SELECT count(*) INTO v_updated_count FROM updated;

    RETURN v_updated_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_daily_medication_logs() FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_daily_medication_logs() TO service_role;

-- Add time format constraint to prevent corrupt schedule strings breaking cron casts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_time_format'
    ) THEN
        ALTER TABLE public.medications ADD CONSTRAINT chk_time_format
            CHECK (time ~ '^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$') NOT VALID;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. PATIENT_CAREGIVERS & USER_CONSENTS POLICIES & CONSTRAINTS
-- -----------------------------------------------------------------------------
ALTER TABLE public.patient_caregivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient sees own links" ON public.patient_caregivers;
CREATE POLICY "patient sees own links" ON public.patient_caregivers
FOR SELECT TO authenticated USING (patient_id = auth.uid());

DROP POLICY IF EXISTS "caregiver sees own active links" ON public.patient_caregivers;
CREATE POLICY "caregiver sees own active links" ON public.patient_caregivers
FOR SELECT TO authenticated USING (caregiver_id = auth.uid() AND status = 'active');

DROP POLICY IF EXISTS "patient creates invite" ON public.patient_caregivers;
CREATE POLICY "patient creates invite" ON public.patient_caregivers
FOR INSERT TO authenticated
WITH CHECK (patient_id = auth.uid() AND caregiver_id IS NULL AND status = 'pending');

DROP POLICY IF EXISTS "patient revokes link" ON public.patient_caregivers;
CREATE POLICY "patient revokes link" ON public.patient_caregivers
FOR UPDATE TO authenticated USING (patient_id = auth.uid())
WITH CHECK (patient_id = auth.uid() AND status = 'revoked');

DROP POLICY IF EXISTS "caregiver mutes alerts" ON public.patient_caregivers;
CREATE POLICY "caregiver mutes alerts" ON public.patient_caregivers
FOR UPDATE TO authenticated USING (caregiver_id = auth.uid() AND status = 'active')
WITH CHECK (caregiver_id = auth.uid() AND status = 'active');

REVOKE UPDATE ON public.patient_caregivers FROM authenticated;
GRANT UPDATE (override_alerts, status) ON public.patient_caregivers TO authenticated;

-- Allow patient or caregiver/doctor to delete their own links directly
DROP POLICY IF EXISTS "patient or caregiver deletes link" ON public.patient_caregivers;
CREATE POLICY "patient or caregiver deletes link" ON public.patient_caregivers
FOR DELETE TO authenticated
USING (patient_id = auth.uid() OR caregiver_id = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS uq_open_pairing_code
ON public.patient_caregivers(pairing_code) WHERE caregiver_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_pc_status'
    ) THEN
        ALTER TABLE public.patient_caregivers ADD CONSTRAINT chk_pc_status
            CHECK (status IN ('pending', 'active', 'revoked'));
    END IF;
END $$;

-- User consents policies
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own consents read" ON public.user_consents;
CREATE POLICY "own consents read" ON public.user_consents
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own consents add" ON public.user_consents;
CREATE POLICY "own consents add" ON public.user_consents
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Disconnect Doctor RPC: safely unlinks clinical pairing and resets pending review targets
DROP FUNCTION IF EXISTS public.disconnect_doctor(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.disconnect_doctor CASCADE;

CREATE OR REPLACE FUNCTION public.disconnect_doctor(p_link_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_link record;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    -- Verify that caller is either the patient or the doctor/caregiver
    SELECT * INTO v_link
    FROM public.patient_caregivers
    WHERE id = p_link_id AND (patient_id = v_user_id OR caregiver_id = v_user_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Connection not found or not owned by user';
    END IF;

    -- If patient is unlinking, reset target_doctor_id on any pending reviews
    IF v_link.patient_id = v_user_id AND v_link.caregiver_id IS NOT NULL THEN
        UPDATE public.pending_reviews
        SET target_doctor_id = NULL
        WHERE patient_id = v_user_id 
          AND target_doctor_id = v_link.caregiver_id 
          AND status = 'pending';
    END IF;

    -- Delete link
    DELETE FROM public.patient_caregivers WHERE id = p_link_id;

    RETURN jsonb_build_object('success', true, 'message', 'Doctor successfully disconnected');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.disconnect_doctor(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.disconnect_doctor(bigint) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. APPROVE_REVIEW & REJECT_REVIEW: UNTARGETED REVIEW HARDENING
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.approve_review(bigint, text, text, text, text, text, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.approve_review(bigint, text, text, text, text, text, int, int) CASCADE;
DROP FUNCTION IF EXISTS public.approve_review(bigint, text, text, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.approve_review CASCADE;

CREATE OR REPLACE FUNCTION public.approve_review(
    p_review_id bigint,
    p_medicine_name text,
    p_dosage text,
    p_duration text,
    p_time text DEFAULT '08:00 AM',
    p_doctor_notes text DEFAULT NULL,
    p_pills_remaining int DEFAULT 30,
    p_total_pills int DEFAULT 30
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_caller_id uuid := auth.uid();
    v_caller_profile record;
    v_review record;
    v_med_id bigint;
    v_remaining int := COALESCE(p_pills_remaining, 30);
    v_total int := COALESCE(p_total_pills, 30);
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    -- Validate input ranges
    IF LENGTH(TRIM(COALESCE(p_medicine_name, ''))) = 0 OR LENGTH(p_medicine_name) > 200 THEN
        RAISE EXCEPTION 'Invalid medicine name: must be between 1 and 200 characters';
    END IF;
    IF v_remaining < 0 OR v_remaining > 5000 THEN
        RAISE EXCEPTION 'Invalid pill count: must be between 0 and 5000';
    END IF;

    -- Lock the row and verify pending status
    SELECT * INTO v_review 
    FROM public.pending_reviews 
    WHERE id = p_review_id AND status = 'pending' 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Prescription review not found or already approved/rejected';
    END IF;

    -- Caller must be verified doctor OR active linked caregiver
    SELECT * INTO v_caller_profile FROM public.profiles WHERE id = v_caller_id;
    IF v_caller_profile IS NULL OR (
        v_caller_profile.is_verified_doctor IS NOT TRUE 
        AND NOT EXISTS (
            SELECT 1 FROM public.patient_caregivers
            WHERE patient_id = v_review.patient_id
              AND caregiver_id = v_caller_id
              AND status = 'active'
        )
    ) THEN
        RAISE EXCEPTION 'Only verified doctors or active linked caregivers can review prescriptions';
    END IF;

    -- If targeted to another doctor, prevent review
    IF v_review.target_doctor_id IS NOT NULL 
       AND v_review.target_doctor_id IS DISTINCT FROM v_caller_id
       AND NOT EXISTS (
           SELECT 1 FROM public.patient_caregivers
           WHERE patient_id = v_review.patient_id
             AND caregiver_id = v_caller_id
             AND status = 'active'
       ) THEN
        RAISE EXCEPTION 'Not your patient: prescription assigned to another physician';
    END IF;

    -- If target_doctor_id is null, require an active link
    IF v_review.target_doctor_id IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.patient_caregivers
        WHERE patient_id = v_review.patient_id
          AND caregiver_id = v_caller_id
          AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Not your patient: no active clinical pairing';
    END IF;

    -- Update review status
    UPDATE public.pending_reviews
    SET status = 'approved',
        medication = p_medicine_name,
        dosage = p_dosage,
        duration = p_duration,
        doctor_notes = p_doctor_notes,
        updated_at = now()
    WHERE id = p_review_id;

    -- Insert confirmed medication into patient routine
    INSERT INTO public.medications (
        patient_id,
        medicine_name,
        dosage,
        time,
        status,
        duration,
        description,
        pills_remaining,
        total_pills,
        is_active
    ) VALUES (
        v_review.patient_id,
        p_medicine_name,
        p_dosage,
        COALESCE(p_time, '08:00 AM'),
        'pending',
        p_duration,
        'Reviewed by ' || COALESCE(v_caller_profile.full_name, 'Practitioner'),
        v_remaining,
        v_total,
        true
    ) RETURNING id INTO v_med_id;

    RETURN jsonb_build_object(
        'success', true,
        'review_id', p_review_id,
        'medication_id', v_med_id,
        'patient_id', v_review.patient_id,
        'medicine_name', p_medicine_name,
        'pills_remaining', v_remaining,
        'total_pills', v_total
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_review(bigint, text, text, text, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_review(bigint, text, text, text, text, text, int, int) TO authenticated;

DROP FUNCTION IF EXISTS public.reject_review(bigint, text) CASCADE;
DROP FUNCTION IF EXISTS public.reject_review(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.reject_review CASCADE;

CREATE OR REPLACE FUNCTION public.reject_review(
    p_review_id bigint,
    p_doctor_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_caller_id uuid := auth.uid();
    v_caller_profile record;
    v_review record;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    SELECT * INTO v_review 
    FROM public.pending_reviews 
    WHERE id = p_review_id AND status = 'pending' 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Prescription review not found or already approved/rejected';
    END IF;

    SELECT * INTO v_caller_profile FROM public.profiles WHERE id = v_caller_id;
    IF v_caller_profile IS NULL OR (
        v_caller_profile.is_verified_doctor IS NOT TRUE 
        AND NOT EXISTS (
            SELECT 1 FROM public.patient_caregivers
            WHERE patient_id = v_review.patient_id
              AND caregiver_id = v_caller_id
              AND status = 'active'
        )
    ) THEN
        RAISE EXCEPTION 'Only verified doctors or active linked caregivers can review prescriptions';
    END IF;

    IF v_review.target_doctor_id IS NOT NULL 
       AND v_review.target_doctor_id IS DISTINCT FROM v_caller_id
       AND NOT EXISTS (
           SELECT 1 FROM public.patient_caregivers
           WHERE patient_id = v_review.patient_id
             AND caregiver_id = v_caller_id
             AND status = 'active'
       ) THEN
        RAISE EXCEPTION 'Not your patient: prescription assigned to another physician';
    END IF;

    IF v_review.target_doctor_id IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.patient_caregivers
        WHERE patient_id = v_review.patient_id
          AND caregiver_id = v_caller_id
          AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Not your patient: no active clinical pairing';
    END IF;

    UPDATE public.pending_reviews
    SET status = 'rejected',
        doctor_notes = p_doctor_notes,
        updated_at = now()
    WHERE id = p_review_id;

    RETURN jsonb_build_object(
        'success', true,
        'review_id', p_review_id,
        'status', 'rejected'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_review(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_review(bigint, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. DELETE_USER_ACCOUNT: PRESERVE PATIENT REVIEWS ON DOCTOR DELETION
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.delete_user_account() CASCADE;
DROP FUNCTION IF EXISTS public.delete_user_account CASCADE;

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, storage AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized: authentication required'; END IF;

    -- 1. Purge physical storage photos under prescriptions bucket for this user
    DELETE FROM storage.objects 
    WHERE bucket_id = 'prescriptions' 
      AND (storage.foldername(name))[1] = v_user_id::text;

    -- 2. Purge personal medication logs & schedules
    DELETE FROM public.medication_logs WHERE patient_id = v_user_id;
    DELETE FROM public.medications WHERE patient_id = v_user_id;

    -- 3. If patient deletes account, delete their reviews.
    --    If doctor deletes account, NULL their assignment without destroying patient's prescription slip!
    DELETE FROM public.pending_reviews WHERE patient_id = v_user_id;
    UPDATE public.pending_reviews SET target_doctor_id = NULL WHERE target_doctor_id = v_user_id;

    -- 4. Purge pairings, push tokens, consents, and profile
    DELETE FROM public.patient_caregivers WHERE patient_id = v_user_id OR caregiver_id = v_user_id;
    DELETE FROM public.user_push_tokens WHERE user_id = v_user_id;
    DELETE FROM public.user_consents WHERE user_id = v_user_id;
    DELETE FROM public.profiles WHERE id = v_user_id;

    -- 5. Purge auth identity from auth.users (permits immediate re-registration)
    DELETE FROM auth.users WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Account and personal health data completely purged');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- -----------------------------------------------------------------------------
-- 9. SCAN_USAGE: DEDICATED OCR QUOTA TRACKING TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scan_usage (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scan_date DATE NOT NULL,
    scan_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, scan_date)
);

ALTER TABLE public.scan_usage ENABLE ROW LEVEL SECURITY;
-- By default no public or anon access; written exclusively via service_role in scan-prescription
