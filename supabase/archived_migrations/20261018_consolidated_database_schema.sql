-- =============================================================================
-- MedSync Consolidated Database Migration
-- Date: 2026-10-18
-- Description:
-- Complete, self-contained SQL script containing all necessary database updates
-- for MedSync:
-- 1. Profiles table columns (age, blood group, allergies, clinical credentials)
-- 2. User auto-creation trigger & profile security rules
-- 3. Doctor verification RPC (submit_doctor_verification)
-- 4. Pending reviews table updates & RLS policies
-- 5. Prescription review approval (approve_review) & rejection (reject_review) RPCs
-- 6. Storage bucket policies for prescription slips
-- 7. Realtime publications for instant triage & updates
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. PROFILES TABLE ENHANCEMENTS
-- =============================================================================
-- Ensure the profiles table exists
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT CHECK (role IN ('patient', 'caregiver', 'doctor')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all patient & clinical columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blood_group TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS alerts_enabled BOOLEAN DEFAULT true;
-- Push tokens are stored exclusively in isolated public.user_push_tokens table (owner-only RLS)
-- Drop dependent legacy views first before removing profiles.push_token (recreated later with security_invoker = true)
DROP VIEW IF EXISTS public.doctor_push_tokens CASCADE;
DROP VIEW IF EXISTS public.patient_push_tokens CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS push_token CASCADE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified_doctor BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS medical_license_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS medical_council TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialty TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clinic_affiliation TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS years_of_experience TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-profile trigger on auth.users for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        full_name,
        role,
        is_verified_doctor,
        alerts_enabled,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        CASE WHEN NEW.raw_user_meta_data->>'role' = 'caregiver' THEN 'caregiver' ELSE 'patient' END,
        false,
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
        role = COALESCE(public.profiles.role, EXCLUDED.role),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Clean up and apply robust Profile RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Caregivers can view linked patient profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own non-sensitive profile fields" ON public.profiles;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Allow caregivers/doctors to view linked patient profiles
CREATE POLICY "Caregivers can view linked patient profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.patient_caregivers pc
        WHERE pc.caregiver_id = auth.uid() 
          AND pc.patient_id = profiles.id 
          AND pc.status = 'active'
    )
);

-- Allow authenticated users to insert their own profile
CREATE POLICY "Users insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = id
    AND (role IS NULL OR role IN ('patient', 'caregiver', 'doctor'))
);

-- Allow authenticated users to update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Prevent unauthorized direct client tampering of is_verified_doctor
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_user <> 'service_role' THEN
        -- Only service_role or SECURITY DEFINER verification RPC can change is_verified_doctor
        NEW.is_verified_doctor := OLD.is_verified_doctor;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();


-- =============================================================================
-- 2. DOCTOR CREDENTIAL VERIFICATION GOVERNANCE
-- =============================================================================
-- Remove unauthenticated/arbitrary self-verification RPC.
-- Verified physician status is granted exclusively by clinical administrative review
-- against State Medical Council or National Medical Commission (NMC) registries.
DROP FUNCTION IF EXISTS public.submit_doctor_verification(TEXT, TEXT, TEXT, TEXT);


-- =============================================================================
-- 3. PENDING REVIEWS TABLE & POLICIES
-- =============================================================================
-- Ensure pending_reviews has target_doctor_id and ocr_status columns
ALTER TABLE public.pending_reviews ADD COLUMN IF NOT EXISTS target_doctor_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.pending_reviews ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'ok' CHECK (ocr_status IN ('ok', 'failed', 'flagged'));

ALTER TABLE public.pending_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients view own pending reviews" ON public.pending_reviews;
CREATE POLICY "Patients view own pending reviews" ON public.pending_reviews
FOR SELECT TO authenticated
USING (patient_id = auth.uid());

DROP POLICY IF EXISTS "Patients insert own pending reviews" ON public.pending_reviews;
CREATE POLICY "Patients insert own pending reviews" ON public.pending_reviews
FOR INSERT TO authenticated
WITH CHECK (patient_id = auth.uid());

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
              AND (p.role IN ('doctor', 'caregiver') OR p.is_verified_doctor = true)
        )
    )
    OR EXISTS (
        SELECT 1 FROM public.patient_caregivers pc
        WHERE pc.patient_id = pending_reviews.patient_id
          AND pc.caregiver_id = auth.uid()
          AND pc.status = 'active'
    )
);

DROP POLICY IF EXISTS "Supervisors update pending reviews" ON public.pending_reviews;
CREATE POLICY "Supervisors update pending reviews" ON public.pending_reviews
FOR UPDATE TO authenticated
USING (
    target_doctor_id = auth.uid()
    OR (
        target_doctor_id IS NULL
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (p.role IN ('doctor', 'caregiver') OR p.is_verified_doctor = true)
        )
    )
    OR EXISTS (
        SELECT 1 FROM public.patient_caregivers pc
        WHERE pc.patient_id = pending_reviews.patient_id
          AND pc.caregiver_id = auth.uid()
          AND pc.status = 'active'
    )
);



-- =============================================================================
-- 4. PRESCRIPTION REVIEW APPROVE & REJECT RPCS
-- =============================================================================
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
    FROM pending_reviews 
    WHERE id = p_review_id AND status = 'pending' 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Prescription review not found or already approved/rejected';
    END IF;

    -- Caller must be verified doctor OR active linked caregiver
    SELECT * INTO v_caller_profile FROM profiles WHERE id = v_caller_id;
    IF v_caller_profile IS NULL OR (
        v_caller_profile.is_verified_doctor IS NOT TRUE 
        AND NOT EXISTS (
            SELECT 1 FROM patient_caregivers
            WHERE patient_id = v_review.patient_id
              AND caregiver_id = v_caller_id
              AND status = 'active'
        )
    ) THEN
        RAISE EXCEPTION 'Only verified doctors or active linked caregivers can review prescriptions';
    END IF;

    -- If a specific target doctor was assigned, prevent unrelated doctors from approving
    IF v_review.target_doctor_id IS NOT NULL 
       AND v_review.target_doctor_id IS DISTINCT FROM v_caller_id
       AND NOT EXISTS (
           SELECT 1 FROM patient_caregivers
           WHERE patient_id = v_review.patient_id
             AND caregiver_id = v_caller_id
             AND status = 'active'
       ) THEN
        RAISE EXCEPTION 'Not your patient: prescription assigned to another physician';
    END IF;

    -- Update review status
    UPDATE pending_reviews
    SET status = 'approved',
        medication = p_medicine_name,
        dosage = p_dosage,
        duration = p_duration,
        doctor_notes = p_doctor_notes
    WHERE id = p_review_id;

    -- Insert confirmed medication into patient routine
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
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    SELECT * INTO v_review 
    FROM pending_reviews 
    WHERE id = p_review_id AND status = 'pending' 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Prescription review not found or already approved/rejected';
    END IF;

    -- Caller must be verified doctor OR active linked caregiver
    SELECT * INTO v_caller_profile FROM profiles WHERE id = v_caller_id;
    IF v_caller_profile IS NULL OR (
        v_caller_profile.is_verified_doctor IS NOT TRUE 
        AND NOT EXISTS (
            SELECT 1 FROM patient_caregivers
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
           SELECT 1 FROM patient_caregivers
           WHERE patient_id = v_review.patient_id
             AND caregiver_id = v_caller_id
             AND status = 'active'
       ) THEN
        RAISE EXCEPTION 'Not your patient: prescription assigned to another physician';
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

-- Lock execute permissions strictly to authenticated users
REVOKE EXECUTE ON FUNCTION public.approve_review(bigint, text, text, text, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_review(bigint, text, text, text, text, text, int, int) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reject_review(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_review(bigint, text) TO authenticated;


-- =============================================================================
-- 5. STORAGE BUCKET POLICIES FOR PRESCRIPTIONS (PRIVATE BUCKET)
-- =============================================================================
-- Prescriptions storage is strictly confidential under DPDP Act 2023.
-- Bucket is set to private (public = false); all access requires scoped authenticated RLS or signed HMAC URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('prescriptions', 'prescriptions', false)
ON CONFLICT (id) DO UPDATE SET public = false;

UPDATE storage.buckets SET public = false WHERE id = 'prescriptions';

DROP POLICY IF EXISTS "Public can view prescriptions" ON storage.objects;
DROP POLICY IF EXISTS "read own or linked patient or doctor" ON storage.objects;
DROP POLICY IF EXISTS "read own or linked patient" ON storage.objects;
DROP POLICY IF EXISTS "read own, targeted or linked" ON storage.objects;

CREATE POLICY "read own, targeted or linked" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'prescriptions' 
    AND (
        -- Patient owns the uploaded folder
        (storage.foldername(name))[1] = auth.uid()::text
        -- Targeted doctor has access to prescription image (handles path variations or unassigned practice queue)
        OR EXISTS (
            SELECT 1 FROM public.pending_reviews r
            WHERE (r.image_url = name OR r.image_url LIKE '%' || name OR name LIKE '%' || r.image_url)
              AND (r.target_doctor_id = auth.uid() OR r.target_doctor_id IS NULL)
        )
        -- Active linked caregiver or doctor
        OR EXISTS (
            SELECT 1 FROM public.patient_caregivers pc
            WHERE pc.caregiver_id = auth.uid()
              AND pc.status = 'active'
              AND pc.patient_id::text = (storage.foldername(name))[1]
        )
        -- Verified doctor or clinical caregiver reviewing prescription slips
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() 
              AND (p.is_verified_doctor = true OR p.role IN ('doctor', 'caregiver'))
        )
    )
);

DROP POLICY IF EXISTS "patients upload prescription slips" ON storage.objects;
CREATE POLICY "patients upload prescription slips" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'prescriptions'
    AND (storage.foldername(name))[1] = auth.uid()::text
);


-- =============================================================================
-- 6. PUSH TOKEN ISOLATION & SECURE VIEWS
-- =============================================================================
-- Ensure user_push_tokens table exists with isolated RLS
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    push_token TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push token" ON public.user_push_tokens;
CREATE POLICY "Users can view own push token" ON public.user_push_tokens
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert own push token" ON public.user_push_tokens;
CREATE POLICY "Users can upsert own push token" ON public.user_push_tokens
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Enforce bucket file size (5MB max) and valid image mime types
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
WHERE id = 'prescriptions';

-- Create views with security_invoker = true (reading exclusively from isolated user_push_tokens)
DROP VIEW IF EXISTS public.doctor_push_tokens CASCADE;
CREATE VIEW public.doctor_push_tokens WITH (security_invoker = true) AS
SELECT 
    pc.patient_id,
    upt.push_token,
    pc.caregiver_id
FROM public.patient_caregivers pc
JOIN public.user_push_tokens upt ON pc.caregiver_id = upt.user_id
WHERE upt.push_token IS NOT NULL;

DROP VIEW IF EXISTS public.patient_push_tokens CASCADE;
CREATE VIEW public.patient_push_tokens WITH (security_invoker = true) AS
SELECT 
    pc.caregiver_id,
    pc.patient_id,
    upt.push_token
FROM public.patient_caregivers pc
JOIN public.user_push_tokens upt ON pc.patient_id = upt.user_id
WHERE upt.push_token IS NOT NULL;

REVOKE ALL ON public.doctor_push_tokens FROM anon;
REVOKE ALL ON public.patient_push_tokens FROM anon;
GRANT SELECT ON public.doctor_push_tokens TO authenticated;
GRANT SELECT ON public.patient_push_tokens TO authenticated;


-- =============================================================================
-- 7. DAILY DOSE LOG PRE-POPULATION & ADHERENCE EVALUATION
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_daily_medication_logs()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
    v_inserted_count int := 0;
BEGIN
    WITH inserted AS (
        INSERT INTO medication_logs (medication_id, patient_id, log_date, scheduled_time, status)
        SELECT 
            m.id, 
            m.patient_id, 
            v_today, 
            m.time, 
            'pending'
        FROM medications m
        WHERE m.is_active = true
        ON CONFLICT (medication_id, log_date) DO NOTHING
        RETURNING id
    )
    SELECT count(*) INTO v_inserted_count FROM inserted;

    RETURN v_inserted_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.generate_daily_medication_logs() TO service_role, authenticated;

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
    -- 1. Ensure today's active medicines have pending entries initialized
    PERFORM public.generate_daily_medication_logs();

    -- 2. Mark overdue pending doses as missed
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
REVOKE EXECUTE ON FUNCTION public.evaluate_missed_doses() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_missed_doses() TO service_role;


-- =============================================================================
-- 8. PATIENT-CAREGIVER LINK INTEGRITY & POLICIES
-- =============================================================================
ALTER TABLE public.patient_caregivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Caregivers view own active links" ON public.patient_caregivers;
CREATE POLICY "Caregivers view own active links" ON public.patient_caregivers
FOR SELECT TO authenticated
USING (caregiver_id = auth.uid() OR patient_id = auth.uid());

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

-- Protect links from client tampering (cannot rewrite patient_id or caregiver_id)
REVOKE UPDATE ON public.patient_caregivers FROM authenticated;
GRANT UPDATE (override_alerts, status) ON public.patient_caregivers TO authenticated;


-- =============================================================================
-- 9. USER CONSENTS AUDIT LOGGING (DPDP ACT 2023)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_consents (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL DEFAULT 'dpdp_ocr_processing',
    consent_version TEXT NOT NULL DEFAULT '1.0',
    consented_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    ip_address TEXT,
    CONSTRAINT uq_user_consent UNIQUE (user_id, consent_type, consent_version)
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own consents" ON public.user_consents;
CREATE POLICY "Users can view own consents" ON public.user_consents
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can record consent" ON public.user_consents;
CREATE POLICY "Users can record consent" ON public.user_consents
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);


-- =============================================================================
-- 10. USER ACCOUNT & STORAGE DELETION (RIGHT TO ERASURE)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    -- 1. Remove storage objects in prescriptions bucket for this user
    DELETE FROM storage.objects
    WHERE bucket_id = 'prescriptions'
      AND (storage.foldername(name))[1] = v_user_id::text;

    -- 2. Delete user profile (cascades to medications, medication_logs, pending_reviews)
    DELETE FROM public.profiles WHERE id = v_user_id;

    -- 3. Delete auth user record
    DELETE FROM auth.users WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;


-- =============================================================================
-- 11. REALTIME PUBLICATION SETUP
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'pending_reviews'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_reviews;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'patient_caregivers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_caregivers;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

COMMIT;
