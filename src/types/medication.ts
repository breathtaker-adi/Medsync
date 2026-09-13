// src/types/medication.ts

export type MedicationStatus = 'pending' | 'taken' | 'skipped';

// This is the blueprint for a Medication Object
export interface Medication {
  id: number;
  medicine_name: string;
  dosage: string;
  time: string; 
  status: MedicationStatus;
  description: string | null;
  duration: string | null;
}

// A helper function to create a new Medication object 
// (This is like a Constructor in OOP)
export function createNewMedication(
  name: string, 
  dosage: string, 
  time: string
): Omit<Medication, 'id'> {
  return {
    medicine_name: name,
    dosage: dosage,
    time: time,
    status: 'pending',
    description: null, // Can be filled in later by a doctor
    duration: null,    // Can be filled in later
  };
}