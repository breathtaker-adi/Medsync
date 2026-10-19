"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ScanText, CheckCircle2, RefreshCw } from "lucide-react";
import { HologramCard, CardHeader } from "./hologram-card";

interface SampleRx {
  id: string;
  name: string;
  dosage: string;
  timing: string;
  confidence: number;
}

const SAMPLES: SampleRx[] = [
  { id: "1", name: "Metformin HCl", dosage: "500 mg", timing: "Twice daily (post-meal)", confidence: 99.4 },
  { id: "2", name: "Atorvastatin", dosage: "20 mg", timing: "Once daily at night", confidence: 98.8 },
  { id: "3", name: "Amlodipine", dosage: "5 mg", timing: "Once daily morning", confidence: 99.1 },
];

export function OcrScannerCard({ className = "" }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [scanning, setScanning] = useState(false);

  const current = SAMPLES[index];

  const handleScan = () => {
    if (scanning) return;
    setScanning(true);
    setTimeout(() => {
      setIndex((i) => (i + 1) % SAMPLES.length);
      setScanning(false);
    }, 700);
  };

  return (
    <HologramCard className={className} label="AI Prescription Scanner" spotlightColor="rgba(0,240,255,0.06)">
      <div className="flex h-full flex-col justify-between p-5 md:p-6">
        <div className="flex items-center justify-between">
          <CardHeader
            icon={<ScanText size={13} />}
            title="AI Prescription OCR"
            chip={scanning ? "SCANNING" : "READY"}
            chipTone={scanning ? "pulse" : "bio"}
          />
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 font-telemetry text-[9px] text-slate-300 transition-colors hover:border-bio/40 hover:text-bio"
            aria-label="Scan next prescription sample"
          >
            <RefreshCw size={10} className={scanning ? "animate-spin text-bio" : ""} />
            Rescan
          </button>
        </div>

        {/* Viewfinder frame */}
        <div className="relative my-3 flex flex-col justify-between overflow-hidden rounded-xl border border-bio/20 bg-[#040811] p-3">
          {/* Scanning beam */}
          {scanning && (
            <motion.div
              className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-bio to-transparent shadow-[0_0_12px_#00f0ff]"
              initial={{ top: "0%" }}
              animate={{ top: "100%" }}
              transition={{ duration: 0.65, ease: "linear", repeat: Infinity }}
            />
          )}

          {/* Corner crosshairs */}
          <span className="absolute top-1.5 left-1.5 h-2 w-2 border-t-2 border-l-2 border-bio/60" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 border-t-2 border-r-2 border-bio/60" />
          <span className="absolute bottom-1.5 left-1.5 h-2 w-2 border-b-2 border-l-2 border-bio/60" />
          <span className="absolute bottom-1.5 right-1.5 h-2 w-2 border-b-2 border-r-2 border-bio/60" />

          {/* Document readout */}
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between font-telemetry text-[8px] tracking-[0.14em] text-slate-400 uppercase">
                <span>DETECTED MEDICATION</span>
                <span className="text-pulse-bright">{current.confidence}% CONFIDENCE</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-white">{current.name}</span>
                <span className="font-telemetry text-[11px] font-semibold text-bio">{current.dosage}</span>
              </div>
              <div className="rounded border border-white/6 bg-white/[0.02] px-2 py-1 font-telemetry text-[9px] text-slate-300">
                Schedule: {current.timing}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer verification notice */}
        <div className="flex items-center justify-between border-t border-white/6 pt-2.5 font-telemetry text-[9px] tracking-[0.14em] text-slate-400">
          <span className="flex items-center gap-1.5 text-slate-300">
            <CheckCircle2 size={11} className="text-pulse-bright" />
            Doctor sign-off required
          </span>
          <span className="text-bio">&lt; 2.0s parse</span>
        </div>
      </div>
    </HologramCard>
  );
}
