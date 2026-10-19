"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Pause, Play, Trash2, ChevronUp, Radio } from "lucide-react";
import { BUS, on } from "@/lib/events";
import { useReducedMotion } from "@/hooks/use-motion-prefs";

interface Frame {
  id: number;
  time: string;
  dir: "↑" | "↓";
  event: string;
  detail: string;
  status: "200 OK" | "201 CREATED" | "RETRYING";
  latency: number;
  tone: "ok" | "warn" | "info";
}

const EVENT_POOL: Array<{ event: string; detail: () => string; tone: Frame["tone"] }> = [
  { event: "PRESCRIPTION_SYNCED", detail: () => `rx:#${randHex(4)} → local_vault 1.2kb`, tone: "info" },
  { event: "OCR_VISION_PARSE", detail: () => `med:metformin 500mg · conf:99.2%`, tone: "ok" },
  { event: "DOSE_REMINDER_DISPATCH", detail: () => `patient:#${randHex(4)} · channel:push+alarm`, tone: "ok" },
  { event: "DOCTOR_REVIEW_STATUS", detail: () => `clinician:verified · schedule:active`, tone: "info" },
  { event: "VAULT_LOCAL_ENCRYPT", detail: () => `sqlite:ok · 0 pending ops`, tone: "ok" },
  { event: "CAREGIVER_NOTIFICATION", detail: () => `recipient:daughter · status:delivered`, tone: "ok" },
  { event: "INTERACTION_CHECK", detail: () => `pairs:34 scanned · 0 conflicts`, tone: "ok" },
  { event: "CAREGIVER_DIGEST", detail: () => `streak:18d · adherence:100%`, tone: "info" },
  { event: "WS_HEARTBEAT", detail: () => `ping 11ms · connection stable`, tone: "info" },
  { event: "RECONNECT_BACKOFF", detail: () => `attempt:${1 + rnd(3)} · waiting ${80 + rnd(140)}ms`, tone: "warn" },
];

function rnd(n: number) {
  return Math.floor(Math.random() * n);
}
function randHex(n: number) {
  return Array.from({ length: n }, () => "0123456789ABCDEF"[rnd(16)]).join("");
}
function stamp() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(
    d.getSeconds()
  ).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

const MAX_FRAMES = 48;

export function TerminalDrawer() {
  const [open, setOpen] = useState(false);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [paused, setPaused] = useState(false);
  const [unread, setUnread] = useState(0);
  const frameId = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);
  const reduced = useReducedMotion();

  const pushFrame = useCallback(() => {
    const pool = EVENT_POOL[rnd(EVENT_POOL.length)];
    const isWarn = pool.tone === "warn" && Math.random() > 0.6;
    const frame: Frame = {
      id: ++frameId.current,
      time: stamp(),
      dir: Math.random() > 0.5 ? "↑" : "↓",
      event: pool.event,
      detail: pool.detail(),
      status: isWarn ? "RETRYING" : Math.random() > 0.85 ? "201 CREATED" : "200 OK",
      latency: 7 + rnd(14),
      tone: isWarn ? "warn" : pool.tone,
    };
    setFrames((f) => [...f.slice(-MAX_FRAMES + 1), frame]);
    if (!open) setUnread((u) => u + 1);
  }, [open]);

  // stream generator
  useEffect(() => {
    if (paused || reduced) return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        pushFrame();
        schedule();
      }, 320 + Math.random() * 680);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [paused, reduced, pushFrame]);

  // bus listener opens the drawer and resets unread
  useEffect(
    () =>
      on(BUS.consoleOpen, () => {
        setOpen(true);
        setUnread(0);
      }),
    []
  );

  // autoscroll unless the user scrolled up
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !open) return;
    if (pinnedToBottom.current) {
      body.scrollTop = body.scrollHeight;
    }
  }, [frames, open]);

  const onScroll = () => {
    const body = bodyRef.current;
    if (!body) return;
    pinnedToBottom.current =
      body.scrollHeight - body.scrollTop - body.clientHeight < 40;
  };

  return (
    <>
      {/* floating trigger */}
      <motion.button
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            setOpen(true);
            setUnread(0);
          }
        }}
        className="glass-strong fixed right-4 bottom-4 z-[64] flex items-center gap-2.5 rounded-full py-2.5 pr-4 pl-3.5 font-telemetry text-[10px] font-semibold tracking-[0.18em] text-slate-200 uppercase transition-colors hover:text-bio focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bio md:right-6 md:bottom-6"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        aria-label={open ? "Close sync console" : "Open sync console"}
        aria-expanded={open}
        data-cursor="hover"
      >
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="anim-ping-dot absolute inline-flex h-full w-full rounded-full bg-bio" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-bio" />
        </span>
        <span className="hidden sm:inline">{open ? "Close" : "Sync Console"}</span>
        <span className="sm:hidden">{open ? "Close" : "Console"}</span>
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-coral px-1 text-[9px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </motion.button>

      {/* drawer */}
      <AnimatePresence>
        {open && (
          <motion.aside
            key="console"
            className="fixed inset-x-0 bottom-0 z-[65] mx-auto flex max-h-[46vh] w-full max-w-4xl flex-col"
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.4 }}
            transition={{ type: "spring", stiffness: 210, damping: 28 }}
            aria-label="Live sync protocol console"
          >
            <div className="glass-strong flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-3xl border-b-0 shadow-[0_-30px_80px_-30px_rgba(0,240,255,0.18)]">
              {/* header */}
              <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3 md:px-5">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-coral/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-clin/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-pulse/80" />
                </span>
                <span className="flex items-center gap-2 font-telemetry text-[10px] tracking-[0.14em] text-slate-400">
                  <Radio size={11} className="text-bio" aria-hidden="true" focusable="false" />
                  medsync://sync-protocol: wss://live.medsync.health/v3
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPaused((p) => !p)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/6 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bio"
                    aria-label={paused ? "Resume stream" : "Pause stream"}
                  >
                    {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrames([])}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/6 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bio"
                    aria-label="Clear frames"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/6 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bio"
                    aria-label="Close console"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </span>
              </div>

              {/* body */}
              <div
                ref={bodyRef}
                onScroll={onScroll}
                data-lenis-prevent
                role="log"
                aria-live="off"
                className="medsync-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3 font-telemetry text-[10.5px] leading-relaxed md:px-5"
              >
                <div className="text-slate-600">
                  ◇ medsync/ws ▸ connection established · protocol v3.2.1
                </div>
                {frames.map((f) => (
                  <div key={f.id} className="flex gap-2.5 whitespace-nowrap">
                    <span className="text-slate-600 tabular-nums">{f.time}</span>
                    <span className={f.dir === "↑" ? "text-pulse-bright" : "text-bio"}>
                      {f.dir}
                    </span>
                    <span
                      className={`w-44 shrink-0 truncate font-semibold ${
                        f.tone === "warn"
                          ? "text-amber-clin"
                          : f.tone === "ok"
                            ? "text-pulse-bright"
                            : "text-bio"
                      }`}
                    >
                      {f.event}
                    </span>
                    <span className="hidden truncate text-slate-400 sm:inline sm:w-52 md:w-64">
                      {f.detail}
                    </span>
                    <span className="ml-auto shrink-0">
                      <span
                        className={
                          f.status === "RETRYING" ? "text-amber-clin" : "text-pulse"
                        }
                      >
                        {f.status}
                      </span>
                      <span className="ml-2 text-slate-600 tabular-nums">
                        {f.latency}ms
                      </span>
                    </span>
                  </div>
                ))}
                <div className="flex gap-2 text-bio">
                  <span>›</span>
                  <span className="anim-blink">▊</span>
                </div>
              </div>

              {/* footer hint */}
              <div className="flex items-center justify-between border-t border-white/8 px-4 py-2 font-telemetry text-[9px] tracking-[0.14em] text-slate-600 uppercase md:px-5">
                <span>
                  {frames.length} frames · {paused ? "stream paused" : "streaming"}
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-1 transition-colors hover:text-bio focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bio"
                >
                  collapse <ChevronUp size={11} aria-hidden="true" focusable="false" />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
