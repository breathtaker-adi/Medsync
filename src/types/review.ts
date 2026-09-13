// src/types/review.ts

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface PendingReview {
  id: number;
  patient_name: string;
  medication: string;
  dosage: string | null;
  duration: string | null;
  time_ago: string;
  image_url: string;
  status: ReviewStatus;
  doctor_notes: string | null;
  patient_id: string | null;
}

// Constructor for creating a new Review object
export function createNewReview(
  patientName: string,
  medicationName: string,
  imageUrl: string
): Omit<PendingReview, 'id'> {
  return {
    patient_name: patientName,
    medication: medicationName,
    dosage: null,
    duration: null,
    time_ago: 'Just now',
    image_url: imageUrl,
    status: 'pending',
    doctor_notes: null,
    patient_id: null,
  };
}