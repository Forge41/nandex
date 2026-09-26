import { SHELL_COMMANDS, SLASH_COMMANDS } from "@/lib/commands/registry";
import type { InputFlags } from "@/lib/commands/parse";
import { SUGGESTIONS } from "./constants";

export type AcItem = { name: string; desc: string; fill: string };

export function acItems(input: string, flags: InputFlags): AcItem[] {
  if (flags.fitPending || flags.sudoPending) return [];
  if (!(input.startsWith("!") || input.startsWith("/"))) return [];
  const list = input[0] === "!" ? SHELL_COMMANDS : SLASH_COMMANDS;
  const q = input.slice(1).toLowerCase();
  return list
    .filter(([c]) => c.toLowerCase().startsWith(q) || (q && c.toLowerCase().includes(q)))
    .map(([c, desc]) => ({ name: input[0] + c, desc, fill: input[0] + c.replace(/<[^>]+>/g, "").replace(/\s+$/, "") }));
}

export const needsArg = (item: AcItem) => /<[^>]+>/.test(item.name);

export type SuggestState = { history: string[]; commands: string[]; sugSeed: number };

export function suggest({ history, commands, sugSeed }: SuggestState): string[] {
  const seen = new Set(history);
  const used = commands.map((c) => c.toLowerCase());
  const pool = SUGGESTIONS.filter((x) => !seen.has(x) && !used.includes(x.toLowerCase()));
  const out: string[] = [];
  for (let i = 0; i < Math.min(3, pool.length); i++) {
    const p = pool[(sugSeed * 7 + i * 5) % pool.length];
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

export function ghost(state: SuggestState & InputFlags & { landing: boolean }): string {
  if (state.fitPending || state.sudoPending) return "";
  if (state.landing) return "/voice";
  return suggest(state)[0] ?? "";
}
