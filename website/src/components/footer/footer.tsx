"use client";

import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, ArrowUp, Check, Github } from "lucide-react";
import { Magnetic } from "@/components/fx/magnetic";
import { scrollToTop } from "@/lib/scroll";
import { useReducedMotion } from "@/hooks/use-motion-prefs";

/* ── giant kinetic type ─────────────────────────────────────── */

function GiantLine({
  text,
  outlined = false,
  delay = 0,
}: {
  text: string;
  outlined?: boolean;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="overflow-hidden"
      initial={{ y: reduced ? 0 : "110%" }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: "-18%" }}
      transition={{ duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className={`footer-giant-line flex justify-center text-[clamp(3.2rem,12.5vw,11rem)] leading-[0.94] font-extrabold tracking-[-0.04em] ${
          outlined ? "footer-line-outline" : "footer-line-solid"
        }`}
        aria-label={text}
      >
        {Array.from(text).map((c, i) => (
          <span
            key={i}
            className="footer-char inline-block"
            style={{ transitionDelay: `${i * 26}ms` }}
          >
            {c === " " ? "\u00A0" : c}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

/* ── early access intake ────────────────────────────────────── */

function Intake() {
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "error" | "done">("idle");
  const [queue, setQueue] = useState(0);
  const [focused, setFocused] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
    if (!ok) {
      setState("error");
      return;
    }
    setQueue(900 + Math.floor(Math.random() * 500));
    setState("done");
  };

  const floating = focused || value.length > 0;

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="group/holo relative overflow-hidden rounded-2xl">
        <span className="holo-border rounded-2xl" aria-hidden />
        <AnimatePresence mode="wait">
          {state === "done" ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 rounded-2xl border border-pulse/30 bg-pulse/[0.07] px-6 py-5"
              role="status"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pulse/20 text-pulse-bright">
                <Check size={18} strokeWidth={3} />
              </span>
              <div>
                <div className="font-telemetry text-[11px] font-bold tracking-[0.2em] text-pulse-bright uppercase">
                  You're in the queue
                </div>
                <div className="mt-1 font-telemetry text-[10px] tracking-[0.14em] text-slate-400">
                  position #{queue.toLocaleString()} · sync invite lands within 48h
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={submit}
              exit={{ opacity: 0, y: -10 }}
              className="relative"
            >
              <div
                className={`relative flex items-center gap-2 rounded-2xl border bg-white/[0.03] px-5 py-5 backdrop-blur-md transition-colors duration-400 ${
                  state === "error"
                    ? "border-coral/50"
                    : "border-white/10 focus-within:border-bio/50"
                }`}
              >
                <label
                  htmlFor="intake-email"
                  className={`pointer-events-none absolute left-5 font-telemetry tracking-[0.18em] uppercase transition-all duration-300 ${
                    floating
                      ? "top-2 text-[8px] text-bio"
                      : "top-1/2 -translate-y-1/2 text-[11px] text-slate-500"
                  }`}
                >
                  your email · early access
                </label>
                <input
                  id="intake-email"
                  type="email"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (state === "error") setState("idle");
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  className="w-full bg-transparent pt-3 font-telemetry text-sm text-white outline-none placeholder:text-transparent"
                  autoComplete="email"
                  aria-invalid={state === "error"}
                  aria-describedby="intake-hint"
                />
                <Magnetic strength={0.25}>
                  <button
                    type="submit"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-obsidian transition-colors hover:bg-bio"
                    aria-label="Request early access"
                    data-cursor="hover"
                  >
                    <ArrowRight size={16} />
                  </button>
                </Magnetic>
              </div>
              <div
                id="intake-hint"
                className={`mt-2.5 px-1 font-telemetry text-[9px] tracking-[0.16em] uppercase transition-colors ${
                  state === "error" ? "text-coral" : "text-slate-600"
                }`}
              >
                {state === "error"
                  ? "that address doesn't parse — try again"
                  : "no spam. one sync invite. that's the whole email."}
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── footer ─────────────────────────────────────────────────── */

export function Footer() {
  const meshRef = useRef<HTMLDivElement>(null);

  const meshMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = meshRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  };

  return (
    <footer
      id="access"
      className="relative mt-12 flex flex-col overflow-clip border-t border-white/6"
      aria-label="Early access and footer"
    >
      {/* ambient mesh */}
      <div
        ref={meshRef}
        onMouseMove={meshMove}
        className="absolute inset-0"
        aria-hidden
      >
        <div className="anim-mesh absolute -top-[10%] left-[8%] h-[46vh] w-[46vw] rounded-full bg-bio/[0.06] blur-[120px]" />
        <div
          className="anim-mesh absolute top-[20%] right-[5%] h-[40vh] w-[40vw] rounded-full bg-pulse/[0.05] blur-[120px]"
          style={{ animationDelay: "-8s" }}
        />
        <div
          className="anim-mesh absolute bottom-[0%] left-[30%] h-[30vh] w-[36vw] rounded-full bg-holo/[0.04] blur-[110px]"
          style={{ animationDelay: "-14s" }}
        />
        <div className="dot-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(70%_70%_at_50%_100%,#000,transparent)]" />
      </div>

      {/* intake */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pt-24 md:px-8 md:pt-32">
        <motion.div
          className="flex flex-col items-center gap-5 text-center"
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-3 font-telemetry text-[11px] tracking-[0.32em] text-bio uppercase">
            <span className="inline-block h-px w-8 bg-gradient-to-r from-transparent to-bio" />
            05 / EARLY ACCESS
            <span className="inline-block h-px w-8 bg-gradient-to-l from-transparent to-bio" />
          </div>
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-[-0.03em] text-white text-balance md:text-5xl">
            The next 500 patients sync this quarter.
          </h2>
          <p className="max-w-md text-slate-400">
            Caregivers first, then their people. One email, one invite, zero
            spam — the sync matrix does the rest.
          </p>
        </motion.div>

        <motion.div
          className="mt-10"
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-12%" }}
          transition={{ duration: 0.9, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          <Intake />
        </motion.div>
      </div>

      {/* giant type */}
      <div className="relative z-10 mt-16 flex flex-col pb-10 md:mt-24">
        <GiantLine text="RECLAIM" delay={0} />
        <GiantLine text="YOUR" outlined delay={0.08} />
        <GiantLine text="RHYTHM." delay={0.16} />
      </div>

      {/* bottom bar */}
      <div className="relative z-10 mt-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-5 border-t border-white/6 px-5 py-6 md:flex-row md:px-8">
          <div className="font-telemetry text-[9px] tracking-[0.2em] text-slate-600 uppercase">
            © 2026 medsync — open source · built with obsession
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/breathtaker-adi/Medsync"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-telemetry text-[9px] tracking-[0.2em] text-slate-500 uppercase transition-colors hover:text-bio"
              data-cursor="hover"
            >
              <Github size={13} />
              breathtaker-adi/medsync
            </a>
            <button
              onClick={scrollToTop}
              className="group flex items-center gap-2 font-telemetry text-[9px] tracking-[0.2em] text-slate-500 uppercase transition-colors hover:text-white"
              aria-label="Back to top"
              data-cursor="hover"
            >
              back to sync
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 transition-colors group-hover:border-bio/60 group-hover:text-bio">
                <ArrowUp size={13} />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* giant type hover styles */}
      <style>{`
        .footer-line-solid .footer-char {
          color: rgba(230, 237, 247, 0.92);
          transition: color 0.5s var(--ease-observe), text-shadow 0.5s var(--ease-observe);
        }
        .footer-line-solid:hover .footer-char {
          color: #eafcff;
          text-shadow: 0 0 22px rgba(0, 240, 255, 0.5);
        }
        .footer-line-outline .footer-char {
          color: transparent;
          -webkit-text-stroke: 1.5px rgba(255, 255, 255, 0.22);
          transition: color 0.55s var(--ease-observe), -webkit-text-stroke-color 0.55s var(--ease-observe);
        }
        .footer-line-outline:hover .footer-char {
          color: rgba(0, 240, 255, 0.16);
          -webkit-text-stroke-color: rgba(0, 240, 255, 0.85);
        }
      `}</style>
    </footer>
  );
}
