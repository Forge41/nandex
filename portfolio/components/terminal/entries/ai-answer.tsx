"use client";

import { TypingCaret } from "@nandex/ui/indicators";
import { memo } from "react";

import { formatDebug } from "@/lib/answer/debug";
import { numberCitations } from "@/lib/answer/citations";
import type { AnswerBody, EntryOf } from "@/lib/terminal/types";
import { useTerminal } from "../context";
import { CiteChip, citeStyle } from "./cite-chip";

export function AnswerText({ answer, entryId }: { answer: AnswerBody; entryId?: number }) {
  const { byId, openSource } = useTerminal();
  const { order, paras } = numberCitations(answer.paras);
  const title = (id: string) => (byId[id] ? `${byId[id].doc} › ${byId[id].title}` : id);

  return (
    <>
      {paras.map((p, pi) => (
        <p key={pi} className="m-0 mb-2 whitespace-pre-line leading-[1.65] [overflow-wrap:anywhere]">
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
        <div className="mt-1.5 flex flex-col gap-0.5 border-t border-dashed border-tm-border pt-1.5 text-[11.5px] text-tm-muted">
          {order.map((id, i) => (
            <button
              key={id}
              type="button"
              className="t-reset flex items-baseline gap-2"
              onClick={(ev) => {
                ev.stopPropagation();
                openSource(id, entryId);
              }}
            >
              <span style={{ ...citeStyle(), margin: 0 }}>{i + 1}</span>
              <span className="text-tm-dim">{byId[id]?.doc ?? id}</span>
              <span className="text-tm-muted">›</span>
              <span className="text-tm-sub">{byId[id]?.title ?? ""}</span>
            </button>
          ))}
        </div>
      )}
    </>
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
    <div className="flex gap-2.5 py-0.5">
      <span className="flex-none leading-[1.6] text-tm-accent">◆</span>
      <div className="min-w-0 max-w-[110ch] flex-1">
        <AnswerText answer={entry.answer} entryId={entry.id} />
        {entry.inlineId && <InlineSource entryId={entry.id} sourceId={entry.inlineId} />}
        {entry.showDebug && entry.debug && (
          <div className="mt-1.5 whitespace-pre-wrap text-[11px] text-tm-dim">{formatDebug(entry.debug)}</div>
        )}
      </div>
    </div>
  );
});
