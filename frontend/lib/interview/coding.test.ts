import { describe, expect, it } from "vitest";
import { attemptSegments, attemptsUsed, testDot, testLabel, testSummary } from "./coding";
import type { CodingTask, TestCase } from "./types";

function test_(name: string, over: Partial<TestCase> = {}): TestCase {
  return { name, hidden: false, ...over };
}

function task(over: Partial<CodingTask> = {}): CodingTask {
  return {
    index: 1,
    total: 1,
    title: "Retry-safe applier",
    difficulty: "gold",
    difficultyLabel: "Medium",
    brief: [],
    example: "",
    constraints: [],
    attemptsAllowed: 3,
    files: [],
    languages: ["python"],
    tests: [],
    complexity: [],
    ...over,
  };
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
    expect(attemptSegments(task())).toEqual(["off", "off", "off"]);
    expect(attemptsUsed(task())).toBe(0);
  });

  it("fills a partial run in warning, between a pass and a failure", () => {
    const segments = attemptSegments(task({ attemptOutcomes: ["fail", "partial", "pass"] }));

    expect(segments).toEqual(["danger", "warning", "success"]);
  });

  it("pads to the allowance when fewer attempts were taken", () => {
    expect(attemptSegments(task({ attemptOutcomes: ["partial"] }))).toEqual([
      "warning",
      "off",
      "off",
    ]);
  });

  it("derives the count from the outcomes when the server sent no total", () => {
    expect(attemptsUsed(task({ attemptOutcomes: ["fail", "partial", "unused"] }))).toBe(2);
  });
});
