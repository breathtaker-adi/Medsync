"use client";

import { useReducedMotion } from "@/hooks/use-motion-prefs";

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/** Filmic grain overlay — animated static, blend-mode overlay, non-interactive. */
export function Grain() {
  const reduced = useReducedMotion();
  if (reduced) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      <div
        className="absolute -inset-[100%] opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage: NOISE_SVG,
          animation: "grain-shift 0.9s steps(6) infinite",
        }}
      />
    </div>
  );
}
