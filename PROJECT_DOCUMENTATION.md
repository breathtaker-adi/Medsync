# MedSync — Project Progress Report & Zero-Context Reconstruction Blueprint

> **Document Classification:** Senior Architectural Audit & Zero-Context Reconstruction Specification  
> **Author:** Principal Software Architect & Lead Systems Engineer  
> **Target Audience:** Autonomous AI Coding Agents, Systems Architects, Security Auditors  
> **Target Framework:** Expo SDK 57.0.18 / React Native 0.86.3 / React 19.2.3 / Expo Router 57.0.17  
> **Backend Platform:** Supabase (PostgreSQL 15.8, PostgREST API, RLS, Auth, S3-Compatible Storage, Deno Edge Functions)  
> **AI Vision Pipeline:** OpenAI GPT-4o Multi-Modal Vision API (via Deno Edge Function Proxy)  
> **Push Infrastructure:** Expo Application Services (EAS) Push Server with Firebase Cloud Messaging (FCM v1)  
> **TypeScript Status:** Strict Compilation Passing (`tsc --noEmit` exit code 0)

---

## 1. Project Overview & Architecture

### 1.1 Core Purpose & Problem Statement
**MedSync** is an enterprise-grade, mobile-first healthcare companion and clinical oversight application. It solves three critical breakdowns in chronic-disease management and geriatric healthcare:
1. **Prescription Incomprehension & Decryption Errors:** Handwritten or dense clinical slips frequently lead to missed doses, incorrect administration, and dangerous drug interactions. MedSync provides a camera-driven ingestion flow that uses computer vision to parse prescriptions into structured medication schemas.
2. **Adherence Failures & Double-Dosing:** Patients suffering from cognitive decline or memory lapses frequently miss doses or accidentally double-dose. MedSync orchestrates local device notifications, persistent background notification action buttons, auditory verification via text-to-speech, and automatic inventory tracking.
3. **Disconnected Caregiving & Latent Crisis Detection:** Caregivers and physicians usually only discover adherence issues after an acute medical event occurs. MedSync provides a pairing system that streams real-time compliance events, calculates 30-day adherence streaks, and dispatches urgent alerts when two or more doses are missed.

### 1.2 Target Personas & Primary Workflows
The application implements two distinct user personas governed by role-based routing gates:

#### 1. Patient Persona
* **Intake Execution:** Views daily schedule segregated into Morning (< 12:00), Afternoon (12:00–16:59), Evening (17:00–20:59), and Night (≥ 21:00).
* **Adherence Confirmations:** Confirms doses via high-contrast buttons (`"I TOOK IT"`) with a 4-second reversible Undo window, or snoozes for 20 minutes (capped at 2 snoozes).
* **Prescription Capture:** Takes photographs of physical slips, initiates S3-compatible cloud storage uploads, and dispatches OCR extraction tasks.
* **Accessibility Support:** Operates high-contrast mode, triggers haptic feedback, and invokes voice synthesis to read drug names, dosages, and warnings aloud.
* **Clinical Health Export:** Generates 30-day compliance logs as native PDF documents for clinical review.

#### 2. Caregiver / Clinician Persona
* **Supervised Patient Roster:** Monitors linked patients, compliance scores, and medical alerts.
* **Prescription Review & Verification:** Inspects high-resolution images of patient slips side-by-side with AI-extracted data, corrects inaccuracies via an editing modal, adds clinical guidance notes, and approves schedules into the patient's active timeline.
* **Pairing & Management:** Claims unassigned patients via 6-character cryptographic tokens and toggles global vs. per-patient notification overrides.

```
+---------------------------------------------------------------------------------------------------+
|                                      MEDSYNC SYSTEM LIFECYCLE                                     |
+---------------------------------------------------------------------------------------------------+
                                                                                                     
    [PATIENT DEVICE]                                                      [SUPERVISOR DEVICE]        
           │                                                                       │                 
           │ 1. Capture Camera/Gallery                                             │                 
           ▼                                                                       │                 
  [uploads.tsx]                                                                    │                 
           │                                                                       │                 
           │ 2. Base64 ArrayBuffer                                                 │                 
           ├────────────────────────> [Supabase S3 Bucket: prescriptions]          │                 
           │                                                                       │                 
           │ 3. Invoke Edge Function: scan-prescription                            │                 
           ├────────────────────────> [Deno Edge Function]                         │                 
                                             │                                     │                 
                                             │ 4. Proxies Request                  │                 
                                             ▼                                     │                 
                                    [OpenAI GPT-4o]                                │                 
                                             │                                     │                 
                                             │ 5. Structured JSON                  │                 
                                             ▼                                     │                 
                                    [pending_reviews]                              │                 
                                             │                                     │                 
                                             │ 6. Push Trigger (Expo -> FCM v1)    │                 
                                             ├────────────────────────────────────>│                 
                                                                                   ▼                 
                                                                         [caregiver-dashboard]       
                                                                                   │                 
                                                                                   │ 7. Review & Edit
                                                                                   ▼                 
                                                                         [review-details.tsx]        
                                                                                   │                 
                                                                                   │ 8. Approve Drug 
                                                                                   ▼                 
                                    [medications] <────────────────────────────────┤                 
                                          │                                                          
                                          │ 9. Push Trigger ("Approved")                             
                                          ▼                                                          
                                  [patient-dashboard]                                                
                                          │                                                          
                                          │ 10. Native Channel Alarms                                
                                          ▼                                                          
                            [expo-notifications Banner]                                              
                                    │            │                                                   
          [Action: "I TOOK IT"] <───┤            ├───> [Action: "SNOOZE 20M"]                        
                    │                                          │                                     
                    ▼                                          ▼                                     
     - Decrement pills_remaining                   - Schedule +20min Date Trigger                    
     - Upsert medication_logs (taken)              - Increment snooze_count in log                   
     - Auto-dismiss banner                         - Auto-dismiss banner                             
```

### 1.3 Tech Stack & Runtime Specifications
* **Runtime & Framework:** Node.js (>= 18.0.0), React Native 0.86.3, React 19.2.3, Expo SDK 57.0.18.
* **Routing Architecture:** `expo-router` v57.0.17 (file-based navigation with typed routes, tab groups, and stack transitions).
* **Language & Compiler:** TypeScript 6.0.3, strictly configured (`strict: true`) with path aliases (`@/*` mapping to `./src/*`).
* **Design System & Styling:** Vanilla React Native `StyleSheet` driven by a unified token engine (`Theme`) implementing Material Design 3 surface containers, high-contrast states, and typography (`PublicSans`).
* **Database & Auth:** Supabase PostgreSQL 15.8, PostgREST API client (`@supabase/supabase-js` v2.112.4), Row Level Security (RLS), and custom AsyncStorage persistence adapters.
* **Serverless Backend:** Supabase Edge Functions running on Deno runtime (`std@0.168.0/http/server.ts`).
* **Hardware & Sensory APIs:**
  * Alarms & Channels: `expo-notifications` v57.0.15
  * Vision & Capture: `expo-image-picker` v57.0.14, `expo-image` v57.0.3, `base64-arraybuffer` v1.0.2
  * Accessibility & Haptics: `expo-speech` v57.0.2, `expo-haptics` v57.0.2
  * Document Compilation: `expo-print` v57.0.1, `expo-sharing` v57.0.18
  * System Hardware: `expo-device` v57.0.1, `expo-font` v57.0.2, `expo-splash-screen` v57.0.8, `expo-intent-launcher` v57.0.1

### 1.4 Architectural Pattern
The application uses a **Decoupled Client-Serverless Hybrid Architecture** organized into four operational tiers:
1. **Client Tier (Presentation & Sensory):** An Expo Router mobile app orchestrating reactive contexts (`AuthProvider`, `AccessibilityProvider`), local background notification workers, and native hardware bridges.
2. **Edge Processing Tier (Security & Vision Proxy):** Supabase Deno Edge Functions handling CORS, securing upstream vendor API keys (`OPENAI_API_KEY`), and enforcing JSON schema constraints on generative vision responses.
3. **Data & Security Tier (Storage & Relational Database):** PostgreSQL 15 with Row Level Security isolating patient records, relational joins for supervisor delegation, and secure database views (`doctor_push_tokens`, `patient_push_tokens`) that prevent leaking device tokens.
4. **Push Notification Gateway:** Dual-hop asynchronous messaging using Expo Push Servers mapped to Firebase Cloud Messaging (FCM v1) via `google-services.json` credentials.

---

## 2. Annotated File & Directory Structure

### 2.1 ASCII Visual File Tree

```
medsync-app/
├── .vscode/
│   ├── extensions.json                  # Recommended workspace editor extensions
│   └── settings.json                    # Workspace formatters & editor settings
├── assets/
│   ├── expo.icon/                       # Vector application icon configuration
│   │   ├── Assets/
│   │   │   ├── expo-symbol 2.svg        # Scalable source logo vector
│   │   │   └── grid.png                 # Icon alignment grid reference
│   │   └── icon.json                    # Expo icon manifest
│   ├── fonts/
│   │   ├── PublicSans-Bold.ttf          # Primary UI emphasis font
│   │   ├── PublicSans-ExtraBold.ttf     # Screen titles & alarm counter font
│   │   ├── PublicSans-Medium.ttf        # Subtitle & button font
│   │   └── PublicSans-Regular.ttf       # Body & metadata font
│   ├── images/
│   │   ├── tabIcons/                    # Tab bar navigation icon assets
│   │   ├── expo-badge.png               # Diagnostic branding badge
│   │   ├── expo-logo.png                # Platform logo asset
│   │   ├── favicon.png                  # Web preview favicon
│   │   ├── icon.png                     # Standard raster application icon
│   │   ├── react-logo.png               # Default framework asset
│   │   └── splash-icon.png              # Launch screen icon asset
│   ├── icon.png                         # Android / iOS master launch icon
│   └── splash.png                       # High-resolution native splash screen
├── scripts/
│   └── reset-project.js                 # Boilerplate project clearing utility
├── src/
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx              # Bottom tab navigator configuration & visibility logic
│   │   │   ├── caregiver-dashboard.tsx  # Caregiver oversight hub, review feed & missed alert queries
│   │   │   ├── index.tsx                # Role-aware routing gatekeeper for tab entry
│   │   │   ├── patient-dashboard.tsx    # Daily schedule, local alarm engine & intake confirm
│   │   │   └── uploads.tsx              # Prescription camera capture, S3 upload & AI invocation
│   │   ├── _layout.tsx                  # Root navigation wrapper, font preloader & auth gate
│   │   ├── explore.tsx                  # Diagnostic template screen
│   │   ├── index.tsx                    # Root entry point redirecting to /login
│   │   ├── login.tsx                    # Supabase Email/Password authentication & signup
│   │   ├── medication-details.tsx       # Detailed drug view, time edits, pause, and delete
│   │   ├── medication-history.tsx       # 30-day compliance logs, streaks, and adherence score
│   │   ├── patient-details.tsx          # Caregiver deep-dive clinical record & active prescriptions
│   │   ├── patient-directory.tsx        # Filterable search directory of linked patients
│   │   ├── profile-setup.tsx            # First-time onboarding screen for profile & role selection
│   │   ├── review-details.tsx           # Clinical prescription audit, correction modal & approval
│   │   ├── role-selection.tsx           # Diagnostic / manual persona switching view
│   │   └── settings.tsx                 # Account info, accessibility switches, pairing & PDF export
│   ├── components/
│   │   ├── ui/
│   │   │   └── collapsible.tsx          # Reanimated expandable accordion component
│   │   ├── animated-icon.tsx            # Cross-platform animated iconography
│   │   ├── animated-icon.web.tsx        # Web fallback for animated iconography
│   │   ├── app-tabs.tsx                 # Native tab navigation primitives
│   │   ├── app-tabs.web.tsx             # Web implementation of tab navigation
│   │   ├── external-link.tsx            # Secure in-app browser linking wrapper
│   │   ├── hint-row.tsx                 # Diagnostic UI component
│   │   ├── themed-text.tsx              # Dynamic color-aware text wrapper
│   │   ├── themed-view.tsx              # Dynamic background-aware view wrapper
│   │   └── web-badge.tsx                # Diagnostic platform badge
│   ├── constants/
│   │   └── theme.ts                     # Fallback layout dimensions, spacing & system typography
│   ├── context/
│   │   ├── AccessibilityContext.tsx     # Global accessibility, speech synthesis & haptic store
│   │   └── authcontext.tsx              # Global Supabase session, profile store & push registration
│   ├── hooks/
│   │   ├── use-color-scheme.ts          # Native system color scheme listener
│   │   ├── use-color-scheme.web.ts      # Web DOM color scheme listener
│   │   └── use-theme.ts                 # Theme resolution hook
│   ├── lib/
│   │   └── supabase.ts                  # Supabase client instantiation & AsyncStorage adapter
│   ├── navigation/
│   │   └── AppNavigator.js              # [Legacy] React Navigation native stack navigator
│   ├── screens/
│   │   └── RoleSelectionScreen.js       # [Legacy] React Navigation role selection screen
│   ├── theme/
│   │   └── index.ts                     # Central design tokens: MD3 colors, typography & spacing
│   ├── types/
│   │   ├── medication.ts                # TypeScript interface & factory for medication records
│   │   └── review.ts                    # TypeScript interface & factory for prescription reviews
│   └── global.css                       # CSS variable definitions for web targets
├── supabase/
│   └── functions/
│       ├── scan-prescription/
│       │   └── index.ts                 # Deno edge function proxying OpenAI Vision requests
│       ├── deno.json                    # Deno compiler configuration
│       └── import_map.json              # Deno standard library import dependencies
├── supabase_backup/                     # Complete local database schema & data backup dump
│   ├── openapi_spec.json                # PostgREST complete OpenAPI swagger specification
│   ├── schema_generated.sql             # Full SQL DDL tables and views
│   ├── profiles.json / .csv             # Profile records
│   ├── medications.json / .csv          # Medication schedules
│   ├── patient_caregivers.json / .csv   # Pairing links & claim codes
│   ├── patients.json / .csv             # Caregiver roster records
│   ├── patient_push_tokens.json / .csv  # Patient push tokens view dump
│   ├── doctor_push_tokens.json / .csv   # Doctor push tokens view dump
│   ├── auth_users.json                  # Supabase Auth Admin user list
│   ├── storage_buckets.json             # Object storage buckets
│   └── storage_prescriptions_files.json # S3 image file metadata inventory
├── .env                                 # Local environment variables declaration file
├── .gitignore                           # Git tracked exclusion manifest
├── AGENTS.md                            # Workspace AI behavioral instructions
├── app.json                             # Expo application manifest, permissions & build config
├── App.js                               # [Legacy] React Native root entry point
├── CLAUDE.md                            # Claude agent configuration marker
├── eas.json                             # Expo Application Services cloud build profiles
├── expo-env.d.ts                        # TypeScript declarations for Expo environment
├── google-services.json                 # Google Firebase configuration file for Android FCM push
├── LICENSE                              # MIT Open Source License
├── package.json                         # Node.js project manifest & dependency specifications
├── package-lock.json                    # Dependency lockfile
├── Supabase Snippet List Public Schema Columns.csv # Live database column dump
└── tsconfig.json                        # TypeScript compiler options & module resolution paths
```

---

### 2.2 File-by-File Breakdown

#### Root Configuration Files

* **`package.json`**
  * **Criticality Level:** Core / Config
  * **Responsibility:** Defines all project dependencies, build scripts, npm entry points, and native library bindings.
  * **Key Exports / Content:** Sets `"main": "expo-router/entry"`, declares 37 production packages, and specifies Expo build scripts (`start`, `android`, `ios`, `web`, `lint`, `reset-project`).
  * **Internal Dependencies:** Acts as the foundation for all local module resolution.

* **`app.json`**
  * **Criticality Level:** Core / Config
  * **Responsibility:** Supplies the Expo compilation manifest, app branding, Android permissions, Firebase bindings, and native plugins.
  * **Key Exports / Content:** Configures package identifier `com.medsync.app`, deep link scheme `medsync`, EAS Project ID `08976e05-387f-4b74-a4bb-f2a1fdc5540b`, Android permission `android.permission.SCHEDULE_EXACT_ALARM`, and plugins (`expo-router`, `expo-sharing`, `expo-splash-screen`, `expo-notifications`).
  * **Internal Dependencies:** References `google-services.json`, `assets/icon.png`, `assets/splash.png`.

* **`tsconfig.json`**
  * **Criticality Level:** Config
  * **Responsibility:** Establishes TypeScript compiler behavior, strictness checks, and import aliasing.
  * **Key Exports / Content:** Extends `expo/tsconfig.base`, enables `strict: true`, maps path `@/*` to `./src/*`, excludes `supabase/functions`.
  * **Internal Dependencies:** Controls compilation across all `.ts` and `.tsx` files.

* **`eas.json`**
  * **Criticality Level:** Config
  * **Responsibility:** Specifies cloud compilation pipelines for internal distribution and production stores.
  * **Key Exports / Content:** Declares build profiles: `development` (internal APK), `preview` (standalone internal APK), `production` (optimized Android App Bundle `.aab`).
  * **Internal Dependencies:** Utilized by EAS CLI.

* **`google-services.json`**
  * **Criticality Level:** Core / Config
  * **Responsibility:** Provides Firebase client credentials for FCM v1 push notification delivery.
  * **Key Exports / Content:** Declares project number `672938633977`, project ID `medsync-cbb52`, storage bucket, and Android client info binding package `com.medsync.app`.
  * **Internal Dependencies:** Linked directly by `app.json`.

* **`App.js`**
  * **Criticality Level:** Legacy / Non-functional
  * **Responsibility:** Pre-Expo Router root application entry point using `@react-navigation/native-stack`. In SDK 57 with `"main": "expo-router/entry"`, this file is completely bypassed.
  * **Key Exports / Content:** Default function `App()`.
  * **Internal Dependencies:** Imports `src/theme/index.ts`, `src/navigation/AppNavigator.js`.

* **`scripts/reset-project.js`**
  * **Criticality Level:** Supporting / Utility
  * **Responsibility:** Interactive Node CLI script allowing developers to reset the project structure to a blank starter.
  * **Key Exports / Content:** CLI execution functions.

---

#### Client Core Infrastructure & State (`src/lib/`, `src/context/`, `src/theme/`, `src/types/`)

* **`src/lib/supabase.ts`**
  * **Criticality Level:** Core
  * **Responsibility:** Initializes the isomorphic Supabase JavaScript client with custom persistent storage.
  * **Key Exports / Functions:**
    * `supabase`: Instantiated SupabaseClient.
    * `ExpoSecureStoreAdapter`: Storage adapter redirecting auth token persistence to `@react-native-async-storage/async-storage` while disabling URL session detection (`detectSessionInUrl: false`) to avoid browser window reference exceptions.
  * **Internal Dependencies:** Consumed by `authcontext.tsx`, `login.tsx`, and all dashboard screens.

* **`src/context/authcontext.tsx`**
  * **Criticality Level:** Core
  * **Responsibility:** Manages global authentication, active user profile state, and device push notification registration.
  * **Key Exports / Functions:**
    * `AuthProvider({ children })`: React Context provider wrapping the application.
    * `useAuth()`: Hook returning `{ session: Session | null, profile: Profile | null, loading: boolean }`.
    * `registerForPushNotifications(userId: string)`: Requests system notification permissions, captures device Expo Push Token, registers Android notification channels, and stores the token into `profiles.push_token`.
    * `fetchProfile(user: User)`: Queries `profiles` table. Gracefully handles `PGRST116` (row not found) for newly registered accounts.
  * **Internal Dependencies:** Consumes `src/lib/supabase.ts`. Consumed by `src/app/_layout.tsx`, `src/app/(tabs)/index.tsx`, and all app screens.

* **`src/context/AccessibilityContext.tsx`**
  * **Criticality Level:** Supporting
  * **Responsibility:** Manages user sensory feedback preferences: high-contrast layout, text-to-speech audio, and haptic motor feedback.
  * **Key Exports / Functions:**
    * `AccessibilityProvider({ children })`: Provider component.
    * `useAccessibility()`: Hook returning `{ isAccessibilityMode, isAudioEnabled, toggleAccessibility, toggleAudio, triggerHaptic }`.
    * `triggerHaptic(style)`: Executes tactile feedback via `expo-haptics` when accessibility mode is enabled.
  * **Internal Dependencies:** Persists state via `@react-native-async-storage/async-storage`. Consumed across patient screens and settings.

* **`src/theme/index.ts`**
  * **Criticality Level:** Core / UI
  * **Responsibility:** Houses centralized design system tokens adhering to Material Design 3 and medical interface guidelines.
  * **Key Exports / Content:**
    * `Theme.colors`: Primary teal (`#00595c`), Primary Container (`#0d7377`), Secondary Amber (`#795900`, `#ffbf00`), Surface tints (`#fcf9f8`, `#f6f3f2`), Semantic Success (`#2D7D46`), Semantic Danger (`#C62828`).
    * `Theme.typography`: Definitions for PublicSans font sizes, families, and line heights (`headlineLg`, `headlineMd`, `bodyLg`, `bodyMd`, `labelBold`, `timeDisplay`).
    * `Theme.spacing`: Sizing units (`touchTargetMin: 48`, `pageMargin: 20`, `gutterCard: 16`, `stackGap: 12`).
    * `Theme.rounded`: Corner radii tokens (`sm: 4`, `DEFAULT: 8`, `md: 12`, `lg: 16`, `xl: 24`, `full: 9999`).
  * **Internal Dependencies:** Imported by every UI screen and layout file.

* **`src/types/medication.ts`**
  * **Criticality Level:** Core / Supporting
  * **Responsibility:** Declares type definitions and constructors for medication schedules.
  * **Key Exports / Functions:**
    * `MedicationStatus`: Type union `'pending' | 'taken' | 'skipped'`.
    * `interface Medication`: Item schema (`id`, `medicine_name`, `dosage`, `time`, `status`, `description`, `duration`).
    * `createNewMedication(name, dosage, time)`: Factory returning `Omit<Medication, 'id'>`.

* **`src/types/review.ts`**
  * **Criticality Level:** Core / Supporting
  * **Responsibility:** Declares type definitions and constructors for prescription verification items.
  * **Key Exports / Functions:**
    * `ReviewStatus`: Type union `'pending' | 'approved' | 'rejected'`.
    * `interface PendingReview`: Item schema (`id`, `patient_name`, `medication`, `dosage`, `duration`, `time_ago`, `image_url`, `status`, `doctor_notes`, `patient_id`).
    * `createNewReview(patientName, medicationName, imageUrl)`: Factory returning `Omit<PendingReview, 'id'>`.

---

#### Application Routing & Screen Implementation (`src/app/`)

* **`src/app/_layout.tsx`**
  * **Criticality Level:** Core
  * **Responsibility:** Root application component, font preloader, global notification listener, and high-level routing gatekeeper.
  * **Key Exports / Functions:**
    * `default Layout()`: Mounts font loader (`useFonts`), wraps application in `AccessibilityProvider` and `AuthProvider`.
    * `RootLayoutNav({ fontsLoaded })`:
      * Registers notification category `'medication-alerts'` with action buttons (`'MARK_TAKEN'`, `'SNOOZE'`).
      * Listens for notification button taps via `addNotificationResponseReceivedListener`:
        * `'MARK_TAKEN'`: Retrieves session, upserts intake log into `medication_logs`, decrements `pills_remaining` in `medications`, and dismisses banner.
        * `'SNOOZE'`: Reschedules local alarm for +20 minutes and dismisses current banner.
      * Enforces authentication routing:
        * Unauthenticated $\rightarrow$ redirects to `/login`.
        * Authenticated with no database profile $\rightarrow$ redirects to `/profile-setup`.
        * Authenticated with profile $\rightarrow$ redirects to role-based dashboard (`caregiver-dashboard` or `patient-dashboard`).
  * **Internal Dependencies:** Consumes `authcontext.tsx`, `AccessibilityContext.tsx`, `src/lib/supabase.ts`, `src/theme/index.ts`.

* **`src/app/index.tsx`**
  * **Criticality Level:** Core
  * **Responsibility:** Root redirect stub. Immediately emits `<Redirect href="/login" />` to trigger root layout gate evaluation.

* **`src/app/login.tsx`**
  * **Criticality Level:** Core / UI
  * **Responsibility:** Handles user authentication and account creation.
  * **Key Exports / Functions:**
    * `default LoginScreen()`: Provides email and password inputs, state toggling between Sign In and Sign Up modes.
    * `handleAuth()`: Calls `supabase.auth.signInWithPassword()` or `supabase.auth.signUp()`.
  * **Internal Dependencies:** Consumes `src/lib/supabase.ts`, `src/theme/index.ts`.

* **`src/app/profile-setup.tsx`**
  * **Criticality Level:** Core / UI
  * **Responsibility:** Onboarding gate where newly registered accounts declare their formal name and role.
  * **Key Exports / Functions:**
    * `default ProfileSetupScreen()`: Interactive cards for role selection (`patient` vs `caregiver`).
    * `handleSaveProfile()`: Inserts `{ id: session.user.id, full_name, role }` into the `profiles` table and redirects directly to dashboard.
  * **Internal Dependencies:** Consumes `authcontext.tsx`, `src/lib/supabase.ts`, `src/theme/index.ts`.

* **`src/app/role-selection.tsx`**
  * **Criticality Level:** Supporting / UI
  * **Responsibility:** Standalone persona switching and manual logout screen.
  * **Key Exports / Functions:**
    * `default RoleSelectionScreen()`: Buttons routing to `patient-dashboard` or `caregiver-dashboard`.
    * `handleLogout()`: Signs out of Supabase and redirects to `/login`.

* **`src/app/settings.tsx`**
  * **Criticality Level:** Core / UI
  * **Responsibility:** User preferences, accessibility switches, caregiver pairing code generation, alarm ringtone intents, and PDF compliance report export.
  * **Key Exports / Functions:**
    * `default SettingsScreen()`:
    * `generatePairingCode()`: Creates a random 6-character alphanumeric code, writes to `patient_caregivers` table.
    * `exportHealthReport()`: Queries last 30 days of `medication_logs`, formats custom HTML document with color-coded status pills, invokes `Print.printToFileAsync()`, and triggers native platform sharing via `Sharing.shareAsync()`.
    * `handleToggleAlerts(value)`: Toggles global `alerts_enabled` boolean on caregiver profile.
    * `openAlarmSoundSettings()`: Dispatches Android intent `android.settings.CHANNEL_NOTIFICATION_SETTINGS` targeting channel `'medication-alarms-auto'`.
  * **Internal Dependencies:** Consumes `authcontext.tsx`, `AccessibilityContext.tsx`, `src/lib/supabase.ts`, `src/theme/index.ts`.

* **`src/app/medication-details.tsx`**
  * **Criticality Level:** Core / UI
  * **Responsibility:** Detailed medication inspection, schedule edits, pausing/disabling, and hard deletion.
  * **Key Exports / Functions:**
    * `default MedicationDetailsScreen()`: Receives `id` from route params. Enforces IDOR security by checking `.eq('patient_id', session.user.id)`.
    * `handleOrderMedicine()`: Opens system browser with pre-populated Google Shopping query for the medication.
    * `handleSkip()`: Sets status to `'skipped'` in `medications`.
    * `handleDisable()`: Sets `is_active: false` in `medications` (pauses alarms without losing historical data).
    * `handleDelete()`: Executes hard delete from `medications`.
    * `handleSaveTime()`: Validates 24-hour `HH:MM` regex and updates `time` in `medications`.

* **`src/app/medication-history.tsx`**
  * **Criticality Level:** Core / UI
  * **Responsibility:** 7-day and 30-day compliance analytics, adherence streak counter, and chronological audit log.
  * **Key Exports / Functions:**
    * `default MedicationHistoryScreen()`:
    * `fetchHistory()`: Fetches master medication names and queries `medication_logs` bounded by selected range.
    * `stats (useMemo)`: Computes adherence score percentage `(taken / total) * 100`, counts scheduled, taken, skipped, and missed doses. Runs an iterative 30-day daily streak lookback.
    * `groupedLogs (useMemo)`: Groups filtered log entries by calendar date (`Today`, `Yesterday`, or formatted string).

* **`src/app/patient-details.tsx`**
  * **Criticality Level:** Core / UI
  * **Responsibility:** Supervisor clinical view displaying a specific patient's medical profile and active prescriptions.
  * **Key Exports / Functions:**
    * `default PatientDetails()`: Reads `id` param. Verifies supervisor authorization against `patient_caregivers` before rendering. Displays blood group, allergies, and active medication list.

* **`src/app/patient-directory.tsx`**
  * **Criticality Level:** Core / UI
  * **Responsibility:** Searchable patient contact list for doctors and caregivers.
  * **Key Exports / Functions:**
    * `default PatientDirectory()`: Re-executes on screen focus (`useFocusEffect`), resolves all patient profiles linked to current user via `patient_caregivers`, provides client-side name search filtering.

* **`src/app/review-details.tsx`**
  * **Criticality Level:** Core / UI
  * **Responsibility:** Clinical prescription review portal for physicians.
  * **Key Exports / Functions:**
    * `default ReviewDetailsScreen()`: Displays uploaded prescription image using `expo-image`.
    * `handleSaveEdits()`: Updates AI-extracted medicine name, dosage, duration, and notes in `pending_reviews`.
    * `handleApprove()`:
      1. Updates review record status to `'approved'`.
      2. Inserts new schedule into `medications` with `patient_id: review.patient_id`. (Rolls back review to `'pending'` if insert fails).
      3. Resolves patient push token from secure view `patient_push_tokens` and dispatches approval push notification.
    * `handleReject()`: Updates review record status to `'rejected'`.

---

#### Bottom Navigation Tab Group (`src/app/(tabs)/`)

* **`src/app/(tabs)/_layout.tsx`**
  * **Criticality Level:** Core
  * **Responsibility:** Configures bottom tab navigator appearance, hides role-specific screens from tab navigation, and toggles prescription upload visibility based on user role.
  * **Key Exports / Functions:**
    * `default TabsLayout()`: Registers `patient-dashboard` and `caregiver-dashboard` with `href: null` (accessible via route push, hidden from tab bar). Hides `uploads` tab if user role is `caregiver`.

* **`src/app/(tabs)/index.tsx`**
  * **Criticality Level:** Core
  * **Responsibility:** Evaluates user role dynamically to redirect root tab navigation to the proper dashboard (`caregiver-dashboard` for caregivers/doctors, `patient-dashboard` for patients).

* **`src/app/(tabs)/patient-dashboard.tsx`**
  * **Criticality Level:** Core / UI
  * **Responsibility:** The patient home screen: schedule grouping, local alarms, intake actions, undo window, snooze management, and speech synthesis.
  * **Key Exports / Functions:**
    * `default PatientDashboard()`:
    * `parseTimeToMinutes(timeString)`: Converts 12-hour (AM/PM) and 24-hour time strings into sortable integers.
    * `checkIfOverdue(timeString)`: Evaluates whether scheduled time has passed.
    * `scheduleAllAlarms(meds)`: Wipes and reschedules all upcoming notifications using `expo-notifications` with channel `'medication-alarms-auto'`.
    * `fetchMedications()`: Queries `medications` where `is_active = true` and merges with today's `medication_logs`.
    * `handleTaken(med)`: Updates UI state immediately, displays Undo toast, and starts a 4-second timer before writing to `medication_logs` and decrementing `pills_remaining`.
    * `handleUndoTaken()`: Cancels the commit timer and restores UI state.
    * `handleSnooze(med)`: Enforces max 2 snoozes, reschedules alarm +20 minutes, increments `snooze_count` in database.
    * `handleReadAloud(med)`: Vocalizes medicine name and dosage via `Speech.speak()`.
    * `handleAddMedication()`: Manual modal allowing patients to directly add new prescriptions to their schedule.

* **`src/app/(tabs)/caregiver-dashboard.tsx`**
  * **Criticality Level:** Core / UI
  * **Responsibility:** Supervisor command center: pending prescription reviews, missed dose alerts, and patient claiming modal.
  * **Key Exports / Functions:**
    * `default CaregiverDashboard()`:
    * `checkMissedDoses()`: Evaluates supervisor global mute vs per-patient overrides. Queries `medication_logs` prior to today where status is `pending` or `missed`. Displays emergency banners if 2+ doses were missed.
    * `fetchData()`: Fetches verification status, pending reviews scoped to linked patients, and assigned patient roster.
    * `handleLinkPatient()`: Validates 6-character code, claims unassigned record in `patient_caregivers`.
    * `handleToggleOverride(patient, value)`: Updates `override_alerts` on `patient_caregivers`.

* **`src/app/(tabs)/uploads.tsx`**
  * **Criticality Level:** Core / UI
  * **Responsibility:** Prescription capture, binary S3 storage upload, AI OCR execution, and doctor push notification dispatch.
  * **Key Exports / Functions:**
    * `default UploadsScreen()`:
    * `pickImage(fromCamera)`: Launches native camera or photo library via `expo-image-picker` with `base64: true`.
    * `scanPrescriptionWithAI(base64)`: Invokes Supabase Edge Function `scan-prescription`.
    * `handleUploadAndScan()`: Decodes base64 into binary ArrayBuffer, uploads to Supabase Storage bucket `prescriptions`, inserts record into `pending_reviews`, and dispatches push notification to linked caregivers via database view `doctor_push_tokens`.

---

#### Serverless Edge Functions (`supabase/functions/`)

* **`supabase/functions/scan-prescription/index.ts`**
  * **Criticality Level:** Core / Backend
  * **Responsibility:** Edge Function proxying OpenAI Vision requests to keep API keys secure on the server.
  * **Key Exports / Functions:**
    * `serve(async (req))`: Handles CORS options preflight. Extracts `base64Image` from request body. Reads `OPENAI_API_KEY` from Deno environment. Dispatches payload to `https://api.openai.com/v1/chat/completions` using model `gpt-4o` with `response_format: { type: 'json_object' }`. Returns structured JSON (`medicine_name`, `dosage`, `duration`).

---

#### Legacy & Supporting Boilerplate Files

* **`src/navigation/AppNavigator.js`** *(Criticality: Legacy)*: Early React Navigation stack referencing `RoleSelectionScreen` and unbuilt `MedicationAlertScreen`. Unused by Expo Router.
* **`src/screens/RoleSelectionScreen.js`** *(Criticality: Legacy)*: Early React Navigation screen superseded by `src/app/role-selection.tsx`.
* **`src/app/explore.tsx`** *(Criticality: Template)*: Default boilerplate screen from the Expo starter template demonstrating collapsible elements and themed components.
* **`src/components/ui/collapsible.tsx`** *(Criticality: UI / Supporting)*: Reanimated accordion component.
* **`src/components/themed-text.tsx`** & **`src/components/themed-view.tsx`** *(Criticality: Supporting)*: Template primitives for dynamic color handling.
* **`src/components/external-link.tsx`** *(Criticality: Supporting)*: In-app browser launcher wrapping `expo-web-browser`.
* **`src/components/web-badge.tsx`**, **`src/components/hint-row.tsx`**, **`src/components/app-tabs.tsx`**, **`src/components/animated-icon.tsx`** *(Criticality: Template / Supporting)*: Expo starter template diagnostic components.

---

## 3. Dependencies & Environment Configuration

### 3.1 Production Dependencies Breakdown

| Package Name | Exact Version | Architectural Purpose in MedSync |
| :--- | :--- | :--- |
| **`expo`** | `~57.0.18` | Core runtime platform providing native bridges, lifecycle management, and SDK initialization. |
| **`expo-router`** | `~57.0.17` | Native file-based navigation, deep linking, modal transitions, and route type definitions. |
| **`@supabase/supabase-js`** | `^2.112.4` | Isomorphic PostgreSQL client for Supabase Auth, table queries, storage bucket operations, and Edge Function invocation. |
| **`expo-notifications`** | `~57.0.15` | Native notification scheduling, Android notification channels, background interactive actions (`MARK_TAKEN`, `SNOOZE`), and push tokens. |
| **`expo-image-picker`** | `~57.0.14` | Native hardware camera interface and photo library picker for capturing prescription slips. |
| **`expo-image`** | `~57.0.3` | High-performance cached image renderer for viewing high-resolution prescription images. |
| **`expo-speech`** | `~57.0.2` | Text-to-speech synthesis engine providing auditory medication verification for low-vision patients. |
| **`expo-print`** | `~57.0.1` | Headless HTML renderer compiling adherence tables into native PDF documents. |
| **`expo-sharing`** | `~57.0.18` | Platform sharing sheet provider exporting PDFs to WhatsApp, Mail, or Google Drive. |
| **`expo-haptics`** | `~57.0.2` | Device vibration motor controller delivering sensory tactile feedback on taps and confirmations. |
| **`expo-font`** | `~57.0.2` | Custom font asset loader ensuring `PublicSans` typefaces are available before rendering. |
| **`expo-splash-screen`** | `~57.0.8` | Native launch screen controller keeping splash screen visible during initial font and session load. |
| **`expo-device`** | `~57.0.1` | Physical hardware detector preventing push token registration from running in desktop simulators. |
| **`@react-native-async-storage/async-storage`** | `2.2.0` | On-device persistent key-value store acting as the backing cache for Supabase sessions and accessibility settings. |
| **`base64-arraybuffer`** | `^1.0.2` | Converts base64 image strings into binary ArrayBuffers for direct upload to Supabase S3 storage. |
| **`react-native-url-polyfill`** | `^4.0.0` | WHATWG URL standard polyfill enabling Supabase auth and WebSocket URL parsing in React Native. |
| **`@expo/vector-icons`** | `^15.0.2` | Bundled icon repository providing Ionicons and Entypo vectors throughout the app. |
| **`react-native-safe-area-context`** | `~5.7.0` | Inset calculator preventing UI collisions with device notches, status bars, and navigation pills. |
| **`react-native-screens`** | `~4.26.0` | Native memory-efficient UI view controller primitive powering navigation stacks. |
| **`expo-status-bar`** | `~57.0.1` | Configures status bar styling (clock, battery, cellular icons) against app theme colors. |
| **`expo-intent-launcher`** | `~57.0.1` | Launches Android platform system settings activities (specifically notification channel alarm screens). |
| **`expo-application`** | `~57.0.2` | Extracts native application identifier (`Application.applicationId`) for Android intent targets. |
| **`react-native-reanimated`** | `4.5.1` | High-performance animation runtime powering collapsible components and UI transitions. |
| **`react-native-gesture-handler`** | `~2.32.0` | Touch and gesture recognition engine for native navigation interactions. |
| **`react`** / **`react-dom`** | `19.2.3` | Core UI rendering library. |
| **`react-native`** | `0.86.3` | Mobile application framework. |
| **`expo-constants`** | `~57.0.16` | Supplies manifest metadata and device environment constants. |
| **`expo-dev-client`** | `~57.0.16` | Developer client runtime for native testing. |
| **`expo-file-system`** | `~57.0.6` | On-device file reading and caching utilities. |
| **`expo-glass-effect`** | `~57.0.1` | Visual glassmorphism effects on supported platforms. |
| **`expo-linking`** | `~57.0.8` | Deep linking and URL handler for application schemes. |
| **`expo-secure-store`** | `~57.0.2` | Hardware keychain encryption storage primitive. |
| **`expo-symbols`** | `~57.0.2` | SF Symbols and cross-platform vector iconography support. |
| **`expo-system-ui`** | `~57.0.3` | Native root view background coordinator. |
| **`expo-web-browser`** | `~57.0.2` | In-app web browser modal primitive. |
| **`react-native-web`** | `~0.21.0` | React Native web compiler target. |
| **`react-native-worklets`** | `0.10.1` | Worklet execution thread provider for Reanimated 4. |
| **`@expo/ui`** | `~57.0.14` | Native cross-platform UI primitives. |

### 3.2 Dev & Build Dependencies

| Package Name | Exact Version | Architectural Purpose |
| :--- | :--- | :--- |
| **`typescript`** | `~6.0.3` | Static type checker and language server compiler. |
| **`@types/react`** | `~19.2.2` | TypeScript definitions and JSX contracts for React 19. |

### 3.3 Configuration Files Analysis

* **`tsconfig.json`:** Extends `expo/tsconfig.base`. Configures `@/*` and `@/assets/*` path mappings. Excludes `supabase/functions` to prevent Deno standard library definitions from conflicting with Node/React Native typings.
* **`app.json`:** Declares URL scheme `medsync`, package `com.medsync.app`, linked `google-services.json`, custom splash screen background `#0D7377`, exact alarm permissions (`SCHEDULE_EXACT_ALARM`), and typed routes experiment.
* **`eas.json`:** Configures EAS CLI (>= 3.0.0) with APK compilation targets (`preview` profile) for physical Android distribution.
* **`supabase/functions/deno.json`:** Enables `deno.window` compiler library and references standard library import map.

### 3.4 Environment Variables Specification (`.env.example`)

```ini
# ==============================================================================
# MEDSYNC RUNTIME ENVIRONMENT CONFIGURATION
# ==============================================================================

# Supabase API Endpoint URL (Found in Supabase Project Settings -> API)
# Format: https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# Supabase Publishable / Anonymous Key (Safe for client-side embedding with RLS)
# Format: Public API JWT (eyJhbGciOi...) or sb_publishable_* token
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummyAnonymousKeyPayload

# Expo Project ID for Push Notifications (Found in app.json -> extra -> eas -> projectId)
# Format: Standard UUID
EXPO_PUBLIC_EAS_PROJECT_ID=08976e05-387f-4b74-a4bb-f2a1fdc5540b

# ==============================================================================
# SERVERLESS EDGE FUNCTION SECRETS (Set via Supabase CLI, NEVER in client bundle)
# Set using: supabase secrets set OPENAI_API_KEY=sk-proj-...
# ==============================================================================

# OpenAI API Key (Must have access to GPT-4o multimodal vision endpoints)
# Format: sk-proj-...
OPENAI_API_KEY=sk-proj-DummyOpenAiKeyForVisionOcrPipeline00000000000000000000
```

---

## 4. Database Information & Complete Schema

### 4.1 Database Engine & Connection Method
* **DBMS Engine:** PostgreSQL 15.8 (Hosted via Supabase Managed Infrastructure).
* **Connection Protocol:** PostgREST RESTful Data API accessed through `@supabase/supabase-js`.
* **Security Model:** Row Level Security (RLS) policies evaluated on every query against the JSON Web Token (`auth.uid()`).
* **Storage Engine:** S3-compatible Supabase Object Storage bucket named `prescriptions` with public CDN access.

---

### 4.2 Complete Database DDL & Schema Definitions

```sql
-- =============================================================================
-- 1. PROFILES TABLE (Extensions to Supabase auth.users)
-- =============================================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('patient', 'caregiver', 'doctor')),
    full_name TEXT NOT NULL,
    alerts_enabled BOOLEAN DEFAULT TRUE,
    push_token TEXT,
    is_verified_doctor BOOLEAN DEFAULT FALSE,
    blood_group TEXT,
    allergies TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexing for profile role filters and fast lookup
CREATE INDEX idx_profiles_role ON public.profiles(role);


-- =============================================================================
-- 2. MEDICATIONS TABLE (Master Prescription Contract)
-- =============================================================================
CREATE TABLE public.medications (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    time TEXT NOT NULL, -- Formatted as 24-hr 'HH:MM' (e.g. '08:00', '14:30')
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'skipped')),
    description TEXT,
    duration TEXT,
    food_warning TEXT,
    pills_remaining INTEGER DEFAULT 30,
    total_pills INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_medications_patient_active ON public.medications(patient_id, is_active);


-- =============================================================================
-- 3. MEDICATION_LOGS TABLE (Daily Compliance Intake Audit)
-- =============================================================================
CREATE TABLE public.medication_logs (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    medication_id BIGINT NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    log_date DATE NOT NULL, -- Date string 'YYYY-MM-DD'
    scheduled_time TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('taken', 'skipped', 'pending', 'missed')),
    snooze_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Enforces exactly one daily compliance record per medication per calendar day
    CONSTRAINT uq_medication_date UNIQUE (medication_id, log_date)
);

CREATE INDEX idx_logs_patient_date ON public.medication_logs(patient_id, log_date DESC);


-- =============================================================================
-- 4. PENDING_REVIEWS TABLE (AI Extraction Verification Queue)
-- =============================================================================
CREATE TABLE public.pending_reviews (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    medication TEXT NOT NULL,
    dosage TEXT,
    duration TEXT,
    time_ago TEXT DEFAULT 'Just now',
    image_url TEXT NOT NULL,
    doctor_notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_pending_reviews_status ON public.pending_reviews(status);
CREATE INDEX idx_pending_reviews_patient ON public.pending_reviews(patient_id);


-- =============================================================================
-- 5. PATIENT_CAREGIVERS TABLE (Many-to-Many Linking & Pairing)
-- =============================================================================
CREATE TABLE public.patient_caregivers (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    caregiver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    pairing_code TEXT UNIQUE NOT NULL, -- 6-character alphanumeric uppercase code
    override_alerts BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_patient_caregivers_code ON public.patient_caregivers(pairing_code);
CREATE INDEX idx_patient_caregivers_caregiver ON public.patient_caregivers(caregiver_id);


-- =============================================================================
-- 6. PATIENTS TABLE (Legacy Physician Roster Display)
-- =============================================================================
CREATE TABLE public.patients (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    patient_name TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    condition TEXT,
    adherence INTEGER DEFAULT 100,
    doctor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);


-- =============================================================================
-- 7. SECURE VIEWS FOR TARGETED PUSH TOKEN RESOLUTION
-- =============================================================================

-- Resolves push tokens of doctors/caregivers linked to a specific patient
CREATE OR REPLACE VIEW public.doctor_push_tokens AS
SELECT 
    pc.patient_id,
    p.push_token,
    pc.caregiver_id
FROM public.patient_caregivers pc
JOIN public.profiles p ON pc.caregiver_id = p.id
WHERE p.push_token IS NOT NULL;

-- Resolves push tokens of patients linked to a specific doctor
CREATE OR REPLACE VIEW public.patient_push_tokens AS
SELECT 
    pc.caregiver_id,
    p.id AS patient_id,
    p.push_token
FROM public.patient_caregivers pc
JOIN public.profiles p ON pc.patient_id = p.id
WHERE p.push_token IS NOT NULL;
```

---

### 4.3 Row Level Security (RLS) Policies

```sql
-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_caregivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users read own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Caregiver view linked patients profile" ON public.profiles
    FOR SELECT USING (
        id IN (SELECT patient_id FROM public.patient_caregivers WHERE caregiver_id = auth.uid())
    );

CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Medications Policies
CREATE POLICY "Patient read own medications" ON public.medications
    FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Caregiver read linked patient medications" ON public.medications
    FOR SELECT USING (
        patient_id IN (SELECT patient_id FROM public.patient_caregivers WHERE caregiver_id = auth.uid())
    );

CREATE POLICY "Patient modify own medications" ON public.medications
    FOR ALL USING (auth.uid() = patient_id);

CREATE POLICY "Caregiver insert medications on approval" ON public.medications
    FOR INSERT WITH CHECK (
        patient_id IN (SELECT patient_id FROM public.patient_caregivers WHERE caregiver_id = auth.uid())
    );

-- Medication Logs Policies
CREATE POLICY "Patient read own logs" ON public.medication_logs
    FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Caregiver read linked patient logs" ON public.medication_logs
    FOR SELECT USING (
        patient_id IN (SELECT patient_id FROM public.patient_caregivers WHERE caregiver_id = auth.uid())
    );

CREATE POLICY "Patient write own logs" ON public.medication_logs
    FOR ALL USING (auth.uid() = patient_id);

-- Pending Reviews Policies
CREATE POLICY "Patient view own reviews" ON public.pending_reviews
    FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Patient insert reviews" ON public.pending_reviews
    FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Caregiver view and update linked reviews" ON public.pending_reviews
    FOR ALL USING (
        patient_id IN (SELECT patient_id FROM public.patient_caregivers WHERE caregiver_id = auth.uid())
    );

-- Pairing Policies
CREATE POLICY "Patient manage own pairing codes" ON public.patient_caregivers
    FOR ALL USING (auth.uid() = patient_id);

CREATE POLICY "Caregiver view linked or claimable codes" ON public.patient_caregivers
    FOR SELECT USING (caregiver_id IS NULL OR caregiver_id = auth.uid());

CREATE POLICY "Caregiver claim pairing code" ON public.patient_caregivers
    FOR UPDATE USING (caregiver_id IS NULL OR caregiver_id = auth.uid())
    WITH CHECK (caregiver_id = auth.uid());
```

---

### 4.4 Supabase Storage Configuration & Initial Seed Data

* **Bucket Identifier:** `prescriptions`
* **Public Access:** Enabled (`public: true` for CDN retrieval via `getPublicUrl`).
* **Object Path Format:** `prescription_${Date.now()}.jpg`
* **MIME Content Type:** `image/jpeg`
* **Access Policy:** Authenticated users upload objects; public read access enabled for prescription review viewing.

#### Initial Seed Data (Verified from Backup)
```sql
-- Seed Profiles (Assumes auth.users already provisioned)
-- Patient: Sarah Jenkins (UUID: e9b1c70e-450f-488b-a496-6d63493c4481)
-- Doctor: Dr. Robert Chen (UUID: c5a92a18-d762-4f38-9588-4177d61eb199)

-- Seed Medications
INSERT INTO public.medications (id, patient_id, medicine_name, dosage, time, status, pills_remaining, total_pills, is_active, food_warning)
VALUES
(1, 'e9b1c70e-450f-488b-a496-6d63493c4481', 'Metformin', '500mg - 1 Tablet', '08:00', 'pending', 28, 30, true, 'Take after food'),
(2, 'e9b1c70e-450f-488b-a496-6d63493c4481', 'Atorvastatin', '20mg - 1 Tablet', '20:00', 'pending', 29, 30, true, 'Take before bedtime'),
(3, 'e9b1c70e-450f-488b-a496-6d63493c4481', 'Lisinopril', '10mg - 1 Tablet', '12:30', 'pending', 27, 30, true, NULL);

-- Seed Patient Caregiver Pairing
INSERT INTO public.patient_caregivers (id, patient_id, caregiver_id, pairing_code, override_alerts, status)
VALUES
(1, 'e9b1c70e-450f-488b-a496-6d63493c4481', 'c5a92a18-d762-4f38-9588-4177d61eb199', 'MEDSYNC', false, 'active');

-- Seed Caregiver Patient Roster (Legacy)
INSERT INTO public.patients (id, patient_name, patient_id, condition, adherence, doctor_id)
VALUES
(1, 'Sarah Jenkins', 'PT-9021', 'Type 2 Diabetes', 92, 'c5a92a18-d762-4f38-9588-4177d61eb199'),
(2, 'Arthur Pendelton', 'PT-4412', 'Hypertension', 74, 'c5a92a18-d762-4f38-9588-4177d61eb199'),
(3, 'Eleanor Vance', 'PT-8831', 'Arrhythmia', 96, 'c5a92a18-d762-4f38-9588-4177d61eb199');
```

---

## 5. Core Business Logic, API & Data Flow

### 5.1 Authentication, Route Guards & RBAC Lifecycle

#### 1. Session Storage & Adapter Implementation
Supabase Auth uses a custom storage wrapper (`ExpoSecureStoreAdapter`) around `@react-native-async-storage/async-storage`. Because React Native does not implement a DOM `window` object, `detectSessionInUrl: false` is hard-configured on client creation to prevent runtime crashes during OAuth or deep-link parsing.

#### 2. Root Routing Gatekeeper Matrix
Route protection is enforced inside `src/app/_layout.tsx` and `src/app/(tabs)/index.tsx`:

| Authentication State | Profile State | Current Route Segment | Destination (Action) |
| :--- | :--- | :--- | :--- |
| **Unauthenticated** (`session == null`) | N/A | Not `login` | `router.replace('/login')` |
| **Unauthenticated** (`session == null`) | N/A | `login` | Render Login Screen |
| **Authenticated** (`session != null`) | `profile == null` (PGRST116) | Not `profile-setup` | `router.replace('/profile-setup')` |
| **Authenticated** (`session != null`) | `profile.role == 'patient'` | In `login` or `profile-setup` | `router.replace('/(tabs)/patient-dashboard')` |
| **Authenticated** (`session != null`) | `profile.role in ['caregiver', 'doctor']` | In `login` or `profile-setup` | `router.replace('/(tabs)/caregiver-dashboard')` |
| **Authenticated** (Tab Root) | `profile.role == 'patient'` | `(tabs)/index` | `<Redirect href="/(tabs)/patient-dashboard" />` |
| **Authenticated** (Tab Root) | `profile.role in ['caregiver', 'doctor']` | `(tabs)/index` | `<Redirect href="/(tabs)/caregiver-dashboard" />` |

*Note:* All programmatic transitions use `router.replace()` rather than `router.push()` to prevent the back button from stacking previous authenticated states.

---

### 5.2 API & Edge Function Catalog

#### 1. Prescription Vision OCR Edge Function
* **Path / Trigger:** `supabase.functions.invoke('scan-prescription')` $\rightarrow$ `POST /functions/v1/scan-prescription`
* **Authentication Requirement:** Supabase Anon Key with Bearer Token (Authenticated user).
* **Request Payload Schema:**
  ```json
  {
    "base64Image": "<raw_base64_jpeg_string_without_data_prefix>"
  }
  ```
* **Step-by-Step Server Execution Logic:**
  1. Handles HTTP `OPTIONS` preflight request and returns standard CORS headers (`Access-Control-Allow-Origin: *`).
  2. Parses JSON body and validates that `base64Image` is non-empty; returns HTTP 400 if missing.
  3. Retrieves `OPENAI_API_KEY` from Deno environment; returns HTTP 500 if unset.
  4. Dispatches an HTTPS POST request to `https://api.openai.com/v1/chat/completions`:
     * Model: `gpt-4o`
     * Response Format: `{ type: "json_object" }`
     * System Prompt: *"You are an expert pharmacist AI. Read the prescription image. Extract the Medicine Name, Dosage Instructions, and Duration. Respond ONLY in JSON format like: {\"medicine_name\": \"...\", \"dosage\": \"...\", \"duration\": \"...\"}"*
     * User Payload: Array containing text instruction and data URL: `data:image/jpeg;base64,${base64Image}`.
  5. Parses OpenAI JSON response. If upstream returns non-200, returns HTTP 502 with error details.
  6. Sanitizes output, applying fallbacks (`'Unknown Medicine'`, `'See prescription'`, `'Not specified'`), and returns HTTP 200.
* **Response Payload Schema:**
  ```json
  {
    "medicine_name": "Metformin HCL",
    "dosage": "500mg - 1 Tablet with meals",
    "duration": "30 days"
  }
  ```

#### 2. Cross-Device Push Dispatch API
* **Endpoint:** `POST https://exp.host/--/api/v2/push/send`
* **Authentication:** Public Expo Push Ingestion (delegated to Firebase FCM v1 credentials).
* **Payload Structure:**
  ```json
  {
    "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "title": "📋 New Prescription Review",
    "body": "Sarah Jenkins just uploaded a prescription for Metformin HCL.",
    "sound": "default",
    "priority": "high"
  }
  ```
* **Execution Points:**
  * Dispatched by `uploads.tsx` upon prescription upload (targeted at linked caregiver).
  * Dispatched by `review-details.tsx` upon physician approval (targeted at patient).

---

### 5.3 Hardware Engine: Local Alarms & Background Notification Categories

MedSync implements an exact native notification alarm cycle:

```
[Fetch Active Medications: is_active = true]
                 │
                 ▼
[Wipe Scheduled Alarms: cancelAllScheduledNotificationsAsync()]
                 │
                 ▼
[Configure Android Notification Channel: 'medication-alarms-auto']
                 │  - Importance: Notifications.AndroidImportance.HIGH
                 │  - Vibration Pattern: [0, 250, 250, 250]
                 │
                 ▼
[Iterate Medications: Compute getNextDateForTime(med.time)]
                 │
                 ▼
[Schedule Notification: SchedulableTriggerInputTypes.DATE]
                 │  - CategoryIdentifier: 'medication-alerts'
                 │  - Metadata Payload: { medicationId: med.id }
                 │
                 ▼
        [Alarm Triggers on Native OS Banner]
        ┌────────────────────────────────────────────────────────┐
        │  🚨 MEDICATION ALERT: Metformin (500mg)                │
        ├──────────────────────────┬─────────────────────────────┤
        │  [ Button: "I Took It" ] │  [ Button: "Snooze 20m" ]   │
        └──────────────────────────┴─────────────────────────────┘
```

#### Notification Background Categories
Declared in `src/app/_layout.tsx`:
1. **Identifier `'MARK_TAKEN'` ("I Took It"):**
   * Configured with `opensAppToForeground: false` so it executes in the background without launching the UI.
   * Resolves active user session via `supabase.auth.getSession()`.
   * Queries medication record for current `pills_remaining`.
   * Upserts into `medication_logs` with `status: 'taken'`, `log_date: today`, `scheduled_time: med.time`.
   * Decrements `pills_remaining` (`Math.max(0, count - 1)`).
   * Dismisses notification banner via `Notifications.dismissNotificationAsync()`.
2. **Identifier `'SNOOZE'` ("Snooze 20m"):**
   * Configured with `opensAppToForeground: false`.
   * Computes `Date.now() + 20 minutes`.
   * Schedules a new high-priority notification with identical category and medication payload.
   * Dismisses previous notification banner.

---

### 5.4 Adherence Calculation & 30-Day Lookback Algorithm

Calculated reactively inside `src/app/medication-history.tsx`:
1. **Adherence Score:**
   $$\text{Adherence Rate} = \text{round}\left(\frac{\text{Taken Logs}}{\text{Total Scheduled Logs}} \times 100\right)$$
   * Displays Green for $\ge 80\%$, Amber for $50\%–79\%$, Red for $< 50\%$.
2. **Daily Streak Algorithm:**
   * Groups compliance logs by ISO date string (`YYYY-MM-DD`).
   * Iterates backwards from `today` through the preceding 30 days ($i = 0 \to 29$).
   * For index $i = 0$ (Today): If no logs exist yet, the streak is not broken (intakes may be pending later in the day).
   * For index $i \ge 1$: If every log recorded for that date has `status === 'taken'`, increments `streak` counter by 1.
   * Breaks the loop on the first date containing any dose that was `'skipped'`, `'missed'`, or `'pending'`.

---

## 6. Project Progress & Implementation Status

### 6.1 Completed Features (100% Functional & Verified)

* **Authentication & Session Lifecycle:** Complete email/password authentication and account registration with Supabase Auth, persistent session storage in AsyncStorage, and global reactive state via `AuthProvider`.
* **Onboarding & Profile Initialization:** New user onboarding screen (`profile-setup.tsx`) capturing formal name and persona role (`patient` or `caregiver`).
* **Root Navigation & Security Guarding:** Route guards in `src/app/_layout.tsx` and `src/app/(tabs)/index.tsx` routing users based on session and role.
* **Daily Medication Timeline:** Chronological schedule rendering in `patient-dashboard.tsx` grouped into Morning, Afternoon, Evening, and Night.
* **4-Second Reversible Intake Confirmation:** "I TOOK IT" button with a 4-second animated Undo toast window.
* **Native Alarms & Interactive Action Buttons:** Background notification scheduling via `expo-notifications`, custom Android channel `'medication-alarms-auto'`, and background interactive buttons (`MARK_TAKEN`, `SNOOZE`).
* **Prescription Vision Ingestion Pipeline:** Camera and gallery image capture in `uploads.tsx`, binary upload to Supabase Storage bucket `prescriptions`, Deno Edge Function proxy (`scan-prescription`) calling OpenAI GPT-4o, and doctor push notifications.
* **Clinical Verification & Atomic Approval:** Physician review screen (`review-details.tsx`) with image viewer, correction modal, atomic approval rollback, and push notification alerts to the patient.
* **Patient-Caregiver Pairing & Overrides:** Patient-side 6-character uppercase pairing code generation in `settings.tsx` and caregiver code claiming in `caregiver-dashboard.tsx`. Supports global alert muting with per-patient overrides.
* **Missed Dose Surveillance:** Caregiver dashboard alerts that flag any patient who misses 2 or more doses prior to the current day.
* **Medication Management & IDOR Hardening:** `medication-details.tsx` supports 24-hr time edits, pausing (`is_active: false`), hard deletion, and Google Shopping ordering links, all scoped to `patient_id: session.user.id`.
* **Manual Medication Creation:** Floating action button (FAB) on patient dashboard opening a creation modal for manual entry.
* **Accessibility & Multi-Sensory Feedback:** `AccessibilityContext` supports high-contrast cards, scaled typography, tactile vibration feedback via `expo-haptics`, and speech synthesis via `expo-speech`.
* **Clinical PDF Health Report Export:** Headless HTML compilation via `expo-print` generating formatted 30-day compliance logs and native sharing via `expo-sharing`.
* **Searchable Patient Directory & Clinical View:** `patient-directory.tsx` with search filtering and `patient-details.tsx` showing blood group, allergies, and active medications.

---

### 6.2 In-Progress, Partially Implemented & Architectural Quirks

1. **Client-Side Credential Fallbacks in `src/lib/supabase.ts`:**
   * *Status:* The Supabase URL and Anonymous Key are hardcoded as fallback constants rather than being read exclusively from `process.env.EXPO_PUBLIC_SUPABASE_URL` and `process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   * *Impact:* Works in local dev, but should be converted to pure environment variables for production security.
2. **Dual-Model Patient Representation (`patients` table vs `patient_caregivers` join):**
   * *Status:* In `caregiver-dashboard.tsx`, the dashboard queries a table named `patients` by `doctor_id`, whereas `patient-directory.tsx` and `patient-details.tsx` query `patient_caregivers` joined with `profiles`.
   * *Remediation:* Standardize the caregiver dashboard to query exclusively through the `patient_caregivers` join table.
3. **Legacy Navigation Artifacts:**
   * *Status:* Files `App.js`, `src/navigation/AppNavigator.js`, and `src/screens/RoleSelectionScreen.js` exist from an early React Navigation prototype.
   * *Impact:* Completely bypassed by `expo-router/entry`, but creates confusion for maintainers. They can be safely deleted.
4. **Starter Template Diagnostic Components:**
   * *Status:* Files in `src/components/` (`app-tabs.tsx`, `animated-icon.tsx`, `themed-text.tsx`, `themed-view.tsx`, `hint-row.tsx`, `web-badge.tsx`) and `src/app/explore.tsx` are leftovers from the Expo template.

---

### 6.3 Pending / Not Started (Production Roadmap)
* **Real-time Supabase WebSockets:** Transition dashboard queries from pull-to-refresh / `useFocusEffect` to real-time Postgres changes (`supabase.channel('public:medication_logs')`).
* **Automated Cron Surveillance Worker:** Set up a scheduled Supabase cron (`pg_cron`) or scheduled Edge Function to detect missed doses automatically, rather than relying on the caregiver opening their dashboard to trigger `checkMissedDoses()`.
* **Automated Pill Re-Order Integrations:** Replace Google Shopping links with direct pharmacy API integrations.

---

### 6.4 Known Bugs, Edge Cases & Technical Debt

1. **Simulator Push Notification Limitation:** Physical device hardware is required for push token generation. Simulators return early via `Device.isDevice` checks in `authcontext.tsx`.
2. **Midnight Date Rollover on Alarms:** `scheduleAllAlarms` calculates next alarm dates based on `getNextDateForTime`. If a user opens the app at 23:55, morning alarms are scheduled for the next day, which is correct, but daily logs depend on the local clock string `YYYY-MM-DD`. Cross-midnight dose logging relies on device clock synchronization.
3. **Denormalized `patient_name` in `pending_reviews`:** If a patient updates their full name in `profiles`, historical records in `pending_reviews` retain the original name string from upload time.

---

## 7. Step-by-Step Reconstruction Sequence

This deterministic recipe allows an independent AI agent to recreate this project from an empty workspace:

### Step 1: Project Initialization & Directory Scaffolding
Run in shell:
```bash
# 1. Initialize Expo SDK 57 template
npx -y create-expo-app@latest ./ --template blank-typescript

# 2. Create directory architecture
mkdir -p assets/fonts assets/images/tabIcons
mkdir -p src/app/\(tabs\) src/components/ui src/constants src/context src/hooks src/lib src/theme src/types
mkdir -p supabase/functions/scan-prescription
```

### Step 2: Dependency Installation
Install exact package versions:
```bash
npx expo install \
  @expo/ui@~57.0.14 \
  @expo/vector-icons@^15.0.2 \
  @react-native-async-storage/async-storage@2.2.0 \
  @react-navigation/native@^7.3.18 \
  @react-navigation/native-stack@^7.18.10 \
  @supabase/supabase-js@^2.112.4 \
  base64-arraybuffer@^1.0.2 \
  expo@~57.0.18 \
  expo-application@~57.0.2 \
  expo-constants@~57.0.16 \
  expo-dev-client@~57.0.16 \
  expo-device@~57.0.1 \
  expo-file-system@~57.0.6 \
  expo-font@~57.0.2 \
  expo-glass-effect@~57.0.1 \
  expo-haptics@~57.0.2 \
  expo-image@~57.0.3 \
  expo-image-picker@~57.0.14 \
  expo-intent-launcher@~57.0.1 \
  expo-linking@~57.0.8 \
  expo-notifications@~57.0.15 \
  expo-print@~57.0.1 \
  expo-router@~57.0.17 \
  expo-secure-store@~57.0.2 \
  expo-sharing@~57.0.18 \
  expo-speech@~57.0.2 \
  expo-splash-screen@~57.0.8 \
  expo-status-bar@~57.0.1 \
  expo-symbols@~57.0.2 \
  expo-system-ui@~57.0.3 \
  expo-web-browser@~57.0.2 \
  react@19.2.3 \
  react-dom@19.2.3 \
  react-native@0.86.3 \
  react-native-gesture-handler@~2.32.0 \
  react-native-reanimated@4.5.1 \
  react-native-safe-area-context@~5.7.0 \
  react-native-screens@~4.26.0 \
  react-native-url-polyfill@^4.0.0 \
  react-native-web@~0.21.0 \
  react-native-worklets@0.10.1

npm install -D typescript@~6.0.3 @types/react@~19.2.2
```

### Step 3: Configuration Files Setup
1. **`tsconfig.json`:** Paste compiler configuration with path mappings (`@/*` $\to$ `./src/*`) and exclude `supabase/functions`.
2. **`app.json`:** Configure bundle identifier `com.medsync.app`, scheme `medsync`, EAS project ID, `SCHEDULE_EXACT_ALARM` permissions, and plugins (`expo-router`, `expo-sharing`, `expo-splash-screen`, `expo-notifications`).
3. **`google-services.json`:** Add Firebase client configuration to project root.
4. **`eas.json`:** Create APK preview and AAB production profiles.
5. **`.env`:** Create environment file defining `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

### Step 4: Database & Cloud Infrastructure Setup
1. **PostgreSQL Schema:** In Supabase SQL Editor, execute the complete DDL script from Section 4.2:
   * Tables: `profiles`, `medications`, `medication_logs`, `pending_reviews`, `patient_caregivers`, `patients`.
   * Views: `doctor_push_tokens`, `patient_push_tokens`.
   * Row Level Security: Execute policies from Section 4.3.
2. **Storage Bucket:**
   * Create bucket `prescriptions` with public read access enabled.
3. **Edge Function Deployment:**
   * In `supabase/functions/scan-prescription/index.ts`, place the Deno Edge Function code.
   * Deploy via Supabase CLI:
     ```bash
     supabase secrets set OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
     supabase functions deploy scan-prescription
     ```

### Step 5: Core Utilities, Types & State Implementation
Create code files in this exact order:
1. **Types:** `src/types/medication.ts`, `src/types/review.ts`.
2. **Design System:** `src/theme/index.ts` (Material Design 3 tokens, colors, typography, spacing).
3. **Constants:** `src/constants/theme.ts`.
4. **Font Assets:** Place `PublicSans-Regular.ttf`, `Medium.ttf`, `Bold.ttf`, `ExtraBold.ttf` in `assets/fonts/`.
5. **Supabase Client:** `src/lib/supabase.ts` (with `ExpoSecureStoreAdapter` and `detectSessionInUrl: false`).
6. **Context Providers:**
   * `src/context/AccessibilityContext.tsx` (Haptics, speech, contrast state).
   * `src/context/authcontext.tsx` (Supabase auth session, profile fetch, push notification token registration).

### Step 6: Navigation & Screen Implementation Order
1. **Root Navigation:** `src/app/_layout.tsx` (font preloader, background action listeners `'MARK_TAKEN'` / `'SNOOZE'`, auth routing matrix).
2. **Root Redirect:** `src/app/index.tsx` (redirects to `/login`).
3. **Authentication:** `src/app/login.tsx` (email sign-in / sign-up).
4. **Onboarding:** `src/app/profile-setup.tsx` (name entry and role selection).
5. **Tab Group Configuration:**
   * `src/app/(tabs)/_layout.tsx` (tab bar styles, screen registration).
   * `src/app/(tabs)/index.tsx` (role-aware redirector).
6. **Patient Screens:**
   * `src/app/(tabs)/patient-dashboard.tsx` (timeline, alarms, undo toast, snooze, TTS, manual add modal).
   * `src/app/medication-details.tsx` (details, time edits, pause, delete, ordering).
   * `src/app/medication-history.tsx` (adherence score, streaks, timeline).
7. **Caregiver & Clinical Screens:**
   * `src/app/(tabs)/caregiver-dashboard.tsx` (pending reviews, missed dose surveillance, pairing modal).
   * `src/app/patient-directory.tsx` (searchable patient roster).
   * `src/app/patient-details.tsx` (clinical records, blood group, allergies).
   * `src/app/review-details.tsx` (prescription review, correction modal, atomic approval).
8. **Prescription Ingestion:** `src/app/(tabs)/uploads.tsx` (camera/gallery picker, S3 upload, Edge Function trigger, doctor push alert).
9. **Settings & Export:** `src/app/settings.tsx` (profile info, PDF export, pairing code generator, alarm channel intent, logout).
10. **Supporting Views:** `src/app/role-selection.tsx`.

### Step 7: Build, Test & Run Commands

```bash
# 1. Verify TypeScript types compile cleanly
npx tsc --noEmit

# 2. Start local Expo development server
npx expo start

# 3. Start development server clearing bundler cache
npx expo start -c

# 4. Run directly on connected Android device / emulator
npx expo run:android

# 5. Build standalone internal test APK via EAS Cloud
eas build --profile preview --platform android

# 6. Build production Android App Bundle (AAB) for Google Play Store
eas build --profile production --platform android
```

---
*Blueprint verified against local workspace commit history, PostgreSQL CSV schema dumps, and clean TypeScript compilation.*