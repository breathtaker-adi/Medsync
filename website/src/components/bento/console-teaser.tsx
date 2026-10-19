"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { TerminalSquare, ArrowUpRight } from "lucide-react";
import { Magnetic } from "@/components/fx/magnetic";
import { BorderBeam, CornerTicks } from "@/components/fx/atoms";
import { BUS, emit } from "@/lib/events";

const FRAME_EVENTS = [
  "PRESCRIPTION_SYNCED · 200 OK · 11ms",
  "EHR_FHIR_BUNDLE · 200 OK · 14ms",
  "DOSE_REMINDER_DISPATCH · 200 OK · 9ms",
  "REFILL_APPROVED · 200 OK · 16ms",
  "VITALS_STREAM_TICK · 200 OK · 7ms",
  "PHARMACY_INVENTORY_DELTA · 200 OK · 19ms",
];

/**
 * Full-width teaser strip — a live frame ticker that invites the visitor
 * into the sync console.
 */
export function ConsoleTeaser({ className = "" }: { className?: string }) {
  const [frames, setFrames] = useState(1204);
  const [event, setEvent] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrames((f) => f + Math.floor(Math.random() * 4) + 1);
      setEvent((e) => (e + 1) % FRAME_EVENTS.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <motion.div
      className={`group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-white/8 bg-white/[0.02] p-5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:p-6 ${className}`}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      data-cursor="hover"
    >
      <BorderBeam soft />
      <CornerTicks inset={10} />

      <div className="flex items-center gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-bio/25 bg-bio/10 text-bio">
          <TerminalSquare size={17} aria-hidden="true" focusable="false" />
        </span>
        <div>
          <div className="font-telemetry text-[10px] tracking-[0.24em] text-slate-400 uppercase">
            sys.cloud — Sync Console
          </div>
          <div className="mt-0.5 font-telemetry text-[9px] tracking-[0.12em] text-slate-500">
            <span className="tabular-nums text-pulse-bright">
              {frames.toLocaleString()}
            </span>{" "}
            frames/min · zero drops
          </div>
        </div>
      </div>

      <div className="flex min-h-5 flex-1 items-center justify-start px-1 font-telemetry text-[10px] tracking-[0.1em] sm:justify-center">
        <motion.span
          key={event}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-slate-400"
        >
          <span className="text-bio">→</span>{" "}
          {FRAME_EVENTS[event]}
        </motion.span>
      </div>

      <Magnetic strength={0.25}>
        <button
          type="button"
          onClick={() => emit(BUS.consoleOpen)}
          className="group/btn relative flex items-center gap-2 self-start rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 font-telemetry text-[10px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:border-bio/50 hover:text-bio focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bio sm:self-auto"
          data-cursor="hover"
          aria-label="Open the live sync console"
        >
          Open Console
          <ArrowUpRight
            size={13}
            aria-hidden="true"
            focusable="false"
            className="transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5"
          />
        </button>
      </Magnetic>
    </motion.div>
  );
}
