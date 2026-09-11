"use client";

import { useEffect, useState } from "react";
import type { MediaTestStatus } from "./use-mic-test";

/** What the candidate actually picked. The browser reports this, and it
 * matters for an integrity check: a single window is not the same assurance as
 * the whole screen. */
export type SharedSurface = "monitor" | "window" | "browser" | "unknown";

export interface ScreenShareTestState {
  status: MediaTestStatus | "ended";
  stream: MediaStream | null;
  surface: SharedSurface;
  resolution: { width: number; height: number } | null;
  frameRate: number | null;
  /** Whether the candidate also shared system audio. Optional in the picker,
   * so its absence is a fact rather than a failure. */
  sharingAudio: boolean;
  errorMessage: string | null;
}

const IDLE: ScreenShareTestState = {
  status: "idle",
  stream: null,
  surface: "unknown",
  resolution: null,
  frameRate: null,
  sharingAudio: false,
  errorMessage: null,
};

export const SURFACE_COPY: Record<SharedSurface, string> = {
  monitor: "Sharing an entire screen",
  window: "Sharing a single window",
  browser: "Sharing a browser tab",
  unknown: "Sharing your screen",
};

/** Prompts for a screen share while `active`, and keeps it running so it can
 * be previewed.
 *
 * Unlike a camera, this cannot be probed silently: getDisplayMedia always shows
 * the browser's own picker, and it must be called from a user gesture -- which
 * is why nothing here starts on mount.
 *
 * The candidate can also end the share from the browser's own bar, which fires
 * the track's `ended` event. That is reported rather than ignored: the row must
 * not keep claiming a share that has stopped. */
export function useScreenShareTest(active: boolean, nonce = 0): ScreenShareTestState {
  const [published, setPublished] = useState<ScreenShareTestState | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let stream: MediaStream | null = null;

    const request = navigator.mediaDevices?.getDisplayMedia
      ? navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      : Promise.reject(new DOMException("Unsupported", "NotSupportedError"));

    request
      .then((granted) => {
        if (cancelled) {
          granted.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = granted;

        const track = granted.getVideoTracks()[0];
        const settings = (track?.getSettings() ?? {}) as MediaTrackSettings & {
          displaySurface?: SharedSurface;
        };

        setPublished({
          status: "running",
          stream: granted,
          surface: settings.displaySurface ?? "unknown",
          resolution:
            settings.width && settings.height
              ? { width: settings.width, height: settings.height }
              : null,
          frameRate: settings.frameRate ? Math.round(settings.frameRate) : null,
          sharingAudio: granted.getAudioTracks().length > 0,
          errorMessage: null,
        });

        track?.addEventListener("ended", () => {
          if (cancelled) return;
          setPublished({ ...IDLE, status: "ended" });
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        // Dismissing the picker raises NotAllowedError too, so a cancel and a
        // blocked permission are indistinguishable -- the copy says both.
        const denied = name === "NotAllowedError" || name === "SecurityError";
        const unsupported = name === "NotSupportedError";

        setPublished({
          ...IDLE,
          status: denied ? "denied" : unsupported ? "unavailable" : "error",
          errorMessage: denied
            ? "No screen was shared. Pick a screen in the browser's prompt, or allow screen sharing in your site settings."
            : unsupported
              ? "This browser cannot share a screen."
              : "Could not start screen sharing.",
        });
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active, nonce]);

  return active ? (published ?? { ...IDLE, status: "requesting" }) : IDLE;
}
