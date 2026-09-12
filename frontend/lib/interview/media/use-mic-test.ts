"use client";

import { useEffect, useRef, useState } from "react";

/** "idle" is the released state, and it matters: a hook that keeps its last
 * "running" value after the device is closed would leave the UI claiming a
 * live microphone that is no longer open. */
export type MediaTestStatus =
  | "idle"
  | "requesting"
  | "running"
  | "denied"
  | "unavailable"
  | "error";

export interface MicTestState {
  status: MediaTestStatus;
  /** One 0-1 value per visualiser bar. */
  levels: number[];
  /** Loudest peak in the last few seconds, in dBFS. Null before the first
   * sample. Deliberately a moving window and not an all-time maximum: a
   * candidate who clips once and then moves back must see the warning clear. */
  peakDb: number | null;
  clipping: boolean;
  /** How long the candidate has actually been heard speaking, in seconds.
   * Monotonic -- it is the measure of how far through the check they are, so
   * falling silent pauses it rather than undoing it. */
  speechSeconds: number;
  deviceLabel: string | null;
  errorMessage: string | null;
}

const BAR_COUNT = 5;
/** ~20fps. Enough to read as live, a third of the re-renders of a rAF loop. */
const SAMPLE_INTERVAL_MS = 50;
const CLIPPING_DB = -1;
/** Peak and clipping are judged over this much recent audio, so the reading
 * describes the microphone now rather than the worst moment since it opened. */
const WINDOW_MS = 3000;
const WINDOW_SAMPLES = Math.round(WINDOW_MS / SAMPLE_INTERVAL_MS);
/** Above this counts as speech rather than room noise. */
const SPEECH_DB = -45;
/** Enough speech to have measured something. Below this the check is still
 * listening -- a single cough is not a microphone test. */
export const REQUIRED_SPEECH_SECONDS = 1.5;

const IDLE: MicTestState = {
  status: "idle",
  levels: Array(BAR_COUNT).fill(0),
  peakDb: null,
  clipping: false,
  speechSeconds: 0,
  deviceLabel: null,
  errorMessage: null,
};

const PENDING: MicTestState = { ...IDLE, status: "requesting" };

export interface MicTest extends MicTestState {
  /** The last conclusive result, which outlives the device being released.
   *
   * `published` is only ever written from an async callback with a real answer --
   * running, or a definite failure -- and is never cleared, so it already is the
   * latch. Exposing it separately is what lets a row keep an earned verdict while
   * its live preview correctly goes dark.
   */
  settled: MicTestState | null;
}

/** Opens the microphone while `active` and reports live band levels plus the
 * peak seen so far. Everything is released the moment `active` goes false --
 * an interview must never leave the mic hot behind a closed dialog.
 *
 * `nonce` re-acquires the device when it changes, which is what "run the test
 * again" needs: state is only published from async callbacks, so toggling
 * `active` alone would show the previous run until the first new sample. */
export function useMicTest(active: boolean, nonce = 0): MicTest {
  const [published, setPublished] = useState<MicTestState | null>(null);
  // Written only from the sampling interval, never during render.
  const windowRef = useRef<number[]>([]);
  const speechRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    windowRef.current = [];
    speechRef.current = 0;

    const request = navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      : Promise.reject(new DOMException("Unsupported", "NotSupportedError"));

    request
      .then((granted) => {
        if (cancelled) {
          granted.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = granted;

        audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.6;
        audioContext.createMediaStreamSource(granted).connect(analyser);

        const frequencies = new Uint8Array(analyser.frequencyBinCount);
        const waveform = new Float32Array(analyser.fftSize);
        const label = granted.getAudioTracks()[0]?.label ?? null;

        // Speech energy sits in the lower half of the spectrum, so the bands
        // are taken from there -- splitting the full range leaves the top bars
        // permanently flat.
        const usableBins = Math.floor(frequencies.length / 2);
        const bandSize = Math.floor(usableBins / BAR_COUNT);

        timer = setInterval(() => {
          analyser.getByteFrequencyData(frequencies);
          analyser.getFloatTimeDomainData(waveform);

          const levels = Array.from({ length: BAR_COUNT }, (_, band) => {
            let sum = 0;
            for (let i = band * bandSize; i < (band + 1) * bandSize; i++) sum += frequencies[i];
            return sum / bandSize / 255;
          });

          let peakSample = 0;
          for (const sample of waveform) peakSample = Math.max(peakSample, Math.abs(sample));
          const peakDb = peakSample > 0 ? 20 * Math.log10(peakSample) : -Infinity;

          const recent = windowRef.current;
          recent.push(peakDb);
          if (recent.length > WINDOW_SAMPLES) recent.shift();

          if (peakDb > SPEECH_DB) speechRef.current += SAMPLE_INTERVAL_MS / 1000;

          const windowPeak = Math.max(...recent);

          setPublished({
            status: "running",
            levels,
            peakDb: Number.isFinite(windowPeak) ? windowPeak : null,
            clipping: windowPeak > CLIPPING_DB,
            speechSeconds: speechRef.current,
            deviceLabel: label,
            errorMessage: null,
          });
        }, SAMPLE_INTERVAL_MS);
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
            ? "Microphone access was blocked. Allow it in your browser's site settings, then run the test again."
            : unsupported
              ? "This browser cannot open a microphone."
              : "Could not open the microphone.",
        });
      });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      void audioContext?.close();
    };
  }, [active, nonce]);

  // The live half must not be the last published value: a released device
  // cannot keep reporting levels it is no longer measuring. The settled half is
  // exactly that value, for the verdict that outlives it.
  return { ...(active ? (published ?? PENDING) : IDLE), settled: published };
}
