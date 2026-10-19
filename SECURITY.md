# Security Policy 🔒

At **MedSync**, security, patient privacy, and data integrity are central to everything we build. As a digital health and medication adherence platform handling prescription regimens and caregiver telemetry, we hold ourselves to rigorous defense-in-depth security standards.

---

## Supported Versions

We actively provide security updates and patches for the following versions:

| Version | Supported | Notes |
| :--- | :---: | :--- |
| `v1.2.x` | ✅ Yes | Current stable release (Expo SDK 57, React Native 0.86) |
| `v1.1.x` | ⚠️ Limited | Critical security patches only |
| `< v1.1` | ❌ No | Please upgrade to the latest version |

---

## Architecture & Security Defenses

MedSync implements comprehensive security controls across all architectural layers:

### 1. Row Level Security (RLS)
- Every single table in the Supabase PostgreSQL database enforces strict Row Level Security.
- Patients are cryptographically restricted to querying and updating only their own records.
- Caregivers can only read telemetry for verified paired dependents.
- Clinicians can only review prescriptions and patient directories for individuals under their direct clinical care.

### 2. Privilege Escalation Prevention
- Database-level trigger functions (`protect_profile_fields`) run with `SECURITY DEFINER` privileges to prevent malicious users from modifying restricted columns (e.g., self-assigning `is_verified_doctor` status or altering verification badges via direct client requests).

### 3. Hardware-Backed Keychain Storage
- Sensitive session tokens and cryptographic materials are stored exclusively using `expo-secure-store`, utilizing the Android Keystore and iOS Keychain.

### 4. Zero Hardcoded Secrets
- All production credentials, push certificates, and service account keys are stored in encrypted EAS secrets and injected at runtime. `google-services.json` and `.env` are strictly excluded from source control.

---

## Reporting a Vulnerability

If you discover a security vulnerability within MedSync, please help us protect our users by following responsible disclosure practices:

> [!CAUTION]
> **Do NOT file public GitHub issues for security vulnerabilities.**

### How to Report Privately

1. **GitHub Private Vulnerability Reporting (Recommended):**
   - Navigate to the [MedSync Security Tab](https://github.com/breathtaker-adi/Medsync/security).
   - Click **"Report a vulnerability"** to submit a private report directly to repository maintainers.

2. **Email Disclosure:**
   - Alternatively, send a detailed advisory to the project maintainers via GitHub profile contact: [`@breathtaker-adi`](https://github.com/breathtaker-adi).

### What to Include
To expedite triage and resolution, please include:
- A descriptive summary of the vulnerability (e.g., RLS bypass, TTS injection, authentication flaw).
- Step-by-step reproduction instructions or a minimal proof-of-concept (PoC).
- Potential impact and affected roles (Patient, Caregiver, Doctor).
- Any proposed remediation or suggested patch.

### Our Commitment
- **Initial Response:** Within 48 hours of report submission.
- **Triage & Assessment:** Within 5 business days with a severity rating (CVSS).
- **Patch & Deployment:** Critical vulnerabilities are addressed with emergency hotfixes and public security advisories crediting the researcher (if desired).

---

## Bug Bounty & Recognition

MedSync is an open-source initiative. While we do not currently operate a paid monetary bug bounty program, we proudly credit security researchers in our release notes and repository security hall of fame.

Thank you for helping us keep healthcare safe and accessible! 🩺❤️
