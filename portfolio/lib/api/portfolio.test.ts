import { describe, expect, it } from "vitest";

import { PortfolioApiError, sendMessage, streamPortfolio, type PortfolioEvent } from "./portfolio";

const sse = (chunks: string[], status = 200) =>
  (async () =>
    new Response(
      new ReadableStream({
        start(c) {
          chunks.forEach((s) => c.enqueue(new TextEncoder().encode(s)));
          c.close();
        },
      }),
      { status, headers: { "content-type": "text/event-stream" } },
    )) as unknown as typeof fetch;

describe("streamPortfolio", () => {
  it("delivers events in order and resolves on done", async () => {
    const events: PortfolioEvent[] = [];
    await streamPortfolio("ask", { question: "q" }, {
      onEvent: (e) => events.push(e),
      fetchImpl: sse(['data: {"retrieved":[]}\n\ndata: {"delta":"a"}\n\n', 'data: {"done":true,"latency_ms":5,"output_tokens":1}\n\n']),
    });
    expect(events.map((e) => e.type)).toEqual(["retrieved", "delta", "done"]);
  });

  it("rejects with fallback on an error event", async () => {
    const run = streamPortfolio("ask", { question: "q" }, {
      onEvent: () => undefined,
      fetchImpl: sse(['data: {"delta":"a"}\n\n', 'data: {"error":"The answer was cut off.","fallback":true}\n\n']),
    });
    await expect(run).rejects.toMatchObject({ name: "PortfolioApiError", fallback: true, message: "The answer was cut off." });
  });

  it("rejects when the stream closes without done", async () => {
    const run = streamPortfolio("ask", { question: "q" }, { onEvent: () => undefined, fetchImpl: sse(['data: {"delta":"a"}\n\n']) });
    await expect(run).rejects.toBeInstanceOf(PortfolioApiError);
  });

  it("surfaces the JSON detail of a non-2xx response", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ detail: "slow down", fallback: true }), { status: 429 })) as unknown as typeof fetch;
    await expect(streamPortfolio("fit", { jd: "x" }, { onEvent: () => undefined, fetchImpl })).rejects.toMatchObject({
      status: 429,
      message: "slow down",
      fallback: true,
    });
  });

  it("times out waiting for the first event", async () => {
    const fetchImpl = ((_: string, init: RequestInit) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as unknown as typeof fetch;
    await expect(
      streamPortfolio("ask", { question: "q" }, { onEvent: () => undefined, fetchImpl, firstEventTimeoutMs: 10 }),
    ).rejects.toMatchObject({ message: "timed out", fallback: true });
  });
});

describe("sendMessage", () => {
  it("maps 201 to ok and 400 to its detail", async () => {
    const ok = (async () => new Response(JSON.stringify({ ok: true }), { status: 201 })) as unknown as typeof fetch;
    expect(await sendMessage({ name: "", email: "a@b.co", text: "hi" }, ok)).toEqual({ ok: true });
    const bad = (async () => new Response(JSON.stringify({ detail: "invalid email" }), { status: 400 })) as unknown as typeof fetch;
    expect(await sendMessage({ name: "", email: "x", text: "hi" }, bad)).toEqual({ ok: false, status: 400, detail: "invalid email" });
  });
});
