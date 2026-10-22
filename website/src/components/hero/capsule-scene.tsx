"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/hooks/use-motion-prefs";

/** Pulse placeholder while the WebGL bundle streams in. */
function ScenePlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
      <div className="relative">
        <div className="anim-ping-dot absolute inset-0 rounded-full bg-bio/10" />
        <div className="h-40 w-24 rounded-full border border-bio/25 bg-bio/[0.04]" />
      </div>
    </div>
  );
}

const CapsuleCanvas = dynamic(() => import("./capsule-canvas"), {
  ssr: false,
  loading: () => <ScenePlaceholder />,
});

/**
 * Lazy WebGL mount — dynamically imported, client-only, and its render loop
 * suspends whenever the hero scrolls out of the viewport.
 */
export function CapsuleScene() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.02 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="absolute inset-0" aria-label="Interactive 3D medicine capsule with granular beads">
      <CapsuleCanvas frameloop={inView ? "always" : "never"} reduced={reduced} />

      {/* 360° interactive drag hint badge */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-white/10 bg-[#040812]/80 px-3.5 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.6)] backdrop-blur-md">
        <span className="h-1.5 w-1.5 rounded-full bg-bio animate-pulse shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
        <span className="font-telemetry text-[9px] tracking-[0.22em] text-slate-300 uppercase">
          DRAG 360° · TILT FOR GYRO · REAL-TIME BEAD PHYSICS
        </span>
      </div>
    </div>
  );
}
