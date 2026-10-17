import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { Result, ok, err } from '../types/api';
import { PendingReview } from '../types/review';
import { handleAppError, getErrorMessage } from '../utils/errorHandler';

export interface ApproveReviewParams {
  reviewId: number;
  doctorNotes?: string;
  isVerifiedDoctor: boolean;
  medicationName: string;
  patientId?: string | null;
  dosage?: string | null;
  duration?: string | null;
}

export interface UploadPrescriptionParams {
  userId: string;
  patientName: string;
  base64Image: string;
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
   * Fetch pending reviews scoped to the caregiver's linked patients
   */
  async fetchPendingReviewsForCaregiver(caregiverId: string): Promise<Result<PendingReview[]>> {
    try {
      const { data: linkedPatients, error: linkErr } = await supabase
        .from('patient_caregivers')
        .select('patient_id')
        .eq('caregiver_id', caregiverId);

      if (linkErr) {
        return err(new Error(getErrorMessage(linkErr)));
      }

      const linkedPatientIds = (linkedPatients || []).map((lp: any) => lp.patient_id);
      if (linkedPatientIds.length === 0) {
        return ok([]);
      }

      const { data, error } = await supabase
        .from('pending_reviews')
        .select('*')
        .eq('status', 'pending')
        .in('patient_id', linkedPatientIds)
        .order('created_at', { ascending: false });

      if (error) {
        return err(new Error(getErrorMessage(error)));
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
   * Approve prescription and officially add to patient's active medication schedule
   */
  async approvePrescription({
    reviewId,
    doctorNotes,
    isVerifiedDoctor,
    medicationName,
    patientId,
    dosage,
    duration,
  }: ApproveReviewParams): Promise<Result<void>> {
    if (!isVerifiedDoctor) {
      return err(new Error('Only verified medical doctors can officially approve prescriptions.'));
    }

    try {
      // 1. Try secure atomic RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('approve_review', {
        p_review_id: reviewId,
        p_medicine_name: medicationName,
        p_dosage: dosage || 'As prescribed',
        p_duration: duration || '30 days',
        p_time: '08:00 AM',
        p_doctor_notes: doctorNotes || null,
      });

      if (!rpcError && rpcData?.success) {
        return ok(undefined);
      }

      // 2. Direct fallback update if RPC is missing
      await supabase
        .from('pending_reviews')
        .update({
          status: 'approved',
          doctor_notes: doctorNotes || null,
        })
        .eq('id', reviewId);

      if (patientId) {
        await supabase.from('medications').insert({
          patient_id: patientId,
          medicine_name: medicationName,
          dosage: dosage || 'As prescribed',
          time: '08:00 AM',
          duration: duration || '30 days',
          status: 'pending',
          pills_remaining: 30,
          total_pills: 30,
        });
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
      // 1. Try secure RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('reject_review', {
        p_review_id: reviewId,
        p_doctor_notes: doctorNotes || null,
      });

      if (!rpcError && rpcData?.success) {
        return ok(undefined);
      }

      // 2. Direct fallback update
      const { error } = await supabase
        .from('pending_reviews')
        .update({ status: 'rejected', doctor_notes: doctorNotes || null })
        .eq('id', reviewId);

      if (error) {
        return err(new Error(getErrorMessage(error)));
      }

      return ok(undefined);
    } catch (caught: any) {
      handleAppError(caught, { action: 'rejectPrescription' });
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
  }: UploadPrescriptionParams): Promise<Result<{ reviewId?: number; extractedData: any }>> {
    try {
      const filePath = `${userId}/${Date.now()}_prescription.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('prescriptions')
        .upload(filePath, decode(base64Image), {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        return err(new Error(getErrorMessage(uploadError)));
      }

      // Try AI scan
      let extractedData = {
        medicine_name: 'Pending Doctor Verification',
        dosage: 'See uploaded slip',
        duration: 'As prescribed',
      };

      try {
        const { data: scanData } = await supabase.functions.invoke('scan-prescription', {
          body: { base64Image },
        });

        if (scanData) {
          extractedData = {
            medicine_name: scanData.medicine_name || extractedData.medicine_name,
            dosage: scanData.dosage || extractedData.dosage,
            duration: scanData.duration || extractedData.duration,
          };
        }
      } catch (scanErr) {
        console.warn('[prescriptionService] AI OCR Scan fallback:', scanErr);
      }

      const { data: insertData, error: dbError } = await supabase
        .from('pending_reviews')
        .insert({
          patient_id: userId,
          patient_name: patientName || 'Patient',
          medication: extractedData.medicine_name,
          dosage: extractedData.dosage,
          duration: extractedData.duration,
          image_url: filePath,
          status: 'pending',
        })
        .select()
        .single();

      if (dbError) {
        return err(new Error(getErrorMessage(dbError)));
      }

      return ok({
        reviewId: insertData?.id,
        extractedData,
      });
    } catch (caught: any) {
      handleAppError(caught, { action: 'uploadAndSubmitPrescription' });
      return err(new Error(getErrorMessage(caught)));
    }
  },
};
