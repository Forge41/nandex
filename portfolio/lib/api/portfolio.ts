import { parseToken, type TokenResult } from "@/lib/voice/plan";

import { createSSEParser, parseEvent, type PortfolioEvent } from "./sse";

export type { PortfolioEvent, RetrievedSource } from "./sse";

export class PortfolioApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly fallback: boolean,
  ) {
    super(message);
    this.name = "PortfolioApiError";
  }
}

type StreamOptions = {
  signal?: AbortSignal;
  onEvent: (event: PortfolioEvent) => void;
  firstEventTimeoutMs?: number;
  idleTimeoutMs?: number;
  fetchImpl?: typeof fetch;
};

async function readDetail(res: Response) {
  try {
    const body = (await res.json()) as { detail?: unknown; fallback?: unknown };
    return { detail: typeof body.detail === "string" ? body.detail : `HTTP ${res.status}`, fallback: body.fallback === true };
  } catch {
    return { detail: `HTTP ${res.status}`, fallback: true };
  }
}

/** Resolves on `done`; every other ending (HTTP error, `error` event, timeout,
 * stream closed early) rejects with a PortfolioApiError so callers have one
 * fallback path. */
export async function streamPortfolio(
  path: "ask" | "fit",
  body: Record<string, string>,
  { signal, onEvent, firstEventTimeoutMs = 12000, idleTimeoutMs = 30000, fetchImpl = fetch }: StreamOptions,
): Promise<void> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  let timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, firstEventTimeoutMs);
  const rearm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, idleTimeoutMs);
  };

  try {
    const res = await fetchImpl(`/api/portfolio/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      const { detail, fallback } = await readDetail(res);
      throw new PortfolioApiError(detail, res.status, fallback);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parser = createSSEParser();
    const handle = (payloads: string[]) => {
      for (const data of payloads) {
        const event = parseEvent(data);
        if (!event) continue;
        rearm();
        if (event.type === "error") throw new PortfolioApiError(event.detail, res.status, event.fallback);
        onEvent(event);
        if (event.type === "done") return true;
      }
      return false;
    };

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (handle(parser.push(decoder.decode(value, { stream: true })))) {
        await reader.cancel().catch(() => undefined);
        return;
      }
    }
    if (handle(parser.push(decoder.decode()).concat(parser.flush()))) return;
    throw new PortfolioApiError("stream ended before done", res.status, true);
  } catch (e) {
    if (e instanceof PortfolioApiError) throw e;
    if (timedOut) throw new PortfolioApiError("timed out", null, true);
    if (signal?.aborted) throw e;
    throw new PortfolioApiError(e instanceof Error ? e.message : "network error", null, true);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    controller.abort();
  }
}

export type MessageResult = { ok: true } | { ok: false; status: number | null; detail: string };

export async function sendMessage(
  payload: { name: string; email: string; text: string },
  fetchImpl: typeof fetch = fetch,
): Promise<MessageResult> {
  try {
    const res = await fetchImpl("/api/portfolio/message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 201 || res.ok) return { ok: true };
    const { detail } = await readDetail(res);
    return { ok: false, status: res.status, detail };
  } catch (e) {
    return { ok: false, status: null, detail: e instanceof Error ? e.message : "network error" };
  }
}

export async function pingHealth(fetchImpl: typeof fetch = fetch, timeoutMs = 60000): Promise<boolean> {
  try {
    const res = await fetchImpl("/api/health", { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function requestVoiceToken(fetchImpl: typeof fetch = fetch): Promise<TokenResult> {
  try {
    const res = await fetchImpl("/api/portfolio/voice/token", { method: "POST", signal: AbortSignal.timeout(15000) });
    if (res.status !== 201) {
      const { detail } = await readDetail(res);
      return { ok: false, status: res.status, detail };
    }
    const token = parseToken(await res.json().catch(() => null));
    return token ? { ok: true, token } : { ok: false, status: res.status, detail: "malformed voice token" };
  } catch {
    return { ok: false, status: null, detail: "voice service unreachable" };
  }
}
