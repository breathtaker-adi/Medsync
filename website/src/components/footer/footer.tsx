"use client";

import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, ArrowUp, Check, Github } from "lucide-react";
import { Magnetic } from "@/components/fx/magnetic";
import { scrollToTop } from "@/lib/scroll";

/* ── early access intake ────────────────────────────────────── */

function Intake() {
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "error" | "done">("idle");
  const [queue, setQueue] = useState(0);
  const [focused, setFocused] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = value.trim();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean);
    if (!ok) {
      setState("error");
      return;
    }

    // Persist email in local queue for static-export deployment
    try {
      const existing = JSON.parse(localStorage.getItem("medsync_early_access") || "[]");
      if (!existing.some((entry: { email: string }) => entry.email === clean)) {
        existing.push({ email: clean, submittedAt: new Date().toISOString() });
        localStorage.setItem("medsync_early_access", JSON.stringify(existing));
      }
    } catch {}

    setQueue(900 + Math.floor(Math.random() * 500));
    setState("done");
  };

  const floating = focused || value.length > 0;

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="group/holo relative overflow-hidden rounded-2xl">
        <span className="holo-border rounded-2xl" aria-hidden="true" />
        <AnimatePresence mode="wait">
          {state === "done" ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 rounded-2xl border border-pulse/30 bg-pulse/[0.07] px-6 py-5 backdrop-blur-md"
              role="status"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pulse/20 text-pulse-bright">
                <Check size={18} strokeWidth={3} aria-hidden="true" focusable="false" />
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
              action="#"
              method="POST"
              onSubmit={submit}
              exit={{ opacity: 0, y: -10 }}
              className="relative"
            >
              <div
                className={`float-field relative flex items-center gap-2 rounded-2xl border bg-white/[0.03] px-5 py-4 backdrop-blur-md transition-colors duration-400 ${
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
                      : "top-1/2 -translate-y-1/2 text-[11px] text-slate-400"
                  }`}
                >
                  your email · early access
                </label>
                <input
                  id="intake-email"
                  name="email"
                  type="email"
                  value={value}
                  placeholder={floating ? "you@caregiver.org" : ""}
                  required
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (state === "error") setState("idle");
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  className="w-full bg-transparent pt-3.5 font-telemetry text-sm text-white outline-none focus-visible:outline-none"
                  autoComplete="email"
                  aria-invalid={state === "error"}
                  aria-describedby="intake-hint"
                />
                <Magnetic strength={0.25}>
                  <button
                    type="submit"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-obsidian transition-colors hover:bg-bio focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bio"
                    aria-label="Request early access"
                    data-cursor="hover"
                  >
                    <ArrowRight size={16} aria-hidden="true" focusable="false" />
                  </button>
                </Magnetic>
              </div>
              <div
                id="intake-hint"
                className={`mt-2.5 px-1 font-telemetry text-[9px] tracking-[0.16em] uppercase transition-colors ${
                  state === "error" ? "text-coral" : "text-slate-400"
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
  const currentYear = new Date().getFullYear();

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
      className="relative mt-8 flex flex-col overflow-clip border-t border-white/6"
      aria-label="Early access and footer"
    >
      {/* ambient mesh */}
      <div
        ref={meshRef}
        onMouseMove={meshMove}
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
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
      <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pt-20 md:px-8 md:pt-28">
        <motion.div
          className="flex flex-col items-center gap-4 text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-3 font-telemetry text-[11px] tracking-[0.32em] text-bio uppercase">
            <span className="inline-block h-px w-8 bg-gradient-to-r from-transparent to-bio" aria-hidden="true" />
            05 / EARLY ACCESS
            <span className="inline-block h-px w-8 bg-gradient-to-l from-transparent to-bio" aria-hidden="true" />
          </div>
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-[-0.03em] text-white text-balance md:text-5xl">
            The next 500 patients sync this quarter.
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-slate-400 md:text-base">
            Caregivers first, then their people. One email, one invite, zero
            spam — the sync matrix does the rest.
          </p>
        </motion.div>

        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-12%" }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <Intake />
        </motion.div>
      </div>

      {/* refined brand statement */}
      <div className="relative z-10 my-16 flex flex-col items-center justify-center px-4 text-center md:my-20">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center"
        >
          <div className="text-[clamp(2.4rem,6.8vw,5.8rem)] font-extrabold tracking-[-0.035em] leading-[1.08]">
            <span className="footer-line-solid footer-char inline-block mr-2 sm:mr-3">RECLAIM</span>
            <span className="footer-line-outline footer-char inline-block mr-2 sm:mr-3">YOUR</span>
            <span className="text-gradient-sync inline-block drop-shadow-[0_0_24px_rgba(0,240,255,0.4)]">
              RHYTHM.
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 font-telemetry text-[9.5px] tracking-[0.22em] text-slate-500 uppercase">
            <span>PATIENT-FIRST</span>
            <span className="text-bio" aria-hidden="true">·</span>
            <span>FHIR R4 COMPLIANT</span>
            <span className="text-bio" aria-hidden="true">·</span>
            <span>ZERO-KNOWLEDGE VAULT</span>
          </div>
        </motion.div>
      </div>

      {/* bottom bar */}
      <div className="relative z-10 mt-auto border-t border-white/8 bg-obsidian/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-5 px-5 py-6 sm:flex-row md:px-8 md:pr-48">
          <div className="font-telemetry text-[10px] tracking-[0.2em] text-slate-500 uppercase">
            © {currentYear} MEDSYNC — OPEN SOURCE (MIT) · BUILT WITH OBSESSION
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/breathtaker-adi/Medsync"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-telemetry text-[10px] tracking-[0.2em] text-slate-400 uppercase transition-colors hover:text-bio focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bio"
              data-cursor="hover"
            >
              <Github size={13} aria-hidden="true" focusable="false" />
              breathtaker-adi/Medsync
            </a>
            <button
              type="button"
              onClick={scrollToTop}
              className="group flex items-center gap-2 font-telemetry text-[10px] tracking-[0.2em] text-slate-400 uppercase transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bio"
              aria-label="Back to top"
              data-cursor="hover"
            >
              back to sync
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 transition-colors group-hover:border-bio/60 group-hover:text-bio">
                <ArrowUp size={13} aria-hidden="true" focusable="false" />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* giant type hover styles */}
      <style>{`
        .footer-line-solid.footer-char {
          color: rgba(230, 237, 247, 0.95);
          transition: color 0.5s var(--ease-observe), text-shadow 0.5s var(--ease-observe);
        }
        .footer-line-solid.footer-char:hover {
          color: #eafcff;
          text-shadow: 0 0 22px rgba(0, 240, 255, 0.5);
        }
        .footer-line-outline.footer-char {
          color: transparent;
          -webkit-text-stroke: 1.5px rgba(255, 255, 255, 0.3);
          transition: color 0.55s var(--ease-observe), -webkit-text-stroke-color 0.55s var(--ease-observe);
        }
        .footer-line-outline.footer-char:hover {
          color: rgba(0, 240, 255, 0.16);
          -webkit-text-stroke-color: rgba(0, 240, 255, 0.85);
        }
      `}</style>
    </footer>
  );
}
