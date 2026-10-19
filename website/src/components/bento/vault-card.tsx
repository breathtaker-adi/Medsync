"use client";

import { useRef, type MouseEvent } from "react";
import { ShieldCheck, Lock } from "lucide-react";
import { HologramCard, CardHeader } from "./hologram-card";

const CHIPS = ["ON-DEVICE ENCRYPTED", "DPDP 2023 READY", "LOCAL-FIRST"];

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
      <div className="flex h-full flex-col justify-between p-5 md:p-6">
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
          className="parent-specular group/holo relative mx-auto my-2 flex h-20 w-28 items-center justify-center rounded-xl border border-white/8 bg-gradient-to-br from-white/[0.04] to-transparent"
        >
          <span className="holo-border rounded-xl" aria-hidden />
          <span className="specular rounded-xl" aria-hidden />
          <div className="relative flex flex-col items-center gap-1.5">
            <Lock
              size={26}
              strokeWidth={1.5}
              className="text-slate-300 transition-all duration-500 group-hover/holo:text-bio group-hover/holo:[animation:hue-cycle_4s_linear_infinite] group-hover/holo:drop-shadow-[0_0_14px_rgba(0,240,255,0.7)]"
            />
            <span className="font-telemetry text-[8px] tracking-[0.25em] text-slate-400 uppercase">
              LOCAL · ENCRYPTED
            </span>
          </div>
        </div>

        <p className="text-[12px] leading-relaxed text-slate-300">
          Your records live safely on-device in local SQLite storage. Syncs seamlessly to the cloud when connected.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map((c) => (
            <span
              key={c}
              className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-0.5 font-telemetry text-[8px] tracking-[0.14em] text-slate-400"
            >
              {c}
            </span>
          ))}
        </div>

        <div className="border-t border-white/6 pt-2.5">
          <div className="mb-1 flex justify-between font-telemetry text-[8px] tracking-[0.16em] text-slate-400 uppercase">
            <span>Storage integrity</span>
            <span className="text-pulse-bright">Active · 0 drops</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/8">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-bio to-pulse" />
          </div>
        </div>
      </div>
    </HologramCard>
  );
}
