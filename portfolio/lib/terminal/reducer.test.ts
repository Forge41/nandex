import { describe, expect, it } from "vitest";

import { emptyAnswer, initialState, terminalReducer as r, type TerminalState } from "./reducer";

const withAi = (): TerminalState =>
  r(r(initialState, { type: "PUSH", id: 1, entry: { kind: "ai", answer: emptyAnswer(), debug: null, showDebug: false, inlineId: null } }), {
    type: "STREAMING",
    id: 1,
  });

describe("terminalReducer", () => {
  it("records submitted input once, most recent last", () => {
    let s = r(initialState, { type: "SUBMITTED", text: "a", silent: false });
    s = r(s, { type: "SUBMITTED", text: "b", silent: false });
    s = r(s, { type: "SUBMITTED", text: "a", silent: false });
    s = r(s, { type: "SUBMITTED", text: "tour", silent: true });
    expect(s.history).toEqual(["b", "a"]);
    expect(s.landing).toBe(false);
    expect(s.input).toBe("");
  });

  it("walks history up and back down to an empty prompt", () => {
    let s: TerminalState = { ...initialState, history: ["one", "two"] };
    s = r(s, { type: "HISTORY", dir: -1 });
    expect(s.input).toBe("two");
    s = r(s, { type: "HISTORY", dir: -1 });
    s = r(s, { type: "HISTORY", dir: -1 });
    expect(s.input).toBe("one");
    s = r(s, { type: "HISTORY", dir: 1 });
    s = r(s, { type: "HISTORY", dir: 1 });
    expect(s).toMatchObject({ input: "", histIdx: -1 });
  });

  it("wraps the autocomplete cursor", () => {
    const s = r(initialState, { type: "AC_MOVE", delta: -1, count: 3 });
    expect(s.acIdx).toBe(2);
    expect(r(s, { type: "AC_MOVE", delta: 1, count: 3 }).acIdx).toBe(0);
  });

  it("streams deltas into an answer and resolves citations on end", () => {
    let s = withAi();
    s = r(s, { type: "STREAM_RETRIEVED", id: 1, target: "answer", valid: ["resume-intern"] });
    for (const delta of ["LiveKit[", "resume", "-intern", "]."]) s = r(s, { type: "STREAM_DELTA", id: 1, target: "answer", delta });
    s = r(s, { type: "STREAM_END", id: 1, target: "answer" });
    const e = s.entries[0];
    expect(e.kind === "ai" && e.answer).toMatchObject({
      streaming: false,
      paras: [[{ t: "LiveKit" }, { c: "resume-intern" }, { t: "." }]],
    });
    expect(s.streamingId).toBeNull();
  });

  it("replaces a failed stream with a fallback answer", () => {
    let s = r(withAi(), { type: "STREAM_DELTA", id: 1, target: "answer", delta: "partial" });
    s = r(s, { type: "STREAM_REPLACE", id: 1, answer: { paras: [[{ t: "local" }]], raw: "", valid: [], streaming: false }, debug: null });
    const e = s.entries[0];
    expect(e.kind === "ai" && e.answer.paras).toEqual([[{ t: "local" }]]);
    expect(s.streamingId).toBeNull();
  });

  it("collapses the info pane for voice and restores it after", () => {
    let s = r({ ...initialState, viewerId: "resume-sde2" }, { type: "VOICE", on: true });
    expect(s).toMatchObject({ voice: true, infoCollapsed: true, viewerId: null });
    s = r(s, { type: "VOICE", on: false });
    expect(s).toMatchObject({ voice: false, infoCollapsed: false });
  });

  it("masks the sudo prompt when done", () => {
    let s = r(initialState, { type: "SUDO_START", id: 4 });
    expect(s.sudoPending).toBe(true);
    s = r(s, { type: "SUDO_DONE" });
    expect(s.entries[0]).toEqual({ id: 4, kind: "sudo", mask: "••••••••" });
    expect(s.sudoPending).toBe(false);
  });

  it("updates the fit prompt status while pending", () => {
    let s = r(initialState, { type: "PUSH", id: 2, entry: { kind: "fitPrompt", status: "idle" } });
    s = r(s, { type: "FIT_PROMPT", id: 2 });
    s = r(s, { type: "FIT_PENDING", on: true, status: "waiting…" });
    expect(s.entries[0]).toMatchObject({ status: "waiting…" });
    expect(s.statusMsg).toMatch(/paste the job description/);
  });

  it("bumps counters on their tick cadence", () => {
    let s = initialState;
    for (let i = 0; i < 14; i++) s = r(s, { type: "TICK" });
    expect(s).toMatchObject({ prCount: 1081, skillCount: 601, sugSeed: 2 });
  });
});
