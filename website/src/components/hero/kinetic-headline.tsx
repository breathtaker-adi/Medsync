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
      const wrappers = actualRef.current?.querySelectorAll("[data-word-wrapper]");
      if (!chars?.length) return;

      const clearPropsAndUnclip = () => {
        wrappers?.forEach((el) => {
          (el as HTMLElement).style.overflow = "visible";
        });
        gsap.set(chars, { clearProps: "transform,willChange" });
      };

      if (reduced || !play) {
        if (reduced) {
          gsap.set(chars, { yPercent: 0, opacity: 1, rotate: 0 });
          clearPropsAndUnclip();
        }
        return;
      }

      const tl = gsap.timeline({
        delay: 0.15,
        onComplete: clearPropsAndUnclip,
      });

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
      className="select-none text-[clamp(2.9rem,7.2vw,6.4rem)] leading-[1.06] font-extrabold tracking-[-0.035em] text-white"
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
                data-word-wrapper
                className={
                  word.accent === "bio"
                    ? "mr-[0.24em] inline-flex relative align-bottom overflow-hidden px-[0.7em] -mx-[0.7em] pt-[0.5em] -mt-[0.5em] pb-[0.75em] -mb-[0.75em] word-glow-bio"
                    : word.accent === "pulse"
                    ? "mr-[0.24em] inline-flex relative align-bottom overflow-hidden px-[0.7em] -mx-[0.7em] pt-[0.5em] -mt-[0.5em] pb-[0.75em] -mb-[0.75em] word-glow-pulse"
                    : "mr-[0.24em] inline-flex relative align-bottom overflow-hidden pb-[0.34em] -mb-[0.34em] pt-[0.1em]"
                }
              >
                {word.chars.map((c, ci) => (
                  <span
                    key={ci}
                    data-char
                    style={
                      word.accent
                        ? ({
                            "--char-idx": ci,
                            "--char-total": word.chars.length,
                          } as React.CSSProperties)
                        : undefined
                    }
                    className={
                      word.accent === "bio"
                        ? "text-gradient-sync inline-block"
                        : word.accent === "pulse"
                        ? "text-gradient-schedule inline-block"
                        : "inline-block"
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
