import { describe, expect, it } from "vitest";
import { deriveDeviceGate, derivePreflightCta, stageChrome } from "./selectors";
import { sessionReducer } from "./reducer";
import type { ConsentState, InterviewSession, ResumeDoc } from "./types";

const NO_CONSENT: ConsentState = {
  recording: false,
  aiInterviewer: false,
  integrityMonitoring: false,
};

const ALL_CONSENT: ConsentState = {
  recording: true,
  aiInterviewer: true,
  integrityMonitoring: true,
};

const RESUME = { fileName: "r.pdf" } as ResumeDoc;

function session(overrides: Partial<InterviewSession> = {}): InterviewSession {
  return {
    id: "s1",
    candidateName: "",
    roleTitle: "",
    totalDurationMin: 94,
    rounds: [],
    resume: null,
    activeStage: "preflight",
    progressIndex: 0,
    consent: NO_CONSENT,
    startedAt: null,
    content: {},
    ...overrides,
  };
}

describe("derivePreflightCta", () => {
  it("blocks a candidate who has not agreed to the terms", () => {
    // This branch was unreachable until consent started unchecked: a pre-ticked
    // box meant `consented` was true before the candidate had done anything.
    const cta = derivePreflightCta(session({ resume: RESUME, consent: NO_CONSENT }));

    expect(cta.disabled).toBe(true);
    expect(cta.hint).toBe("Agree to all three terms to continue");
  });

  it("blocks on a partially agreed set", () => {
    const cta = derivePreflightCta(
      session({ resume: RESUME, consent: { ...ALL_CONSENT, integrityMonitoring: false } })
    );

    expect(cta.disabled).toBe(true);
  });

  it("blocks without a resume even when every term is agreed", () => {
    const cta = derivePreflightCta(session({ consent: ALL_CONSENT }));

    expect(cta.disabled).toBe(true);
    expect(cta.label).toBe("Waiting for your resume");
    expect(cta.hint).toBe("Nothing starts until you upload");
  });

  it("allows only a resume plus all three terms", () => {
    const cta = derivePreflightCta(session({ resume: RESUME, consent: ALL_CONSENT }));

    expect(cta.disabled).toBe(false);
    expect(cta.label).toBe("Review interview plan");
    expect(cta.hint).toContain("94 minutes");
  });
});


describe("deriveDeviceGate", () => {
  const supported = { screenSupported: true, wholeScreen: true };
  const none = { mic: false, camera: false, screen: false };
  const all = { mic: true, camera: true, screen: true };

  it("blocks and names every check when none has run", () => {
    const gate = deriveDeviceGate(none, supported);

    expect(gate.ready).toBe(false);
    expect(gate.untested).toEqual(["mic", "camera", "screen"]);
    // Oxford comma, matching Intl.ListFormat's "en" output and the consent
    // copy beside it ("audio, transcript, and code").
    expect(gate.message).toBe(
      "Test your microphone, camera, and screen share before continuing."
    );
  });

  it("names only what is left once one has run", () => {
    const gate = deriveDeviceGate({ ...none, mic: true }, supported);

    expect(gate.untested).toEqual(["camera", "screen"]);
    expect(gate.message).toBe("Test your camera and screen share before continuing.");
  });

  it("names one device without a conjunction", () => {
    const gate = deriveDeviceGate({ ...all, screen: false }, supported);

    expect(gate.message).toBe("Test your screen share before continuing.");
  });

  it("lets the candidate through once every check has run", () => {
    const gate = deriveDeviceGate(all, supported);

    expect(gate.ready).toBe(true);
    expect(gate.untested).toEqual([]);
    expect(gate.message).toBe("");
  });

  it("treats screen share as satisfied when the browser cannot share at all", () => {
    // Otherwise the gate has no key: there is no way for the candidate to pass a
    // check their browser does not implement.
    const gate = deriveDeviceGate({ ...all, screen: false }, { screenSupported: false, wholeScreen: false });

    expect(gate.ready).toBe(true);
    expect(gate.untested).toEqual([]);
  });

  it("still blocks on a real device when screen share is unsupported", () => {
    const gate = deriveDeviceGate(
      { mic: true, camera: false, screen: false },
      { screenSupported: false, wholeScreen: false }
    );

    expect(gate.ready).toBe(false);
    expect(gate.untested).toEqual(["camera"]);
  });

  it("blocks on a share narrower than a screen, and says which way out", () => {
    // The one device result the candidate can always fix: unlike a broken
    // camera, re-sharing is entirely in their hands.
    const gate = deriveDeviceGate(all, { screenSupported: true, wholeScreen: false });

    expect(gate.ready).toBe(false);
    expect(gate.blockingReason).toBe(
      "Share your entire screen — a single window or browser tab isn't enough."
    );
    // Not folded into the untested list: the check did run, it just did not
    // produce an acceptable share.
    expect(gate.untested).toEqual([]);
  });

  it("does not claim a partial share before the check has run at all", () => {
    const gate = deriveDeviceGate(none, { screenSupported: true, wholeScreen: false });

    expect(gate.blockingReason).toBeNull();
    expect(gate.untested).toContain("screen");
  });

  it("raises no screen requirement a browser without getDisplayMedia cannot meet", () => {
    const gate = deriveDeviceGate(all, { screenSupported: false, wholeScreen: false });

    expect(gate.ready).toBe(true);
    expect(gate.blockingReason).toBeNull();
  });

  it("reports both a partial share and the checks still missing", () => {
    const gate = deriveDeviceGate(
      { mic: false, camera: true, screen: true },
      { screenSupported: true, wholeScreen: false }
    );

    expect(gate.ready).toBe(false);
    expect(gate.untested).toEqual(["mic"]);
    expect(gate.blockingReason).not.toBeNull();
  });

  it("keeps the rows in the order they are shown", () => {
    // The message and the focus target both follow this order, so a candidate
    // reading top to bottom is sent to the first one they can see.
    const gate = deriveDeviceGate({ mic: false, camera: true, screen: false }, supported);

    expect(gate.untested).toEqual(["mic", "screen"]);
  });
});

describe("stageChrome once the interview is over", () => {
  const consent = { recording: true, aiInterviewer: true, integrityMonitoring: true };

  it("keeps the controls and the panel while the session is running", () => {
    const chrome = stageChrome("coding", consent, false);

    expect(chrome).toMatchObject({ controlBar: true, sidePanel: true, proctor: true });
  });

  it("takes away everything that implies a call once it has ended", () => {
    // A microphone button, a camera tile and a live transcript heading around a screen
    // that says "that's everything" all say the opposite of what the screen says.
    const chrome = stageChrome("wrap", consent, true);

    expect(chrome).toMatchObject({ controlBar: false, sidePanel: false, proctor: false });
  });

  it("keeps the top bar, which is what says the interview ended", () => {
    expect(stageChrome("wrap", consent, true).topBar).toBe(true);
  });
});

describe("an interview runs forwards", () => {
  const rounds = [
    { id: "preflight" as const, label: "Pre-flight", kind: "setup" as const, durationMin: 4 },
    { id: "behavioral" as const, label: "Behavioral", kind: "conversation" as const, durationMin: 10 },
    { id: "coding" as const, label: "Coding", kind: "task" as const, durationMin: 25 },
  ];

  const at = (index: number): InterviewSession =>
    session({ rounds, activeStage: rounds[index].id, progressIndex: index });

  it("refuses a round the candidate has already finished", () => {
    // The subtler half of cheating: a candidate who has seen the coding round going
    // back to behavioral knows what is coming, and can answer it accordingly.
    const after = sessionReducer(at(2), { type: "GO_TO_STAGE", stage: "behavioral" });

    expect(after.activeStage).toBe("coding");
  });

  it("refuses a round that has not been reached", () => {
    const after = sessionReducer(at(1), { type: "GO_TO_STAGE", stage: "coding" });

    expect(after.activeStage).toBe("behavioral");
  });

  it("leaves the current round alone", () => {
    const after = sessionReducer(at(1), { type: "GO_TO_STAGE", stage: "behavioral" });

    expect(after.activeStage).toBe("behavioral");
  });
});
