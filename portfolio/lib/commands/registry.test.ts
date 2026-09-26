import { describe, expect, it } from "vitest";

import { loadSources, orderSources } from "@/lib/content";
import { lineText } from "@/lib/terminal/lines";
import type { EntryBody } from "@/lib/terminal/types";
import { PRIVACY_NOTE, runShell, runSlash, type CommandContext, type Effect } from "./registry";

const sources = orderSources(loadSources());
const ctx: CommandContext = {
  sources,
  byId: Object.fromEntries(sources.map((s) => [s.id, s])),
  theme: "default",
  verbose: false,
  now: new Date("2026-09-26T10:00:00Z").getTime(),
  clock: "15:30",
  bookingUrl: "",
};

const text = (effects: Effect[]) =>
  effects
    .flatMap((e) => (e.type === "push" || e.type === "later" ? [e.entry] : []))
    .flatMap((entry: EntryBody) => ("lines" in entry ? entry.lines.map(lineText) : []));

describe("runShell", () => {
  it("lists projects", () => {
    const out = text(runShell("ls projects/", ctx));
    expect(out[0]).toMatch(/^harvey-rag\s+\.md {2}Document-grounded/);
    expect(out).toHaveLength(7);
  });

  it("cats a project with its source", () => {
    const out = text(runShell("cat projects/nandex.md", ctx));
    expect(out[0]).toBe("# nandex  (2025)");
    expect(out.at(-1)).toMatch(/^source: summary\.md › /);
    expect(text(runShell("cat projects/nope.md", ctx))).toEqual(["cat: projects/nope.md: No such file"]);
  });

  it("greps sources and highlights the match", () => {
    const [effect] = runShell("grep livekit -r ~/", ctx);
    expect(effect.type).toBe("push");
    const entry = (effect as Extract<Effect, { type: "push" }>).entry;
    expect(entry.kind).toBe("prose");
    if (entry.kind !== "prose") return;
    expect(entry.lines.length).toBeGreaterThan(0);
    expect(entry.lines[0][2]).toEqual({ t: "LiveKit", tone: "accent" });
  });

  it("asks for the sudo password and opens the résumé on wget", () => {
    expect(runShell("sudo hire nandisha", ctx)).toEqual([{ type: "sudo" }]);
    expect(runShell("wget resume.pdf", ctx)[0]).toEqual({ type: "openUrl", url: "/resume.pdf" });
  });

  it("staggers rm -rf and falls through to command not found", () => {
    const rm = runShell("rm -rf /", ctx);
    expect(rm.map((e) => (e.type === "later" ? e.ms : -1))).toEqual([0, 260, 520, 780, 1040]);
    expect(text(runShell("vim", ctx))[0]).toBe("command not found: vim. Try asking me in plain English instead.");
  });

  it("prints uptime from the clock", () => {
    expect(text(runShell("uptime", ctx))[0]).toMatch(/^ 15:30 {2}up 2 years, \d+ days/);
  });
});

describe("runSlash", () => {
  it("includes the privacy note in help", () => {
    expect(text(runSlash("help", "", ctx))).toContain(PRIVACY_NOTE);
  });

  it("switches themes and rejects unknown ones", () => {
    expect(runSlash("theme", "nord", ctx)[0]).toEqual({ type: "theme", name: "nord" });
    expect(text(runSlash("theme", "solarized", ctx))).toEqual(['/theme: unknown theme "solarized"']);
  });

  it("toggles verbose against the current value", () => {
    expect(runSlash("verbose", "", ctx)[0]).toEqual({ type: "verbose", on: true });
    expect(runSlash("verbose", "", { ...ctx, verbose: true })[0]).toEqual({ type: "verbose", on: false });
  });

  it("routes /book to the message form without a calendar", () => {
    const kinds = runSlash("book", "", ctx).map((e) => (e.type === "push" ? e.entry.kind : e.type));
    expect(kinds).toEqual(["prose", "form"]);
    const withCal = runSlash("book", "", { ...ctx, bookingUrl: "https://cal.com/nandisha/30min" });
    expect(withCal).toEqual([{ type: "push", entry: { kind: "book", url: "https://cal.com/nandisha/30min", host: "cal.com" } }]);
  });

  it("opens the fit prompt or analyses inline text", () => {
    expect(runSlash("fit", "", ctx)).toEqual([{ type: "fitPrompt" }]);
    expect(runSlash("fit", "python jd", ctx)).toEqual([{ type: "fit", jd: "python jd" }]);
  });

  it("counts sources per document", () => {
    const out = text(runSlash("sources", "", ctx));
    expect(out[0]).toBe("resume.pdf   9 sections · Nandisha D, Sep 2026");
    expect(out[1]).toBe("summary.md   2 sections · about + open-source notes");
  });
  it("opens nandex's interview room on /interview", () => {
    const fx = runSlash("interview", "", ctx);
    expect(fx).toContainEqual({ type: "openUrl", url: "https://nandex.netlify.app/" });
    expect(text(fx).join(" ")).toContain("https://nandex.netlify.app/");
  });

  it("restarts from the loading screen on /reload", () => {
    expect(runSlash("reload", "", ctx)).toEqual([{ type: "reload" }]);
  });
});
