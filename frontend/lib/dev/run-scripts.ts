import type { RunTransport } from "@/lib/api/coding";
import type { RunResult } from "@/lib/api/coding";
import type { TerminalLine, TestCase } from "@/lib/interview/types";

/** A run that never happened, played back at the speed one would arrive.
 *
 * Timed rather than instant because the states worth looking at here are ordered in
 * time -- a case passing before the next one fails, a compile error arriving with no
 * cases at all -- and a transport that resolved at once would render only the end of
 * each one. */
export interface RunScript {
  lines?: TerminalLine[];
  tests?: TestCase[];
  rows?: string;
  done: RunResult;
}

const LINE_MS = 90;
const TEST_MS = 160;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function scriptedRun(script: RunScript): RunTransport {
  return async (_sessionId, _stage, _body, handlers, signal) => {
    for (const line of script.lines ?? []) {
      if (signal?.aborted) return;
      await wait(LINE_MS);
      handlers.onLine(line);
    }
    for (const test of script.tests ?? []) {
      if (signal?.aborted) return;
      await wait(TEST_MS);
      handlers.onTest(test);
    }
    if (script.rows) handlers.onRows?.(script.rows);
    await wait(LINE_MS);
    if (signal?.aborted) return;
    handlers.onDone(script.done);
  };
}

/** A run that starts and never reports, for looking at the in-flight state. */
export const neverFinishes: RunTransport = async (_s, _stage, _b, handlers, signal) => {
  handlers.onLine({ kind: "command", text: "$ pytest -q" });
  await new Promise<void>((resolve) => {
    signal?.addEventListener("abort", () => resolve());
  });
};
