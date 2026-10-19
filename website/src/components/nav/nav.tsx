"use client";

import { useState } from "react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "motion/react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Magnetic } from "@/components/fx/magnetic";
import { scrollToId, scrollToTop } from "@/lib/scroll";
import { BUS, emit } from "@/lib/events";

const LINKS = [
  { label: "SYSTEM", target: "system" },
  { label: "A DAY", target: "day" },
  { label: "TELEMETRY", target: "telemetry" },
  { label: "FILM", target: "film" },
  { label: "FAQ", target: "faq" },
];

export function Nav() {
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    if (menuOpen) return;
    setHidden(y > prev && y > 140);
  });

  const go = (target: string) => {
    setMenuOpen(false);
    scrollToId(target);
    try {
      history.pushState(null, "", `#${target}`);
    } catch {}
  };

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-4 md:pt-5"
        initial={{ y: -90, opacity: 0 }}
        animate={{ y: hidden ? -110 : 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <nav
          aria-label="Primary"
          className="glass-strong flex w-full max-w-5xl items-center justify-between gap-4 rounded-full border border-white/10 py-2 pr-2.5 pl-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-bio/30 md:pl-4"
        >
          {/* logo */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              scrollToTop();
              try {
                history.pushState(null, "", "#top");
              } catch {}
            }}
            className="group flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bio"
            aria-label="Medsync: back to top"
          >
            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg border border-bio/40 bg-[#061016] shadow-[0_0_12px_rgba(0,240,255,0.3)] transition-transform duration-300 group-hover:scale-105">
              <img
                src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/medsync-logo.png`}
                alt="Medsync icon"
                className="h-full w-full object-cover scale-[1.08]"
              />
            </div>
            <span className="text-[17px] font-bold tracking-[-0.02em] text-white">
              medsync
            </span>
            <span className="hidden items-center gap-1.5 rounded-full border border-bio/30 bg-bio/10 px-2 py-0.5 font-telemetry text-[9px] tracking-[0.16em] text-bio sm:flex">
              <span className="anim-pulse-dot h-1.5 w-1.5 rounded-full bg-pulse" />
              PILOT ACTIVE
            </span>
          </a>

          {/* center links */}
          <ul className="hidden items-center gap-6 md:flex">
            {LINKS.map((l) => (
              <li key={l.label}>
                <a
                  href={`#${l.target}`}
                  onClick={(e) => {
                    e.preventDefault();
                    go(l.target);
                  }}
                  className="group relative font-telemetry text-[11px] tracking-[0.22em] text-slate-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bio"
                >
                  {l.label}
                  <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-bio transition-all duration-300 group-hover:w-full" />
                </a>
              </li>
            ))}
            <li className="flex items-center">
              <button
                type="button"
                onClick={() => emit(BUS.consoleOpen)}
                className="group relative flex items-center gap-1.5 rounded-full border border-bio/30 bg-bio/[0.08] px-3 py-1 font-telemetry text-[10px] tracking-[0.18em] text-slate-300 transition-all duration-300 hover:border-bio/60 hover:text-bio hover:shadow-[0_0_12px_rgba(0,240,255,0.25)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bio"
                aria-label="Open live sync telemetry console"
              >
                <span className="anim-pulse-dot h-1.5 w-1.5 rounded-full bg-bio" />
                CONSOLE
              </button>
            </li>
          </ul>

          {/* CTA */}
          <div className="flex items-center gap-2">
            <Magnetic strength={0.3}>
              <a
                href="#access"
                onClick={(e) => {
                  e.preventDefault();
                  go("access");
                }}
                className="group hidden items-center gap-1.5 rounded-full bg-white px-4.5 py-2 font-telemetry text-[11px] font-bold tracking-[0.12em] text-obsidian uppercase transition-all duration-300 hover:bg-bio hover:shadow-[0_0_16px_rgba(0,240,255,0.35)] sm:flex focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bio"
              >
                Download App
                <ArrowUpRight
                  size={13}
                  className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                  focusable="false"
                />
              </a>
            </Magnetic>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-slate-300 md:hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bio"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
            </button>
          </div>
        </nav>
      </motion.header>

      {/* mobile overlay menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-[59] flex flex-col justify-center bg-obsidian/95 px-8 backdrop-blur-2xl md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <nav aria-label="Mobile">
              <ul className="flex flex-col gap-2">
                {LINKS.map((l, i) => (
                  <motion.li
                    key={l.label}
                    initial={{ opacity: 0, x: -28 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.06 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <a
                      href={`#${l.target}`}
                      onClick={(e) => {
                        e.preventDefault();
                        go(l.target);
                      }}
                      className="flex w-full items-baseline gap-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bio"
                    >
                      <span className="font-telemetry text-[11px] text-bio">
                        0{i + 1}
                      </span>
                      <span className="text-4xl font-extrabold tracking-[-0.03em] text-white">
                        {l.label}
                      </span>
                    </a>
                  </motion.li>
                ))}
                <motion.li
                  initial={{ opacity: 0, x: -28 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.24, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      emit(BUS.consoleOpen);
                    }}
                    className="flex w-full items-baseline gap-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bio"
                  >
                    <span className="font-telemetry text-[11px] text-bio">
                      05
                    </span>
                    <span className="text-4xl font-extrabold tracking-[-0.03em] text-white">
                      CONSOLE
                    </span>
                  </button>
                </motion.li>
              </ul>
            </nav>
            <motion.a
              href="#access"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.34 }}
              onClick={(e) => {
                e.preventDefault();
                go("access");
              }}
              className="mt-10 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-bio to-pulse py-4 font-telemetry text-[12px] font-bold tracking-[0.14em] text-obsidian uppercase focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bio"
            >
              Download App <ArrowUpRight size={15} aria-hidden="true" focusable="false" />
            </motion.a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
