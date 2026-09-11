// Re-exported by components-react; components-core is only a transitive dependency.
import type { TextStreamData } from "@livekit/components-react";
import type { Speaker, TranscriptTurn } from "./types";

/** LiveKit's own attribute names on a transcription text stream. Spelled out
 * rather than imported from the enum so this module stays free of the client
 * SDK and can be unit-tested. */
const SEGMENT_ID = "lk.segment_id";
const TRANSCRIPTION_FINAL = "lk.transcription_final";

export interface SegmentsToTurnsOptions {
  /** Identities that are the interviewer. Anything else is the candidate --
   * defaulting that way round means an unexpected participant reads as the
   * person being interviewed rather than as the interviewer. */
  agentIdentities: readonly string[];
  /** Epoch milliseconds the session started, so a turn's timestamp agrees with
   * the timer the candidate is watching rather than with wall-clock. */
  startedAtMs: number | null;
}

/** A segment is final unless it says otherwise.
 *
 * The attribute is documented as being set on user speech-to-text, and agent
 * speech may not carry it at all. Treating absent as interim would leave the
 * interviewer's every turn permanently dimmed behind a blinking caret, which is
 * a worse failure than briefly showing a candidate's turn as settled. */
function isFinal(stream: TextStreamData): boolean {
  const value = stream.streamInfo.attributes?.[TRANSCRIPTION_FINAL];
  return value === undefined ? true : value !== "false";
}

function speakerOf(stream: TextStreamData, agentIdentities: readonly string[]): Speaker {
  return agentIdentities.includes(stream.participantInfo.identity) ? "interviewer" : "candidate";
}

function idOf(stream: TextStreamData): string {
  return stream.streamInfo.attributes?.[SEGMENT_ID] ?? stream.streamInfo.id;
}

/** Folds LiveKit's transcription streams into the transcript shape the UI
 * renders.
 *
 * components-core already coalesces streams sharing an lk.segment_id and
 * replaces streamInfo on each update, which is what lets
 * lk.transcription_final flip "false" to "true" -- so nothing here needs to
 * buffer interim text. */
export function segmentsToTurns(
  streams: readonly TextStreamData[],
  { agentIdentities, startedAtMs }: SegmentsToTurnsOptions
): TranscriptTurn[] {
  const ordered = [...streams]
    .filter((stream) => stream.text.trim().length > 0)
    .sort((a, b) => a.streamInfo.timestamp - b.streamInfo.timestamp);

  const turns: TranscriptTurn[] = [];

  for (const stream of ordered) {
    const speaker = speakerOf(stream, agentIdentities);
    const final = isFinal(stream);
    const previous = turns.at(-1);

    // Consecutive segments from the same speaker are one turn: an agent
    // utterance arrives as several, and rendering each as its own bubble would
    // shred a single sentence across the panel.
    if (previous && previous.speaker === speaker && previous.inProgress === undefined) {
      previous.text = `${previous.text} ${stream.text.trim()}`;
      if (!final) previous.inProgress = true;
      continue;
    }
    if (previous && previous.speaker === speaker && previous.inProgress) {
      previous.text = `${previous.text} ${stream.text.trim()}`;
      if (final) delete previous.inProgress;
      continue;
    }

    const turn: TranscriptTurn = {
      // The first segment's id, so folding later segments in does not churn the
      // React key of a turn already on screen.
      id: idOf(stream),
      speaker,
      text: stream.text.trim(),
      atSeconds:
        startedAtMs === null
          ? 0
          : Math.max(0, Math.round((stream.streamInfo.timestamp - startedAtMs) / 1000)),
    };
    // Absent rather than false when final, matching how the fixture writes it so
    // every existing `turn.inProgress &&` check behaves identically.
    if (!final) turn.inProgress = true;
    turns.push(turn);
  }

  return turns;
}
