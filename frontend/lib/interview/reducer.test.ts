import { describe, expect, it } from "vitest";

import { draftSession } from "./draft-session";
import { sessionReducer } from "./reducer";
import type { InterviewSession } from "./types";

function server(overrides: Partial<InterviewSession>): InterviewSession {
  return { ...draftSession("Senior Backend Engineer"), ...overrides };
}

describe("SYNC", () => {
  it("takes whether this deployment records from the server", () => {
    const state = {
      ...draftSession("Senior Backend Engineer"),
      consent: {
        recording: true,
        aiInterviewer: true,
        integrityMonitoring: true,
      },
    };

    const off = sessionReducer(state, {
      type: "SYNC",
      server: server({ recordingEnabled: false }),
    });
    const on = sessionReducer(state, {
      type: "SYNC",
      server: server({ recordingEnabled: true }),
    });

    // The wrap screen names a recording only when both are true, so consent
    // alone must not be enough to claim one was made.
    expect(off.recordingEnabled).toBe(false);
    expect(on.recordingEnabled).toBe(true);
  });

  it("leaves what the candidate is doing alone", () => {
    const state = {
      ...draftSession("Senior Backend Engineer"),
      activeStage: "coding" as const,
      progressIndex: 3,
      consent: {
        recording: true,
        aiInterviewer: true,
        integrityMonitoring: true,
      },
    };

    const synced = sessionReducer(state, {
      type: "SYNC",
      server: server({
        activeStage: "preflight",
        progressIndex: 0,
        recordingEnabled: true,
      }),
    });

    expect(synced.activeStage).toBe("coding");
    expect(synced.progressIndex).toBe(3);
    expect(synced.consent.recording).toBe(true);
  });
});
