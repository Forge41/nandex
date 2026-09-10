import type { SegmentTone } from "@/components/ui/segmented-progress";
import type { ConsentState, InterviewSession, RoundStatus, StageId } from "./types";

export interface StageChrome {
  topBar: boolean;
  controlBar: boolean;
  sidePanel: boolean;
  proctor: boolean;
}

/** Which chrome a stage shows. Computed rather than tabulated per stage: the
 * only distinction the design draws is set-up versus in-session, and a ten-row
 * table would imply variation that doesn't exist. */
export function stageChrome(stage: StageId, consent: ConsentState): StageChrome {
  const inSession = stage !== "preflight";

  return {
    topBar: inSession,
    controlBar: inSession,
    sidePanel: inSession,
    proctor: inSession && consent.integrityMonitoring,
  };
}

/** Everything the rail, the flyout and the header need about one round, already
 * resolved. Components stay presentational; the branching lives here where it
 * can be tested without rendering. */
export interface AgendaItemView {
  id: StageId;
  label: string;
  /** Where the round sits relative to progress -- not whether it is on screen. */
  status: RoundStatus;
  /** True when this round is the one being displayed, which can differ from
   * `status: "active"` when the candidate revisits a completed round. */
  isCurrent: boolean;
  /** "1"-"10" while locked, a tick once complete, a dot while active. */
  mark: string;
  meta: string;
  tone: SegmentTone;
}

export function roundStatus(index: number, progressIndex: number): RoundStatus {
  if (index < progressIndex) return "complete";
  if (index === progressIndex) return "active";
  return "locked";
}

export function deriveAgenda(session: InterviewSession): AgendaItemView[] {
  return session.rounds.map((round, index) => {
    const status = roundStatus(index, session.progressIndex);
    const prefix = status === "complete" ? "complete" : status === "active" ? "in progress" : "locked";

    return {
      id: round.id,
      label: round.label,
      status,
      isCurrent: round.id === session.activeStage,
      mark: round.id === session.activeStage ? "●" : status === "complete" ? "✓" : String(index + 1),
      meta: `${prefix} · ${round.durationMin} min`,
      tone: status === "complete" ? "on" : status === "active" ? "active" : "off",
    };
  });
}

export function deriveRoundHeader(session: InterviewSession) {
  return {
    label: `Round ${session.progressIndex + 1} of ${session.rounds.length}`,
    ticks: deriveAgenda(session).map((item) => item.tone),
  };
}

export function derivePreflightCta(session: InterviewSession) {
  const hasResume = session.resume !== null;
  // The design gates only on the resume. Consent gates too here: these terms
  // cover recording and integrity monitoring, so proceeding past an unchecked
  // one would be consent the candidate never gave.
  const consented = Object.values(session.consent).every(Boolean);

  return {
    disabled: !hasResume || !consented,
    label: hasResume ? "Review interview plan" : "Waiting for your resume",
    hint: !hasResume
      ? "Nothing starts until you upload"
      : consented
        ? `Estimated ${session.totalDurationMin} minutes · you can pause once`
        : "Agree to all three terms to continue",
    subtitle: hasResume
      ? "Your resume is parsed. Check your devices, agree to how the session is handled, and the plan opens next."
      : "Upload a resume to unlock the interview plan. You can still check your devices and read the consent terms now.",
  };
}

/** The panel's own labels change wording before the session starts, when it is
 * a chat rather than the interviewer's transcript. */
export function derivePanelCopy(stage: StageId, isOpen: boolean) {
  const noun = stage === "preflight" ? "chat" : "panel";

  return {
    railLabel: stage === "preflight" ? "Chat" : "Interviewer",
    buttonLabel: `${isOpen ? "Hide" : "Show"} ${noun}`,
    title: `${isOpen ? "Hide" : "Show"} ${stage === "preflight" ? "chat" : "side panel"}`,
  };
}

export interface PlanCardView {
  id: StageId;
  label: string;
  durationMin: number;
  summary?: string;
  citation?: number;
}

export interface PlanSummary {
  heading: string;
  /** Substantive rounds, shown one card each. */
  cards: PlanCardView[];
  /** The short tail, collapsed into a single card. Null when there is none. */
  remainder: { count: number; durationMin: number; labels: string } | null;
}

/** A round long enough to be worth its own card. Below this the design folds
 * rounds into one "+ N shorter rounds" tile. */
const FEATURED_MIN_DURATION = 10;

/** Splits the upcoming rounds into featured cards and a collapsed tail.
 *
 * Counts and durations are summed from the rounds themselves rather than
 * hardcoded, so the tile can't drift from the agenda it summarises. */
export function derivePlanSummary(session: InterviewSession): PlanSummary {
  const resumeIndex = session.rounds.findIndex((r) => r.id === "resume");
  const upcoming = session.rounds.slice(resumeIndex + 1);
  const roundCount = session.rounds.filter((r) => r.id !== "preflight").length;

  const cards = upcoming.filter((round) => round.durationMin >= FEATURED_MIN_DURATION);
  const tail = upcoming.filter((round) => round.durationMin < FEATURED_MIN_DURATION);

  return {
    heading: `${roundCount} rounds, ${session.totalDurationMin} minutes`,
    cards: cards.map(({ id, label, durationMin, summary, citation }) => ({
      id,
      label,
      durationMin,
      summary,
      citation,
    })),
    remainder: tail.length
      ? {
          count: tail.length,
          durationMin: tail.reduce((total, round) => total + round.durationMin, 0),
          labels: tail.map((round) => round.label).join(" · "),
        }
      : null,
  };
}

export function deriveNextLockLabel(session: InterviewSession): string {
  const next = session.rounds[session.progressIndex + 1];
  return next ? `${next.label} unlocks when this round is submitted` : "All rounds unlocked";
}
