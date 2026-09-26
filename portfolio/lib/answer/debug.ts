import type { DebugInfo } from "@/lib/terminal/types";

export function formatDebug(d: DebugInfo): string {
  const tokens = d.estimated ? `~${d.tokens}` : String(d.tokens);
  const tail = d.offline ? "retrieval=local(keyword) · offline" : "retrieval=hybrid(bm25+dense)";
  return `retrieved: ${d.retrieved.join(", ") || "—"}\nlatency: ${d.latencyMs} ms · ${tokens} tokens · ${tail}`;
}
