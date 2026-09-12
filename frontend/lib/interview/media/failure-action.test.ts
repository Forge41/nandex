import { describe, expect, it } from "vitest";
import { failureAction } from "./failure-action";

const BLOCKED_COPY = "Microphone access was blocked. Allow it in your browser's site settings.";

describe("failureAction", () => {
  it("offers to ask when the prompt was dismissed rather than the site blocked", () => {
    const action = failureAction("mic", "denied", "prompt", BLOCKED_COPY);
    expect(action.actionLabel).toBe("Allow microphone");
    expect(action.badge).toBe("Not allowed");
    // The hook's copy assumes a blocked site; a dismissed prompt is not that.
    expect(action.message).not.toBe(BLOCKED_COPY);
  });

  it("does not offer to ask once the site is blocked, because nothing would prompt", () => {
    const action = failureAction("mic", "denied", "denied", BLOCKED_COPY);
    expect(action.actionLabel).toBe("Check again");
    expect(action.badge).toBe("Blocked");
    expect(action.message).toBe(BLOCKED_COPY);
  });

  it("treats an unknown permission as askable, since a retry costs nothing", () => {
    expect(failureAction("camera", "denied", "unknown", null).actionLabel).toBe("Allow camera");
  });

  it("always offers screen sharing again, even reported denied", () => {
    // getDisplayMedia stores no permission, so "denied" is a cancelled picker.
    const action = failureAction("screen", "denied", "denied", null);
    expect(action.actionLabel).toBe("Choose a screen");
    expect(action.badge).toBe("Not shared");
  });

  it("offers no action when the browser cannot run the check at all", () => {
    expect(failureAction("mic", "unavailable", "unknown", "No microphone API.").actionLabel).toBeNull();
  });

  it("offers a retry for an ordinary error", () => {
    const action = failureAction("mic", "error", "granted", "Could not open the microphone.");
    expect(action.badge).toBe("Failed");
    expect(action.actionLabel).toBe("Allow microphone");
    expect(action.message).toBe("Could not open the microphone.");
  });

  it("asks rather than reporting a failure for a check that never started", () => {
    const action = failureAction("camera", "idle", "prompt", null);
    expect(action.badge).toBe("Not allowed");
    expect(action.actionLabel).toBe("Allow camera");
  });

  it("never leaves the strip with no message when the hook supplied none", () => {
    for (const status of ["denied", "error", "unavailable"] as const) {
      expect(failureAction("mic", status, "denied", null).message).not.toBe("");
    }
  });
});
