"use client";

import { useEffect, useRef } from "react";

import { cssVar, useReducedMotion } from "./hooks";

const SIZE = 152;
const BANGALORE = { lat: (12.97 * Math.PI) / 180, lon: (77.59 * Math.PI) / 180 };

export function Globe({ theme }: { theme: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const acc = cssVar(cv, "--t-accent");
    const dim = cssVar(cv, "--t-border");
    const sub = cssVar(cv, "--t-muted");
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const r = SIZE / 2 - 6;
    let a = 0;
    let raf = 0;

    const draw = () => {
      g.clearRect(0, 0, SIZE, SIZE);
      g.lineWidth = 1;
      g.strokeStyle = dim;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
      for (let i = 1; i <= 2; i++) {
        const yy = r * Math.cos((i * Math.PI) / 6);
        const rx = Math.sqrt(r * r - yy * yy);
        for (const sg of [1, -1]) {
          g.beginPath();
          g.ellipse(cx, cy + sg * yy, rx, rx * 0.18, 0, 0, Math.PI * 2);
          g.stroke();
        }
      }
      g.beginPath();
      g.ellipse(cx, cy, r, r * 0.18, 0, 0, Math.PI * 2);
      g.stroke();
      for (let k = 0; k < 6; k++) {
        const ph = a + (k * Math.PI) / 6;
        const front = Math.sin(ph) > 0;
        g.beginPath();
        g.ellipse(cx, cy, Math.max(0.5, Math.abs(Math.cos(ph)) * r), r, 0, 0, Math.PI * 2);
        g.strokeStyle = front ? sub : dim;
        g.globalAlpha = front ? 0.9 : 0.4;
        g.stroke();
      }
      g.globalAlpha = 1;
      const lon = BANGALORE.lon + a;
      if (Math.cos(lon) > 0) {
        const px = cx + r * Math.cos(BANGALORE.lat) * Math.sin(lon);
        const py = cy - r * Math.sin(BANGALORE.lat);
        g.fillStyle = acc;
        g.beginPath();
        g.arc(px, py, 3.5, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = acc;
        g.globalAlpha = 0.5;
        g.beginPath();
        g.arc(px, py, 6 + ((a * 60) % 8), 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      }
    };

    if (reduced) {
      draw();
      return;
    }
    const frame = () => {
      a += 0.012;
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [theme, reduced]);

  return <canvas ref={ref} width={SIZE} height={SIZE} aria-hidden className="block size-14" />;
}
