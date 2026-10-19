"use client";

import { useEffect } from "react";
import { MotionConfig, motion, useScroll, useSpring } from "motion/react";
import { SmoothScrollProvider } from "./fx/smooth-scroll";
import { Preloader } from "./fx/preloader";
import { Grain } from "./fx/grain";
import { ScrollTrigger } from "@/lib/gsap";

/** Hairline scroll-progress rail pinned to the very top of the viewport. */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 });
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[75] h-[2px] origin-left bg-gradient-to-r from-bio via-bio to-pulse"
      style={{ scaleX }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  // once webfonts settle, re-measure every pinned/scrubbed section
  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) ScrollTrigger.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <SmoothScrollProvider>
        <ScrollProgress />
        <Grain />
        {children}
      </SmoothScrollProvider>
    </MotionConfig>
  );
}
