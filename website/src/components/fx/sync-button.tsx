"use client";

import { useCallback, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Magnetic } from "./magnetic";
import { BorderBeam } from "./atoms";
import { useReducedMotion } from "@/hooks/use-motion-prefs";

interface SyncButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  className?: string;
  type?: "button" | "submit";
  ariaLabel?: string;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
}

/**
 * Primary CTA — magnetic, beam-lit border, ripple feedback on click.
 * The primary fill inverts the palette; ghost stays clinical glass.
 */
export function SyncButton({
  children,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
  ariaLabel,
}: SyncButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const idRef = useRef(0);
  const reduced = useReducedMotion();

  const spawnRipple = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (reduced) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const id = ++idRef.current;
      setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
      window.setTimeout(() => {
        setRipples((r) => r.filter((rip) => rip.id !== id));
      }, 700);
    },
    [reduced]
  );

  const base =
    "group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-full px-7 py-3.5 font-telemetry text-[12px] font-semibold tracking-[0.14em] uppercase transition-colors duration-300";

  const skin =
    variant === "primary"
      ? "bg-white text-obsidian hover:bg-bio hover:text-obsidian"
      : "glass text-slate-200 hover:text-white hover:border-white/20";

  return (
    <Magnetic strength={0.32}>
      <button
        type={type}
        aria-label={ariaLabel}
        onClick={(e) => {
          spawnRipple(e);
          onClick?.();
        }}
        className={`${base} ${skin} ${className}`}
        data-cursor="hover"
      >
        {/* border beam on primary */}
        {variant === "primary" && (
          <span
            aria-hidden
            className="beam-border rounded-full opacity-90"
          />
        )}
        {/* glow halo for primary */}
        {variant === "primary" && (
          <span
            aria-hidden
            className="absolute -inset-1 -z-10 rounded-full bg-bio/25 blur-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        )}

        <span className="relative z-10 flex items-center gap-2.5">{children}</span>

        {/* ripples */}
        <AnimatePresence>
          {ripples.map((r) => (
            <motion.span
              key={r.id}
              className={`pointer-events-none absolute h-2 w-2 rounded-full ${
                variant === "primary" ? "bg-obsidian/30" : "bg-bio/40"
              }`}
              style={{ left: r.x, top: r.y, x: "-50%", y: "-50%" }}
              initial={{ scale: 0, opacity: 0.7 }}
              animate={{ scale: 34, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}
        </AnimatePresence>
      </button>
    </Magnetic>
  );
}

/** Secondary link-style CTA with an arrow that slides across on hover. */
export function SlideLink({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative inline-flex cursor-pointer items-center gap-3 px-2 py-3 font-telemetry text-[12px] font-semibold tracking-[0.14em] text-slate-300 uppercase transition-colors hover:text-white ${className}`}
    >
      <span>{children}</span>
      <span className="relative block h-px w-8 overflow-hidden bg-white/25">
        <span className="absolute inset-0 -translate-x-full bg-bio transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0" />
      </span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="translate-x-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5"
      >
        <path
          d="M1 7h11M8 3l4 4-4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
