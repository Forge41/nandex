"use client";

import type { ReactNode } from "react";
import type { RunTransport } from "@/lib/api/coding";
import type { PastRuns } from "@/lib/api/coding";
import { PlanProgress } from "@/components/interview/organisms/plan-progress";
import { StagePlaceholder } from "@/components/interview/stages/stage-placeholder";
import { InterviewSessionProvider } from "@/lib/interview/session-provider";
import type { InterviewSession, StageId, TerminalLine, TranscriptTurn } from "@/lib/interview/types";
import type { AnswerContext, Answers } from "./offline";
import {
  HARNESS_ENDED_AT,
  HARNESS_ROUNDS,
  HARNESS_STARTED_LONG_AGO,
  HARNESS_SESSION_ID,
  HARNESS_TRANSCRIPT,
  harnessSession,
  withoutContent,
} from "./fixtures";
import { neverFinishes, scriptedRun } from "./run-scripts";

/** One thing you can look at, in one state.
 *
 * A state is a URL, which is most of why this beats opening screens one at a time:
 * "the coding round after a compile error" is a link that can go in a bug report. */
export interface ScreenState {
  id: string;
  label: string;
  note: string;
  session?: InterviewSession;
  transcript?: TranscriptTurn[];
  answers?: Answers;
  run?: RunTransport;
  /** Rendered instead of the room, for the screens that are not rounds. */
  standalone?: ReactNode;
}

export interface Screen {
  id: string;
  label: string;
  note: string;
  /** Whether a candidate can reach this today. The harness shows both; saying which
   * is which is the difference between a tool and a claim about what is finished. */
  shipped: boolean;
  stage?: StageId;
  states: ScreenState[];
}

const RUNS_PATH = `/interview/sessions/${HARNESS_SESSION_ID}/rounds`;

function pastRuns(over: Partial<PastRuns> = {}): PastRuns {
  return {
    attemptsAllowed: 3,
    attemptsUsed: 0,
    attemptOutcomes: [],
    runs: [],
    ...over,
  };
}

/** The attempt meter after `runsCompleted` runs of a given outcome.
 *
 * A scripted run has to be reflected here or the screen contradicts itself: nine
 * cases passing beside "0 / 3 attempts" is exactly the sort of claim this harness is
 * for catching. */
function meterAfterRuns(outcome: "pass" | "partial" | "fail", summary?: string) {
  return ({ runsCompleted }: AnswerContext) =>
    pastRuns({
      attemptsUsed: runsCompleted,
      attemptOutcomes: Array.from({ length: runsCompleted }, () => outcome),
      lastRunSummary: runsCompleted > 0 ? summary : undefined,
    });
}

const PYTEST_LINES: TerminalLine[] = [
  { kind: "command", text: "$ pytest -q acronym_test.py" },
  { kind: "muted", text: "collected 9 items" },
];

const CASES = [
  "all_caps_word",
  "apostrophes",
  "basic",
  "consecutive_delimiters",
  "lowercase_words",
  "punctuation",
  "punctuation_without_whitespace",
  "underscore_emphasis",
  "very_long_abbreviation",
];

function cases(failing: string[] = []) {
  return CASES.map((name) => ({
    name,
    hidden: false,
    outcome: (failing.includes(name) ? "fail" : "pass") as "pass" | "fail",
    durationMs: 3,
  }));
}

const CODING_STATES: ScreenState[] = [
  {
    id: "fresh",
    label: "Not yet run",
    note: "Every case unknown, three attempts left. Where the round starts.",
    answers: { [RUNS_PATH]: pastRuns() },
  },
  {
    id: "running",
    label: "Run in flight",
    note: "Press Run: the stream opens and never reports.",
    answers: { [RUNS_PATH]: pastRuns() },
    run: neverFinishes,
  },
  {
    id: "passing",
    label: "All passing",
    note: "Press Run. Nine cases arrive one at a time, then the summary.",
    answers: { [RUNS_PATH]: meterAfterRuns("pass", "Last run: 9 of 9 tests passed") },
    run: scriptedRun({
      lines: [...PYTEST_LINES, { kind: "output", text: "........." }],
      tests: cases(),
      done: {
        phase: "ran",
        tests: cases(),
        exitCode: 0,
        durationMs: 412,
        truncated: false,
        timedOut: false,
      },
    }),
  },
  {
    id: "failing",
    label: "Some failing",
    note: "Two cases fail after seven pass — the ordinary outcome, and the one the attempts meter needs a third fill for.",
    answers: { [RUNS_PATH]: meterAfterRuns("partial", "Last run: 7 of 9 tests passed") },
    run: scriptedRun({
      lines: [
        ...PYTEST_LINES,
        { kind: "error", text: "FAILED acronym_test.py::test_apostrophes" },
        { kind: "muted", text: "  assert 'HC' == 'HC'" },
      ],
      tests: cases(["apostrophes", "underscore_emphasis"]),
      done: {
        phase: "ran",
        tests: cases(["apostrophes", "underscore_emphasis"]),
        exitCode: 1,
        durationMs: 388,
        truncated: false,
        timedOut: false,
      },
    }),
  },
  {
    id: "compile-failed",
    label: "Compile error",
    note: "No case ran, so no case has an outcome. The panel must not read this as failures.",
    answers: { [RUNS_PATH]: meterAfterRuns("fail", "Last run: the code did not compile") },
    run: scriptedRun({
      lines: [
        { kind: "command", text: "$ python -m compileall acronym.py" },
        { kind: "error", text: 'File "acronym.py", line 4' },
        { kind: "error", text: "    return ''.join(parts" },
        { kind: "error", text: "SyntaxError: '(' was never closed" },
      ],
      done: {
        phase: "compile_failed",
        tests: [],
        exitCode: 1,
        durationMs: 96,
        truncated: false,
        timedOut: false,
      },
    }),
  },
  {
    id: "timeout",
    label: "Timed out",
    note: "Killed at the budget. Cases that had already reported keep their result.",
    answers: { [RUNS_PATH]: meterAfterRuns("fail", "Last run: timed out") },
    run: scriptedRun({
      lines: [...PYTEST_LINES, { kind: "muted", text: "..." }],
      tests: cases().slice(0, 3),
      done: {
        phase: "timeout",
        detail: "Killed after 10s.",
        tests: cases().slice(0, 3),
        exitCode: null,
        durationMs: 10_000,
        truncated: false,
        timedOut: true,
      },
    }),
  },
  {
    id: "exhausted",
    label: "Attempts exhausted",
    note: "Three of three used. Run is refused, and the meter says why.",
    answers: {
      [RUNS_PATH]: pastRuns({
        attemptsUsed: 3,
        attemptOutcomes: ["fail", "partial", "partial"],
        lastRunSummary: "Last run: 7 of 9 tests passed",
        runs: [
          {
            id: "r3",
            attempt: 3,
            language: "python",
            phase: "ran",
            tests: cases(["apostrophes", "underscore_emphasis"]),
            exitCode: 1,
            durationMs: 390,
            truncated: false,
            timedOut: false,
          },
        ],
      }),
    },
  },
  {
    id: "unavailable",
    label: "Runner unavailable",
    note: "The sandbox did not answer. Nothing is claimed about the code.",
    answers: { [RUNS_PATH]: pastRuns() },
  },
];

const SQL_STATES: ScreenState[] = [
  {
    id: "fresh",
    label: "Not yet run",
    note: "Schema on the left, no grid — the round's starting state.",
    answers: { [RUNS_PATH]: pastRuns({ attemptsAllowed: 3 }) },
  },
  {
    id: "rows",
    label: "Query returned rows",
    note: "Both cases pass and the grid fills from the run.",
    answers: { [RUNS_PATH]: meterAfterRuns("pass", "Last run: 2 of 2 tests passed") },
    run: scriptedRun({
      lines: [{ kind: "command", text: "$ psql -f query.sql" }],
      tests: [
        { name: "query runs", hidden: false, outcome: "pass", durationMs: 11 },
        { name: "result matches", hidden: false, outcome: "pass", durationMs: 2 },
      ],
      rows: "merchant,total\nacme,350\nglobex,80\n",
      done: {
        phase: "ran",
        tests: [
          { name: "query runs", outcome: "pass", durationMs: 11 },
          { name: "result matches", outcome: "pass", durationMs: 2 },
        ],
        exitCode: 0,
        durationMs: 240,
        truncated: false,
        timedOut: false,
      },
    }),
  },
  {
    id: "empty",
    label: "Query returned nothing",
    note: "A valid query with an empty result. Not an error, and must not look like one.",
    answers: { [RUNS_PATH]: meterAfterRuns("partial", "Last run: 1 of 2 tests passed") },
    run: scriptedRun({
      lines: [{ kind: "command", text: "$ psql -f query.sql" }],
      tests: [
        { name: "query runs", hidden: false, outcome: "pass", durationMs: 9 },
        { name: "result matches", hidden: false, outcome: "fail", durationMs: 1 },
      ],
      rows: "merchant,total\n",
      done: {
        phase: "ran",
        tests: [
          { name: "query runs", outcome: "pass", durationMs: 9 },
          { name: "result matches", outcome: "fail", durationMs: 1 },
        ],
        exitCode: 1,
        durationMs: 210,
        truncated: false,
        timedOut: false,
      },
    }),
  },
  {
    id: "syntax",
    label: "Syntax error",
    note: "Postgres refused the statement, so no case ran.",
    answers: { [RUNS_PATH]: meterAfterRuns("fail", "Last run: the query did not parse") },
    run: scriptedRun({
      lines: [
        { kind: "command", text: "$ psql -f query.sql" },
        { kind: "error", text: 'ERROR:  syntax error at or near "FROM"' },
      ],
      done: {
        phase: "compile_failed",
        tests: [],
        exitCode: 1,
        durationMs: 88,
        truncated: false,
        timedOut: false,
      },
    }),
  },
];

/** Rounds whose only states are "content or not". */
function contentStates(stage: StageId, readyNote: string): ScreenState[] {
  return [
    { id: "ready", label: "Content ready", note: readyNote },
    {
      id: "generating",
      label: "Still being written",
      note: "The server is generating this round. The screen says to wait, because something is coming.",
      session: withoutContent(harnessSession(stage), stage, "generating"),
    },
    {
      id: "absent",
      label: "No content, none coming",
      note: "Nothing is being written. A different sentence, deliberately.",
      session: withoutContent(harnessSession(stage), stage, undefined),
    },
  ];
}

export const SCREENS: Screen[] = [
  {
    id: "plan-progress",
    label: "Generating your interview",
    note: "The wait between uploading a resume and seeing a plan.",
    shipped: true,
    states: [
      {
        id: "early",
        label: "Reading the document",
        note: "Two steps in. The third has not started.",
        standalone: (
          <PlanProgress
            steps={[
              { id: "upload", label: "Uploading your resume", detail: "", state: "done" },
              {
                id: "parse",
                label: "Reading the document",
                detail: "Priya_Raghunathan_Resume.pdf · 2 pages",
                state: "running",
              },
              { id: "plan", label: "Building your interview plan", detail: "", state: "pending" },
            ]}
          />
        ),
      },
      {
        id: "late",
        label: "Rounds being prepared",
        note: "Steps appended by the workflow, one per round it is actually preparing.",
        standalone: (
          <PlanProgress
            steps={[
              { id: "upload", label: "Uploading your resume", detail: "", state: "done" },
              {
                id: "parse",
                label: "Reading the document",
                detail: "Priya_Raghunathan_Resume.pdf · 2 pages",
                state: "done",
              },
              {
                id: "plan",
                label: "Building your interview plan",
                detail: "5 probes across 3 rounds",
                state: "done",
              },
              {
                id: "round:behavioral",
                label: "Preparing Behavioral — ownership",
                detail: "",
                state: "running",
              },
              {
                id: "round:coding",
                label: "Preparing Live coding + terminal",
                detail: "",
                state: "running",
              },
            ]}
          />
        ),
      },
      {
        id: "failed",
        label: "A step failed",
        note: "The candidate is told what they can act on, and offered a way out.",
        standalone: (
          <PlanProgress
            steps={[
              { id: "upload", label: "Uploading your resume", detail: "", state: "done" },
              { id: "parse", label: "Reading the document", detail: "", state: "failed" },
              { id: "plan", label: "Building your interview plan", detail: "", state: "pending" },
            ]}
            error="We couldn't read that resume. Try uploading it again."
            onRetry={() => undefined}
          />
        ),
      },
    ],
  },
  {
    id: "preflight",
    label: "Pre-flight & resume",
    note: "Device checks, consent, and the dropzone.",
    shipped: true,
    stage: "preflight",
    states: [
      {
        id: "fresh",
        label: "Nothing agreed yet",
        note: "Consent unticked and no file, which is where a candidate starts.",
        session: harnessSession("preflight", {
          consent: { recording: false, aiInterviewer: false, integrityMonitoring: false },
          resume: null,
          startedAt: null,
        }),
      },
      {
        id: "consented",
        label: "Consent given",
        note: "Every box ticked. The advance button's own gate is the device check.",
      },
    ],
  },
  {
    id: "resume",
    label: "Resume review & plan",
    note: "The candidate's own prose beside the plan written from it.",
    shipped: true,
    stage: "resume",
    states: [
      { id: "full", label: "Plan and probes", note: "Five probes across three rounds." },
      {
        id: "no-probes",
        label: "No probes returned",
        note: "The prompt says returning fewer is correct, so none at all has to render.",
        session: harnessSession("resume", {
          resume: { ...harnessSession("resume").resume!, probes: [] },
        }),
      },
    ],
  },
  {
    id: "behavioral",
    label: "Behavioral",
    note: "One generated question and what it was derived from.",
    shipped: true,
    stage: "behavioral",
    states: contentStates("behavioral", "A question generated from what the resume says."),
  },
  {
    id: "coding",
    label: "Live coding + terminal",
    note: "Two real bank tasks in four languages, with a scripted runner.",
    shipped: true,
    stage: "coding",
    states: CODING_STATES,
  },
  {
    id: "sql",
    label: "SQL",
    note: "A real schema, a checked answer, and a result grid.",
    shipped: true,
    stage: "sql",
    states: SQL_STATES,
  },
  {
    id: "wrap",
    label: "Wrap-up",
    note: "The closing screen, and the only one that reads endedAt.",
    shipped: true,
    stage: "wrap",
    states: [
      {
        id: "recorded",
        label: "Recording consented",
        note: "Lists the recording among what was kept.",
        session: harnessSession("wrap", {
          startedAt: HARNESS_STARTED_LONG_AGO,
          endedAt: HARNESS_ENDED_AT,
          status: "ended",
        }),
      },
      {
        id: "not-recorded",
        label: "Recording declined",
        note: "The recording line is absent, not greyed out.",
        session: harnessSession("wrap", {
          startedAt: HARNESS_STARTED_LONG_AGO,
          endedAt: HARNESS_ENDED_AT,
          status: "ended",
          consent: { recording: false, aiInterviewer: true, integrityMonitoring: true },
        }),
      },
      {
        id: "still-running",
        label: "No end time",
        note: "Reached without ending. Session length measures to now, and must not be negative.",
        session: harnessSession("wrap"),
      },
    ],
  },
  {
    id: "debug",
    label: "Debug drill",
    note: "Built, not shipped: its trace and timer are fabrications nothing produced.",
    shipped: false,
    stage: "debug",
    states: contentStates("debug", "Fixture content. No generator writes this."),
  },
  {
    id: "design",
    label: "System design canvas",
    note: "Built, not shipped: node geometry and probe answers come from nowhere real.",
    shipped: false,
    stage: "design",
    states: contentStates("design", "Fixture content. No generator writes this."),
  },
  {
    id: "quiz",
    label: "Knowledge check",
    note: "Built, not shipped.",
    shipped: false,
    stage: "quiz",
    states: contentStates("quiz", "Fixture content. No generator writes this."),
  },
  {
    id: "qa",
    label: "Your questions",
    note: "Built, not shipped: the answers are a retrieval system that does not exist here.",
    shipped: false,
    stage: "qa",
    states: contentStates("qa", "Fixture content. No generator writes this."),
  },
  {
    id: "placeholder",
    label: "Round not built",
    note: "The fallback for a stage with no screen. Unreachable today, because every stage has one.",
    shipped: true,
    states: [
      {
        id: "only",
        label: "Placeholder",
        note: "The panel on its own. No stage selects it, so the room cannot show it.",
        standalone: (
          <InterviewSessionProvider initialSession={harnessSession("debug")}>
            <div className="flex h-dvh flex-col bg-surface text-content">
              <StagePlaceholder />
            </div>
          </InterviewSessionProvider>
        ),
      },
    ],
  },
];

export function findScreen(id: string): Screen | undefined {
  return SCREENS.find((screen) => screen.id === id);
}

export function findState(screen: Screen, id: string | null): ScreenState {
  return screen.states.find((state) => state.id === id) ?? screen.states[0];
}

export function sessionFor(screen: Screen, state: ScreenState): InterviewSession {
  if (state.session) return state.session;
  return harnessSession(screen.stage ?? HARNESS_ROUNDS[0].id);
}

export function transcriptFor(state: ScreenState): TranscriptTurn[] {
  return state.transcript ?? HARNESS_TRANSCRIPT;
}
