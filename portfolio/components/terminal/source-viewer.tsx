"use client";

import { useEffect, useRef, useState } from "react";

import type { Source } from "@/lib/types";

export function SourceViewer({
  sources,
  viewerId,
  isMobile,
  onClose,
  onCopy,
}: {
  sources: Source[];
  viewerId: string;
  isMobile: boolean;
  onClose: () => void;
  onCopy: (id: string) => Promise<boolean>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copyLabel, setCopyLabel] = useState("copy link");
  const current = sources.find((s) => s.id === viewerId);
  const sections = current ? sources.filter((s) => s.doc === current.doc) : [];
  const idx = sections.findIndex((s) => s.id === viewerId);

  useEffect(() => {
    const t = setTimeout(() => {
      const c = scrollRef.current;
      const el = c?.querySelector<HTMLElement>(`#src-${CSS.escape(viewerId)}`);
      if (c && el) c.scrollTop = Math.max(0, el.offsetTop - c.offsetTop - 12);
    }, 60);
    return () => clearTimeout(t);
  }, [viewerId]);

  if (!current) return null;

  return (
    <aside
      data-screen-label="Source viewer"
      aria-label={`source viewer: ${current.doc}`}
      className="flex min-h-0 flex-col bg-tm-panel"
      style={
        isMobile
          ? { position: "absolute", inset: 0, zIndex: 20 }
          : { width: 380, flex: "none", borderLeft: "1px solid var(--t-border)", animation: "tFade .2s ease-out" }
      }
    >
      <div className="flex h-[30px] flex-none items-center gap-2 border-b border-tm-border px-3 text-[11px] uppercase tracking-[.08em] text-tm-muted">
        <span className="text-tm-accent">3</span>
        <span>less</span>
        <span className="truncate normal-case tracking-normal text-tm-sub">{current.doc}</span>
        <span className="flex-1" />
        <button
          type="button"
          title="copy deep link"
          className="t-reset normal-case tracking-normal text-tm-muted"
          onClick={() =>
            void onCopy(viewerId).then((ok) => {
              setCopyLabel(ok ? "copied ✓" : "copy blocked");
              setTimeout(() => setCopyLabel("copy link"), 1500);
            })
          }
        >
          {copyLabel}
        </button>
        <button type="button" aria-label="close source viewer" className="t-reset px-0.5 text-tm-muted" onClick={onClose}>
          ✕
        </button>
      </div>
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3.5 py-3">
        {sections.map((x) => {
          const on = x.id === viewerId;
          return (
            <div
              key={x.id}
              id={`src-${x.id}`}
              style={
                on
                  ? { padding: "8px 10px", background: "var(--t-hl)", borderLeft: "2px solid var(--t-accent)", animation: "tFade .3s" }
                  : { padding: "8px 10px", borderLeft: "2px solid transparent", opacity: 0.75 }
              }
            >
              <div className="mb-1 flex justify-between gap-2 text-[11px] text-tm-muted">
                <span style={{ color: on ? "var(--t-accent)" : "var(--t-muted)" }}>{x.title}</span>
                <span className="flex-none whitespace-nowrap text-tm-dim">#{x.id}</span>
              </div>
              <div className="text-[12.5px] leading-[1.65] text-tm-fg [overflow-wrap:anywhere]">{x.text}</div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-none gap-3 border-t border-tm-border px-3 py-1.5 text-[11px] text-tm-dim">
        <span>
          section {idx + 1}/{sections.length} · #src={viewerId}
        </span>
        <span className="flex-1" />
        <span>q to close</span>
      </div>
    </aside>
  );
}
