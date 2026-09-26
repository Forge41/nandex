"use client";

import { memo, useRef, useState } from "react";

import type { EntryOf } from "@/lib/terminal/types";
import { useTerminal } from "../context";
import { AnswerText } from "./ai-answer";
import { CiteChip } from "./cite-chip";

const choice =
  "t-reset flex flex-[1_1_200px] flex-col gap-0.5 border border-tm-border bg-tm-bg px-3 py-2.5 hover:border-tm-accent";

export const FitPrompt = memo(function FitPrompt({ entry }: { entry: EntryOf<"fitPrompt"> }) {
  const { fitTypeMode, fitFile } = useTerminal();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex max-w-[560px] flex-col gap-2.5 border border-tm-border bg-tm-panel px-3.5 py-3">
      <div className="text-[12.5px] text-tm-sub">How should I read the job description?</div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={choice}
          onClick={(ev) => {
            ev.stopPropagation();
            fitTypeMode();
          }}
        >
          <span className="font-semibold text-tm-accent">paste / type it</span>
          <span className="text-[11.5px] text-tm-muted">one message in the prompt below, then ⏎</span>
        </button>
        <button
          type="button"
          className={choice}
          onClick={(ev) => {
            ev.stopPropagation();
            fileRef.current?.click();
          }}
        >
          <span className="font-semibold text-tm-accent">upload a document</span>
          <span className="text-[11.5px] text-tm-muted">.pdf · .txt · .md — parsed in your browser</span>
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.txt,.md,text/plain,application/pdf"
        className="hidden"
        aria-label="job description file"
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          ev.target.value = "";
          if (f) fitFile(f);
        }}
      />
      <div className="text-[11px] text-tm-dim" aria-live="polite">
        {entry.status}
      </div>
    </div>
  );
});

export const FitResult = memo(function FitResult({ entry }: { entry: EntryOf<"fit"> }) {
  const { byId, openSource, dispatch, copyText } = useTerminal();
  const [copyLabel, setCopyLabel] = useState("copy");
  const { card } = entry;
  const title = (id: string) => (byId[id] ? `${byId[id].doc} › ${byId[id].title}` : id);

  return (
    <div className="border border-tm-border bg-tm-panel px-3.5 py-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-semibold text-tm-accent">fit analysis</span>
        <span className="text-[11.5px] text-tm-muted">
          {card ? card.meta : "no listed skills matched — the agent reads the whole JD below"}
        </span>
      </div>
      {card && (
        <>
      <div className="mb-3 mt-2 flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-tm-sel">
          <div
            style={{
              width: card.score + "%",
              height: "100%",
              background: card.score > 66 ? "var(--t-green)" : "var(--t-accent)",
              transition: "width .6s ease",
            }}
          />
        </div>
        <span className="font-semibold">{card.score}%</span>
      </div>
      <div className="grid gap-x-6 gap-y-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(240px,100%),1fr))" }}>
        <div>
          <div className="mb-1.5 text-[11px] uppercase tracking-[.08em] text-tm-green">matches · {card.matches.length}</div>
          <div className="flex flex-col gap-[3px]">
            {card.matches.map((m) => (
              <div key={m.t} className="flex items-baseline gap-2">
                <span className="text-tm-green">✓</span>
                <span>{m.t}</span>
                <CiteChip n={m.n} title={title(m.id)} onOpen={() => openSource(m.id, entry.id)} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] uppercase tracking-[.08em] text-tm-accent">gaps · {card.gaps.length}</div>
          <div className="flex flex-col gap-[3px]">
            {card.gaps.map((g) => (
              <div key={g} className="flex items-baseline gap-2 text-tm-sub">
                <span className="text-tm-accent">✗</span>
                <span>{g}</span>
              </div>
            ))}
            {card.gaps.length === 0 && <div className="text-tm-muted">nothing in the JD I can&apos;t back with a source.</div>}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <span className="min-w-[200px] flex-1 text-[11.5px] text-tm-muted">{card.note}</span>
        <button
          type="button"
          className="t-reset border border-tm-accent px-2.5 py-1 text-xs text-tm-accent hover:bg-tm-hl"
          onClick={(ev) => {
            ev.stopPropagation();
            dispatch({ type: "NOTE_TOGGLE", id: entry.id });
          }}
        >
          draft a cover note ›
        </button>
      </div>
      {entry.noteOpen && (
        <div className="mt-2.5 flex flex-col gap-2 border border-tm-border bg-tm-bg px-3.5 py-3" style={{ animation: "tFade .2s" }}>
          <div className="flex justify-between gap-2 text-[10.5px] uppercase tracking-[.08em] text-tm-muted">
            <span>cover note · drafted from matches</span>
            <button
              type="button"
              className="t-reset normal-case tracking-normal text-tm-accent"
              onClick={(ev) => {
                ev.stopPropagation();
                void copyText(entry.noteText).then((ok) => {
                  setCopyLabel(ok ? "copied ✓" : "select & copy");
                  setTimeout(() => setCopyLabel("copy"), 1500);
                });
              }}
            >
              {copyLabel}
            </button>
          </div>
          <textarea
            aria-label="cover note"
            value={entry.noteText}
            onChange={(ev) => dispatch({ type: "NOTE_EDIT", id: entry.id, text: ev.target.value })}
            rows={9}
            className="box-border w-full resize-y border-0 bg-transparent text-[12.5px] leading-[1.6] text-tm-fg"
          />
        </div>
      )}
        </>
      )}
      {entry.assessment && (
        <div className="mt-3 flex gap-2.5 border-t border-dashed border-tm-border pt-3">
          <span className="flex-none leading-[1.6] text-tm-accent">◆</span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-[11px] uppercase tracking-[.08em] text-tm-muted">agent assessment</div>
            <AnswerText answer={entry.assessment} entryId={entry.id} />
          </div>
        </div>
      )}
      {entry.assessmentError && (
        <div className={`text-[11.5px] text-tm-muted ${card ? "mt-3 border-t border-dashed border-tm-border pt-3" : "mt-2"}`}>
          {entry.assessmentError}
        </div>
      )}
    </div>
  );
});
