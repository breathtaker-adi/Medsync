"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Waypoints } from "lucide-react";
import { HologramCard, CardHeader } from "./hologram-card";

/**
 * Tri-party sync bridge — Patient ↔ Doctor ↔ Pharmacy nodes stitched with
 * bezier paths; light packets traverse the curves via SVG motion paths.
 */
const NODES = {
  patient: { x: 160, y: 36, label: "PATIENT" },
  doctor: { x: 58, y: 154, label: "DOCTOR" },
  pharmacy: { x: 262, y: 154, label: "PHARMACY" },
} as const;

const ROUTES = [
  { key: "p-d", d: `M${NODES.patient.x},${NODES.patient.y} C120,84 82,102 ${NODES.doctor.x},${NODES.doctor.y}` },
  { key: "p-ph", d: `M${NODES.patient.x},${NODES.patient.y} C200,84 238,102 ${NODES.pharmacy.x},${NODES.pharmacy.y}` },
  { key: "d-ph", d: `M${NODES.doctor.x},${NODES.doctor.y} C124,182 196,182 ${NODES.pharmacy.x},${NODES.pharmacy.y}` },
] as const;

const NODE_LINKS: Record<string, string[]> = {
  patient: ["p-d", "p-ph"],
  doctor: ["p-d", "d-ph"],
  pharmacy: ["p-ph", "d-ph"],
};

type NodeKey = keyof typeof NODES;

export function SyncBridgeCard({ className = "" }: { className?: string }) {
  const [active, setActive] = useState<NodeKey | null>(null);
  const [packets, setPackets] = useState(2847);

  useEffect(() => {
    const id = window.setInterval(
      () => setPackets((p) => p + 1 + Math.floor(Math.random() * 3)),
      1300
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <HologramCard className={className} label="Tri-party sync bridge" spotlightColor="rgba(16,185,129,0.06)">
      <div className="flex h-full flex-col gap-4 p-6">
        <CardHeader
          icon={<Waypoints size={13} />}
          title="Tri-Party Sync"
          chip="LIVE"
          chipTone="pulse"
        />

        <div className="relative flex-1">
          <motion.svg
            viewBox="0 0 320 190"
            className="h-full w-full"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-15%" }}
            transition={{ duration: 1 }}
            role="img"
            aria-label="Patient, doctor and pharmacy nodes exchanging live sync packets"
          >
            {/* base paths */}
            {ROUTES.map((r) => (
              <path
                key={r.key}
                d={r.d}
                fill="none"
                stroke={
                  active && NODE_LINKS[active].includes(r.key)
                    ? "rgba(0,240,255,0.55)"
                    : "rgba(255,255,255,0.12)"
                }
                strokeWidth="1"
                style={{ transition: "stroke 0.3s" }}
              />
            ))}
            {/* flowing dash overlay */}
            {ROUTES.map((r) => (
              <path
                key={`${r.key}-dash`}
                d={r.d}
                fill="none"
                stroke={
                  active && NODE_LINKS[active].includes(r.key)
                    ? "rgba(0,240,255,0.9)"
                    : "rgba(0,240,255,0.35)"
                }
                strokeWidth="1"
                className="anim-dash-flow"
                style={{ transition: "stroke 0.3s" }}
              />
            ))}

            {/* light packets */}
            {ROUTES.map((r, i) => (
              <circle key={`${r.key}-beam`} r="2.6" fill="#00f0ff" opacity="0.95">
                <animateMotion
                  dur="2.6s"
                  begin={`${-i * 0.85}s`}
                  repeatCount="indefinite"
                  path={r.d}
                />
                <animate
                  attributeName="opacity"
                  values="0;1;1;0"
                  keyTimes="0;0.12;0.85;1"
                  dur="2.6s"
                  begin={`${-i * 0.85}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
            {ROUTES.map((r, i) => (
              <circle key={`${r.key}-beam2`} r="1.7" fill="#34d399" opacity="0.8">
                <animateMotion
                  dur="2.6s"
                  begin={`${-i * 0.85 - 1.3}s`}
                  repeatCount="indefinite"
                  path={r.d}
                />
              </circle>
            ))}

            {/* nodes */}
            {(Object.keys(NODES) as NodeKey[]).map((key) => {
              const n = NODES[key];
              const isActive = active === key;
              return (
                <g
                  key={key}
                  onMouseEnter={() => setActive(key)}
                  onMouseLeave={() => setActive(null)}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r="17"
                    fill="rgba(11,15,25,0.9)"
                    stroke={isActive ? "#00f0ff" : "rgba(255,255,255,0.18)"}
                    strokeWidth={isActive ? 1.6 : 1}
                    style={{
                      transition: "stroke 0.3s",
                      filter: isActive ? "drop-shadow(0 0 8px rgba(0,240,255,0.6))" : undefined,
                    }}
                  />
                  {isActive && (
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r="17"
                      fill="none"
                      stroke="#00f0ff"
                      strokeWidth="1"
                      className="anim-ping-dot"
                      style={{ transformBox: "fill-box", transformOrigin: "center" }}
                    />
                  )}
                  {key === "patient" && (
                    <g stroke={isActive ? "#00f0ff" : "rgba(255,255,255,0.65)"} strokeWidth="1.5" fill="none" strokeLinecap="round">
                      <circle cx={n.x} cy={n.y - 4} r="3.2" />
                      <path d={`M${n.x - 5.5},${n.y + 6.5} a5.5,5 0 0 1 11,0`} />
                    </g>
                  )}
                  {key === "doctor" && (
                    <g stroke={isActive ? "#00f0ff" : "rgba(255,255,255,0.65)"} strokeWidth="1.5" strokeLinecap="round">
                      <line x1={n.x} y1={n.y - 5.5} x2={n.x} y2={n.y + 5.5} />
                      <line x1={n.x - 5.5} y1={n.y} x2={n.x + 5.5} y2={n.y} />
                    </g>
                  )}
                  {key === "pharmacy" && (
                    <text
                      x={n.x}
                      y={n.y + 3.5}
                      textAnchor="middle"
                      fill={isActive ? "#00f0ff" : "rgba(255,255,255,0.7)"}
                      fontSize="9"
                      fontFamily="var(--font-jetbrains), monospace"
                      fontWeight="700"
                      style={{ transition: "fill 0.3s" }}
                    >
                      Rx
                    </text>
                  )}
                  <text
                    x={n.x}
                    y={n.y + 31}
                    textAnchor="middle"
                    fill={isActive ? "#7ef0ff" : "rgba(255,255,255,0.4)"}
                    fontSize="7.5"
                    letterSpacing="2.5"
                    fontFamily="var(--font-jetbrains), monospace"
                    style={{ transition: "fill 0.3s" }}
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
          </motion.svg>
        </div>

        <div className="flex items-center justify-between font-telemetry text-[9px] tracking-[0.16em] text-slate-500 uppercase">
          <span>
            <span className="tabular-nums text-bio">{packets.toLocaleString()}</span> packets
          </span>
          <span className="text-pulse-bright">0 drops</span>
        </div>
      </div>
    </HologramCard>
  );
}
