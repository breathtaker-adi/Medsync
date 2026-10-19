"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { KineticHeadline, type HeadlineWord } from "./kinetic-headline";
import { TelemetryBadge } from "./telemetry-badge";
import { CapsuleScene } from "./capsule-scene";
import { SyncButton, SlideLink } from "@/components/fx/sync-button";
import { scrollToId } from "@/lib/scroll";
import { BUS, isReady, on } from "@/lib/events";
import { useReducedMotion } from "@/hooks/use-motion-prefs";

const HEADLINE: HeadlineWord[][] = [
  [
    { text: "Medicine" },
    { text: "in" },
    { text: "Sync.", accent: "bio" },
  ],
  [
    { text: "Life" },
    { text: "on" },
    { text: "Schedule.", accent: "pulse" },
  ],
];

const CAPABILITIES = [
  { tag: "AI PRESCRIPTION OCR", tip: "Extracts medication name, dosage & schedule in seconds" },
  { tag: "DOCTOR VERIFIED", tip: "Prescription changes require clinician sign-off" },
  { tag: "CAREGIVER SYNC", tip: "Real-time push alerts to family caregivers" },
  { tag: "OFFLINE-FIRST", tip: "Local encrypted storage with seamless cloud sync" },
  { tag: "DPDP ACT 2023 READY", tip: "Engineered around Indian healthcare data privacy" },
];

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 26, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export function Hero() {
  const [ready, setReady] = useState(false);
  const [activeTip, setActiveTip] = useState<string | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    let done = false;
    const fire = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };
    const off = on(BUS.ready, fire);
    if (isReady()) {
      const id = requestAnimationFrame(fire);
      return () => {
        cancelAnimationFrame(id);
        off();
      };
    }
    return off;
  }, []);

  return (
    <section
      id="top"
      className="relative flex min-h-svh flex-col overflow-clip"
      aria-label="Medsync: medicine in sync, life on schedule"
    >
      {/* ── ambient layers ── */}
      <div aria-hidden className="absolute inset-0">
        <div className="anim-mesh absolute -top-[20%] left-1/2 h-[70vh] w-[80vw] -translate-x-1/2 rounded-full bg-bio/[0.08] blur-[130px]" />
        <div
          className="anim-mesh absolute top-[35%] -left-[15%] h-[45vh] w-[45vw] rounded-full bg-pulse/[0.06] blur-[110px]"
          style={{ animationDelay: "-7s" }}
        />
        {/* soft light bridge connecting text to capsule */}
        <div className="absolute top-1/3 left-1/3 h-[50vh] w-[40vw] -translate-x-1/4 rounded-full bg-gradient-to-r from-bio/[0.05] via-bio/[0.08] to-transparent blur-[90px]" />
        <div className="dot-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(75%_60%_at_50%_40%,#000,transparent)]" />
        <div className="vignette absolute inset-0" />
      </div>

      {/* ── content ── */}
      <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center gap-8 px-5 pt-28 pb-14 md:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:pt-20">
        <div className="flex flex-col items-start gap-6">
          <TelemetryBadge />

          <KineticHeadline lines={HEADLINE} play={ready} />

          <motion.p
            {...rise(0.55)}
            className="max-w-xl text-base leading-relaxed text-slate-300 md:text-lg"
          >
            Medsync connects prescriptions, schedules and adherence across
            patients, doctors and family caregivers into one living timeline.
            Zero dropped doses, with full offline-first resilience.
          </motion.p>

          <motion.div {...rise(0.7)} className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <SyncButton onClick={() => scrollToId("access")}>
              Download MedSync
            </SyncButton>
            <SlideLink onClick={() => scrollToId("system")}>
              Explore Live Architecture
            </SlideLink>
          </motion.div>

          {/* Interactive capabilities */}
          <motion.div {...rise(0.85)} className="relative mt-2 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 font-telemetry text-[10px] tracking-[0.18em] text-slate-400 uppercase">
              {CAPABILITIES.map((c) => (
                <button
                  key={c.tag}
                  type="button"
                  onMouseEnter={() => setActiveTip(c.tip)}
                  onMouseLeave={() => setActiveTip(null)}
                  onClick={() => setActiveTip((curr) => (curr === c.tip ? null : c.tip))}
                  className="group relative rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition-all duration-300 hover:border-bio/50 hover:bg-bio/[0.08] hover:text-white"
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-bio/60 mr-2 group-hover:bg-bio group-hover:shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
                  {c.tag}
                </button>
              ))}
            </div>
            {/* dynamic tip preview */}
            <div className="min-h-5 px-1 font-telemetry text-[10px] tracking-[0.12em] text-bio">
              {activeTip ? (
                <motion.span
                  key={activeTip}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-pulse-bright">●</span> {activeTip}
                </motion.span>
              ) : (
                <span className="text-slate-500">Tap or hover any capability to learn how it works</span>
              )}
            </div>
          </motion.div>
        </div>

        {/* ── 3D capsule stage ── */}
        <motion.div
          className="relative flex items-center justify-center h-[460px] sm:h-[540px] lg:h-[660px] w-full"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={ready || reduced ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 1.6, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <CapsuleScene />
        </motion.div>
      </div>

      {/* ── scroll hint ── */}
      <motion.button
        type="button"
        onClick={() => scrollToId("system")}
        className="relative z-10 mx-auto mb-7 flex flex-col items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bio rounded-md"
        initial={{ opacity: 0 }}
        animate={ready || reduced ? { opacity: 1 } : {}}
        transition={{ delay: 1.7, duration: 1 }}
        aria-label="Scroll to the system section"
      >
        <span className="font-telemetry text-[9px] tracking-[0.34em] text-slate-500 uppercase">
          Scroll to sync
        </span>
        <span className="relative h-10 w-px overflow-hidden bg-white/10">
          <motion.span
            className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-bio to-transparent"
            animate={reduced ? {} : { y: [-16, 44] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </span>
      </motion.button>
    </section>
  );
}
