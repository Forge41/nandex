import { describe, expect, it } from "vitest";

import { createSSEParser, parseEvent } from "./sse";

describe("createSSEParser", () => {
  it("emits complete events and buffers partial ones across chunks", () => {
    const p = createSSEParser();
    expect(p.push('data: {"delta":"Hel')).toEqual([]);
    expect(p.push('lo"}\n\ndata: {"delta":"!"}\n')).toEqual(['{"delta":"Hello"}']);
    expect(p.push("\n")).toEqual(['{"delta":"!"}']);
  });

  it("handles CRLF, comments and multi-line data", () => {
    const p = createSSEParser();
    expect(p.push(": keepalive\r\n\r\ndata: a\r\ndata: b\r\n\r\n")).toEqual(["a\nb"]);
  });

  it("flushes a trailing event without a blank line", () => {
    const p = createSSEParser();
    p.push('data: {"done":true}');
    expect(p.flush()).toEqual(['{"done":true}']);
  });
});

describe("parseEvent", () => {
  it("parses each contract event", () => {
    expect(parseEvent('{"retrieved":[{"id":"resume-sde2","doc":"resume.pdf","title":"SDE-II"}]}')).toEqual({
      type: "retrieved",
      sources: [{ id: "resume-sde2", doc: "resume.pdf", title: "SDE-II" }],
    });
    expect(parseEvent('{"delta":"text[resume-sde2]"}')).toEqual({ type: "delta", text: "text[resume-sde2]" });
    expect(parseEvent('{"done":true,"latency_ms":812,"output_tokens":143}')).toEqual({
      type: "done",
      latencyMs: 812,
      outputTokens: 143,
    });
    expect(parseEvent('{"error":"The answer was cut off.","fallback":true}')).toEqual({
      type: "error",
      detail: "The answer was cut off.",
      fallback: true,
    });
  });

  it("ignores malformed payloads", () => {
    expect(parseEvent("not json")).toBeNull();
    expect(parseEvent('{"unknown":1}')).toBeNull();
    expect(parseEvent('{"retrieved":[{"doc":"x"}]}')).toEqual({ type: "retrieved", sources: [] });
  });
});
