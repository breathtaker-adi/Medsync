import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { Result, ok, err } from '../types/api';
import { PendingReview } from '../types/review';
import { handleAppError, getErrorMessage } from '../utils/errorHandler';
import * as ImageManipulator from 'expo-image-manipulator';

export interface ApproveReviewParams {
  reviewId: number;
  doctorNotes?: string;
  isVerifiedDoctor?: boolean;
  approvedByRole?: 'doctor' | 'caregiver' | 'patient' | string;
  approvedByName?: string | null;
  medicationName: string;
  patientId?: string | null;
  dosage?: string | null;
  duration?: string | null;
  pillsRemaining?: number;
  totalPills?: number;
}

export interface UploadPrescriptionParams {
  userId: string;
  patientName: string;
  base64Image: string;
  targetDoctorId?: string | null;
  medicineName?: string;
  dosage?: string;
  duration?: string;
  patientNotes?: string;
}

export const prescriptionService = {
  /**
   * Fetch all pending reviews for caregiver/doctor queue
   */
  async fetchPendingReviews(): Promise<Result<PendingReview[]>> {
    try {
      const { data, error } = await supabase
        .from('pending_reviews')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        return err(new Error(getErrorMessage(error)));
      }

      return ok((data || []) as PendingReview[]);
    } catch (caught: any) {
      handleAppError(caught, { action: 'fetchPendingReviews' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Fetch pending reviews scoped to the caregiver's linked patients or targeted doctor reviews
   */
  async fetchPendingReviewsForCaregiver(caregiverId: string): Promise<Result<PendingReview[]>> {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!caregiverId || !UUID_REGEX.test(caregiverId)) {
      return err(new Error('Invalid caregiver ID format'));
    }

    try {
      const { data: linkedPatients } = await supabase
        .from('patient_caregivers')
        .select('patient_id')
        .eq('caregiver_id', caregiverId)
        .eq('status', 'active');

      const linkedPatientIds = (linkedPatients || [])
        .map((lp: any) => lp.patient_id)
        .filter((id: any) => typeof id === 'string' && UUID_REGEX.test(id));

      // Fetch reviews explicitly targeted to this physician OR belonging to active linked patients
      let query = supabase
        .from('pending_reviews')
        .select('*')
        .eq('status', 'pending');

      if (linkedPatientIds.length > 0) {
        query = query.or(
          `target_doctor_id.eq.${caregiverId},patient_id.in.(${linkedPatientIds.join(',')})`
        );
      } else {
        query = query.or(`target_doctor_id.eq.${caregiverId},target_doctor_id.is.null`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        // Fallback: let Supabase RLS determine which records the current user can access
        const { data: rlsData, error: rlsErr } = await supabase
          .from('pending_reviews')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (rlsErr) {
          return err(new Error(getErrorMessage(rlsErr)));
        }
        return ok((rlsData || []) as PendingReview[]);
      }

      return ok((data || []) as PendingReview[]);
    } catch (caught: any) {
      handleAppError(caught, { action: 'fetchPendingReviewsForCaregiver' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Fetch single review by ID
   */
  async fetchReviewById(reviewId: number | string): Promise<Result<PendingReview>> {
    try {
      const { data, error } = await supabase
        .from('pending_reviews')
        .select('*')
        .eq('id', reviewId)
        .single();

      if (error) {
        return err(new Error(getErrorMessage(error)));
      }

      return ok(data as PendingReview);
    } catch (caught: any) {
      handleAppError(caught, { action: 'fetchReviewById' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Fetch all prescription submissions by a patient (pending, approved, and rejected)
   * with target doctor details.
   */
  async fetchPrescriptionHistoryForPatient(patientId: string): Promise<Result<any[]>> {
    try {
      // 1. Try fetching with joined doctor profile
      const { data, error } = await supabase
        .from('pending_reviews')
        .select('*, doctor:profiles!target_doctor_id(id, full_name, specialty, clinic_affiliation)')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback: direct select if relation alias differs
        const { data: rawData, error: rawErr } = await supabase
          .from('pending_reviews')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false });

        if (rawErr) {
          return err(new Error(getErrorMessage(rawErr)));
        }
        return ok(rawData || []);
      }

      return ok(data || []);
    } catch (caught: any) {
      handleAppError(caught, { action: 'fetchPrescriptionHistoryForPatient' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Approve prescription and officially add to patient's active medication schedule
   */
  async approvePrescription({
    reviewId,
    doctorNotes,
    medicationName,
    patientId,
    dosage,
    duration,
    pillsRemaining,
    totalPills,
    isVerifiedDoctor = false,
    approvedByRole = 'caregiver',
    approvedByName,
  }: ApproveReviewParams): Promise<Result<void>> {
    const canApprove =
      approvedByRole === 'caregiver' || approvedByRole === 'doctor' || isVerifiedDoctor;

    if (!canApprove) {
      return err(
        new Error('Only designated caregivers or verified doctors can approve patient prescriptions.')
      );
    }

    try {
      // 1. Try secure atomic RPC function
      const remainingCount = pillsRemaining ?? 30;
      const totalCount = totalPills ?? remainingCount;

      const { data: rpcData, error: rpcError } = await supabase.rpc('approve_review', {
        p_review_id: reviewId,
        p_medicine_name: medicationName,
        p_dosage: dosage || 'As prescribed',
        p_duration: duration || '30 days',
        p_time: '08:00 AM',
        p_doctor_notes: doctorNotes || null,
        p_pills_remaining: remainingCount,
        p_total_pills: totalCount,
      });

      if (!rpcError && rpcData?.success) {
        return ok(undefined);
      }

      if (rpcError) {
        return err(new Error(getErrorMessage(rpcError)));
      }

      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'approvePrescription' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Reject prescription with doctor explanation notes
   */
  async rejectPrescription(
    reviewId: number,
    doctorNotes: string
  ): Promise<Result<void>> {
    try {
      // 1. Execute secure RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('reject_review', {
        p_review_id: reviewId,
        p_doctor_notes: doctorNotes || null,
      });

      if (!rpcError && rpcData?.success) {
        return ok(undefined);
      }

      if (rpcError) {
        return err(new Error(getErrorMessage(rpcError)));
      }

      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'rejectPrescription' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Update pending review fields (e.g. physician corrections to medication name, dosage, notes)
   */
  async updatePendingReview(
    reviewId: number | string,
    updates: Partial<PendingReview>
  ): Promise<Result<void>> {
    try {
      const { error } = await supabase
        .from('pending_reviews')
        .update(updates)
        .eq('id', reviewId);

      if (error) {
        return err(new Error(getErrorMessage(error)));
      }

      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'updatePendingReview' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Update clinical doctor notes on review
   */
  async updateDoctorNotes(
    reviewId: number,
    notes: string
  ): Promise<Result<void>> {
    try {
      const { error } = await supabase
        .from('pending_reviews')
        .update({ doctor_notes: notes })
        .eq('id', reviewId);

      if (error) {
        return err(new Error(getErrorMessage(error)));
      }

      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'updateDoctorNotes' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Process prescription image with AI Vision OCR Edge Function
   */
  async scanPrescriptionImage(
    imageBase64: string,
    mimeType = 'image/jpeg'
  ): Promise<Result<any>> {
    try {
      const { data, error } = await supabase.functions.invoke('scan-prescription', {
        body: {
          image: imageBase64,
          mimeType,
        },
      });

      if (error) {
        return err(new Error(getErrorMessage(error)));
      }

      return ok(data);
    } catch (caught: any) {
      handleAppError(caught, { action: 'scanPrescriptionImage' });
      return err(new Error(getErrorMessage(caught)));
    }
  },

  /**
   * Upload prescription image to Supabase Storage, run AI Vision OCR scan, and insert pending review record
   */
  async uploadAndSubmitPrescription({
    userId,
    patientName,
    base64Image,
    targetDoctorId,
    medicineName,
    dosage,
    duration,
    patientNotes,
  }: UploadPrescriptionParams): Promise<Result<{ reviewId?: number; extractedData: any; ocrStatus?: 'ok' | 'failed'; ocrMessage?: string | null }>> {
    try {
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
      let uploadBase64 = cleanBase64;

      try {
        const dataUri = base64Image.startsWith('data:')
          ? base64Image
          : `data:image/jpeg;base64,${cleanBase64}`;
        const compressed = await ImageManipulator.manipulateAsync(
          dataUri,
          [{ resize: { width: 1280 } }],
          { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        if (compressed.base64) {
          uploadBase64 = compressed.base64;
        }
      } catch (compErr) {
        console.warn('[prescriptionService] Client-side image compression fallback to original:', compErr);
      }

      const filePath = `${userId}/${Date.now()}_prescription.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('prescriptions')
        .upload(filePath, decode(uploadBase64), {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('[prescriptionService] Upload failed:', uploadError);
        return err(new Error(getErrorMessage(uploadError)));
      }

      // Smart extraction with fallback to user inputs
      let extractedData = {
        medicine_name: medicineName?.trim() || 'Prescription Slip Review',
        dosage: dosage?.trim() || '1 dose as prescribed on slip',
        duration: duration?.trim() || '30 days',
      };
      let ocrStatus: 'ok' | 'failed' = 'ok';
      let ocrMessage: string | null = null;

      try {
        const { data: scanData, error: scanError } = await supabase.functions.invoke('scan-prescription', {
          body: { base64Image: uploadBase64 },
        });

        if (scanError) {
          console.warn('[prescriptionService] AI OCR Scan error:', scanError);
          ocrStatus = 'failed';
          ocrMessage = getErrorMessage(scanError);
        } else if (scanData) {
          if (scanData.is_valid_prescription === false) {
            ocrStatus = 'failed';
            ocrMessage = scanData.warning || 'Uploaded image may not be an official prescription slip.';
            extractedData = {
              medicine_name: medicineName?.trim() || scanData.medicine_name || '⚠️ Unrecognized / Non-prescription',
              dosage: dosage?.trim() || scanData.dosage || 'Please inspect uploaded slip',
              duration: duration?.trim() || scanData.duration || 'N/A',
            };
          } else if (scanData.medicine_name || scanData.dosage) {
            extractedData = {
              medicine_name: medicineName?.trim() || scanData.medicine_name || extractedData.medicine_name,
              dosage: dosage?.trim() || scanData.dosage || extractedData.dosage,
              duration: duration?.trim() || scanData.duration || extractedData.duration,
            };
          }
        }
      } catch (scanErr) {
        console.warn('[prescriptionService] AI OCR Scan fallback:', scanErr);
        if (!medicineName?.trim()) {
          ocrStatus = 'failed';
        }
        ocrMessage = getErrorMessage(scanErr);
      }

      const initialDoctorNote =
        patientNotes?.trim() ||
        (ocrStatus === 'failed' || extractedData.medicine_name.includes('⚠️') || extractedData.medicine_name.includes('Unrecognized')
          ? '⚠️ AI Warning: Uploaded image may not be an official prescription slip. Please inspect photo carefully. You may edit details to approve, or tap Reject.'
          : 'Prescription scanned and queued. Verified physician review & dosing sign-off required.');

      const { data: insertData, error: dbError } = await supabase
        .from('pending_reviews')
        .insert({
          patient_id: userId,
          patient_name: patientName || 'Patient',
          medication: extractedData.medicine_name,
          dosage: extractedData.dosage,
          duration: extractedData.duration,
          image_url: filePath,
          doctor_notes: initialDoctorNote,
          status: 'pending',
          ocr_status: ocrStatus,
          target_doctor_id: targetDoctorId || null,
        })
        .select()
        .single();

      if (dbError) {
        console.error('[prescriptionService] pending_reviews insert error:', dbError);
        return err(new Error(getErrorMessage(dbError)));
      }

      return ok({
        reviewId: insertData?.id,
        extractedData,
        ocrStatus,
        ocrMessage,
      });
    } catch (caught: any) {
      handleAppError(caught, { action: 'uploadAndSubmitPrescription' });
      return err(new Error(getErrorMessage(caught)));
    }
  },
};
