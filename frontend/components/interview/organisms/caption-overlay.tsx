"use client";

import { useRoomState } from "@/lib/interview/room-provider";
import { useTranscript } from "@/lib/interview/transcript-provider";

/** The captions toggle, made to mean something.
 *
 * Deliberately separate from the transcript panel: that panel is the record of
 * the interview and stays visible regardless, while this is an accessibility
 * overlay showing only what is being said right now. */
export function CaptionOverlay() {
  const { captionsEnabled } = useRoomState();
  const turns = useTranscript();
  const latest = turns.at(-1);

  if (!captionsEnabled || !latest) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-8"
    >
      <p className="max-w-[62ch] rounded-lg bg-surface-overlay px-4 py-2.5 text-center text-sm leading-relaxed text-content-on-interactive">
        <span className="t-eyebrow mr-2 text-content-muted">
          {latest.speaker === "interviewer" ? "Interviewer" : "You"}
        </span>
        {latest.text}
        {latest.inProgress && <span className="animate-caret-blink ml-0.5">▏</span>}
      </p>
    </div>
  );
}
