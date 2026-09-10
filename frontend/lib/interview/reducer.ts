import type { ConsentState, InterviewSession, ResumeDoc, StageId } from "./types";

export type SessionAction =
  | { type: "GO_TO_STAGE"; stage: StageId }
  | { type: "ADVANCE" }
  | { type: "SET_RESUME"; resume: ResumeDoc }
  | { type: "CLEAR_RESUME" }
  | { type: "TOGGLE_CONSENT"; key: keyof ConsentState }
  | { type: "START" }
  | { type: "END_SESSION" };

export function sessionReducer(state: InterviewSession, action: SessionAction): InterviewSession {
  switch (action.type) {
    case "GO_TO_STAGE": {
      const index = state.rounds.findIndex((r) => r.id === action.stage);
      // Jumping ahead of the furthest unlocked round is the one navigation the
      // candidate must not be able to do, so it is refused here rather than
      // only being hidden in the UI.
      if (index < 0 || index > state.progressIndex) return state;
      return { ...state, activeStage: action.stage };
    }

    case "ADVANCE": {
      const index = state.rounds.findIndex((r) => r.id === state.activeStage);
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

    case "START":
      return state.startedAt ? state : { ...state, startedAt: new Date().toISOString() };

    /** Leaving early still ends at wrap-up: the candidate is told what happens
     * to what they already gave, rather than dropped out of the room. */
    case "END_SESSION": {
      const last = state.rounds.length - 1;
      return { ...state, activeStage: state.rounds[last].id, progressIndex: last };
    }
  }
}
