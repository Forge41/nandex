"use client";

import { useMemo } from "react";

import { sampleGrid, streaks } from "@/lib/github";
import { LINKS } from "@/lib/terminal/constants";
import { industry } from "@/lib/terminal/time";
import { ContribGraph } from "./contrib-graph";
import { useTerminal, useTerminalView } from "./context";
import { useNow } from "./hooks";
import { DownloadIcon, GithubIcon, LinkedinIcon, MailIcon, MicIcon, PinIcon, ShareIcon } from "./icons";
import { GreenDot, iconLink, Portrait, QUOTE, Signature, stop } from "./identity";

const pill = "inline-flex h-7 items-center gap-1.5 rounded-full px-3 font-sans text-[11.5px] font-semibold";

function Uptime() {
  const ind = industry(useNow());
  return (
    <span className="flex items-baseline gap-2 font-sans">
      <span className="text-lg font-bold leading-none tracking-[-.02em] text-tm-fg">{ind.years}+</span>
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
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-none items-center gap-2">
        <span className="inline-flex items-center gap-2 font-sans text-[10.5px] font-semibold uppercase tracking-[.06em] text-tm-muted">
          <GithubIcon size={13} />
          activity · 52 weeks
        </span>
        <span className="flex-1" />
        <span className="font-sans text-[11px] tabular-nums text-tm-sub">{st.total} contributions</span>
        {contrib ? (
          <span className="inline-flex items-center gap-1.5 font-sans text-[10.5px] font-bold uppercase tracking-[.06em] text-tm-green">
            <span className="inline-block size-1.5 rounded-full bg-tm-green" style={{ animation: "tBlink 1.1s steps(1,end) infinite" }} />
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

/** Desktop: one wide bar, always on screen. The terminal never scrolls it away. */
export function HeroBar({ wide }: { wide: boolean }) {
  const { openShare, openResume } = useTerminal();
  return (
    <div
      data-screen-label="Hero · unified bar"
      className="t-glass flex min-w-0 flex-col gap-3 rounded-[20px] p-3.5"
      style={{ animation: "tHeroIn .55s cubic-bezier(.2,.8,.2,1) both" }}
    >
      <div className="flex min-w-0 items-start gap-4">
        <Portrait size={72} radius={18} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <span data-loader-target="name" className="whitespace-nowrap text-xl font-bold leading-none tracking-[-.02em]">
              Nandisha D
            </span>
            <span className={`${pill} text-tm-green`} style={{ boxShadow: "inset 0 0 0 1px color-mix(in oklch,var(--t-green) 40%,transparent)" }}>
              <GreenDot />
              Open to work
            </span>
            <span className="flex-1" />
            <button
              type="button"
              title="share this portfolio"
              aria-label="share this portfolio"
              className="t-reset t-chip inline-flex size-7 flex-none items-center justify-center rounded-full text-tm-sub transition-all duration-150 hover:bg-tm-hl hover:text-tm-accent"
              onClick={stop(openShare)}
            >
              <ShareIcon />
            </button>
          </div>
          <div className="text-[12.5px] text-tm-sub">Generative AI Engineer · Bangalore, UTC+5:30</div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`${pill} bg-tm-hl text-tm-accent`}>Now · SDE-II @ Think41</span>
            <Uptime />
          </div>
        </div>
        {wide && (
          <div className="flex min-w-[280px] flex-1">
            <Activity />
          </div>
        )}
      </div>

      {wide && (
        <div className="flex items-end justify-between gap-4 px-0.5">
          <blockquote className="m-0 min-w-0 flex-1 font-serif text-[14px] italic leading-[1.35] tracking-[-.005em] text-tm-fg [text-wrap:pretty]">
            <span className="mr-0.5 align-[-.25em] text-[1.5em] leading-[0] text-tm-accent">“</span>
            {QUOTE.join(" ")}
            <span className="ml-0.5 align-[-.25em] text-[1.5em] leading-[0] text-tm-accent">”</span>
          </blockquote>
          <div className="flex flex-none items-end pr-2.5">
            <Signature />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="t-reset inline-flex h-9 items-center gap-2 rounded-xl bg-tm-accent px-3.5 font-sans text-xs font-semibold text-tm-bg shadow-[0_6px_18px_var(--t-hl)] transition-all duration-150 hover:-translate-y-px"
          onClick={stop(openResume)}
        >
          <DownloadIcon />
          Résumé
        </button>
        <a
          href={`mailto:${LINKS.email}`}
          className="t-chip inline-flex h-9 items-center gap-2 rounded-xl px-3.5 font-sans text-xs text-tm-sub no-underline transition-all duration-150 hover:bg-tm-hl hover:text-tm-accent"
        >
          <MailIcon size={14} />
          {LINKS.email}
        </a>
        <span className="flex-1" />
        <a href={LINKS.linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn" aria-label="LinkedIn" className={iconLink}>
          <LinkedinIcon size={14} />
        </a>
        <a href={LINKS.github} target="_blank" rel="noopener noreferrer" title="GitHub" aria-label="GitHub" className={iconLink}>
          <GithubIcon size={15} />
        </a>
        <span className="inline-flex items-center gap-1.5 px-1 text-[11px] text-tm-muted">
          <PinIcon />
          Bangalore
        </span>
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
          <ShareIcon />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={`mailto:${LINKS.email}`}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-tm-accent px-3 font-sans text-xs font-semibold text-tm-bg no-underline hover:text-tm-bg"
        >
          <MailIcon size={14} />
          Email
        </a>
        <button type="button" aria-label="open résumé" title="résumé" className={`t-reset ${iconLink}`} onClick={stop(openResume)}>
          <DownloadIcon />
        </button>
        <button type="button" aria-label="voice mode" title="voice mode" className={`t-reset ${iconLink}`} onClick={stop(openVoice)}>
          <MicIcon size={15} />
        </button>
        <a href={LINKS.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className={iconLink}>
          <LinkedinIcon size={14} />
        </a>
        <a href={LINKS.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className={iconLink}>
          <GithubIcon size={15} />
        </a>
      </div>
    </div>
  );
}
