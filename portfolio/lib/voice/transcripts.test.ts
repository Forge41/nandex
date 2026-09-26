import { describe, expect, it } from "vitest";

import { segmentFromStream, segmentsToTurns, upsertSegment, type Segment } from "./transcripts";

const VISITOR = "visitor-abc";
const meta = (id: string, timestamp: number, attributes?: Record<string, string>) => ({ id, timestamp, attributes });

describe("segmentFromStream", () => {
  it("keys by lk.segment_id and reads the final flag, defaulting to final", () => {
    expect(segmentFromStream(meta("s1", 1, { "lk.segment_id": "seg", "lk.transcription_final": "false" }), VISITOR, "hi")).toEqual({
      id: "seg",
      identity: VISITOR,
      text: "hi",
      final: false,
      timestamp: 1,
    });
    expect(segmentFromStream(meta("s2", 2), "agent", "hello").final).toBe(true);
    expect(segmentFromStream(meta("s2", 2), "agent", "hello").id).toBe("s2");
  });
});

describe("upsertSegment", () => {
  it("replaces interim text with the final text of the same segment, keeping its position", () => {
    let segs: Segment[] = [];
    segs = upsertSegment(segs, segmentFromStream(meta("a", 10, { "lk.segment_id": "u1", "lk.transcription_final": "false" }), VISITOR, "what have"));
    segs = upsertSegment(segs, segmentFromStream(meta("b", 20, { "lk.segment_id": "a1" }), "agent", "Sure."));
    segs = upsertSegment(
      segs,
      segmentFromStream(meta("c", 30, { "lk.segment_id": "u1", "lk.transcription_final": "true" }), VISITOR, "what have you built?"),
    );
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ id: "u1", text: "what have you built?", final: true, timestamp: 10 });
  });
});

describe("segmentsToTurns", () => {
  it("attributes the token identity to the visitor and everyone else to the agent", () => {
    const turns = segmentsToTurns(
      [
        { id: "a1", identity: "agent-xyz", text: "Hi, I'm Nandisha.", final: true, timestamp: 1 },
        { id: "u1", identity: VISITOR, text: "tell me about RAG", final: false, timestamp: 2 },
      ],
      VISITOR,
    );
    expect(turns).toEqual([
      { id: "a1", who: "agent", text: "Hi, I'm Nandisha.", final: true },
      { id: "u1", who: "you", text: "tell me about RAG", final: false },
    ]);
  });

  it("folds consecutive segments from one speaker and drops empty ones", () => {
    const turns = segmentsToTurns(
      [
        { id: "a2", identity: "agent", text: "second.", final: true, timestamp: 2 },
        { id: "a1", identity: "agent", text: "First,", final: true, timestamp: 1 },
        { id: "u0", identity: VISITOR, text: "  ", final: true, timestamp: 3 },
      ],
      VISITOR,
    );
    expect(turns).toEqual([{ id: "a1", who: "agent", text: "First, second.", final: true }]);
  });
});
