// src/types/auth.ts

export type UserRole = 'patient' | 'caregiver' | 'doctor';

export interface UserProfile {
  id: string;
  role: UserRole | null;
  full_name: string | null;
  alerts_enabled?: boolean | null;
  push_token?: string | null;
  is_verified_doctor?: boolean | null;
  blood_group?: string | null;
  allergies?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SignUpData extends AuthCredentials {
  fullName: string;
  role: UserRole;
  bloodGroup?: string;
  allergies?: string;
}
