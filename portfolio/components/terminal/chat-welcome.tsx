"use client";

import { useTerminal } from "./context";
import { MicIcon } from "./icons";
import { stop } from "./identity";

export function ChatWelcome() {
  const { openVoice } = useTerminal();
  return (
    <div
      data-screen-label="Chat welcome"
      className="t-glass mb-3 flex flex-wrap items-center gap-3 rounded-[18px] p-3.5 font-sans"
      style={{ animation: "tHeroIn .55s cubic-bezier(.2,.8,.2,1) .16s both" }}
    >
      <div className="min-w-[200px] flex-1">
        <div className="text-[15px] font-bold leading-[1.2] tracking-[-.01em] text-tm-fg">Ask me anything about Nandisha&apos;s work</div>
        <div className="mt-1 text-[12.5px] leading-[1.4] text-tm-sub [text-wrap:pretty]">
          Every answer cites the résumé. Prefer talking? Switch to voice.
        </div>
      </div>
      <button
        type="button"
        title="talk to me — voice mode"
        className="t-reset relative inline-flex flex-none items-center gap-2.5 overflow-hidden rounded-[14px] px-3.5 py-2.5 text-tm-bg shadow-[0_10px_28px_var(--t-hl),inset_0_1px_0_rgba(255,255,255,.25)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5"
        style={{ background: "linear-gradient(140deg,var(--t-accent),color-mix(in oklch,var(--t-accent) 70%,black))" }}
        onClick={stop(openVoice)}
      >
        <span className="relative inline-flex size-[30px] flex-none items-center justify-center rounded-full bg-black/[.18] shadow-[inset_0_0_0_1px_rgba(255,255,255,.2)]">
          <span className="absolute inset-0 rounded-full border border-white/60" style={{ animation: "tRingOut 2.2s ease-out infinite" }} />
          <MicIcon size={16} />
        </span>
        <span className="text-[13px] font-bold tracking-[-.01em]">Go voice mode</span>
      </button>
    </div>
  );
}
