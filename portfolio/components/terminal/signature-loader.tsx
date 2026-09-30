"use client";

import { useEffect, useRef, useState } from "react";

const DRAW_MS = 1750;
const FLY_MS = 680;
const HOLD_MS = 520;
/** Skipping collapses the draw but still flies — a jump-cut loses where the signature went. */
const SKIP_DRAW_MS = 140;

type Flight = { dx: number; dy: number; scale: number; rotate: number };

/**
 * Measures the overlay signature against the hero's landing slot and returns the transform
 * that puts one on the other. The hero renders behind the loader from the first paint, so
 * there is a real box to measure by the time this runs.
 */
function measure(el: HTMLElement): Flight | null {
  const visible = (sel: string) =>
    Array.from(document.querySelectorAll<HTMLElement>(sel)).find((n) => {
      const r = n.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  const slot = visible('[data-loader-target="sig"]');
  const target = slot ?? visible('[data-loader-target="name"]');
  if (!target) return null;
  const a = el.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  if (!a.width || !a.height) return null;
  return {
    dx: b.left + b.width / 2 - (a.left + a.width / 2),
    dy: b.top + b.height / 2 - (a.top + a.height / 2),
    scale: Math.max(0.05, b.height / a.height),
    // The hero signature is already rotated; the name is not, so the ink straightens out.
    rotate: slot ? -6 : 0,
  };
}

export function SignatureLoader({ onDone }: { onDone: () => void }) {
  const inkRef = useRef<HTMLSpanElement>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [gone, setGone] = useState(false);
  const skipRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let finished = false;
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    const fly = () => {
      const el = inkRef.current;
      setFlight(el ? measure(el) : null);
      setGone(true);
      at(FLY_MS + HOLD_MS, onDone);
    };

    const run = (drawMs: number) => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      timers.length = 0;
      at(drawMs, fly);
    };

    run(DRAW_MS);
    skipRef.current = () => run(SKIP_DRAW_MS);
    const onKey = () => skipRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDone]);

  return (
    <div
      data-screen-label="Loader"
      role="img"
      aria-label="Loading portfolio — press any key to skip"
      className="absolute inset-0 z-[200] flex cursor-pointer items-center justify-center bg-tm-bg"
      style={{
        opacity: gone ? 0 : 1,
        transition: `opacity ${FLY_MS}ms cubic-bezier(.4,0,.2,1)`,
        pointerEvents: gone ? "none" : "auto",
      }}
      onClick={() => skipRef.current()}
    >
      <span
        ref={inkRef}
        className="relative inline-block whitespace-nowrap leading-[.9] text-tm-accent"
        style={{
          fontFamily: "var(--font-signature), cursive",
          fontSize: "clamp(56px,11vw,104px)",
          filter: "drop-shadow(0 0 14px var(--t-hl))",
          transformOrigin: "center",
          transform: flight
            ? `translate(${flight.dx}px,${flight.dy}px) scale(${flight.scale}) rotate(${flight.rotate}deg)`
            : "rotate(-6deg)",
          transition: `transform ${FLY_MS}ms cubic-bezier(.3,.8,.2,1)`,
          animation: gone ? "none" : "tInk 1.05s cubic-bezier(.45,.05,.35,1) .15s both",
        }}
      >
        Nandisha D
        <svg viewBox="0 0 200 14" preserveAspectRatio="none" className="absolute -bottom-2.5 -left-[4%] w-[106%] overflow-visible opacity-85" style={{ height: 16 }} aria-hidden>
          <path
            d="M2 9 C 40 2, 90 12, 130 6 S 185 3, 198 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            pathLength={1}
            style={{ strokeDasharray: 1, strokeDashoffset: gone ? 0 : 1, animation: gone ? "none" : "tDraw .4s cubic-bezier(.3,.7,.2,1) 1.1s forwards" }}
          />
        </svg>
      </span>
      <span className="absolute bottom-8 font-sans text-[11px] uppercase tracking-[.14em] text-tm-dim" style={{ opacity: gone ? 0 : 1, transition: "opacity .2s" }}>
        click to skip
      </span>
    </div>
  );
}
