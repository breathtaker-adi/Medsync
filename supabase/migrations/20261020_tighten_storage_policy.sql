-- Migration: Tighten prescriptions storage RLS policy
-- Removes self-declared role = 'caregiver' loophole
-- Restricts access strictly to:
-- 1. Patient owning the folder
-- 2. Targeted doctor (or practice queue if target_doctor_id is NULL) via pending_reviews
-- 3. Active linked caregiver/doctor via patient_caregivers
-- 4. Verified physician (is_verified_doctor = true)

DROP POLICY IF EXISTS "read own, targeted or linked" ON storage.objects;

CREATE POLICY "read own, targeted or linked" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'prescriptions' 
    AND (
        -- Patient owns the uploaded folder
        (storage.foldername(name))[1] = auth.uid()::text
        -- Targeted doctor has access to prescription image via pending review
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
        -- Verified physician review
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() 
              AND p.is_verified_doctor = true
        )
    )
);
