# MedSync — Complete Architectural & Technical Documentation

> **Document Type:** Senior Architectural Audit & Technical Reference Manual  
> **Target Audience:** Junior Developers, Maintainers, Clinical/Technical Stakeholders  
> **Application Version:** 1.0.0 (Expo SDK 57 / React Native 0.86 / React 19)  
> **Backend Ecosystem:** Supabase (PostgreSQL 15, Row Level Security, Auth, S3-Compatible Storage)  
> **AI Vision Pipeline:** OpenAI GPT-4o Multi-Modal Vision API  
> **Push Notifications:** Expo Push Service integrated with Firebase Cloud Messaging (FCM v1)

---

## 1. Project Overview & Core Value

### 1.1 What is MedSync?
**MedSync** is an enterprise-grade, mobile-first healthcare companion designed for cross-generational medication adherence and remote clinical supervision. Built on React Native and Expo, it operates seamlessly on Android and iOS devices, orchestrating daily medication schedules, real-time safety alerts, and physician/caregiver verification.

### 1.2 Target Audience
1. **Patients:** Older adults, individuals with chronic ailments (e.g., hypertension, diabetes), or patients managing complex multi-drug regimens who require clear, high-contrast, audible, and persistent reminders.
2. **Caregivers & Family Members:** Sons, daughters, or professional caretakers who need continuous peace of mind without intruding on the patient's daily autonomy.
3. **Doctors & Clinicians:** Healthcare providers who need to review patient-uploaded physical prescriptions, correct AI transcription errors, adjust dosages, and monitor 30-day compliance logs.

### 1.3 Core Problems Solved
- **Prescription Illegibility & Human Error:** Handwritten or dense clinical prescriptions often lead to missed doses, incorrect dosages, or confusion.
- **The "Did I Take It?" Dilemma:** Memory lapses result in accidental double-dosing or missed critical medications.
- **Disconnected Caregiving:** Caregivers typically discover non-adherence only after a medical emergency occurs.
- **Fragmented Medical Records:** Clinical consultations often suffer from inaccurate self-reported adherence.

### 1.4 The Primary User Loop
The foundational lifecycle of MedSync is an automated, closed-loop feedback mechanism:

```
[1. Patient] ──(Captures Camera/Gallery)──> [Uploads Screen]
                                                   │
                                                   ▼
                                         [OpenAI GPT-4o Vision]
                                                   │ (Extracts Drug, Dose, Duration)
                                                   ▼
[2. Doctor/Caregiver] <──(Push Notification)── [Supabase: pending_reviews]
         │
         ├──(Inspects Original Image + AI Output)
         ├──(Edits/Corrects via Review Modal)
         └──(Taps "Approve")
                   │
                   ▼
         [Supabase: medications]
                   │
                   ▼ (Syncs & Schedules)
[3. Patient Device] <──(Push Notification: "Prescription Approved")
         │
         ├── Sets Native Channel Alarms via expo-notifications
         │
         └── [Alarm Triggers at Scheduled Time]
                   │
                   ├── Option A: "I Took It" ──> Logs to medication_logs & Decrements Pill Count
                   ├── Option B: "Snooze 20m" ──> Reschedules Local Notification
                   └── Option C: Ignored / Overdue 
                             │
                             ▼
[4. Caregiver Dashboard] <──(Missed Dose Alert Query)
         │
         └── Caregiver receives notification to intervene & call patient
```

---

## 2. Tech Stack & External Libraries

Every dependency declared in `package.json` serves a dedicated functional requirement within the architecture:

| Library | Exact Purpose in MedSync | Where Used in Codebase |
| :--- | :--- | :--- |
| **`expo`** (`~57.0.18`) | Core runtime framework providing native abstractions and runtime lifecycle management. | Root runtime, entry configuration in `app.json`. |
| **`expo-router`** (`~57.0.17`) | File-system based routing and deep-linking system providing native navigation stacks and tabs. | `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, all screen files. |
| **`@supabase/supabase-js`** (`^2.112.4`) | Isomorphic PostgreSQL client handling authentication, table queries, RPCs, and S3 storage uploads. | `src/lib/supabase.ts`, `src/context/authcontext.tsx`, all dashboard screens. |
| **`expo-notifications`** (`~57.0.15`) | Native notification scheduling, Android notification channels, background category actions, and push tokens. | `src/app/_layout.tsx`, `src/context/authcontext.tsx`, `src/app/(tabs)/patient-dashboard.tsx`. |
| **`expo-image-picker`** (`~57.0.14`) | Native camera and photo library interface enabling high-resolution image capture with base64 encoding. | `src/app/(tabs)/uploads.tsx`. |
| **`expo-speech`** (`~57.0.2`) | Text-to-speech (TTS) synthesis engine that vocalizes medication instructions for low-vision patients. | `src/app/(tabs)/patient-dashboard.tsx`, `src/context/AccessibilityContext.tsx`. |
| **`expo-print`** (`~57.0.1`) | Headless webview renderer that compiles custom HTML/CSS markup into native PDF documents. | `src/app/settings.tsx`. |
| **`expo-sharing`** (`~57.0.18`) | Native platform share sheet provider allowing patients to export generated PDF reports via WhatsApp, Mail, or Drive. | `src/app/settings.tsx`. |
| **`expo-haptics`** (`~57.0.2`) | Device vibration motor controller delivering sensory tactile feedback upon critical actions and touches. | `src/context/AccessibilityContext.tsx`, `src/app/(tabs)/patient-dashboard.tsx`, `src/app/settings.tsx`. |
| **`expo-font`** (`~57.0.2`) | Asynchronous font loader guaranteeing custom brand typography (`PublicSans`) is mounted before UI rendering. | `src/app/_layout.tsx`. |
| **`expo-splash-screen`** (`~57.0.8`) | Native splash screen controller keeping the launch screen visible while fonts and auth states resolve. | `src/app/_layout.tsx`. |
| **`expo-device`** (`~57.0.1`) | Hardware environment detector ensuring push notification registration runs exclusively on physical hardware. | `src/context/authcontext.tsx`. |
| **`@react-native-async-storage/async-storage`** (`2.2.0`) | Unencrypted on-device persistent key-value store acting as the session and settings backing cache. | `src/lib/supabase.ts`, `src/context/AccessibilityContext.tsx`. |
| **`base64-arraybuffer`** (`^1.0.2`) | High-performance binary encoder converting base64 strings into binary ArrayBuffers for Supabase S3 storage. | `src/app/(tabs)/uploads.tsx`. |
| **`react-native-url-polyfill`** (`^4.0.0`) | WHATWG URL standard polyfill ensuring Supabase WebSocket real-time and auth URL parsing works in React Native. | `src/lib/supabase.ts`. |
| **`@expo/vector-icons`** (`^15.0.2`) | Bundled icon repository providing Ionicons and Entypo vectors throughout UI components. | Used across all screens in `src/app/`. |
| **`react-native-safe-area-context`** (`~5.7.0`) | Screen inset calculator preventing UI from colliding with device notches, status bars, and home indicators. | `src/app/medication-history.tsx`, root screens. |
| **`react-native-screens`** (`~4.26.0`) | Native memory-efficient UI view controller primitive powering fast navigation transitions in Expo Router. | Integrated into navigation primitives. |
| **`expo-status-bar`** (`~57.0.1`) | Status bar coordinator styling clock, battery, and cellular indicators against app themes. | `src/app/_layout.tsx`. |

---

## 3. Backend & Database Architecture (Supabase)

### 3.1 Relational Database Schema
MedSync's PostgreSQL schema is normalized around patient profiles, clinical reviews, active schedules, intake event logs, and pairing relationships.

```
       ┌────────────────────────┐
       │      auth.users        │
       └───────────┬────────────┘
                   │ 1:1
                   ▼
       ┌────────────────────────┐
       │        profiles        │
       │────────────────────────│
       │ id (UUID, PK)          │◀──────┐
       │ role (text)            │       │
       │ full_name (text)       │       │
       │ alerts_enabled (bool)  │       │
       │ push_token (text)      │       │
       │ is_verified_doctor(bl) │       │
       └──────┬───────────┬─────┘       │
              │ 1:N       │ 1:N         │
              ▼           ▼             │
   ┌──────────────┐   ┌───────────────┐ │
   │ medications  │   │pending_reviews│ │
   │──────────────│   │───────────────│ │
   │ id (bigint)  │   │ id (bigint)   │ │
   │ medicine_name│   │ patient_name  │ │
   │ dosage       │   │ medication    │ │
   │ time         │   │ dosage        │ │
   │ patient_id   │   │ duration      │ │
   │ status       │   │ image_url     │ │
   │pills_remain'g│   │ doctor_notes  │ │
   └──────┬───────┘   │ status        │ │
          │ 1:N       │ patient_id    │ │
          ▼           └───────────────┘ │
┌──────────────────┐                    │
│ medication_logs  │                    │
│──────────────────│                    │
│ id (bigint, PK)  │                    │
│ medication_id(FK)│                    │
│ patient_id (UUID)│                    │
│ log_date (date)  │                    │
│ scheduled_time   │                    │
│ status           │                    │
│ notes            │                    │
└──────────────────┘                    │
                                        │
           ┌────────────────────────────┴─────┐
           │        patient_caregivers        │
           │──────────────────────────────────│
           │ id (bigint, PK)                  │
           │ patient_id (UUID, FK -> profiles)│
           │ caregiver_id(UUID,FK -> profiles)│
           │ pairing_code (text, UNIQUE)      │
           │ override_alerts (boolean)        │
           │ status (text)                    │
           └──────────────────────────────────┘
```

#### Detailed Table Definitions
1. **`profiles`**
   - `id` (`UUID`, Primary Key, references `auth.users.id` on delete cascade): Matches the Supabase Auth identifier.
   - `role` (`text`): Denotes user persona (`'patient'`, `'caregiver'`, `'doctor'`).
   - `full_name` (`text`): Formal name shown on clinical exports and dashboard titles.
   - `alerts_enabled` (`boolean`, default `true`): Master kill-switch for caregiver push alerts.
   - `push_token` (`text`): Device Expo Push Token (`ExponentPushToken[...]`).
   - `is_verified_doctor` (`boolean`, default `false`): Unlocks clinical approval permissions.
   - `blood_group` (`text`), `allergies` (`text`): Clinical baseline data displayed in `patient-details.tsx`.

2. **`medications`**
   - `id` (`bigint`, Primary Key): Auto-incrementing identifier.
   - `patient_id` (`UUID`, references `profiles.id`): Foreign key binding the prescription schedule to a specific patient.
   - `medicine_name` (`text`): Commercial or generic drug name (e.g., "Atorvastatin").
   - `dosage` (`text`): Administration instructions (e.g., "10mg - 1 Tablet").
   - `time` (`text`): Daily scheduled trigger time formatted as 24-hour `HH:MM` (e.g., `"08:00"`).
   - `status` (`text`): Active status flag (`'pending'`, `'taken'`, `'skipped'`).
   - `pills_remaining` (`integer`): Inventory decrement counter tracking physical container volume.
   - `food_warning` (`text`): Dietary instructions (e.g., "Take with food").

3. **`medication_logs`**
   - `id` (`bigint`, Primary Key).
   - `medication_id` (`bigint`, references `medications.id`): Links to parent medication.
   - `patient_id` (`UUID`, references `profiles.id`): Indexing key for fast patient history queries.
   - `log_date` (`date`, ISO string `YYYY-MM-DD`): Date of scheduled dose.
   - `scheduled_time` (`text`): Time the dose was meant to be taken.
   - `status` (`text`): Resolution state (`'taken'`, `'skipped'`, `'missed'`, `'pending'`).
   - `snooze_count` (`integer`, default `0`): Number of times the 20-minute snooze was engaged.
   - `notes` (`text`): Patient-entered symptoms or notes.
   - *Constraint:* Unique composite index on `(medication_id, log_date)` prevents duplicate records per calendar day.

4. **`pending_reviews`**
   - `id` (`bigint`, Primary Key).
   - `patient_id` (`UUID`): ID of the patient who uploaded the slip.
   - `patient_name` (`text`): Cached denormalized name for fast roster listing.
   - `medication`, `dosage`, `duration`: Data fields extracted by OpenAI GPT-4o.
   - `image_url` (`text`): Public CDN URL of the uploaded slip stored in Supabase Storage (`prescriptions` bucket).
   - `doctor_notes` (`text`): Physician annotations or warnings entered during review.
   - `status` (`text`): Review state (`'pending'`, `'approved'`, `'rejected'`).

5. **`patient_caregivers`**
   - `id` (`bigint`, Primary Key).
   - `patient_id` (`UUID`, references `profiles.id`): The patient owning the medication routine.
   - `caregiver_id` (`UUID`, references `profiles.id`, nullable until claimed): The linked caregiver or doctor.
   - `pairing_code` (`text`, unique): 6-character alphanumeric claim code (e.g., `"K9X2B4"`).
   - `override_alerts` (`boolean`, default `false`): Per-patient alert preference overriding the caregiver's global mute.
   - `status` (`text`): Connection state (`'active'`, `'pending'`).

---

### 3.2 Object-Oriented Data Model & Many-to-Many Relationships
MedSync models the clinical relationship between patients and supervisors as a **Many-to-Many (N:M)** link managed by the join table `patient_caregivers`:
- A single patient can have multiple caregivers (e.g., an adult child and a visiting nurse).
- A single doctor or caregiver can manage a directory of dozens of distinct patients.
- The `patient_id` foreign key cascades queries across `medications`, `medication_logs`, and `pending_reviews`.

---

### 3.3 Row Level Security (RLS) & Secure Database Views

#### Row Level Security Architecture
To guarantee HIPAA-aligned privacy, Supabase RLS policies isolate database operations based on `auth.uid()`:

1. **Patient Data Isolation:**
   ```sql
   -- Patients can only read and insert their own medication logs
   CREATE POLICY "Patient read own logs" ON medication_logs
     FOR SELECT USING (auth.uid() = patient_id);

   CREATE POLICY "Patient modify own logs" ON medication_logs
     FOR ALL USING (auth.uid() = patient_id);
   ```

2. **Caregiver Supervised Access:**
   Caregivers and doctors query patient data through join verification against `patient_caregivers`:
   ```sql
   -- Doctors/Caregivers can view profiles of patients linked to them
   CREATE POLICY "Caregiver view linked patients" ON profiles
     FOR SELECT USING (
       id IN (
         SELECT patient_id FROM patient_caregivers 
         WHERE caregiver_id = auth.uid()
       )
     );
   ```

3. **Pairing Code Claiming Policy:**
   Doctors claim unassigned pairing codes by checking that `caregiver_id` is currently `NULL`:
   ```sql
   CREATE POLICY "Allow caregivers to claim open pairing codes" ON patient_caregivers
     FOR UPDATE USING (
       caregiver_id IS NULL OR caregiver_id = auth.uid()
     )
     WITH CHECK (
       caregiver_id = auth.uid()
     );
   ```

#### Database Views for Secure Cross-Device Push Token Resolution
To avoid exposing raw push tokens across unrelated accounts, MedSync utilizes two Postgres SQL Views:

1. **`doctor_push_tokens` View:**
   Resolves the push tokens of all caregivers/doctors linked to a specific patient so the patient's device can dispatch an alert when a prescription is uploaded:
   ```sql
   CREATE OR REPLACE VIEW doctor_push_tokens AS
   SELECT 
     pc.patient_id,
     p.push_token,
     pc.caregiver_id
   FROM patient_caregivers pc
   JOIN profiles p ON pc.caregiver_id = p.id
   WHERE p.push_token IS NOT NULL;
   ```

2. **`patient_push_tokens` View:**
   Allows an authorized doctor who is approving a prescription in `review-details.tsx` to retrieve the target patient's push token:
   ```sql
   CREATE OR REPLACE VIEW patient_push_tokens AS
   SELECT 
     pc.caregiver_id,
     p.id AS patient_id,
     p.push_token
   FROM patient_caregivers pc
   JOIN profiles p ON pc.patient_id = p.id
   WHERE p.push_token IS NOT NULL;
   ```

---

### 3.4 Cross-Device Push Notification Pipeline

```
[Device Hardware]
       │
       ▼ (expo-notifications & expo-device)
 1. Requests system permissions
 2. Fetches Expo Push Token: ExponentPushToken[xxxxxxxxxxxx]
 3. Persists token into `profiles.push_token` via `registerForPushNotifications()` in `authcontext.tsx`
       │
       ▼
[Trigger Event Occurs]
 ├── Scenario A: Patient uploads prescription in uploads.tsx
 └── Scenario B: Doctor approves prescription in review-details.tsx
       │
       ▼
 4. Query Database View (`doctor_push_tokens` or `patient_push_tokens`)
 5. Obtain target device's `push_token`
 6. HTTP POST to Expo Push Server:
    URL: https://exp.host/--/api/v2/push/send
    Payload: {
      to: "ExponentPushToken[...]",
      title: "✅ Prescription Approved",
      body: "Your doctor approved Atorvastatin...",
      sound: "default",
      priority: "high"
    }
       │
       ▼
 7. Expo routes payload through Google Firebase Cloud Messaging (FCM v1)
       │
       ▼
 8. Target device displays high-priority native notification banner
```

---

## 4. Authentication & Routing Flow

### 4.1 Global Session Management (`AuthContext.tsx`)
Authentication state is initialized and broadcast across the app tree via React Context:
- **`supabase.auth.getSession()`**: Resolves any existing JWT stored in `AsyncStorage` via the custom `ExpoSecureStoreAdapter`.
- **`supabase.auth.onAuthStateChange()`**: Re-evaluates state on sign-in, token refresh, or sign-out.
- **Profile Initialization & Error Handling**: Calls `fetchProfile(user)`. If Supabase returns error code `PGRST116` (row not found), `profile` remains `null`, signaling that the user must complete onboarding.
- **Push Registration**: Whenever a profile successfully resolves, `registerForPushNotifications(userId)` triggers, saving the current device push token to the `profiles` table.

---

### 4.2 The Role-Based Routing Gate (`src/app/_layout.tsx` & `src/app/(tabs)/index.tsx`)

#### The Root Gatekeeper (`src/app/_layout.tsx`)
`RootLayoutNav` controls the high-level transitions between unauthenticated, onboarding, and authenticated states using `useEffect` watching `[isReady, session, profile, segments]`:

```typescript
// Route Protection Matrix
if (!session && !inAuthGroup) {
  router.replace('/login');
} else if (session) {
  if (!profile && !inSetup) {
    // Authenticated user lacks a database profile
    router.replace('/profile-setup');
  } else if (profile && (inAuthGroup || inSetup)) {
    // Direct based on role using router.replace (prevents back-button stacking)
    if (profile.role && ['caregiver', 'doctor'].includes(profile.role)) {
      router.replace('/(tabs)/caregiver-dashboard');
    } else if (profile.role === 'patient') {
      router.replace('/(tabs)/patient-dashboard');
    }
  }
}
```

#### The Tab Index Guard (`src/app/(tabs)/index.tsx`)
When Expo Router resolves the root `(tabs)` group, it defaults to mounting `(tabs)/index.tsx`. Previously, this file hardcoded a redirect to `/patient-dashboard`, causing Caregiver sessions to stack on top of the patient dashboard in navigation history. 

`src/app/(tabs)/index.tsx` now evaluates user roles dynamically before redirecting:
```tsx
export default function Index() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (profile?.role === 'caregiver' || profile?.role === 'doctor') {
    return <Redirect href="/(tabs)/caregiver-dashboard" />;
  }

  return <Redirect href="/(tabs)/patient-dashboard" />;
}
```

---

### 4.3 Profile Setup Flow (`src/app/profile-setup.tsx`)
For newly registered accounts:
1. User enters their `fullName`.
2. User selects their primary persona via interactive role cards:
   - **Patient Card:** Sets role to `'patient'`.
   - **Caregiver Card:** Sets role to `'caregiver'`.
3. Tapping **"Continue"** inserts `{ id: session.user.id, full_name: fullName, role: role }` into the `profiles` table.
4. On success, `router.replace` sends the user directly to their respective dashboard, preventing them from returning to the setup screen via the back button.

---

## 5. Core Features & Logic Breakdown

### 5.1 AI Prescription Scanner & Clinical Verification

#### Image Acquisition & S3 Storage
- **File:** `src/app/(tabs)/uploads.tsx`
- **Function:** `pickImage(fromCamera: boolean)` & `handleUploadAndScan()`
- **Mechanism:** Launches `ImagePicker` with `base64: true` and `quality: 0.8`. When the user taps **"Upload & Scan"**, `decode(base64Image)` from `base64-arraybuffer` converts the image into a raw binary stream. This is uploaded directly to the Supabase Storage bucket `prescriptions` using a unique timestamped file path (`prescription_${Date.now()}.jpg`). `supabase.storage.from('prescriptions').getPublicUrl()` yields the public CDN URL.

#### OpenAI Vision Extraction
- **Function:** `scanPrescriptionWithAI(base64: string)`
- **Mechanism:** Sends an HTTP POST request to `https://api.openai.com/v1/chat/completions` using the `gpt-4o` multi-modal model. The prompt instructs the model:
  ```json
  "You are an expert pharmacist AI. Read the prescription image. Extract the Medicine Name, Dosage Instructions, and Duration. Respond ONLY in JSON format like: {\"medicine_name\": \"...\", \"dosage\": \"...\", \"duration\": \"...\"}"
  ```
  The payload enforces strict schema compliance using `response_format: { type: 'json_object' }`. The parsed response is then inserted into `pending_reviews` alongside the `patient_id` and image CDN URL.

#### Doctor Correction & Approval Flow
- **File:** `src/app/review-details.tsx`
- **Function:** `handleSaveEdits()` & `handleApprove()`
- **Mechanism:** The doctor inspects the original image using `expo-image` alongside the AI-extracted text.
  - **Edit Modal:** Doctors can adjust drug names, change dosage instructions, alter duration, and append `doctor_notes`.
  - **Approval:** Approving inserts a new record into `medications` with `patient_id: review.patient_id`, marks the review status as `'approved'`, and queries the `patient_push_tokens` view to dispatch a push notification alerting the patient that their schedule has been updated.

---

### 5.2 Native Background Alarms & Notification Actions

#### Scheduling Engine
- **File:** `src/app/(tabs)/patient-dashboard.tsx`
- **Function:** `scheduleAllAlarms(meds: Medication[])`
- **Mechanism:**
  1. Calls `Notifications.cancelAllScheduledNotificationsAsync()` to wipe outdated alarms.
  2. On Android, creates a high-importance channel named `'medication-alarms-auto'` with custom vibration patterns.
  3. Iterates over active medications, computing the exact upcoming execution timestamp via `getNextDateForTime(med.time)`.
  4. Calls `Notifications.scheduleNotificationAsync()` using `type: Notifications.SchedulableTriggerInputTypes.DATE`, passing `categoryIdentifier: 'medication-alerts'` and metadata `{ medicationId: med.id }`.

#### Action Buttons in Notification Banners
- **File:** `src/app/_layout.tsx` (Lines 40–137)
- **Mechanism:** When the app launches, `Notifications.setNotificationCategoryAsync` registers two background action buttons:
  - **Identifier `'MARK_TAKEN'` ("I Took It"):** Uses `opensAppToForeground: false` to allow execution while the app remains in the background. The listener retrieves `currentSession`, performs an upsert into `medication_logs` with `status: 'taken'`, decrements `pills_remaining` in the `medications` table, and dismisses the notification banner via `dismissNotificationAsync`.
  - **Identifier `'SNOOZE'` ("Snooze 20m"):** Computes `Date.now() + 20 minutes` and reschedules a new high-priority notification via `Notifications.scheduleNotificationAsync`.

---

### 5.3 Daily Medication Tracking, Overdue Logic & Streaks

#### Master Schedule vs. Event Logs
- **`medications`:** Represents the ongoing prescription contract (e.g., "Metformin 500mg daily at 08:00").
- **`medication_logs`:** Represents discrete daily compliance events. Every calendar day, a log record is created per medication (`medication_id`, `log_date`, `status`).

#### Overdue Evaluation
- **File:** `src/app/(tabs)/patient-dashboard.tsx`
- **Function:** `checkIfOverdue(medTime: string)`
- **Mechanism:** Parses the medication's scheduled `HH:MM` into total minutes from midnight and compares it against the current local clock time:
  ```typescript
  const checkIfOverdue = (medTime: string) => {
    const [h, m] = medTime.split(':').map(Number);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const medMinutes = h * 60 + m;
    return currentMinutes > medMinutes + 30; // Flags overdue if >30 min late
  };
  ```
  If the status is still `'pending'` 30 minutes after the scheduled time, the UI applies an alert badge and triggers caregiver alerts.

#### Daily Adherence Streak Calculation
- **File:** `src/app/medication-history.tsx`
- **Calculation:** Employs an iterative lookback algorithm starting from `today` and scanning backwards through the preceding 30 days:
  ```typescript
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
    const dayLogs = logsByDate[dStr];
    
    if (!dayLogs || dayLogs.length === 0) {
      if (i === 0) continue; // Don't break streak if today's doses are still in progress
      break;
    }
    
    const allTaken = dayLogs.every((l) => l.status === 'taken');
    if (allTaken) {
      streak += 1;
    } else {
      break; // Breaks streak on first day with a missed dose
    }
  }
  ```

---

### 5.4 Patient-Caregiver Pairing Architecture

#### Code Generation (Patient Side)
- **File:** `src/app/settings.tsx`
- **Function:** `generatePairingCode()`
- **Mechanism:** Generates a secure, human-readable 6-character alphanumeric string:
  ```typescript
  const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  ```
  Inserts the record into `patient_caregivers` with `patient_id: session.user.id`, `pairing_code: newCode`, and `status: 'active'`.

#### Code Claiming (Caregiver Side)
- **File:** `src/app/(tabs)/caregiver-dashboard.tsx`
- **Function:** `handleLinkPatient()`
- **Mechanism:**
  1. The caregiver inputs the 6-character code into a modal text input.
  2. Queries `patient_caregivers` matching `pairing_code`.
  3. Verifies that `caregiver_id` is empty (preventing hijack of already-linked patients).
  4. Executes an update:
     ```typescript
     const { data, error } = await supabase
       .from('patient_caregivers')
       .update({ caregiver_id: session.user.id })
       .eq('pairing_code', formattedCode)
       .select();
     ```
  5. Refreshes the Caregiver Dashboard and automatically populates the patient within `patient-directory.tsx`.

---

### 5.5 Caregiver Alert System (Global Mute vs. Per-Patient Override)
- **Files:** `src/app/settings.tsx`, `src/app/(tabs)/caregiver-dashboard.tsx`
- **Mechanism:**
  - **Global Mute:** In `settings.tsx`, the caregiver toggles `alerts_enabled` on their personal profile. When set to `false`, all automated alerts are muted by default.
  - **Per-Patient Override:** In `caregiver-dashboard.tsx`, caregivers can toggle an `override_alerts` switch for specific high-risk patients.
  - **Evaluation Logic:** In `checkMissedDoses()`:
    ```typescript
    let query = supabase
      .from('patient_caregivers')
      .select('patient_id, override_alerts')
      .eq('caregiver_id', session.user.id);

    // If caregiver disabled global alerts, only query patients with active overrides
    if (!globalAlertsOn) {
      query = query.eq('override_alerts', true);
    }
    ```

---

### 5.6 PDF Clinical Health Report Export
- **File:** `src/app/settings.tsx`
- **Function:** `exportHealthReport()`
- **Mechanism:**
  1. Computes the start date for the 30-day window (`Date.now() - 30 days`).
  2. Fetches all records from `medication_logs` and `medications` for the patient.
  3. Constructs a self-contained HTML document with clean styling, typography, and status-colored indicators (`.taken`, `.missed`, `.skipped`).
  4. Calls `Print.printToFileAsync({ html })` from `expo-print`, compiling the markup into a local PDF stored in the app cache.
  5. Uses `Sharing.isAvailableAsync()` and `Sharing.shareAsync(uri, { mimeType: 'application/pdf' })` to open the native iOS/Android sharing dialog, allowing direct export to email or healthcare provider portals.

---

## 6. File & Folder Structure Manifest

```
medsync-app/
├── assets/                          # Static branding, splash screens, and icons
│   ├── fonts/                       # PublicSans font family (.ttf files)
│   ├── icon.png                     # App launch icon
│   └── splash.png                   # Initial loading screen artwork
├── src/
│   ├── app/                         # Expo Router application screens & routing definitions
│   │   ├── (tabs)/                  # Bottom navigation tab group
│   │   │   ├── _layout.tsx          # Defines tab navigation bar styling & tab visibility
│   │   │   ├── caregiver-dashboard.tsx # Supervisor command center showing alerts & review items
│   │   │   ├── index.tsx            # Role-aware redirect routing to the appropriate dashboard
│   │   │   ├── patient-dashboard.tsx # Daily medication schedule, audio cues & alarms
│   │   │   └── uploads.tsx          # Camera capture, Supabase S3 upload & OpenAI vision scanning
│   │   ├── _layout.tsx              # Root app wrapper, font initialization & global auth gatekeeper
│   │   ├── explore.tsx              # Template screen retained for diagnostic routing
│   │   ├── index.tsx                # App entry point redirecting to /login
│   │   ├── login.tsx                # Authentication screen handling email sign-in & registration
│   │   ├── medication-details.tsx   # Detailed medication view with dose skipping & re-order links
│   │   ├── medication-history.tsx   # 30-day adherence calendar, logs breakdown & streak counters
│   │   ├── patient-details.tsx      # Deep-dive clinical view of patient history & allergies
│   │   ├── patient-directory.tsx    # Searchable patient directory for caregivers
│   │   ├── profile-setup.tsx        # New-user onboarding screen for profile & role selection
│   │   ├── review-details.tsx       # Clinical verification screen for prescription approval & editing
│   │   ├── role-selection.tsx       # Standalone view for testing persona switching
│   │   └── settings.tsx             # User preferences, accessibility toggles, pairing codes & PDF export
│   ├── components/                  # Reusable UI component modules
│   ├── constants/                   # Static global constants and mock fallbacks
│   ├── context/                     # Global state providers
│   │   ├── AccessibilityContext.tsx # Manages high-contrast mode, speech synthesis & haptic settings
│   │   └── authcontext.tsx          # Manages Supabase sessions, profile data & push token registration
│   ├── hooks/                       # Custom React utility hooks
│   ├── lib/                         # External client configurations
│   │   └── supabase.ts              # Supabase client initialization with AsyncStorage adapter
│   ├── theme/                       # Design system tokens
│   │   └── index.ts                 # Centralized color palette, typography definitions & spacing tokens
│   └── types/                       # TypeScript interfaces & data structures
│       ├── medication.ts            # Defines Medication and MedicationLog item schemas
│       └── review.ts                # Defines PendingReview data interfaces
├── app.json                         # Expo application manifest, permissions & build configuration
├── eas.json                         # Expo Application Services (EAS) cloud build configurations
├── google-services.json             # Firebase configuration file for Android FCM push services
├── package.json                     # NPM project manifest declaring all dependencies & scripts
└── tsconfig.json                    # TypeScript compiler configuration & path aliases
```

---

## 7. Environment Variables & Native Setup

### 7.1 Required Environment Variables (`.env`)
To run MedSync, the following environment variables must be declared in `.env` at the project root:

```ini
# OpenAI API Key (Multi-Modal GPT-4o Vision access required)
EXPO_PUBLIC_OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase API Configuration (Direct client initialization)
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

*Note: In `src/lib/supabase.ts`, the application currently references fallback constants for `supabaseUrl` and `supabaseAnonKey`. Moving these to environment variables via `process.env.EXPO_PUBLIC_SUPABASE_URL` is recommended for production security.*

---

### 7.2 Native Setup & Push Notification Configuration

#### 1. Firebase Cloud Messaging Setup (`google-services.json`)
Native Android devices require Firebase Cloud Messaging (FCM v1) credentials to display push notifications when the application is backgrounded or closed:
1. The `google-services.json` file is located at the project root (`c:\Users\adity\medsync-app\google-services.json`).
2. Configured for package name: `com.medsync.app`.
3. In `app.json`, linked under the Android configuration:
   ```json
   "android": {
     "googleServicesFile": "./google-services.json",
     "package": "com.medsync.app"
   }
   ```

#### 2. EAS Build Configuration (`eas.json`)
The application is pre-configured for automated cloud compilation via Expo Application Services (EAS):
- **Preview Profile (`preview`):** Generates a standalone native `.apk` for direct distribution and testing on physical Android hardware without requiring the Google Play Store.
- **Production Profile (`production`):** Compiles an optimized Android App Bundle (`.aab`) ready for submission to the Google Play Console.

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}