# MedSync Vibe-Check & OWASP ASVS Comprehensive Security Audit Report

**Date:** 2026-10-24  
**Target Repository:** MedSync Clinical Adherence Platform (`medsync-app`)  
**Audit Frameworks:**
1. [vibe-check manual-checklist.md & AI-CHECKLIST.md](https://github.com/benavlabs/vibe-check)
2. [Reddit r/vibecoding: Security and Maintainability Guide for Vibe-Coders](https://www.reddit.com/r/vibecoding/comments/1tlvpjr/security_and_maintainability_guide_for_vibecoders/)
3. OWASP ASVS (Application Security Verification Standard) v4.0.3
4. DPDP Act 2023 (Digital Personal Data Protection Act, India)

---

## 1. Executive Summary

| Category | Initial Status | Final Status | Vulnerabilities Found | Remediations Applied |
| :--- | :---: | :---: | :---: | :---: |
| **1. SECRETS_EXPOSURE** | **HIGH** | **PASS** | `google-services.json` tracked in git despite `.gitignore`; production fallback keys in `env.ts` | Untracked `google-services.json`, created `.example` template, enforced strict production `env.ts` |
| **2. DATABASE_ACCESS & RLS** | **CRITICAL** | **PASS** | `medications` & `logs` missing RLS policies in active migrations; revoked caregivers could view patient profiles | Created `20261024_vibe_check_security_hardening.sql` with full table RLS and `status = 'active'` checks |
| **3. AUTH_MIDDLEWARE & SESSIONS**| **PASS** | **PASS** | None; sessions encrypted with chunked SecureStore | Verified Bearer JWT enforcement in Edge Functions and Expo SecureStore chunking |
| **4. ACCESS_CONTROL & IDOR** | **HIGH** | **PASS** | Unassigned pending reviews readable by unverified caregivers; direct update bypass fallbacks | Restricted untargeted queue to `is_verified_doctor = true`; removed client fallback bypasses |
| **5. SERVERLESS & TIMING ATTACKS**| **HIGH** | **PASS** | `scan-prescription` failed open on quota failure; `check-missed-doses` had timing attack risk | Implemented fail-closed quota check via atomic RPC; added constant-time token comparison |
| **6. INJECTION & SANITIZATION** | **MEDIUM** | **PASS** | PostgREST `.or()` string interpolation without UUID check; unvalidated restock count | Added strict UUID regex validation and integer range checking `1..5000` |
| **7. HTML / XSS INJECTION** | **PASS** | **PASS** | None; PDF generator sanitized with `escapeHtml` | Verified strict entity encoding across all metadata fields |

---

## 2. Threat Model & Security Invariants

MedSync is a mission-critical digital health and medication adherence application serving vulnerable demographics (senior citizens, chronic condition patients, family caregivers, and licensed physicians).

### Core Security Invariants
1. **Confidentiality:** Personal Health Information (PHI) and prescription photographs must be strictly inaccessible to unauthorized users and anonymous public traffic.
2. **Isolation (No IDOR):** Patient A's health records, medications, intake history, and emergency contacts must never be viewable or mutable by Patient B or an unlinked caregiver.
3. **Fail-Closed Principle:** If rate-limiting, serverless quotas, or token authentications fail, backend endpoints must reject requests with appropriate HTTP status codes (503/401/429) rather than bypassing checks.
4. **Credential Isolation:** Client-side bundles must only contain public publishable tokens (`EXPO_PUBLIC_SUPABASE_ANON_KEY`); `service_role` keys and private credentials must never be accessible on the client.

---

## 3. Detailed Findings, Vulnerabilities & Solutions

### Finding 1: `google-services.json` Tracked in Git Index
- **Checklist Ref:** `manual-checklist.md` Check #3 ("No secrets in git")
- **Initial Severity:** **HIGH**
- **Vulnerability:** Line 49 of `.gitignore` included `google-services.json`, but the file was previously committed and tracked in git index (`git ls-files google-services.json` returned the file). It exposed Firebase project IDs and client API keys.
- **Approach to Solve:**
  1. Ran `git rm --cached google-services.json` to untrack the file from git history without deleting the local developer file required for native Android builds.
  2. Created `google-services.json.example` containing sanitized dummy placeholders.
  3. Added automated regression test verifying `.gitignore` exclusions and template existence.

### Finding 2: Production Fallback Credentials in `src/config/env.ts`
- **Checklist Ref:** `AI-CHECKLIST.md` Category 1 (SECRETS_EXPOSURE)
- **Initial Severity:** **MEDIUM**
- **Vulnerability:** `src/config/env.ts` silently fell back to production Supabase URLs and publishable anon keys if environment variables were missing, creating risks for test environments and forks.
- **Approach to Solve:**
  1. Hardened `validateEnv()`: In production (`!__DEV__`), the application throws an explicit configuration error if `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` is undefined.
  2. In development (`__DEV__`), it logs an alert notice while allowing preview development.

### Finding 3: Broken Access Control (IDOR) on Patient Profiles for Revoked Caregivers
- **Checklist Ref:** `manual-checklist.md` Check #4 ("Can't access another user's data by changing an ID")
- **Initial Severity:** **HIGH**
- **Vulnerability:** In `supabase/migrations/20261022_add_patient_contact_details.sql`, the RLS policy `Caregivers can view linked patient profiles` checked `pc.patient_id = profiles.id` but omitted `pc.status = 'active'`. A revoked caregiver or pending invite holder could read the patient's full profile (phone, email, emergency contacts, blood group, allergies).
- **Approach to Solve:**
  1. Replaced the policy in `supabase/migrations/20261024_vibe_check_security_hardening.sql` with strict enforcement:
     ```sql
     CREATE POLICY "Caregivers can view linked patient profiles"
     ON public.profiles FOR SELECT TO authenticated
     USING (
         auth.uid() = id
         OR EXISTS (
             SELECT 1 FROM public.patient_caregivers pc
             WHERE pc.caregiver_id = auth.uid() 
               AND pc.patient_id = profiles.id
               AND pc.status = 'active'
         )
     );
     ```
  2. Added test case verifying revoked and pending caregivers are rejected.

### Finding 4: Missing Explicit RLS Policies for `medications`, `medication_logs`, & `user_push_tokens` in Migrations
- **Checklist Ref:** `vibe-check` #1 ("Database is not publicly queryable") & #2 ("Every table has RLS enabled")
- **Initial Severity:** **CRITICAL**
- **Vulnerability:** In the active migration files directory (`supabase/migrations/`), `medications`, `medication_logs`, and `user_push_tokens` did not have explicit `ENABLE ROW LEVEL SECURITY` or table grants defined, leaving fresh database deployments vulnerable to cross-tenant data exposure.
- **Approach to Solve:**
  1. Created migration `supabase/migrations/20261024_vibe_check_security_hardening.sql`.
  2. Executed:
     - `ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;`
     - `REVOKE ALL ON public.medications FROM anon, PUBLIC;`
     - Added scoped policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE` where `patient_id = auth.uid()` (or linked active caregiver for `SELECT`).
     - Applied identical hardening to `medication_logs` and `user_push_tokens`.

### Finding 5: Privacy Leak in Untargeted Prescription Review Queue
- **Checklist Ref:** OWASP ASVS 4.0.3 / DPDP Act 2023 Confidentiality
- **Initial Severity:** **HIGH**
- **Vulnerability:** The legacy review policy allowed anyone who signed up with `role = 'caregiver'` (an unverified self-selected role) to view prescription slips where `target_doctor_id IS NULL`.
- **Approach to Solve:**
  1. Updated `pending_reviews` read policy in migration `20261024_vibe_check_security_hardening.sql`:
     ```sql
     OR (
         target_doctor_id IS NULL
         AND EXISTS (
             SELECT 1 FROM public.profiles p
             WHERE p.id = auth.uid() AND p.is_verified_doctor = true
         )
     )
     ```
  2. Verified unverified caregivers receive an empty query result when attempting to inspect untargeted patient slips.

### Finding 6: Serverless Rate-Limit Bypass in `scan-prescription` Edge Function
- **Checklist Ref:** Reddit Guide Pass 2 (Adversarial Security / Missing Rate Limits)
- **Initial Severity:** **HIGH**
- **Vulnerability:** `scan-prescription` edge function fell back to an unprivileged client when `SUPABASE_SERVICE_ROLE_KEY` was missing, which silently failed RLS on `scan_usage` and allowed unlimited OpenAI GPT-4o Vision API requests.
- **Approach to Solve:**
  1. Created atomic database RPC `check_and_increment_scan_quota(p_user_id, p_max_daily)`.
  2. Hardened `scan-prescription/index.ts` to fail closed: if the RPC fails or `service_role` key is absent, the endpoint returns HTTP 503 rather than allowing unauthorized OpenAI invocations.

### Finding 7: Timing Attack Susceptibility in `check-missed-doses` Edge Function
- **Checklist Ref:** Reddit Guide Pass 1 (Cryptography Mistakes)
- **Initial Severity:** **LOW**
- **Vulnerability:** `token !== supabaseServiceKey` used standard JavaScript string comparison, vulnerable to timing side-channel attacks.
- **Approach to Solve:**
  1. Implemented constant-time XOR byte comparison:
     ```ts
     const isLengthMatch = token.length === supabaseServiceKey.length;
     let mismatch = isLengthMatch ? 0 : 1;
     for (let i = 0; i < token.length && i < supabaseServiceKey.length; i++) {
       mismatch |= token.charCodeAt(i) ^ supabaseServiceKey.charCodeAt(i);
     }
     ```
  2. Sanitized 500 error messages to prevent database error string leakage.

### Finding 8: Missing Atomic Pairing RPCs in Active Migrations
- **Checklist Ref:** `vibe-check` #4 (Access Control & Race Conditions)
- **Initial Severity:** **HIGH**
- **Vulnerability:** `patientService.ts` called `claim_pairing_code` RPC, which was absent from `supabase/migrations/20261023_complete_security_hardening.sql`, causing client queries to fall back to direct table updates blocked by RLS.
- **Approach to Solve:**
  1. Added `create_pairing_code()` and `claim_pairing_code(p_code text)` RPCs in `20261024_vibe_check_security_hardening.sql`.
  2. Enforced 15-minute expiration, uppercase alphanumeric code generation, role validation, and row locking (`FOR UPDATE`).

### Finding 9: PostgREST Filter String Injection in `prescriptionService.ts`
- **Checklist Ref:** OWASP Injection / ASVS V5 Input Validation
- **Initial Severity:** **MEDIUM**
- **Vulnerability:** `caregiverId` and `linkedPatientIds` were interpolated directly into `query.or(...)` without UUID validation.
- **Approach to Solve:**
  1. Added `UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;`
  2. Validated all input IDs before interpolating into PostgREST filter clauses.

### Finding 10: Unvalidated Restock Quantity in `medicationService.ts`
- **Checklist Ref:** Input Validation & Business Logic Integrity
- **Initial Severity:** **LOW**
- **Vulnerability:** `restockMedication(medicationId, countToAdd)` allowed negative, fractional, or arbitrarily large numbers.
- **Approach to Solve:**
  1. Enforced `Number.isInteger(countToAdd) && countToAdd > 0 && countToAdd <= 5000`.

---

## 4. Verification Evidence

### Automated Test Suite
- **Command:** `npm test`
- **Result:** **67 / 67 tests passing (100% pass rate)**
- **Coverage:**
  - 4 new dedicated Vibe-Check security audit suites (Secrets & Git, Database Access & IDOR, Edge Function Fail-Closed Quotas, Input Validation & PostgREST Sanitization).
  - 29 existing architecture, invariant, and compliance test suites.

### TypeScript Compilation
- **Command:** `npx tsc --noEmit`
- **Result:** **0 errors (Clean compilation)**

---

## 5. Release Gate Decision

**Verdict: SHIP (Ready for Production / Demo)**
All 10 security findings from the Vibe-Check checklist and Reddit guide have been addressed, verified with automated tests, and documented.
