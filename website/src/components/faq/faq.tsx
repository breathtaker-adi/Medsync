"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, HelpCircle, ShieldCheck, HeartHandshake, Smartphone, Sparkles, Lock, Cpu, Download, Eye } from "lucide-react";
import { SectionHeading } from "@/components/fx/section-heading";
import { Reveal } from "@/components/fx/reveal";

interface FAQItem {
  id: string;
  icon: React.ReactNode;
  question: string;
  answer: string;
  category: "PRIVACY" | "CLINICAL" | "SYSTEM";
}

const FAQS: FAQItem[] = [
  {
    id: "dpdp-privacy",
    icon: <ShieldCheck size={16} className="text-bio" />,
    category: "PRIVACY",
    question: "How does MedSync protect my personal health data under India's DPDP Act 2023?",
    answer:
      "MedSync is architected around the core data protection principles of India's Digital Personal Data Protection (DPDP) Act 2023. Health schedules and records are stored in a secure Supabase PostgreSQL cloud database protected by strict Row-Level Security (RLS) policies, with session tokens safeguarded by your phone's hardware Keystore via SecureStore. We never deploy tracking cookies, advertising SDKs, or broker data to third parties. Under Section 12 of the DPDP Act 2023, you retain the right to export your records or permanently delete your account and all associated data on demand.",
  },
  {
    id: "offline-resilience",
    icon: <Smartphone size={16} className="text-pulse-bright" />,
    category: "SYSTEM",
    question: "What happens if I lose internet connection or take doses in remote areas?",
    answer:
      "MedSync schedules dose alarms natively on your Android device using exact alarm managers, ensuring reminders trigger reliably even without an active internet connection. On-device caches allow you to view current schedules offline. When network connectivity is restored, dose confirmations synchronize with linked family caregivers. A dedicated offline dose logging queue is currently under active development.",
  },
  {
    id: "clinician-safety",
    icon: <HeartHandshake size={16} className="text-amber-clin" />,
    category: "CLINICAL",
    question: "Can MedSync's AI automatically change my medication dosages?",
    answer:
      "Never. MedSync strictly enforces the Doctor Care Loop safety guardrail. When you scan a prescription, our serverless AI Vision edge function extracts medication names, dosage strengths, and timing into a proposed schedule draft. However, no schedule goes live without explicit confirmation and digital verification by a registered medical practitioner or designated caregiver.",
  },
  {
    id: "caregiver-escalation",
    icon: <Sparkles size={16} className="text-bio" />,
    category: "CLINICAL",
    question: "How does Caregiver Escalation work if a patient misses a critical dose?",
    answer:
      "For chronic or high-risk therapies, patients can pair trusted family caregivers using a secure, temporary 15-minute pairing code. If a scheduled dose is not logged as taken within the grace window (30 to 60 minutes), MedSync dispatches an encrypted push alert directly to the caregiver's device via Firebase Cloud Messaging so family members can check in.",
  },
  {
    id: "open-source",
    icon: <Cpu size={16} className="text-pulse-bright" />,
    category: "SYSTEM",
    question: "Is MedSync open source, and how can I verify its security?",
    answer:
      "Yes. MedSync is 100% open source under the permissive MIT License. The complete source code for our React Native mobile application, Next.js web application, Supabase database migrations, Row-Level Security policies, and edge functions is publicly auditable on GitHub.",
  },
  {
    id: "data-export",
    icon: <Lock size={16} className="text-slate-300" />,
    category: "PRIVACY",
    question: "How can I export or permanently purge my medical data?",
    answer:
      "You retain full data sovereignty under Section 11 and 12 of the DPDP Act 2023. Inside app settings, you can tap 'Export Vault JSON' to generate a standardized, machine-readable export of your prescription history and adherence logs. You can also select 'Delete Account' to trigger a permanent cascading deletion of all your database records, caregiver pairings, push tokens, and prescription images across both local storage and cloud servers.",
  },
  {
    id: "senior-mode",
    icon: <Eye size={16} className="text-bio" />,
    category: "SYSTEM",
    question: "How does MedSync's Senior Mode ensure accessibility for elderly patients?",
    answer:
      "MedSync features a dedicated Senior Mode designed to WCAG AAA standards. It provides generous 64px minimum touch targets, high-contrast text and cards, haptic feedback on dose confirmation, and large, unambiguous 'I Took It' buttons that eliminate cognitive overload for aging seniors.",
  },
  {
    id: "download-apk",
    icon: <Download size={16} className="text-amber-clin" />,
    category: "SYSTEM",
    question: "Where can I download the MedSync Android APK, and what are the system requirements?",
    answer:
      "Official, signed Android APK releases are available for direct download on MedSync's official GitHub Releases repository (https://github.com/breathtaker-adi/Medsync/releases). MedSync supports Android 8.0 (API level 26) through Android 15, requiring approximately 48MB of storage.",
  },
];

export function FAQSection() {
  const [openId, setOpenId] = useState<string | null>("dpdp-privacy");

  const toggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section id="faq" className="relative mx-auto w-full max-w-5xl px-5 py-14 md:px-8 md:py-20" aria-label="Frequently Asked Questions">
      <SectionHeading
        index="05"
        eyebrow="FAQ & SAFETY"
        title={
          <>
            Clarity on privacy,{" "}
            <span className="text-gradient-sync">safety &amp; architecture.</span>
          </>
        }
        description="Everything you need to know about our DPDP Act 2023 compliance, doctor verification loop, offline vault, and caregiver synchronization."
      />

      {/* AEO & GEO Fast Answer Matrix for Search Engines & AI Overviews */}
      <div className="mt-8 rounded-2xl border border-bio/20 bg-bio/[0.03] p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-wider text-bio uppercase">
          <Sparkles size={14} className="text-bio" />
          <span>Executive Knowledge Summary for Answer Engines</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-300 md:text-sm">
          <strong>MedSync</strong> is a free, open-source (MIT) medication adherence and caregiver safety platform for Android. It combines AI prescription camera OCR intake, native offline exact alarms, caregiver missed-dose push alerts, and strict DPDP Act 2023 data sovereignty (hardware Keystore authentication, zero ad brokers, and PostgreSQL Row-Level Security).
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {FAQS.map((item, index) => {
          const isOpen = openId === item.id;
          return (
            <Reveal key={item.id} delay={index * 0.04} y={18}>
              <div
                className={`overflow-hidden rounded-2xl border transition-all duration-300 ${
                  isOpen
                    ? "border-bio/40 bg-white/[0.04] shadow-[0_10px_30px_-10px_rgba(0,240,255,0.12)]"
                    : "border-white/8 bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.03]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left md:p-6"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
                      {item.icon}
                    </span>
                    <span className="text-sm font-semibold text-white md:text-base">
                      {item.question}
                    </span>
                  </div>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-slate-400 transition-transform duration-300 ${
                      isOpen ? "rotate-180 border-bio/50 text-bio" : ""
                    }`}
                  >
                    <ChevronDown size={14} />
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="border-t border-white/6 px-5 pt-3 pb-5 md:px-6 md:pb-6">
                        <p className="text-xs leading-relaxed text-slate-300 md:text-sm">
                          {item.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
