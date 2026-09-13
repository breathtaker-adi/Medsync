# MedSync — Intelligent Medication Adherence & Caregiver Oversight



MedSync is a mobile healthcare platform built with React Native and Expo SDK 57 (React Native 0.86, React 19) designed to bridge the communication gap between patients managing complex medication regimens and their caregivers or physicians. By integrating multi-modal AI vision processing (OpenAI GPT-4o), real-time PostgreSQL synchronization via Supabase, native background alarms, and multi-sensory accessibility tools, MedSync converts physical prescriptions into verified daily adherence routines.

---

## Key Features

### Patient Adherence & Care Command Center

* **Dynamic Daily Schedule:** Displays daily medications sorted chronologically using a 12/24-hour time parser with automated background alarm scheduling.


* **One-Tap Quick Actions:** Enables immediate intake confirmation via "I Took It", 20-minute snoozing, and dose skipping directly from the app or background notification banners.


* **Overdue Alert Logic:** Automatically flags medications as overdue if intake is delayed by more than 30 minutes past the scheduled time.


* **30-Day Adherence Calendar & Streaks:** Tracks daily adherence history, logs intake states (`taken`, `skipped`, `missed`), and calculates consecutive daily adherence streaks.



### AI-Powered Prescription Scanning & Clinical Review

* **Prescription Ingestion:** Captures physical prescription slips via device camera or gallery, encoding images to binary buffers for secure upload to Supabase Storage.


* **OpenAI GPT-4o Vision OCR:** Processes captured prescription images through OpenAI's multi-modal API to automatically extract drug names, dosage instructions, and prescribed durations into structured JSON.


* **Caregiver & Physician Verification Dashboard:** Provides clinical supervisors with an interactive review queue to inspect uploaded slips, correct extracted details, append clinical notes, and approve or reject schedules.


* **Automated Schedule Injection:** Approving a reviewed prescription automatically converts it into an active medication schedule on the patient's device and dispatches a push notification.



### Multi-Sensory Accessibility Engine

* **High-Contrast & Large-Print Modes:** Supports a global high-contrast theme with scaled typography designed for seniors and low-vision users.


* **Read Aloud Text-to-Speech:** Integrated via `expo-speech` to vocalize drug names, dosages, and daily scheduled times on demand.


* **Tactile Haptic Feedback:** Driven by `expo-haptics` to deliver sensory vibration triggers across all key UI interactions.



### Supervisor Management & Clinical Exports

* **Patient-Caregiver Pairing:** Connects patients to caregivers using unique 6-character alphanumeric claim codes.


* **Caregiver Patient Roster:** Displays assigned patients alongside 30-day compliance percentages and status badges.


* **PDF Health Report Generation:** Compiles 30-day medication logs into styled HTML/PDF clinical reports using `expo-print` and opens native share sheets (`expo-sharing`) for doctor consultations.


* **Push Notification Routing:** Delivers cross-device alerts via Expo Push Service and Firebase Cloud Messaging (FCM v1) when prescriptions are uploaded, approved, or overdue.



---

## End-to-End System Architecture

The following diagram illustrates the closed-loop feedback lifecycle between patients, OpenAI vision processing, Supabase backend databases, and caregiver oversight:

```
[Patient Device] ──(Captures Camera/Gallery)──> [Uploads Screen]
                                                       │
                                                       ▼
                                             [OpenAI GPT-4o Vision]
                                                       │ (Extracts Drug, Dose, Duration)
                                                       ▼
[Doctor / Caregiver] <──(Push Notification)── [Supabase: pending_reviews]
         │
         ├── Inspects Original Image & AI Output
         ├── Edits & Corrects via Review Modal
         └── Taps "Approve"
                   │
                   ▼
         [Supabase: medications]
                   │
                   ▼ (Syncs & Schedules)
[Patient Device] <──(Push Notification: "Prescription Approved")
         │
         ├── Schedules Native Alarms via expo-notifications
         │
         └── [Alarm Triggers at Scheduled Time]
                   │
                   ├── Option A: "I Took It" ──> Logs to medication_logs & Decrements Pill Count
                   ├── Option B: "Snooze 20m" ──> Reschedules Local Notification
                   └── Option C: Ignored / Overdue ──> Escalates Alert to Caregiver Dashboard
```

---

## Tech Stack & Dependencies

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Mobile Framework** | Expo SDK 57 / React Native 0.86 / React 19 | Cross-platform runtime and native component architecture. |
| **Navigation** | Expo Router v57 | File-system routing with native tabs, stacks, and dynamic route protection. |
| **Backend & Database** | Supabase (PostgreSQL 15) | User authentication, persistent relational storage, Row Level Security, and S3 bucket storage. |
| **AI Vision** | OpenAI GPT-4o API | Automated multi-modal optical character recognition (OCR) and prescription detail extraction. |
| **Notifications** | `expo-notifications` & FCM v1 | Local background alarms, background action listeners, and push notification routing. |
| **Accessibility** | `expo-speech` & `expo-haptics` | Text-to-speech audio synthesis and tactile haptic vibration responses. |
| **Document Export** | `expo-print` & `expo-sharing` | Headless HTML rendering to PDF and platform native file sharing. |
| **Local Cache** | `@react-native-async-storage/async-storage` | Unencrypted local state backing for session tokens and accessibility preferences. |

---

```
```
## Getting Started

### Prerequisites
* **Node.js:** v18.0.0 or higher
* **Package Manager:** npm (v9+) or yarn
* **Expo Go / Development Build:** Downloaded on iOS or Android testing device
* **Supabase Project:** Instance running PostgreSQL with Storage enabled
* **OpenAI API Key:** Access to `gpt-4o` multi-modal completions


## Repository Structure

```
medsync-app/
├── assets/                          # App icons, splash screens, and PublicSans fonts
├── src/
│   ├── app/                         # Expo Router screen routes & layouts
│   │   ├── (tabs)/                  # Main bottom tab navigator group
│   │   │   ├── _layout.tsx          # Tab navigation configuration & styling
│   │   │   ├── caregiver-dashboard.tsx # Clinical oversight queue & patient roster
│   │   │   ├── index.tsx            # Role-aware redirect routing
│   │   │   ├── patient-dashboard.tsx # Daily dosage schedule, alarms & intake actions
│   │   │   └── uploads.tsx          # Prescription capture, S3 upload & AI vision OCR
│   │   ├── _layout.tsx              # Root app layout, font loading & auth routing gate
│   │   ├── login.tsx                # Email authentication (Sign In / Sign Up)
│   │   ├── medication-details.tsx   # Detailed medicine view, skip dose & ordering
│   │   ├── medication-history.tsx   # Adherence logs breakdown & 30-day streak tracker
│   │   ├── patient-details.tsx      # Patient history, medical profile & allergies
│   │   ├── profile-setup.tsx        # Onboarding screen for profile setup & role assignment
│   │   ├── review-details.tsx       # Doctor verification modal for pending prescriptions
│   │   └── settings.tsx             # Accessibility preferences, pairing codes & PDF export
│   ├── context/
│   │   ├── AccessibilityContext.tsx # High-contrast mode, speech synthesis & haptics state
│   │   └── authcontext.tsx          # Supabase auth session & push token management
│   ├── lib/
│   │   └── supabase.ts              # Supabase client initialization & AsyncStorage adapter
│   ├── theme/
│   │   └── index.ts                 # Material 3 design tokens, palette & typography
│   └── types/
│       ├── medication.ts            # Type declarations for medications & daily logs
│       └── review.ts                # Type declarations for pending prescription reviews
├── app.json                         # Expo application configuration manifest
├── eas.json                         # EAS build profiles for APK/AAB compilation
├── google-services.json             # Firebase Android push notification configuration
└── package.json                     # NPM dependencies and build scripts
```

---

## Build & Native Configuration

### Firebase Push Notifications (Android)
Android native notifications utilize Firebase Cloud Messaging (FCM v1):
1. Ensure `google-services.json` is located in the root directory.
2. Confirm `app.json` includes the pointer under `android.googleServicesFile`: `"./google-services.json"`.

### EAS Cloud Builds
The project includes pre-configured profiles in `eas.json` for compilation via Expo Application Services:
* **Preview Build (Internal APK):**
  ```bash
  eas build --platform android --profile preview
  ```
* **Production Build (Google Play AAB):**
  ```bash
  eas build --platform android --profile production
  ```

---

## Known Issues & Ongoing Improvements

1. **TypeScript Check in `src/app/_layout.tsx`:** Line 52 contains a type guard where `profile.role` (`'patient' | 'caregiver' | null`) is passed to an array `.includes()` check without explicit null validation.
2. **`patient_id` Association in Review Approval:** In `src/app/review-details.tsx`, approving a prescription inserts a medication record, which requires explicit `patient_id` parameter passing to appear on the patient's schedule immediately.
3. **Environment Variable Fallbacks:** `src/lib/supabase.ts` uses fallback configuration strings; production deployments should strictly enforce reading from `process.env.EXPO_PUBLIC_SUPABASE_URL`.
