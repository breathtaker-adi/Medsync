"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence, animate } from "motion/react";
import { Activity, Check, Pill as PillIcon, RotateCcw } from "lucide-react";
import { HologramCard, CardHeader } from "./hologram-card";
import { useReducedMotion } from "@/hooks/use-motion-prefs";

interface Med {
  name: string;
  dose: string;
}
interface Slot {
  slot: "morning" | "afternoon" | "night";
  time: string;
  meds: Med[];
}

const SCHEDULE: Slot[] = [
  {
    slot: "morning",
    time: "08:00",
    meds: [
      { name: "Metformin", dose: "500mg" },
      { name: "Lisinopril", dose: "10mg" },
    ],
  },
  {
    slot: "afternoon",
    time: "13:00",
    meds: [{ name: "Atorvastatin", dose: "40mg" }],
  },
  {
    slot: "night",
    time: "20:00",
    meds: [
      { name: "Amlodipine", dose: "5mg" },
      { name: "Aspirin", dose: "81mg" },
    ],
  },
];

const TOTAL = SCHEDULE.reduce((n, s) => n + s.meds.length, 0);
const RING_R = 50;
const RING_C = 2 * Math.PI * RING_R;

interface Burst {
  id: number;
  x: number;
  y: number;
  big: boolean;
}

export function AdherenceCard({ className = "" }: { className?: string }) {
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [display, setDisplay] = useState(0);
  const burstId = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const score = Math.round((taken.size / TOTAL) * 100);
  const perfect = score === 100;

  const countTo = useCallback(
    (target: number) => {
      if (reduced) {
        setDisplay(target);
        return;
      }
      animate(display, target, {
        duration: 0.7,
        ease: [0.16, 1, 0.3, 1],
        onUpdate: (v) => setDisplay(Math.round(v)),
      });
    },
    [display, reduced]
  );

  const toggle = (key: string, e: React.MouseEvent) => {
    const next = new Set(taken);
    const isTaking = !next.has(key);
    if (isTaking) next.add(key);
    else next.delete(key);
    setTaken(next);
    const nextScore = Math.round((next.size / TOTAL) * 100);
    countTo(nextScore);

    if (isTaking && !reduced) {
      const card = cardRef.current;
      if (card) {
        const rect = card.getBoundingClientRect();
        const id = ++burstId.current;
        setBursts((b) => [
          ...b,
          {
            id,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            big: nextScore === 100,
          },
        ]);
        window.setTimeout(
          () => setBursts((b) => b.filter((p) => p.id !== id)),
          950
        );
      }
    }
  };

  const reset = () => {
    setTaken(new Set());
    countTo(0);
  };

  return (
    <HologramCard
      className={className}
      label="Live medication adherence tracker"
    >
      <div ref={cardRef} className="flex h-full flex-col gap-6 p-6 md:p-7">
        <CardHeader
          icon={<Activity size={13} />}
          title="Live Medication Adherence"
          chip={perfect ? "PERFECT DAY" : "TAP DOSES TO SIMULATE"}
          chipTone={perfect ? "pulse" : "bio"}
        />

        <div className="flex flex-1 flex-col items-center justify-center gap-6 sm:flex-row sm:gap-8">
          {/* score ring */}
          <div className="relative shrink-0" role="img" aria-label={`Adherence score ${score} percent`}>
            <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
              <circle cx="66" cy="66" r={RING_R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
              <motion.circle
                cx="66"
                cy="66"
                r={RING_R}
                fill="none"
                stroke={perfect ? "#34d399" : "#00f0ff"}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                animate={{ strokeDashoffset: RING_C * (1 - score / 100) }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  filter: `drop-shadow(0 0 8px ${perfect ? "rgba(52,211,153,0.7)" : "rgba(0,240,255,0.6)"})`,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={`text-3xl font-extrabold tabular-nums tracking-tight ${
                  perfect ? "text-pulse-bright text-glow-pulse" : "text-white"
                }`}
                aria-live="polite"
              >
                {display}%
              </span>
              <span className="font-telemetry text-[8px] tracking-[0.24em] text-slate-500 uppercase">
                Today
              </span>
            </div>
          </div>

          {/* dose slots */}
          <div className="flex w-full max-w-md flex-col gap-3">
            {SCHEDULE.map((s) => (
              <div key={s.slot} className="flex items-start gap-3">
                <div className="w-14 shrink-0 pt-1.5">
                  <div className="font-telemetry text-[10px] font-semibold text-bio">
                    {s.time}
                  </div>
                  <div className="font-telemetry text-[8px] tracking-[0.18em] text-slate-500 uppercase">
                    {s.slot}
                  </div>
                </div>
                <div className="flex flex-1 flex-wrap gap-2">
                  {s.meds.map((m, i) => {
                    const key = `${s.slot}-${i}`;
                    const isTaken = taken.has(key);
                    return (
                      <button
                        key={key}
                        onClick={(e) => toggle(key, e)}
                        aria-pressed={isTaken}
                        aria-label={`${m.name} ${m.dose}, ${isTaken ? "taken" : "not taken"}`}
                        className={`group flex items-center gap-2 rounded-full border px-3.5 py-2 font-telemetry text-[10px] tracking-[0.06em] transition-all duration-300 ${
                          isTaken
                            ? "border-pulse/50 bg-pulse/12 text-pulse-bright"
                            : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-bio/40 hover:text-white"
                        }`}
                      >
                        {isTaken ? (
                          <Check size={11} strokeWidth={3} />
                        ) : (
                          <PillIcon size={11} className="opacity-60" />
                        )}
                        <span className={isTaken ? "line-through decoration-pulse/60" : ""}>
                          {m.name} {m.dose}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/6 pt-4 font-telemetry text-[9px] tracking-[0.18em] text-slate-500 uppercase">
          <span>
            Streak · <span className="text-pulse-bright">18 days</span> · next
            window 20:00–21:30
          </span>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-slate-500 transition-colors hover:text-bio"
            aria-label="Reset simulated doses"
          >
            <RotateCcw size={11} /> RESET
          </button>
        </div>
      </div>

      {/* particle bursts */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
        <AnimatePresence>
          {bursts.map((b) => (
            <BurstParticles key={b.id} x={b.x} y={b.y} big={b.big} />
          ))}
        </AnimatePresence>
      </div>
    </HologramCard>
  );
}

function BurstParticles({ x, y, big }: { x: number; y: number; big: boolean }) {
  const count = big ? 26 : 12;
  const parts = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const dist = (big ? 46 : 26) + Math.random() * (big ? 58 : 34);
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      color: i % 3 === 0 ? "#34d399" : i % 3 === 1 ? "#00f0ff" : "#eafcff",
      size: 2 + Math.random() * 3,
      delay: Math.random() * 0.08,
    };
  });

  return (
    <motion.div
      className="absolute"
      style={{ left: x, top: y }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {parts.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 6px ${p.color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0.3 }}
          transition={{ duration: 0.85, delay: p.delay, ease: [0.11, 0.79, 0.24, 1] }}
        />
      ))}
    </motion.div>
  );
}
