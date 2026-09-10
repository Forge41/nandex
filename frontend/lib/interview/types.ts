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

export interface Round {
  id: StageId;
  label: string;
  kind: RoundKind;
  durationMin: number;
  /** Resume citation this round was generated from, when it came from one. */
  citation?: number;
  /** Shown on the plan card, revealed on hover. */
  summary?: string;
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

export interface ResumeSection {
  id: string;
  label: string;
  /** Paragraphs with inline citation markers, rendered by RichResumeText. */
  paragraphs: string[];
}

export interface ResumeCandidate {
  name: string;
  title: string;
  location: string;
  email: string;
  yearsExperience: number;
}

export interface ResumeDoc {
  fileName: string;
  sizeBytes: number;
  pageCount: number;
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
}
