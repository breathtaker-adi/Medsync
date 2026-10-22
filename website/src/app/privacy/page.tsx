import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeft,
  Lock,
  FileText,
  UserCheck,
  Cloud,
  BellRing,
  Download,
  AlertCircle,
  HelpCircle,
  Database,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | Medsync — Privacy Architecture & Data Charter",
  description:
    "Learn how MedSync protects patient privacy, secures cloud health data, and aligns with India's Digital Personal Data Protection (DPDP) Act 2023.",
  alternates: {
    canonical: "https://breathtaker-adi.github.io/Medsync/privacy",
  },
  openGraph: {
    title: "Privacy Policy | Medsync — Privacy Architecture & Data Charter",
    description:
      "Learn how MedSync protects patient privacy, secures cloud health data, and aligns with India's Digital Personal Data Protection (DPDP) Act 2023.",
    url: "https://breathtaker-adi.github.io/Medsync/privacy",
  },
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "October 23, 2026";

  return (
    <div className="relative min-h-screen bg-[#040711] text-slate-200">
      {/* Background ambient mesh */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 left-1/4 h-[50vh] w-[50vw] rounded-full bg-bio/[0.05] blur-[140px]" />
        <div className="absolute top-1/3 right-10 h-[40vh] w-[40vw] rounded-full bg-pulse/[0.04] blur-[130px]" />
        <div className="dot-grid absolute inset-0 opacity-40" />
      </div>

      {/* Header bar */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#040711]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 md:px-8">
          <Link
            href="/"
            className="group flex items-center gap-2 font-telemetry text-xs font-semibold tracking-[0.16em] text-slate-300 uppercase transition-colors hover:text-bio"
          >
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
            Back to MedSync
          </Link>
          <div className="flex items-center gap-2 font-telemetry text-[11px] text-bio">
            <ShieldCheck size={14} className="text-pulse-bright" />
            <span>DPDP ACT 2023 ALIGNED</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-4xl px-5 py-12 md:px-8 md:py-16">
        {/* Page Hero */}
        <div className="mb-12 border-b border-white/8 pb-8">
          <div className="flex items-center gap-2 font-telemetry text-xs tracking-[0.24em] text-bio uppercase">
            <span>LEGAL &amp; PRIVACY CHARTER</span>
            <span className="text-white/20">·</span>
            <span>INDIA JURISDICTION</span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-5xl">
            Privacy Policy &amp; Data Charter
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
            MedSync is engineered around a core principle: your medical data belongs to you alone. We practice strict data minimization, granular Row-Level Security, zero advertising tracking, and transparent alignment with India&apos;s Digital Personal Data Protection Act, 2023.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 font-telemetry text-xs text-slate-400">
            <span>Last Updated: {lastUpdated}</span>
            <span>·</span>
            <span>Version: 1.2.0</span>
            <span>·</span>
            <span className="text-pulse-bright">Status: Active &amp; Enforced</span>
          </div>
        </div>

        {/* Quick Highlights Grid */}
        <div className="mb-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <Database size={20} className="text-bio mb-2" />
            <h2 className="text-sm font-semibold text-white">Row-Level Security</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Cloud health records in Supabase PostgreSQL are cryptographically isolated per user with strict database policies.
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <Lock size={20} className="text-pulse-bright mb-2" />
            <h2 className="text-sm font-semibold text-white">TLS 1.3 &amp; SecureStore</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Encrypted in transit with TLS 1.3. Device session keys are stored in hardware-backed Android Keystore / iOS Keychain.
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <UserCheck size={20} className="text-bio mb-2" />
            <h2 className="text-sm font-semibold text-white">DPDP 2023 Rights</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Machine-readable data export and permanent server account deletion under Section 12 of the DPDP Act 2023.
            </p>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-12 text-sm leading-relaxed text-slate-300 md:text-base">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="font-telemetry text-bio text-sm">01 /</span> Data Fiduciary &amp; Core Philosophy
            </h2>
            <p>
              MedSync (&quot;we&quot;, &quot;our&quot;, or &quot;the platform&quot;) operates as an open-source medication adherence and caregiver safety platform. Under India&apos;s Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023, Republic of India), MedSync acts as the Data Fiduciary regarding the personal health data processed within the application.
            </p>
            <p>
              We adhere strictly to purpose limitation and data minimization. We do not sell, broker, or monetize your health data, nor do we build behavioral profiles for insurance or commercial advertising purposes.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="font-telemetry text-bio text-sm">02 /</span> Categories of Data We Process &amp; How It Works
            </h2>
            <p>
              To deliver medication alarms, caregiver alerts, and prescription digitization, MedSync processes the following categories of data:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-400">
              <li>
                <strong className="text-white">Prescription Documents &amp; AI OCR:</strong> When you snap a prescription photo, the image is transmitted securely over TLS 1.3 to Supabase Storage and parsed by our serverless AI Vision edge function to extract medication names, dosage strengths, and schedules. Images are stored securely in your private storage bucket and queued for clinician review before schedules become active. Informed consent is gathered prior to your first scan.
              </li>
              <li>
                <strong className="text-white">Medication Schedules &amp; Adherence Logs:</strong> Timestamps when doses are logged as taken, missed, or snoozed, along with medication inventory counts.
              </li>
              <li>
                <strong className="text-white">Caregiver &amp; Doctor Pairings:</strong> Cryptographic 8-character pairing codes with 15-minute expiry, status indicators, and permission links between patients, family caregivers, and verified clinicians.
              </li>
              <li>
                <strong className="text-white">Device Push Tokens:</strong> FCM and Expo notification tokens used strictly to dispatch urgent missed-dose notifications and refill alerts.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="font-telemetry text-bio text-sm">03 /</span> Cloud Architecture, Storage &amp; Sub-processors
            </h2>
            <p>
              MedSync uses a defense-in-depth architecture combining cloud security with on-device hardware protections:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-400">
              <li>
                <strong className="text-white">In Transit:</strong> All communications between the mobile application and backend services are encrypted using Transport Layer Security (TLS 1.3 / HTTPS).
              </li>
              <li>
                <strong className="text-white">At Rest (Cloud):</strong> Stored in an encrypted Supabase PostgreSQL database protected by Row-Level Security (RLS) policies. Patients can only query their own records, caregivers can only inspect actively linked dependents, and doctors can only access patients under clinical care.
              </li>
              <li>
                <strong className="text-white">At Rest (Device):</strong> Authentication session tokens are stored using <code className="text-xs text-bio">expo-secure-store</code>, backed by the hardware-isolated Android Keystore and iOS Keychain.
              </li>
              <li>
                <strong className="text-white">Zero Advertising SDKs:</strong> We never integrate Google AdMob, Facebook Pixel, Mixpanel, AppsFlyer, or data brokers.
              </li>
            </ul>

            <h3 className="pt-2 text-base font-semibold text-white">Authorized Sub-processors</h3>
            <p className="text-xs text-slate-400">
              The following service providers assist in providing core platform infrastructure:
            </p>
            <div className="overflow-x-auto rounded-xl border border-white/8 bg-white/[0.02]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/8 text-slate-400">
                    <th className="p-3">Processor</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Data Processed</th>
                    <th className="p-3">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  <tr>
                    <td className="p-3 font-semibold text-white">Supabase Inc.</td>
                    <td className="p-3">Database, Auth, Storage, Edge Functions</td>
                    <td className="p-3">Encrypted health schedules, user profiles, prescription photos</td>
                    <td className="p-3">Cloud Region (AWS/Supabase)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">AI Vision OCR Provider</td>
                    <td className="p-3">Prescription Optical Character Recognition</td>
                    <td className="p-3">Prescription image payload (transient processing, no model training)</td>
                    <td className="p-3">Cloud API</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Google Firebase (FCM)</td>
                    <td className="p-3">Push Notification Gateway</td>
                    <td className="p-3">Device push tokens, dose alert titles</td>
                    <td className="p-3">Global Infrastructure</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Expo (650 Industries)</td>
                    <td className="p-3">Mobile Build Pipeline &amp; Push Relay</td>
                    <td className="p-3">App build artifacts, notification routing</td>
                    <td className="p-3">United States</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="font-telemetry text-bio text-sm">04 /</span> The Doctor Care Loop &amp; Clinical Safety
            </h2>
            <p>
              In accordance with medical safety ethics, MedSync does not permit unverified automated prescription modifications:
            </p>
            <p className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-xs md:text-sm text-slate-300">
              <strong className="text-pulse-bright block mb-1">CLINICAL SAFETY MANDATE</strong>
              AI transcription is treated strictly as an initial draft. Scanned prescriptions are queued for verification by a licensed medical practitioner or confirmed by an active caregiver before dosage regimens become active in the medication schedule.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="font-telemetry text-bio text-sm">05 /</span> Your Rights as a Data Principal (DPDP Act 2023)
            </h2>
            <p>
              Under Chapter III of India&apos;s Digital Personal Data Protection Act, 2023, you retain enforceable rights:
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-2">
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <h3 className="font-semibold text-white text-sm">Right to Access (Section 11)</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Inspect all recorded medication data at any time and export a standardized machine-readable JSON health report.
                </p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <h3 className="font-semibold text-white text-sm">Right to Correction &amp; Erasure (Section 12)</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Correct inaccurate health records or trigger complete deletion of your account, database records, and prescription images.
                </p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <h3 className="font-semibold text-white text-sm">Right to Nominate (Section 14)</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Designate a family caregiver or legal guardian to access and manage your adherence schedule in the event of incapacity.
                </p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <h3 className="font-semibold text-white text-sm">Right of Grievance Redressal (Section 13)</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Direct grievance redressal through our designated security channel with resolution procedures under Indian law.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="font-telemetry text-bio text-sm">06 /</span> Data Retention, Uninstall vs. Account Deletion
            </h2>
            <p>
              It is important to understand the difference between uninstalling the mobile app and deleting your account:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-400">
              <li>
                <strong className="text-white">Uninstalling the App:</strong> Removes local app sandbox storage, cached schedules, and hardware keychain tokens from your physical phone. However, encrypted records in Supabase remain associated with your registered account so your schedule is preserved if you reinstall.
              </li>
              <li>
                <strong className="text-white">Deleting Your Account (Permanent Erasure):</strong> To permanently purge all records from both your phone and cloud servers under Section 12 of the DPDP Act 2023, navigate to <span className="font-mono text-xs text-coral">Settings &rarr; Delete Account</span>. This triggers our database procedure (<code className="text-xs text-bio">delete_user_account</code>) which cascades deletion across prescriptions, logs, paired links, push tokens, and storage buckets.
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3 border-t border-white/8 pt-8">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="font-telemetry text-bio text-sm">07 /</span> Contact &amp; Grievance Redressal
            </h2>
            <p>
              For any questions regarding DPDP Act 2023 alignment, data rights requests, or security inquiries, contact our project maintainers:
            </p>
            <div className="mt-4 rounded-2xl border border-bio/30 bg-bio/[0.03] p-5 font-telemetry text-xs md:text-sm text-slate-300">
              <div className="font-semibold text-white">MedSync Open Source Project Maintainer</div>
              <div className="mt-1 text-bio">Security Advisories: <a href="https://github.com/breathtaker-adi/Medsync/security/advisories" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">github.com/breathtaker-adi/Medsync/security/advisories</a></div>
              <div className="mt-0.5 text-slate-400">Issues &amp; Requests: <a href="https://github.com/breathtaker-adi/Medsync/issues" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">github.com/breathtaker-adi/Medsync/issues</a></div>
              <div className="mt-0.5 text-slate-400">Maintainer Profile: <a href="https://github.com/breathtaker-adi" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">github.com/breathtaker-adi</a></div>
              <div className="mt-0.5 text-slate-400">Jurisdiction: Bengaluru, Karnataka, India</div>
              <div className="mt-2 text-[11px] text-slate-500">
                Grievance turnaround: Inquiries acknowledged within 48–72 hours, with substantive response within 30 days.
              </div>
            </div>
          </section>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-white/8 pt-8">
          <Link
            href="/"
            className="flex items-center gap-2 font-telemetry text-xs uppercase text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft size={14} /> Back to Overview
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/faq"
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 font-telemetry text-xs uppercase text-slate-300 transition-colors hover:border-bio/50 hover:text-bio"
            >
              Read FAQs
            </Link>
            <a
              href="https://github.com/breathtaker-adi/Medsync"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-gradient-to-r from-bio to-pulse px-4 py-2 font-telemetry text-xs font-semibold uppercase text-obsidian transition-all hover:brightness-110"
            >
              Audit Source Code
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
