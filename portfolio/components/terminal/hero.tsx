"use client";

import { useMemo, useState } from "react";

import { sampleGrid, streaks } from "@/lib/github";
import { LINKS } from "@/lib/terminal/constants";
import { industry } from "@/lib/terminal/time";
import { ContribGraph } from "./contrib-graph";
import { useTerminal, useTerminalView } from "./context";
import { useNow } from "./hooks";
import { CalendarIcon, CopyIcon, DownloadIcon, GithubIcon, LinkedinIcon, MailIcon, MicIcon, TickIcon } from "./icons";
import { GreenDot, Portrait, QUOTE, Signature, stop } from "./identity";

/** 36px pill, `rgba(255,255,255,.06)` on a 1px inset ring — the hero's secondary action. */
const cta =
  "inline-flex h-9 items-center justify-center gap-[7px] rounded-xl bg-white/[.06] px-3 font-sans text-[12.5px] font-medium text-tm-fg no-underline shadow-[inset_0_0_0_1px_rgba(255,255,255,.09)] transition-all duration-150 hover:-translate-y-px hover:bg-white/[.11] hover:text-tm-fg";

const ctaPrimary =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-tm-accent px-[15px] font-sans text-[12.5px] font-semibold text-tm-bg shadow-[0_6px_18px_var(--t-hl),inset_0_1px_0_rgba(255,255,255,.25)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_10px_26px_var(--t-hl),inset_0_1px_0_rgba(255,255,255,.3)]";

function Uptime() {
  const ind = industry(useNow());
  return (
    <span className="flex items-baseline gap-1.5 font-sans">
      <span className="text-[17px] font-bold leading-none tracking-[-.02em] text-tm-fg">{ind.years}+</span>
      <span className="text-[10.5px] uppercase tracking-[.08em] text-tm-muted">years</span>
      <span className="text-[11px] tabular-nums text-tm-dim">
        {ind.days}d {ind.clock}
      </span>
    </span>
  );
}

function Activity() {
  const { contrib, theme } = useTerminalView();
  const sample = useMemo(() => sampleGrid(), []);
  const grid = contrib ?? sample;
  const st = useMemo(() => streaks(grid), [grid]);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-none items-center gap-2">
        <span className="inline-flex items-center gap-2 font-sans text-[10.5px] font-semibold uppercase tracking-[.06em] text-tm-muted">
          <GithubIcon size={13} />
          activity · 52 weeks
        </span>
        <span className="flex-1" />
        <span className="font-sans text-[11px] tabular-nums text-tm-muted">{st.total} contributions</span>
        {contrib ? (
          <span className="inline-flex items-center gap-[5px] font-sans text-[11px] font-semibold text-tm-green">
            <span className="size-[7px] rounded-full bg-tm-green shadow-[0_0_8px_var(--t-green)]" style={{ animation: "tBlink 1.1s ease-in-out infinite" }} />
            live
          </span>
        ) : (
          <span className="font-sans text-[10.5px] uppercase tracking-[.08em] text-tm-dim">sample · offline</span>
        )}
      </div>
      <ContribGraph grid={grid} theme={theme} />
    </div>
  );
}

/** The doodle under the résumé button, curling up into it. Decoration, so it is hidden from the tree. */
function ArrowDoodle() {
  return (
    <svg
      viewBox="0 0 200 130"
      aria-hidden
      className="pointer-events-none absolute z-30 overflow-visible text-tm-accent"
      style={{
        top: "calc(100% + 24px)",
        left: -15,
        width: 58,
        height: 38,
        filter: "drop-shadow(0 0 6px var(--t-hl))",
        transform: "scale(1,-1) rotate(14deg)",
        transformOrigin: "100% 0",
        animation: "tArrowNudge 1.8s ease-in-out 2.6s infinite",
      }}
    >
      <path
        d="M12 6 C 8 42, 22 72, 62 80 C 98 86, 118 62, 106 42 C 95 25, 70 33, 68 56 C 66 88, 112 106, 178 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: "tDraw 1.3s cubic-bezier(.45,.05,.35,1) 1s forwards" }}
      />
      <path
        d="M160 84 L182 100 L162 116"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: "tDraw .35s ease-out 2.25s forwards" }}
      />
    </svg>
  );
}

function EmailGroup() {
  const { copyText } = useTerminal();
  const [copied, setCopied] = useState(false);
  return (
    <div className="inline-flex min-w-0 max-w-full items-stretch rounded-xl bg-white/[.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,.09)]">
      <a
        href={`mailto:${LINKS.email}?subject=${encodeURIComponent("Opportunity for Nandisha")}`}
        title="send an email"
        className="inline-flex h-9 min-w-0 items-center gap-2 overflow-hidden rounded-l-xl px-3 font-sans text-[12.5px] font-medium text-tm-fg no-underline hover:bg-white/[.06] hover:text-tm-fg"
      >
        <MailIcon size={14} />
        <span className="truncate">{LINKS.email}</span>
      </a>
      <button
        type="button"
        title={copied ? "copied" : "copy email"}
        aria-label="copy email address"
        className="t-reset inline-flex size-9 flex-none items-center justify-center rounded-r-xl border-l border-white/[.09] text-tm-sub hover:bg-white/[.06] hover:text-tm-fg"
        onClick={stop(() => {
          void copyText(LINKS.email).then((ok) => {
            if (!ok) return;
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          });
        })}
      >
        {copied ? <TickIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}

function Socials({ labelled }: { labelled: boolean }) {
  const { openShare } = useTerminal();
  return (
    <>
      <a href={LINKS.linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn · in/nandishd" aria-label="LinkedIn" className={labelled ? cta : `${cta} !px-0 !w-9`}>
        <LinkedinIcon size={14} />
        {labelled && "LinkedIn"}
      </a>
      <a href={LINKS.github} target="_blank" rel="noopener noreferrer" title="GitHub" aria-label="GitHub" className={labelled ? cta : `${cta} !px-0 !w-9`}>
        <GithubIcon size={15} />
        {labelled && "GitHub"}
      </a>
      <button type="button" title="share this portfolio" aria-label="share this portfolio" className={`t-reset ${cta} !w-9 !px-0`} onClick={stop(openShare)}>
        <ShareGlyph />
      </button>
    </>
  );
}

const ShareGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);

/** Desktop: one wide bar, always on screen. `wide` drops the quote and the graph when the column narrows. */
export function HeroBar({ wide }: { wide: boolean }) {
  const { submit, openResume } = useTerminal();
  return (
    <div
      data-screen-label="Hero · unified bar"
      className="t-glass flex min-w-0 flex-col gap-4 rounded-[20px] p-[18px]"
      style={{ animation: "tHeroIn .55s cubic-bezier(.2,.8,.2,1) both" }}
    >
      <div className="flex min-w-0 flex-wrap items-start gap-x-7 gap-y-4">
        <div className="flex min-w-0 flex-[1_1_320px] items-start gap-4">
          <Portrait size={72} radius={18} />
          <div className="flex flex-none flex-col gap-[7px]">
            <div className="flex items-center gap-2.5">
              <span data-loader-target="name" className="whitespace-nowrap text-xl font-bold leading-none tracking-[-.02em]">
                Nandisha D
              </span>
              <span
                className="inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 font-sans text-[11px] font-semibold text-tm-green"
                style={{ boxShadow: "inset 0 0 0 1px color-mix(in oklch,var(--t-green) 40%,transparent)" }}
              >
                <GreenDot />
                Open to work
              </span>
            </div>
            <div className="whitespace-nowrap text-[12.5px] text-tm-sub">Generative AI Engineer · Bangalore, UTC+5:30</div>
            <div className="flex items-center gap-x-3">
              <span className="inline-flex h-[22px] items-center rounded-full bg-tm-hl px-2.5 font-sans text-[11px] font-semibold text-tm-accent">
                Now · SDE-II @ Think41
              </span>
              <Uptime />
            </div>
          </div>

          {wide && (
            <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5 self-stretch" style={{ animation: "tHeroIn .6s cubic-bezier(.2,.8,.2,1) .2s both" }}>
              <blockquote className="m-0 min-w-0 font-serif text-[13px] italic leading-[1.35] tracking-[-.005em] text-tm-fg [text-wrap:pretty]">
                <span className="mr-0.5 align-[-.25em] text-[1.5em] leading-[0] text-tm-accent">“</span>
                {QUOTE.join(" ")}
                <span className="ml-0.5 align-[-.25em] text-[1.5em] leading-[0] text-tm-accent">”</span>
              </blockquote>
              <div className="mt-auto flex justify-end pr-1.5">
                <Signature />
              </div>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-[1_1_300px]">
          <Activity />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-3.5" style={{ animation: "tHeroIn .55s cubic-bezier(.2,.8,.2,1) .12s both" }}>
        <button type="button" title="schedule a call" className={`t-reset ${ctaPrimary}`} onClick={stop(() => submit("/book"))}>
          <CalendarIcon />
          Book a call
        </button>
        <EmailGroup />
        <span className="relative inline-flex">
          <button
            type="button"
            title="open the résumé"
            className={`t-reset ${cta}`}
            style={{ animation: "tResBlink 1.8s ease-in-out 2.6s infinite" }}
            onClick={stop(openResume)}
          >
            <DownloadIcon />
            Résumé
          </button>
          <ArrowDoodle />
        </span>
        <span className="flex-1" />
        <Socials labelled />
      </div>
    </div>
  );
}

/** Phone: one compact card with icon-only actions. No signature slot — the loader lands on the name. */
export function HeroCompact() {
  const { openVoice, openShare, openResume } = useTerminal();
  return (
    <div
      data-screen-label="Hero · mobile"
      className="t-glass flex min-w-0 flex-col gap-2.5 rounded-[18px] p-3"
      style={{ animation: "tHeroIn .5s cubic-bezier(.2,.8,.2,1) both" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Portrait size={48} hint={false} radius={14} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span data-loader-target="name" className="truncate text-[15px] font-bold leading-[1.15] tracking-[-.01em]">
              Nandisha D
            </span>
            <span className="inline-flex flex-none items-center gap-1.5 text-[11px] font-semibold text-tm-green">
              <GreenDot />
              Open to work
            </span>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-full bg-tm-hl px-2.5 font-sans text-[11px] font-semibold text-tm-accent">SDE-II @ Think41</span>
            <span className="text-[11px] text-tm-sub">2+ yrs · GenAI Engineer</span>
          </div>
        </div>
        <button
          type="button"
          title="share this portfolio"
          aria-label="share this portfolio"
          className="t-reset t-chip inline-flex size-7 flex-none items-center justify-center rounded-full text-tm-sub"
          onClick={stop(openShare)}
        >
          <ShareGlyph />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <a href={`mailto:${LINKS.email}`} className={`${ctaPrimary} flex-1`}>
          <MailIcon size={14} />
          Email
        </a>
        <button type="button" aria-label="open résumé" title="résumé" className={`t-reset ${cta} !w-9 !px-0`} onClick={stop(openResume)}>
          <DownloadIcon />
        </button>
        <button type="button" aria-label="voice mode" title="voice mode" className={`t-reset ${cta} !w-9 !px-0`} onClick={stop(openVoice)}>
          <MicIcon size={15} />
        </button>
        <a href={LINKS.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className={`${cta} !w-9 !px-0`}>
          <LinkedinIcon size={14} />
        </a>
        <a href={LINKS.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className={`${cta} !w-9 !px-0`}>
          <GithubIcon size={15} />
        </a>
      </div>
    </div>
  );
}
