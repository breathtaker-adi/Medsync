# MedSync Public Claims & Architecture Verification Ledger (CLAIMS.md)

This living ledger cross-references every public architectural, clinical, and data privacy statement made on the MedSync website, README, documentation, and app store listings directly to the code, database migrations, or automated tests that enforce and prove it.

---

## 1. Data Privacy & Legal Compliance

| Public Statement | Actual Architecture | Enforcement & Verification Source | Test / Proof |
| :--- | :--- | :--- | :--- |
| **"Aligned with India's DPDP Act 2023"** | Designed around principles of notice, explicit consent, storage limitation, purpose limitation, and data fiduciary duties. No bogus "certifications" claimed. | `website/src/app/privacy/page.tsx`<br>`src/app/settings.tsx` | Sections 4, 6, 8, and 12 of DPDP Act 2023 aligned. Personal data breach response governed by `docs/BREACH.md`. |
| **"Right to Erasure (DPDP Act Sec 12)"** | Complete cascading deletion of user profile, doses, prescriptions, adherence logs, caregiver linkages, and prescription photos via `delete_user_account` RPC and storage queue. | `supabase/migrations/20261025_scan_retention_and_cleanup.sql`<br>`src/app/settings.tsx` | Verified via cascading foreign keys (`ON DELETE CASCADE`) and storage deletion queue. |
| **"Zero Ad Brokers & Analytics Trackers"** | No advertising SDKs, tracking pixels, Facebook SDK, Google Analytics, or third-party behavioral brokers are bundled. | `package.json`<br>`app.json`<br>`website/package.json` | Inspection of npm dependency trees confirms zero tracking libraries. |
| **"Encrypted in Transit with TLS 1.3"** | All network traffic between client mobile app, web dashboard, and Supabase / AI edge functions strictly uses HTTPS with TLS 1.3. | `src/lib/supabase.ts`<br>`website/src/lib/events.ts` | HTTPS protocol enforcement; no insecure plaintext HTTP endpoints. |
| **"Hardware Keystore Authentication"** | User session tokens, refresh tokens, and device identification hashes are stored in encrypted hardware keystores (Android Keystore / iOS Keychain). | `src/lib/supabase.ts`<br>`app.json` (`expo-secure-store`) | `expo-secure-store` implementation with `requireAuthentication` safeguards. |

---

## 2. Authorized Third-Party Sub-Processors

| Processor | Purpose & Processing Scope | Location & Sovereign Safeguard | Source Code Reference |
| :--- | :--- | :--- | :--- |
| **Supabase Inc.** | Hosted PostgreSQL database, Row-Level Security, user authentication, and secure prescription image bucket. | Cloud Database (Dedicated AWS/GCP region) | `supabase/migrations/`<br>`src/lib/supabase.ts` |
| **Google LLC (Gemini AI Vision API)** | Multi-modal OCR extraction of medication name, strength, dosage form, and scheduling cadence from scanned prescription photos. | United States / Global Cloud Infrastructure; zero retention under enterprise API terms; ephemeral in-memory processing only | `supabase/functions/scan-prescription/` |
| **Google Firebase (FCM)** | Remote push notifications for missed-dose caregiver alerts and critical adherence reminders. | Global FCM Push Relay (`google-services.json`) | `app.json`<br>`src/lib/notifications.ts` |
| **Expo (650 Industries)** | Application build pipeline and over-the-air native update distribution. | EAS Build Service (United States) | `eas.json`<br>`app.config.js` |

---

## 3. Clinical Safety & The Doctor Care Loop

| Public Statement | Actual Architecture | Enforcement & Verification Source | Test / Proof |
| :--- | :--- | :--- | :--- |
| **"AI Never Modifies Dosages Unsupervised"** | OCR extraction outputs a draft schedule with `status: 'pending_review'`. Regimens do not enter active status until verified by user or licensed physician. | `supabase/functions/scan-prescription/index.ts`<br>`src/app/review-details.tsx` | Schema default `status = 'pending'` on table `prescriptions`. |
| **"Doctor Verification Loop"** | Clinicians review pending prescriptions before schedule activation. Doctor badges require manual registry verification. | `src/app/doctor-verification.tsx`<br>`supabase/migrations/20261023_complete_security_hardening.sql` | `protect_profile_fields` trigger prevents self-granting `is_verified_doctor`. |
| **"Medical Disclaimer Enforced"** | Prominent warnings informing users that MedSync is an adherence reminder aid and not a diagnostic device. | `README.md`<br>`website/src/app/privacy/page.tsx`<br>`src/app/(tabs)/patient-dashboard.tsx` | Explicit disclaimer modals shown prior to prescription scanning. |

---

## 4. Caregiver Escalation & Telemetry

| Public Statement | Actual Architecture | Enforcement & Verification Source | Test / Proof |
| :--- | :--- | :--- | :--- |
| **"Caregiver Escalation Window"** | Escalation triggers after a 60-minute grace window following a scheduled dose. | `supabase/functions/check-missed-doses/index.ts`<br>`website/src/components/bento/caregiver-sync-card.tsx` | Edge function queries pending doses where `scheduled_time < currentTime` and logs past today. |
| **"Active Pairing Requirement"** | Caregivers can only receive telemetry and notifications for patients who explicitly paired via temporary pairing codes. | `supabase/migrations/20261024_vibe_check_security_hardening.sql` | RLS policy requires `caregiver_links.status = 'active'` and `expires_at > now()`. |
| **"Interactive Website Telemetry"** | Bento card and console telemetry feeds on the marketing site are simulations with clear `[SAMPLE DEMO]` labels. | `website/src/components/bento/`<br>`website/src/components/console/terminal.tsx` | Labeled as `SAMPLE SIMULATION` / `SAMPLE EXTRACTION` to ensure no deception. |

---

## 5. Security Architecture & Test Verification

| Defense Layer | Implementation Detail | Source File | Test Verification |
| :--- | :--- | :--- | :--- |
| **Client / Static Invariant Tests (Tier 1)** | 67 fast unit tests validating HTML sanitization, token chunking, pairing code expiry, input validation, and static security rules. | `tests/*.test.ts` | Run with `npm test` (67 passing in 171ms) |
| **Multi-User PostgreSQL RLS (Tier 2)** | Live two-user pgTAP test suite validating real PostgreSQL tenant isolation, IDOR prevention, and privilege escalation blocks. | `supabase/tests/database_rls.test.sql` | Run with `supabase test db` (pgTAP suite) |
| **Privilege Escalation Protection** | `protect_profile_fields` trigger blocks updates to `is_verified_doctor` and `role` from non-service-role clients. | `supabase/migrations/20261023_complete_security_hardening.sql` | `tests/profile-escalation.test.ts` & pgTAP Test 4 |
| **Dose Ownership Integrity** | `take_dose` RPC verifies `patient_id = auth.uid()` before logging adherence timestamps. | `supabase/migrations/20261024_vibe_check_security_hardening.sql` | `tests/dose-logging.test.ts` |
| **OCR Quota & Abuse Prevention** | Rate limits prevent runaway AI edge function calls per user per calendar day. | `supabase/migrations/20261024_vibe_check_security_hardening.sql` | `tests/ocr-quota.test.ts` |
| **90-Day Scan Retention** | Automated cleanup of temporary scans older than 90 days and physical file deletion queue. | `supabase/migrations/20261025_scan_retention_and_cleanup.sql` | `cleanup_expired_scans()` RPC |

---

## 6. Verification Protocol

Before every release and every public documentation edit:
1. Cross-reference all marketing and landing page claims against this table.
2. Run `npm test` and verify that all 67 client/domain invariant tests pass.
3. Verify that SHA-256 release checksums and signing certificate fingerprints in `docs/checksums.txt` match built artifacts.
4. Verify that no private or developer-only directories (`.vscode/`, `security/`, `.env`) are committed to version control.
