"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useAnimationFrame,
  AnimatePresence,
} from "motion/react";
import { useReducedMotion, useMediaQuery } from "@/hooks/use-motion-prefs";

type Variant = "default" | "hover" | "label";

/**
 * Velocity-sensitive magnetic cursor — a difference-blend dot with a trailing
 * ring that stretches along its travel vector and morphs over interactive
 * targets. Only mounts for fine pointers without reduced-motion.
 */
export function Cursor() {
  const reduced = useReducedMotion();
  const finePointer = useMediaQuery("(pointer: fine)");
  const enabled = finePointer && !reduced;
  const [variant, setVariant] = useState<Variant>("default");
  const [label, setLabel] = useState("");
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);

  const dotX = useSpring(x, { stiffness: 900, damping: 55, mass: 0.3 });
  const dotY = useSpring(y, { stiffness: 900, damping: 55, mass: 0.3 });
  const ringX = useSpring(x, { stiffness: 170, damping: 20, mass: 0.7 });
  const ringY = useSpring(y, { stiffness: 170, damping: 20, mass: 0.7 });

  // velocity stretch
  const ang = useMotionValue(0);
  const stretchX = useSpring(1, { stiffness: 260, damping: 20 });
  const stretchY = useSpring(1, { stiffness: 260, damping: 20 });
  const rotate = useSpring(0, { stiffness: 200, damping: 24 });
  const last = useRef({ x: 0, y: 0, t: 0 });

  useEffect(() => {
    if (!enabled) return;

    const onMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setVisible(true);
    };
    const onLeave = () => setVisible(false);
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const labelled = t.closest<HTMLElement>("[data-cursor-label]");
      if (labelled) {
        setLabel(labelled.dataset.cursorLabel ?? "");
        setVariant("label");
        return;
      }
      if (
        t.closest(
          "a, button, input, textarea, select, [role='slider'], [data-cursor='hover']"
        )
      ) {
        setVariant("hover");
        return;
      }
      setVariant("default");
    };
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
    };
  }, [enabled, x, y]);

  useAnimationFrame((t) => {
    if (!enabled) return;
    const dx = x.get() - last.current.x;
    const dy = y.get() - last.current.y;
    const dt = Math.max(t - last.current.t, 1);
    last.current.x = x.get();
    last.current.y = y.get();
    last.current.t = t;
    const v = Math.min(Math.hypot(dx, dy) / dt, 3.2); // px per ms, clamped
    if (Math.hypot(dx, dy) > 1.5) {
      ang.set((Math.atan2(dy, dx) * 180) / Math.PI);
    }
    const s = Math.min(v / 3.2, 1);
    stretchX.set(1 + s * 0.45);
    stretchY.set(1 - s * 0.22);
    rotate.set(ang.get());
  });

  if (!enabled) return null;

  const ringSize = variant === "label" ? 76 : variant === "hover" ? 56 : 34;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80]">
      {/* trailing ring */}
      <motion.div
        className="absolute top-0 left-0"
        style={{ x: ringX, y: ringY, opacity: visible ? 1 : 0 }}
      >
        <motion.div
          className="flex items-center justify-center rounded-full border border-white/60"
          style={{
            width: ringSize,
            height: ringSize,
            x: "-50%",
            y: "-50%",
            scaleX: stretchX,
            scaleY: stretchY,
            rotate,
            mixBlendMode: variant === "label" ? "normal" : "difference",
            backgroundColor:
              variant === "label" ? "rgba(255,255,255,0.96)" : "transparent",
          }}
          animate={{ scale: pressed ? 0.82 : 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
        >
          <AnimatePresence>
            {variant === "label" && (
              <motion.span
                key={label}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                className="font-telemetry text-[9px] font-semibold tracking-[0.18em] text-obsidian uppercase"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* precise dot */}
      <motion.div
        className="absolute top-0 left-0"
        style={{ x: dotX, y: dotY, opacity: visible && variant !== "label" ? 1 : 0 }}
      >
        <motion.div
          className="rounded-full bg-white"
          style={{
            width: 6,
            height: 6,
            x: "-50%",
            y: "-50%",
            mixBlendMode: "difference",
          }}
          animate={{ scale: pressed ? 1.8 : variant === "hover" ? 0.5 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        />
      </motion.div>
    </div>
  );
}
