"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { setLenis } from "@/lib/scroll";
import { useReducedMotion } from "@/hooks/use-motion-prefs";

/**
 * Global momentum layer — Lenis (lerp 0.08) driven by GSAP's ticker so
 * ScrollTrigger stays perfectly in sync with the smoothed scroll position.
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return; // native scrolling for prefers-reduced-motion

    const lenis = new Lenis({
      lerp: 0.08,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
      smoothWheel: true,
    });
    setLenis(lenis);

    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      setLenis(null);
    };
  }, [reduced]);

  return <>{children}</>;
}
