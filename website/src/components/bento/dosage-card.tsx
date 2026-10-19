"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Calculator, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { HologramCard, CardHeader } from "./hologram-card";

const BASE_HOUR = 8; // "now" is 08:00

function fmt(h: number) {
  const hh = Math.floor(((h % 24) + 24) % 24);
  return `${String(hh).padStart(2, "0")}:00`;
}

type Verdict = {
  tone: "coral" | "amber" | "pulse";
  title: string;
  detail: string;
};

function judge(interval: number): Verdict {
  if (interval < 6)
    return {
      tone: "coral",
      title: "INTERVAL TOO SHORT",
      detail: `Accumulation risk at ${interval}h — hepatic clearance needs ≥6h.`,
    };
  if (interval < 8)
    return {
      tone: "amber",
      title: "TIGHT CADENCE",
      detail: `${interval}h works, but wearables should watch vitals closely.`,
    };
  return {
    tone: "pulse",
    title: "SAFE CADENCE",
    detail: `${interval}h spacing — clearance optimal, zero conflicts.`,
  };
}

/**
 * Interactive dosage calculator — drag the interval, watch the 24h timeline
 * re-lay doses and the clinical verdict flip with animated alerts.
 */
export function DosageCard({ className = "" }: { className?: string }) {
  const [interval, setIntervalH] = useState(8);

  const doses = useMemo(() => {
    const marks = [BASE_HOUR, BASE_HOUR + interval, BASE_HOUR + interval * 2];
    return marks.map((h, i) => ({
      hour: h,
      pct: ((h % 24) / 24) * 100,
      nextDay: h >= 24,
      i,
    }));
  }, [interval]);

  const verdict = judge(interval);
  const toneMap = {
    coral: {
      chip: "border-coral/25 bg-coral/10 text-coral",
      text: "text-coral",
      glow: "text-glow-coral",
      icon: <AlertTriangle size={14} />,
      dot: "bg-coral",
    },
    amber: {
      chip: "border-amber-clin/25 bg-amber-clin/10 text-amber-clin",
      text: "text-amber-clin",
      glow: "",
      icon: <AlertTriangle size={14} />,
      dot: "bg-amber-clin",
    },
    pulse: {
      chip: "border-pulse/25 bg-pulse/10 text-pulse-bright",
      text: "text-pulse-bright",
      glow: "text-glow-pulse",
      icon: <CheckCircle2 size={14} />,
      dot: "bg-pulse",
    },
  }[verdict.tone];

  return (
    <HologramCard className={className} label="Interactive dosage calculator" spotlightColor="rgba(245,185,66,0.05)">
      <div className="flex h-full flex-col gap-5 p-6">
        <CardHeader
          icon={<Calculator size={13} />}
          title="Interactive Dosage Calculator"
          chip={`${interval}H INTERVAL`}
          chipTone={verdict.tone === "coral" ? "coral" : verdict.tone === "amber" ? "amber" : "pulse"}
        />

        {/* timeline */}
        <div className="relative pt-7">
          <div className="relative h-9 rounded-lg border border-white/8 bg-white/[0.02]">
            {/* hour ticks */}
            {[0, 6, 12, 18].map((h) => (
              <span
                key={h}
                className="absolute top-0 bottom-0 w-px bg-white/6"
                style={{ left: `${(h / 24) * 100}%` }}
              />
            ))}
            <span className="absolute -top-5 left-0 font-telemetry text-[8px] tracking-[0.14em] text-slate-600">
              00:00
            </span>
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-telemetry text-[8px] tracking-[0.14em] text-slate-600">
              12:00
            </span>
            <span className="absolute -top-5 right-0 font-telemetry text-[8px] tracking-[0.14em] text-slate-600">
              24:00
            </span>

            {/* now marker */}
            <span
              className="absolute -top-1 -bottom-1 w-px bg-white/30"
              style={{ left: `${(BASE_HOUR / 24) * 100}%` }}
            >
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-sm bg-white/10 px-1 font-telemetry text-[7.5px] text-slate-300">
                NOW
              </span>
            </span>

            {/* doses */}
            {doses.map((d) => (
              <motion.span
                key={d.i}
                layout
                className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                  d.nextDay
                    ? "border-bio/40 bg-obsidian"
                    : "border-bio bg-bio/25 shadow-[0_0_12px_rgba(0,240,255,0.55)]"
                }`}
                style={{ left: `${d.pct}%` }}
                animate={{ left: `${d.pct}%` }}
                transition={{ type: "spring", stiffness: 170, damping: 20 }}
              />
            ))}
          </div>
        </div>

        {/* slider */}
        <div className="medsync-range px-1">
          <Slider
            value={[interval]}
            onValueChange={(v) => setIntervalH(v[0])}
            min={4}
            max={24}
            step={1}
            aria-label="Dose interval in hours"
          />
          <div className="mt-2.5 flex justify-between font-telemetry text-[8px] tracking-[0.16em] text-slate-600">
            <span>4H</span>
            <span>12H</span>
            <span>24H</span>
          </div>
        </div>

        {/* readouts + verdict */}
        <div className="mt-auto flex flex-col gap-3.5">
          <div className="flex flex-wrap gap-x-6 gap-y-2 font-telemetry text-[10px] tracking-[0.12em]">
            {doses.slice(0, 2).map((d) => (
              <span key={d.i} className="flex items-center gap-1.5 text-slate-400">
                <Clock size={11} className="text-bio" />
                DOSE {d.i + 1} · <span className="text-white">{fmt(d.hour)}</span>
                {d.nextDay && <span className="text-slate-600">(+1D)</span>}
              </span>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={verdict.tone + interval}
              initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${toneMap.chip}`}
              role="status"
            >
              {toneMap.icon}
              <div>
                <div className={`font-telemetry text-[10px] font-bold tracking-[0.18em] ${toneMap.text} ${toneMap.glow}`}>
                  {verdict.title}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">{verdict.detail}</div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </HologramCard>
  );
}
