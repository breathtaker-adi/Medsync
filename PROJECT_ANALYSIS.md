# MedSync — Complete Project Progress & Architecture Analysis

> **Generated on:** September 7, 2026  
> **Project:** MedSync Mobile Application  
> **Framework:** Expo SDK 57 (React Native 0.86, React 19, Expo Router v57)  
> **Backend & Database:** Supabase (Auth, Postgres DB, Storage)  
> **AI / Vision:** OpenAI GPT-4o (Prescription OCR & Extraction)  

---

## 1. Executive Summary & Project Overview

**MedSync** is an intelligent medication adherence and caregiver oversight mobile application. The app bridges the communication gap between elderly or chronic-care patients and their caregivers/physicians through:
1. **Patient Care & Adherence:** Timely scheduled medication alarms, single-tap intake confirmation ("I Took It"), 20-minute snoozing, and comprehensive accessibility features (Read Aloud speech synthesis, haptic feedback, and high-contrast large-print layouts).
2. **Prescription Ingestion & AI OCR:** Scanning physical prescription slips using the camera or gallery, running AI vision recognition (GPT-4o) to extract medication names, dosage instructions, and durations, and storing prescription images in Supabase Storage.
3. **Caregiver Review & Verification:** A clinical review dashboard where caregivers/doctors can inspect uploaded prescriptions, make corrections via an interactive modal, and approve or reject them. Approved prescriptions are converted into active schedules on the patient's daily routine.
4. **Role-Based Workflows:** Seamless segregation between Patient and Caregiver modes with profile initialization, automated routing gates, and personalized settings.

---

## 2. Project Progress & Feature Completion Matrix

| Module / Feature | Status | Completion % | Implementation Details |
| :--- | :---: | :---: | :--- |
| **Authentication & Session** | **Completed** | 100% | Email/Password sign-in and sign-up with Supabase Auth, persistent session storage with AsyncStorage, and global reactive auth state via `AuthContext`. |
| **Profile Setup & Onboarding** | **Completed** | 100% | First-time profile creation (`profiles` table) capturing full name and role (`patient` or `caregiver`), routing guards preventing uninitialized access. |
| **Role-Based Navigation Gate** | **Completed** | 95% | Automatic routing based on session & role in `_layout.tsx`. *(Minor: 1 TypeScript type mismatch to fix)*. |
| **Patient Dashboard** | **Completed** | 95% | Live Supabase query for patient medications sorted chronologically, local push notifications scheduling, "I Took It" status updates, Snooze, Read Aloud, and pull-to-refresh. |
| **Accessibility Engine** | **Completed** | 100% | `AccessibilityContext` supporting high-contrast mode, scaled text sizes, `expo-speech` text-to-speech audio, and `expo-haptics` vibration feedback on all major interactions. |
| **Caregiver Dashboard** | **Completed** | 85% | Live query of `pending_reviews` (amber badge) and doctor-assigned `patients` roster with adherence percentage color tags. *(Needs patient pairing interface)*. |
| **Prescription Review Flow** | **Completed** | 90% | Image viewer, AI summary display, doctor notes, 3-dot editable modal for dosage corrections, and one-tap approval/rejection inserting into `medications`. *(Needs patient_id linkage)*. |
| **Prescription Upload & AI Scan** | **In Progress** | 70% | Camera/gallery picker, image preview, base64 encoding, Supabase storage upload, and OpenAI prompt. *(Needs valid API key management and dynamic patient ID)*. |
| **Medication Details View** | **Completed** | 100% | Deep dive into individual medication details, external Google search ordering link, and dose skipping. |
| **Settings & Preferences** | **Completed** | 100% | View profile details, toggle accessibility mode and read-aloud audio, link to native device notification settings, and sign out. |
| **Patient-Caregiver Linking** | **Planned** | 20% | Schema has placeholder fields (`doctor_id`, `patient_id`), but no UI yet for pairing codes or inviting caregivers. |

---

## 3. Purpose of Every File Created / Modified by You

Here is the exact purpose, architectural role, key exports, and dependencies of every file you created or modified in the project:

```
src/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Tab bar configuration & route registration
│   │   ├── caregiver-dashboard.tsx   # Caregiver dashboard & patient roster
│   │   ├── index.tsx                 # Tab redirect to patient dashboard
│   │   ├── patient-dashboard.tsx     # Patient schedule, alarms & intake actions
│   │   └── uploads.tsx               # Prescription capture & AI vision scanning
│   ├── _layout.tsx                   # App root layout, font loader & auth guard
│   ├── explore.tsx                   # (Expo template boilerplate screen)
│   ├── index.tsx                     # App entry redirect to /login
│   ├── login.tsx                     # Authentication screen (Sign In / Sign Up)
│   ├── medication-details.tsx        # Medication detail view, skip & order actions
│   ├── profile-setup.tsx             # First-time profile & role setup
│   ├── review-details.tsx            # Caregiver prescription review & edit modal
│   ├── role-selection.tsx            # Standalone role switcher screen
│   └── settings.tsx                  # User profile, accessibility & notification settings
├── context/
│   ├── AccessibilityContext.tsx      # Global accessibility, speech & haptics state
│   └── authcontext.tsx               # Supabase session & user profile management
├── lib/
│   └── supabase.ts                   # Supabase client & AsyncStorage persistent adapter
├── navigation/
│   └── AppNavigator.js               # Legacy React Navigation stack navigator
├── screens/
│   └── RoleSelectionScreen.js        # Legacy React Navigation role selection screen
├── theme/
│   └── index.ts                      # Design tokens (colors, typography, spacing)
└── types/
    ├── medication.ts                 # Types & constructor for medications
    └── review.ts                     # Types & constructor for prescription reviews
Root Files:
├── App.js                            # Legacy entry point for React Navigation
├── app.json                          # Expo project configuration & branding
└── package.json                      # Project dependencies & npm scripts
```

---

### A. Context & State Management

#### 1. `src/context/authcontext.tsx`
* **Purpose:** Acts as the central authentication authority for the entire application.
* **What it does:**
  * Initializes the Supabase session on app launch via `supabase.auth.getSession()`.
  * Subscribes to real-time auth state changes (`supabase.auth.onAuthStateChange`) to handle login, logout, and token refreshes.
  * Queries the `profiles` table in Supabase (`id`, `role`, `full_name`) whenever a user logs in.
  * Handles the `PGRST116` error gracefully (which indicates a newly registered user who has not yet completed `profile-setup`).
* **Exports:** `AuthProvider` (wrapper component) and `useAuth()` (hook returning `session`, `profile`, `loading`).
* **Interactions:** Consumed by `src/app/_layout.tsx` for route guarding, `src/app/settings.tsx` for user info, and the dashboards for filtering records by user ID.

#### 2. `src/context/AccessibilityContext.tsx`
* **Purpose:** Manages user accessibility preferences and multi-sensory feedback throughout the app.
* **What it does:**
  * Persists and retrieves `accessMode` (high contrast, enlarged typography) and `audioMode` (text-to-speech) from local `AsyncStorage`.
  * Exposes toggle functions (`toggleAccessibility`, `toggleAudio`).
  * Exposes a unified `triggerHaptic(style)` method using `expo-haptics` that triggers tactile feedback on interactions when accessibility mode is enabled.
* **Exports:** `AccessibilityProvider` (wrapper component) and `useAccessibility()` (hook).
* **Interactions:** Consumed in `patient-dashboard.tsx`, `settings.tsx`, and `_layout.tsx`.

---

### B. Core Application & Routing (`src/app/`)

#### 3. `src/app/_layout.tsx`
* **Purpose:** The root navigation container and authentication gatekeeper for Expo Router.
* **What it does:**
  * Pre-loads custom typography (`PublicSans-Regular`, `Medium`, `Bold`, `ExtraBold`) and holds the native splash screen until fonts and auth session are ready.
  * Configures global foreground notification presentation behavior via `Notifications.setNotificationHandler`.
  * Wraps the application inside `AccessibilityProvider` and `AuthProvider`.
  * Implements reactive route protection (`useEffect` watching `session` and `profile`):
    * If unauthenticated $\rightarrow$ redirects to `/login`.
    * If authenticated without a profile $\rightarrow$ redirects to `/profile-setup`.
    * If authenticated with a profile $\rightarrow$ redirects to `/caregiver-dashboard` (for caregivers/doctors) or `/patient-dashboard` (for patients).
* **Exports:** Default `Layout` component and inner `RootLayoutNav`.

#### 4. `src/app/index.tsx`
* **Purpose:** Root fallback entry route.
* **What it does:** Contains `<Redirect href="/login" />` to immediately hand off control to the authentication flow and `_layout.tsx` route guards.

#### 5. `src/app/login.tsx`
* **Purpose:** The user entry portal for authentication.
* **What it does:**
  * Provides a sleek form supporting both Sign In and Sign Up modes.
  * Calls `supabase.auth.signInWithPassword()` for existing users.
  * Calls `supabase.auth.signUp()` for new accounts.
  * Includes keyboard-avoiding behavior and validation alerts.
* **Interactions:** Communicates with `src/lib/supabase.ts` and updates `AuthContext`.

#### 6. `src/app/profile-setup.tsx`
* **Purpose:** Onboarding screen for new accounts to define their identity.
* **What it does:**
  * Collects the user's `full_name`.
  * Provides visual toggle cards to choose a role: `patient` or `caregiver`.
  * Inserts a new record into the Supabase `profiles` table: `{ id, full_name, role }`.
  * Directs the user to their appropriate dashboard upon successful insert.
* **Interactions:** Uses `useAuth()`, inserts into Supabase `profiles`, redirects to `(tabs)`.

#### 7. `src/app/role-selection.tsx`
* **Purpose:** Standalone / manual role switcher and logout screen.
* **What it does:**
  * Provides large tappable cards for choosing "I'm a Patient" (navigates to `/patient-dashboard`) or "I'm a Caregiver" (navigates to `/caregiver-dashboard`).
  * Provides a direct "Log Out" button calling `supabase.auth.signOut()`.

#### 8. `src/app/settings.tsx`
* **Purpose:** Dedicated preferences, profile overview, and account management screen.
* **What it does:**
  * Displays user profile name and capitalized role.
  * Allows toggling Accessibility Mode and Read Aloud Audio switches with instant haptic response.
  * Provides a deep link (`Linking.openSettings()` / `app-settings:`) directly to the phone's native notification settings so users can configure alarm ringtones.
  * Provides a secure Log Out action that signs out of Supabase and redirects to `/login`.

#### 9. `src/app/medication-details.tsx`
* **Purpose:** Detailed inspection screen for a specific medication.
* **What it does:**
  * Reads `id` parameter from URL params (`useLocalSearchParams`).
  * Fetches the medication row from the Supabase `medications` table.
  * Displays name, dosage, schedule time badge, description, and prescribed duration.
  * Action: "Order Medicine" opens a browser URL with a Google shopping query for the medication.
  * Action: "Skip Dosage for this Term" updates the medication's status to `'skipped'` in Supabase and returns to the dashboard.

#### 10. `src/app/review-details.tsx`
* **Purpose:** Clinical review and prescription verification screen for caregivers/doctors.
* **What it does:**
  * Fetches pending prescription details by `id` from the Supabase `pending_reviews` table.
  * Displays the uploaded prescription image using `expo-image`.
  * Displays AI-extracted medication name, dosage, and duration.
  * Provides a 3-dot edit button opening a bottom modal where the doctor can correct medicine names, adjust dosage instructions, change duration, and add clinical notes.
  * **Approve Action:** Updates review status to `'approved'` and automatically inserts a new row into the `medications` table for the patient.
  * **Reject Action:** Updates review status to `'rejected'` with notes and notifies the user.

---

### C. Tab Navigation & Dashboards (`src/app/(tabs)/`)

#### 11. `src/app/(tabs)/_layout.tsx`
* **Purpose:** Configures the bottom tab navigator for authenticated users.
* **What it does:**
  * Defines tab bar styling (height, PublicSans typography, active teal tint).
  * Registers `patient-dashboard` and `caregiver-dashboard` with `href: null` (hiding them from the tab bar while allowing role-based navigation).
  * Registers visible tab: `uploads` (Prescription Upload).
  * Registers tab root: `index` (redirects to the active patient dashboard).

#### 12. `src/app/(tabs)/index.tsx`
* **Purpose:** Default tab route redirector.
* **What it does:** Contains `<Redirect href="/(tabs)/patient-dashboard" />`.

#### 13. `src/app/(tabs)/patient-dashboard.tsx`
* **Purpose:** The core patient experience and adherence command center.
* **What it does:**
  * Fetches all medications for the logged-in patient (`eq('patient_id', session.user.id)`).
  * Sorts medications chronologically using a custom 12/24-hour time parser (`parseTimeToMinutes`).
  * Automatically schedules local device notifications and alarms (`expo-notifications`) for upcoming doses.
  * **"I TOOK IT" Button:** Marks dose as taken in Supabase, cancels scheduled alarm, and updates UI state.
  * **"SNOOZE" Button:** Reschedules the alarm 20 minutes into the future with high priority.
  * **"Read Aloud" Button:** Reads the medicine name, dosage, and scheduled time using `expo-speech` (if audio is enabled in settings).
  * Renders high-contrast borders and enlarged text when `isAccessibilityMode` is active.
  * Supports pull-to-refresh (`RefreshControl`).

#### 14. `src/app/(tabs)/caregiver-dashboard.tsx`
* **Purpose:** The primary monitoring portal for caregivers and physicians.
* **What it does:**
  * Fetches all pending prescription reviews from the `pending_reviews` table.
  * Displays review cards with amber alerting badges for unverified prescriptions.
  * Fetches assigned patients from the `patients` table where `doctor_id = session.user.id`.
  * Displays patient cards showing patient ID, medical condition, and medication adherence percentage badge (green for $\ge 80\%$, red for $< 80\%$).
  * Supports pull-to-refresh and direct navigation into `review-details`.

#### 15. `src/app/(tabs)/uploads.tsx`
* **Purpose:** Prescription ingestion, storage, and AI OCR processing.
* **What it does:**
  * Allows taking a photo (`ImagePicker.launchCameraAsync`) or picking from gallery (`launchImageLibraryAsync`).
  * Previews the selected prescription.
  * Converts image to base64 and uploads it to Supabase Storage bucket `prescriptions`.
  * Generates a public URL for the prescription.
  * Calls OpenAI GPT-4o chat completions API with a prompt acting as an expert pharmacist to extract `{ medicine_name, dosage, duration }`.
  * Inserts the resulting data and image URL into the `pending_reviews` table for doctor review.

---

### D. Data Models & Design System

#### 16. `src/lib/supabase.ts`
* **Purpose:** Supabase SDK client initialization.
* **What it does:**
  * Configures the Supabase client with project URL `https://kvbjmkadnavvajwxcepj.supabase.co` and anon key.
  * Polyfills URL parsing for React Native using `react-native-url-polyfill/auto`.
  * Defines `ExpoSecureStoreAdapter` wrapping `@react-native-async-storage/async-storage` to ensure auth tokens are safely persisted across app reloads without throwing DOM/window errors.

#### 17. `src/theme/index.ts`
* **Purpose:** Centralized design system tokens adhering to Material Design 3 and healthcare UI principles.
* **What it does:**
  * Defines color palette: Primary Teal (`#00595c`), Secondary Amber (`#795900`, `#ffbf00`), Surface tints (`#fcf9f8`, `#f6f3f2`), Semantic Success (`#2D7D46`) and Danger (`#C62828`).
  * Defines typography tokens for PublicSans font sizes and line heights (`headlineLg`, `bodyLg`, `timeDisplay`).
  * Defines standard spacing (`touchTargetMin: 48` for accessibility, `pageMargin: 20`) and rounded border tokens.

#### 18. `src/types/medication.ts`
* **Purpose:** Type contracts and constructors for medications.
* **What it does:**
  * Exports `MedicationStatus = 'pending' | 'taken' | 'skipped'`.
  * Defines `Medication` interface (`id`, `medicine_name`, `dosage`, `time`, `status`, `description`, `duration`).
  * Defines helper function `createNewMedication(name, dosage, time)`.

#### 19. `src/types/review.ts`
* **Purpose:** Type contracts and constructors for prescription reviews.
* **What it does:**
  * Exports `ReviewStatus = 'pending' | 'approved' | 'rejected'`.
  * Defines `PendingReview` interface (`id`, `patient_name`, `medication`, `dosage`, `duration`, `time_ago`, `image_url`, `status`, `doctor_notes`, `patient_id`).
  * Defines helper function `createNewReview(patientName, medicationName, imageUrl)`.

---

### E. Configuration, Assets & Legacy / Experimental Files

#### 20. `app.json`
* **Purpose:** Expo app manifest.
* **What was modified:** Configured app name `"MedSync"`, slug `"medsync"`, URL scheme `"medsync"`, bundle identifier `"com.medsync.app"`, splash background `#0D7377`, `expo-router` plugin, and enabled typed routes.

#### 21. `package.json`
* **Purpose:** App package specification and dependencies.
* **What was added:** Added `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `expo-notifications`, `expo-speech`, `expo-haptics`, `expo-image-picker`, `expo-image`, `base64-arraybuffer`, and `react-native-url-polyfill`.

#### 22. `assets/fonts/PublicSans-*.ttf`
* **Purpose:** Custom bundled fonts (PublicSans Bold, ExtraBold, Medium, Regular) providing high-legibility medical typography for seniors and accessible reading.

#### 23. Legacy / Experimental Files (Created in Commit 155a145):
* **`App.js`:** An early root component configured with `AppNavigator`. In the current setup, `package.json` specifies `"main": "expo-router/entry"`, meaning Expo Router ignores `App.js`.
* **`src/navigation/AppNavigator.js`:** An early React Navigation native stack navigator (`@react-navigation/native-stack`) referencing `RoleSelectionScreen` and a non-existent `MedicationAlertScreen`.
* **`src/screens/RoleSelectionScreen.js`:** An early React Navigation version of the role selection UI, now superseded by `src/app/role-selection.tsx`.

---

## 4. Key Discoveries, Bugs & Technical Observations

During the analysis of your codebase and TypeScript checks, here are several items to be aware of:

### 1. TypeScript Build Error in `src/app/_layout.tsx` (Line 52)
* **Issue:** `profile.role` has type `'patient' | 'caregiver' | null`. Calling `(['caregiver', 'doctor'] as string[]).includes(profile.role)` fails compilation because `null` cannot be passed to `.includes()` of `string[]`.
* **Quick Fix:** Check `profile.role && ['caregiver', 'doctor'].includes(profile.role)`.

### 2. Missing `patient_id` Linkage in Review Approval (`src/app/review-details.tsx`)
* **Issue:** When a caregiver approves a prescription, `createNewMedication` creates a medication with name, dosage, and time, but `patient_id` is not passed or inserted into `medications`.
* **Impact:** Because `patient-dashboard.tsx` filters by `.eq('patient_id', session.user.id)`, approved medications will not appear on the patient's dashboard unless `patient_id` is saved.

### 3. Hardcoded Patient & API Key in `src/app/(tabs)/uploads.tsx`
* **Issue 1:** Line 19 contains `const apiKey = 'YOUR_OPENAI_API_KEY';`. Without an API key or secure backend endpoint, AI prescription scanning will fail and fallback to upload-only.
* **Issue 2:** Line 117 hardcodes `patient_name: 'Sarah Jenkins'` when inserting into `pending_reviews`. It should use `profile?.full_name || 'Patient'` and include the patient's `patient_id: session.user.id`.

### 4. Redundant / Dead Code Cleanup
* Files `App.js`, `src/navigation/AppNavigator.js`, and `src/screens/RoleSelectionScreen.js` can be safely deleted or archived to prevent confusion, as Expo Router (`src/app/`) handles all app routes.
* `src/app/explore.tsx` is an unused boilerplate screen from the Expo starter template.

---

## 5. Recommended Next Steps

1. **Fix the TypeScript Compilation Error** in `src/app/_layout.tsx`.
2. **Wire up `patient_id`** in `uploads.tsx` and `review-details.tsx` so the prescription-to-medication pipeline is fully functional end-to-end between real users.
3. **Set up Environment Variables (`.env`)** for the OpenAI API key and Supabase credentials instead of storing keys directly in client source files.
4. **Implement Patient-Caregiver Pairing:** Add an invite code or search feature allowing caregivers to link to specific patients.
5. **Clean up Legacy Files:** Remove `App.js`, `src/navigation/`, and `src/screens/`.
