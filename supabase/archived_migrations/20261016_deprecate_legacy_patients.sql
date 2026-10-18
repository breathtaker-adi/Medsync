-- =============================================================================
-- MedSync Migration: Deprecate Legacy Patients Table
-- Date: 2026-10-16
-- Description:
-- Cleanly removes the obsolete 'patients' table, as all caregiver-patient
-- relationships now securely run through 'patient_caregivers' and 'profiles'.
-- =============================================================================

DROP TABLE IF EXISTS public.patients CASCADE;
