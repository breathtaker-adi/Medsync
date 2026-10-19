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

const PROTOCOLS = ["FHIR R4", "HL7 V2", "HIPAA", "SOC 2 · II"];

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 26, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export function Hero() {
  const [ready, setReady] = useState(false);
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
    // if boot already completed before mount, defer one frame
    // (avoids synchronous setState inside the effect body)
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
      aria-label="Medsync — medicine in sync, life on schedule"
    >
      {/* ── ambient layers ── */}
      <div aria-hidden className="absolute inset-0">
        <div className="anim-mesh absolute -top-[20%] left-1/2 h-[70vh] w-[80vw] -translate-x-1/2 rounded-full bg-bio/[0.07] blur-[130px]" />
        <div
          className="anim-mesh absolute top-[35%] -left-[15%] h-[45vh] w-[45vw] rounded-full bg-pulse/[0.06] blur-[110px]"
          style={{ animationDelay: "-7s" }}
        />
        <div className="dot-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(75%_60%_at_50%_40%,#000,transparent)]" />
        <div className="vignette absolute inset-0" />
      </div>

      {/* ── content ── */}
      <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-5 pt-32 pb-24 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-4 lg:pt-24">
        <div className="flex flex-col items-start gap-7">
          <TelemetryBadge />

          <KineticHeadline lines={HEADLINE} play={ready} />

          <motion.p
            {...rise(0.55)}
            className="max-w-lg text-base leading-relaxed text-slate-400 md:text-lg"
          >
            Medsync orchestrates prescriptions, vitals and refills across
            patients, doctors and pharmacies — one living timeline,
            zero dropped doses. The adherence engine that notices before
            anyone else does.
          </motion.p>

          <motion.div {...rise(0.7)} className="flex flex-wrap items-center gap-x-7 gap-y-4">
            <SyncButton onClick={() => scrollToId("access")}>
              Start Syncing
            </SyncButton>
            <SlideLink onClick={() => scrollToId("system")}>
              Explore Live Architecture
            </SlideLink>
          </motion.div>

          <motion.div
            {...rise(0.85)}
            className="mt-2 flex flex-wrap items-center gap-2.5 font-telemetry text-[10px] tracking-[0.2em] text-slate-500 uppercase"
          >
            {PROTOCOLS.map((p) => (
              <span
                key={p}
                className="rounded-full border border-white/8 bg-white/[0.02] px-3 py-1.5"
              >
                {p}
              </span>
            ))}
          </motion.div>
        </div>

        {/* ── 3D capsule stage ── */}
        <motion.div
          className="relative h-[420px] sm:h-[500px] lg:h-[640px]"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={ready || reduced ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 1.6, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <CapsuleScene />

          {/* floating telemetry chips */}
          <motion.div
            className="glass absolute top-[12%] right-[4%] flex items-center gap-3 rounded-2xl px-4 py-3"
            initial={{ opacity: 0, y: 16 }}
            animate={ready || reduced ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, delay: 1.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <svg width="38" height="38" viewBox="0 0 38 38" className="-rotate-90">
              <circle cx="19" cy="19" r="15.5" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="3.5" />
              <circle
                cx="19"
                cy="19"
                r="15.5"
                fill="none"
                stroke="#34d399"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="97.4"
                strokeDashoffset="14"
              />
            </svg>
            <div>
              <div className="font-telemetry text-[9px] tracking-[0.2em] text-slate-500 uppercase">
                Adherence · 7d
              </div>
              <div className="text-lg font-bold text-white">
                98<span className="text-pulse-bright">%</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="glass anim-float-soft absolute bottom-[10%] left-[2%] max-w-[240px] rounded-2xl px-4 py-3"
            initial={{ opacity: 0, y: 16 }}
            animate={ready || reduced ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, delay: 1.35, ease: [0.16, 1, 0.3, 1] }}
            style={{ animationDelay: "-3s" }}
          >
            <div className="font-telemetry text-[9px] tracking-[0.2em] text-slate-500 uppercase">
              RX #A7F3 → Crescent Pharmacy
            </div>
            <div className="mt-1 flex items-center gap-2 font-telemetry text-[11px] text-bio">
              <span className="anim-pulse-dot h-1.5 w-1.5 rounded-full bg-bio" />
              SYNCED · REFILL QUEUED
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ── scroll hint ── */}
      <motion.button
        onClick={() => scrollToId("system")}
        className="relative z-10 mx-auto mb-7 flex flex-col items-center gap-2.5"
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
