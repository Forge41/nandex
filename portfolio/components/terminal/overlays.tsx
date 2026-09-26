"use client";

import { useState } from "react";

import { LINKS, RECRUITER_TAGS } from "@/lib/terminal/constants";
import type { Source } from "@/lib/types";
import { GreenDot } from "./entries/whoami";
import { PhosphorPortrait } from "./phosphor-portrait";
import { ResumePage, useResumePageCount } from "./resume-page";

const SHARE_TEXT = "Nandisha D — Generative AI Engineer. Talk to his terminal portfolio: ask about RAG, agents, MCP, voice.";

const header = "flex h-[30px] flex-none items-center gap-2 border-b border-tm-border px-3 text-[11px] uppercase tracking-[.08em] text-tm-muted";
const ghostLink =
  "inline-flex items-center border border-tm-border px-3.5 py-1.5 text-xs text-tm-fg no-underline hover:border-tm-accent hover:text-tm-accent";

export function RecruiterView({ theme, onExit, onBook }: { theme: string; onExit: () => void; onBook: () => void }) {
  return (
    <div
      data-screen-label="Recruiter mode"
      role="dialog"
      aria-modal="true"
      aria-label="recruiter summary"
      className="absolute inset-0 z-[35] flex items-center justify-center overflow-auto bg-tm-bg p-6 max-[859px]:items-start max-[859px]:p-3"
      style={{ animation: "tFade .25s" }}
    >
      <div className="flex w-full max-w-[760px] flex-col border border-tm-border bg-tm-panel" style={{ animation: "tReveal .3s cubic-bezier(.2,.8,.2,1)" }}>
        <div className={header}>
          <span className="text-tm-accent">5</span>
          <span>recruiter mode</span>
          <span className="flex-1" />
          <button type="button" className="t-reset normal-case tracking-normal text-tm-muted" onClick={onExit}>
            esc · back to terminal
          </button>
        </div>
        <div className="flex flex-wrap gap-6 p-6 max-[859px]:p-4">
          <PhosphorPortrait theme={theme} className="size-[168px] flex-none shadow-[0_0_0_1px_var(--t-border),0_0_36px_var(--t-hl)]" />
          <div className="flex min-w-[min(280px,100%)] flex-1 flex-col gap-3.5">
            <div>
              <div className="text-[22px] font-semibold leading-[1.15]">Nandisha D</div>
              <div className="text-[13px] text-tm-sub">
                Generative AI Engineer · SDE-II at Think41, embedded with Harvey.ai · Bangalore (UTC+5:30)
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-tm-green">
              <GreenDot size={7} />
              open to interesting work · replies within 24h
            </div>
            <ul className="m-0 flex list-disc flex-col gap-1.5 pl-4 text-[12.5px] leading-[1.55] text-tm-fg">
              <li>Built Harvey.ai&apos;s production RAG pipeline — pgvector hybrid retrieval, re-ranking, streaming inference.</li>
              <li>Sole architect of a multi-agent workflow engine on Temporal: HLD → LLD → prototype in one week.</li>
              <li>6 Claude Code skills cut integration delivery from weeks to under one week; 47 PRs, zero rollbacks.</li>
              <li>Open source: GenAlpha CLI (any API → MCP server), TPS, nandex. Rated Above Expectations every review.</li>
            </ul>
            <div className="flex flex-wrap gap-[5px]">
              {RECRUITER_TAGS.map((t) => (
                <span key={t} className="border border-tm-border px-[7px] py-0.5 text-[11px] text-tm-sub">
                  {t}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-dashed border-tm-border pt-1.5">
              <a
                href={LINKS.resume}
                target="_blank"
                className="inline-flex items-center gap-1.5 bg-tm-accent px-3.5 py-1.5 text-xs font-semibold text-tm-bg no-underline shadow-[0_0_16px_var(--t-hl)] hover:text-tm-bg"
              >
                download résumé
              </a>
              <button type="button" className="t-reset border border-tm-border px-3.5 py-1.5 text-xs text-tm-fg hover:border-tm-accent hover:text-tm-accent" onClick={onBook}>
                book a call
              </button>
              <a href={`mailto:${LINKS.email}`} className={ghostLink}>
                email
              </a>
              <a href={LINKS.linkedin} target="_blank" rel="noopener noreferrer" className={ghostLink}>
                linkedin
              </a>
              <span className="flex-1" />
              <button type="button" className="t-reset text-xs text-tm-muted underline" onClick={onExit}>
                ask the agent instead ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShareModal({ url, onClose, copyText }: { url: string; onClose: () => void; copyText: (t: string) => Promise<boolean> }) {
  const [label, setLabel] = useState("copy");
  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;
  const e = encodeURIComponent;
  const targets = [
    { name: "X", glyph: "X", href: `https://twitter.com/intent/tweet?text=${e(SHARE_TEXT)}&url=${e(url)}` },
    { name: "LinkedIn", glyph: "in", href: `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}` },
    { name: "WhatsApp", glyph: "WA", href: `https://wa.me/?text=${e(SHARE_TEXT + " " + url)}` },
    { name: "Telegram", glyph: "TG", href: `https://t.me/share/url?url=${e(url)}&text=${e(SHARE_TEXT)}` },
    { name: "Reddit", glyph: "r/", href: `https://www.reddit.com/submit?url=${e(url)}&title=${e(SHARE_TEXT)}` },
    { name: "Facebook", glyph: "f", href: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}` },
    { name: "Email", glyph: "@", href: `mailto:?subject=${e("Nandisha D — terminal portfolio")}&body=${e(SHARE_TEXT + "\n" + url)}` },
    { name: "Hacker News", glyph: "Y", href: `https://news.ycombinator.com/submitlink?u=${e(url)}&t=${e(SHARE_TEXT)}` },
  ];
  return (
    <div
      data-screen-label="Share modal"
      className="absolute inset-0 z-[45] flex items-center justify-center bg-black/70 p-6 max-[859px]:p-3"
      style={{ animation: "tFade .2s" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="share"
        className="flex w-full max-w-[520px] flex-col border border-tm-border bg-tm-panel shadow-[0_30px_80px_rgba(0,0,0,.6)]"
        style={{ animation: "tReveal .3s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className={header}>
          <span className="text-tm-accent">›</span>
          <span>share</span>
          <span className="flex-1" />
          <button type="button" aria-label="close share" className="t-reset px-0.5 text-tm-muted" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3.5 p-4">
          <div className="flex items-center gap-2 border border-tm-border bg-tm-bg py-1.5 pl-2.5 pr-1.5">
            <span className="min-w-0 flex-1 truncate text-xs text-tm-sub">{url}</span>
            <button
              type="button"
              autoFocus
              className="t-reset whitespace-nowrap bg-tm-accent px-2.5 py-1 text-[11.5px] font-semibold text-tm-bg"
              onClick={() =>
                void copyText(url).then((ok) => {
                  setLabel(ok ? "copied ✓" : "blocked");
                  setTimeout(() => setLabel("copy"), 1500);
                })
              }
            >
              {label}
            </button>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))" }}>
            {targets.map((t) => (
              <a
                key={t.name}
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 border border-tm-border px-2 py-3 text-[11.5px] text-tm-fg no-underline transition-all duration-150 hover:border-tm-accent hover:bg-tm-hl hover:text-tm-accent"
              >
                <span className="inline-flex size-[34px] items-center justify-center rounded-full border border-tm-border bg-tm-bg text-[11px] font-bold tracking-[.04em]">
                  {t.glyph}
                </span>
                {t.name}
              </a>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2.5 text-[11.5px] text-tm-muted">
            {canNativeShare && (
              <button
                type="button"
                className="t-reset text-tm-sub underline"
                onClick={() => navigator.share({ title: "Nandisha D — terminal portfolio", text: SHARE_TEXT, url }).catch(() => undefined)}
              >
                more apps (system share)…
              </button>
            )}
            <span className="flex-1" />
            <span>/share copies a link that replays this conversation.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

type Row = { when: string; title: string; text: string };

export function experience(byId: Record<string, Source>): Row[] {
  return [
    { when: "Apr 2026 – Present", title: "SDE-II, Think41 · client Harvey.ai", text: byId["resume-sde2"]?.text ?? "" },
    { when: "Feb 2025 – Mar 2026", title: "SDE-I, Think41 · client Atomicwork", text: byId["resume-sde1"]?.text ?? "" },
    { when: "Jun 2024 – Jan 2025", title: "Intern, Think41", text: byId["resume-intern"]?.text ?? "" },
  ];
}

export function ResumeModal({ onClose }: { onClose: () => void }) {
  const pages = useResumePageCount();
  return (
    <div
      data-screen-label="Résumé modal"
      className="absolute inset-0 z-40 flex items-stretch justify-center bg-black/70 p-6 max-[859px]:p-0"
      style={{ animation: "tFade .2s" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="résumé"
        className="light flex min-h-0 w-full max-w-[760px] flex-col bg-background font-sans text-content shadow-[0_30px_80px_rgba(0,0,0,.6)]"
        style={{ animation: "tReveal .3s cubic-bezier(.2,.8,.2,1)" }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex flex-none items-center gap-2.5 border-b border-line px-4 py-2.5">
          <span className="t-eyebrow text-content-muted">
            résumé · {pages} page{pages === 1 ? "" : "s"}
          </span>
          <span className="flex-1" />
          <a href={LINKS.resume} target="_blank" className="rounded-sm bg-btn-inverted px-2.5 py-1 text-xs font-medium text-content-on-interactive no-underline hover:bg-btn-inverted-hover">
            Download PDF
          </a>
          <button type="button" autoFocus className="cursor-pointer rounded-sm px-2.5 py-1 text-xs font-medium text-content hover:bg-surface-hover" onClick={onClose}>
            esc · close
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto bg-surface-subtle p-4 max-[859px]:p-0">
          {Array.from({ length: pages }, (_, i) => (
            <ResumePage key={i} page={i + 1} className="w-full flex-none shadow-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}
