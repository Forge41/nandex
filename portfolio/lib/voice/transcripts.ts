const SEGMENT_ID = "lk.segment_id";
const TRANSCRIPTION_FINAL = "lk.transcription_final";

export type StreamMeta = { id: string; timestamp: number; attributes?: Record<string, string> };

export type Segment = { id: string; identity: string; text: string; final: boolean; timestamp: number };

export type VoiceTurn = { id: string; who: "you" | "agent"; text: string; final: boolean };

/** Absent counts as final: agent speech may not carry the attribute, and treating
 * it as interim would leave every agent turn stuck behind a caret. */
export function segmentFromStream(info: StreamMeta, identity: string, text: string): Segment {
  const flag = info.attributes?.[TRANSCRIPTION_FINAL];
  return {
    id: info.attributes?.[SEGMENT_ID] ?? info.id,
    identity,
    text,
    final: flag === undefined ? true : flag !== "false",
    timestamp: info.timestamp,
  };
}

/** Each stream sharing a segment id carries the whole segment so far, so a newer
 * stream replaces the older text; the first timestamp keeps the turn in place. */
export function upsertSegment(segments: readonly Segment[], seg: Segment): Segment[] {
  const i = segments.findIndex((s) => s.id === seg.id);
  if (i < 0) return [...segments, seg];
  const next = [...segments];
  next[i] = { ...seg, timestamp: segments[i].timestamp };
  return next;
}

export function segmentsToTurns(segments: readonly Segment[], visitorIdentity: string): VoiceTurn[] {
  const turns: VoiceTurn[] = [];
  const ordered = [...segments].filter((s) => s.text.trim()).sort((a, b) => a.timestamp - b.timestamp);
  for (const s of ordered) {
    const who = s.identity === visitorIdentity ? "you" : "agent";
    const prev = turns.at(-1);
    if (prev && prev.who === who) {
      prev.text = `${prev.text} ${s.text.trim()}`;
      prev.final = prev.final && s.final;
      continue;
    }
    turns.push({ id: s.id, who, text: s.text.trim(), final: s.final });
  }
  return turns;
}
