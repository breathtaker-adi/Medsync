-- =============================================================================
-- MedSync Security & Integrity Hardening Migration
-- Generated based on Architectural Audit & Security Review
-- =============================================================================

-- 1. SECURE STORAGE BUCKET: MAKE 'prescriptions' PRIVATE WITH PER-USER FOLDERS
-- Ensure bucket exists and is private (RLS is already enabled on storage.objects by default)
INSERT INTO storage.buckets (id, name, public)
VALUES ('prescriptions', 'prescriptions', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop old loose storage policies on prescriptions
DROP POLICY IF EXISTS "Authenticated users can upload prescriptions" ON storage.objects;
DROP POLICY IF EXISTS "Public can view prescriptions" ON storage.objects;
DROP POLICY IF EXISTS "upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "read own or linked patient" ON storage.objects;

-- Policy: Patients can only upload into their own folder: {user_id}/{filename}
CREATE POLICY "upload own folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'prescriptions' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Patient can read their own prescriptions, or a linked active caregiver/doctor can read them
CREATE POLICY "read own or linked patient" ON storage.objects
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
    )
);


-- =============================================================================
-- 2. PAIRING HARDENING: PREVENT CODE ENUMERATION & SECURE CLAIM VIA FUNCTION
-- =============================================================================

-- Drop policies that allowed any caregiver to list all open pairing codes
DROP POLICY IF EXISTS "Caregiver view linked or claimable codes" ON public.patient_caregivers;
DROP POLICY IF EXISTS "Caregiver claim pairing code" ON public.patient_caregivers;
DROP POLICY IF EXISTS "caregiver sees own active links" ON public.patient_caregivers;

-- Caregivers can only see patient links that are assigned to them and active
CREATE POLICY "caregiver sees own active links" ON public.patient_caregivers
FOR SELECT TO authenticated
USING (
    caregiver_id = auth.uid() 
    AND status = 'active'
);

-- Secure Definitive Pairing Function
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
    -- Verify caller persona
    SELECT role INTO v_caller_role FROM profiles WHERE id = v_caller_id;
    IF v_caller_role NOT IN ('caregiver', 'doctor') THEN
        RAISE EXCEPTION 'Only caregivers or doctors can claim pairing codes';
    END IF;

    -- Atomically claim unassigned pairing code created within the last 24 hours
    UPDATE patient_caregivers
    SET caregiver_id = v_caller_id,
        status = 'active'
    WHERE pairing_code = upper(trim(p_code))
      AND caregiver_id IS NULL
      AND created_at > (now() - interval '24 hours')
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


-- =============================================================================
-- 3. PROFILES PROTECTION: BLOCK ROLE ESCALATION & UNVERIFIED DOCTOR CREATION
-- =============================================================================

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

CREATE POLICY "Users insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = id
    AND is_verified_doctor = false
    AND role IN ('patient', 'caregiver')
);

-- Trigger to prevent self-escalation of is_verified_doctor or role on update
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Prevent non-service-role from modifying role or is_verified_doctor
    IF current_user <> 'service_role' THEN
        NEW.is_verified_doctor := OLD.is_verified_doctor;
        NEW.role := OLD.role;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_fields();


-- =============================================================================
-- 4. PUSH-TOKEN VIEWS: ENFORCE SECURITY INVOKER & REVOKE ANONYMOUS ACCESS
-- =============================================================================

-- Drop old views first so column names and types can be cleanly updated
DROP VIEW IF EXISTS public.doctor_push_tokens CASCADE;
DROP VIEW IF EXISTS public.patient_push_tokens CASCADE;

-- Create views with security_invoker = true
CREATE VIEW public.doctor_push_tokens WITH (security_invoker = true) AS
SELECT 
    pc.patient_id,
    p.push_token,
    pc.caregiver_id
FROM public.patient_caregivers pc
JOIN public.profiles p ON pc.caregiver_id = p.id
WHERE p.push_token IS NOT NULL;

CREATE VIEW public.patient_push_tokens WITH (security_invoker = true) AS
SELECT 
    pc.caregiver_id,
    p.id AS patient_id,
    p.push_token
FROM public.patient_caregivers pc
JOIN public.profiles p ON pc.patient_id = p.id
WHERE p.push_token IS NOT NULL;

REVOKE ALL ON public.doctor_push_tokens FROM anon;
REVOKE ALL ON public.patient_push_tokens FROM anon;


-- =============================================================================
-- 5. ATOMIC CLINICAL APPROVAL FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.approve_review(
    p_review_id bigint,
    p_medicine_name text,
    p_dosage text,
    p_duration text,
    p_time text DEFAULT '08:00',
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
    -- 1. Check physician verification status
    SELECT * INTO v_caller_profile FROM profiles WHERE id = v_caller_id;
    IF v_caller_profile IS NULL OR v_caller_profile.is_verified_doctor = false THEN
        RAISE EXCEPTION 'Unauthorized: only verified physicians can approve prescriptions';
    END IF;

    -- 2. Fetch review
    SELECT * INTO v_review FROM pending_reviews WHERE id = p_review_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Prescription review not found';
    END IF;

    -- 3. Verify clinical association
    IF NOT EXISTS (
        SELECT 1 FROM patient_caregivers
        WHERE patient_id = v_review.patient_id
          AND caregiver_id = v_caller_id
          AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: you are not an active supervisor for this patient';
    END IF;

    -- 4. Update review record
    UPDATE pending_reviews
    SET status = 'approved',
        medication = p_medicine_name,
        dosage = p_dosage,
        duration = p_duration,
        doctor_notes = p_doctor_notes
    WHERE id = p_review_id;

    -- 5. Insert active medication schedule
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


-- =============================================================================
-- 6. ATOMIC INTAKE & PILL DECREMENT FUNCTION (PREVENTS RACE CONDITIONS)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.take_dose(
    p_medication_id bigint,
    p_scheduled_time text DEFAULT '00:00'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_patient_id uuid := auth.uid();
    v_today date := current_date;
    v_new_pills int;
    v_med_name text;
BEGIN
    -- Verify medication ownership
    SELECT medicine_name INTO v_med_name
    FROM medications
    WHERE id = p_medication_id AND patient_id = v_patient_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Medication not found or unauthorized';
    END IF;

    -- 1. Atomic log upsert
    INSERT INTO medication_logs (
        medication_id,
        patient_id,
        log_date,
        scheduled_time,
        status
    ) VALUES (
        p_medication_id,
        v_patient_id,
        v_today,
        p_scheduled_time,
        'taken'
    )
    ON CONFLICT (medication_id, log_date)
    DO UPDATE SET status = 'taken';

    -- 2. Atomic pill counter decrement
    UPDATE medications
    SET pills_remaining = GREATEST(0, COALESCE(pills_remaining, 30) - 1)
    WHERE id = p_medication_id AND patient_id = v_patient_id
    RETURNING pills_remaining INTO v_new_pills;

    RETURN jsonb_build_object(
        'success', true,
        'pills_remaining', v_new_pills,
        'medicine_name', v_med_name
    );
END;
$$;
