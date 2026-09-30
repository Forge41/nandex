"use client";

import { TypingCaret } from "@nandex/ui/indicators";
import { memo, useState } from "react";

import { formatDebug } from "@/lib/answer/debug";
import { numberCitations } from "@/lib/answer/citations";
import type { AnswerBody, EntryOf } from "@/lib/terminal/types";
import type { Source } from "@/lib/types";
import { useTerminal } from "../context";
import { CiteChip } from "./cite-chip";

export function AnswerText({ answer, entryId }: { answer: AnswerBody; entryId?: number }) {
  const { byId, openSource } = useTerminal();
  const { order, paras } = numberCitations(answer.paras);
  const title = (id: string) => (byId[id] ? `${byId[id].doc} › ${byId[id].title}` : id);

  return (
    <>
      {paras.map((p, pi) => (
        <p key={pi} className="m-0 mb-2 whitespace-pre-line leading-[1.55] [overflow-wrap:anywhere] [text-wrap:pretty]">
          {p.map((s, si) =>
            s.kind === "cite" ? (
              <CiteChip key={si} n={s.n} title={title(s.id)} onOpen={() => openSource(s.id, entryId)} />
            ) : s.kind === "code" ? (
              <span key={si} className="rounded-[3px] bg-tm-sel px-1 text-tm-accent">
                {s.t}
              </span>
            ) : (
              <span key={si}>{s.t}</span>
            ),
          )}
          {answer.streaming && pi === paras.length - 1 && <TypingCaret className="ml-0.5" style={{ background: "var(--t-fg)" }} />}
        </p>
      ))}
      {answer.streaming && !paras.length && (
        <p className="m-0 mb-2">
          <TypingCaret style={{ background: "var(--t-fg)" }} />
        </p>
      )}
      {order.length > 0 && !answer.streaming && (
        <div className="mt-2.5 flex flex-col gap-1 border-t border-white/[.07] pt-2 font-sans text-[11.5px] tracking-[-.005em]">
          {order.map((id, i) => (
            <SourceRow key={id} n={i + 1} id={id} source={byId[id]} onOpen={() => openSource(id, entryId)} />
          ))}
        </div>
      )}
    </>
  );
}

/** The footnote under an answer: the number the inline chip used, then the document it came from. */
function SourceRow({ n, id, source, onOpen }: { n: number; id: string; source?: Source; onOpen: () => void }) {
  const [hover, setHover] = useState(false);
  const snippet = source ? (source.text.length > 160 ? source.text.slice(0, 160).trimEnd() + "…" : source.text) : "";
  return (
    <span className="relative block">
      <button
        type="button"
        aria-label={`source ${n}: ${source ? `${source.doc} › ${source.title}` : id}`}
        className="t-reset group flex w-full items-baseline gap-2 rounded-md px-1 py-0.5 text-left transition-colors duration-150 hover:bg-tm-hl"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={(ev) => {
          ev.stopPropagation();
          setHover(false);
          onOpen();
        }}
      >
        <span className="inline-flex size-[17px] flex-none items-center justify-center rounded-[4px] border border-tm-dim text-[10px] font-bold tabular-nums text-tm-accent group-hover:border-tm-accent">
          {n}
        </span>
        <span className="flex-none text-tm-accent">{source?.doc ?? id}</span>
        {source && (
          <>
            <span className="flex-none text-tm-dim">›</span>
            <span className="min-w-0 flex-1 truncate text-tm-sub">{source.title}</span>
          </>
        )}
      </button>
      {hover && source && (
        <span
          role="tooltip"
          className="t-popover pointer-events-none absolute bottom-[calc(100%+8px)] left-0 z-30 w-[260px] rounded-xl px-3 py-2.5 text-[11.5px] leading-[1.45]"
          style={{ animation: "tPopIn .2s ease-out" }}
        >
          <span className="mb-[3px] block font-semibold tracking-[-.005em]">{source.title}</span>
          <span className="block text-[#6b645e]">{snippet}</span>
          <span className="mt-1.5 block text-[10.5px] uppercase tracking-[.04em] text-[#8a827b]">{source.doc} · click to open</span>
          <span className="absolute left-[9px] top-full size-0 border-[6px] border-b-0 border-transparent border-t-white" />
        </span>
      )}
    </span>
  );
}

function InlineSource({ entryId, sourceId }: { entryId: number; sourceId: string }) {
  const { byId, dispatch, openPane, copyLink } = useTerminal();
  const src = byId[sourceId];
  if (!src) return null;
  return (
    <div className="mt-2 border border-l-2 border-tm-border border-l-tm-accent bg-tm-panel px-3 py-2 text-xs leading-[1.6]" style={{ animation: "tFade .2s" }}>
      <div className="mb-1 flex justify-between gap-2 text-[11px] text-tm-muted">
        <span>
          {src.doc} › {src.title}
        </span>
        <button type="button" className="t-reset text-tm-muted" aria-label="close source" onClick={() => dispatch({ type: "INLINE_SOURCE", id: entryId, sourceId: null })}>
          ✕
        </button>
      </div>
      <div className="bg-tm-hl py-0.5 text-tm-fg [overflow-wrap:anywhere]">{src.text}</div>
      <div className="mt-1.5 flex gap-3 text-[11px] text-tm-muted">
        <button type="button" className="t-reset underline" onClick={() => openPane(sourceId)}>
          open in viewer
        </button>
        <button type="button" className="t-reset underline" onClick={() => void copyLink(sourceId)}>
          copy link
        </button>
      </div>
    </div>
  );
}

export const AiAnswer = memo(function AiAnswer({ entry }: { entry: EntryOf<"ai"> }) {
  return (
    <div className="flex justify-start py-0.5">
      <div className="min-w-0 max-w-[min(72ch,78%)] rounded-[18px_18px_18px_4px] bg-tm-panel px-4 pb-2.5 pt-3 font-sans text-[13px] tracking-[-.005em] shadow-[inset_0_0_0_1px_rgba(255,255,255,.07)] max-[859px]:max-w-[92%]">
        <AnswerText answer={entry.answer} entryId={entry.id} />
        {entry.inlineId && <InlineSource entryId={entry.id} sourceId={entry.inlineId} />}
        {entry.showDebug && entry.debug && (
          <div className="mt-1.5 whitespace-pre-wrap text-[11px] text-tm-dim">{formatDebug(entry.debug)}</div>
        )}
      </div>
    </div>
  );
});
