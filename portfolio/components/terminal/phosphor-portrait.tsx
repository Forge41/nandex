"use client";

import { useEffect, useRef } from "react";

import { readCssColor, useReducedMotion } from "./hooks";

const N = 256;
const CROP = { x: 0.1, y: 0.03, w: 0.7, h: 0.7 };
const REVEAL_MS = 850;

let luminance: Promise<Float32Array | null> | null = null;

function loadLuminance(): Promise<Float32Array | null> {
  luminance ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = N;
      c.height = N;
      const x = c.getContext("2d");
      if (!x) return resolve(null);
      x.imageSmoothingQuality = "high";
      x.drawImage(img, CROP.x * img.width, CROP.y * img.height, CROP.w * img.width, CROP.h * img.height, 0, 0, N, N);
      const d = x.getImageData(0, 0, N, N).data;
      const L = new Float32Array(N * N);
      let mn = 1;
      let mx = 0;
      for (let i = 0; i < N * N; i++) {
        const l = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
        L[i] = l;
        mn = Math.min(mn, l);
        mx = Math.max(mx, l);
      }
      for (let i = 0; i < N * N; i++) L[i] = Math.pow((L[i] - mn) / (mx - mn), 1.25);
      resolve(L);
    };
    img.onerror = () => resolve(null);
    img.src = "/profile.png";
  });
  return luminance;
}

function draw(cv: HTMLCanvasElement, L: Float32Array, rowsDone: number) {
  const g = cv.getContext("2d");
  if (!g) return;
  const acc = readCssColor(cv, "--t-accent", [212, 160, 52]);
  const bg = readCssColor(cv, "--t-bg", [14, 13, 12]);
  const out = g.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const y = Math.floor(i / N);
    const o = i * 4;
    out.data[o + 3] = 255;
    if (y >= rowsDone) {
      out.data[o] = bg[0];
      out.data[o + 1] = bg[1];
      out.data[o + 2] = bg[2];
      continue;
    }
    const scan = y % 3 === 0 ? 0.55 : 1;
    const flash = rowsDone < N && y > rowsDone - 4 ? 1.6 : 1;
    const k = L[i] * scan * flash;
    for (let ch = 0; ch < 3; ch++) out.data[o + ch] = Math.min(255, Math.round(bg[ch] + (acc[ch] - bg[ch]) * k));
  }
  g.putImageData(out, 0, 0);
  const grd = g.createRadialGradient(N / 2, N / 2, N * 0.35, N / 2, N / 2, N * 0.75);
  grd.addColorStop(0, "rgba(0,0,0,0)");
  grd.addColorStop(1, "rgba(0,0,0,.7)");
  g.fillStyle = grd;
  g.fillRect(0, 0, N, N);
}

/** The profile photo rendered as a monochrome CRT in the current accent colour.
 * `theme` is only a redraw trigger: colours are read from the canvas's computed style. */
export function PhosphorPortrait({
  theme,
  reveal = true,
  className,
  style,
  onRevealed,
}: {
  theme: string;
  reveal?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onRevealed?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const revealed = useRef(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    loadLuminance().then((L) => {
      const cv = ref.current;
      if (cancelled || !cv || !L) return;
      if (revealed.current || !reveal || reduced) {
        draw(cv, L, N);
        if (!revealed.current) {
          revealed.current = true;
          onRevealed?.();
        }
        return;
      }
      const t0 = performance.now();
      const step = () => {
        const p = Math.min(1, (performance.now() - t0) / REVEAL_MS);
        draw(cv, L, Math.floor(p * N));
        if (p < 1) raf = requestAnimationFrame(step);
        else {
          revealed.current = true;
          onRevealed?.();
        }
      };
      raf = requestAnimationFrame(step);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [theme, reveal, reduced, onRevealed]);

  return <canvas ref={ref} width={N} height={N} aria-hidden className={className} style={{ display: "block", ...style }} />;
}
