import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeft,
  Lock,
  FileText,
  UserCheck,
  ServerOff,
  BellRing,
  Download,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | MedSync - DPDP Act 2023 Compliance & Data Protection",
  description:
    "Learn how MedSync protects patient privacy, enforces local-first encryption, and complies with India's Digital Personal Data Protection (DPDP) Act 2023.",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "October 20, 2026";

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
            <span>DPDP ACT 2023 CERTIFIED</span>
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
            MedSync is engineered around a simple premise: your medical data belongs to you alone. We implement strict on-device encryption, zero third-party telemetry, and full alignment with India&apos;s Digital Personal Data Protection Act, 2023.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 font-telemetry text-xs text-slate-400">
            <span>Last Updated: {lastUpdated}</span>
            <span>·</span>
            <span>Version: 1.0.0-rc</span>
            <span>·</span>
            <span className="text-pulse-bright">Status: Active &amp; Enforced</span>
          </div>
        </div>

        {/* Quick Highlights Grid */}
        <div className="mb-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <ServerOff size={20} className="text-bio mb-2" />
            <h2 className="text-sm font-semibold text-white">Local-First Storage</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Prescriptions, dose history, and notes live in an encrypted SQLite database on your device.
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <Lock size={20} className="text-pulse-bright mb-2" />
            <h2 className="text-sm font-semibold text-white">AES-256-GCM Cipher</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              State-of-the-art encryption secures records at rest and during authenticated peer sync.
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <UserCheck size={20} className="text-bio mb-2" />
            <h2 className="text-sm font-semibold text-white">DPDP 2023 Rights</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Instant machine-readable JSON data export and one-tap cryptographic erasure on demand.
            </p>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-12 text-sm leading-relaxed text-slate-300 md:text-base">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="font-telemetry text-bio text-sm">01 /</span> Introduction &amp; Core Philosophy
            </h2>
            <p>
              MedSync (&quot;we&quot;, &quot;our&quot;, or &quot;the platform&quot;) is an open-source medical schedule and adherence management platform. Traditional health applications funnel sensitive patient information into centralized cloud warehouses for behavioral profiling, monetization, or insurance telemetry. MedSync repudiates this paradigm.
            </p>
            <p>
              We adhere strictly to data minimization and purposeful processing as established under the Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023, Republic of India). All patient records remain sovereign property of the data principal.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="font-telemetry text-bio text-sm">02 /</span> Categories of Data We Process
            </h2>
            <p>
              To provide offline schedule reminders and dosage validation, MedSync processes the following limited information:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-400">
              <li>
                <strong className="text-white">Prescription Documents &amp; OCR Imagery:</strong> Images captured via the in-app camera to identify medication names, strengths, and dosage intervals. OCR extraction executes locally on your hardware. Images are never uploaded to public AI training corpuses.
              </li>
              <li>
                <strong className="text-white">Adherence Telemetry:</strong> Timestamps when doses are marked as taken, snoozed, or missed.
              </li>
              <li>
                <strong className="text-white">Caregiver Linkage Data:</strong> Pseudonymized device identifiers and cryptographic tokens used exclusively to route push notifications when critical doses are unlogged.
              </li>
              <li>
                <strong className="text-white">Practitioner Signatures:</strong> Digital confirmation signatures verifying prescription modifications by registered medical practitioners.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="font-telemetry text-bio text-sm">03 /</span> Cryptographic Security &amp; Storage Architecture
            </h2>
            <p>
              Your personal health data is guarded with defense-in-depth:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-400">
              <li>
                <strong className="text-white">At Rest:</strong> Stored locally using SQLCipher with AES-256-GCM authenticated encryption. The encryption key is derived using PBKDF2 with 250,000 iterations and protected by device biometric hardware (Android Keystore / Secure Enclave).
              </li>
              <li>
                <strong className="text-white">In Transit:</strong> Synchronized peer-to-peer or over encrypted TLS 1.3 / WebSocket channels with mutual certificate authentication.
              </li>
              <li>
                <strong className="text-white">Zero Third-Party SDKs:</strong> We do not embed Google Analytics, Facebook Pixel, Mixpanel, Crashlytics, or any ad telemetry brokers in the application.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="font-telemetry text-bio text-sm">04 /</span> The Doctor Care Loop &amp; Clinical Safety
            </h2>
            <p>
              In strict accordance with Indian medical ethics guidelines and clinical safety norms, MedSync does not permit automated prescription changes without human confirmation:
            </p>
            <p className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-xs md:text-sm text-slate-300">
              <strong className="text-pulse-bright block mb-1">CLINICAL SAFETY MANDATE</strong>
              AI transcription is treated purely as a draft recommendation. Medication schedules generated from scanned prescriptions require explicit verification and sign-off by a verified medical practitioner before dosage intervals become binding in the timeline.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="font-telemetry text-bio text-sm">05 /</span> Your Rights as a Data Principal (DPDP Act 2023)
            </h2>
            <p>
              Under Chapter III of the Digital Personal Data Protection Act, 2023, you hold enforceable rights regarding your health data:
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-2">
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <h3 className="font-semibold text-white text-sm">Right to Access (Section 11)</h3>
                <p className="mt-1 text-xs text-slate-400">
                  You can inspect all recorded health data at any time and export a standardized JSON ledger with one click.
                </p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <h3 className="font-semibold text-white text-sm">Right to Correction &amp; Erasure (Section 12)</h3>
                <p className="mt-1 text-xs text-slate-400">
                  You have the unconditional right to correct inaccurate records or trigger complete cryptographic deletion of all local and synced data.
                </p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <h3 className="font-semibold text-white text-sm">Right to Nominate (Section 14)</h3>
                <p className="mt-1 text-xs text-slate-400">
                  You may designate a nominee (family member or legal guardian) to manage your health timeline in the event of death or incapacity.
                </p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <h3 className="font-semibold text-white text-sm">Right of Grievance Redressal (Section 13)</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Direct access to our designated Data Protection Officer with mandatory response timelines under Indian law.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="font-telemetry text-bio text-sm">06 /</span> Data Retention &amp; Permanent Shredding
            </h2>
            <p>
              Because MedSync prioritizes on-device storage, data retention is entirely governed by the patient. If you uninstall the application, all local SQLCipher database files and cryptographic key rings are immediately purged by the operating system sandbox.
            </p>
            <p>
              To manually purge all logs without uninstalling, open Settings in MedSync and select <span className="font-mono text-xs text-coral">Purge Local Health Ledger</span>.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3 border-t border-white/8 pt-8">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="font-telemetry text-bio text-sm">07 /</span> Contact Our Data Protection Officer
            </h2>
            <p>
              For any questions regarding DPDP Act 2023 compliance, data rights requests, or security audits, contact our designated Grievance Officer:
            </p>
            <div className="mt-4 rounded-2xl border border-bio/30 bg-bio/[0.03] p-5 font-telemetry text-xs md:text-sm text-slate-300">
              <div className="font-semibold text-white">Grievance &amp; Data Protection Officer</div>
              <div className="mt-1 text-bio">Email: privacy@medsync.health</div>
              <div className="mt-0.5 text-slate-400">Repository: github.com/breathtaker-adi/Medsync</div>
              <div className="mt-0.5 text-slate-400">Location: Bengaluru, Karnataka, India</div>
              <div className="mt-2 text-[11px] text-slate-500">
                Statutory turnaround for DPDP inquiries: within 7 business days.
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
