import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { FAQSection } from "@/components/faq/faq";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | MedSync",
  description:
    "Common questions about MedSync: DPDP Act 2023 compliance, offline vault, AI prescription verification, and caregiver safety loops.",
};

export default function FAQPage() {
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
            <span>KNOWLEDGE BASE &amp; SAFETY</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12">
        <FAQSection />

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/8 pt-8">
          <Link
            href="/"
            className="flex items-center gap-2 font-telemetry text-xs uppercase text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft size={14} /> Back to Overview
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/privacy"
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 font-telemetry text-xs uppercase text-slate-300 transition-colors hover:border-bio/50 hover:text-bio"
            >
              Privacy Policy
            </Link>
            <a
              href="https://github.com/breathtaker-adi/Medsync"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-gradient-to-r from-bio to-pulse px-4 py-2 font-telemetry text-xs font-semibold uppercase text-obsidian transition-all hover:brightness-110"
            >
              GitHub Project
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
