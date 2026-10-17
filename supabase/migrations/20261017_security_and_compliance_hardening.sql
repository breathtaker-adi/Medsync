-- =============================================================================
-- MedSync Migration: Security, Pairing, Timezone & Integrity Hardening v2
-- Date: 2026-10-17
-- Closes all 7 remaining High-severity and Logic gaps identified in audit:
-- 1. Locks evaluate_missed_doses, take_dose, approve_review, claim_pairing_code execution
-- 2. Fixes protect_profile_fields trigger to allow postgres/service_role updates
-- 3. Eliminates pairing role bypass, restricts insert/update, enforces 15m expiry
-- 4. Server-side create_pairing_code() RPC
-- 5. take_dose prevents double-decrement on repeat taps, sets Asia/Kolkata date
-- 6. evaluate_missed_doses uses Asia/Kolkata timezone
-- 7. Stops forged pending_reviews and double approvals, adds reject_review RPC
-- 8. Enforces bucket size & mime-type limits, isolates push tokens into owner-only table
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. FUNCTION PERMISSION HARDENING
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.evaluate_missed_doses() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_missed_doses() TO service_role;

REVOKE EXECUTE ON FUNCTION public.take_dose(bigint, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.take_dose(bigint, text, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.approve_review(bigint, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_review(bigint, text, text, text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.claim_pairing_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_pairing_code(text) TO authenticated;


-- -----------------------------------------------------------------------------
-- 2. FIX PROFILE PROTECTION TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Prevent anon and authenticated clients from escalating role or doctor verification
    IF current_user IN ('anon', 'authenticated') THEN
        NEW.id := OLD.id;
        NEW.role := OLD.role;
        NEW.is_verified_doctor := OLD.is_verified_doctor;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();


-- -----------------------------------------------------------------------------
-- 3. PAIRING HARDENING & SERVER-SIDE CODE GENERATION
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_open_pairing_code ON public.patient_caregivers(pairing_code)
WHERE caregiver_id IS NULL;

-- Atomic claim function with explicit NULL checks and 15-minute expiry window
CREATE OR REPLACE FUNCTION public.claim_pairing_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id uuid := auth.uid();
    v_caller_role text;
    v_record record;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to claim pairing code';
    END IF;

    SELECT role INTO v_caller_role FROM profiles WHERE id = v_caller_id;
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('caregiver', 'doctor') THEN
        RAISE EXCEPTION 'Only caregivers or doctors can claim pairing codes';
    END IF;

    -- Atomically claim unassigned code created within the last 15 minutes
    UPDATE patient_caregivers
    SET caregiver_id = v_caller_id,
        status = 'active'
    WHERE pairing_code = upper(trim(p_code))
      AND caregiver_id IS NULL
      AND created_at > (now() - interval '15 minutes')
    RETURNING * INTO v_record;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid, expired, or already claimed pairing code';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'patient_id', v_record.patient_id,
        'message', 'Patient successfully linked'
    );
END;
$$;

-- Server-side cryptographic pairing code generator
CREATE OR REPLACE FUNCTION public.create_pairing_code()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_patient_id uuid := auth.uid();
    v_code text;
    v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    v_bytes bytea;
    v_existing record;
BEGIN
    IF v_patient_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Re-use unexpired code within 15 minutes if exists
    SELECT pairing_code, created_at INTO v_existing
    FROM patient_caregivers
    WHERE patient_id = v_patient_id
      AND caregiver_id IS NULL
      AND created_at > (now() - interval '15 minutes')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing.pairing_code IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'pairing_code', v_existing.pairing_code);
    END IF;

    -- Generate cryptographic 8-character uppercase code without ambiguous chars (O, 0, I, 1)
    v_bytes := gen_random_bytes(8);
    v_code := '';
    FOR i IN 0..7 LOOP
        v_code := v_code || substr(v_chars, (get_byte(v_bytes, i) % length(v_chars)) + 1, 1);
    END LOOP;

    INSERT INTO patient_caregivers (patient_id, pairing_code, status)
    VALUES (v_patient_id, v_code, 'pending');

    RETURN jsonb_build_object('success', true, 'pairing_code', v_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_pairing_code() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_pairing_code() FROM anon, PUBLIC;

-- Restrict patient_caregivers policies
DROP POLICY IF EXISTS "Patients create pairing invitations" ON public.patient_caregivers;
CREATE POLICY "Patients create pairing invitations" ON public.patient_caregivers
FOR INSERT TO authenticated
WITH CHECK (
    patient_id = auth.uid() 
    AND caregiver_id IS NULL 
    AND status = 'pending'
);

DROP POLICY IF EXISTS "Patients revoke links" ON public.patient_caregivers;
CREATE POLICY "Patients revoke links" ON public.patient_caregivers
FOR UPDATE TO authenticated
USING (patient_id = auth.uid())
WITH CHECK (patient_id = auth.uid() AND status = 'revoked');

REVOKE UPDATE ON public.patient_caregivers FROM authenticated;
GRANT UPDATE (override_alerts, status) ON public.patient_caregivers TO authenticated;


-- -----------------------------------------------------------------------------
-- 4. TAKE_DOSE IDEMPOTENCE & INDIA TIMEZONE (ASIA/KOLKATA)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.take_dose(
    p_medication_id bigint,
    p_scheduled_time text DEFAULT '00:00',
    p_camera_verified boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_patient_id uuid := auth.uid();
    v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
    v_new_pills int;
    v_med_name text;
    v_log_id bigint;
BEGIN
    SELECT medicine_name INTO v_med_name
    FROM medications
    WHERE id = p_medication_id AND patient_id = v_patient_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Medication not found or unauthorized';
    END IF;

    -- Upsert intake log only if not already taken today
    INSERT INTO medication_logs (
        medication_id,
        patient_id,
        log_date,
        scheduled_time,
        status,
        camera_verified
    ) VALUES (
        p_medication_id,
        v_patient_id,
        v_today,
        p_scheduled_time,
        'taken',
        p_camera_verified
    )
    ON CONFLICT (medication_id, log_date)
    DO UPDATE SET
        status = 'taken',
        camera_verified = EXCLUDED.camera_verified
    WHERE medication_logs.status != 'taken'
    RETURNING id INTO v_log_id;

    -- If already taken earlier today, return early without double-decrementing pills
    IF v_log_id IS NULL THEN
        SELECT pills_remaining INTO v_new_pills
        FROM medications
        WHERE id = p_medication_id;

        RETURN jsonb_build_object(
            'success', true,
            'already_taken', true,
            'pills_remaining', COALESCE(v_new_pills, 0),
            'medicine_name', v_med_name,
            'camera_verified', p_camera_verified
        );
    END IF;

    -- Atomically decrement pills on first take
    UPDATE medications
    SET pills_remaining = GREATEST(0, COALESCE(pills_remaining, 30) - 1)
    WHERE id = p_medication_id AND patient_id = v_patient_id
    RETURNING pills_remaining INTO v_new_pills;

    RETURN jsonb_build_object(
        'success', true,
        'already_taken', false,
        'pills_remaining', v_new_pills,
        'medicine_name', v_med_name,
        'camera_verified', p_camera_verified
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- 5. EVALUATE_MISSED_DOSES INDIA TIMEZONE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_missed_doses()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count int := 0;
    v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
    v_cutoff_time time := ((now() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '60 minutes')::time;
BEGIN
    WITH updated AS (
        UPDATE medication_logs
        SET status = 'missed'
        WHERE status = 'pending'
          AND (
            log_date < v_today
            OR (
                log_date = v_today
                AND scheduled_time IS NOT NULL
                AND scheduled_time <> ''
                AND scheduled_time::time < v_cutoff_time
            )
          )
        RETURNING id
    )
    SELECT count(*) INTO v_updated_count FROM updated;

    RETURN v_updated_count;
END;
$$;


-- -----------------------------------------------------------------------------
-- 6. PENDING REVIEWS SECURITY & REJECT RPC
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Patients insert pending reviews" ON public.pending_reviews;
CREATE POLICY "Patients insert pending reviews" ON public.pending_reviews
FOR INSERT TO authenticated
WITH CHECK (
    patient_id = auth.uid()
    AND status = 'pending'
    AND doctor_notes IS NULL
    AND image_url LIKE (auth.uid()::text || '/%')
);

CREATE OR REPLACE FUNCTION public.approve_review(
    p_review_id bigint,
    p_medicine_name text,
    p_dosage text,
    p_duration text,
    p_time text DEFAULT '08:00 AM',
    p_doctor_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id uuid := auth.uid();
    v_caller_profile record;
    v_review record;
    v_med_id bigint;
BEGIN
    SELECT * INTO v_caller_profile FROM profiles WHERE id = v_caller_id;
    IF v_caller_profile IS NULL OR v_caller_profile.is_verified_doctor = false THEN
        RAISE EXCEPTION 'Unauthorized: only verified physicians can approve prescriptions';
    END IF;

    -- Lock the row and verify it is currently pending to prevent double-approval race conditions
    SELECT * INTO v_review 
    FROM pending_reviews 
    WHERE id = p_review_id AND status = 'pending' 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Prescription review not found or already approved/rejected';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM patient_caregivers
        WHERE patient_id = v_review.patient_id
          AND caregiver_id = v_caller_id
          AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: you are not an active supervisor for this patient';
    END IF;

    UPDATE pending_reviews
    SET status = 'approved',
        medication = p_medicine_name,
        dosage = p_dosage,
        duration = p_duration,
        doctor_notes = p_doctor_notes
    WHERE id = p_review_id;

    INSERT INTO medications (
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
        p_time,
        'pending',
        p_duration,
        p_doctor_notes,
        30,
        30,
        true
    ) RETURNING id INTO v_med_id;

    RETURN jsonb_build_object(
        'success', true,
        'medication_id', v_med_id,
        'patient_id', v_review.patient_id,
        'medicine_name', p_medicine_name
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_review(
    p_review_id bigint,
    p_doctor_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id uuid := auth.uid();
    v_caller_profile record;
    v_review record;
BEGIN
    SELECT * INTO v_caller_profile FROM profiles WHERE id = v_caller_id;
    IF v_caller_profile IS NULL OR v_caller_profile.is_verified_doctor = false THEN
        RAISE EXCEPTION 'Unauthorized: only verified physicians can reject prescriptions';
    END IF;

    SELECT * INTO v_review 
    FROM pending_reviews 
    WHERE id = p_review_id AND status = 'pending' 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Prescription review not found or already approved/rejected';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM patient_caregivers
        WHERE patient_id = v_review.patient_id
          AND caregiver_id = v_caller_id
          AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: you are not an active supervisor for this patient';
    END IF;

    UPDATE pending_reviews
    SET status = 'rejected',
        doctor_notes = p_doctor_notes
    WHERE id = p_review_id;

    RETURN jsonb_build_object(
        'success', true,
        'review_id', p_review_id,
        'status', 'rejected'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_review(bigint, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_review(bigint, text) FROM anon, PUBLIC;


-- -----------------------------------------------------------------------------
-- 7. STORAGE LIMITS & PUSH TOKEN OWNER-ONLY ISOLATION
-- -----------------------------------------------------------------------------
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'prescriptions';

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    push_token TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push token" ON public.user_push_tokens;
CREATE POLICY "Users manage own push token"
ON public.user_push_tokens FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Drop obsolete leaky push token views
DROP VIEW IF EXISTS public.doctor_push_tokens CASCADE;
DROP VIEW IF EXISTS public.patient_push_tokens CASCADE;
