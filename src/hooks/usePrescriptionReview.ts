// src/hooks/usePrescriptionReview.ts
import { useCallback, useEffect, useState } from 'react';
import { prescriptionService } from '../services/prescriptionService';
import { PendingReview } from '../types/review';
import { showErrorAlert } from '../utils/errorHandler';

export function usePrescriptionReview(reviewId?: string | number) {
  const [review, setReview] = useState<PendingReview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [doctorNote, setDoctorNote] = useState<string>('');

  const loadReview = useCallback(async () => {
    if (!reviewId) {
      setLoading(false);
      return;
    }

    const res = await prescriptionService.fetchReviewById(reviewId);
    if (res.success && res.data) {
      setReview(res.data);
      setDoctorNote(res.data.doctor_notes || '');
    }
    setLoading(false);
  }, [reviewId]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  const approve = async (isVerifiedDoctor: boolean): Promise<boolean> => {
    if (!review) return false;
    setActionLoading(true);

    const res = await prescriptionService.approvePrescription({
      reviewId: review.id,
      doctorNotes: doctorNote,
      isVerifiedDoctor,
      medicationName: review.medication,
      patientId: review.patient_id,
      dosage: review.dosage,
      duration: review.duration,
    });

    setActionLoading(false);

    if (res.success) {
      setReview((prev) => (prev ? { ...prev, status: 'approved', doctor_notes: doctorNote } : null));
      return true;
    } else {
      showErrorAlert(res.error, 'Approval Failed');
      return false;
    }
  };

  const reject = async (): Promise<boolean> => {
    if (!review) return false;
    setActionLoading(true);

    const res = await prescriptionService.rejectPrescription(review.id, doctorNote);
    setActionLoading(false);

    if (res.success) {
      setReview((prev) => (prev ? { ...prev, status: 'rejected', doctor_notes: doctorNote } : null));
      return true;
    } else {
      showErrorAlert(res.error, 'Rejection Failed');
      return false;
    }
  };

  const saveNotes = async (): Promise<boolean> => {
    if (!review) return false;
    const res = await prescriptionService.updateDoctorNotes(review.id, doctorNote);
    if (!res.success) {
      showErrorAlert(res.error, 'Failed to save notes');
      return false;
    }
    return true;
  };

  return {
    review,
    loading,
    actionLoading,
    doctorNote,
    setDoctorNote,
    approve,
    reject,
    saveNotes,
    refetch: loadReview,
  };
}
