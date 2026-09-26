"use client";

import { memo, useState } from "react";

import { hasErrors, MAX_MESSAGE_CHARS, MAX_NAME_CHARS, validateDraft, type DraftErrors } from "@/lib/message/validate";
import type { EntryOf, MessageDraft } from "@/lib/terminal/types";
import { useTerminal } from "../context";

const input =
  "min-w-0 flex-1 border-0 border-b border-tm-border bg-transparent px-0 py-1 text-[13px] text-tm-fg outline-none transition-colors placeholder:text-tm-dim focus:border-tm-accent";

function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <div id={id} className="mt-1 text-[11px] text-tm-red">
      {text}
    </div>
  );
}

export const MessageModal = memo(function MessageModal({ initial }: { initial: MessageDraft }) {
  const { sendMessage, dispatch, focus } = useTerminal();
  const [draft, setDraft] = useState(initial);
  const [tried, setTried] = useState(false);
  const errors = validateDraft(draft);
  const shown: DraftErrors = tried ? errors : {};
  const set = (k: keyof MessageDraft) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [k]: ev.target.value }));

  const send = () => {
    setTried(true);
    if (hasErrors(errors)) return;
    sendMessage({ name: draft.name.trim(), email: draft.email.trim(), text: draft.text.trim() });
  };
  const discard = () => {
    dispatch({ type: "MESSAGE_CLOSE" });
    setTimeout(focus, 50);
  };
  const remaining = MAX_MESSAGE_CHARS - draft.text.length;

  return (
    <div
      data-screen-label="Message modal"
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6 max-[859px]:items-end max-[859px]:p-0"
      style={{ animation: "tFade .2s" }}
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) discard();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label="message Nandisha"
        className="w-full max-w-[560px] border border-tm-border bg-tm-panel shadow-[0_30px_80px_rgba(0,0,0,.6)] max-[859px]:max-w-none max-[859px]:border-x-0 max-[859px]:border-b-0"
        style={{ animation: "tReveal .3s cubic-bezier(.2,.8,.2,1)" }}
        noValidate
        onClick={(ev) => ev.stopPropagation()}
        onSubmit={(ev) => {
          ev.preventDefault();
          send();
        }}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
            ev.preventDefault();
            send();
          } else if (ev.key === "Escape") {
            ev.preventDefault();
            discard();
          }
        }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-tm-border px-3.5 py-2 text-[11px] uppercase tracking-[.08em]">
          <span className="text-tm-accent">✉ new message</span>
          <span className="truncate normal-case tracking-normal text-tm-muted">to nandisha · replies within a day</span>
        </div>

        <div className="flex flex-col gap-3 px-3.5 pb-1 pt-3">
          <div className="flex gap-3 max-[520px]:flex-col">
            <label className="flex min-w-0 flex-1 flex-col">
              <span className="mb-0.5 text-[10.5px] uppercase tracking-[.08em] text-tm-muted">name · optional</span>
              <input
                value={draft.name}
                onChange={set("name")}
                placeholder="your name"
                autoComplete="name"
                maxLength={MAX_NAME_CHARS}
                autoFocus
                className={input}
              />
            </label>
            <label className="flex min-w-0 flex-[1.3] flex-col">
              <span className="mb-0.5 text-[10.5px] uppercase tracking-[.08em] text-tm-muted">email</span>
              <input
                value={draft.email}
                onChange={set("email")}
                placeholder="you@company.com"
                type="email"
                autoComplete="email"
                aria-invalid={!!shown.email}
                aria-describedby={shown.email ? "message-email-error" : undefined}
                className={`${input} ${shown.email ? "border-tm-red" : ""}`}
              />
              <FieldError id="message-email-error" text={shown.email} />
            </label>
          </div>

          <label className="flex flex-col">
            <span className="mb-0.5 text-[10.5px] uppercase tracking-[.08em] text-tm-muted">message</span>
            <textarea
              value={draft.text}
              onChange={set("text")}
              placeholder="What are you building, and where would I fit in?"
              rows={Math.min(12, Math.max(4, draft.text.split("\n").length + 1))}
              aria-invalid={!!shown.text}
              aria-describedby={shown.text ? "message-text-error" : undefined}
              className={`${input} resize-none leading-[1.6] ${shown.text ? "border-tm-red" : ""}`}
            />
            <FieldError id="message-text-error" text={shown.text} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 pb-3 pt-2">
          <span className={`text-[11px] tabular-nums ${remaining < 0 ? "text-tm-red" : "text-tm-dim"}`}>
            {draft.text.length}/{MAX_MESSAGE_CHARS}
          </span>
          <span className="text-[11px] text-tm-dim max-[520px]:hidden">ctrl ⏎ send · esc discard</span>
          <span className="flex-1" />
          <button type="button" className="t-reset px-2 py-1 text-xs text-tm-muted hover:text-tm-fg" onClick={discard}>
            discard
          </button>
          <button
            type="submit"
            className="t-reset border border-tm-accent bg-tm-accent px-3 py-1 text-xs font-semibold text-tm-bg transition-opacity hover:opacity-90"
          >
            send ⏎
          </button>
        </div>
      </form>
    </div>
  );
});

export const BookCard = memo(function BookCard({ entry }: { entry: EntryOf<"book"> }) {
  return (
    <div className="flex max-w-[520px] flex-col gap-1.5 border border-tm-border bg-tm-panel px-3.5 py-3">
      <div className="font-semibold">schedule a call</div>
      <div className="text-[12.5px] text-tm-sub">30 min · IST (UTC+5:30) · Google Meet</div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 bg-tm-accent px-3 py-[5px] text-xs font-semibold text-tm-bg no-underline"
          style={{ color: "var(--t-bg)" }}
        >
          open calendar ↗
        </a>
        <span className="text-[11.5px] text-tm-muted">{entry.host}</span>
      </div>
    </div>
  );
});
