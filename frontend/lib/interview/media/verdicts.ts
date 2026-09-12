import type { DeviceStatus } from "../types";
import type { CameraTestState } from "./use-camera-test";
import { REQUIRED_SPEECH_SECONDS, type MicTestState } from "./use-mic-test";
import type { ScreenShareTestState } from "./use-screen-share-test";

/** What each check concluded, from the settled snapshot of a device.
 *
 * Pure and separate from the provider so every branch is testable without
 * rendering -- these decide both the badge a candidate sees and whether they
 * can start the interview.
 */
export function micVerdict(mic: MicTestState | null): DeviceStatus {
  if (mic === null || mic.status === "idle" || mic.status === "requesting") return "untested";
  if (mic.status !== "running") return "fail";
  // Still listening: the candidate has to have actually been heard for this
  // check to have measured anything. Silence is not a result.
  if (mic.speechSeconds < REQUIRED_SPEECH_SECONDS) return "untested";
  return mic.clipping ? "check" : "ok";
}

export function cameraVerdict(camera: CameraTestState | null): DeviceStatus {
  if (camera === null || camera.status === "idle" || camera.status === "requesting") {
    return "untested";
  }
  if (camera.status !== "running") return "fail";
  if (camera.lighting === null) return "untested";
  return camera.lighting === "good" ? "ok" : "check";
}

export function screenVerdict(screen: ScreenShareTestState | null): DeviceStatus {
  if (screen === null || screen.status === "idle" || screen.status === "requesting") {
    return "untested";
  }
  // Ending the share is the candidate's choice, not a failure, and not a pass
  // either -- but it did happen, so it counts as a check having run.
  if (screen.status === "ended") return "check";
  if (screen.status !== "running") return "fail";
  // A single window is a weaker assurance than a whole screen, and the
  // integrity terms the candidate agreed to are about the screen.
  return screen.surface === "window" || screen.surface === "browser" ? "check" : "ok";
}
