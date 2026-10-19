"use client";

import type { ReactNode } from "react";

/** Kokonut-style border beam — a conic light streak endlessly orbiting the border. */
export function BorderBeam({
  soft = false,
  className = "",
}: {
  soft?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`beam-border ${soft ? "beam-border-soft" : ""} ${className}`}
    />
  );
}

/** Blueprint corner ticks — clinical registration marks on a card. */
export function CornerTicks({ inset = 8 }: { inset?: number }) {
  const base = "pointer-events-none absolute h-2.5 w-2.5 border-bio/45";
  return (
    <span aria-hidden>
      <span
        className={`${base} border-t border-l`}
        style={{ top: inset, left: inset }}
      />
      <span
        className={`${base} border-t border-r`}
        style={{ top: inset, right: inset }}
      />
      <span
        className={`${base} border-b border-l`}
        style={{ bottom: inset, left: inset }}
      />
      <span
        className={`${base} border-r border-b`}
        style={{ bottom: inset, right: inset }}
      />
    </span>
  );
}

/** React-Bits-style cursor spotlight overlay. Parent must be `relative` and forward mouse position as CSS vars. */
export function SpotlightOverlay({
  size = 520,
  color = "rgba(0,240,255,0.08)",
  className = "",
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${className}`}
      style={{
        background: `radial-gradient(${size}px circle at var(--mx, 50%) var(--my, 50%), ${color}, transparent 65%)`,
      }}
    />
  );
}
