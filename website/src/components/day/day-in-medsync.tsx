"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import {
  BellRing,
  Watch,
  HeartPulse,
  AlertTriangle,
  PackageCheck,
  Truck,
  Stethoscope,
  Building2,
} from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { SectionHeading } from "@/components/fx/section-heading";
import { useReducedMotion } from "@/hooks/use-motion-prefs";

/* ── story data ─────────────────────────────────────────────── */

const PHASES = [
  {
    time: "08:00",
    tag: "WAKE",
    title: "The day starts itself.",
    body: "A lock-screen dose card lands before the kettle boils. The wearable buzzes in the same heartbeat — Medsync already accounted for the late breakfast, so the morning window shifted twelve minutes on its own.",
    tags: ["LOCK-SCREEN DOSE", "WATCH HAPTIC", "FOOD-AWARE"],
  },
  {
    time: "13:00",
    tag: "ANOMALY",
    title: "The wearable speaks up.",
    body: "A heart-rate spike at lunch gets cross-referenced against the grapefruit in the meal log. The engine flags the drug-food interaction, quietly pages Dr. Rao, and proposes a two-hour dose shift — before the patient feels anything at all.",
    tags: ["HR ANOMALY", "INTERACTION FLAG", "DOCTOR PING"],
  },
  {
    time: "19:00",
    tag: "RESOLVE",
    title: "The pharmacy was already ready.",
    body: "The refill was approved while dinner was cooking. A courier node lights up across the city, ETA pinned to the minute, and the offline-first vault logs every handshake — no cloud required, nothing dropped.",
    tags: ["AUTO-REFILL", "COURIER NODE", "VAULT LOG"],
  },
];

const STROKE = ["rgba(0,240,255,0.10)", "rgba(255,92,92,0.10)", "rgba(16,185,129,0.12)"];

/* ── section ────────────────────────────────────────────────── */

export function DayInMedsync() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (reduced || !stageRef.current || !wrapRef.current) return;

      const stage = stageRef.current;
      const q = (phase: number) =>
        gsap.utils.toArray<HTMLElement>(`[data-phase="${phase}"]`, stage);

      const p1 = q(1);
      const p2 = q(2);
      const p3 = q(3);
      const segs = gsap.utils.toArray<HTMLElement>("[data-seg]", stage);
      const phone = stage.querySelector("[data-phone]");
      const railItems = gsap.utils.toArray<HTMLElement>("[data-rail-item]", stage);

      gsap.set(p2, { autoAlpha: 0, y: 64 });
      gsap.set(p3, { autoAlpha: 0, y: 64 });

      // rail active-state — toggled imperatively (no re-renders at 60fps)
      const setRail = (progress: number) => {
        const idx = progress < 0.333 ? 0 : progress < 0.665 ? 1 : 2;
        railItems.forEach((item, i) => {
          item.style.opacity = i === idx ? "1" : "0.32";
          const dot = item.querySelector<HTMLElement>("[data-rail-dot]");
          if (dot) {
            const on = i === idx;
            dot.style.background = on ? "#00f0ff" : "rgba(255,255,255,0.25)";
            dot.style.boxShadow = on ? "0 0 12px rgba(0,240,255,0.8)" : "none";
          }
        });
      };

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
          onUpdate: (self) => setRail(self.progress),
        },
      });

      // spacer so the timeline spans 0..1
      tl.to({}, { duration: 1 }, 0);

      // ambient drift
      if (phone) tl.to(phone, { y: -30, ease: "none", duration: 1 }, 0);

      // phase transitions
      tl.to(p1, { autoAlpha: 0, y: -64, duration: 0.055, ease: "power2.in" }, 0.3)
        .to(p2, { autoAlpha: 1, y: 0, duration: 0.055, ease: "power2.out" }, 0.36)
        .to(p2, { autoAlpha: 0, y: -64, duration: 0.055, ease: "power2.in" }, 0.63)
        .to(p3, { autoAlpha: 1, y: 0, duration: 0.055, ease: "power2.out" }, 0.69);

      // progress segments
      segs.forEach((seg, i) => {
        tl.fromTo(
          seg,
          { scaleX: 0 },
          { scaleX: 1, duration: i === 0 ? 0.31 : i === 1 ? 0.3 : 0.31, ease: "none" },
          [0, 0.36, 0.69][i]
        );
      });

      setRail(0);
    },
    { scope: stageRef, dependencies: [reduced] }
  );

  /* ── reduced motion: static stacked ── */
  if (reduced) {
    return (
      <section id="day" className="mx-auto w-full max-w-7xl px-5 py-28 md:px-8">
        <SectionHeading
          index="02"
          eyebrow="A DAY IN MEDSYNC"
          title={
            <>
              08:00 → 19:00.{" "}
              <span className="text-gradient-sync">Zero decisions</span> required.
            </>
          }
          description="Scroll through one patient's day — morning dose, midday anomaly, evening refill — as the ecosystem absorbs every decision."
        />
        <div className="mt-14 flex flex-col gap-6">
          {PHASES.map((p) => (
            <article
              key={p.time}
              className="glass-deep rounded-3xl p-7 md:p-10"
            >
              <div className="font-telemetry text-[11px] tracking-[0.3em] text-bio">
                {p.time} — {p.tag}
              </div>
              <h3 className="mt-3 text-2xl font-extrabold tracking-[-0.02em] text-white md:text-3xl">
                {p.title}
              </h3>
              <p className="mt-3 max-w-2xl leading-relaxed text-slate-400">{p.body}</p>
              <div className="mt-4 flex flex-wrap gap-2 font-telemetry text-[9px] tracking-[0.16em] text-slate-500">
                {p.tags.map((t) => (
                  <span key={t} className="rounded-full border border-white/8 px-2.5 py-1">
                    {t}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section id="day" aria-label="A day in Medsync — scroll story">
      <div ref={wrapRef} className="relative h-[440vh]">
        <div
          ref={stageRef}
          className="sticky top-0 flex h-screen flex-col overflow-clip"
        >
          {/* ambient */}
          <div aria-hidden className="absolute inset-0">
            <div className="blueprint-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(70%_70%_at_50%_50%,#000,transparent)]" />
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-obsidian to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-obsidian to-transparent" />
          </div>

          {/* giant backdrop times */}
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-end pr-2">
            {PHASES.map((p, i) => (
              <span
                key={p.time}
                data-phase={i + 1}
                className="absolute font-telemetry text-[34vw] leading-none font-bold tabular-nums lg:text-[24vw]"
                style={{
                  WebkitTextStroke: STROKE[i],
                  color: "transparent",
                }}
              >
                {p.time.replace(":", "")}
              </span>
            ))}
          </div>

          {/* heading (persistent) */}
          <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pt-24 md:px-8 md:pt-28">
            <SectionHeading
              index="02"
              eyebrow="A DAY IN MEDSYNC"
              title={
                <>
                  08:00 → 19:00.{" "}
                  <span className="text-gradient-sync">Zero decisions</span> required.
                </>
              }
            />
          </div>

          {/* stage grid */}
          <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-center gap-6 px-5 pb-20 md:px-8 lg:grid-cols-[190px_minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-10">
            {/* rail */}
            <div className="hidden flex-col gap-8 self-center border-l border-white/10 pl-5 lg:flex">
              {PHASES.map((p) => (
                <div key={p.time} data-rail-item className="relative pl-4" style={{ opacity: 0.32 }}>
                  <span
                    data-rail-dot
                    aria-hidden
                    className="absolute top-1 -left-[26.5px] h-2.5 w-2.5 rounded-full bg-white/25"
                  />
                  <span className="font-telemetry text-[11px] tracking-[0.2em] text-bio">
                    {p.time}
                  </span>
                  <div className="mt-1 font-telemetry text-[9px] tracking-[0.22em] text-slate-500 uppercase">
                    {p.tag}
                  </div>
                </div>
              ))}
            </div>

            {/* phone */}
            <div className="mx-auto w-full max-w-[280px] sm:max-w-[300px]">
              <div
                data-phone
                className="relative mx-auto aspect-[9/18.6] rounded-[2.4rem] border border-white/12 bg-[#05070d] p-2 shadow-[0_40px_120px_-40px_rgba(0,240,255,0.25),0_40px_120px_-60px_rgba(0,0,0,0.9)]"
              >
                {/* side button */}
                <span aria-hidden className="absolute top-24 -right-[2.5px] h-12 w-[3px] rounded-full bg-white/15" />
                {/* screen */}
                <div className="relative h-full w-full overflow-hidden rounded-[1.9rem] border border-white/6 bg-[#060910]">
                  {/* notch */}
                  <div className="absolute top-2 left-1/2 z-30 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
                  {/* status bar */}
                  <div className="absolute top-2.5 right-4 z-30 flex items-center gap-1.5 font-telemetry text-[8px] text-slate-400">
                    <span>LTE</span>
                    <span className="inline-block h-2 w-3.5 rounded-[2px] border border-slate-400/70">
                      <span className="block h-full w-2/3 rounded-[1px] bg-slate-400/70" />
                    </span>
                  </div>

                  {/* ── screen 1 · 08:00 ── */}
                  <div data-phase={1} className="absolute inset-0 p-4 pt-12">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white">medsync</span>
                      <span className="font-telemetry text-[8px] tracking-[0.14em] text-slate-500">
                        TODAY · 08:00
                      </span>
                    </div>
                    <div className="mt-1.5 overflow-hidden rounded-xl border border-bio/20 bg-bio/[0.06] p-3">
                      <div className="flex items-center gap-2 font-telemetry text-[8px] tracking-[0.18em] text-bio uppercase">
                        <BellRing size={10} /> Morning dose · window 08:00–09:00
                      </div>
                      <div className="mt-2.5 flex flex-col gap-1.5">
                        {["Metformin 500mg", "Lisinopril 10mg"].map((m) => (
                          <div key={m} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-2.5 py-2">
                            <span className="text-[10px] text-slate-200">{m}</span>
                            <span className="h-2 w-2 rounded-full bg-bio/60" />
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <span className="flex-1 rounded-lg border border-white/10 py-1.5 text-center font-telemetry text-[8px] tracking-[0.14em] text-slate-400 uppercase">
                          Snooze 10m
                        </span>
                        <span className="relative flex-1 rounded-lg bg-white py-1.5 text-center font-telemetry text-[8px] font-bold tracking-[0.14em] text-obsidian uppercase">
                          <span className="anim-ping-dot absolute inset-0 rounded-lg bg-bio/30" />
                          Confirm
                        </span>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-white/8 px-3 py-2.5">
                      <Watch size={12} className="text-pulse-bright" />
                      <span className="font-telemetry text-[8px] tracking-[0.14em] text-slate-400 uppercase">
                        Watch buzzed · breakfast logged 07:48
                      </span>
                    </div>
                    <svg viewBox="0 0 240 60" className="mt-3 w-full">
                      <path
                        d="M0 30 H50 L58 30 64 12 72 48 80 20 86 30 H140 L148 30 154 6 162 54 170 16 176 30 H240"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="1.5"
                        className="anim-ecg"
                      />
                    </svg>
                  </div>

                  {/* ── screen 2 · 13:00 ── */}
                  <div data-phase={2} className="absolute inset-0 p-4 pt-12">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white">medsync</span>
                      <span className="font-telemetry text-[8px] tracking-[0.14em] text-slate-500">
                        LIVE · 13:00
                      </span>
                    </div>
                    <div className="mt-2 flex items-end justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 font-telemetry text-[8px] tracking-[0.16em] text-slate-500 uppercase">
                          <HeartPulse size={10} className="text-coral" /> Heart rate
                        </div>
                        <div className="mt-0.5 text-3xl font-extrabold text-white tabular-nums">
                          142<span className="ml-1 text-[10px] font-medium text-slate-500">BPM</span>
                        </div>
                      </div>
                      <span className="mb-1 rounded-full border border-coral/30 bg-coral/10 px-2 py-0.5 font-telemetry text-[7.5px] tracking-[0.14em] text-coral">
                        SPIKE +64
                      </span>
                    </div>
                    <svg viewBox="0 0 240 70" className="mt-2 w-full">
                      <defs>
                        <linearGradient id="hr-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#FF5C5C" stopOpacity="0.35" />
                          <stop offset="1" stopColor="#FF5C5C" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0 48 C20 46 30 44 44 42 C58 40 66 44 78 38 C92 31 100 34 114 22 C128 10 138 14 152 24 C166 34 176 30 192 34 C208 38 224 36 240 30 L240 70 L0 70 Z"
                        fill="url(#hr-fill)"
                      />
                      <path
                        d="M0 48 C20 46 30 44 44 42 C58 40 66 44 78 38 C92 31 100 34 114 22 C128 10 138 14 152 24 C166 34 176 30 192 34 C208 38 224 36 240 30"
                        fill="none"
                        stroke="#FF5C5C"
                        strokeWidth="1.5"
                      />
                    </svg>
                    <div className="mt-2 rounded-xl border border-coral/30 bg-coral/[0.08] p-3">
                      <div className="flex items-center gap-2 font-telemetry text-[8px] font-bold tracking-[0.16em] text-coral uppercase">
                        <AlertTriangle size={10} /> Food interaction
                      </div>
                      <p className="mt-1.5 text-[9.5px] leading-relaxed text-slate-300">
                        Grapefruit detected in meal log — statin potency up 43%.
                        Evening dose shifted to 15:00.
                      </p>
                    </div>
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/8 px-3 py-2.5">
                      <Stethoscope size={12} className="text-bio" />
                      <span className="font-telemetry text-[8px] tracking-[0.14em] text-slate-400 uppercase">
                        Dr. Rao notified · 12ms
                      </span>
                    </div>
                  </div>

                  {/* ── screen 3 · 19:00 ── */}
                  <div data-phase={3} className="absolute inset-0 p-4 pt-12">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white">medsync</span>
                      <span className="font-telemetry text-[8px] tracking-[0.14em] text-slate-500">
                        19:00
                      </span>
                    </div>
                    <div className="mt-2 rounded-xl border border-pulse/25 bg-pulse/[0.06] p-3">
                      <div className="flex items-center gap-2">
                        <Building2 size={11} className="text-pulse-bright" />
                        <span className="text-[10px] font-semibold text-white">
                          Crescent Pharmacy
                        </span>
                        <span className="ml-auto rotate-[8deg] rounded border border-pulse/50 px-1.5 py-0.5 font-telemetry text-[7px] font-bold tracking-[0.14em] text-pulse-bright uppercase">
                          Refill approved
                        </span>
                      </div>
                      <div className="mt-2 font-telemetry text-[8px] tracking-[0.12em] text-slate-400 uppercase">
                        Atorvastatin 40mg · 30d supply · covered
                      </div>
                    </div>
                    {/* courier route */}
                    <div className="mt-3 rounded-xl border border-white/8 p-3">
                      <div className="flex items-center gap-2 font-telemetry text-[8px] tracking-[0.16em] text-slate-500 uppercase">
                        <Truck size={10} className="text-bio" /> Courier dispatch
                      </div>
                      <div className="relative mt-3 flex items-center justify-between px-1">
                        <span className="absolute top-1/2 right-2 left-2 h-px bg-white/10" />
                        <span className="absolute top-1/2 right-2 left-2 h-px origin-left bg-gradient-to-r from-pulse to-bio shadow-[0_0_8px_rgba(0,240,255,0.7)]" style={{ animation: "seg-fill 1.8s var(--ease-observe) forwards" }} />
                        {[
                          { icon: PackageCheck, label: "PACKED", delay: "0.2s" },
                          { icon: Truck, label: "DISPATCHED", delay: "0.8s" },
                          { icon: Building2, label: "ETA 19:42", delay: "1.4s" },
                        ].map((n, i) => (
                          <span key={n.label} className="relative flex flex-col items-center gap-1.5">
                            <span
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-bio/40 bg-obsidian text-bio"
                              style={{ animation: `node-pop 0.5s var(--ease-observe) ${n.delay} both` }}
                            >
                              <n.icon size={12} />
                            </span>
                            <span className="font-telemetry text-[6.5px] tracking-[0.12em] text-slate-500">
                              {n.label}
                            </span>
                            {i === 2 && (
                              <span className="anim-ping-dot absolute -top-1 h-9 w-9 rounded-full bg-bio/15" />
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/8 px-3 py-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-pulse" />
                      <span className="font-telemetry text-[8px] tracking-[0.14em] text-slate-400 uppercase">
                        Vault log · 6 handshakes · offline-first
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* narrative blocks */}
            <div className="relative hidden min-h-[240px] lg:block">
              {PHASES.map((p, i) => (
                <article key={p.time} data-phase={i + 1} className="absolute inset-0">
                  <div className="font-telemetry text-[11px] tracking-[0.3em] text-bio uppercase">
                    {p.time} — {p.tag}
                  </div>
                  <h3 className="mt-4 text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-white">
                    {p.title}
                  </h3>
                  <p className="mt-5 max-w-md leading-relaxed text-slate-400">
                    {p.body}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 font-telemetry text-[8.5px] tracking-[0.16em] text-slate-400"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* progress rail */}
          <div className="relative z-10 mx-auto flex w-full max-w-7xl items-center gap-3 px-5 pb-8 md:px-8">
            {PHASES.map((p, i) => (
              <div key={p.time} className="flex flex-1 items-center gap-3">
                <span className="font-telemetry text-[9px] tracking-[0.18em] text-slate-500">
                  {p.time}
                </span>
                <span className="h-px flex-1 overflow-hidden bg-white/8">
                  <span
                    data-seg
                    className="block h-full w-full origin-left bg-gradient-to-r from-bio to-pulse"
                    style={{ transform: "scaleX(0)" }}
                  />
                </span>
                {i === 2 && (
                  <span className="font-telemetry text-[9px] tracking-[0.18em] text-pulse-bright">
                    19:00
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* keyframes for courier nodes */}
      <style>{`
        @keyframes seg-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes node-pop { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </section>
  );
}
