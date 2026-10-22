"use client";

import { Magnetic } from "@/components/fx/magnetic";
import { scrollToTop } from "@/lib/scroll";
import { ArrowUp, Download, Github, ShieldCheck, Smartphone } from "lucide-react";
import { motion } from "motion/react";
import { useRef, type MouseEvent } from "react";

/* ── download release block ─────────────────────────────────── */

function DownloadBlock() {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="relative overflow-hidden rounded-2xl border border-bio/30 bg-[#061017]/90 p-6 md:p-8 shadow-[0_20px_80px_-20px_rgba(0,240,255,0.2)] backdrop-blur-xl">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-center sm:justify-start gap-2 font-telemetry text-[10px] tracking-[0.2em] text-pulse-bright uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-pulse" /> Latest Stable Build
            </div>
            <div className="text-xl font-bold text-white sm:text-2xl">
              MedSync for Android
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-slate-400">
              Direct APK installation for Android devices. Full offline vault, AI camera prescription intake, and instant caregiver alerts.
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2 font-telemetry text-[9px] text-slate-400">
              <span className="rounded bg-bio/15 text-bio font-semibold px-2 py-0.5">v1.2.0 (Latest)</span>
              <span className="rounded bg-white/5 px-2 py-0.5">Android 8.0 - 15</span>
              <span className="rounded bg-white/5 px-2 py-0.5">~100 MB</span>
              <span className="rounded bg-white/5 px-2 py-0.5">Open Source MIT</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full sm:w-auto shrink-0">
            <Magnetic strength={0.25}>
              <a
                href="https://github.com/breathtaker-adi/Medsync/releases/download/v1.2.0/MedSync-v1.2.0.apk"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-bio to-pulse px-6 py-3.5 font-telemetry text-[11px] font-bold tracking-[0.14em] text-obsidian uppercase transition-all duration-300 hover:brightness-110 hover:shadow-[0_0_24px_rgba(0,240,255,0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bio"
                aria-label="Download MedSync Android APK (v1.2.0 Production Release)"
              >
                <Download size={15} className="transition-transform duration-300 group-hover:-translate-y-0.5" />
                Download APK (v1.2.0)
              </a>
            </Magnetic>
            <a
              href="https://github.com/breathtaker-adi/Medsync/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 font-telemetry text-[10px] tracking-[0.14em] text-slate-300 uppercase transition-colors hover:border-bio/40 hover:text-bio focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bio"
            >
              <Github size={13} />
              Releases &amp; Changelog
            </a>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-white/6 pt-4 text-[10px] font-telemetry text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-pulse-bright" /> Verified SHA-256 Checksum on GitHub
          </span>
          <span className="flex items-center gap-1.5">
            <Smartphone size={12} className="text-bio" /> Sideload Instructions Included
          </span>
        </div>
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
      className="relative mt-4 flex flex-col overflow-clip border-t border-white/6"
      aria-label="Download and footer"
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

      {/* download hero */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pt-12 md:px-8 md:pt-16">
        <motion.div
          className="flex flex-col items-center gap-3 text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-3 font-telemetry text-[11px] tracking-[0.32em] text-bio uppercase">
            <span className="inline-block h-px w-8 bg-gradient-to-r from-transparent to-bio" aria-hidden="true" />
            06 / DOWNLOAD
            <span className="inline-block h-px w-8 bg-gradient-to-l from-transparent to-bio" aria-hidden="true" />
          </div>
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-[-0.03em] text-white text-balance md:text-5xl">
            Get MedSync on your phone.
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-slate-400 md:text-base">
            Take control of your prescriptions, schedule adherence, and family caregiver sync with our open-source Android build.
          </p>
        </motion.div>

        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-12%" }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <DownloadBlock />
        </motion.div>
      </div>

      {/* refined brand statement */}
      <div className="relative z-10 my-10 flex flex-col items-center justify-center px-4 text-center md:my-14">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center"
        >
          <div className="text-[clamp(2.2rem,6.4vw,5.4rem)] font-extrabold tracking-[-0.035em] leading-[1.08]">
            <span className="footer-line-solid footer-char inline-block mr-2 sm:mr-3">RECLAIM</span>
            <span className="footer-line-outline footer-char inline-block mr-2 sm:mr-3">YOUR</span>
            <span className="text-gradient-sync inline-block drop-shadow-[0_0_24px_rgba(0,240,255,0.4)]">
              RHYTHM.
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 font-telemetry text-[9.5px] tracking-[0.22em] text-slate-400 uppercase">
            <span>PATIENT-FIRST</span>
            <span className="text-bio" aria-hidden="true">·</span>
            <span>DPDP ACT 2023 READY</span>
            <span className="text-bio" aria-hidden="true">·</span>
            <span>OPEN SOURCE (MIT)</span>
          </div>
          {/* Medical disclaimer */}
          <p className="mt-4 max-w-lg text-[11px] leading-relaxed text-slate-500">
            MedSync is designed to support schedule management and adherence tracking. It does not provide medical diagnosis or replace consultation with a licensed healthcare professional.
          </p>
        </motion.div>
      </div>

      {/* bottom bar */}
      <div className="relative z-10 mt-auto border-t border-white/8 bg-obsidian/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-5 px-5 py-6 sm:flex-row sm:pr-48 md:px-8 md:pr-56">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-telemetry text-[10px] tracking-[0.2em] text-slate-400 uppercase">
            <span>© {currentYear} MEDSYNC · OPEN SOURCE (MIT)</span>
            <span className="hidden text-white/20 sm:inline" aria-hidden="true">|</span>
            <a
              href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/privacy`}
              className="text-slate-400 transition-colors hover:text-bio"
            >
              Privacy Policy
            </a>
            <span className="text-white/20" aria-hidden="true">·</span>
            <a
              href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/faq`}
              className="text-slate-400 transition-colors hover:text-bio"
            >
              FAQ
            </a>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/breathtaker-adi/Medsync"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-telemetry text-[10px] tracking-[0.2em] text-slate-400 uppercase transition-colors hover:text-bio focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bio"
            >
              <Github size={13} aria-hidden="true" focusable="false" />
              <span className="hidden lg:inline">breathtaker-adi/Medsync</span>
              <span className="lg:hidden">GitHub</span>
            </a>
            <button
              type="button"
              onClick={scrollToTop}
              className="group flex items-center gap-2 font-telemetry text-[10px] tracking-[0.2em] text-slate-400 uppercase transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bio"
              aria-label="Back to top"
            >
              back to top
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
