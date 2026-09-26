"use client";

import { memo, useEffect, useState } from "react";

import { SPINNER, VERBS } from "@/lib/terminal/constants";
import type { Entry } from "@/lib/terminal/types";
import { AiAnswer } from "./entries/ai-answer";
import { BookCard, MessageForm } from "./entries/contact-entries";
import { FitPrompt, FitResult } from "./entries/fit-entries";
import { CommandEcho, LinesBlock, PhotoEntry, ProseBlock, SudoPrompt, VoiceTurn } from "./entries/text-entries";
import { Whoami } from "./entries/whoami";

function Thinking() {
  const [tick, setTick] = useState(0);
  const [verb, setVerb] = useState(() => Math.floor(Math.random() * VERBS.length));
  useEffect(() => {
    let g = 0;
    const id = setInterval(() => {
      g++;
      setTick(g);
      if (g % 9 === 0) setVerb((v) => (v + 1 + Math.floor(Math.random() * 3)) % VERBS.length);
    }, 80);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="mb-2.5 flex gap-2.5 text-tm-muted" role="status">
      <span className="w-3.5 text-tm-accent" aria-hidden>
        {SPINNER[tick % SPINNER.length]}
      </span>
      <span>{VERBS[verb]}</span>
      <span className="text-tm-dim">(esc to interrupt)</span>
    </div>
  );
}

const EntryView = memo(function EntryView({ entry }: { entry: Entry }) {
  switch (entry.kind) {
    case "cmd":
      return <CommandEcho entry={entry} />;
    case "lines":
      return <LinesBlock entry={entry} />;
    case "prose":
      return <ProseBlock entry={entry} />;
    case "whoami":
      return <Whoami />;
    case "photo":
      return <PhotoEntry />;
    case "ai":
      return <AiAnswer entry={entry} />;
    case "fitPrompt":
      return <FitPrompt entry={entry} />;
    case "fit":
      return <FitResult entry={entry} />;
    case "form":
      return <MessageForm entry={entry} />;
    case "book":
      return <BookCard entry={entry} />;
    case "sudo":
      return <SudoPrompt entry={entry} />;
    case "voiceTurn":
      return <VoiceTurn entry={entry} />;
  }
});

export function EntryList({ entries, thinking }: { entries: Entry[]; thinking: boolean }) {
  return (
    <>
      {entries.map((e) => (
        <div key={e.id} className="mb-2.5" style={{ animation: "tFade .18s ease-out" }}>
          <EntryView entry={e} />
        </div>
      ))}
      {thinking && <Thinking />}
    </>
  );
}
