"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { SectionHeading } from "@/components/fx/section-heading";
import { Reveal } from "@/components/fx/reveal";
import { BorderBeam, CornerTicks } from "@/components/fx/atoms";
import { Magnetic } from "@/components/fx/magnetic";

const CHAPTERS = [
  { t: 0, label: "THE CRISIS" },
  { t: 3, label: "AI INTAKE" },
  { t: 7, label: "THE ECOSYSTEM" },
  { t: 12, label: "ARCHITECTURE" },
  { t: 16, label: "MEDSYNC" },
];

function fmt(t: number) {
  if (!Number.isFinite(t)) return "00:00";
  const s = Math.floor(t % 60);
  const m = Math.floor(t / 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * SYNC://FILM — the 20-second Medsync pitch cut inside a glass player with
 * chapter telemetry, scrub bar, and keyboard-friendly controls.
 */
export function Film() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(20);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setStarted(true)).catch(() => setFailed(true));
    } else {
      v.pause();
    }
  }, []);

  // progress rAF loop while playing
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        setProgress(v.currentTime / (v.duration || 20));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const seek = useCallback((clientX: number) => {
    const bar = barRef.current;
    const v = videoRef.current;
    if (!bar || !v) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v.currentTime = pct * (v.duration || 20);
    setProgress(pct);
  }, []);

  const onBarPointerDown = (e: React.PointerEvent) => {
    seek(e.clientX);
    const move = (ev: PointerEvent) => seek(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const fullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const activeChapter = CHAPTERS.reduce(
    (acc, c, i) => (progress * duration >= c.t ? i : acc),
    0
  );

  return (
    <section
      id="film"
      className="relative mx-auto w-full max-w-7xl px-5 py-28 md:px-8 md:py-36"
      aria-label="Medsync product film"
    >
      <SectionHeading
        index="04"
        eyebrow="SYNC://FILM"
        title={
          <>
            The ecosystem,{" "}
            <span className="text-gradient-sync">breathing.</span>
          </>
        }
        description="A 20-second cut of the Medsync loop — from the adherence crisis to AI prescription intake to a clinically aligned architecture. Sound on."
      />

      <Reveal className="mt-14" y={40}>
        <div
          ref={wrapRef}
          className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_60px_160px_-60px_rgba(0,240,255,0.28)]"
          data-cursor-label={playing ? "PAUSE" : "PLAY"}
        >
          {/* beam while playing */}
          {playing && <BorderBeam />}

          <div className="relative aspect-video w-full">
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              poster={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/film-poster.jpg`}
              preload="metadata"
              muted={muted}
              playsInline
              loop
              onClick={togglePlay}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 20)}
              onError={() => setFailed(true)}
              aria-label="Medsync pitch film"
            >
              <source src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/medsync-film.mp4`} type="video/mp4" />
            </video>

            {/* poster overlay */}
            <AnimatePresence>
              {!started && !failed && (
                <motion.button
                  className="absolute inset-0 flex flex-col items-center justify-center bg-[#040711]/55 backdrop-blur-[2px]"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 1.04 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  onClick={togglePlay}
                  aria-label="Play the Medsync film"
                >
                  <CornerTicks inset={16} />
                  <span className="font-telemetry text-[10px] tracking-[0.4em] text-bio uppercase">
                    medsync · pitch cut
                  </span>
                  <Magnetic strength={0.4}>
                    <span className="relative mt-6 flex h-20 w-20 items-center justify-center rounded-full border border-bio/50 bg-obsidian/70 text-white backdrop-blur-md">
                      <span className="anim-ping-dot absolute inset-0 rounded-full bg-bio/20" />
                      <Play size={26} className="ml-1" fill="currentColor" />
                    </span>
                  </Magnetic>
                  <span className="mt-6 font-telemetry text-[10px] tracking-[0.24em] text-slate-400 uppercase">
                    00:20 · 1080p · h.264
                  </span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* failed fallback */}
            {failed && (
              <div className="absolute inset-0 flex items-center justify-center bg-obsidian/90 p-8 text-center">
                <p className="max-w-sm font-telemetry text-[11px] leading-relaxed tracking-[0.14em] text-slate-400 uppercase">
                  Film stream unavailable — the sync matrix is still worth the
                  scroll.
                </p>
              </div>
            )}

            {/* center pause flash */}
            <AnimatePresence>
              {started && !playing && !failed && (
                <motion.button
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={togglePlay}
                  aria-label="Resume playback"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-obsidian/60 text-white backdrop-blur-md">
                    <Play size={22} className="ml-1" fill="currentColor" />
                  </span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* chrome */}
          <div className="relative flex flex-col gap-3 border-t border-white/8 bg-obsidian/90 px-4 py-3 backdrop-blur-xl md:px-6">
            {/* scrub bar */}
            <div
              ref={barRef}
              className="group/bar relative h-6 cursor-pointer touch-none"
              onPointerDown={onBarPointerDown}
              role="slider"
              aria-label="Seek film"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") seek(barRef.current!.getBoundingClientRect().right);
                if (e.key === "ArrowLeft") seek(barRef.current!.getBoundingClientRect().left);
              }}
            >
              <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-bio to-pulse"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              {/* chapter ticks */}
              {CHAPTERS.slice(1).map((c) => (
                <span
                  key={c.t}
                  className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-white/35"
                  style={{ left: `${(c.t / duration) * 100}%` }}
                  aria-hidden
                />
              ))}
              {/* playhead */}
              <span
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bio bg-obsidian opacity-0 shadow-[0_0_12px_rgba(0,240,255,0.8)] transition-opacity duration-200 group-hover/bar:opacity-100"
                style={{ left: `${progress * 100}%` }}
                aria-hidden
              />
            </div>

            {/* controls row */}
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-white transition-colors hover:border-bio/60 hover:text-bio"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>
              <button
                onClick={() => setMuted((m) => !m)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-white transition-colors hover:border-bio/60 hover:text-bio"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <span className="font-telemetry text-[10px] tracking-[0.14em] text-slate-400 tabular-nums">
                {fmt(progress * duration)} / {fmt(duration)}
              </span>
              <span className="ml-auto hidden font-telemetry text-[9px] tracking-[0.24em] text-slate-500 uppercase sm:block">
                {CHAPTERS[activeChapter]?.label}
              </span>
              <button
                onClick={fullscreen}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-white transition-colors hover:border-bio/60 hover:text-bio"
                aria-label="Toggle fullscreen"
              >
                <Maximize size={14} />
              </button>
            </div>
          </div>
        </div>
      </Reveal>

      {/* scene index */}
      <Reveal delay={0.12}>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {CHAPTERS.map((c, i) => (
            <button
              key={c.t}
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                v.currentTime = c.t;
                setProgress(c.t / duration);
                setStarted(true);
                v.play().catch(() => {});
              }}
              className={`group flex flex-col gap-1 rounded-xl border px-3.5 py-3 text-left transition-all duration-300 ${
                i === activeChapter
                  ? "border-bio/40 bg-bio/[0.06]"
                  : "border-white/8 bg-white/[0.02] hover:border-white/20"
              }`}
              data-cursor="hover"
              aria-label={`Seek to chapter ${c.label}`}
            >
              <span className="font-telemetry text-[8.5px] tracking-[0.2em] text-slate-500">
                0{i + 1} · {fmt(c.t)}
              </span>
              <span
                className={`font-telemetry text-[9.5px] font-semibold tracking-[0.14em] ${
                  i === activeChapter ? "text-bio" : "text-slate-300 group-hover:text-white"
                }`}
              >
                {c.label}
              </span>
            </button>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
