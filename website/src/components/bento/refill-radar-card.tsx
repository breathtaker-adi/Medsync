"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Radar } from "lucide-react";
import { HologramCard, CardHeader } from "./hologram-card";

interface Blip {
  id: string;
  angle: number;
  radius: number; // 0..1 of radar radius
  pharmacy: string;
  med: string;
  status: "IN STOCK" | "LOW STOCK" | "ORDERING";
}

const BLIPS: Blip[] = [
  { id: "crescent", angle: 38, radius: 0.62, pharmacy: "CRESCENT", med: "LISINOPRIL 10MG", status: "IN STOCK" },
  { id: "medplus", angle: 152, radius: 0.82, pharmacy: "MEDPLUS", med: "ATORVASTATIN 40MG", status: "LOW STOCK" },
  { id: "northside", angle: 268, radius: 0.5, pharmacy: "NORTHSIDE", med: "METFORMIN 500MG", status: "IN STOCK" },
];

const SWEEP_PERIOD = 4000; // ms per revolution

export function RefillRadarCard({ className = "" }: { className?: string }) {
  const [hits, setHits] = useState<Record<string, boolean>>({});
  const [orderCount, setOrderCount] = useState(0);
  const [inView, setInView] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hitTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const angle = (((t - t0) / SWEEP_PERIOD) % 1) * 360;
      BLIPS.forEach((b) => {
        let diff = Math.abs(angle - b.angle);
        if (diff > 180) diff = 360 - diff;
        if (diff < 14) {
          setHits((h) => (h[b.id] ? h : { ...h, [b.id]: true }));
          window.clearTimeout(hitTimers.current[b.id]);
          hitTimers.current[b.id] = window.setTimeout(() => {
            setHits((h) => ({ ...h, [b.id]: false }));
          }, 1400);
        }
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // auto-order trigger — one per full sweep, low-stock first
    const orderTimer = window.setInterval(() => {
      setOrderCount((c) => c + 1);
    }, SWEEP_PERIOD);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(orderTimer);
      Object.values(hitTimers.current).forEach((id) => window.clearTimeout(id));
    };
  }, [inView]);

  const nextOrder = BLIPS[orderCount % BLIPS.length];

  return (
    <HologramCard className={className} label="Smart refill radar" spotlightColor="rgba(16,185,129,0.06)">
      <div ref={wrapRef} className="flex h-full flex-col gap-4 p-6">
        <CardHeader
          icon={<Radar size={13} />}
          title="Smart Refill Radar"
          chip="SWEEPING"
          chipTone="bio"
        />

        <div className="relative mx-auto aspect-square w-full max-w-[190px] flex-1">
          {/* rings */}
          {[1, 0.66, 0.33].map((s) => (
            <span
              key={s}
              aria-hidden
              className="absolute inset-0 m-auto rounded-full border border-white/10"
              style={{ width: `${s * 100}%`, height: `${s * 100}%` }}
            />
          ))}
          {/* crosshair */}
          <span aria-hidden className="absolute top-1/2 left-0 h-px w-full bg-white/6" />
          <span aria-hidden className="absolute top-0 left-1/2 h-full w-px bg-white/6" />

          {/* rotating sweep */}
          <span
            aria-hidden
            className="anim-radar absolute inset-[12%] rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, rgba(0,240,255,0.4), rgba(0,240,255,0.08) 55deg, transparent 80deg)",
              maskImage: "radial-gradient(circle, #000 98%, transparent 100%)",
              WebkitMaskImage: "radial-gradient(circle, #000 98%, transparent 100%)",
            }}
          />

          {/* blips */}
          {BLIPS.map((b) => {
            const rad = ((b.angle - 90) * Math.PI) / 180;
            const hit = hits[b.id];
            return (
              <span
                key={b.id}
                className="absolute"
                style={{
                  left: `${50 + Math.cos(rad) * b.radius * 38}%`,
                  top: `${50 + Math.sin(rad) * b.radius * 38}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <span
                  className={`block h-2 w-2 rounded-full transition-all duration-300 ${
                    b.status === "LOW STOCK"
                      ? "bg-amber-clin"
                      : "bg-pulse"
                  }`}
                  style={{
                    boxShadow: hit
                      ? `0 0 12px 2px ${b.status === "LOW STOCK" ? "rgba(245,185,66,0.8)" : "rgba(16,185,129,0.8)"}`
                      : "none",
                    transform: hit ? "scale(1.6)" : "scale(1)",
                  }}
                />
                <AnimatePresence>
                  {hit && (
                    <motion.span
                      initial={{ opacity: 0, y: 4, scale: 0.9 }}
                      animate={{ opacity: 1, y: -6, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 rounded border border-white/10 bg-obsidian/95 px-2 py-1 font-telemetry text-[7.5px] tracking-[0.12em] whitespace-nowrap text-slate-200"
                    >
                      {b.pharmacy} ·{" "}
                      <span className={b.status === "LOW STOCK" ? "text-amber-clin" : "text-pulse-bright"}>
                        {b.status}
                      </span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            );
          })}

          {/* center dot */}
          <span className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bio shadow-[0_0_10px_rgba(0,240,255,0.9)]" />
        </div>

        {/* auto-order readout */}
        <div className="flex h-8 items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={orderCount}
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="font-telemetry text-[9px] tracking-[0.14em] text-slate-400 uppercase"
              aria-live="polite"
            >
              AUTO-ORDER → {nextOrder.pharmacy} · {nextOrder.med}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </HologramCard>
  );
}
