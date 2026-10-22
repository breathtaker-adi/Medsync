"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import {
  BellRing,
  CheckCircle2,
  ScanText,
  ShieldCheck,
  Users2,
  Clock,
  Sparkles,
} from "lucide-react";
import { gsap, useGSAP } from "@/lib/gsap";
import { SectionHeading } from "@/components/fx/section-heading";
import { useReducedMotion } from "@/hooks/use-motion-prefs";

/* ── story data ─────────────────────────────────────────────── */

const PHASES = [
  {
    time: "08:00",
    tag: "SCHEDULE",
    title: "Morning dose on schedule.",
    body: "Timed lock-screen reminder lands before breakfast. One tap confirms the dose, and the caregiver loop receives an instant on-track check-in.",
    tags: ["LOCK-SCREEN DOSE", "ONE-TAP CONFIRM", "CAREGIVER SYNC"],
  },
  {
    time: "13:00",
    tag: "AI INTAKE",
    title: "AI prescription OCR intake.",
    body: "Patient snaps a photo of a new prescription. Medsync extracts medication, dosage and timing in seconds, queuing doctor sign-off before scheduling.",
    tags: ["CAMERA OCR", "DOCTOR VERIFICATION", "LOCAL VAULT"],
  },
  {
    time: "19:00",
    tag: "CONFIRM",
    title: "Evening dose verified.",
    body: "Evening dose confirmed on time. The caregiver receives a real-time notification, and the on-device vault records the completed regimen.",
    tags: ["DOSE CONFIRMED", "FAMILY NOTIFIED", "VAULT SYNC"],
  },
];

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

      gsap.set(p2, { autoAlpha: 0, y: 50 });
      gsap.set(p3, { autoAlpha: 0, y: 50 });

      const setRail = (progress: number) => {
        const idx = progress < 0.333 ? 0 : progress < 0.665 ? 1 : 2;
        railItems.forEach((item, i) => {
          const on = i === idx;
          item.style.opacity = on ? "1" : "0.6";
          item.setAttribute("data-active", on ? "true" : "false");
          const detail = item.querySelector<HTMLElement>("[data-rail-detail]");
          if (detail) {
            detail.setAttribute("data-active", on ? "true" : "false");
          }
          const dot = item.querySelector<HTMLElement>("[data-rail-dot]");
          if (dot) {
            dot.style.background = on ? "#00f0ff" : "rgba(255,255,255,0.3)";
            dot.style.boxShadow = on ? "0 0 16px rgba(0,240,255,0.95)" : "none";
            dot.style.transform = on ? "scale(1.2)" : "scale(1)";
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

      tl.to({}, { duration: 1 }, 0);

      if (phone) tl.to(phone, { y: -24, ease: "none", duration: 1 }, 0);

      tl.to(p1, { autoAlpha: 0, y: -50, duration: 0.055, ease: "power2.in" }, 0.3)
        .to(p2, { autoAlpha: 1, y: 0, duration: 0.055, ease: "power2.out" }, 0.36)
        .to(p2, { autoAlpha: 0, y: -50, duration: 0.055, ease: "power2.in" }, 0.63)
        .to(p3, { autoAlpha: 1, y: 0, duration: 0.055, ease: "power2.out" }, 0.69);

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
      <section id="day" className="mx-auto w-full max-w-7xl px-5 py-14 md:px-8 md:py-20">
        <SectionHeading
          index="02"
          eyebrow="A DAY IN MEDSYNC"
          title={
            <>
              08:00 → 19:00:{" "}
              <span className="text-gradient-sync">Zero decisions</span> required.
            </>
          }
          description="Explore one patient's day: morning dose confirmation, midday AI prescription scan, and evening caregiver sync."
        />
        <div className="mt-10 flex flex-col gap-6">
          {PHASES.map((p) => (
            <article
              key={p.time}
              className="glass rounded-2xl border border-white/8 p-6"
            >
              <div className="flex items-center gap-2">
                <span className="font-telemetry text-xs tracking-[0.24em] text-bio uppercase font-bold">
                  {p.time}
                </span>
                <span className="rounded bg-white/8 px-1.5 py-0.5 font-telemetry text-[9px] font-semibold tracking-[0.2em] text-slate-300 uppercase">
                  {p.tag}
                </span>
              </div>
              <h3 className="mt-2 text-xl font-bold text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{p.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1 font-telemetry text-[9px] text-slate-400"
                  >
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

  /* ── scrubbed timeline ── */
  return (
    <section id="day" aria-label="A day in Medsync timeline">
      <div ref={wrapRef} className="relative h-[250vh]">
        <div
          ref={stageRef}
          className="sticky top-0 flex h-svh w-full flex-col justify-between overflow-hidden"
        >
          {/* ambient background glow */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="anim-mesh absolute top-1/4 right-1/4 h-[44vh] w-[44vw] rounded-full bg-bio/[0.05] blur-[110px]" />
            <div className="dot-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(75%_60%_at_50%_50%,#000,transparent)]" />
          </div>

          {/* section heading */}
          <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pt-6 md:px-8 md:pt-8">
            <SectionHeading
              index="02"
              eyebrow="A DAY IN MEDSYNC"
              title={
                <>
                  08:00 → 19:00:{" "}
                  <span className="text-gradient-sync">Zero decisions</span> required.
                </>
              }
              description="A living walkthrough: morning dose confirmation, midday AI prescription intake, and evening caregiver check-in."
            />
          </div>

          {/* stage grid: rail on left, phone shifted center-to-right */}
          <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-start px-5 pt-1 pb-4 md:px-8 lg:grid-cols-[380px_1fr] lg:gap-10">
            {/* milestone rail (positioned upper side, adaptive accordion expansion) */}
            <div className="hidden flex-col gap-2.5 self-start pt-1 border-l-2 border-white/10 pl-6 lg:flex">
              {PHASES.map((p, i) => (
                <div
                  key={p.time}
                  data-rail-item
                  data-active={i === 0 ? "true" : "false"}
                  className="group relative rounded-2xl border border-transparent p-3 transition-all duration-300 data-[active=true]:border-bio/35 data-[active=true]:bg-bio/[0.06] data-[active=true]:shadow-[0_8px_24px_-8px_rgba(0,240,255,0.2)]"
                  style={{ opacity: i === 0 ? 1 : 0.6 }}
                >
                  <span
                    data-rail-dot
                    aria-hidden
                    className="absolute top-3.5 -left-[31px] h-3.5 w-3.5 rounded-full border-2 border-obsidian bg-white/30 transition-all duration-300"
                  />
                  <div className="flex items-center gap-2">
                    <span className="font-telemetry text-xs font-bold tracking-[0.22em] text-bio">
                      {p.time}
                    </span>
                    <span className="rounded bg-white/8 px-2 py-0.5 font-telemetry text-[9px] font-semibold tracking-[0.2em] text-slate-300 uppercase">
                      {p.tag}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-bold text-white transition-colors group-data-[active=true]:text-white group-data-[active=false]:text-slate-300">
                    {p.title}
                  </div>

                  {/* Accordion detail: smoothly visible on active phase */}
                  <div
                    data-rail-detail
                    className="grid transition-all duration-300 ease-out grid-rows-[0fr] opacity-0 data-[active=true]:grid-rows-[1fr] data-[active=true]:opacity-100"
                    data-active={i === 0 ? "true" : "false"}
                  >
                    <div className="overflow-hidden">
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                        {p.body}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5 pb-0.5">
                        {p.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-md border border-white/8 bg-white/[0.04] px-2 py-0.5 font-telemetry text-[8.5px] font-medium tracking-[0.12em] text-slate-400"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* phone mock shifted center-to-right */}
            <div className="flex w-full items-center justify-center lg:justify-center lg:pl-6">
              <div
                data-phone
                className="relative mx-auto aspect-[9/18.4] w-full max-w-[280px] rounded-[2.6rem] border border-white/12 bg-[#05070d] p-2.5 shadow-[0_30px_100px_-30px_rgba(0,240,255,0.22),0_40px_120px_-60px_rgba(0,0,0,0.95)] sm:max-w-[310px] max-h-[calc(100svh-190px)]"
              >
                {/* phone hardware accents */}
                <span aria-hidden className="absolute top-24 -right-[2.5px] h-12 w-[3px] rounded-full bg-white/15" />
                <span aria-hidden className="absolute top-20 -left-[2.5px] h-8 w-[3px] rounded-full bg-white/15" />
                <span aria-hidden className="absolute top-32 -left-[2.5px] h-12 w-[3px] rounded-full bg-white/15" />

                {/* screen */}
                <div className="relative h-full w-full overflow-hidden rounded-[2.1rem] border border-white/8 bg-[#060a12]">
                  {/* notch */}
                  <div className="absolute top-2 left-1/2 z-30 h-4.5 w-24 -translate-x-1/2 rounded-full bg-black flex items-center justify-center">
                    <span className="h-2 w-2 rounded-full bg-[#111827]" />
                  </div>
                  {/* status bar */}
                  <div className="absolute top-2.5 right-4 z-30 flex items-center gap-1.5 font-telemetry text-[8px] text-slate-400">
                    <span>5G</span>
                    <span className="inline-block h-2 w-3.5 rounded-[2px] border border-slate-400/70">
                      <span className="block h-full w-2/3 rounded-[1px] bg-slate-400/70" />
                    </span>
                  </div>

                  {/* ── SCREEN 1: 08:00 (Morning Dose) ── */}
                  <div data-phase={1} className="absolute inset-0 flex flex-col justify-between p-4 pt-11 pb-5">
                    <div>
                      <div className="flex items-center justify-between border-b border-white/6 pb-2">
                        <span className="text-[11px] font-bold text-white tracking-wide">medsync</span>
                        <span className="font-telemetry text-[8px] tracking-[0.14em] text-slate-400">
                          TODAY · 08:00
                        </span>
                      </div>

                      <div className="mt-3 overflow-hidden rounded-xl border border-bio/25 bg-bio/[0.07] p-3">
                        <div className="flex items-center gap-1.5 font-telemetry text-[8px] tracking-[0.16em] text-bio uppercase">
                          <BellRing size={10} /> Morning Window: 08:00 – 09:00
                        </div>
                        <div className="mt-2.5 flex flex-col gap-1.5">
                          {[
                            { name: "Metformin 500mg", type: "Post-Breakfast" },
                            { name: "Lisinopril 10mg", type: "With Water" },
                          ].map((m) => (
                            <div key={m.name} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-2.5 py-2">
                              <div>
                                <div className="text-[10px] font-medium text-slate-100">{m.name}</div>
                                <div className="font-telemetry text-[7.5px] text-slate-400">{m.type}</div>
                              </div>
                              <span className="h-2 w-2 rounded-full bg-bio shadow-[0_0_8px_rgba(0,240,255,0.7)]" />
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <span className="flex-1 rounded-lg border border-white/10 py-1.5 text-center font-telemetry text-[8px] tracking-[0.12em] text-slate-400 uppercase">
                            Snooze 10m
                          </span>
                          <span className="flex-1 rounded-lg bg-gradient-to-r from-bio to-pulse py-1.5 text-center font-telemetry text-[8px] font-bold tracking-[0.12em] text-obsidian uppercase shadow-[0_0_12px_rgba(0,240,255,0.3)]">
                            Confirm Dose
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
                        <Users2 size={12} className="text-pulse-bright" />
                        <span className="font-telemetry text-[8px] tracking-[0.12em] text-slate-300">
                          Caregiver linked: Ananya notified on log
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/6 bg-white/[0.02] p-2.5">
                      <div className="flex justify-between font-telemetry text-[8px] text-slate-400 uppercase">
                        <span>Adherence Streak</span>
                        <span className="text-pulse-bright">18 Days Active (98%)</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full w-[98%] bg-gradient-to-r from-bio to-pulse" />
                      </div>
                    </div>
                  </div>

                  {/* ── SCREEN 2: 13:00 (AI Prescription OCR Intake) ── */}
                  <div data-phase={2} className="absolute inset-0 flex flex-col justify-between p-4 pt-11 pb-5">
                    <div>
                      <div className="flex items-center justify-between border-b border-white/6 pb-2">
                        <span className="text-[11px] font-bold text-white tracking-wide">medsync</span>
                        <span className="font-telemetry text-[8px] tracking-[0.14em] text-bio">
                          AI INTAKE · 13:00
                        </span>
                      </div>

                      {/* OCR Camera Viewfinder Box */}
                      <div className="mt-3 overflow-hidden rounded-xl border border-bio/30 bg-[#040811] p-3">
                        <div className="flex items-center justify-between font-telemetry text-[8px] tracking-[0.16em] text-bio uppercase">
                          <span className="flex items-center gap-1.5">
                            <ScanText size={10} /> Camera Rx Scan
                          </span>
                          <span className="text-pulse-bright">99.1% Confidence</span>
                        </div>

                        {/* Scanned medicine card */}
                        <div className="mt-2.5 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
                          <div className="text-[11px] font-bold text-white">Atorvastatin 20mg</div>
                          <div className="mt-0.5 font-telemetry text-[8px] text-slate-300">
                            Extracted: 1 tablet daily · Bedtime
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 rounded bg-pulse/10 px-2 py-1 font-telemetry text-[7.5px] text-pulse-bright">
                            <CheckCircle2 size={9} /> Verified by Dr. Anand (Cardiology)
                          </div>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between font-telemetry text-[7.5px] text-slate-400">
                          <span>Contraindication Check</span>
                          <span className="text-pulse-bright">0 Conflicts Detected</span>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
                        <Clock size={12} className="text-bio" />
                        <span className="font-telemetry text-[8px] tracking-[0.12em] text-slate-300">
                          Added to schedule: Evening 19:00 window
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2">
                      <ShieldCheck size={12} className="text-pulse-bright" />
                      <span className="font-telemetry text-[8px] tracking-[0.12em] text-slate-400">
                        Saved to local vault · Zero data shared
                      </span>
                    </div>
                  </div>

                  {/* ── SCREEN 3: 19:00 (Evening Dose Check & Caregiver Alert) ── */}
                  <div data-phase={3} className="absolute inset-0 flex flex-col justify-between p-4 pt-11 pb-5">
                    <div>
                      <div className="flex items-center justify-between border-b border-white/6 pb-2">
                        <span className="text-[11px] font-bold text-white tracking-wide">medsync</span>
                        <span className="font-telemetry text-[8px] tracking-[0.14em] text-pulse-bright">
                          CONFIRMED · 19:00
                        </span>
                      </div>

                      {/* Confirmation badge */}
                      <div className="mt-3 overflow-hidden rounded-xl border border-pulse/30 bg-pulse/[0.07] p-3">
                        <div className="flex items-center gap-1.5 font-telemetry text-[8px] tracking-[0.16em] text-pulse-bright uppercase">
                          <CheckCircle2 size={11} /> Dose Confirmed on Time
                        </div>
                        <div className="mt-2 text-[11px] font-bold text-white">
                          Atorvastatin 20mg (Evening)
                        </div>
                        <div className="font-telemetry text-[8px] text-slate-300">
                          Logged at 19:02 · Window closed
                        </div>
                      </div>

                      {/* Caregiver live notification card */}
                      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-telemetry text-[8px] tracking-[0.14em] text-bio uppercase">
                            <Users2 size={10} /> Caregiver Update
                          </span>
                          <span className="font-telemetry text-[7.5px] text-slate-400">19:03</span>
                        </div>
                        <p className="mt-1.5 text-[9.5px] leading-relaxed text-slate-200">
                          Push delivered to Ananya: <span className="text-pulse-bright">"Evening dose taken on schedule."</span>
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/6 bg-white/[0.02] p-2.5">
                      <div className="flex justify-between font-telemetry text-[8px] text-slate-400 uppercase">
                        <span>Today's Total Adherence</span>
                        <span className="text-pulse-bright font-bold">100% Complete</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between font-telemetry text-[7.5px] text-slate-400 pt-1 border-t border-white/6">
                        <span>Local SQLite Vault</span>
                        <span className="text-bio">Encrypted &amp; Synced</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* progress rail at the bottom of pinned viewport */}
          <div className="relative z-10 mx-auto flex w-full max-w-7xl items-center gap-3 px-5 pb-6 md:px-8">
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
    </section>
  );
}
