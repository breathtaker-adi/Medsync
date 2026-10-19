"use client";

import { useMemo, useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/use-motion-prefs";

export interface HeadlineWord {
  text: string;
  accent?: "bio" | "pulse";
}

interface KineticHeadlineProps {
  lines: HeadlineWord[][];
  play: boolean;
}

/**
 * SplitText-style kinetic headline — per-character staggered rise with a hint
 * of rotation, masked by per-word overflow wrappers. Plays when `play` flips
 * true (i.e. when the boot sequence lifts).
 */
export function KineticHeadline({ lines, play }: KineticHeadlineProps) {
  const reduced = useReducedMotion();
  const actualRef = useRef<HTMLHeadingElement>(null);

  const words = useMemo(
    () =>
      lines.map((line) =>
        line.map((w, wi) => ({
          key: `${wi}-${w.text}`,
          accent: w.accent,
          chars: Array.from(w.text),
        }))
      ),
    [lines]
  );

  useGSAP(
    () => {
      const chars = actualRef.current?.querySelectorAll("[data-char]");
      if (!chars?.length) return;
      if (reduced || !play) {
        if (reduced) gsap.set(chars, { yPercent: 0, opacity: 1, rotate: 0 });
        return;
      }
      const tl = gsap.timeline({ delay: 0.15 });
      tl.fromTo(
        chars,
        { yPercent: 118, opacity: 0, rotate: 7 },
        {
          yPercent: 0,
          opacity: 1,
          rotate: 0,
          duration: 1.15,
          ease: "expo.out",
          stagger: { each: 0.024, from: "start" },
        }
      );
    },
    { scope: actualRef, dependencies: [play, reduced] }
  );

  return (
    <h1
      ref={actualRef}
      className="shimmer-line text-[clamp(2.9rem,7.2vw,6.4rem)] leading-[1.06] font-extrabold tracking-[-0.035em] text-white"
      aria-label={lines
        .map((l) => l.map((w) => w.text).join(" "))
        .join(" ")}
    >
      <span aria-hidden="true" className="block">
        {words.map((line, li) => (
          <span key={li} className="block">
          {line.map((word) => (
            <span
              key={word.key}
              className="mr-[0.24em] inline-flex overflow-hidden pb-[0.34em] -mb-[0.34em] pt-[0.1em] align-bottom"
            >
              {word.chars.map((c, ci) => (
                <span
                  key={ci}
                  data-char
                  className={
                    word.accent === "bio"
                      ? "text-gradient-sync text-glow-bio inline-block will-change-transform"
                      : word.accent === "pulse"
                        ? "text-glow-pulse inline-block text-pulse-bright will-change-transform"
                        : "inline-block will-change-transform"
                  }
                >
                  {c}
                </span>
              ))}
            </span>
          ))}
        </span>
      ))}
      </span>
    </h1>
  );
}
