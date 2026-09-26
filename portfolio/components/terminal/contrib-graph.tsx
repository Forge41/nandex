"use client";

import { useEffect, useRef } from "react";

import { cssVar, useReducedMotion } from "./hooks";

const CELL = 9;
const GAP = 2;
const SNAKE = 7;
const DAYS = 364;
const ORDER = Array.from({ length: 52 }, (_, wk) =>
  Array.from({ length: 7 }, (_, d) => (wk % 2 ? wk * 7 + (6 - d) : wk * 7 + d)),
).flat();

export function ContribGraph({ grid, theme }: { grid: number[]; theme: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const green = cssVar(cv, "--t-green");
    const accent = cssVar(cv, "--t-accent");
    const empty = cssVar(cv, "--t-border") || "rgba(255,255,255,.1)";
    const eaten = new Array<boolean>(DAYS).fill(false);
    const cycle = DAYS + SNAKE + 20;

    const paint = (k: number | null) => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (let i = 0; i < DAYS; i++) {
        const wk = Math.floor(i / 7);
        const d = i % 7;
        const c = grid[i] ?? 0;
        if (eaten[i] || c === 0) {
          ctx.fillStyle = empty;
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = green;
          ctx.globalAlpha = 0.3 + Math.min(1, c / 8) * 0.7;
        }
        ctx.fillRect(wk * (CELL + GAP), d * (CELL + GAP) + 4, CELL, CELL);
      }
      ctx.globalAlpha = 1;
      if (k == null) return;
      for (let s = 0; s < SNAKE; s++) {
        const p = k - s;
        if (p < 0 || p >= DAYS) continue;
        const i = ORDER[p];
        const head = s === 0 ? 1 : 0;
        ctx.fillStyle = accent;
        ctx.globalAlpha = 1 - s / (SNAKE + 1);
        ctx.fillRect(Math.floor(i / 7) * (CELL + GAP) - head, (i % 7) * (CELL + GAP) + 4 - head, CELL + head * 2, CELL + head * 2);
      }
      ctx.globalAlpha = 1;
    };

    if (reduced) {
      paint(null);
      return;
    }
    let raf = 0;
    let t0: number | null = null;
    let last = -1;
    const frame = (ts: number) => {
      t0 ??= ts;
      const head = Math.floor((ts - t0) / 55);
      const k = head % cycle;
      if (head !== last) {
        last = head;
        if (k < DAYS) eaten[ORDER[k]] = true;
        if (k === cycle - 1) eaten.fill(false);
      }
      paint(k);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [grid, theme, reduced]);

  return (
    <canvas
      ref={ref}
      width={572}
      height={82}
      role="img"
      aria-label="GitHub contributions over the last 52 weeks"
      className="block h-auto w-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
