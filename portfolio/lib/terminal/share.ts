import { numberCitations } from "@/lib/answer/citations";
import { PROMPT_SYMBOL } from "@/lib/commands/parse";
import { lineText } from "./lines";
import type { Entry } from "./types";

const toBase64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/=+$/, "");
const fromBase64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0)));

export function shareableCommands(entries: Entry[]): string[] {
  return entries
    .filter((e): e is Extract<Entry, { kind: "cmd" }> => e.kind === "cmd" && e.mode !== "sudo" && e.mode !== "fit")
    .map((e) => e.text)
    .filter((t) => !/^\/(share|clear|export|tour)/.test(t))
    .slice(-12);
}

export const encodeReplay = (cmds: string[]) => toBase64(JSON.stringify(cmds));

export function decodeReplay(hash: string): string[] | null {
  const m = hash.match(/c=([A-Za-z0-9+/]+)/);
  if (!m) return null;
  try {
    const cmds: unknown = JSON.parse(fromBase64(m[1]));
    if (!Array.isArray(cmds) || !cmds.length) return null;
    return cmds.map(String);
  } catch {
    return null;
  }
}

export function exportMarkdown(entries: Entry[], byId: Record<string, { doc: string; title: string }>, whoami: string) {
  const md = entries
    .map((e) => {
      switch (e.kind) {
        case "cmd":
          return `**${PROMPT_SYMBOL[e.mode]} ${e.text}**`;
        case "ai": {
          const { order, paras } = numberCitations(e.answer.paras);
          const body = paras.map((p) => p.map((s) => (s.kind === "cite" ? `[${s.n}]` : s.t)).join("")).join("\n\n");
          const refs = order.map((id, i) => `[${i + 1}] ${byId[id]?.doc ?? id} › ${byId[id]?.title ?? ""}`).join("\n");
          return body + "\n\n" + refs;
        }
        case "lines":
        case "prose":
          return "```\n" + e.lines.map(lineText).join("\n") + "\n```";
        case "whoami":
          return whoami;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
  return "# Conversation with nandisha@portfolio\n\n" + md;
}

