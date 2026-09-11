"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useCameraTest, type CameraTestState } from "./use-camera-test";
import { useMicTest, type MicTestState } from "./use-mic-test";
import { useScreenShareTest, type ScreenShareTestState } from "./use-screen-share-test";
import type { DeviceStatus } from "../types";

export type DeviceKind = "mic" | "camera" | "screen";

export interface DevicePreviewState {
  mic: MicTestState;
  camera: CameraTestState;
  screen: ScreenShareTestState;
  /** What each check concluded. Kept after a device is turned off, because
   * "you tested this and it passed" stays true; the live preview does not. */
  verdicts: Record<DeviceKind, DeviceStatus>;
  active: Record<DeviceKind, boolean>;
  start: (kind: DeviceKind) => void;
  stop: (kind: DeviceKind) => void;
  restart: (kind: DeviceKind) => void;
}

const DevicePreviewContext = createContext<DevicePreviewState | null>(null);

function micVerdict(mic: MicTestState): DeviceStatus {
  if (mic.status === "idle") return "untested";
  if (mic.status === "requesting") return "untested";
  if (mic.status !== "running") return "fail";
  // No speech yet is not a pass: the candidate has to have said something for
  // this check to have measured anything.
  const tooQuiet = mic.peakDb === null || mic.peakDb < -45;
  return mic.clipping || tooQuiet ? "check" : "ok";
}

function cameraVerdict(camera: CameraTestState): DeviceStatus {
  if (camera.status === "idle" || camera.status === "requesting") return "untested";
  if (camera.status !== "running") return "fail";
  if (camera.lighting === null) return "untested";
  return camera.lighting === "good" ? "ok" : "check";
}

function screenVerdict(screen: ScreenShareTestState): DeviceStatus {
  if (screen.status === "idle" || screen.status === "requesting") return "untested";
  // Ending the share is the candidate's choice, not a failure -- but it is also
  // no longer a pass, so it reverts to untested rather than claiming either.
  if (screen.status === "ended") return "untested";
  if (screen.status !== "running") return "fail";
  // A single window is a weaker assurance than a whole screen, and the
  // integrity terms the candidate agreed to are about the screen.
  return screen.surface === "window" || screen.surface === "browser" ? "check" : "ok";
}

/** Owns the devices for as long as the pre-flight is on screen.
 *
 * Acquisition lives here rather than inside the test dialog so a tested device
 * keeps feeding its row preview after the dialog closes -- and so the overlay
 * and the row show the same stream instead of competing for the camera, which
 * fails outright on some hardware.
 *
 * Everything is released when this unmounts, which is what keeps the pre-flight
 * from holding the camera through the rest of the interview: the room acquires
 * its own tracks, and two claims on one device is how a black self-view
 * happens. */
export function DevicePreviewProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<Record<DeviceKind, boolean>>({
    mic: false,
    camera: false,
    screen: false,
  });
  const [nonces, setNonces] = useState<Record<DeviceKind, number>>({
    mic: 0,
    camera: 0,
    screen: 0,
  });

  // The luminance sample needs a decoded frame, and only an element in the
  // document reliably produces one -- so it is rendered, at one pixel, rather
  // than created detached.
  const samplingRef = useRef<HTMLVideoElement | null>(null);

  const mic = useMicTest(active.mic, nonces.mic);
  const camera = useCameraTest(active.camera, samplingRef, nonces.camera);
  const screen = useScreenShareTest(active.screen, nonces.screen);

  const start = useCallback((kind: DeviceKind) => {
    setActive((current) => (current[kind] ? current : { ...current, [kind]: true }));
  }, []);

  const stop = useCallback((kind: DeviceKind) => {
    setActive((current) => (current[kind] ? { ...current, [kind]: false } : current));
  }, []);

  const restart = useCallback((kind: DeviceKind) => {
    setActive((current) => ({ ...current, [kind]: true }));
    setNonces((current) => ({ ...current, [kind]: current[kind] + 1 }));
  }, []);

  const value = useMemo<DevicePreviewState>(
    () => ({
      mic,
      camera,
      screen,
      verdicts: {
        mic: micVerdict(mic),
        camera: cameraVerdict(camera),
        screen: screenVerdict(screen),
      },
      active,
      start,
      stop,
      restart,
    }),
    [mic, camera, screen, active, start, stop, restart]
  );

  return (
    <DevicePreviewContext.Provider value={value}>
      <video ref={samplingRef} muted playsInline aria-hidden className="pointer-events-none absolute size-px opacity-0" />
      {children}
    </DevicePreviewContext.Provider>
  );
}

export function useDevicePreviews() {
  const value = useContext(DevicePreviewContext);
  if (!value) throw new Error("useDevicePreviews must be used inside DevicePreviewProvider");
  return value;
}
