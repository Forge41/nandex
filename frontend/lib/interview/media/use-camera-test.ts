"use client";

import { useEffect, useState, type RefObject } from "react";
import type { MediaTestStatus } from "./use-mic-test";

export type LightingVerdict = "good" | "dark" | "bright";

export interface CameraTestState {
  status: MediaTestStatus;
  deviceLabel: string | null;
  resolution: { width: number; height: number } | null;
  frameRate: number | null;
  lighting: LightingVerdict | null;
  errorMessage: string | null;
}

const LUMINANCE_INTERVAL_MS = 1000;
/** Sampled at thumbnail size -- mean luminance needs no more resolution than
 * this, and it keeps the per-second draw negligible. */
const SAMPLE_WIDTH = 32;
const SAMPLE_HEIGHT = 24;
const DARK_BELOW = 60;
const BRIGHT_ABOVE = 200;

const PENDING: CameraTestState = {
  status: "requesting",
  deviceLabel: null,
  resolution: null,
  frameRate: null,
  lighting: null,
  errorMessage: null,
};

export const LIGHTING_COPY: Record<LightingVerdict, string> = {
  good: "Framing and lighting look fine",
  dark: "Low light — try facing a window or a lamp",
  bright: "Very bright — you may be backlit",
};

/** Opens the camera while `active` and reports what the track actually
 * negotiated, plus a mean-luminance read of the picture.
 *
 * The caller owns the <video> ref and passes it in: the stream binds to the
 * element directly so the preview never re-renders, and returning a ref
 * alongside the state would taint every read of that state during render. */
export function useCameraTest(
  active: boolean,
  videoRef: RefObject<HTMLVideoElement | null>
): CameraTestState {
  const [published, setPublished] = useState<CameraTestState | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const request = navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
      : Promise.reject(new DOMException("Unsupported", "NotSupportedError"));

    request
      .then((granted) => {
        if (cancelled) {
          granted.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = granted;

        const video = videoRef.current;
        if (video) {
          video.srcObject = granted;
          void video.play().catch(() => {
            // Autoplay can be refused even when muted; the preview simply
            // stays on its first frame, which is not worth failing the test.
          });
        }

        const track = granted.getVideoTracks()[0];
        const settings = track?.getSettings() ?? {};
        const base: CameraTestState = {
          status: "running",
          deviceLabel: track?.label ?? null,
          resolution:
            settings.width && settings.height ? { width: settings.width, height: settings.height } : null,
          frameRate: settings.frameRate ? Math.round(settings.frameRate) : null,
          lighting: null,
          errorMessage: null,
        };
        setPublished(base);

        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE_WIDTH;
        canvas.height = SAMPLE_HEIGHT;
        const context = canvas.getContext("2d", { willReadFrequently: true });

        timer = setInterval(() => {
          const element = videoRef.current;
          if (!context || !element || element.readyState < 2) return;

          context.drawImage(element, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
          const { data } = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);

          let total = 0;
          for (let i = 0; i < data.length; i += 4) {
            total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          }
          const mean = total / (data.length / 4);

          setPublished({
            ...base,
            lighting: mean < DARK_BELOW ? "dark" : mean > BRIGHT_ABOVE ? "bright" : "good",
          });
        }, LUMINANCE_INTERVAL_MS);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        const denied = name === "NotAllowedError" || name === "SecurityError";
        const unsupported = name === "NotSupportedError";

        setPublished({
          ...PENDING,
          status: denied ? "denied" : unsupported ? "unavailable" : "error",
          errorMessage: denied
            ? "Camera access was blocked. Allow it in your browser's site settings, then run the test again."
            : unsupported
              ? "This browser cannot open a camera."
              : "Could not open the camera.",
        });
      });

    const element = videoRef.current;

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (element) element.srcObject = null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active, videoRef]);

  return published ?? PENDING;
}
