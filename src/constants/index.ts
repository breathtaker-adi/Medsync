// src/constants/index.ts

export const STORAGE_KEYS = {
  ACCESS_MODE: 'accessMode',
  AUDIO_MODE: 'audioMode',
  USER_PROFILE: 'user_profile',
  AUTH_SESSION: 'auth_session',
  PUSH_TOKEN: 'push_token',
} as const;

export const APP_ROUTES = {
  AUTH: {
    LOGIN: '/login',
    ROLE_SELECTION: '/role-selection',
    PROFILE_SETUP: '/profile-setup',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
  },
  PATIENT: {
    DASHBOARD: '/(tabs)/patient-dashboard',
    UPLOADS: '/(tabs)/uploads',
    MEDICATION_DETAILS: '/medication-details',
    MEDICATION_HISTORY: '/medication-history',
    PRESCRIPTION_HISTORY: '/prescription-history',
    PAUSED_MEDICATIONS: '/paused-medications',
    DOCTOR_LINK: '/doctor-link',
  },
  CLINICAL: {
    DASHBOARD: '/(tabs)/caregiver-dashboard',
    PATIENT_DIRECTORY: '/patient-directory',
    PATIENT_DETAILS: '/patient-details',
    PENDING_REVIEWS: '/pending-reviews',
    REVIEW_DETAILS: '/review-details',
    DOCTOR_SETTINGS: '/doctor-settings',
    DOCTOR_VERIFICATION: '/doctor-verification',
  },
  SETTINGS: {
    INDEX: '/settings',
    EDIT_PROFILE: '/edit-profile',
    PRIVACY_POLICY: '/privacy-policy',
    CLINICAL_PRIVACY_POLICY: '/clinical-privacy-policy',
  },
} as const;

export const TIME_QUADRANTS = {
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  EVENING: 'evening',
  NIGHT: 'night',
} as const;

export const COMPLIANCE = {
  REGULATION: 'Digital Personal Data Protection (DPDP) Act 2023',
  JURISDICTION: 'Republic of India',
  CONSENT_VERSION: '2026-v2',
  MINIMUM_REQUIRED_APP_VERSION: '1.2.0',
  CURRENT_APP_VERSION: '1.2.0',
  PAIRING_CODE_VALIDITY_MINUTES: 15,
  MAX_DAILY_PRESCRIPTION_SCANS: 10,
  MAX_PRESCRIPTION_FILE_SIZE_BYTES: 3 * 1024 * 1024, // 3MB limit
} as const;
