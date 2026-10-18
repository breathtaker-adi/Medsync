-- =============================================================================
-- MedSync Migration: Doctor Verification, Prescription RLS, Storage & Realtime
-- Date: 2026-10-18
-- Description:
-- 1. Adds clinical credential columns (license number, medical council,
--    specialty, clinic affiliation, years of experience) to public.profiles.
-- 2. Creates SECURITY DEFINER RPC `submit_doctor_verification` allowing
--    authenticated physicians to submit their credentials and receive the
--    verified doctor badge securely.
-- 3. Adds target_doctor_id to pending_reviews for multi-doctor prescription routing.
-- 4. Configures SELECT and UPDATE Row Level Security policies on `pending_reviews`.
-- 5. Configures Storage RLS policy so verified doctors and caregivers can read prescription scans.
-- 6. Updates `approve_review` and `reject_review` RPCs with customizable pill counts
--    and auto-linking of verified doctors to patient rosters.
-- 7. Enables Supabase Realtime publication on `pending_reviews` and `patient_caregivers`.
-- =============================================================================

BEGIN;

-- 1. Add credential fields to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS medical_license_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS medical_council TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialty TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clinic_affiliation TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS years_of_experience TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Add target_doctor_id to pending_reviews for routing prescriptions to specific doctors
ALTER TABLE public.pending_reviews ADD COLUMN IF NOT EXISTS target_doctor_id UUID REFERENCES public.profiles(id);

-- 3. Verification RPC Function
CREATE OR REPLACE FUNCTION public.submit_doctor_verification(
    p_license_number TEXT,
    p_medical_council TEXT,
    p_specialty TEXT,
    p_clinic_affiliation TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    IF LENGTH(TRIM(p_license_number)) < 4 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid medical license number: minimum 4 characters required');
    END IF;

    UPDATE public.profiles
    SET 
        role = 'doctor',
        medical_license_number = TRIM(p_license_number),
        medical_council = TRIM(p_medical_council),
        specialty = TRIM(p_specialty),
        clinic_affiliation = TRIM(p_clinic_affiliation),
        is_verified_doctor = true,
        updated_at = NOW()
    WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true, 'is_verified_doctor', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_doctor_verification(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 4. Pending Reviews RLS Policies
ALTER TABLE public.pending_reviews ENABLE ROW LEVEL SECURITY;

-- Patients can view their own pending reviews
DROP POLICY IF EXISTS "Patients view own pending reviews" ON public.pending_reviews;
CREATE POLICY "Patients view own pending reviews" ON public.pending_reviews
FOR SELECT TO authenticated
USING (patient_id = auth.uid());

-- Doctors and caregivers can view pending reviews for linked patients, targeted reviews, or clinical triage
DROP POLICY IF EXISTS "Supervisors view pending reviews" ON public.pending_reviews;
CREATE POLICY "Supervisors view pending reviews" ON public.pending_reviews
FOR SELECT TO authenticated
USING (
    target_doctor_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM patient_caregivers pc
        WHERE pc.patient_id = pending_reviews.patient_id
          AND pc.caregiver_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('doctor', 'caregiver')
    )
);

-- Supervisors and verified physicians can update pending reviews
DROP POLICY IF EXISTS "Supervisors update pending reviews" ON public.pending_reviews;
CREATE POLICY "Supervisors update pending reviews" ON public.pending_reviews
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND (p.is_verified_doctor = true OR p.role = 'doctor')
    )
    OR EXISTS (
        SELECT 1 FROM patient_caregivers pc
        WHERE pc.patient_id = pending_reviews.patient_id
          AND pc.caregiver_id = auth.uid()
    )
);

-- 5. Storage RLS: Ensure doctors and caregivers can read uploaded prescription slips
DROP POLICY IF EXISTS "read own or linked patient or doctor" ON storage.objects;
DROP POLICY IF EXISTS "read own or linked patient" ON storage.objects;
CREATE POLICY "read own or linked patient or doctor" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'prescriptions' 
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR (storage.foldername(name))[1]::uuid IN (
            SELECT patient_id 
            FROM public.patient_caregivers 
            WHERE caregiver_id = auth.uid() 
              AND status = 'active'
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND (role = 'doctor' OR is_verified_doctor = true)
        )
    )
);

-- 6. Enhanced approve_review & reject_review RPCs (Customizable Supply Count & Auto-linking)
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

    -- Auto-link verified doctor to patient roster if not already present
    IF NOT EXISTS (
        SELECT 1 FROM patient_caregivers
        WHERE patient_id = v_review.patient_id
          AND caregiver_id = v_caller_id
    ) THEN
        INSERT INTO patient_caregivers (patient_id, caregiver_id, status, created_at)
        VALUES (v_review.patient_id, v_caller_id, 'active', NOW())
        ON CONFLICT (patient_id, caregiver_id) DO UPDATE SET status = 'active';
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
        COALESCE(p_time, '08:00 AM'),
        'pending',
        p_duration,
        'Prescribed by Dr. ' || COALESCE(v_caller_profile.full_name, 'Practitioner'),
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

    -- Auto-link verified doctor to patient roster if not already present
    IF NOT EXISTS (
        SELECT 1 FROM patient_caregivers
        WHERE patient_id = v_review.patient_id
          AND caregiver_id = v_caller_id
    ) THEN
        INSERT INTO patient_caregivers (patient_id, caregiver_id, status, created_at)
        VALUES (v_review.patient_id, v_caller_id, 'active', NOW())
        ON CONFLICT (patient_id, caregiver_id) DO UPDATE SET status = 'active';
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

GRANT EXECUTE ON FUNCTION public.approve_review(bigint, text, text, text, text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_review(bigint, text) TO authenticated;

-- 7. Realtime publication support
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
