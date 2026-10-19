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
    <div ref={ref} className="absolute inset-0" aria-hidden>
      <CapsuleCanvas frameloop={inView ? "always" : "never"} reduced={reduced} />
    </div>
  );
}
