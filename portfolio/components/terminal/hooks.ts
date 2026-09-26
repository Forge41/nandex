"use client";

import { useSyncExternalStore } from "react";

let now = Date.now();
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;

function subscribeClock(cb: () => void) {
  clockListeners.add(cb);
  if (!clockTimer) {
    now = Date.now();
    clockTimer = setInterval(() => {
      now = Date.now();
      clockListeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    clockListeners.delete(cb);
    if (!clockListeners.size && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

export const useNow = () =>
  useSyncExternalStore(
    subscribeClock,
    () => now,
    () => 0,
  );

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");
export const useIsMobile = () => useMediaQuery("(max-width: 859px)");
export const useIsNarrow = () => useMediaQuery("(max-width: 1179px)");

export function readCssColor(el: Element, prop: string, fallback: [number, number, number]): [number, number, number] {
  const value = getComputedStyle(el).getPropertyValue(prop).trim();
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return fallback;
  ctx.fillStyle = value || `rgb(${fallback.join(",")})`;
  const hex = String(ctx.fillStyle);
  if (/^#[0-9a-f]{6}$/i.test(hex)) return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const m = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : fallback;
}

export const cssVar = (el: Element, prop: string) => getComputedStyle(el).getPropertyValue(prop).trim();
