-- =============================================================================
-- MedSync Migration: Fix Profile RLS Policies & Add Auto-Profile Trigger
-- Date: 2026-10-17
-- Description:
-- 1. Adds auto-profile trigger on auth.users so profiles are created reliably
--    without client-side race conditions or unauthenticated RLS rejections.
-- 2. Permits authenticated users (patients, caregivers, and doctors) to insert
--    and upsert their own profile records (auth.uid() = id).
-- 3. Protects sensitive fields (is_verified_doctor) from self-escalation.
-- =============================================================================

BEGIN;

-- 1. Ensure required profile columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified_doctor BOOLEAN DEFAULT false;

-- 2. Auto-Profile Creation Trigger on auth.users
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
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'role',
        false,
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


-- 2. Clean Up and Re-create Profile RLS Policies
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own non-sensitive profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Caregivers can view linked patient profiles" ON public.profiles;

-- Allow authenticated users to view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Allow caregivers/doctors to view linked patient profiles
CREATE POLICY "Caregivers can view linked patient profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.patient_caregivers pc
        WHERE (pc.caregiver_id = auth.uid() AND pc.patient_id = profiles.id AND pc.status = 'active')
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

-- 3. Prevent non-service-role from self-verifying doctor status
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_user <> 'service_role' THEN
        -- Only service_role or admin trigger can grant is_verified_doctor
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

COMMIT;
