"use client";

import { useRef, type ReactNode, type MouseEvent } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { useReducedMotion, useMediaQuery } from "@/hooks/use-motion-prefs";

interface MagneticProps {
  children: ReactNode;
  strength?: number;
  className?: string;
}

/** Magnetic hover wrapper — element gravitates toward the cursor, springs back on leave. */
export function Magnetic({ children, strength = 0.35, className }: MagneticProps) {
  const reduced = useReducedMotion();
  const finePointer = useMediaQuery("(pointer: fine)");
  const ref = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 180, damping: 13, mass: 0.35 });
  const sy = useSpring(y, { stiffness: 180, damping: 13, mass: 0.35 });

  if (reduced || !finePointer) {
    return <div className={className}>{children}</div>;
  }

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    x.set(relX * strength);
    y.set(relY * strength);
  };

  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x: sx, y: sy }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </motion.div>
  );
}
