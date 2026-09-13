"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchRuns,
  prepareLanguage,
  saveDraft,
  startRun,
  type AttemptState,
  type RunResult,
} from "@/lib/api/coding";
import type {
  CodeFile,
  CodeLanguage,
  RunnableTask,
  SqlResult,
  TerminalLine,
  TestCase,
} from "@/lib/interview/types";

const DRAFT_DEBOUNCE_MS = 800;

const NO_ATTEMPTS: AttemptState = {
  attemptsAllowed: 3,
  attemptsUsed: 0,
  attemptOutcomes: [],
};

export type LanguageState = "ready" | "preparing" | "failed";

export interface CodingRound<T extends RunnableTask = RunnableTask> {
  task: T;
  taskIndex: number;
  language: CodeLanguage;
  languageState: LanguageState;
  files: CodeFile[];
  /** The canonical cases, carrying whatever the most recent run said about them.
   * A case with no outcome has not run, which is where every task starts. */
  tests: TestCase[];
  terminal: TerminalLine[];
  exitCode?: number;
  attempts: AttemptState;
  running: boolean;
  result: RunResult | null;
  /** The SQL round's result grid, from the run that produced it. */
  rows: SqlResult | null;
  contentOf: (name: string) => string;
  edit: (name: string, content: string) => void;
  selectLanguage: (language: CodeLanguage) => void;
  runTests: () => void;
  submit: () => void;
  canRun: boolean;
  isLastTask: boolean;
}

/** Everything the coding round does, kept out of the stage so the stage renders.
 *
 * Drafts are keyed by task, language and file name: switching to Java and back must
 * return the Python buffer exactly as it was left, because they are different answers to
 * the same task rather than versions of one answer. */
export function useCodingRound<T extends RunnableTask>({
  sessionId,
  stage,
  tasks,
  defaultLanguage,
  onFinish,
}: {
  sessionId: string;
  /** "coding" or "sql" -- both rounds take an attempt, run it in the sandbox and
   * record the result; they differ only in which image serves them. */
  stage: string;
  tasks: T[];
  defaultLanguage: CodeLanguage;
  onFinish: () => void;
}): CodingRound<T> {
  const [taskIndex, setTaskIndex] = useState(0);
  // Per task, not per round: a task that fell back to another language during
  // generation has only that one, and carrying a round-wide choice into it would
  // start a model call in the middle of a timed interview.
  const [picked, setPicked] = useState<Record<number, CodeLanguage>>({});
  const [prepared, setPrepared] = useState<Record<string, CodeFile[]>>({});
  const [failed, setFailed] = useState<Record<string, true>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, TestCase>>({});
  const [attempts, setAttempts] = useState<AttemptState>(NO_ATTEMPTS);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [rows, setRows] = useState<SqlResult | null>(null);

  const task = tasks[taskIndex];
  const language =
    picked[taskIndex] ?? (task as { defaultLanguage?: CodeLanguage }).defaultLanguage ?? defaultLanguage;
  const variantKey = `${taskIndex}:${language}`;
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const files = useMemo(
    () => prepared[variantKey] ?? task?.languages[language]?.files ?? [],
    [prepared, variantKey, task, language]
  );

  // Past attempts are the server's to report: a reload during a run loses the stream,
  // not the run, so the attempt meter has to come from the rows rather than from
  // whatever this component happened to witness.
  useEffect(() => {
    let current = true;
    fetchRuns(sessionId, stage, taskIndex)
      .then((past) => {
        if (!current) return;
        setAttempts(past);
        const last = past.runs.at(-1);
        if (last) {
          setOutcomes(Object.fromEntries(last.tests.map((t) => [t.name, t as TestCase])));
        }
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [sessionId, stage, taskIndex]);

  // Derived, not stored: the language is ready exactly when its files are in hand, and a
  // second source of truth for that would be free to disagree with the files themselves.
  const languageState: LanguageState = files.length > 0 ? "ready" : failed[variantKey] ? "failed" : "preparing";

  useEffect(() => {
    if (files.length > 0 || failed[variantKey]) return;
    let current = true;
    prepareLanguage(sessionId, stage, taskIndex, language)
      .then((response) => {
        if (current) setPrepared((all) => ({ ...all, [variantKey]: response.files }));
      })
      .catch(() => {
        if (current) setFailed((all) => ({ ...all, [variantKey]: true }));
      });
    return () => {
      current = false;
    };
  }, [sessionId, stage, taskIndex, language, files.length, failed, variantKey]);

  const contentOf = useCallback(
    (name: string) =>
      drafts[`${variantKey}:${name}`] ?? files.find((f) => f.name === name)?.content ?? "",
    [drafts, files, variantKey]
  );

  const edit = useCallback(
    (name: string, content: string) => {
      const key = `${variantKey}:${name}`;
      setDrafts((all) => ({ ...all, [key]: content }));
      clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => {
        saveDraft(sessionId, stage, { taskIndex, language, name, content }).catch(() => undefined);
      }, DRAFT_DEBOUNCE_MS);
    },
    [sessionId, stage, taskIndex, language, variantKey]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of Object.values(pending)) clearTimeout(timer);
    };
  }, []);

  const runTests = useCallback(() => {
    setRunning(true);
    setResult(null);
    setTerminal([]);
    setRows(null);
    // Every case goes back to "not run" for the duration: showing the previous run's
    // verdicts beside a run in progress attributes them to code that has not been tested.
    setOutcomes({});

    void startRun(
      sessionId,
      stage,
      { taskIndex, language },
      {
        onLine: (line) => setTerminal((lines) => [...lines, line]),
        onTest: (test) => setOutcomes((all) => ({ ...all, [test.name]: test })),
        onDone: (done) => {
          setResult(done);
          setOutcomes(Object.fromEntries(done.tests.map((t) => [t.name, t as TestCase])));
          setRunning(false);
          fetchRuns(sessionId, stage, taskIndex).then(setAttempts).catch(() => undefined);
        },
        onRows: (csv) => setRows(parseCsv(csv)),
      }
    );
  }, [sessionId, stage, taskIndex, language]);

  const isLastTask = taskIndex >= tasks.length - 1;

  const submit = useCallback(() => {
    if (isLastTask) {
      onFinish();
      return;
    }
    setTaskIndex((index) => index + 1);
    setTerminal([]);
    setOutcomes({});
    setResult(null);
  }, [isLastTask, onFinish]);

  const tests = useMemo(
    () => (task?.tests ?? []).map((test) => ({ ...test, ...outcomes[test.name] })),
    [task, outcomes]
  );

  return {
    task,
    taskIndex,
    language,
    languageState,
    files,
    tests,
    terminal,
    exitCode: result?.exitCode ?? undefined,
    attempts,
    running,
    result,
    rows,
    contentOf,
    edit,
    selectLanguage: (next: CodeLanguage) => setPicked((all) => ({ ...all, [taskIndex]: next })),
    runTests,
    submit,
    canRun:
      !running && languageState === "ready" && attempts.attemptsUsed < attempts.attemptsAllowed,
    isLastTask,
  };
}


/** psql's own CSV, turned into a grid.
 *
 * Deliberately minimal: the values are whatever Postgres printed, and a column is
 * right-aligned when every cell in it is a number, which is what a spreadsheet does and
 * what the mockup shows. */
function parseCsv(csv: string): SqlResult | null {
  const lines = csv.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return null;
  const split = (line: string) => line.split(",").map((cell) => cell.trim());
  const columns = split(lines[0]);
  const rows = lines.slice(1).map(split);
  const numericColumns = columns
    .map((_, index) => index)
    .filter((index) => rows.length > 0 && rows.every((row) => /^-?\d+(\.\d+)?$/.test(row[index] ?? "")));
  return { columns, rows, numericColumns };
}
