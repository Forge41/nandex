export type RetrievedSource = { id: string; doc: string; title: string };

export type PortfolioEvent =
  | { type: "retrieved"; sources: RetrievedSource[] }
  | { type: "delta"; text: string }
  | { type: "done"; latencyMs: number; outputTokens: number }
  | { type: "error"; detail: string; fallback: boolean };

/** Incremental `text/event-stream` framing: feed decoded chunks as they arrive and
 * get back each complete event's `data` payload. */
export function createSSEParser() {
  let buffer = "";
  const drain = (final: boolean) => {
    const out: string[] = [];
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = final ? "" : (blocks.pop() ?? "");
    for (const block of blocks) {
      const data = block
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).replace(/^ /, ""));
      if (data.length) out.push(data.join("\n"));
    }
    return out;
  };
  return {
    push(chunk: string) {
      buffer += chunk;
      return drain(false);
    },
    flush() {
      return drain(true);
    },
  };
}

export function parseEvent(data: string): PortfolioEvent | null {
  let v: unknown;
  try {
    v = JSON.parse(data);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (Array.isArray(o.retrieved)) {
    const sources = o.retrieved.filter(
      (s): s is RetrievedSource => !!s && typeof s === "object" && typeof (s as RetrievedSource).id === "string",
    );
    return { type: "retrieved", sources };
  }
  if (typeof o.delta === "string") return { type: "delta", text: o.delta };
  if (typeof o.error === "string") return { type: "error", detail: o.error, fallback: o.fallback === true };
  if (o.done === true)
    return {
      type: "done",
      latencyMs: typeof o.latency_ms === "number" ? o.latency_ms : 0,
      outputTokens: typeof o.output_tokens === "number" ? o.output_tokens : 0,
    };
  return null;
}
