import type { AnswerPara } from "@/lib/types";

export type Tone = "base" | "sub" | "muted" | "dim" | "accent" | "green" | "red" | "blue" | "violet";
export type Span = { t: string; tone: Tone };
export type Line = Span[];

export type PromptMode = "chat" | "shell" | "slash" | "fit" | "sudo";

export type ThemeName = "default" | "dracula" | "gruvbox" | "nord";

export type DebugInfo = {
  retrieved: string[];
  latencyMs: number;
  tokens: number;
  estimated: boolean;
  offline: boolean;
};

/** `raw` keeps the unparsed stream so a citation marker split across deltas still resolves. */
export type AnswerBody = {
  paras: AnswerPara[];
  raw: string;
  valid: string[];
  streaming: boolean;
};

export type FitMatch = { t: string; n: number; id: string };

export type FitCard = {
  meta: string;
  score: number;
  matches: FitMatch[];
  gaps: string[];
  note: string;
};

export type MessageDraft = { name: string; email: string; text: string };

export type EntryBody =
  | { kind: "cmd"; mode: PromptMode | "voice"; text: string }
  | { kind: "lines"; lines: Line[] }
  | { kind: "prose"; lines: Line[] }
  | { kind: "whoami" }
  | { kind: "photo" }
  | { kind: "ai"; answer: AnswerBody; debug: DebugInfo | null; showDebug: boolean; inlineId: string | null }
  | { kind: "fitPrompt"; status: string }
  | {
      kind: "fit";
      card: FitCard | null;
      noteOpen: boolean;
      noteText: string;
      assessment: AnswerBody | null;
      assessmentError: string;
    }
  | { kind: "book"; url: string; host: string }
  | { kind: "sudo"; mask: string }
  | { kind: "voiceTurn"; text: string };

export type Entry = EntryBody & { id: number };

export type EntryOf<K extends EntryBody["kind"]> = Extract<Entry, { kind: K }>;
