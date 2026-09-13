import type { AttemptOutcome, CodingTask, TestCase } from "./types";
import type { SegmentTone } from "@/components/ui/segmented-progress";
import type { DotTone } from "@/components/ui/indicators";

export type TestSummary =
  | { state: "not-run"; label: string }
  | { state: "failing"; label: string; failing: number }
  | { state: "passing"; label: string };

/** What the test panel's header may claim.
 *
 * Hidden cases are excluded from the count in both directions: a candidate who
 * can read a hidden case's result off the failing tally has not been kept from
 * it. Nothing having run is its own state -- "all passing" for a task nobody
 * has run is the fabrication this round is being rebuilt to remove. */
export function testSummary(tests: TestCase[]): TestSummary {
  const visible = tests.filter((test) => !test.hidden);
  const ran = visible.filter((test) => test.outcome !== undefined);

  if (ran.length === 0) return { state: "not-run", label: "not run" };

  const failing = ran.filter((test) => test.outcome === "fail").length;
  if (failing > 0) return { state: "failing", label: `${failing} failing`, failing };
  return { state: "passing", label: `${ran.length} of ${visible.length} passing` };
}

/** The dot beside one case. A hidden case keeps the same dot before and after a
 * run, which is what makes it hidden. */
export function testDot(test: TestCase): DotTone {
  if (test.hidden || test.outcome === undefined) return "disabled";
  return test.outcome === "pass" ? "success" : "danger";
}

/** The right-hand label beside one case: a duration when it ran and was timed, a
 * verdict when it ran, and otherwise what is true -- that it has not. */
export function testLabel(test: TestCase): string {
  if (test.hidden) return "hidden";
  if (test.outcome === undefined) return "not run";
  if (test.outcome === "fail") return "fail";
  return test.durationMs === undefined ? "pass" : `${test.durationMs}ms`;
}

const ATTEMPT_TONE: Record<AttemptOutcome, SegmentTone> = {
  pass: "success",
  partial: "warning",
  fail: "danger",
  unused: "off",
};

/** The attempts meter, padded to the allowance.
 *
 * Derived rather than read straight off the task, because a task that has never
 * been run carries no outcomes at all and the meter still has to draw. */
export function attemptSegments(task: CodingTask): SegmentTone[] {
  const outcomes = task.attemptOutcomes ?? [];
  return Array.from({ length: task.attemptsAllowed }, (_, index) =>
    ATTEMPT_TONE[outcomes[index] ?? "unused"]
  );
}

export function attemptsUsed(task: CodingTask): number {
  return task.attemptsUsed ?? task.attemptOutcomes?.filter((o) => o !== "unused").length ?? 0;
}
