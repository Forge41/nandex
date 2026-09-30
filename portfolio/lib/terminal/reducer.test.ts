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
    let s = r({ ...initialState, infoCollapsed: false, viewerId: "resume-sde2" }, { type: "VOICE", on: true });
    expect(s).toMatchObject({ voice: true, infoCollapsed: true, viewerId: null });
    s = r(s, { type: "VOICE", on: false });
    expect(s).toMatchObject({ voice: false, infoCollapsed: false });
  });

  it("clears the drawer and sheet when voice takes the screen", () => {
    const open = { ...initialState, drawer: { kind: "role" as const, id: "sde2" }, resumeSheet: true };
    expect(r(open, { type: "VOICE", on: true })).toMatchObject({ drawer: null, resumeSheet: false });
  });

  it("switches résumé tab without disturbing the conversation", () => {
    let s = r(initialState, { type: "PUSH", id: 1, entry: { kind: "prose", lines: [] } });
    s = r(s, { type: "SUBMITTED", text: "hi", silent: false });
    const before = s.entries;
    s = r(s, { type: "RESUME_TAB", tab: "projects" });
    expect(s.resumeTab).toBe("projects");
    expect(s.entries).toBe(before);
    expect(s.landing).toBe(false);
  });

  it("opens the sheet only when a tab switch asks for it", () => {
    expect(r(initialState, { type: "RESUME_TAB", tab: "stack" }).resumeSheet).toBe(false);
    expect(r(initialState, { type: "RESUME_TAB", tab: "stack", sheet: true }).resumeSheet).toBe(true);
  });

  it("keeps chat state when a drawer opens and closes", () => {
    let s = r(initialState, { type: "SUBMITTED", text: "what is nantex?", silent: false });
    s = r(s, { type: "DRAWER", target: { kind: "project", id: "nantex" } });
    expect(s.drawer).toEqual({ kind: "project", id: "nantex" });
    expect(s.history).toEqual(["what is nantex?"]);
    s = r(s, { type: "DRAWER", target: null });
    expect(s.drawer).toBeNull();
    expect(s.history).toEqual(["what is nantex?"]);
  });

  it("closes the sheet on submit so the answer is visible", () => {
    const s = r({ ...initialState, resumeSheet: true }, { type: "SUBMITTED", text: "hi", silent: false });
    expect(s.resumeSheet).toBe(false);
  });

  it("pings the hero without touching the entries", () => {
    let s = r(initialState, { type: "PUSH", id: 1, entry: { kind: "prose", lines: [] } });
    const before = s.entries;
    s = r(s, { type: "HERO_PING" });
    expect(s.heroPing).toBe(1);
    expect(s.entries).toBe(before);
  });

  it("starts with the info pane collapsed to the rail", () => {
    expect(initialState.infoCollapsed).toBe(true);
    expect(r(initialState, { type: "TOGGLE_INFO" }).infoCollapsed).toBe(false);
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

  it("rotates suggestions on the tick", () => {
    let s = initialState;
    for (let i = 0; i < 14; i++) s = r(s, { type: "TICK" });
    expect(s.sugSeed).toBe(2);
  });
});
