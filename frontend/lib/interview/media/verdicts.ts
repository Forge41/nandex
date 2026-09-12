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
  if (screen.status === "ended") return wholeScreenShared(screen) ? "check" : "fail";
  if (screen.status !== "running") return "fail";
  // Not a soft warning: the integrity terms cover the whole screen, and a share
  // narrower than that is refused rather than noted.
  return wholeScreenShared(screen) ? "ok" : "fail";
}

/** Whether what was shared satisfies the integrity terms.
 *
 * "unknown" counts: only Chromium reliably reports displaySurface, and refusing
 * every browser that withholds it would be a requirement with no way to meet
 * it. A surface we were told about and that is narrower than a screen is the
 * only thing rejected here.
 */
export function wholeScreenShared(screen: ScreenShareTestState | null): boolean {
  if (screen === null) return false;
  return screen.surface !== "window" && screen.surface !== "browser";
}
