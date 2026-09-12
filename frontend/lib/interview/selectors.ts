import { ConnectionQuality } from "livekit-client";
import type { RoomConnection } from "./room-provider";
import type { SegmentTone } from "@/components/ui/segmented-progress";
import type { ConsentState, DeviceKind, InterviewSession, RoundStatus, StageId } from "./types";

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

/** `hasResume` is a parameter because the pre-flight holds a file the candidate
 * chose and has not sent yet -- there is no ResumeDoc until the server has read
 * one, and the button has to unlock before that. */
export function derivePreflightCta(session: InterviewSession, hasResume = session.resume !== null) {
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

const DEVICE_NOUN: Record<DeviceKind, string> = {
  mic: "microphone",
  camera: "camera",
  screen: "screen share",
};

const DEVICE_ORDER: readonly DeviceKind[] = ["mic", "camera", "screen"];

export interface DeviceGate {
  ready: boolean;
  untested: DeviceKind[];
  /** Names the specific rows. "Test something first" would leave the candidate
   * hunting for which one. */
  message: string;
  /** A blocker that is already known, as opposed to a check that simply has not
   * run. Null when there is none. The button is disabled while this is set,
   * because refusing a click is only fair when the candidate could not have
   * known -- here they can be told up front, and told exactly what to change. */
  blockingReason: string | null;
}

/** Whether the candidate has actually run the device checks they just consented
 * to being monitored by.
 *
 * A device that failed counts as checked: they tried, and a candidate whose
 * webcam is blocked at the OS level must not be trapped on this page. The Fail
 * badge stays visible, and a human reviews the session regardless.
 */
export function deriveDeviceGate(
  tested: Record<DeviceKind, boolean>,
  { screenSupported, wholeScreen }: { screenSupported: boolean; wholeScreen: boolean }
): DeviceGate {
  const untested = DEVICE_ORDER.filter((kind) => {
    // A browser with no getDisplayMedia cannot run this check at all, so
    // requiring it would be a gate with no key.
    if (kind === "screen" && !screenSupported) return false;
    return !tested[kind];
  });

  // A share narrower than a screen is the one device result the candidate can
  // always put right, so unlike a failed microphone it holds them here.
  const partialScreen = screenSupported && tested.screen && !wholeScreen;

  return {
    ready: untested.length === 0 && !partialScreen,
    untested,
    message: untested.length
      ? `Test your ${formatList(untested.map((kind) => DEVICE_NOUN[kind]))} before continuing.`
      : "",
    blockingReason: partialScreen
      ? "Share your entire screen — a single window or browser tab isn't enough."
      : null,
  };
}

/** Intl.ListFormat is built in, so "a, b and c" needs no dependency and no
 * hand-rolled comma juggling. */
function formatList(items: string[]): string {
  return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(items);
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

/** What the connection banner should say, or nothing when there is nothing
 * worth saying.
 *
 * "live" deliberately renders no banner: a reassurance that stays on screen
 * through a working interview is noise, and the rail's connection label already
 * carries the steady state. */
export function deriveConnectionView(
  connection: RoomConnection,
  agentState?: string
): { tone: "info" | "success" | "warning" | "danger"; message: string; canRetry?: boolean; canUnblockAudio?: boolean } | null {
  switch (connection) {
    case "offline":
    case "live":
      return null;
    case "connecting":
      return {
        tone: "info",
        message:
          agentState === "initializing"
            ? "Your interviewer is starting up."
            : "Connecting you to your interviewer.",
      };
    case "degraded":
      return {
        tone: "warning",
        message: "Your connection is unstable. Audio may drop out for a moment.",
      };
    case "failed":
      return {
        tone: "danger",
        message:
          agentState === "failed"
            ? "Your interviewer couldn't join. Nothing you said has been lost."
            : "We couldn't connect you to the room. Nothing you said has been lost.",
        canRetry: true,
      };
    case "ended":
      return {
        tone: "info",
        message: "You've left the room.",
        canRetry: true,
      };
  }
}

/** The rail's steady-state connection label. Renders only with something real
 * to report -- the prop it feeds is optional precisely so that an unknown
 * connection shows nothing rather than a guess. */
export function deriveConnectionLabel(
  connection: RoomConnection,
  quality?: ConnectionQuality,
  agentState?: string
): string | undefined {
  if (connection !== "live" && connection !== "degraded") return undefined;

  const qualityWord =
    quality === ConnectionQuality.Excellent
      ? "excellent"
      : quality === ConnectionQuality.Good
        ? "good"
        : quality === ConnectionQuality.Poor
          ? "poor"
          : undefined;
  const agentWord =
    agentState === "listening"
      ? "interviewer listening"
      : agentState === "thinking"
        ? "interviewer thinking"
        : agentState === "speaking"
          ? "interviewer speaking"
          : undefined;

  const parts = [qualityWord && `Connection ${qualityWord}`, agentWord].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}
