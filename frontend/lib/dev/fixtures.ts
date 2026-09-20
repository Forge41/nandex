import { DEFAULT_ROUNDS } from "@/lib/interview/agenda";
import { MOCK_RESUME, MOCK_SESSION, MOCK_TRANSCRIPT } from "@/lib/interview/mock/session.fixture";
import { MOCK_ROUND_CONTENT } from "@/lib/interview/mock/rounds.fixture";
import tasks from "@/lib/interview/mock/tasks.fixture.json";
import type {
  CodingTask,
  InterviewSession,
  Round,
  RoundContent,
  SqlTask,
  StageId,
  TranscriptTurn,
} from "@/lib/interview/types";

export const HARNESS_SESSION_ID = "dev-screens";

/** The rounds that do not ship, so the harness can still show their screens.
 *
 * The only place in the frontend they exist. Copied from
 * backend/apps/interview/rounds.py::ALL_ROUNDS, which is the catalogue -- the server
 * filters these out of `DEFAULT_ROUNDS` because nothing honest backs them yet, and
 * that filter is what this deliberately steps around. Nothing outside the harness may
 * read this list. */
const UNSHIPPED_ROUNDS: Round[] = [
  { id: "debug", label: "Debug drill", kind: "task", durationMin: 8 },
  { id: "design", label: "System design canvas", kind: "task", durationMin: 15 },
  { id: "quiz", label: "Knowledge check", kind: "task", durationMin: 5 },
  { id: "qa", label: "Your questions", kind: "conversation", durationMin: 8 },
];

/** Every round in interview order, live flags off.
 *
 * `live: false` is what keeps this offline: RoomShell reads it and mounts
 * LocalRoomState, which has the real toggles and no token mint and no socket. A
 * harness that connected to LiveKit would be a harness that needs a backend. */
export const HARNESS_ROUNDS: Round[] = [
  ...DEFAULT_ROUNDS.slice(0, 5),
  ...UNSHIPPED_ROUNDS,
  ...DEFAULT_ROUNDS.slice(5),
].map((round) => ({ ...round, live: false, contentState: "ready" as const }));

export const HARNESS_STAGES: StageId[] = HARNESS_ROUNDS.map((round) => round.id);

/** Round content, with the coding and SQL tasks the server would have sent.
 *
 * Those two come from tasks.fixture.json, which is exported by
 * `manage.py export_task_fixture` through the same bank lookup and hidden-file filter
 * the API uses. They are a copy of the server's output, not a likeness of it. */
export const HARNESS_CONTENT: RoundContent = {
  ...MOCK_ROUND_CONTENT,
  coding: tasks.coding as { tasks: CodingTask[]; defaultLanguage: "python" },
  sql: tasks.sql as { tasks: SqlTask[]; defaultLanguage: "sql" },
};

/** Relative to load, not a fixed date: a hardcoded one makes the top bar read
 * "6287:39:23 / 75:00" and the wrap screen agree with it. Safe against hydration
 * because useElapsedSeconds reads 0 until its first tick. */
const LOADED_AT = Date.now();
const MINUTE = 60_000;

const STARTED_AT = new Date(LOADED_AT - 12 * MINUTE).toISOString();

/** A session that ran its length and stopped. */
export const HARNESS_STARTED_LONG_AGO = new Date(LOADED_AT - 42 * MINUTE).toISOString();
export const HARNESS_ENDED_AT = new Date(LOADED_AT).toISOString();

export function harnessSession(
  stage: StageId,
  over: Partial<InterviewSession> = {}
): InterviewSession {
  const index = HARNESS_STAGES.indexOf(stage);
  return {
    ...MOCK_SESSION,
    id: HARNESS_SESSION_ID,
    rounds: HARNESS_ROUNDS,
    resume: MOCK_RESUME,
    content: HARNESS_CONTENT,
    activeStage: stage,
    progressIndex: index < 0 ? 0 : index,
    consent: { recording: true, aiInterviewer: true, integrityMonitoring: true },
    startedAt: STARTED_AT,
    status: "active",
    planState: "ready",
    ...over,
  };
}

/** A round whose content the server has not sent, so the screen has to say so. */
export function withoutContent(
  session: InterviewSession,
  stage: StageId,
  contentState: Round["contentState"]
): InterviewSession {
  const content = { ...session.content };
  delete content[stage as keyof RoundContent];
  return {
    ...session,
    content,
    rounds: session.rounds.map((round) =>
      round.id === stage ? { ...round, contentState } : round
    ),
  };
}

export const HARNESS_TRANSCRIPT: TranscriptTurn[] = MOCK_TRANSCRIPT;
