-- =============================================================================
-- MedSync Migration: Robust User Account & Health Data Deletion
-- Date: 2026-10-21
-- Description:
-- Implements complete, atomic deletion of a user's account and all associated
-- personal health data in compliance with India DPDP Act & HIPAA Right to Erasure:
-- 1. Prescriptions storage bucket files under user folder
-- 2. Medication intake logs
-- 3. Medication schedules & regimens
-- 4. Pending reviews (patient uploads & target doctor assignments)
-- 5. Caregiver & doctor pairing links
-- 6. User push notification tokens
-- 7. DPDP consent records
-- 8. Profiles record
-- 9. Auth user record in auth.users
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
        RAISE EXCEPTION 'Unauthorized: authentication required to delete account';
    END IF;

    -- 1. Remove user prescription images in Supabase Storage
    DELETE FROM storage.objects
    WHERE bucket_id = 'prescriptions'
      AND (storage.foldername(name))[1] = v_user_id::text;

    -- 2. Delete medication intake logs
    DELETE FROM public.medication_logs WHERE patient_id = v_user_id;

    -- 3. Delete medication regimens/schedules
    DELETE FROM public.medications WHERE patient_id = v_user_id;

    -- 4. Delete pending reviews (both patient uploads and doctor target assignments)
    DELETE FROM public.pending_reviews 
    WHERE patient_id = v_user_id OR target_doctor_id = v_user_id;

    -- 5. Delete patient-caregiver and doctor links
    DELETE FROM public.patient_caregivers 
    WHERE patient_id = v_user_id OR caregiver_id = v_user_id;

    -- 6. Delete push notification tokens
    DELETE FROM public.user_push_tokens WHERE user_id = v_user_id;

    -- 7. Delete DPDP consent records
    DELETE FROM public.user_consents WHERE user_id = v_user_id;

    -- 8. Delete user profile
    DELETE FROM public.profiles WHERE id = v_user_id;

    -- 9. Delete auth.users account (allows immediate re-registration)
    DELETE FROM auth.users WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'User account and all health data permanently purged.'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
