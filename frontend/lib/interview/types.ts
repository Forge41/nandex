/** Semantic color intents. Shared by Badge, Tag, Banner, StatusDot and the
 * assessment chips so one vocabulary drives every colored surface. */
export type Tone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "violet"
  | "jade"
  | "gold"
  | "olive";

export type StageId =
  | "preflight"
  | "resume"
  | "behavioral"
  | "coding"
  | "sql"
  | "debug"
  | "design"
  | "quiz"
  | "qa"
  | "wrap";

/** How a round relates to the candidate's progress. Derived, never stored --
 * see deriveAgenda in ./selectors. */
export type RoundStatus = "complete" | "active" | "locked";

export type RoundKind = "setup" | "conversation" | "task";

export type ContentState = "pending" | "generating" | "ready" | "failed";

export interface Round {
  id: StageId;
  label: string;
  kind: RoundKind;
  durationMin: number;
  /** Resume citation this round was generated from, when it came from one. */
  citation?: number;
  /** Shown on the plan card, revealed on hover. */
  summary?: string;
  /** Whether this round's task has been generated. Separate from where the round
   * sits in the interview, which comes from progressIndex. */
  contentState?: ContentState;
}

/** A quoted resume line, referenced by the numbered chips throughout the UI. */
export interface Citation {
  id: number;
  quote: string;
  source: string;
}

export interface Probe {
  id: string;
  title: string;
  note: string;
  citation?: number;
  round: StageId;
}

/** A run of resume prose. A fragment carrying a `citation` is the phrase a
 * round was generated from, and renders underlined with its numbered chip --
 * modelled as data rather than a markup string so there is no parser to keep
 * in step with the renderer. */
export interface ResumeFragment {
  text: string;
  citation?: number;
}

export interface ResumeSection {
  id: string;
  label: string;
  paragraphs: ResumeFragment[][];
}

export interface ResumeCandidate {
  name: string;
  title: string;
  location: string;
  email: string;
  yearsExperience: number;
}

/** The document as a file: what is true before anyone has read it.
 *
 * Separate from ResumeDoc because the pre-flight has exactly this and no more --
 * a file the candidate picked, not yet uploaded and certainly not yet parsed.
 */
export interface ResumeFile {
  fileName: string;
  sizeBytes: number;
  /** Only known once a parser has counted them. */
  pageCount?: number;
  /** Only known once the plan has been generated. */
  entityCount?: number;
  /** Object URL for a locally chosen file, or the served path for an uploaded one. */
  previewUrl?: string;
  previewType?: string;
}

export interface ResumeDoc extends ResumeFile {
  entityCount: number;
  candidate: ResumeCandidate;
  sections: ResumeSection[];
  probes: Probe[];
  citations: Citation[];
}

export type Speaker = "interviewer" | "candidate";

export interface Assessment {
  label: string;
  tone: Tone;
}

export interface TranscriptTurn {
  id: string;
  speaker: Speaker;
  text: string;
  /** Seconds since session start; formatted for display at render time. */
  atSeconds: number;
  /** Still being spoken -- renders the blinking caret and dims the turn. */
  inProgress?: boolean;
  assessments?: Assessment[];
}

export interface ConsentState {
  recording: boolean;
  aiInterviewer: boolean;
  integrityMonitoring: boolean;
}

export type DeviceKind = "mic" | "camera" | "screen";

export type DeviceStatus = "ok" | "check" | "fail" | "untested";

export interface DeviceReport {
  status: DeviceStatus;
  /** Human-readable result, e.g. "Level healthy - peak -12 dB, no clipping". */
  detail?: string;
}

export type CodeLanguage = "python" | "go" | "typescript" | "sql";

export interface CodeFile {
  name: string;
  language: CodeLanguage;
  content: string;
  /** Test files are shown but not edited. */
  readOnly?: boolean;
}

export type TestOutcome = "pass" | "fail" | "hidden";

export interface TestCase {
  name: string;
  outcome: TestOutcome;
  /** Milliseconds, when the case actually ran. */
  durationMs?: number;
}

export type TerminalLineKind = "command" | "output" | "error" | "muted";

export interface TerminalLine {
  kind: TerminalLineKind;
  text: string;
}

export interface CodingTask {
  index: number;
  total: number;
  title: string;
  difficulty: Tone;
  difficultyLabel: string;
  brief: string[];
  example: string;
  constraints: string[];
  attemptsUsed: number;
  attemptsAllowed: number;
  attemptOutcomes: ("pass" | "fail" | "unused")[];
  lastRunSummary?: string;
  files: CodeFile[];
  languages: CodeLanguage[];
  tests: TestCase[];
  terminal: TerminalLine[];
  exitCode: number;
  complexity: { label: string; value: string; tone?: Tone }[];
  complexityNote?: string;
}

export interface SchemaTable {
  name: string;
  columns: { name: string; type: string }[];
}

export interface SqlTask {
  prompt: string;
  schema: SchemaTable[];
  query: string;
  columns: string[];
  rows: (string | number)[][];
  /** Right-aligned like a spreadsheet; indexes into `columns`. */
  numericColumns: number[];
  timing?: string;
  caveat?: string;
}

export interface DebugTask {
  prompt: string;
  badgeLabel: string;
  secondsRemaining: number;
  file: CodeFile;
  /** 1-based, relative to `startLine`. */
  faultLine: number;
  startLine: number;
  trace: TerminalLine[];
}

export interface DesignNode {
  id: string;
  label: string;
  detail?: string;
  x: number;
  y: number;
  width: number;
  /** Explicit so connectors can be computed from real geometry rather than an
   * assumed box size. */
  height: number;
  variant: "solid" | "dashed" | "filled";
}

export interface DesignEdge {
  id: string;
  from: string;
  to: string;
}

export interface DesignProbe {
  id: string;
  question: string;
  answered: boolean;
}

export interface DesignTask {
  prompt: string;
  nodes: DesignNode[];
  edges: DesignEdge[];
  candidateNote?: string;
  probes: DesignProbe[];
}

export interface QuizOption {
  id: string;
  label: string;
}

export interface QuizQuestion {
  id: string;
  index: number;
  total: number;
  secondsRemaining: number;
  prompt: string;
  options: QuizOption[];
}

export interface QaSource {
  label: string;
}

export interface QaMessage {
  id: string;
  role: "candidate" | "agent";
  text: string;
  citations?: number[];
  sources?: QaSource[];
  /** The agent declined to answer and handed it to a person. */
  routedTo?: { name: string; replyWithin: string };
}

export interface TimelineStep {
  label: string;
  detail: string;
  state: "done" | "current" | "upcoming";
}

export interface FeedbackQuestion {
  id: string;
  label: string;
}

export interface WrapUp {
  headline: string;
  body: string;
  timeline: TimelineStep[];
  feedbackQuestions: FeedbackQuestion[];
}

/** Round content, keyed by the round it belongs to. Absent entries mean the
 * server has not generated that round yet. */
export interface RoundContent {
  coding?: CodingTask;
  sql?: SqlTask;
  debug?: DebugTask;
  design?: DesignTask;
  quiz?: QuizQuestion;
  qa?: { suggestions: string[]; messages: QaMessage[] };
  wrap?: WrapUp;
  /** questionTotal is optional because a generated round does not have one: the
   * interviewer follows up live, so how many questions there will be is not
   * knowable when the opening question is written. */
  behavioral?: { questionNumber: number; questionTotal?: number; question: string; derivedFrom: string[]; citation?: number };
}

export interface InterviewSession {
  id: string;
  candidateName: string;
  roleTitle: string;
  totalDurationMin: number;
  rounds: Round[];
  resume: ResumeDoc | null;
  activeStage: StageId;
  /** Index into `rounds` of the furthest round unlocked. Rounds after it are
   * locked; rounds before it are complete. */
  progressIndex: number;
  consent: ConsentState;
  startedAt: string | null;
  content: RoundContent;
  /** How far the server has got turning the resume into a plan. Absent on a
   * draft session, which has no server behind it yet. */
  planState?: "idle" | "processing" | "ready" | "failed";
  planError?: string;
  /** The server's view of whether this interview is still running. An ended one
   * is refused a join token, so nothing may try to hold a room open for it. */
  status?: "created" | "active" | "ended";
}
