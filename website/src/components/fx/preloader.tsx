"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useReducedMotion } from "@/hooks/use-motion-prefs";
import { getLenis } from "@/lib/scroll";
import { BUS, emit, markReady } from "@/lib/events";

const BOOT_LINES = [
  { at: 8, text: "LINKING EHR PROVIDERS", status: "OK" },
  { at: 34, text: "CALIBRATING SYNC MATRIX", status: "OK" },
  { at: 62, text: "PHARMACY HANDSHAKE · 12MS", status: "OK" },
  { at: 86, text: "ADHERENCE ENGINE ONLINE", status: "OK" },
];

type Phase = "loading" | "exit" | "gone";

/**
 * Boot sequence — locks scroll, runs a telemetry-style boot readout with an
 * eased 0→100 counter, then wipes upward to reveal the hero. Skipped entirely
 * for prefers-reduced-motion.
 */
export function Preloader() {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const progressRef = useRef(0);

  // reduced motion → immediately mark ready, render nothing
  useEffect(() => {
    if (!reduced) return;
    markReady();
    emit(BUS.ready);
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    // If already booted in this session, skip immediately
    if (typeof window !== "undefined" && sessionStorage.getItem("medsync_booted") === "true") {
      markReady();
      emit(BUS.ready);
      setPhase("gone");
      return;
    }

    const lenis = getLenis();
    lenis?.stop();
    document.body.style.overflow = "hidden";

    const DURATION = 700;
    const t0 = performance.now();
    let raf = 0;
    let finished = false;

    const unlock = () => {
      document.body.style.overflow = "";
      getLenis()?.start();
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      try {
        sessionStorage.setItem("medsync_booted", "true");
      } catch {}
      setProgress(100);
      markReady();
      emit(BUS.ready);
      unlock();
      setPhase("exit");
      window.setTimeout(() => {
        setPhase("gone");
      }, 500);
    };

    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / DURATION);
      const eased = 1 - Math.pow(1 - k, 2.4);
      progressRef.current = Math.round(eased * 100);
      setProgress(progressRef.current);
      if (k < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        finish();
      }
    };
    raf = requestAnimationFrame(tick);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        finish();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      unlock();
    };
  }, [reduced]);

  if (reduced || phase === "gone") return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[90] flex cursor-pointer flex-col items-center justify-center bg-obsidian select-none"
        initial={{ y: 0 }}
        animate={phase === "exit" ? { y: "-100%" } : { y: 0 }}
        transition={{ duration: 0.55, ease: [0.83, 0, 0.17, 1] }}
        onClick={() => {
          try {
            sessionStorage.setItem("medsync_booted", "true");
          } catch {}
          setProgress(100);
          markReady();
          emit(BUS.ready);
          document.body.style.overflow = "";
          getLenis()?.start();
          setPhase("exit");
          window.setTimeout(() => setPhase("gone"), 450);
        }}
        aria-label="Click to skip preloader"
      >
          {/* faint grid backdrop */}
          <div className="blueprint-grid absolute inset-0 opacity-60 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_50%,rgba(0,240,255,0.05),transparent_70%)] pointer-events-none" />

          <motion.div
            className="relative flex flex-col items-center"
            animate={phase === "exit" ? { opacity: 0, y: -24 } : { opacity: 1 }}
            transition={{ duration: 0.35, ease: "easeIn" }}
          >
            {/* capsule mark */}
            <div className="relative mb-8">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <rect
                  x="20"
                  y="13"
                  width="24"
                  height="38"
                  rx="12"
                  stroke="url(#pl-g)"
                  strokeWidth="3"
                />
                <line x1="20" y1="32" x2="44" y2="32" stroke="url(#pl-g)" strokeWidth="3" />
                <defs>
                  <linearGradient id="pl-g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#00F0FF" />
                    <stop offset="1" stopColor="#10B981" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="anim-ping-dot absolute inset-0 -z-10 rounded-full bg-bio/10" />
            </div>

            {/* ECG line */}
            <svg
              width="220"
              height="36"
              viewBox="0 0 220 36"
              fill="none"
              className="mb-8 overflow-visible"
            >
              <path
                d="M0 18 H60 L70 18 76 6 84 30 92 12 98 18 H130 L138 18 144 2 152 34 160 10 166 18 H220"
                stroke="#00F0FF"
                strokeWidth="1.6"
                strokeLinecap="round"
                className="anim-ecg"
                opacity="0.9"
              />
            </svg>

            {/* boot readout */}
            <div className="flex h-24 w-[280px] flex-col gap-1.5 font-telemetry text-[10px] tracking-[0.14em]">
              {BOOT_LINES.map((line) => {
                const active = progress >= line.at;
                return (
                  <div
                    key={line.text}
                    className={`flex items-center justify-between transition-colors duration-300 ${
                      active ? "text-slate-300" : "text-slate-600/40"
                    }`}
                  >
                    <span>
                      {active ? "▸" : "·"} {line.text}
                    </span>
                    <span className={active ? "text-pulse" : "text-slate-700"}>
                      {active ? `[${line.status}]` : "[···]"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* progress rail */}
            <div className="mt-8 h-px w-[280px] overflow-hidden bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-bio to-pulse transition-[width] duration-150 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* skip prompt */}
            <div className="mt-5 font-telemetry text-[9px] tracking-[0.25em] text-slate-500 hover:text-bio transition-colors uppercase">
              [ CLICK OR PRESS ESC TO ENTER ]
            </div>
          </motion.div>

          {/* counter */}
          <motion.div
            className="absolute right-6 bottom-6 font-telemetry text-6xl font-bold tabular-nums text-white/12 md:right-10 md:bottom-8 md:text-8xl"
            animate={phase === "exit" ? { opacity: 0 } : { opacity: 1 }}
          >
            {String(progress).padStart(3, "0")}
          </motion.div>

          <div className="absolute bottom-6 left-6 font-telemetry text-[10px] tracking-[0.3em] text-slate-600 uppercase md:bottom-8 md:left-10">
            medsync · boot v3.2.1
          </div>
      </motion.div>
    </AnimatePresence>
  );
}
