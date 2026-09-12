import { DEFAULT_ROUNDS } from "./agenda";
import type { InterviewSession } from "./types";

/** A session that does not exist on the server yet.
 *
 * The pre-flight runs before anything is created: a candidate choosing a file
 * and checking their microphone has not started a recorded interview, and
 * should not have one waiting for them if they close the tab.
 *
 * An empty id is the marker for "not yet created", and the one thing that
 * distinguishes a draft from a loaded session.
 */
export function draftSession(roleTitle: string): InterviewSession {
  return {
    id: "",
    candidateName: "",
    roleTitle,
    totalDurationMin: DEFAULT_ROUNDS.reduce((total, round) => total + round.durationMin, 0),
    rounds: DEFAULT_ROUNDS,
    resume: null,
    activeStage: "preflight",
    progressIndex: 0,
    consent: { recording: false, aiInterviewer: false, integrityMonitoring: false },
    startedAt: null,
    content: {},
  };
}
