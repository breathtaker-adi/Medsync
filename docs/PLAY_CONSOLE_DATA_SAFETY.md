# Google Play Console Data Safety & Regulatory Compliance Blueprint

This document specifies the exact answers required for the Google Play Store Data Safety Questionnaire for **MedSync** under Google Play Policies and the Digital Personal Data Protection (DPDP) Act 2023.

---

## 1. Data Collection & Sharing Overview

* **Does your app collect or share any of the required user data types?**  
  **YES**
* **Is all of the user data collected by your app encrypted in transit?**  
  **YES** (All client-server communication runs over HTTPS / TLS 1.3 to Supabase).
* **Do you provide a way for users to request that their data be deleted?**  
  **YES** (Settings > Account > "Delete Account & Data" purges patient logs, medications, links, and profiles).

---

## 2. Specific Data Categories

### A. Health & Fitness
* **Data Type:** Health info (Prescriptions, medications, dosages, adherence schedules)
* **Collected?** YES
* **Shared?** NO (Not shared with third-party advertisers or data brokers. Only accessible by explicitly paired caregivers/doctors).
* **Is collection ephemeral?** NO (Stored to maintain adherence history).
* **Is this data required or optional?** Required for core app functionality (medication reminders).
* **Purposes:**
  - App functionality (managing schedules, adherence tracking)
  - Account management

### B. Photos and Videos
* **Data Type:** Photos (Prescription scans, optional camera dose confirmation)
* **Collected?** YES (Prescription photos uploaded to private storage bucket).
* **Shared?** NO
* **Purposes:**
  - App functionality (AI Vision text extraction for medication details)
* **Note on Camera Proof:** Dose confirmation photos are processed on-device and are **not** persisted or uploaded to servers; only a `camera_verified: true` flag is stored.

### C. Personal Info
* **Name & Email Address:**
  - **Collected?** YES
  - **Purposes:** Account authentication, user identification on caregiver dashboards.
  - **Shared?** NO

### D. Device or Other IDs
* **Push Notification Token:**
  - **Collected?** YES (Expo push token)
  - **Purposes:** App functionality (delivering local & push medication alarms)
  - **Shared?** NO

---

## 3. Privacy Policy Link & Data Deletion Mechanism

* **Privacy Policy URL:** `https://your-domain.com/privacy-policy` (or in-app route `/privacy-policy`)
* **Deletion URL / In-App Deletion:**
  - In-app: `SettingsScreen` > `Delete Account & Data`
  - Deletes all records in `medication_logs`, `medications`, `patient_caregivers`, and `profiles`, followed by session revocation.

---

## 4. Production EAS Build Command

To trigger an official production release build for the Google Play Store:
```bash
# Production Android App Bundle (.aab)
npx eas build --platform android --profile production

# Test APK for physical testing
npx eas build --platform android --profile preview
```
