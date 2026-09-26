"use client";

import { TypingCaret } from "@nandex/ui/indicators";
import Image from "next/image";
import { memo } from "react";

import { PROMPT_COLOR, PROMPT_SYMBOL } from "@/lib/commands/parse";
import type { EntryOf, Line, Tone } from "@/lib/terminal/types";

export const TONE: Record<Tone, string> = {
  base: "var(--t-fg)",
  sub: "var(--t-sub)",
  muted: "var(--t-muted)",
  dim: "var(--t-dim)",
  accent: "var(--t-accent)",
  green: "var(--t-green)",
  red: "var(--t-red)",
  blue: "var(--t-blue)",
  violet: "var(--t-violet)",
};

const Spans = ({ line }: { line: Line }) => (
  <div>
    {line.map((s, i) => (
      <span key={i} style={{ color: TONE[s.tone] }}>
        {s.t}
      </span>
    ))}
  </div>
);

export const CommandEcho = memo(function CommandEcho({ entry }: { entry: EntryOf<"cmd"> }) {
  return (
    <div className="flex gap-2 text-tm-fg">
      <span className="flex-none font-semibold" style={{ color: entry.mode === "voice" ? "var(--t-fg)" : PROMPT_COLOR[entry.mode] }}>
        {PROMPT_SYMBOL[entry.mode]}
      </span>
      <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{entry.text}</span>
    </div>
  );
});

export const LinesBlock = memo(function LinesBlock({ entry }: { entry: EntryOf<"lines"> }) {
  return (
    <pre className="m-0 overflow-x-auto whitespace-pre" style={{ font: "inherit" }}>
      {entry.lines.map((l, i) => (
        <Spans key={i} line={l} />
      ))}
    </pre>
  );
});

export const ProseBlock = memo(function ProseBlock({ entry }: { entry: EntryOf<"prose"> }) {
  return (
    <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">
      {entry.lines.map((l, i) => (
        <Spans key={i} line={l} />
      ))}
    </div>
  );
});

export const SudoPrompt = memo(function SudoPrompt({ entry }: { entry: EntryOf<"sudo"> }) {
  return (
    <div className="flex gap-2">
      <span className="text-tm-sub">[sudo] password for visitor:</span>
      <span className="text-tm-fg">{entry.mask}</span>
      {!entry.mask && <TypingCaret height={14} style={{ background: "var(--t-fg)" }} />}
    </div>
  );
});

export const VoiceTurn = memo(function VoiceTurn({ entry }: { entry: EntryOf<"voiceTurn"> }) {
  return (
    <div className="flex gap-2 text-tm-fg">
      <span className="text-tm-green">♪</span>
      <span className="[overflow-wrap:anywhere]">{entry.text}</span>
    </div>
  );
});

export function PhotoEntry() {
  return (
    <div className="flex flex-wrap items-start gap-5 py-1.5">
      <div
        className="relative size-56 flex-none overflow-hidden rounded"
        style={{ boxShadow: "0 0 0 1px var(--t-border),0 0 40px var(--t-hl)", animation: "tFade .9s ease-out,tFlicker 4s linear infinite" }}
      >
        <Image src="/profile.png" alt="Nandisha D" fill sizes="224px" className="object-cover opacity-95" style={{ filter: "contrast(1.08) saturate(.85) sepia(.18)" }} />
        <Image
          src="/profile.png"
          alt=""
          fill
          sizes="224px"
          className="object-cover opacity-25"
          style={{ mixBlendMode: "screen", transform: "translateX(1.5px)", filter: "hue-rotate(180deg)" }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 1px,transparent 1px 3px)", animation: "tScan .6s linear infinite" }}
        />
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.55) 100%)" }} />
        <div className="absolute bottom-1.5 left-2 text-[10px] uppercase tracking-[.14em] text-tm-accent" style={{ textShadow: "0 0 6px var(--t-accent)" }}>
          REC ● 576×576
        </div>
      </div>
      <div className="max-w-[44ch] text-[12.5px] leading-[1.6] text-tm-sub">
        <div className="text-tm-muted">--real: decoding profile.jpg → phosphor</div>
        <div>Nandisha D, Bangalore. Same person, fewer characters.</div>
        <div className="mt-1.5 text-tm-dim">!whoami to return to ASCII.</div>
      </div>
    </div>
  );
}
