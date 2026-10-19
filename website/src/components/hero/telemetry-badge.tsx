"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

const BARS = [9, 14, 11, 17, 12];

/**
 * Floating clinical status badge — live EHR sync readout with a jittering
 * latency figure and a micro activity equalizer.
 */
export function TelemetryBadge() {
  const [latency, setLatency] = useState(12);
  const [bars, setBars] = useState(BARS);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLatency(10 + Math.floor(Math.random() * 5));
      setBars(BARS.map(() => 7 + Math.floor(Math.random() * 12)));
    }, 1800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <motion.div
      className="glass inline-flex items-center gap-3 rounded-full px-4 py-2"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="relative flex h-2 w-2">
        <span className="anim-ping-dot absolute inline-flex h-full w-full rounded-full bg-pulse" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-pulse" />
      </span>
      <span className="font-telemetry text-[10px] tracking-[0.22em] text-slate-300 uppercase md:text-[11px]">
        Real-time EHR sync: <span className="text-pulse-bright">Active</span>
      </span>
      <span className="hidden h-3 w-px bg-white/15 sm:block" />
      <span className="hidden items-center gap-2 sm:flex">
        <span className="flex h-3.5 items-end gap-[2px]" aria-hidden>
          {bars.map((h, i) => (
            <motion.span
              key={i}
              className="w-[2px] rounded-sm bg-bio/80"
              animate={{ height: h }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          ))}
        </span>
        <span className="font-telemetry text-[10px] tracking-[0.18em] text-bio md:text-[11px]">
          [{latency}ms]
        </span>
      </span>
    </motion.div>
  );
}
