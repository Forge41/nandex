"use client";

import { useEffect, useState } from "react";

export type MediaPermission = "granted" | "prompt" | "denied" | "unknown";

/** Camera and microphone only: screen sharing has no persistent permission --
 * getDisplayMedia always prompts. */
export type PromptableDevice = "camera" | "microphone";

/** Whether asking again can still raise a browser prompt.
 *
 * The distinction matters because getUserMedia reports a dismissed prompt and a
 * blocked site with the same NotAllowedError, but only the first can be retried:
 * once a site is blocked, every later call rejects without showing the user
 * anything. Offering "Allow microphone" in that state would be a button that
 * visibly does nothing.
 *
 * Only Chromium exposes camera and microphone to the Permissions API, so
 * "unknown" is the common answer elsewhere and is treated as askable -- a retry
 * that prompts is the right guess, and a retry that fails costs nothing.
 */
export function useMediaPermission(name: PromptableDevice | null): MediaPermission {
  const [state, setState] = useState<MediaPermission>("unknown");

  useEffect(() => {
    if (name === null || !navigator.permissions?.query) return;

    let cancelled = false;
    let status: PermissionStatus | null = null;
    const onChange = () => {
      if (status) setState(status.state);
    };

    navigator.permissions
      .query({ name: name as PermissionName })
      .then((result) => {
        if (cancelled) return;
        status = result;
        setState(result.state);
        // A candidate who unblocks the site in another tab gets an accurate
        // button without reopening the dialog.
        result.addEventListener("change", onChange);
      })
      .catch(() => {
        if (!cancelled) setState("unknown");
      });

    return () => {
      cancelled = true;
      status?.removeEventListener("change", onChange);
    };
  }, [name]);

  return state;
}
