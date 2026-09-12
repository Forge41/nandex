import type { DeviceKind } from "../types";
import type { MediaPermission } from "./use-media-permission";
import type { MediaTestStatus } from "./use-mic-test";

const ASK_LABEL: Record<DeviceKind, string> = {
  mic: "Allow microphone",
  camera: "Allow camera",
  screen: "Choose a screen",
};

const ASK_BADGE: Record<DeviceKind, string> = {
  mic: "Not allowed",
  camera: "Not allowed",
  screen: "Not shared",
};

const ASK_COPY: Record<DeviceKind, string> = {
  mic: "The microphone needs your permission before it can be tested.",
  camera: "The camera needs your permission before it can be tested.",
  screen: "No screen was shared.",
};

export interface FailureAction {
  badge: string;
  message: string;
  /** Null when there is nothing a retry could change. */
  actionLabel: string | null;
}

/** What a failed check should say, and what button it should carry.
 *
 * The distinction it exists for: getUserMedia reports a dismissed prompt and a
 * blocked site with the same NotAllowedError, but only the first can be asked
 * again. Once a site is blocked, every later call rejects without showing the
 * candidate anything, so an "Allow microphone" button there would be a button
 * that does nothing -- the permission state is the only thing that tells them
 * apart.
 *
 * Pure so each branch is testable without a browser that can actually block a
 * device, which is the state hardest to reproduce by hand.
 */
export function failureAction(
  kind: DeviceKind,
  status: MediaTestStatus | "ended",
  permission: MediaPermission,
  message: string | null,
): FailureAction {
  if (status === "unavailable") {
    return {
      badge: "Failed",
      message: message ?? "This browser cannot run that check.",
      actionLabel: null,
    };
  }

  // Screen sharing has no stored permission -- getDisplayMedia prompts every
  // time -- so its "denied" is a cancelled picker, always askable again.
  const askable = kind === "screen" || permission !== "denied";

  if (status === "idle" || (status === "denied" && askable)) {
    return { badge: ASK_BADGE[kind], message: ASK_COPY[kind], actionLabel: ASK_LABEL[kind] };
  }

  if (status === "denied") {
    return {
      badge: "Blocked",
      message: message ?? "Access is blocked in your browser's site settings.",
      actionLabel: "Check again",
    };
  }

  return {
    badge: "Failed",
    message: message ?? "Something went wrong.",
    actionLabel: ASK_LABEL[kind],
  };
}
