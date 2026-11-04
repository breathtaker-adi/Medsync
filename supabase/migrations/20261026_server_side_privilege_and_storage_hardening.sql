-- =============================================================================
-- Migration: 20261026_server_side_privilege_and_storage_hardening.sql
-- Description: Server-Side Privilege & Storage Hardening
-- 1. Adds role_chosen column to public.profiles
-- 2. Hardens protect_profile_fields trigger on public.profiles to freeze role & is_verified_doctor
-- 3. Hardens profiles INSERT policy to disallow client self-granting of doctor status or arbitrary roles
-- 4. Introduces atomic choose_role(p_role text) SECURITY DEFINER RPC
-- 5. Creates public.doctor_verifications audit table with strict RLS for clinical credential vetting
-- 6. Hardens storage.objects upload policy to strictly forbid directory traversal sequences in object names
-- =============================================================================

-- 1. PROFILES: Add role_chosen column and backfill existing users
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS role_chosen BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing profiles that have an assigned role
UPDATE public.profiles
SET role_chosen = true
WHERE role IS NOT NULL AND role IN ('patient', 'caregiver', 'doctor');

-- 2. PROFILES: Hardened protect_profile_fields trigger
CREATE OR REPLACE FUNCTION public.protect_profile_fields() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
BEGIN
    -- Disallow non-superuser / client roles from modifying immutable identity, role, or credentials
    IF current_user IN ('anon', 'authenticated') THEN
        NEW.id := OLD.id;
        NEW.role := OLD.role;
        NEW.role_chosen := OLD.role_chosen;
        NEW.is_verified_doctor := OLD.is_verified_doctor;
        NEW.email := OLD.email;
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

-- 3. PROFILES: Restrict INSERT policy
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = id 
    AND (role IS NULL OR role = 'patient') 
    AND is_verified_doctor = false
);

-- 4. SERVER-SIDE ATOMIC ROLE SELECTION RPC
CREATE OR REPLACE FUNCTION public.choose_role(p_role text) 
RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN 
        RAISE EXCEPTION 'Unauthorized: not signed in'; 
    END IF;
    IF p_role NOT IN ('patient', 'caregiver', 'doctor') THEN 
        RAISE EXCEPTION 'Invalid role: must be patient, caregiver, or doctor'; 
    END IF;

    UPDATE public.profiles 
    SET role = p_role, 
        role_chosen = true, 
        is_verified_doctor = false, 
        updated_at = now()
    WHERE id = v_user_id AND role_chosen = false;

    IF NOT FOUND THEN 
        -- If user already has this role, return idempotent success
        IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND role = p_role) THEN
            RETURN jsonb_build_object('success', true, 'role', p_role, 'already_chosen', true);
        END IF;
        RAISE EXCEPTION 'Role already finalized for this account'; 
    END IF;

    RETURN jsonb_build_object('success', true, 'role', p_role, 'already_chosen', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.choose_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.choose_role(text) TO authenticated;

-- 5. DOCTOR CREDENTIAL AUDIT TABLE
CREATE TABLE IF NOT EXISTS public.doctor_verifications (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    registration_number TEXT NOT NULL CHECK (length(trim(registration_number)) BETWEEN 4 AND 40),
    council TEXT NOT NULL,
    specialty TEXT,
    clinic_affiliation TEXT,
    years_of_experience TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    doctor_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.doctor_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own doctor verification read" ON public.doctor_verifications;
CREATE POLICY "own doctor verification read" ON public.doctor_verifications
    FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own doctor verification insert" ON public.doctor_verifications;
CREATE POLICY "own doctor verification insert" ON public.doctor_verifications
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "own doctor verification update" ON public.doctor_verifications;
CREATE POLICY "own doctor verification update" ON public.doctor_verifications
    FOR UPDATE TO authenticated 
    USING (user_id = auth.uid()) 
    WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- 6. STORAGE UPLOAD HARDENING (NO TRAVERSAL IN OBJECT NAME)
DROP POLICY IF EXISTS "upload own folder only" ON storage.objects;
DROP POLICY IF EXISTS "Patients can upload own prescription images" ON storage.objects;

CREATE POLICY "upload own folder only" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'prescriptions'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND name !~ '(^|/)\.\.(/|$)'
);
