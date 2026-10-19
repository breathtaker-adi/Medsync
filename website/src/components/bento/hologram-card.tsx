"use client";

import { useRef, type ReactNode, type MouseEvent } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { CornerTicks, SpotlightOverlay } from "@/components/fx/atoms";
import { useReducedMotion, useMediaQuery } from "@/hooks/use-motion-prefs";

interface HologramCardProps {
  children: ReactNode;
  className?: string;
  tilt?: boolean;
  spotlightColor?: string;
  spotlightSize?: number;
  label?: string;
}

/**
 * Shared bento surface — clinical glass with corner registration ticks,
 * cursor spotlight and a subtle holographic tilt (springs back on leave).
 */
export function HologramCard({
  children,
  className = "",
  tilt = true,
  spotlightColor = "rgba(0,240,255,0.07)",
  spotlightSize = 460,
  label,
}: HologramCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const fine = useMediaQuery("(pointer: fine)");
  const canTilt = tilt && !reduced && fine;

  const rX = useMotionValue(0);
  const rY = useMotionValue(0);
  const rotateX = useSpring(rX, { stiffness: 130, damping: 15, mass: 0.5 });
  const rotateY = useSpring(rY, { stiffness: 130, damping: 15, mass: 0.5 });

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
    if (canTilt) {
      rX.set((0.5 - py) * 4.2);
      rY.set((px - 0.5) * 5.2);
    }
  };

  const onLeave = () => {
    rX.set(0);
    rY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={canTilt ? { rotateX, rotateY, transformPerspective: 950 } : undefined}
      className={`glass-deep group relative flex h-full flex-col overflow-hidden rounded-3xl transition-transform will-change-transform ${className}`}
      data-cursor="hover"
      aria-label={label}
    >
      <SpotlightOverlay size={spotlightSize} color={spotlightColor} />
      <CornerTicks inset={10} />
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </motion.div>
  );
}

/** Shared bento card header — mono eyebrow + status chip. */
export function CardHeader({
  icon,
  title,
  chip,
  chipTone = "bio",
}: {
  icon: ReactNode;
  title: string;
  chip?: string;
  chipTone?: "bio" | "pulse" | "coral" | "amber";
}) {
  const tone = {
    bio: "border-bio/25 bg-bio/10 text-bio",
    pulse: "border-pulse/25 bg-pulse/10 text-pulse-bright",
    coral: "border-coral/25 bg-coral/10 text-coral",
    amber: "border-amber-clin/25 bg-amber-clin/10 text-amber-clin",
  }[chipTone];

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5 font-telemetry text-[10px] tracking-[0.22em] text-slate-400 uppercase">
        <span className="text-bio">{icon}</span>
        {title}
      </div>
      {chip && (
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 font-telemetry text-[9px] tracking-[0.14em] ${tone}`}
        >
          {chip}
        </span>
      )}
    </div>
  );
}
