"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "motion/react";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";
import { SectionHeading } from "@/components/fx/section-heading";
import { useReducedMotion } from "@/hooks/use-motion-prefs";

/* ── velocity-reactive marquee ──────────────────────────────── */

const MARQUEE_ITEMS = [
  "99.98% DOSAGE ACCURACY",
  "500K+ PRESCRIPTIONS SYNCED",
  "ZERO DATA LEAKS",
  "12MS MEDIAN LATENCY",
  "HIPAA + SOC 2 TYPE II",
  "FHIR R4 NATIVE",
  "OFFLINE-FIRST",
  "42 PHARMACY NETWORKS",
];

function VelocityMarquee({
  direction = 1,
  baseSpeed = 70,
  className = "",
}: {
  direction?: 1 | -1;
  baseSpeed?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pos = useRef(0);
  const vel = useRef(0);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (reduced || !trackRef.current) return;

      const st = ScrollTrigger.create({
        onUpdate: (self) => {
          vel.current = self.getVelocity();
        },
      });

      const tick = (_t: number, dt: number) => {
        const track = trackRef.current;
        if (!track) return;
        // decay captured velocity toward 0
        vel.current *= 0.92;
        const v = vel.current;
        // px/s: base drift + scroll-velocity boost (reverses on scroll-up)
        const pxPerSec =
          direction * baseSpeed + gsap.utils.clamp(-640, 640, v * 0.55);
        pos.current -= (pxPerSec * dt) / 1000;
        // wrap over half track (content duplicated once)
        const half = track.scrollWidth / 2;
        pos.current = (((pos.current % half) + half) % half) - half;
        const skew = gsap.utils.clamp(-7, 7, v * 0.012);
        track.style.transform = `translate3d(${pos.current}px, 0, 0) skewX(${skew}deg)`;
      };

      gsap.ticker.add(tick);
      return () => {
        gsap.ticker.remove(tick);
        st.kill();
      };
    },
    { dependencies: [reduced, direction, baseSpeed] }
  );

  const row = (ariaHidden: boolean) => (
    <div
      aria-hidden={ariaHidden || undefined}
      className="flex shrink-0 items-center gap-8 pr-8"
    >
      {MARQUEE_ITEMS.map((item) => (
        <span key={item} className="flex items-center gap-8 whitespace-nowrap">
          <span className="font-telemetry text-sm font-medium tracking-[0.24em] text-slate-400">
            {item}
          </span>
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-bio">
            <path d="M5 0 L6.2 3.8 L10 5 L6.2 6.2 L5 10 L3.8 6.2 L0 5 L3.8 3.8 Z" fill="currentColor" />
          </svg>
        </span>
      ))}
    </div>
  );

  return (
    <div
      ref={wrapRef}
      className={`mask-fade-x overflow-hidden border-y border-white/6 bg-white/[0.015] py-4 ${className}`}
    >
      {reduced ? (
        <div className="flex">
          {row(false)}
        </div>
      ) : (
        <div ref={trackRef} className="flex w-max will-change-transform">
          {row(false)}
          {row(true)}
        </div>
      )}
    </div>
  );
}

/* ── counters ───────────────────────────────────────────────── */

interface MetricDef {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  label: string;
  caption: string;
  countdown?: boolean;
}

const METRICS: MetricDef[] = [
  {
    value: 99.98,
    decimals: 2,
    suffix: "%",
    label: "DOSAGE ACCURACY",
    caption: "across 4.1M scheduled doses",
  },
  {
    value: 500,
    suffix: "K+",
    label: "PRESCRIPTIONS SYNCED",
    caption: "and counting, every hour",
  },
  {
    value: 12,
    suffix: "ms",
    label: "MEDIAN SYNC LATENCY",
    caption: "patient → doctor → pharmacy",
  },
  {
    value: 0,
    label: "DATA LEAKS",
    caption: "zero-knowledge, local-first",
    countdown: true,
  },
];

function Counter({ metric, started }: { metric: MetricDef; started: boolean }) {
  const [animated, setAnimated] = useState(metric.countdown ? 87 : 0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!started || reduced) return;
    const from = metric.countdown ? 87 : 0;
    const controls = animate(from, metric.value, {
      duration: 2.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setAnimated(v),
    });
    return () => controls.stop();
  }, [started, metric, reduced]);

  const display = reduced && started ? metric.value : animated;

  const formatted =
    metric.decimals != null
      ? display.toFixed(metric.decimals)
      : Math.round(display).toLocaleString();

  return (
    <div className="group relative flex flex-col gap-3 px-6 py-10 md:px-8 md:py-14">
      <div className="font-telemetry text-[10px] tracking-[0.26em] text-slate-500 uppercase">
        {metric.label}
      </div>
      <div className="font-telemetry text-4xl font-bold tabular-nums tracking-tight text-white transition-all duration-500 group-hover:text-glow-bio md:text-6xl">
        <span className="text-gradient-sync">
          {formatted}
          {metric.suffix}
        </span>
      </div>
      <div className="text-[13px] text-slate-500">{metric.caption}</div>
    </div>
  );
}

/* ── section ────────────────────────────────────────────────── */

export function Metrics() {
  const gridRef = useRef<HTMLDivElement>(null);
  const inView = useInView(gridRef, { once: true, margin: "-18% 0px" });

  return (
    <section
      id="telemetry"
      className="relative py-28 md:py-36"
      aria-label="Live telemetry metrics"
    >
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHeading
          index="03"
          eyebrow="TELEMETRY"
          align="center"
          title={
            <>
              Numbers that keep{" "}
              <span className="text-gradient-sync">their pulse.</span>
            </>
          }
          description="Every sync, every dose, every refill — measured, encrypted, and audited in real time. The marquee below reacts to your scroll velocity."
        />
      </div>

      <div ref={gridRef} className="mt-16">
        <VelocityMarquee direction={1} />
        <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-white/6 px-5 sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
          {METRICS.map((m) => (
            <Counter key={m.label} metric={m} started={inView} />
          ))}
        </div>
        <VelocityMarquee direction={-1} baseSpeed={62} />
      </div>
    </section>
  );
}
