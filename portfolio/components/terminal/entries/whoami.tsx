"use client";

import { LiveDot } from "@nandex/ui/indicators";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { projects } from "@/content/data";
import { sampleGrid, streaks } from "@/lib/github";
import { LINKS } from "@/lib/terminal/constants";
import { uptime } from "@/lib/terminal/time";
import { ContribGraph } from "../contrib-graph";
import { useTerminal, useTerminalView } from "../context";
import { Globe } from "../globe";
import { useNow, useRotator } from "../hooks";
import { ChevronIcon, DownloadIcon, GithubIcon, LinkedinIcon, MailIcon, MicIcon, PinIcon, ShareIcon } from "../icons";
import { PhosphorPortrait } from "../phosphor-portrait";

export const GreenDot = ({ size = 6 }: { size?: number }) => (
  <LiveDot tone="success" size={size} style={{ background: "var(--t-green)", animationDuration: "1.4s" }} />
);

export const QUOTE = ["Retrieve the right thing.", "Cite it with a receipt.", "Say it out loud, before they finish asking."];

const stop = (fn: () => void) => (ev: React.SyntheticEvent) => {
  ev.stopPropagation();
  fn();
};

const iconLink =
  "t-chip inline-flex size-8 items-center justify-center rounded-[10px] text-tm-sub no-underline transition-all duration-150 hover:-translate-y-px hover:bg-tm-hl hover:text-tm-accent";

function Dots({ count, active, tone }: { count: number; active: number; tone: string }) {
  return (
    <span className="mt-1.5 flex gap-[5px]" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="h-[5px] rounded-full transition-all duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ width: i === active ? 16 : 5, background: i === active ? tone : "rgba(255,255,255,.18)" }}
        />
      ))}
    </span>
  );
}

function Portrait({ size = 84, hint = true }: { size?: number; hint?: boolean }) {
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
      className="t-reset relative row-span-2 block"
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
          className="size-full rounded-[22px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.1),0_12px_36px_rgba(0,0,0,.4)] transition-shadow duration-200 hover:shadow-[inset_0_0_0_1px_var(--t-accent),0_0_48px_var(--t-hl)]"
        />
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px] bg-tm-bg"
          style={{
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

function Signature() {
  return (
    <span
      className="relative inline-block origin-bottom-right -rotate-6 whitespace-nowrap text-[30px] leading-[.9] tracking-[.01em] text-tm-accent"
      style={{ fontFamily: "var(--font-signature), cursive", filter: "drop-shadow(0 0 8px var(--t-hl))" }}
      aria-label="signed, Nandisha D"
    >
      Nandisha D
      <svg viewBox="0 0 200 14" preserveAspectRatio="none" className="absolute -bottom-1.5 -left-[4%] h-3 w-[106%] overflow-visible opacity-80" aria-hidden>
        <path d="M2 9 C 40 2, 90 12, 130 6 S 185 3, 198 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

type StatCard = { k: string; v: string; suffix?: string; sub: string; run: () => void };

function GlobeCard() {
  const { submit, randomCommit } = useTerminal();
  const { prCount, skillCount, theme } = useTerminalView();
  const now = useNow();
  const cards: StatCard[] = [
    {
      k: "in industry",
      v: uptime(now).replace(/ years?, /, "y ").replace(/ days?$/, "d"),
      sub: "Think41 → Harvey.ai · Bangalore, UTC+5:30",
      run: () => submit("!uptime"),
    },
    { k: "projects", v: String(projects.length), sub: "RAG · agents · voice · MCP · CLI", run: () => submit("!ls projects/") },
    { k: "merged PRs", v: prCount.toLocaleString("en-US"), suffix: "+", sub: "click a card to insert a commit", run: () => randomCommit("pr") },
    {
      k: "skills",
      v: skillCount.toLocaleString("en-US"),
      suffix: "+",
      sub: "and counting — Claude Code, LangGraph, pgvector…",
      run: () => randomCommit("skill"),
    },
  ];
  const [idx, next] = useRotator(cards.length);
  const c = cards[idx];
  return (
    <button
      type="button"
      title="next"
      className="t-reset t-glass relative flex min-w-0 items-center gap-3.5 overflow-hidden rounded-2xl px-3 py-2.5 transition-[transform,box-shadow] duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-0.5 hover:scale-[1.01]"
      onClick={stop(() => {
        c.run();
        next();
      })}
    >
      <span className="pointer-events-none absolute -left-[30%] -top-[60%] h-[120%] w-4/5 opacity-90" style={{ background: "radial-gradient(closest-side,var(--t-hl),transparent)" }} />
      <span className="relative flex size-14 flex-none items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]" style={{ background: "radial-gradient(circle at 35% 30%,rgba(255,255,255,.12),rgba(255,255,255,0) 60%)" }}>
        <Globe theme={theme} />
      </span>
      <span className="relative flex min-w-0 flex-1 flex-col gap-0.5 font-sans">
        <span className="truncate text-[11px] font-semibold uppercase tracking-[.02em] text-tm-muted">{c.k}</span>
        <span key={c.k} className="flex items-baseline gap-1.5" style={{ animation: "tFade .35s" }}>
          <span className="min-w-0 truncate text-xl font-bold leading-[1.05] tracking-[-.02em] text-tm-fg tabular-nums">{c.v}</span>
          {c.suffix && <span className="rounded-full bg-tm-accent px-[7px] py-0.5 text-[11px] font-bold text-tm-bg">{c.suffix}</span>}
        </span>
        <span className="truncate text-xs tracking-[-.005em] text-tm-sub">{c.sub}</span>
        <Dots count={cards.length} active={idx} tone="var(--t-accent)" />
      </span>
    </button>
  );
}

function IdentityCard() {
  const { openShare } = useTerminal();
  const { isMobile } = useTerminalView();
  return (
    <div className="t-glass relative z-[2] flex min-w-0 flex-col justify-between gap-3 rounded-[20px] p-3.5" style={{ animation: "tReveal .5s ease-out" }}>
      <div className="grid min-w-0 grid-cols-[84px_minmax(0,1fr)] grid-rows-[auto_auto] items-center gap-x-3 gap-y-0.5">
        <Portrait />
        <div className="flex min-w-0 items-start justify-between gap-2.5 self-end">
          <div className="min-w-0">
            <div className="whitespace-nowrap text-base font-bold leading-[1.1] tracking-[-.01em]">Nandisha D</div>
            <div className="mt-[3px] text-xs leading-[1.3] text-tm-sub">Generative AI Engineer</div>
            <div className="text-[11.5px] leading-[1.3] text-tm-muted">Think41 → Harvey.ai</div>
          </div>
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
        <div className="inline-flex items-center gap-1.5 self-start text-[11px] text-tm-muted">
          <PinIcon />
          Bangalore · UTC+5:30
        </div>
      </div>
      <div className={isMobile ? "flex flex-col gap-1.5 px-0.5" : "flex items-end justify-between gap-3 px-0.5"}>
        <blockquote className="m-0 min-w-0 flex-1 font-serif text-[15px] italic leading-[1.35] tracking-[-.005em] text-tm-fg [text-wrap:pretty]">
          <span className="mr-0.5 align-[-.25em] text-[1.5em] leading-[0] text-tm-accent">“</span>
          {QUOTE.map((line, i) => (
            <span key={line}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
          <span className="ml-0.5 align-[-.25em] text-[1.5em] leading-[0] text-tm-accent">”</span>
        </blockquote>
        <div className="flex flex-none items-end justify-end pr-2.5">
          <Signature />
        </div>
      </div>
      <GlobeCard />
    </div>
  );
}

function ActivityCard() {
  const { openVoice } = useTerminal();
  const { contrib, theme } = useTerminalView();
  const sample = useMemo(() => sampleGrid(), []);
  const grid = contrib ?? sample;
  const st = useMemo(() => streaks(grid), [grid]);
  const cards = [
    { k: "current streak", v: String(st.now), unit: "days", sub: "consecutive days with commits" },
    { k: "longest streak", v: String(st.max), unit: "days", sub: "best run in the last 52 weeks" },
    { k: "contributions", v: String(st.total), unit: "commits", sub: "activity · last 52 weeks" },
  ];
  const [idx, next] = useRotator(cards.length);
  const c = cards[idx];

  return (
    <div className="t-glass flex min-w-0 flex-col gap-3 rounded-[20px] p-3.5" style={{ animation: "tReveal .5s ease-out .06s both" }}>
      <div className="flex flex-none items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[.02em] text-tm-muted">
          <GithubIcon />
          activity · 52 weeks
        </span>
        {contrib ? (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-sans text-[10.5px] font-bold uppercase tracking-[.06em] text-tm-green shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--t-green)_40%,transparent)]">
            <span className="inline-block size-1.5 rounded-full bg-tm-green" style={{ animation: "tBlink 1.1s steps(1,end) infinite" }} />
            live
          </span>
        ) : (
          <span className="text-[10.5px] uppercase tracking-[.08em] text-tm-dim">sample data · offline</span>
        )}
      </div>
      <div className="relative flex min-h-[82px] flex-auto items-center">
        <div className="w-full">
          <ContribGraph grid={grid} theme={theme} />
        </div>
      </div>
      <div className="grid flex-none grid-cols-2 gap-2.5">
        <button
          type="button"
          title="next"
          className="t-reset t-chip relative flex min-w-0 flex-col justify-center gap-0.5 overflow-hidden rounded-[14px] px-3 py-2.5 font-sans transition-[transform,background] duration-300 hover:-translate-y-px hover:bg-tm-hl"
          onClick={stop(next)}
        >
          <span className="text-[10.5px] font-semibold uppercase tracking-[.04em] text-tm-muted">{c.k}</span>
          <span key={c.k} className="flex items-baseline gap-[5px]" style={{ animation: "tFade .35s" }}>
            <span className="whitespace-nowrap text-[19px] font-bold leading-[1.05] tracking-[-.02em] text-tm-fg tabular-nums">{c.v}</span>
            <span className="text-[11px] font-medium text-tm-muted">{c.unit}</span>
          </span>
          <span className="truncate text-[11px] text-tm-sub">{c.sub}</span>
          <Dots count={cards.length} active={idx} tone="var(--t-green)" />
        </button>
        <button
          type="button"
          title="talk to me — voice mode"
          className="t-reset relative flex min-w-0 items-center gap-2.5 overflow-hidden rounded-[14px] px-3 py-2.5 font-sans text-tm-bg shadow-[0_10px_28px_var(--t-hl),inset_0_1px_0_rgba(255,255,255,.25)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:scale-[1.01]"
          style={{ background: "linear-gradient(140deg,var(--t-accent),color-mix(in oklch,var(--t-accent) 70%,black))" }}
          onClick={stop(openVoice)}
        >
          <span className="pointer-events-none absolute -right-[20%] -top-1/2 h-[150%] w-[70%]" style={{ background: "radial-gradient(closest-side,rgba(255,255,255,.25),transparent)" }} />
          <span className="relative inline-flex size-[34px] flex-none items-center justify-center rounded-full bg-black/[.18] shadow-[inset_0_0_0_1px_rgba(255,255,255,.2)]">
            <span className="absolute inset-0 rounded-full border border-white/60" style={{ animation: "tRingOut 2.2s ease-out infinite" }} />
            <MicIcon size={18} />
          </span>
          <span className="relative flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-bold leading-[1.1] tracking-[-.01em]">Go voice mode</span>
            <span className="truncate text-[11px] opacity-85">ask me out loud — open mic</span>
          </span>
          <span className="relative ml-auto text-lg leading-none opacity-90">›</span>
        </button>
      </div>
      <div className="flex flex-none items-center gap-2 pt-0.5">
        <a href={LINKS.github} target="_blank" rel="noopener noreferrer" title="GitHub" aria-label="GitHub" className={iconLink}>
          <GithubIcon size={15} />
        </a>
        <a href={LINKS.linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn" aria-label="LinkedIn" className={iconLink}>
          <LinkedinIcon size={14} />
        </a>
        <a href={`mailto:${LINKS.email}`} title="Email" aria-label="Email" className={iconLink}>
          <MailIcon size={15} />
        </a>
        <span className="flex-1" />
        <a
          href={LINKS.resumeDownload}
          target="_blank"
          rel="noopener noreferrer"
          title="Download résumé"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-tm-accent px-3.5 font-sans text-xs font-semibold text-tm-bg no-underline hover:text-tm-bg shadow-[0_6px_18px_var(--t-hl)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_28px_var(--t-hl)]"
          style={{ animation: "tDribble 2.4s cubic-bezier(.34,1.56,.64,1) .8s 3" }}
        >
          <DownloadIcon />
          résumé.pdf
        </a>
      </div>
    </div>
  );
}

/** Phone layout once the conversation starts: one row, so the chat keeps the screen. */
const PULL_OPEN = 56;

function SwipeHint() {
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden className="text-tm-muted">
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M3 ${2 + i * 4.5} L9 ${5.5 + i * 4.5} L15 ${2 + i * 4.5}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: `tChevron 1.5s ease-in-out ${i * 0.18}s infinite` }}
        />
      ))}
    </svg>
  );
}

function CompactWhoami({ onExpand }: { onExpand: () => void }) {
  const { openVoice, openShare } = useTerminal();
  const start = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const release = () => {
    start.current = null;
    setPull(0);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={false}
      aria-label="show full profile"
      className="t-glass flex min-w-0 cursor-pointer touch-none select-none flex-col gap-2.5 rounded-[18px] px-3 pb-1.5 pt-3"
      style={{
        animation: "tFade .3s",
        transform: pull ? `translateY(${pull * 0.4}px)` : undefined,
        transition: pull ? "none" : "transform .25s cubic-bezier(.2,.8,.2,1)",
      }}
      onClick={stop(onExpand)}
      onPointerDown={(ev) => {
        if ((ev.target as HTMLElement).closest("a,button")) return;
        start.current = ev.clientY;
      }}
      onPointerMove={(ev) => {
        if (start.current == null) return;
        const dy = Math.max(0, ev.clientY - start.current);
        if (dy >= PULL_OPEN) {
          release();
          onExpand();
        } else setPull(dy);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          onExpand();
        }
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Portrait size={48} hint={false} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold leading-[1.15] tracking-[-.01em]">Nandisha D</div>
          <div className="truncate text-[11.5px] text-tm-sub">Generative AI Engineer · Think41 → Harvey.ai</div>
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
        <a href={LINKS.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className={iconLink} onClick={(ev) => ev.stopPropagation()}>
          <GithubIcon size={15} />
        </a>
        <a href={LINKS.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className={iconLink} onClick={(ev) => ev.stopPropagation()}>
          <LinkedinIcon size={14} />
        </a>
        <a href={`mailto:${LINKS.email}`} aria-label="Email" className={iconLink} onClick={(ev) => ev.stopPropagation()}>
          <MailIcon size={15} />
        </a>
        <button type="button" aria-label="voice mode" className={`t-reset ${iconLink}`} onClick={stop(openVoice)}>
          <MicIcon size={15} />
        </button>
        <span className="flex-1" />
        <a
          href={LINKS.resumeDownload}
          target="_blank"
          rel="noopener noreferrer"
          title="Download résumé"
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-tm-accent px-3.5 font-sans text-xs font-semibold text-tm-bg no-underline hover:text-tm-bg"
          onClick={(ev) => ev.stopPropagation()}
        >
          <DownloadIcon />
          résumé.pdf
        </a>
      </div>
      <div className="flex justify-center" title="tap or swipe down">
        <SwipeHint />
      </div>
    </div>
  );
}

export function Whoami() {
  const { isMobile, landing } = useTerminalView();
  const [expanded, setExpanded] = useState(false);
  const collapsible = isMobile && !landing;
  if (collapsible && !expanded) return <CompactWhoami onExpand={() => setExpanded(true)} />;
  return (
    <div
      onClick={
        collapsible
          ? (ev) => {
              ev.stopPropagation();
              if (!(ev.target as HTMLElement).closest("a,button")) setExpanded(false);
            }
          : undefined
      }
      className={
        isMobile
          ? "flex flex-col gap-3 pb-0.5 pt-1.5"
          : "flex flex-col gap-3 pb-0.5 pt-1.5 @min-[760px]:grid @min-[760px]:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] @min-[760px]:items-stretch @min-[760px]:gap-3.5"
      }
    >
      <IdentityCard />
      <ActivityCard />
      {collapsible && (
        <span className="inline-flex items-center justify-center gap-1 self-center text-[10.5px] uppercase tracking-[.08em] text-tm-muted">
          <ChevronIcon size={12} style={{ transform: "rotate(-90deg)" }} />
          tap to shrink
        </span>
      )}
    </div>
  );
}
