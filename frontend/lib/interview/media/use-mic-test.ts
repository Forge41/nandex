"use client";

import { useEffect, useRef, useState } from "react";

export type MediaTestStatus = "requesting" | "running" | "denied" | "unavailable" | "error";

export interface MicTestState {
  status: MediaTestStatus;
  /** One 0-1 value per visualiser bar. */
  levels: number[];
  /** Highest peak seen this run, in dBFS. Null before the first sample. */
  peakDb: number | null;
  clipping: boolean;
  deviceLabel: string | null;
  errorMessage: string | null;
}

const BAR_COUNT = 5;
/** ~20fps. Enough to read as live, a third of the re-renders of a rAF loop. */
const SAMPLE_INTERVAL_MS = 50;
const CLIPPING_DB = -1;

const PENDING: MicTestState = {
  status: "requesting",
  levels: Array(BAR_COUNT).fill(0),
  peakDb: null,
  clipping: false,
  deviceLabel: null,
  errorMessage: null,
};

/** Opens the microphone while `active` and reports live band levels plus the
 * peak seen so far. Everything is released as soon as `active` goes false --
 * an interview must never leave the mic hot behind a closed dialog.
 *
 * State is only ever published from async callbacks, so re-opening a panel
 * that already ran should remount this hook rather than toggle `active`. */
export function useMicTest(active: boolean): MicTestState {
  const [published, setPublished] = useState<MicTestState | null>(null);
  const peakRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    peakRef.current = null;

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
          if (Number.isFinite(peakDb)) peakRef.current = Math.max(peakRef.current ?? -Infinity, peakDb);

          setPublished({
            status: "running",
            levels,
            peakDb: peakRef.current,
            clipping: (peakRef.current ?? -Infinity) > CLIPPING_DB,
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
  }, [active]);

  return published ?? PENDING;
}
