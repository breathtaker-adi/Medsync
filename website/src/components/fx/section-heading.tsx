"use client";

import type { ReactNode } from "react";
import { Reveal } from "./reveal";

interface SectionHeadingProps {
  index: string;
  eyebrow: string;
  title: ReactNode;
  description?: string;
  align?: "left" | "center";
  className?: string;
}

/** Consistent section header — mono telemetry eyebrow + tight display title. */
export function SectionHeading({
  index,
  eyebrow,
  title,
  description,
  align = "left",
  className = "",
}: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div
      className={`${centered ? "mx-auto items-center text-center" : "items-start"} flex max-w-3xl flex-col gap-5 ${className}`}
    >
      <Reveal>
        <div className="flex items-center gap-3 font-telemetry text-[11px] tracking-[0.32em] text-bio uppercase">
          <span className="inline-block h-px w-8 bg-gradient-to-r from-bio to-transparent" />
          <span className="text-slate-500">{index}</span>
          <span>/</span>
          <span>{eyebrow}</span>
        </div>
      </Reveal>
      <Reveal delay={0.08}>
        <h2 className="text-4xl leading-[1.02] font-extrabold tracking-[-0.03em] text-white text-balance md:text-6xl">
          {title}
        </h2>
      </Reveal>
      {description && (
        <Reveal delay={0.16}>
          <p className="max-w-xl text-base leading-relaxed text-slate-400 md:text-lg">
            {description}
          </p>
        </Reveal>
      )}
    </div>
  );
}
