"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/use-motion-prefs";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  baseAlpha: number;
  color: string;
  glow: string;
  pulseSpeed: number;
  phase: number;
}

const COLORS = [
  { color: "rgba(0, 240, 255, ", glow: "rgba(0, 240, 255, 0.4)" }, // Cyan
  { color: "rgba(52, 211, 153, ", glow: "rgba(52, 211, 153, 0.35)" }, // Mint green
  { color: "rgba(224, 252, 255, ", glow: "rgba(224, 252, 255, 0.3)" }, // Crisp white
  { color: "rgba(37, 99, 235, ", glow: "rgba(37, 99, 235, 0.35)" }, // Royal blue
];

export function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let isVisible = true;
    let isTabActive = !document.hidden;

    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
      if (reduced) {
        drawFrame();
      }
    };
    window.addEventListener("resize", onResize, { passive: true });

    // Mouse interaction tracking
    const mouse = { x: width * 0.5, y: height * 0.5, targetX: width * 0.5, targetY: height * 0.5 };
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // Generate ~80-110 ambient drifting particles across the entire #top area
    const count = Math.min(90, Math.floor((width * height) / 12000));
    const particles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const theme = COLORS[Math.floor(Math.random() * COLORS.length)];
      const baseAlpha = 0.2 + Math.random() * 0.55;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.15 - Math.random() * 0.3,
        radius: 1.0 + Math.random() * 2.2,
        alpha: baseAlpha,
        baseAlpha,
        color: theme.color,
        glow: theme.glow,
        pulseSpeed: 0.015 + Math.random() * 0.03,
        phase: Math.random() * Math.PI * 2,
      });
    }

    let t = 0;

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const haloRadius = p.radius * 3.2;

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloRadius);
        grad.addColorStop(0, `${p.color}${p.alpha})`);
        grad.addColorStop(0.35, `${p.color}${p.alpha * 0.45})`);
        grad.addColorStop(1, "transparent");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, haloRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const render = () => {
      if (!isVisible || !isTabActive) {
        animId = 0;
        return;
      }

      t += 0.02;

      // Smooth mouse lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Update position
        p.x += p.vx + Math.sin(t + p.phase) * 0.15;
        p.y += p.vy;

        // Mouse gentle deflection
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 140 && dist > 1) {
          const force = (1 - dist / 140) * 0.8;
          p.x += (dx / dist) * force;
          p.y += (dy / dist) * force;
        }

        // Screen wrap
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        // Pulse breathing
        p.alpha = p.baseAlpha + Math.sin(t * p.pulseSpeed * 60 + p.phase) * 0.18;
        p.alpha = Math.max(0.08, Math.min(0.9, p.alpha));
      }

      drawFrame();
      animId = requestAnimationFrame(render);
    };

    const startLoop = () => {
      if (!animId && !reduced && isVisible && isTabActive) {
        animId = requestAnimationFrame(render);
      }
    };

    const stopLoop = () => {
      if (animId) {
        cancelAnimationFrame(animId);
        animId = 0;
      }
    };

    // If prefers-reduced-motion is enabled, draw a single static frame and exit
    if (reduced) {
      drawFrame();
      return () => {
        window.removeEventListener("resize", onResize);
        window.removeEventListener("mousemove", onMouseMove);
      };
    }

    // Viewport intersection observer: pause loop when hero is off-screen
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
          startLoop();
        } else {
          stopLoop();
        }
      },
      { threshold: 0.01 }
    );
    observer.observe(canvas);

    // Tab visibility change: pause loop when backgrounded
    const onVisibilityChange = () => {
      isTabActive = !document.hidden;
      if (isTabActive) {
        startLoop();
      } else {
        stopLoop();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    startLoop();

    return () => {
      stopLoop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
      aria-hidden="true"
    />
  );
}
