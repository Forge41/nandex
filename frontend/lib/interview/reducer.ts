import type { ConsentState, InterviewSession, ResumeDoc, StageId } from "./types";

export type SessionAction =
  | { type: "GO_TO_STAGE"; stage: StageId }
  | { type: "ADVANCE" }
  | { type: "SET_RESUME"; resume: ResumeDoc }
  | { type: "CLEAR_RESUME" }
  | { type: "TOGGLE_CONSENT"; key: keyof ConsentState }
  | { type: "START" }
  | { type: "SYNC"; server: InterviewSession }
  | { type: "END_SESSION" };

export function sessionReducer(state: InterviewSession, action: SessionAction): InterviewSession {
  switch (action.type) {
    case "GO_TO_STAGE": {
      const index = state.rounds.findIndex((r) => r.id === action.stage);
      // An interview runs forwards. Jumping ahead is obvious cheating; going back
      // is subtler and worse -- a candidate who has seen the SQL round can return
      // to the coding round and keep working on it with everything after it
      // already known. The round they are on is the round they are on.
      if (index !== state.progressIndex) return state;
      return { ...state, activeStage: action.stage };
    }

    case "ADVANCE": {
      const index = state.rounds.findIndex((r) => r.id === state.activeStage);
      // Nowhere left to go. Deliberately a no-op rather than a wrap: the caller
      // ends the session, and advancing into a round that does not exist would
      // leave the candidate on a screen with no way forward.
      if (index < 0 || index >= state.rounds.length - 1) return state;
      const next = state.rounds[index + 1];
      return {
        ...state,
        activeStage: next.id,
        progressIndex: Math.max(state.progressIndex, index + 1),
        startedAt: state.startedAt ?? new Date().toISOString(),
      };
    }

    case "SET_RESUME":
      return { ...state, resume: action.resume };

    case "CLEAR_RESUME":
      return { ...state, resume: null };

    case "TOGGLE_CONSENT":
      return { ...state, consent: { ...state.consent, [action.key]: !state.consent[action.key] } };

    /** Folds in what the server has generated since, without touching what the
     * candidate is doing.
     *
     * The split is not cosmetic: use-session-persistence deliberately keeps the
     * client ahead of the server on the stage, the progress and the consent
     * boxes, so replacing the whole session with a server copy would drag the
     * candidate back to whichever round the last PATCH had reached. */
    case "SYNC":
      return {
        ...state,
        rounds: action.server.rounds,
        content: action.server.content,
        resume: action.server.resume,
        candidateName: action.server.candidateName,
        totalDurationMin: action.server.totalDurationMin,
        planState: action.server.planState,
        planError: action.server.planError,
        status: action.server.status,
      };

    case "START":
      return state.startedAt ? state : { ...state, startedAt: new Date().toISOString() };

    /** Leaving early still ends at wrap-up: the candidate is told what happens
     * to what they already gave, rather than dropped out of the room. */
    case "END_SESSION": {
      const last = state.rounds.length - 1;
      // status too, and not only the stage: the server stops issuing join tokens
      // for an ended interview, so anything still holding a room open would ask
      // for one it can never be given.
      return {
        ...state,
        activeStage: state.rounds[last].id,
        progressIndex: last,
        // Stamped here as well as by the server: the badge stops at the length the
        // interview ran without waiting for the next fetch to say so.
        endedAt: state.endedAt ?? new Date().toISOString(),
        status: "ended",
      };
    }
  }
}
