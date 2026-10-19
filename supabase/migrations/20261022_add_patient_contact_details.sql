-- =============================================================================
-- MedSync Migration: Patient Contact & Emergency Details for Clinical Care
-- Date: 2026-10-22
-- Description:
-- Adds phone, email, and emergency contact columns to public.profiles so verified
-- doctors and linked caregivers can view patient contact details in patient cards
-- and emergency scenarios.
-- =============================================================================

-- 1. Add contact columns to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- 2. Backfill email and contact metadata from auth.users into profiles
UPDATE public.profiles p
SET 
    email = COALESCE(p.email, u.email),
    phone = COALESCE(p.phone, u.raw_user_meta_data->>'phone'),
    emergency_contact_name = COALESCE(p.emergency_contact_name, u.raw_user_meta_data->>'emergency_contact_name'),
    emergency_contact_phone = COALESCE(p.emergency_contact_phone, u.raw_user_meta_data->>'emergency_contact_phone')
FROM auth.users u
WHERE p.id = u.id;

-- 3. Update handle_new_user trigger to populate email and contact info on signup
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
        email,
        phone,
        emergency_contact_name,
        emergency_contact_phone,
        is_verified_doctor,
        alerts_enabled,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        CASE 
            WHEN NEW.raw_user_meta_data->>'role' = 'doctor' THEN 'doctor'
            WHEN NEW.raw_user_meta_data->>'role' = 'caregiver' THEN 'caregiver' 
            ELSE 'patient' 
        END,
        NEW.email,
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'emergency_contact_name',
        NEW.raw_user_meta_data->>'emergency_contact_phone',
        false,
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
        email = COALESCE(public.profiles.email, EXCLUDED.email),
        phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
        role = COALESCE(public.profiles.role, EXCLUDED.role),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- 4. Ensure RLS policies allow linked caregivers and doctors to view patient profiles
DROP POLICY IF EXISTS "Caregivers can view linked patient profiles" ON public.profiles;

CREATE POLICY "Caregivers can view linked patient profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
    auth.uid() = id
    OR EXISTS (
        SELECT 1 FROM public.patient_caregivers pc
        WHERE pc.caregiver_id = auth.uid() 
          AND pc.patient_id = profiles.id
    )
);
