-- =============================================================================
-- MedSync Migration: Camera Dose Verification (Privacy-Preserving)
-- Date: 2026-10-16
-- Description:
-- Adds camera_verified boolean flag to medication_logs and updates take_dose()
-- to record client-side visual proof without storing sensitive facial photos.
-- =============================================================================

ALTER TABLE public.medication_logs
ADD COLUMN IF NOT EXISTS camera_verified boolean DEFAULT false;

DROP FUNCTION IF EXISTS public.take_dose(bigint, text);
DROP FUNCTION IF EXISTS public.take_dose(bigint, text, boolean);

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
        camera_verified = EXCLUDED.camera_verified;

    -- 2. Atomic pill counter decrement
    UPDATE medications
    SET pills_remaining = GREATEST(0, COALESCE(pills_remaining, 30) - 1)
    WHERE id = p_medication_id AND patient_id = v_patient_id
    RETURNING pills_remaining INTO v_new_pills;

    RETURN jsonb_build_object(
        'success', true,
        'pills_remaining', v_new_pills,
        'medicine_name', v_med_name,
        'camera_verified', p_camera_verified
    );
END;
$$;
