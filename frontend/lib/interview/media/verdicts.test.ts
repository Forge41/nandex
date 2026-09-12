import { describe, expect, it } from "vitest";
import { cameraVerdict, micVerdict, screenVerdict } from "./verdicts";
import { REQUIRED_SPEECH_SECONDS, type MicTestState } from "./use-mic-test";
import type { CameraTestState } from "./use-camera-test";
import type { ScreenShareTestState } from "./use-screen-share-test";

function mic(overrides: Partial<MicTestState> = {}): MicTestState {
  return {
    status: "running",
    levels: [0, 0, 0, 0, 0],
    peakDb: -20,
    clipping: false,
    speechSeconds: REQUIRED_SPEECH_SECONDS,
    deviceLabel: "MacBook Pro Microphone",
    errorMessage: null,
    ...overrides,
  };
}

describe("micVerdict", () => {
  it("keeps listening until the candidate has actually been heard", () => {
    // Silence is not a result: an open microphone in a quiet room proves
    // nothing about whether it picks up speech.
    expect(micVerdict(mic({ speechSeconds: 0 }))).toBe("untested");
    expect(micVerdict(mic({ speechSeconds: REQUIRED_SPEECH_SECONDS - 0.1 }))).toBe("untested");
  });

  it("passes once enough speech has been measured", () => {
    expect(micVerdict(mic())).toBe("ok");
  });

  it("flags clipping in the recent window", () => {
    expect(micVerdict(mic({ clipping: true }))).toBe("check");
  });

  it("clears a clipping verdict once the window no longer contains it", () => {
    // The whole reason the peak is a moving window: a candidate who clips, then
    // moves back from the microphone, must be able to reach a pass without
    // restarting the check.
    const clipped = mic({ clipping: true, peakDb: 0 });
    expect(micVerdict(clipped)).toBe("check");

    const recovered = { ...clipped, clipping: false, peakDb: -18 };
    expect(micVerdict(recovered)).toBe("ok");
  });

  it("does not un-pass a candidate who falls silent", () => {
    // speechSeconds is cumulative, so pausing does not undo the measurement.
    expect(micVerdict(mic({ levels: [0, 0, 0, 0, 0], peakDb: -60 }))).toBe("ok");
  });

  it("reports a device that could not be opened as failed", () => {
    expect(micVerdict(mic({ status: "denied" }))).toBe("fail");
    expect(micVerdict(mic({ status: "error" }))).toBe("fail");
  });

  it("is untested before anything has run", () => {
    expect(micVerdict(null)).toBe("untested");
    expect(micVerdict(mic({ status: "idle" }))).toBe("untested");
    expect(micVerdict(mic({ status: "requesting" }))).toBe("untested");
  });
});

function camera(overrides: Partial<CameraTestState> = {}): CameraTestState {
  return {
    status: "running",
    stream: null,
    deviceLabel: "FaceTime HD Camera",
    resolution: { width: 1280, height: 720 },
    frameRate: 30,
    lighting: "good",
    errorMessage: null,
    ...overrides,
  };
}

describe("cameraVerdict", () => {
  it("waits for a lighting reading before concluding", () => {
    expect(cameraVerdict(camera({ lighting: null }))).toBe("untested");
  });

  it("passes on good lighting and flags anything else", () => {
    expect(cameraVerdict(camera())).toBe("ok");
    expect(cameraVerdict(camera({ lighting: "dark" }))).toBe("check");
    expect(cameraVerdict(camera({ lighting: "bright" }))).toBe("check");
  });

  it("reports a blocked camera as failed", () => {
    expect(cameraVerdict(camera({ status: "denied" }))).toBe("fail");
  });

  it("is untested before anything has run", () => {
    expect(cameraVerdict(null)).toBe("untested");
    expect(cameraVerdict(camera({ status: "idle" }))).toBe("untested");
  });
});

function screen(overrides: Partial<ScreenShareTestState> = {}): ScreenShareTestState {
  return {
    status: "running",
    stream: null,
    surface: "monitor",
    resolution: { width: 1920, height: 1080 },
    frameRate: 30,
    sharingAudio: false,
    errorMessage: null,
    ...overrides,
  };
}

describe("screenVerdict", () => {
  it("passes a whole screen and flags a narrower share", () => {
    // The integrity terms the candidate agreed to cover the screen, so one
    // window is accepted but not treated as equivalent.
    expect(screenVerdict(screen())).toBe("ok");
    expect(screenVerdict(screen({ surface: "window" }))).toBe("check");
    expect(screenVerdict(screen({ surface: "browser" }))).toBe("check");
  });

  it("counts a share the candidate stopped as having happened", () => {
    // Stopping is their choice, not a failure and not a pass -- but the check
    // did run, which is what lets them past the gate.
    expect(screenVerdict(screen({ status: "ended" }))).toBe("check");
  });

  it("reports a refused share as failed", () => {
    expect(screenVerdict(screen({ status: "denied" }))).toBe("fail");
  });

  it("is untested before anything has run", () => {
    expect(screenVerdict(null)).toBe("untested");
    expect(screenVerdict(screen({ status: "idle" }))).toBe("untested");
  });
});
