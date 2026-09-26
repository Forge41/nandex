"use client";

import { StatusDot } from "@nandex/ui/indicators";

import { PROMPT_COLOR } from "@/lib/commands/parse";
import type { Connection } from "@/lib/terminal/reducer";
import type { PromptMode, ThemeName } from "@/lib/terminal/types";

const CONNECTION: Record<Connection, { label: string; color: string; title: string }> = {
  checking: { label: "warming", color: "var(--t-accent)", title: "waking the answer service" },
  live: { label: "live", color: "var(--t-green)", title: "answers come from the retrieval agent" },
  offline: { label: "offline", color: "var(--t-dim)", title: "agent unreachable — answering from the local keyword matcher" },
};

export function StatusLine({
  mode,
  theme,
  statusMsg,
  isMobile,
  viewerOpen,
  verbose,
  connection,
}: {
  mode: PromptMode;
  theme: ThemeName;
  statusMsg: string;
  isMobile: boolean;
  viewerOpen: boolean;
  verbose: boolean;
  connection: Connection;
}) {
  const conn = CONNECTION[connection];
  return (
    <div data-screen-label="Status line" className="flex h-[26px] flex-none items-center overflow-hidden border-t border-tm-border bg-tm-panel text-[11.5px]">
      <span
        className="inline-flex h-full items-center px-2.5 text-[10.5px] font-semibold uppercase tracking-[.06em] text-tm-bg"
        style={{ background: PROMPT_COLOR[mode] }}
      >
        {mode}
      </span>
      <span className="px-2.5 text-tm-sub">theme:{theme}</span>
      {!isMobile && (
        <>
          <span className="text-tm-dim">│</span>
          <span className="truncate px-2.5 text-tm-muted" aria-live="polite">
            {statusMsg}
          </span>
        </>
      )}
      <span className="flex-1" />
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-2.5" style={{ color: conn.color }} title={conn.title} role="status">
        <StatusDot size={5} style={{ background: conn.color }} />
        {conn.label}
      </span>
      {!isMobile && <span className="whitespace-nowrap px-2.5 text-tm-muted">? for shortcuts</span>}
      <span className="whitespace-nowrap border-l border-tm-border px-2.5 text-tm-dim">
        {isMobile ? "mobile" : `${viewerOpen ? "3 panes" : "2 panes"} · ${verbose ? "verbose" : "quiet"}`}
      </span>
    </div>
  );
}
