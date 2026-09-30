"use client";

import { useState } from "react";

import { LINKS } from "@/lib/terminal/constants";
import { ResumePage, useResumePageCount } from "./resume-page";

const SHARE_TEXT = "Nandisha D — Generative AI Engineer. Talk to his terminal portfolio: ask about RAG, agents, MCP, voice.";

const header = "flex h-[30px] flex-none items-center gap-2 border-b border-tm-border px-3 text-[11px] uppercase tracking-[.08em] text-tm-muted";

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
        className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-[22px] bg-tm-panel shadow-[inset_0_1px_0_rgba(255,255,255,.12),inset_0_0_0_1px_rgba(255,255,255,.07),0_30px_80px_rgba(0,0,0,.6)]"
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
          <a href={LINKS.resumeView} target="_blank" rel="noopener noreferrer" className="rounded-sm px-2.5 py-1 text-xs font-medium text-content no-underline hover:bg-surface-hover">
            Open in Drive
          </a>
          <a href={LINKS.resumeDownload} target="_blank" rel="noopener noreferrer" className="rounded-sm bg-btn-inverted px-2.5 py-1 text-xs font-medium text-content-on-interactive no-underline hover:bg-btn-inverted-hover">
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
