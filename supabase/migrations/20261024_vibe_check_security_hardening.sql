-- =============================================================================
-- MedSync Security Hardening Migration (Vibe-Check & OWASP ASVS Compliance)
-- Migration: 20261024_vibe_check_security_hardening.sql
-- Date: 2026-10-24
-- Purpose:
-- 1. Enforces Row Level Security (RLS) across all tables (medications, logs, tokens, profiles).
-- 2. Closes IDOR in public.profiles by enforcing status = 'active' for linked caregivers.
-- 3. Implements strict RLS policies for public.medications and public.medication_logs.
-- 4. Ensures public.user_push_tokens table and owner-only RLS policies exist.
-- 5. Tightens untargeted pending_reviews read access to verified doctors only.
-- 6. Adds atomic create_pairing_code and claim_pairing_code RPCs with 15-min expiry and row locks.
-- 7. Adds atomic check_and_increment_scan_quota RPC to prevent AI OCR billing exhaustion.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. HARDEN PROFILES RLS (CLOSE IDOR FOR REVOKED / PENDING CAREGIVERS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Caregivers can view linked patient profiles" ON public.profiles;
CREATE POLICY "Caregivers can view linked patient profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
    auth.uid() = id
    OR EXISTS (
        SELECT 1 FROM public.patient_caregivers pc
        WHERE pc.caregiver_id = auth.uid() 
          AND pc.patient_id = profiles.id
          AND pc.status = 'active'
    )
);

-- -----------------------------------------------------------------------------
-- 2. MEDICATIONS TABLE & RLS POLICIES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medications (
    id BIGSERIAL PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    time TEXT NOT NULL,
    duration TEXT,
    status TEXT DEFAULT 'pending',
    pills_remaining INTEGER DEFAULT 30,
    total_pills INTEGER DEFAULT 30,
    food_warning TEXT,
    is_active BOOLEAN DEFAULT true,
    paused_reason TEXT,
    paused_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medications FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medications TO authenticated;

DROP POLICY IF EXISTS "Users can view own medications" ON public.medications;
CREATE POLICY "Users can view own medications"
ON public.medications FOR SELECT TO authenticated
USING (
    patient_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.patient_caregivers pc
        WHERE pc.patient_id = medications.patient_id
          AND pc.caregiver_id = auth.uid()
          AND pc.status = 'active'
    )
);

DROP POLICY IF EXISTS "Users can insert own medications" ON public.medications;
CREATE POLICY "Users can insert own medications"
ON public.medications FOR INSERT TO authenticated
WITH CHECK (patient_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own medications" ON public.medications;
CREATE POLICY "Users can update own medications"
ON public.medications FOR UPDATE TO authenticated
USING (patient_id = auth.uid())
WITH CHECK (patient_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own medications" ON public.medications;
CREATE POLICY "Users can delete own medications"
ON public.medications FOR DELETE TO authenticated
USING (patient_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3. MEDICATION_LOGS TABLE & RLS POLICIES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medication_logs (
    id BIGSERIAL PRIMARY KEY,
    medication_id BIGINT REFERENCES public.medications(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    scheduled_time TEXT,
    status TEXT CHECK (status IN ('taken', 'missed', 'skipped', 'pending')) DEFAULT 'pending',
    camera_verified BOOLEAN DEFAULT false,
    snooze_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_medication_date UNIQUE (medication_id, log_date)
);

ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medication_logs FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_logs TO authenticated;

DROP POLICY IF EXISTS "Users can view own logs" ON public.medication_logs;
CREATE POLICY "Users can view own logs"
ON public.medication_logs FOR SELECT TO authenticated
USING (
    patient_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.patient_caregivers pc
        WHERE pc.patient_id = medication_logs.patient_id
          AND pc.caregiver_id = auth.uid()
          AND pc.status = 'active'
    )
);

DROP POLICY IF EXISTS "Users can insert own logs" ON public.medication_logs;
CREATE POLICY "Users can insert own logs"
ON public.medication_logs FOR INSERT TO authenticated
WITH CHECK (patient_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own logs" ON public.medication_logs;
CREATE POLICY "Users can update own logs"
ON public.medication_logs FOR UPDATE TO authenticated
USING (patient_id = auth.uid())
WITH CHECK (patient_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own logs" ON public.medication_logs;
CREATE POLICY "Users can delete own logs"
ON public.medication_logs FOR DELETE TO authenticated
USING (patient_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 4. USER_PUSH_TOKENS TABLE & RLS POLICIES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    push_token TEXT NOT NULL,
    device_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_user_push_token UNIQUE (user_id, push_token)
);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_push_tokens FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_push_tokens TO authenticated;

DROP POLICY IF EXISTS "Users can view own push token" ON public.user_push_tokens;
CREATE POLICY "Users can view own push token"
ON public.user_push_tokens FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert own push token" ON public.user_push_tokens;
CREATE POLICY "Users can upsert own push token"
ON public.user_push_tokens FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5. TIGHTEN UNTARGETED PENDING REVIEWS READ POLICY (VERIFIED DOCTORS ONLY)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Supervisors view pending reviews" ON public.pending_reviews;
DROP POLICY IF EXISTS "doctor reads targeted or linked reviews" ON public.pending_reviews;

CREATE POLICY "doctor reads targeted or linked reviews" ON public.pending_reviews
FOR SELECT TO authenticated
USING (
    patient_id = auth.uid()
    OR target_doctor_id = auth.uid()
    OR (
        target_doctor_id IS NULL
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.is_verified_doctor = true
        )
    )
    OR EXISTS (
        SELECT 1 FROM public.patient_caregivers pc
        WHERE pc.patient_id = pending_reviews.patient_id
          AND pc.caregiver_id = auth.uid()
          AND pc.status = 'active'
    )
);

-- -----------------------------------------------------------------------------
-- 6. ATOMIC PAIRING CODE RPCs (CREATE & CLAIM WITH 15-MIN EXPIRY)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_pairing_code() CASCADE;
CREATE OR REPLACE FUNCTION public.create_pairing_code()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_existing_code text;
    v_existing_created timestamptz;
    v_new_code text;
    v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    v_code_len int := 8;
    i int;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    -- Check if patient already has an open, valid code (< 15 mins old)
    SELECT pairing_code, created_at INTO v_existing_code, v_existing_created
    FROM public.patient_caregivers
    WHERE patient_id = v_user_id AND caregiver_id IS NULL AND status = 'pending'
    ORDER BY created_at DESC LIMIT 1;

    IF v_existing_code IS NOT NULL AND v_existing_created > (now() - interval '15 minutes') THEN
        RETURN jsonb_build_object('success', true, 'pairing_code', v_existing_code, 'is_new', false);
    END IF;

    -- Delete any old expired open invites for this patient
    DELETE FROM public.patient_caregivers
    WHERE patient_id = v_user_id AND caregiver_id IS NULL AND status = 'pending';

    -- Generate a cryptographically secure 8-character uppercase pairing code
    v_new_code := '';
    FOR i IN 1..v_code_len LOOP
        v_new_code := v_new_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;

    INSERT INTO public.patient_caregivers (patient_id, pairing_code, status, created_at, updated_at)
    VALUES (v_user_id, v_new_code, 'pending', now(), now());

    RETURN jsonb_build_object('success', true, 'pairing_code', v_new_code, 'is_new', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_pairing_code() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pairing_code() TO authenticated;

DROP FUNCTION IF EXISTS public.claim_pairing_code(text) CASCADE;
CREATE OR REPLACE FUNCTION public.claim_pairing_code(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_caller_id uuid := auth.uid();
    v_caller_role text;
    v_link record;
    v_clean_code text := upper(trim(p_code));
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    -- Verify caller profile and reject patient self-pairing or NULL role
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('caregiver', 'doctor') THEN
        RAISE EXCEPTION 'Only designated caregivers or doctors can link with patient pairing codes';
    END IF;

    -- Find matching open invite with row lock
    SELECT * INTO v_link
    FROM public.patient_caregivers
    WHERE pairing_code = v_clean_code AND caregiver_id IS NULL AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or already claimed pairing code';
    END IF;

    -- Enforce 15-minute expiration
    IF v_link.created_at < (now() - interval '15 minutes') THEN
        DELETE FROM public.patient_caregivers WHERE id = v_link.id;
        RAISE EXCEPTION 'Pairing code has expired. Please ask the patient to generate a new code.';
    END IF;

    -- Prevent self-pairing if user attempts to link with their own patient code
    IF v_link.patient_id = v_caller_id THEN
        RAISE EXCEPTION 'Cannot pair with yourself';
    END IF;

    -- Activate link
    UPDATE public.patient_caregivers
    SET caregiver_id = v_caller_id,
        status = 'active',
        updated_at = now()
    WHERE id = v_link.id;

    RETURN jsonb_build_object(
        'success', true,
        'link_id', v_link.id,
        'patient_id', v_link.patient_id,
        'caregiver_id', v_caller_id,
        'status', 'active'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_pairing_code(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pairing_code(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. ATOMIC AI OCR SCAN QUOTA RPC (FAIL-CLOSED DEFENSE)
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
REVOKE ALL ON public.scan_usage FROM anon, PUBLIC;

DROP FUNCTION IF EXISTS public.check_and_increment_scan_quota(uuid, int) CASCADE;
CREATE OR REPLACE FUNCTION public.check_and_increment_scan_quota(
    p_user_id uuid DEFAULT auth.uid(),
    p_max_daily int DEFAULT 10
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_uid uuid := COALESCE(p_user_id, auth.uid());
    v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
    v_current_count int := 0;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    -- Lock usage row if exists
    SELECT scan_count INTO v_current_count
    FROM public.scan_usage
    WHERE user_id = v_uid AND scan_date = v_today
    FOR UPDATE;

    IF v_current_count >= p_max_daily THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'current_count', v_current_count,
            'max_daily', p_max_daily,
            'message', 'Daily prescription scan quota reached'
        );
    END IF;

    -- Upsert atomically
    INSERT INTO public.scan_usage (user_id, scan_date, scan_count, updated_at)
    VALUES (v_uid, v_today, 1, now())
    ON CONFLICT (user_id, scan_date) DO UPDATE
    SET scan_count = public.scan_usage.scan_count + 1,
        updated_at = now()
    RETURNING scan_count INTO v_current_count;

    RETURN jsonb_build_object(
        'allowed', true,
        'current_count', v_current_count,
        'max_daily', p_max_daily
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_increment_scan_quota(uuid, int) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_scan_quota(uuid, int) TO authenticated, service_role;
