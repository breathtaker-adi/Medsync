"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Pause,
  Play,
  Trash2,
  ChevronUp,
  Radio,
  Download,
  PlusCircle,
  Shield,
  Activity,
  Users2,
  Eye,
} from "lucide-react";
import { BUS, on } from "@/lib/events";
import { useReducedMotion } from "@/hooks/use-motion-prefs";

type Category = "ALL" | "DOSES" | "OCR" | "CAREGIVER" | "SECURITY";

interface Frame {
  id: number;
  time: string;
  dir: "↑" | "↓";
  event: string;
  detail: string;
  status: "200 OK" | "201 CREATED" | "RETRYING";
  latency: number;
  tone: "ok" | "warn" | "info";
  category: Category;
}

const EVENT_POOL: Array<{
  event: string;
  detail: () => string;
  tone: Frame["tone"];
  category: Category;
}> = [
  {
    event: "PRESCRIPTION_SYNCED",
    detail: () => `rx:#${randHex(4)} → supabase_storage (sample) · verified`,
    tone: "info",
    category: "OCR",
  },
  {
    event: "OCR_VISION_PARSE",
    detail: () => `med:metformin 500mg · confidence:99.4% (sample) · dosage:2x/day`,
    tone: "ok",
    category: "OCR",
  },
  {
    event: "DOSE_REMINDER_DISPATCH",
    detail: () => `patient:#${randHex(4)} · channel:fcm_push+alarm · 08:00 AM window`,
    tone: "ok",
    category: "DOSES",
  },
  {
    event: "DOCTOR_REVIEW_STATUS",
    detail: () => `clinician:Dr. Anand (Sample Review · Reg #MMC-84920) · verified`,
    tone: "info",
    category: "SECURITY",
  },
  {
    event: "VAULT_KEYSTORE_AUTH",
    detail: () => `keystore:hardware_secure_store · rls:enforced`,
    tone: "ok",
    category: "SECURITY",
  },
  {
    event: "CAREGIVER_NOTIFICATION",
    detail: () => `recipient:Ananya (Daughter) · fcm_status:delivered 12ms`,
    tone: "ok",
    category: "CAREGIVER",
  },
  {
    event: "DOSE_LOGGED",
    detail: () => `dose:metformin 500mg · status:confirmed · adherence:100%`,
    tone: "ok",
    category: "DOSES",
  },
  {
    event: "CAREGIVER_DIGEST",
    detail: () => `streak:18d · patient adherence:98.4% · weekly summary ready`,
    tone: "info",
    category: "CAREGIVER",
  },
  {
    event: "API_HEARTBEAT",
    detail: () => `ping 11ms · https://api.supabase.co/rest/v1`,
    tone: "info",
    category: "SECURITY",
  },
  {
    event: "RECONNECT_BACKOFF",
    detail: () => `attempt:1 · channel resilient · reconnecting in 90ms`,
    tone: "warn",
    category: "SECURITY",
  },
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

const MAX_FRAMES = 60;

export function TerminalDrawer() {
  const [open, setOpen] = useState(false);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [paused, setPaused] = useState(false);
  const [unread, setUnread] = useState(0);
  const [activeCategory, setActiveCategory] = useState<Category>("ALL");

  const frameId = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);
  const reduced = useReducedMotion();

  const pushFrame = useCallback(
    (custom?: Partial<Frame>) => {
      let frame: Frame;
      if (custom && custom.event) {
        frame = {
          id: ++frameId.current,
          time: stamp(),
          dir: custom.dir || "↑",
          event: custom.event,
          detail: custom.detail || "dispatch:ok",
          status: custom.status || "200 OK",
          latency: custom.latency || 9,
          tone: custom.tone || "ok",
          category:
            custom.category ||
            (custom.event.includes("DOSE")
              ? "DOSES"
              : custom.event.includes("OCR") || custom.event.includes("PRESCRIPTION")
              ? "OCR"
              : custom.event.includes("CAREGIVER")
              ? "CAREGIVER"
              : "SECURITY"),
        };
      } else {
        const pool = EVENT_POOL[rnd(EVENT_POOL.length)];
        const isWarn = pool.tone === "warn" && Math.random() > 0.6;
        frame = {
          id: ++frameId.current,
          time: stamp(),
          dir: Math.random() > 0.5 ? "↑" : "↓",
          event: pool.event,
          detail: pool.detail(),
          status: isWarn ? "RETRYING" : Math.random() > 0.85 ? "201 CREATED" : "200 OK",
          latency: 7 + rnd(14),
          tone: isWarn ? "warn" : pool.tone,
          category: pool.category,
        };
      }

      setFrames((f) => [...f.slice(-MAX_FRAMES + 1), frame]);
      if (!open) setUnread((u) => u + 1);
    },
    [open]
  );

  // Background mock heartbeat stream
  useEffect(() => {
    if (paused || reduced) return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        pushFrame();
        schedule();
      }, 500 + Math.random() * 900);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [paused, reduced, pushFrame]);

  // Open drawer event
  useEffect(
    () =>
      on(BUS.consoleOpen, () => {
        setOpen(true);
        setUnread(0);
      }),
    []
  );

  // Listen to custom frames emitted across the site
  useEffect(() => {
    return on(BUS.consoleLog, (e) => {
      const detail = (e as CustomEvent<Partial<Frame>>).detail;
      if (detail) {
        pushFrame(detail);
      }
    });
  }, [pushFrame]);

  // Autoscroll unless user intentionally scrolled up
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

  // Filtered frames
  const filteredFrames = useMemo(() => {
    if (activeCategory === "ALL") return frames;
    return frames.filter((f) => f.category === activeCategory);
  }, [frames, activeCategory]);

  // Export current session frames to JSON
  const handleExportJSON = () => {
    const payload = {
      protocol: "wss://live.medsync.health/v3",
      exported_at: new Date().toISOString(),
      encryption: "AES-256-GCM",
      total_frames: frames.length,
      frames,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medsync-telemetry-log-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Quick Action: Simulate Dose
  const simulateDose = () => {
    pushFrame({
      event: "PATIENT_DOSE_CONFIRMED",
      detail: `med:Metformin 500mg · schedule:08:00 AM · logged_at:${stamp()} · streak:19d`,
      status: "200 OK",
      latency: 8,
      tone: "ok",
      category: "DOSES",
    });
  };

  // Quick Action: Simulate Rx OCR
  const simulateOcr = () => {
    pushFrame({
      event: "AI_OCR_EXTRACTION_SUCCESS",
      detail: `scan:camera_rx_${randHex(4)}.jpg · 3 medications parsed · confidence:99.1%`,
      status: "201 CREATED",
      latency: 42,
      tone: "info",
      category: "OCR",
    });
  };

  // Quick Action: Simulate Caregiver Alert
  const simulateCaregiver = () => {
    pushFrame({
      event: "CAREGIVER_PUSH_ESCALATION",
      detail: `alert:dose_window_expired · recipient:Ananya (Daughter) · push_delivered:14ms`,
      status: "200 OK",
      latency: 14,
      tone: "warn",
      category: "CAREGIVER",
    });
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
          <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-coral px-1 text-[9px] font-bold text-white shadow-sm">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </motion.button>

      {/* drawer */}
      <AnimatePresence>
        {open && (
          <motion.aside
            key="console"
            className="fixed inset-x-0 bottom-0 z-[65] mx-auto flex max-h-[52vh] w-full max-w-5xl flex-col"
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.4 }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
            aria-label="Live sync protocol console"
          >
            <div className="glass-strong flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-3xl border-b-0 shadow-[0_-30px_90px_-20px_rgba(0,240,255,0.22)]">
              {/* Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3 md:px-5">
                <div className="flex items-center gap-3">
                  <span className="flex gap-1.5" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-coral/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-clin/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-pulse/80" />
                  </span>
                  <span className="flex items-center gap-2 font-telemetry text-[10.5px] tracking-[0.14em] text-slate-300">
                    <Radio size={12} className="text-bio" aria-hidden="true" />
                    <span className="font-semibold text-white">medsync://sample-telemetry</span>
                    <span className="hidden text-slate-500 sm:inline">· simulated packet feed</span>
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaused((p) => !p)}
                    className="flex h-7 items-center gap-1.5 rounded-md border border-white/8 bg-white/[0.03] px-2 font-telemetry text-[9px] uppercase text-slate-400 transition-colors hover:border-bio/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bio"
                    aria-label={paused ? "Resume stream" : "Pause stream"}
                  >
                    {paused ? <Play size={11} className="text-pulse-bright" /> : <Pause size={11} />}
                    <span className="hidden sm:inline">{paused ? "Resume" : "Pause"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJSON}
                    className="flex h-7 items-center gap-1.5 rounded-md border border-white/8 bg-white/[0.03] px-2 font-telemetry text-[9px] uppercase text-slate-400 transition-colors hover:border-bio/50 hover:text-bio focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bio"
                    title="Export session logs as JSON"
                  >
                    <Download size={11} />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrames([])}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/6 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bio"
                    aria-label="Clear frames"
                    title="Clear log"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/6 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bio"
                    aria-label="Close console"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Action Simulation Toolbar & Category Filters */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/6 bg-white/[0.015] px-4 py-2 md:px-5">
                {/* Category Pills */}
                <div className="flex items-center gap-1">
                  {(["ALL", "DOSES", "OCR", "CAREGIVER", "SECURITY"] as Category[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`rounded-full px-2.5 py-0.5 font-telemetry text-[9px] font-semibold tracking-[0.14em] uppercase transition-colors ${
                        activeCategory === cat
                          ? "bg-bio text-obsidian shadow-[0_0_10px_rgba(0,240,255,0.5)]"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Simulation Action Triggers */}
                <div className="flex items-center gap-1.5 font-telemetry text-[9px] uppercase">
                  <span className="text-slate-500 mr-1 hidden lg:inline">Simulate Event:</span>
                  <button
                    type="button"
                    onClick={simulateDose}
                    className="flex items-center gap-1 rounded bg-bio/10 border border-bio/30 px-2 py-0.5 text-bio hover:bg-bio/20 transition-colors"
                  >
                    <Activity size={10} /> + Dose
                  </button>
                  <button
                    type="button"
                    onClick={simulateOcr}
                    className="flex items-center gap-1 rounded bg-pulse/10 border border-pulse/30 px-2 py-0.5 text-pulse-bright hover:bg-pulse/20 transition-colors"
                  >
                    <Eye size={10} /> + Scan Rx
                  </button>
                  <button
                    type="button"
                    onClick={simulateCaregiver}
                    className="flex items-center gap-1 rounded bg-coral/10 border border-coral/30 px-2 py-0.5 text-coral hover:bg-coral/20 transition-colors"
                  >
                    <Users2 size={10} /> + Alert
                  </button>
                </div>
              </div>

              {/* Stream Body */}
              <div
                ref={bodyRef}
                onScroll={onScroll}
                data-lenis-prevent
                role="log"
                aria-live="off"
                className="medsync-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3 font-telemetry text-[10.5px] leading-relaxed md:px-5"
              >
                <div className="flex items-center gap-2 text-slate-500 pb-1 border-b border-white/4 mb-2">
                  <Shield size={11} className="text-bio" />
                  <span>
                    Cipher: AES-256-GCM · DPDP Act 2023 India Compliance Active · SQLite Engine Local
                  </span>
                </div>

                {filteredFrames.map((f) => (
                  <div key={f.id} className="flex gap-2.5 whitespace-nowrap py-0.5 hover:bg-white/[0.02]">
                    <span className="text-slate-600 tabular-nums">{f.time}</span>
                    <span className={f.dir === "↑" ? "text-pulse-bright" : "text-bio"}>
                      {f.dir}
                    </span>
                    <span
                      className={`w-48 shrink-0 truncate font-semibold ${
                        f.tone === "warn"
                          ? "text-coral"
                          : f.tone === "ok"
                            ? "text-pulse-bright"
                            : "text-bio"
                      }`}
                    >
                      {f.event}
                    </span>
                    <span className="hidden truncate text-slate-300 sm:inline sm:w-64 md:w-80">
                      {f.detail}
                    </span>
                    <span className="ml-auto shrink-0 flex items-center gap-2">
                      <span
                        className={
                          f.status === "RETRYING"
                            ? "text-amber-clin"
                            : f.status === "201 CREATED"
                            ? "text-bio"
                            : "text-pulse-bright"
                        }
                      >
                        {f.status}
                      </span>
                      <span className="text-slate-600 tabular-nums">
                        {f.latency}ms
                      </span>
                    </span>
                  </div>
                ))}

                {filteredFrames.length === 0 && (
                  <div className="py-6 text-center text-slate-500 font-telemetry text-xs">
                    No frames in category &quot;{activeCategory}&quot;. Click a simulation button above to generate one.
                  </div>
                )}

                <div className="flex gap-2 text-bio pt-1">
                  <span>›</span>
                  <span className="anim-blink">▊</span>
                </div>
              </div>

              {/* Footer info bar */}
              <div className="flex items-center justify-between border-t border-white/8 px-4 py-2 font-telemetry text-[9px] tracking-[0.14em] text-slate-500 uppercase md:px-5">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-pulse" />
                  <span>
                    {filteredFrames.length} of {frames.length} frames logged · {paused ? "stream paused" : "live stream active"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-1 transition-colors hover:text-bio focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bio"
                >
                  collapse <ChevronUp size={11} aria-hidden="true" />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

