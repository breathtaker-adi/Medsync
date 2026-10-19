"use client";

/** Tiny typed event bus over window CustomEvents. */

export const BUS = {
  /** preloader finished → hero may play its entrance timeline */
  ready: "medsync:ready",
  /** request the sync console to open */
  consoleOpen: "medsync:console:open",
} as const;

export function emit(name: string, detail?: unknown) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on(name: string, handler: (e: Event) => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(name, handler);
  return () => window.removeEventListener(name, handler);
}

/** Flag flipped once the boot sequence has completed. */
export function markReady() {
  if (typeof window === "undefined") return;
  (window as unknown as { __medsyncReady?: boolean }).__medsyncReady = true;
}

export function isReady() {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as { __medsyncReady?: boolean }).__medsyncReady);
}
