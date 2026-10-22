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
- Application tables in the Supabase PostgreSQL database enforce Row Level Security, validated by 67 automated test suites.
- Patients are scoped to querying and updating their own health records (`auth.uid() = id`).
- Caregivers can only read telemetry for paired dependents where an active linkage exists (`status = 'active'`).
- Clinicians access prescriptions and patient queues for individuals associated with their clinical review workflow. Doctor credential badges are verified through manual review before clinical access is granted.

### 2. Privilege Escalation Prevention
- Database-level trigger functions (`protect_profile_fields`) run with `SECURITY DEFINER` privileges to prevent users from modifying restricted columns via client requests (such as self-assigning `is_verified_doctor` status).

### 3. Hardware-Backed Keychain Storage
- Session tokens and authentication state are stored using `expo-secure-store`, backed by the Android Keystore and iOS Keychain.

### 4. Secret Separation
- Cloud API keys and service configurations are injected via EAS build secrets and serverless environment variables. `google-services.json` and `.env` are excluded from source control.

---

## Reporting a Vulnerability

If you discover a security vulnerability within MedSync, please help us protect our users by following responsible disclosure practices:

> [!CAUTION]
> **Do NOT file public GitHub issues for security vulnerabilities.**

### How to Report Privately

1. **GitHub Private Vulnerability Reporting (Recommended):**
   - Navigate to the [MedSync Security Tab](https://github.com/breathtaker-adi/Medsync/security).
   - Click **"Report a vulnerability"** to submit a private report directly to repository maintainers.

2. **Alternative Contact:**
   - Maintainer profile: [`@breathtaker-adi`](https://github.com/breathtaker-adi).

### What to Include
To expedite triage and resolution, please include:
- A descriptive summary of the vulnerability (e.g., RLS bypass, TTS injection, authentication flaw).
- Step-by-step reproduction instructions or a minimal proof-of-concept (PoC).
- Potential impact and affected roles (Patient, Caregiver, Doctor).
- Any proposed remediation or suggested patch.

### Response Commitment
As a community open-source project:
- **Initial Acknowledgment:** Typically within 72 hours of report submission.
- **Triage & Assessment:** Within 7 business days with an assessment of severity.
- **Patch & Deployment:** Confirmed security issues are prioritized for the next release, with public release notes thanking the researcher.

---

## Recognition

We sincerely appreciate responsible security research that helps protect patients and caregivers. Researchers who responsibly disclose confirmed vulnerabilities will be credited in our GitHub release notes.

Thank you for helping us keep healthcare safe and accessible! 🩺❤️
