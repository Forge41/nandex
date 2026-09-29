"use client";

import { useEffect, useRef, useState } from "react";

import type { Source } from "@/lib/types";
import { FileIcon, LinkIcon } from "./icons";

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
      className={isMobile ? "flex min-h-0 flex-col bg-tm-panel" : "t-glass flex min-h-0 flex-col overflow-hidden rounded-[20px]"}
      style={
        isMobile
          ? { position: "absolute", inset: 0, zIndex: 20 }
          : { width: "min(400px, 42vw)", flex: "none", margin: "10px 10px 10px 0", animation: "tSlideIn .3s cubic-bezier(.2,.8,.2,1)" }
      }
    >
      <div className="flex h-11 flex-none items-center gap-2.5 border-b border-white/[.07] pl-3.5 pr-2.5 text-[11px] uppercase tracking-[.06em] text-tm-muted">
        <span className="inline-flex min-w-0 items-center gap-2">
          <FileIcon size={13} />
          <span className="font-semibold">source</span>
          <span className="truncate normal-case tracking-normal text-tm-sub">{current.doc}</span>
        </span>
        <span className="flex-1" />
        <button
          type="button"
          title="copy deep link"
          className="t-reset t-chip inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11px] normal-case tracking-normal text-tm-sub transition-all duration-150 hover:bg-tm-hl hover:text-tm-accent"
          onClick={() =>
            void onCopy(viewerId).then((ok) => {
              setCopyLabel(ok ? "copied ✓" : "copy blocked");
              setTimeout(() => setCopyLabel("copy link"), 1500);
            })
          }
        >
          <LinkIcon />
          {copyLabel}
        </button>
        <button
          type="button"
          title="close (q)"
          aria-label="close source viewer"
          className="t-reset t-chip inline-flex size-7 items-center justify-center rounded-full text-xs text-tm-sub transition-all duration-150 hover:bg-tm-hl hover:text-tm-fg"
          onClick={onClose}
        >
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
              <div className="font-sans text-[13px] leading-[1.55] tracking-[-.005em] text-tm-fg [overflow-wrap:anywhere] [text-wrap:pretty]">{x.text}</div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-none gap-3 border-t border-white/[.07] px-3.5 py-2 text-[11px] text-tm-dim">
        <span>
          section {idx + 1}/{sections.length} · #src={viewerId}
        </span>
        <span className="flex-1" />
        <span>q to close</span>
      </div>
    </aside>
  );
}
