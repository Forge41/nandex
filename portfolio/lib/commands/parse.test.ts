import { describe, expect, it } from "vitest";

import { modeOf, normalizeShell, parseInput } from "./parse";

const idle = { fitPending: false, sudoPending: false };

describe("parseInput", () => {
  it("routes by prefix", () => {
    expect(parseInput("!ls   projects/", idle)).toEqual({ kind: "shell", text: "!ls   projects/", cmd: "ls projects/" });
    expect(parseInput("/theme nord", idle)).toEqual({ kind: "slash", text: "/theme nord", name: "theme", arg: "nord" });
    expect(parseInput("/fit  some jd text ", idle)).toMatchObject({ name: "fit", arg: "some jd text" });
    expect(parseInput("what is nandex?", idle)).toEqual({ kind: "chat", text: "what is nandex?" });
  });

  it("pending prompts win over prefixes", () => {
    expect(parseInput("!ls", { fitPending: false, sudoPending: true })).toEqual({ kind: "sudo" });
    expect(parseInput("/help", { fitPending: true, sudoPending: false })).toEqual({ kind: "fit", text: "/help" });
  });

  it("derives the prompt mode", () => {
    expect(modeOf("!x", idle)).toBe("shell");
    expect(modeOf("/x", idle)).toBe("slash");
    expect(modeOf("x", idle)).toBe("chat");
    expect(modeOf("x", { fitPending: true, sudoPending: false })).toBe("fit");
  });

  it("collapses whitespace in shell commands", () => {
    expect(normalizeShell("  git   log  --author=nandisha ")).toBe("git log --author=nandisha");
  });
});
