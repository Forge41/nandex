"use client";

import { useEffect, useRef, useState } from "react";

import { cellInfo, type CellInfo } from "@/lib/github";

import { cssVar, useReducedMotion } from "./hooks";

const CELL = 9;
const GAP = 2;
const SNAKE = 7;
const DAYS = 364;
const W = 572;
const H = 82;
const TIP_W = 220;
const ORDER = Array.from({ length: 52 }, (_, wk) =>
  Array.from({ length: 7 }, (_, d) => (wk % 2 ? wk * 7 + (6 - d) : wk * 7 + d)),
).flat();

export function ContribGraph({ grid, theme }: { grid: number[]; theme: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const [tip, setTip] = useState<(CellInfo & { i: number; left: number; arrow: number }) | null>(null);

  const onMove = (ev: React.MouseEvent<HTMLDivElement>) => {
    const cv = ref.current;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const wk = Math.floor(((ev.clientX - r.left) * (W / r.width)) / (CELL + GAP));
    const d = Math.floor(((ev.clientY - r.top) * (H / r.height) - 4) / (CELL + GAP));
    if (wk < 0 || wk > 51 || d < 0 || d > 6) return setTip(null);
    const i = wk * 7 + d;
    if (tip?.i === i) return;
    const x = ((wk * (CELL + GAP) + 5) / W) * r.width;
    const left = Math.max(0, Math.min(x - TIP_W / 2, r.width - TIP_W));
    setTip({ ...cellInfo(grid, i), i, left, arrow: Math.max(10, Math.min(TIP_W - 22, x - left - 6)) });
  };

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
    <div className="relative" onMouseMove={onMove} onMouseLeave={() => setTip(null)}>
      <canvas
        ref={ref}
        width={W}
        height={H}
        role="img"
        aria-label="GitHub contributions over the last 52 weeks"
        className="block h-auto w-full rounded-lg"
        style={{ imageRendering: "pixelated" }}
      />
      {tip && (
        <span
          role="tooltip"
          className="t-popover pointer-events-none absolute bottom-[calc(100%+6px)] z-30 rounded-[10px] px-2.5 py-2 font-sans text-[11.5px] leading-[1.35]"
          style={{ left: tip.left, width: TIP_W, animation: "tPopIn .15s ease-out" }}
        >
          <span className="flex items-baseline justify-between gap-2.5">
            <span className="font-semibold tracking-[-.005em]">{tip.date}</span>
            <span className="text-[10.5px] font-bold uppercase tracking-[.02em]" style={{ color: tip.active ? "#1a7f4b" : "#8a827b" }}>
              {tip.count}
            </span>
          </span>
          <span className="mt-[3px] block truncate font-mono text-[10.5px] leading-[1.4] text-[#6b645e]">{tip.msg}</span>
          <span className="absolute top-full size-0 border-[6px] border-b-0 border-transparent border-t-white" style={{ left: tip.arrow }} />
        </span>
      )}
    </div>
  );
}
