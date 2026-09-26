"use client";

import { memo, useState } from "react";

import type { EntryOf } from "@/lib/terminal/types";
import { useTerminal } from "../context";

const field = "flex-1 min-w-0 border border-tm-border bg-tm-bg px-2 py-[5px] text-[12.5px] text-tm-fg";

export const MessageForm = memo(function MessageForm({ entry }: { entry: EntryOf<"form"> }) {
  const { sendMessage } = useTerminal();
  const [draft, setDraft] = useState(entry.initial);
  const set = (k: keyof typeof draft) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [k]: ev.target.value }));

  return (
    <form
      className="flex max-w-[520px] flex-col gap-2 border border-tm-border bg-tm-panel px-3.5 py-3"
      onClick={(ev) => ev.stopPropagation()}
      onSubmit={(ev) => {
        ev.preventDefault();
        sendMessage(draft);
      }}
    >
      <div className="text-[11.5px] text-tm-muted">leave a message — I read these.</div>
      <label className="flex items-center gap-2.5">
        <span className="w-14 flex-none text-tm-accent">name</span>
        <input value={draft.name} onChange={set("name")} placeholder="Ada" autoComplete="name" className={field} />
      </label>
      <label className="flex items-center gap-2.5">
        <span className="w-14 flex-none text-tm-accent">email</span>
        <input value={draft.email} onChange={set("email")} placeholder="ada@example.com" type="email" autoComplete="email" className={field} />
      </label>
      <label className="flex items-start gap-2.5">
        <span className="w-14 flex-none pt-[5px] text-tm-accent">text</span>
        <textarea value={draft.text} onChange={set("text")} rows={3} placeholder="We're building…" className={`${field} resize-y`} />
      </label>
      <div className="flex justify-end gap-2">
        <button type="submit" className="cursor-pointer border-0 bg-tm-accent px-3 py-[5px] text-xs font-semibold text-tm-bg">
          send ⏎
        </button>
      </div>
    </form>
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
