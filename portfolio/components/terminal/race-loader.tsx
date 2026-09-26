"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { BOOT_LOG, SPINNER, TRACE_SRC } from "@/lib/terminal/constants";
import { buildTree, MOUNT_DURATION, mountFrame, type MountFrame, type MountTree } from "@/lib/terminal/mount";
import { cssVar } from "./hooks";

type View = { el: number; frame: MountFrame | null };

const TONE = { sub: "var(--t-sub)", muted: "var(--t-muted)", green: "var(--t-green)", accent: "var(--t-accent)" };

function drawTree(cv: HTMLCanvasElement, tree: MountTree, f: MountFrame, el: number) {
  const g = cv.getContext("2d");
  if (!g) return;
  const W = cv.width;
  const H = cv.height;
  g.clearRect(0, 0, W, H);
  const acc = cssVar(cv, "--t-accent");
  const green = cssVar(cv, "--t-green");
  const dim = cssVar(cv, "--t-dim");
  const fg = cssVar(cv, "--t-fg");
  const sub = cssVar(cv, "--t-sub");
  const padX = 40;
  const padTop = 34;
  const padBot = 30;
  const xs = (W - padX * 2) / Math.max(1, tree.leaves - 1);
  const ys = (H - padTop - padBot) / Math.max(1, tree.maxD);
  const pos = (n: { x: number; depth: number }) => ({ x: padX + n.x * xs, y: padTop + n.depth * ys });
  const curId = f.cur?.id ?? -1;

  g.lineWidth = 1;
  for (const [a, b] of tree.edges) {
    if (!f.opened.has(b)) continue;
    const A = pos(tree.nodes[a]);
    const B = pos(tree.nodes[b]);
    g.strokeStyle = f.ready.has(b) ? green : curId === b ? acc : dim;
    g.globalAlpha = f.ready.has(b) ? 0.9 : 0.6;
    g.beginPath();
    g.moveTo(A.x, A.y + 6);
    g.bezierCurveTo(A.x, A.y + ys * 0.5, B.x, B.y - ys * 0.5, B.x, B.y - 6);
    g.stroke();
  }

  g.globalAlpha = 1;
  g.font = "11px JetBrains Mono, monospace";
  g.textBaseline = "middle";
  for (const n of tree.nodes) {
    if (!f.opened.has(n.id)) continue;
    const p = pos(n);
    const isCur = curId === n.id;
    const done = f.ready.has(n.id);
    g.fillStyle = done ? green : isCur ? acc : sub;
    if (n.isDir) g.fillRect(p.x - 5, p.y - 5, 10, 10);
    else {
      g.beginPath();
      g.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      g.fill();
    }
    if (isCur) {
      g.strokeStyle = acc;
      g.globalAlpha = 0.5;
      g.beginPath();
      g.arc(p.x, p.y, 10 + (el % 600) / 60, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
    g.fillStyle = done ? fg : isCur ? acc : sub;
    g.textAlign = n.depth === 0 ? "left" : "center";
    if (!n.isDir) {
      g.save();
      g.translate(p.x, p.y + 12);
      g.rotate(Math.PI / 4);
      g.textAlign = "left";
      g.fillText(n.n, 0, 0);
      g.restore();
    } else if (n.depth === 0) g.fillText(n.n, p.x + 12, p.y);
    else g.fillText(n.n, p.x, p.y - 14);
  }
}

export function RaceLoader({ isMobile, onDone }: { isMobile: boolean; onDone: () => void }) {
  const tree = useMemo(() => buildTree(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View>({ el: 0, frame: null });
  const [fading, setFading] = useState(false);
  const finished = useRef(false);
  const skip = useRef<() => void>(() => undefined);

  useEffect(() => {
    let raf = 0;
    let t0: number | null = null;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (finished.current) return;
      finished.current = true;
      cancelAnimationFrame(raf);
      setFading(true);
      fadeTimer = setTimeout(onDone, 420);
    };
    const step = (ts: number) => {
      t0 ??= ts;
      const el = ts - t0;
      const frame = mountFrame(tree, el);
      if (canvasRef.current) drawTree(canvasRef.current, tree, frame, el);
      setView({ el, frame });
      if (el > MOUNT_DURATION + 800) finish();
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    skip.current = finish;
    window.addEventListener("keydown", finish);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fadeTimer);
      window.removeEventListener("keydown", finish);
    };
  }, [tree, onDone]);

  const f = view.frame;
  const log = BOOT_LOG.slice(0, f?.logCount ?? 0);
  const traceLine = f ? f.traceLine : -1;

  return (
    <div
      data-screen-label="Loader"
      onClick={() => skip.current()}
      role="img"
      aria-label="Loading portfolio — press any key to skip"
      className="absolute inset-0 z-[200] flex cursor-pointer items-center justify-center bg-tm-bg"
      style={{
        opacity: fading ? 0 : 1,
        transform: fading ? "scale(1.02)" : "none",
        transition: "opacity .4s ease, transform .4s ease",
      }}
    >
      <div
        style={
          isMobile
            ? { width: "100%", display: "flex", flexDirection: "column", gap: 16, padding: "20px 16px" }
            : {
                width: "100%",
                maxWidth: 1040,
                display: "grid",
                gridTemplateColumns: "minmax(0,1.5fr) minmax(280px,1fr)",
                gap: 28,
                padding: 32,
                alignItems: "stretch",
              }
        }
      >
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex items-baseline gap-3 text-[11px] uppercase tracking-[.08em] text-tm-muted">
            <span className="text-tm-accent">$</span>
            <span>tree ~/nandisha --mount</span>
            <span className="flex-1" />
            <span className="normal-case tracking-normal text-tm-dim">{f ? (view.el / 1000).toFixed(2) + " s" : ""}</span>
          </div>
          <canvas ref={canvasRef} width={640} height={420} className="block h-auto w-full" />
          <div className="flex flex-wrap gap-[18px] text-[11.5px] text-tm-muted">
            {f?.board.map((b, i) => (
              <span key={i} style={{ color: TONE[b.tone] }}>
                {b.t}
              </span>
            ))}
          </div>
          <div className="flex min-h-20 flex-col gap-0.5 border-t border-dashed border-tm-border pt-2.5 text-[11.5px]">
            {log.map((t, i) => (
              <div key={t} style={{ color: i === log.length - 1 ? "var(--t-fg)" : "var(--t-muted)", animation: "tFade .25s" }}>
                <span className="text-tm-green">[  OK  ]</span> {t}
              </div>
            ))}
          </div>
        </div>
        {!isMobile && (
          <div className="flex min-w-0 flex-col border border-tm-border bg-tm-panel">
            <div className="flex h-[30px] flex-none items-center gap-2 border-b border-tm-border px-3 text-[11px] uppercase tracking-[.08em] text-tm-muted">
              <span className="text-tm-accent">py</span>
              <span>mount.py</span>
              <span className="flex-1" />
              <span className="normal-case tracking-normal text-tm-dim">{traceLine >= 0 ? "line " + (traceLine + 1) : "idle"}</span>
            </div>
            <pre className="m-0 overflow-hidden py-3" style={{ font: "inherit", fontSize: 11.5, lineHeight: 1.7 }}>
              {TRACE_SRC.map((t, i) => (
                <div
                  key={i}
                  style={{
                    padding: "0 12px",
                    background: i === traceLine ? "var(--t-hl)" : "transparent",
                    color: i === traceLine ? "var(--t-fg)" : /#/.test(t) ? "var(--t-muted)" : "var(--t-sub)",
                    borderLeft: "2px solid " + (i === traceLine ? "var(--t-accent)" : "transparent"),
                    transition: "background .08s",
                  }}
                >
                  <span className="inline-block w-[34px] pr-3 text-right text-tm-dim">{i + 1}</span>
                  <span className="whitespace-pre">{t}</span>
                </div>
              ))}
            </pre>
            <div className="mt-auto flex items-center gap-2.5 border-t border-tm-border px-3 py-2.5 text-[11.5px] text-tm-muted">
              <span className="w-3.5 text-tm-accent">{SPINNER[Math.floor(view.el / 80) % SPINNER.length]}</span>
              <span className="flex-1">{f?.status ?? "preparing…"}</span>
              <span className="text-tm-dim">any key to skip</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
