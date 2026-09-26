import type { EntryBody, Line, Tone } from "./types";

export const L = (t: string, tone: Tone = "base"): Line => [{ t, tone }];
export const LS = (parts: [string, Tone][]): Line => parts.map(([t, tone]) => ({ t, tone }));

export const lines = (arr: (string | Line)[], tone: Tone = "base"): EntryBody => ({
  kind: "lines",
  lines: arr.map((l) => (typeof l === "string" ? L(l, tone) : l)),
});

export const prose = (arr: (string | Line)[], tone: Tone = "base"): EntryBody => ({
  kind: "prose",
  lines: arr.map((l) => (typeof l === "string" ? L(l, tone) : l)),
});

export const err = (t: string): EntryBody => prose([LS([[t, "red"]])]);

export const lineText = (line: Line) => line.map((s) => s.t).join("");
