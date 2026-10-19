"use client";

import { useRef, type MouseEvent } from "react";
import { ShieldCheck, Lock } from "lucide-react";
import { HologramCard, CardHeader } from "./hologram-card";

const CHIPS = ["AES-256-GCM", "LOCAL-FIRST", "ZERO-KNOWLEDGE"];

/**
 * Offline-first vault — holographic lock with cursor-tracked specular
 * lighting and an iridescent holo border that ignites on hover.
 */
export function VaultCard({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  };

  return (
    <HologramCard className={className} label="Offline-first vault" tilt={false} spotlightColor="rgba(139,123,255,0.07)">
      <div className="flex h-full flex-col gap-4 p-6">
        <CardHeader
          icon={<ShieldCheck size={13} />}
          title="Offline-First Vault"
          chip="ENCRYPTED"
          chipTone="bio"
        />

        {/* holographic lock */}
        <div
          ref={ref}
          onMouseMove={onMove}
          className="parent-specular group/holo relative mx-auto flex aspect-square w-full max-w-[150px] flex-1 items-center justify-center rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.04] to-transparent"
        >
          <span className="holo-border rounded-2xl" aria-hidden />
          <span className="specular rounded-2xl" aria-hidden />
          <div className="relative flex flex-col items-center gap-2">
            <Lock
              size={38}
              strokeWidth={1.4}
              className="text-slate-300 transition-all duration-500 group-hover/holo:text-bio group-hover/holo:[animation:hue-cycle_4s_linear_infinite] group-hover/holo:drop-shadow-[0_0_14px_rgba(0,240,255,0.7)]"
            />
            <span className="font-telemetry text-[8px] tracking-[0.3em] text-slate-500 uppercase group-hover/holo:text-slate-300">
              VAULT · SEALED
            </span>
          </div>
        </div>

        <p className="text-[13px] leading-relaxed text-slate-400">
          Your records live on-device, encrypted. The cloud is a mirror —
          never the master. No signal, no problem.
        </p>

        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <span
              key={c}
              className="rounded-full border border-white/8 bg-white/[0.02] px-2.5 py-1 font-telemetry text-[8px] tracking-[0.16em] text-slate-400"
            >
              {c}
            </span>
          ))}
        </div>

        <div className="mt-auto border-t border-white/6 pt-3">
          <div className="mb-1.5 flex justify-between font-telemetry text-[8px] tracking-[0.18em] text-slate-500 uppercase">
            <span>Vault integrity</span>
            <span className="text-pulse-bright">100% · 3 CRDT ops queued</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/8">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-bio to-pulse" />
          </div>
        </div>
      </div>
    </HologramCard>
  );
}
