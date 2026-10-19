"use client";

import { motion } from "motion/react";
import { Users2, ShieldCheck, HeartPulse, TerminalSquare } from "lucide-react";
import { BorderBeam, CornerTicks } from "@/components/fx/atoms";
import { BUS, emit } from "@/lib/events";

export function CaregiverSyncCard({ className = "" }: { className?: string }) {
  return (
    <motion.div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/8 bg-white/[0.02] p-5 backdrop-blur-md md:p-6 ${className}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <BorderBeam soft />
      <CornerTicks inset={10} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Module 1: Caregiver Escalation */}
        <div className="flex flex-col gap-2 rounded-2xl border border-white/6 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 font-telemetry text-[10px] tracking-[0.18em] text-bio uppercase">
            <Users2 size={13} className="text-bio" /> Caregiver Escalation
          </div>
          <div className="text-sm font-semibold text-white">Ananya (Daughter)</div>
          <p className="text-[12px] leading-relaxed text-slate-400">
            Push alert dispatches automatically if morning dose isn't logged within 30 minutes of the window.
          </p>
          <div className="mt-auto flex items-center gap-1.5 font-telemetry text-[9px] text-pulse-bright">
            <span className="h-1.5 w-1.5 rounded-full bg-pulse" /> Linked · Push notifications enabled
          </div>
        </div>

        {/* Module 2: Doctor Sign-Off Loop */}
        <div className="flex flex-col gap-2 rounded-2xl border border-white/6 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 font-telemetry text-[10px] tracking-[0.18em] text-pulse-bright uppercase">
            <HeartPulse size={13} className="text-pulse-bright" /> Doctor Care Loop
          </div>
          <div className="text-sm font-semibold text-white">Dr. Anand (Cardiology)</div>
          <p className="text-[12px] leading-relaxed text-slate-400">
            Prescriptions scanned via AI require clinician confirmation. No automatic dosage changes without sign-off.
          </p>
          <div className="mt-auto flex items-center gap-1.5 font-telemetry text-[9px] text-bio">
            <span className="h-1.5 w-1.5 rounded-full bg-bio" /> Verified practitioner portal active
          </div>
        </div>

        {/* Module 3: Security & Telemetry Access */}
        <div className="flex flex-col gap-2 rounded-2xl border border-white/6 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 font-telemetry text-[10px] tracking-[0.18em] text-slate-400 uppercase">
            <ShieldCheck size={13} className="text-slate-300" /> Patient Privacy
          </div>
          <div className="text-sm font-semibold text-white">Encrypted &amp; DPDP Ready</div>
          <p className="text-[12px] leading-relaxed text-slate-400">
            You own your data. End-to-end encrypted in transit, cached locally, and fully exportable on demand.
          </p>
          <div className="mt-auto flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => emit(BUS.consoleOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-telemetry text-[9px] tracking-[0.14em] text-slate-300 uppercase transition-colors hover:border-bio/50 hover:text-bio"
            >
              <TerminalSquare size={11} /> Open Sync Console
            </button>
            <span className="font-telemetry text-[9px] text-slate-500">v1.0 Pilot</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
