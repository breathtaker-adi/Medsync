"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, HelpCircle, ShieldCheck, HeartHandshake, Smartphone, Sparkles, Lock, Cpu } from "lucide-react";
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
      "MedSync is built on an offline-first privacy framework. Your prescription photos, medication logs, and health schedules are stored exclusively on your device inside an encrypted SQLite database using SQLCipher AES-256-GCM. We never deploy tracking cookies, third-party analytics SDKs, or broker data to insurance companies or ad networks. Under Section 11 of the DPDP Act 2023, you can export or irrevocably delete your entire health ledger on demand.",
  },
  {
    id: "offline-resilience",
    icon: <Smartphone size={16} className="text-pulse-bright" />,
    category: "SYSTEM",
    question: "What happens if I lose internet connection or take doses in remote areas?",
    answer:
      "MedSync does not require an internet connection to manage your health routine. Dose alarms, time-interval calculations, adherence logging, and offline prescription views execute locally on-device. When network connectivity is restored, the local vault silently performs cryptographic synchronization with designated caregivers without data loss or duplicate alarms.",
  },
  {
    id: "clinician-safety",
    icon: <HeartHandshake size={16} className="text-amber-clin" />,
    category: "CLINICAL",
    question: "Can MedSync's AI automatically change my medication dosages?",
    answer:
      "Never. MedSync strictly enforces the Doctor Care Loop safety guardrail. When you scan a prescription using on-device optical vision, AI assists by extracting medicine names, dosage strengths, and frequency into a proposed schedule. However, no dosage modifications go live without verification and digital sign-off by a licensed clinician or your registered physician.",
  },
  {
    id: "caregiver-escalation",
    icon: <Sparkles size={16} className="text-bio" />,
    category: "CLINICAL",
    question: "How does Caregiver Escalation work if a patient misses a critical dose?",
    answer:
      "For high-risk chronic therapies (e.g., cardiac, hypertension, or diabetes medications), patients can designate trusted family caregivers (such as children or spouses). If a scheduled morning dose is not marked as taken within the predetermined window (typically 30 minutes), MedSync dispatches an instant encrypted push alert and fallback notification directly to the caregiver's device.",
  },
  {
    id: "open-source",
    icon: <Cpu size={16} className="text-pulse-bright" />,
    category: "SYSTEM",
    question: "Is MedSync open source, and how can I verify its security?",
    answer:
      "Yes. MedSync is 100% open source under the permissive MIT License. The complete source code for our Android application, on-device encryption vault, and sync protocol is publicly auditable on GitHub. Security researchers and developers are welcome to inspect our cryptographic implementations and run local test suites.",
  },
  {
    id: "data-export",
    icon: <Lock size={16} className="text-slate-300" />,
    category: "PRIVACY",
    question: "How can I export or permanently purge my medical data?",
    answer:
      "You retain unconditional data sovereignty. Inside the app settings or via our web console, you can tap 'Export Vault JSON' to generate a standardized, machine-readable JSON backup of your prescriptions and adherence history. You can also trigger 'Wipe Local Vault' to cryptographically shred all local storage and unpair synced caregivers in under two seconds.",
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

      <div className="mt-10 flex flex-col gap-3">
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
