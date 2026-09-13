import { apiFetch } from "./client";
import type { CodeFile, CodeLanguage, TerminalLine, TestCase } from "@/lib/interview/types";

export type RunPhase =
  | "running"
  | "ran"
  | "compile_failed"
  | "crashed"
  | "timeout"
  | "unavailable";

export interface RunResult {
  phase: RunPhase;
  detail?: string;
  tests: { name: string; outcome?: "pass" | "fail"; durationMs?: number }[];
  exitCode: number | null;
  durationMs: number;
  truncated: boolean;
  timedOut: boolean;
}

export interface AttemptState {
  attemptsAllowed: number;
  attemptsUsed: number;
  attemptOutcomes: ("pass" | "partial" | "fail")[];
  lastRunSummary?: string;
}

export interface PastRuns extends AttemptState {
  runs: (RunResult & { id: string; attempt: number; language: CodeLanguage })[];
}

export function fetchRuns(sessionId: string, taskIndex: number): Promise<PastRuns> {
  return apiFetch<PastRuns>(
    `/interview/sessions/${sessionId}/rounds/coding/runs?taskIndex=${taskIndex}`
  );
}

export function saveDraft(
  sessionId: string,
  body: { taskIndex: number; language: CodeLanguage; name: string; content: string }
): Promise<{ saved: boolean }> {
  return apiFetch(`/interview/sessions/${sessionId}/rounds/coding/draft`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function prepareLanguage(
  sessionId: string,
  taskIndex: number,
  language: CodeLanguage
): Promise<{ files: CodeFile[] }> {
  return apiFetch(
    `/interview/sessions/${sessionId}/rounds/coding/tasks/${taskIndex}/languages/${language}`,
    { method: "POST" }
  );
}

export interface RunHandlers {
  onLine: (line: TerminalLine) => void;
  onTest: (test: TestCase) => void;
  onDone: (result: RunResult) => void;
}

/** Takes an attempt and reports what happens while it happens.
 *
 * `fetch` rather than `EventSource`, which cannot POST. The stream is read to
 * completion; the server owns the run regardless, so abandoning this read loses
 * the view of the attempt and not the attempt. */
export async function startRun(
  sessionId: string,
  body: { taskIndex: number; language: CodeLanguage },
  handlers: RunHandlers,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`/api/interview/sessions/${sessionId}/rounds/coding/runs`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response
      .json()
      .then((body: { detail?: string }) => body?.detail)
      .catch(() => undefined);
    handlers.onDone({
      phase: "unavailable",
      detail: detail ?? "The run could not be started.",
      tests: [],
      exitCode: null,
      durationMs: 0,
      truncated: false,
      timedOut: false,
    });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) dispatch(frame, handlers);
  }
}

function dispatch(frame: string, handlers: RunHandlers): void {
  let event = "";
  let raw = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7);
    else if (line.startsWith("data: ")) raw = line.slice(6);
  }
  if (!event || !raw) return;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return;
  }

  if (event === "line") handlers.onLine(data as TerminalLine);
  else if (event === "test") handlers.onTest(data as TestCase);
  else if (event === "done") handlers.onDone(data as RunResult);
}
