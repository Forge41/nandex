import { describe, expect, it } from "vitest";

import { numberCitations, parseAnswer } from "./citations";

const valid = ["resume-sde2", "resume-intern", "summary-nandex"];

describe("parseAnswer", () => {
  it("turns valid markers into citations and drops unknown ids", () => {
    expect(parseAnswer("Hybrid retrieval[resume-sde2]. Made up [resume-fake].", valid)).toEqual([
      [{ t: "Hybrid retrieval" }, { c: "resume-sde2" }, { t: ". Made up" }, { t: "." }],
    ]);
  });

  it("keeps the valid ids of a grouped marker", () => {
    expect(parseAnswer("Both [resume-sde2, nope, resume-intern].", valid)).toEqual([
      [{ t: "Both" }, { c: "resume-sde2" }, { c: "resume-intern" }, { t: "." }],
    ]);
  });

  it("splits paragraphs and marks inline code", () => {
    expect(parseAnswer("Run `/book`.\n\nSecond[summary-nandex].", valid)).toEqual([
      [{ t: "Run " }, { t: "/book", code: true }, { t: "." }],
      [{ t: "Second" }, { c: "summary-nandex" }, { t: "." }],
    ]);
  });

  it("hides an unterminated marker while streaming", () => {
    expect(parseAnswer("LiveKit[resume-int", valid, true)).toEqual([[{ t: "LiveKit" }]]);
    expect(parseAnswer("LiveKit[resume-int", valid, false)).toEqual([[{ t: "LiveKit[resume-int" }]]);
  });

  it("resolves a marker split across deltas once the buffer completes it", () => {
    const deltas = ["LiveKit[", "resume", "-intern", "]."];
    let raw = "";
    const frames = deltas.map((d) => parseAnswer((raw += d), valid, true));
    expect(frames[1]).toEqual([[{ t: "LiveKit" }]]);
    expect(frames[3]).toEqual([[{ t: "LiveKit" }, { c: "resume-intern" }, { t: "." }]]);
  });
});

describe("numberCitations", () => {
  it("numbers by first appearance and reuses numbers", () => {
    const { order, paras } = numberCitations([
      [{ t: "a" }, { c: "resume-sde2" }, { c: "resume-intern" }],
      [{ t: "b" }, { c: "resume-sde2" }, { t: "c", code: true }],
    ]);
    expect(order).toEqual(["resume-sde2", "resume-intern"]);
    expect(paras[0][1]).toEqual({ kind: "cite", id: "resume-sde2", n: 1 });
    expect(paras[0][2]).toEqual({ kind: "cite", id: "resume-intern", n: 2 });
    expect(paras[1][1]).toEqual({ kind: "cite", id: "resume-sde2", n: 1 });
    expect(paras[1][2]).toEqual({ kind: "code", t: "c" });
  });
});
