import { describe, expect, it } from "vitest";
import { derivePreflightCta } from "./selectors";
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
