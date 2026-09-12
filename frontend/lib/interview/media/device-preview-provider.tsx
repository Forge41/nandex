"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useCameraTest, type CameraTest } from "./use-camera-test";
import { useMicTest, type MicTest } from "./use-mic-test";
import { useScreenShareTest, type ScreenShareTest } from "./use-screen-share-test";
// DeviceKind lives in types.ts with the rest of the shared vocabulary, and is
// re-exported here because every consumer of this provider needs it.
import { cameraVerdict, micVerdict, screenVerdict, wholeScreenShared } from "./verdicts";
import type { DeviceKind, DeviceStatus } from "../types";

export type { DeviceKind };

export interface DevicePreviewState {
  mic: MicTest;
  camera: CameraTest;
  screen: ScreenShareTest;
  /** What each check concluded, computed from the settled snapshot rather than
   * the live one -- so it is kept after a device is turned off, because "you
   * tested this and it passed" stays true while the live preview does not. */
  verdicts: Record<DeviceKind, DeviceStatus>;
  /** Whether a check has actually run. Derived from the verdict rather than
   * tracked alongside it, so the badge a candidate can see and any gate built
   * on this cannot disagree.
   *
   * A device that failed counts: they tried, and nothing should trap a
   * candidate behind a check their hardware cannot pass. */
  tested: Record<DeviceKind, boolean>;
  /** Whether the share was of an entire screen rather than one window or tab.
   * Separate from the verdict because it is the one device result the candidate
   * can always fix by re-sharing, so it gates rather than merely warns. */
  wholeScreen: boolean;
  active: Record<DeviceKind, boolean>;
  start: (kind: DeviceKind) => void;
  stop: (kind: DeviceKind) => void;
  restart: (kind: DeviceKind) => void;
}

const DevicePreviewContext = createContext<DevicePreviewState | null>(null);

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

  const value = useMemo<DevicePreviewState>(() => {
    // From `settled`, not the live state: a verdict is about a check that ran,
    // and releasing the device does not un-run it.
    const verdicts: Record<DeviceKind, DeviceStatus> = {
      mic: micVerdict(mic.settled),
      camera: cameraVerdict(camera.settled),
      screen: screenVerdict(screen.settled),
    };

    return {
      mic,
      camera,
      screen,
      verdicts,
      tested: {
        mic: verdicts.mic !== "untested",
        camera: verdicts.camera !== "untested",
        screen: verdicts.screen !== "untested",
      },
      wholeScreen: wholeScreenShared(screen.settled),
      active,
      start,
      stop,
      restart,
    };
  }, [mic, camera, screen, active, start, stop, restart]);

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
