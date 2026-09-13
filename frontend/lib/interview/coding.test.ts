import { describe, expect, it } from "vitest";
import { attemptSegments, testDot, testLabel, testSummary } from "./coding";
import type { TestCase } from "./types";

function test_(name: string, over: Partial<TestCase> = {}): TestCase {
  return { name, hidden: false, ...over };
}

function attempts(over: Partial<{ attemptsAllowed: number; attemptOutcomes: ("pass" | "partial" | "fail" | "unused")[] }> = {}) {
  return { attemptsAllowed: 3, attemptsUsed: 0, ...over };
}

describe("testSummary", () => {
  it("says nothing ran rather than claiming everything passed", () => {
    const summary = testSummary([test_("single_transfer"), test_("exact_duplicate")]);

    expect(summary.state).toBe("not-run");
    expect(summary.label).toBe("not run");
  });

  it("counts only the cases that actually reported", () => {
    const summary = testSummary([
      test_("a", { outcome: "pass" }),
      test_("b", { outcome: "fail" }),
      test_("c"),
    ]);

    expect(summary).toMatchObject({ state: "failing", failing: 1 });
  });

  it("leaves a hidden failure out of the failing count", () => {
    // Otherwise the badge going from "not run" to "1 failing" tells the
    // candidate exactly what the hidden case did.
    const summary = testSummary([
      test_("visible", { outcome: "pass" }),
      test_("2m_events_memory", { hidden: true, outcome: "fail" }),
    ]);

    expect(summary.state).toBe("passing");
  });

  it("stays not-run when only hidden cases have reported", () => {
    const summary = testSummary([
      test_("visible"),
      test_("secret", { hidden: true, outcome: "pass" }),
    ]);

    expect(summary.state).toBe("not-run");
  });

  it("counts passing against the visible cases, not the hidden ones", () => {
    const summary = testSummary([
      test_("a", { outcome: "pass" }),
      test_("b", { outcome: "pass" }),
      test_("hidden_one", { hidden: true }),
    ]);

    expect(summary.label).toBe("2 of 2 passing");
  });
});

describe("a hidden case reads the same before and after a run", () => {
  const before = test_("2m_events_memory", { hidden: true });
  const after = test_("2m_events_memory", { hidden: true, outcome: "fail", durationMs: 91 });

  it("keeps the same dot", () => {
    expect(testDot(after)).toBe(testDot(before));
  });

  it("keeps the same label", () => {
    expect(testLabel(after)).toBe("hidden");
    expect(testLabel(before)).toBe("hidden");
  });
});

describe("testLabel", () => {
  it("says not run when nothing ran", () => {
    expect(testLabel(test_("a"))).toBe("not run");
  });

  it("shows a duration only when the run reported one", () => {
    expect(testLabel(test_("a", { outcome: "pass", durationMs: 2 }))).toBe("2ms");
    expect(testLabel(test_("a", { outcome: "pass" }))).toBe("pass");
  });
});

describe("attempts", () => {
  it("draws an empty meter for a task nobody has run", () => {
    expect(attemptSegments(attempts())).toEqual(["off", "off", "off"]);
  });

  it("fills a partial run in warning, between a pass and a failure", () => {
    const segments = attemptSegments(attempts({ attemptOutcomes: ["fail", "partial", "pass"] }));

    expect(segments).toEqual(["danger", "warning", "success"]);
  });

  it("pads to the allowance when fewer attempts were taken", () => {
    expect(attemptSegments(attempts({ attemptOutcomes: ["partial"] }))).toEqual([
      "warning",
      "off",
      "off",
    ]);
  });

  it("never draws more segments than the allowance", () => {
    expect(
      attemptSegments(attempts({ attemptsAllowed: 2, attemptOutcomes: ["fail", "pass", "pass"] }))
    ).toHaveLength(2);
  });
});
