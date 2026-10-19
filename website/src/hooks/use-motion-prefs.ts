"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * SSR-safe media query via useSyncExternalStore — subscribes to the
 * MediaQueryList instead of syncing state inside effects.
 */
function useMediaQueryValue(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    [query]
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query]
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** prefers-reduced-motion preference. */
export function useReducedMotion(): boolean {
  return useMediaQueryValue("(prefers-reduced-motion: reduce)");
}

/** Generic media query hook. */
export function useMediaQuery(query: string): boolean {
  return useMediaQueryValue(query);
}
