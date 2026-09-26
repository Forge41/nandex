import type { PromptMode } from "@/lib/terminal/types";

export type ParsedInput =
  | { kind: "sudo" }
  | { kind: "fit"; text: string }
  | { kind: "shell"; text: string; cmd: string }
  | { kind: "slash"; text: string; name: string; arg: string }
  | { kind: "chat"; text: string };

export type InputFlags = { fitPending: boolean; sudoPending: boolean };

export function parseInput(text: string, flags: InputFlags): ParsedInput {
  if (flags.sudoPending) return { kind: "sudo" };
  if (flags.fitPending) return { kind: "fit", text };
  if (text.startsWith("!")) return { kind: "shell", text, cmd: normalizeShell(text.slice(1)) };
  if (text.startsWith("/")) {
    const [name = "", ...rest] = text.slice(1).trim().split(" ");
    return { kind: "slash", text, name, arg: rest.join(" ").trim() };
  }
  return { kind: "chat", text };
}

export const normalizeShell = (cmd: string) => cmd.trim().replace(/\s+/g, " ");

export function modeOf(input: string, flags: InputFlags): PromptMode {
  if (flags.fitPending) return "fit";
  if (flags.sudoPending) return "sudo";
  if (input.startsWith("!")) return "shell";
  if (input.startsWith("/")) return "slash";
  return "chat";
}

export const PROMPT_SYMBOL: Record<PromptMode | "voice", string> = {
  shell: "$",
  slash: "/",
  chat: ">",
  fit: "jd>",
  sudo: "#",
  voice: "♪",
};

export const PROMPT_COLOR: Record<PromptMode | "voice", string> = {
  shell: "var(--t-accent)",
  slash: "var(--t-violet)",
  chat: "var(--t-green)",
  fit: "var(--t-blue)",
  sudo: "var(--t-red)",
  voice: "var(--t-green)",
};
