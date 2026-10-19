"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users2,
  ShieldCheck,
  HeartPulse,
  TerminalSquare,
  BellRing,
  CheckCircle2,
  Download,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { BorderBeam, CornerTicks } from "@/components/fx/atoms";
import { BUS, emit } from "@/lib/events";

export function CaregiverSyncCard({ className = "" }: { className?: string }) {
  // Module 1: Caregiver Escalation State
  const [escalated, setEscalated] = useState(false);
  const [escalateCooldown, setEscalateCooldown] = useState(false);

  // Module 2: Doctor Sign-Off Loop State
  const [rxConfirmed, setRxConfirmed] = useState(true);

  // Module 3: Export feedback state
  const [exported, setExported] = useState(false);

  // Trigger Caregiver Escalation Simulation
  const handleSimulateEscalation = () => {
    if (escalateCooldown) return;
    setEscalated(true);
    setEscalateCooldown(true);

    emit(BUS.consoleLog, {
      event: "CAREGIVER_ESCALATION_TRIGGERED",
      detail: "patient:PX-4029 · dose:morning_metformin (+35m overdue) → push+sms dispatch to Ananya",
      status: "201 CREATED",
      latency: 14,
      tone: "warn",
    });

    setTimeout(() => {
      setEscalateCooldown(false);
    }, 4000);
  };

  // Reset Caregiver Alert
  const handleResetEscalation = () => {
    setEscalated(false);
    emit(BUS.consoleLog, {
      event: "CAREGIVER_ALERT_CLEARED",
      detail: "dose_logged:confirmed by patient · escalation suppressed",
      status: "200 OK",
      latency: 9,
      tone: "ok",
    });
  };

  // Toggle Doctor Confirmation
  const handleToggleDoctorReview = () => {
    const nextState = !rxConfirmed;
    setRxConfirmed(nextState);

    emit(BUS.consoleLog, {
      event: nextState ? "CLINICIAN_RX_VERIFIED" : "CLINICIAN_REVIEW_REQUESTED",
      detail: nextState
        ? "Dr. Anand (Cardiology, Reg #MMC-84920) · dosage approved: Atorvastatin 20mg OD"
        : "AI OCR scan submitted · awaiting clinician manual confirmation",
      status: nextState ? "200 OK" : "201 CREATED",
      latency: 12,
      tone: nextState ? "ok" : "warn",
    });
  };

  // Export Encrypted Vault JSON (DPDP Act 2023 compliance)
  const handleExportVault = () => {
    setExported(true);

    const vaultData = {
      standard: "DPDP_ACT_2023_INDIA",
      compliance: {
        consent_model: "EXPLICIT_REVOCABLE",
        local_encryption: "AES-256-GCM_SQLCIPHER",
        zero_third_party_telemetry: true,
      },
      patient: {
        id_hash: "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        vault_version: "1.0.0-rc",
        exported_at: new Date().toISOString(),
      },
      active_prescriptions: [
        {
          medication: "Metformin Hydrochloride",
          dosage: "500 mg",
          frequency: "Twice daily after meals",
          prescribed_by: "Dr. Anand (Cardiology)",
          verified_status: rxConfirmed ? "VERIFIED" : "PENDING_REVIEW",
          local_integrity: "SHA256_VALID",
        },
        {
          medication: "Atorvastatin Calcium",
          dosage: "20 mg",
          frequency: "Once daily at bedtime",
          prescribed_by: "Dr. Anand (Cardiology)",
          verified_status: rxConfirmed ? "VERIFIED" : "PENDING_REVIEW",
          local_integrity: "SHA256_VALID",
        },
      ],
      caregiver_linkages: [
        {
          relation: "Daughter (Ananya)",
          channel: "ENCRYPTED_PUSH_WEBSOCKET",
          escalation_window_mins: 30,
          status: "ACTIVE",
        },
      ],
    };

    const blob = new Blob([JSON.stringify(vaultData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medsync-vault-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    emit(BUS.consoleLog, {
      event: "DPDP_DATA_EXPORT_GENERATED",
      detail: "export:sanitized_vault.json · patient_rights:DPDP_SEC_11 · 0 cloud leakage",
      status: "200 OK",
      latency: 8,
      tone: "ok",
    });

    setTimeout(() => setExported(false), 3000);
  };

  return (
    <motion.div
      className={`group relative overflow-hidden rounded-3xl border border-white/8 bg-[#061017]/95 p-5 backdrop-blur-xl md:p-6 ${className}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <BorderBeam soft />
      <CornerTicks inset={10} />

      {/* Card Section Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/6 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-bio/30 bg-bio/10 text-bio">
            <Users2 size={13} />
          </span>
          <span className="font-telemetry text-xs font-semibold tracking-[0.16em] text-white uppercase">
            Caregiver &amp; Clinical Safety Loop
          </span>
        </div>
        <div className="flex items-center gap-2 font-telemetry text-[10px] tracking-[0.14em] text-slate-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-pulse animate-pulse" />
          <span>REACTIVE TELEMETRY ACTIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Module 1: Caregiver Escalation */}
        <div
          className={`flex flex-col justify-between rounded-2xl border p-4.5 transition-all duration-300 ${
            escalated
              ? "border-coral/50 bg-coral/[0.06] shadow-[0_0_24px_rgba(255,92,92,0.15)]"
              : "border-white/8 bg-white/[0.02] hover:border-white/16"
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-telemetry text-[10px] tracking-[0.18em] text-bio uppercase">
                <Users2 size={13} className="text-bio" /> Caregiver Escalation
              </span>
              <span
                className={`font-telemetry text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                  escalated ? "bg-coral/20 text-coral" : "bg-pulse/15 text-pulse-bright"
                }`}
              >
                {escalated ? "ALERT ACTIVE" : "SYNCED"}
              </span>
            </div>
            <div className="mt-2 text-sm font-semibold text-white">Ananya (Daughter)</div>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-300">
              Push alert dispatches automatically if morning dose isn't logged within 30 minutes of the window.
            </p>

            <AnimatePresence>
              {escalated && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2.5 flex items-center gap-2 rounded-lg bg-coral/15 border border-coral/30 px-2.5 py-1.5 font-telemetry text-[10px] text-coral"
                >
                  <AlertTriangle size={12} className="shrink-0" />
                  <span>Push notification sent to daughter · +91 98***</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-4 flex items-center gap-2 pt-2 border-t border-white/6">
            {!escalated ? (
              <button
                type="button"
                onClick={handleSimulateEscalation}
                disabled={escalateCooldown}
                className="flex items-center gap-1.5 rounded-lg border border-coral/30 bg-coral/10 px-3 py-1.5 font-telemetry text-[10px] tracking-[0.1em] text-coral uppercase transition-all duration-200 hover:bg-coral/20 hover:border-coral/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-coral"
              >
                <BellRing size={12} />
                Simulate Missed Dose
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResetEscalation}
                className="flex items-center gap-1.5 rounded-lg border border-pulse/30 bg-pulse/10 px-3 py-1.5 font-telemetry text-[10px] tracking-[0.1em] text-pulse-bright uppercase transition-all duration-200 hover:bg-pulse/20 hover:border-pulse/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-pulse"
              >
                <RotateCcw size={12} />
                Acknowledge Dose
              </button>
            )}
            <span className="ml-auto font-telemetry text-[9px] text-slate-500">
              {escalated ? "Triggered" : "30m window"}
            </span>
          </div>
        </div>

        {/* Module 2: Doctor Sign-Off Loop */}
        <div
          className={`flex flex-col justify-between rounded-2xl border p-4.5 transition-all duration-300 ${
            rxConfirmed
              ? "border-pulse/30 bg-pulse/[0.03]"
              : "border-amber-clin/40 bg-amber-clin/[0.04]"
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-telemetry text-[10px] tracking-[0.18em] text-pulse-bright uppercase">
                <HeartPulse size={13} className="text-pulse-bright" /> Doctor Care Loop
              </span>
              <span
                className={`font-telemetry text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                  rxConfirmed ? "bg-pulse/15 text-pulse-bright" : "bg-amber-clin/20 text-amber-clin"
                }`}
              >
                {rxConfirmed ? "VERIFIED" : "PENDING"}
              </span>
            </div>
            <div className="mt-2 text-sm font-semibold text-white">Dr. Anand (Cardiology)</div>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-300">
              Prescriptions scanned via AI require clinician confirmation. No automatic dosage changes without sign-off.
            </p>

            <div className="mt-2.5 flex items-center gap-1.5 font-telemetry text-[10px] text-slate-400">
              <CheckCircle2 size={12} className={rxConfirmed ? "text-pulse-bright" : "text-amber-clin"} />
              <span>
                {rxConfirmed
                  ? "Digital signature verified · MMC-84920"
                  : "Awaiting practitioner sign-off review"}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 pt-2 border-t border-white/6">
            <button
              type="button"
              onClick={handleToggleDoctorReview}
              className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 font-telemetry text-[10px] tracking-[0.1em] text-slate-200 uppercase transition-all duration-200 hover:border-bio/50 hover:bg-bio/10 hover:text-bio focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bio"
            >
              <HeartPulse size={12} />
              {rxConfirmed ? "Simulate Review Request" : "Confirm Regimen"}
            </button>
            <span className="ml-auto font-telemetry text-[9px] text-slate-500">
              Portal v2.4
            </span>
          </div>
        </div>

        {/* Module 3: Security & DPDP Vault */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/8 bg-white/[0.02] p-4.5 hover:border-white/16 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-telemetry text-[10px] tracking-[0.18em] text-bio uppercase">
                <ShieldCheck size={13} className="text-bio" /> Patient Privacy
              </span>
              <span className="font-telemetry text-[9px] font-semibold px-2 py-0.5 rounded-full bg-bio/15 text-bio uppercase">
                DPDP 2023
              </span>
            </div>
            <div className="mt-2 text-sm font-semibold text-white">Encrypted &amp; DPDP Ready</div>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-300">
              You own your data. End-to-end encrypted in transit, cached locally, and fully exportable on demand.
            </p>

            <div className="mt-2.5 font-telemetry text-[10px] text-slate-400">
              <span>On-device SQLite · AES-256-GCM cipher</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-white/6">
            <button
              type="button"
              onClick={handleExportVault}
              className="flex items-center gap-1.5 rounded-lg border border-bio/30 bg-bio/10 px-2.5 py-1.5 font-telemetry text-[9.5px] tracking-[0.1em] text-bio uppercase transition-all duration-200 hover:bg-bio/20 hover:border-bio/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bio"
            >
              <Download size={11} />
              {exported ? "Exported!" : "Export Vault JSON"}
            </button>
            <button
              type="button"
              onClick={() => emit(BUS.consoleOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-telemetry text-[9.5px] tracking-[0.1em] text-slate-300 uppercase transition-all duration-200 hover:border-white/30 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bio"
            >
              <TerminalSquare size={11} /> Open Console
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

