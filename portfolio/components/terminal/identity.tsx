"use client";

import { LiveDot } from "@nandex/ui/indicators";
import Image from "next/image";
import { useEffect, useState } from "react";

import { useTerminal, useTerminalView } from "./context";
import { MicIcon } from "./icons";
import { PhosphorPortrait } from "./phosphor-portrait";

export const GreenDot = ({ size = 6 }: { size?: number }) => (
  <LiveDot tone="success" size={size} style={{ background: "var(--t-green)", animationDuration: "1.4s" }} />
);

export const QUOTE = ["Retrieve the right thing.", "Cite it with a receipt.", "Say it out loud, before they finish asking."];

export const stop = (fn: () => void) => (ev: React.SyntheticEvent) => {
  ev.stopPropagation();
  fn();
};

export const iconLink =
  "t-chip inline-flex size-8 items-center justify-center rounded-[10px] text-tm-sub no-underline transition-all duration-150 hover:-translate-y-px hover:bg-tm-hl hover:text-tm-accent";

export function Portrait({ size = 84, hint = true, radius = 22 }: { size?: number; hint?: boolean; radius?: number }) {
  const { openVoice } = useTerminal();
  const { theme } = useTerminalView();
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!hint) return;
    const show = setTimeout(() => setToast(true), 3000);
    const hide = setTimeout(() => setToast(false), 9000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [hint]);

  return (
    <button
      type="button"
      title="tap to talk"
      aria-label="talk to me — voice mode"
      className="t-reset relative block flex-none"
      onClick={stop(() => {
        setToast(false);
        openVoice();
      })}
    >
      <div
        className="relative"
        style={{ width: size, height: size, animation: toast ? "tNudge .9s ease-in-out" : "none" }}
        onMouseMove={(ev) => {
          const r = ev.currentTarget.getBoundingClientRect();
          setLens({ x: ev.clientX - r.left, y: ev.clientY - r.top });
        }}
        onMouseLeave={() => setLens(null)}
      >
        {toast && (
          <span
            className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-[5] inline-flex items-center gap-[7px] whitespace-nowrap rounded-xl bg-tm-accent px-[11px] py-[7px] font-sans text-[11px] font-semibold tracking-[.02em] text-tm-bg shadow-[0_10px_26px_var(--t-hl),inset_0_1px_0_rgba(255,255,255,.3)]"
            style={{ animation: "tToastIn .45s cubic-bezier(.2,.9,.2,1.2) both" }}
          >
            <MicIcon size={12} />
            tap photo to talk
            <span className="absolute left-1/2 top-full size-0 -translate-x-1/2 border-[6px] border-b-0 border-transparent border-t-tm-accent" />
          </span>
        )}
        <PhosphorPortrait
          theme={theme}
          className="size-full shadow-[inset_0_0_0_1px_rgba(255,255,255,.1),0_12px_36px_rgba(0,0,0,.4)] transition-shadow duration-200 hover:shadow-[inset_0_0_0_1px_var(--t-accent),0_0_48px_var(--t-hl)]"
          style={{ borderRadius: radius }}
        />
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden bg-tm-bg"
          style={{
            borderRadius: radius,
            clipPath: lens ? `circle(38px at ${lens.x}px ${lens.y}px)` : "circle(0px at 50% 50%)",
            transition: lens ? "none" : "clip-path .25s ease",
          }}
        >
          <Image
            src="https://cdn.simpleicons.org/claude/D97757"
            alt=""
            width={150}
            height={150}
            unoptimized
            className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2"
            style={{ filter: "drop-shadow(0 0 18px rgba(217,119,87,.6))" }}
          />
        </div>
      </div>
    </button>
  );
}

/** `data-loader-target="sig"` is where the loader's signature lands; it is hidden on narrow heroes. */
export function Signature({ size = 32 }: { size?: number }) {
  return (
    <span
      data-loader-target="sig"
      className="relative inline-block origin-bottom-right -rotate-6 whitespace-nowrap leading-[.9] tracking-[.01em] text-tm-accent"
      style={{ fontSize: size, fontFamily: "var(--font-signature), cursive", filter: "drop-shadow(0 0 8px var(--t-hl))" }}
      aria-label="signed, Nandisha D"
    >
      Nandisha D
      <svg viewBox="0 0 200 14" preserveAspectRatio="none" className="absolute -bottom-1.5 -left-[4%] h-3 w-[106%] overflow-visible opacity-80" aria-hidden>
        <path d="M2 9 C 40 2, 90 12, 130 6 S 185 3, 198 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
