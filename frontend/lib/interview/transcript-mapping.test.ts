import { describe, expect, it } from "vitest";
import type { TextStreamData } from "@livekit/components-react";
import { segmentsToTurns } from "./transcript-mapping";

const AGENT = "interviewer-1";
const CANDIDATE = "candidate-abc";
const STARTED_AT = 1_700_000_000_000;

function stream(
  identity: string,
  text: string,
  {
    id = `s-${text.slice(0, 6)}`,
    atMs = STARTED_AT,
    final,
    segmentId,
  }: { id?: string; atMs?: number; final?: boolean; segmentId?: string } = {}
): TextStreamData {
  const attributes: Record<string, string> = {};
  if (segmentId) attributes["lk.segment_id"] = segmentId;
  if (final !== undefined) attributes["lk.transcription_final"] = String(final);

  return {
    text,
    participantInfo: { identity },
    streamInfo: {
      id,
      timestamp: atMs,
      mimeType: "text/plain",
      topic: "lk.transcription",
      attributes,
    },
  } as TextStreamData;
}

const options = { agentIdentities: [AGENT], startedAtMs: STARTED_AT };

describe("segmentsToTurns", () => {
  it("maps a finalised segment to a settled turn", () => {
    const turns = segmentsToTurns([stream(AGENT, "What paged you?", { final: true })], options);

    expect(turns).toEqual([
      { id: "s-What p", speaker: "interviewer", text: "What paged you?", atSeconds: 0 },
    ]);
    // Absent, not false -- the fixture writes it that way and every
    // `turn.inProgress &&` check depends on it.
    expect("inProgress" in turns[0]).toBe(false);
  });

  it("marks an interim segment as in progress", () => {
    const turns = segmentsToTurns([stream(CANDIDATE, "We had per-endpoint", { final: false })], options);

    expect(turns[0].speaker).toBe("candidate");
    expect(turns[0].inProgress).toBe(true);
  });

  it("settles a turn when the same segment flips from interim to final", () => {
    const interim = segmentsToTurns(
      [stream(CANDIDATE, "Write amplification", { segmentId: "seg-1", final: false })],
      options
    );
    expect(interim[0].inProgress).toBe(true);

    // components-core replaces streamInfo in place on the coalesced stream, so
    // the next render sees one stream whose attribute has flipped.
    const settled = segmentsToTurns(
      [stream(CANDIDATE, "Write amplification during settlement", { segmentId: "seg-1", final: true })],
      options
    );
    expect("inProgress" in settled[0]).toBe(false);
    expect(settled[0].text).toBe("Write amplification during settlement");
  });

  it("keeps a turn's id stable across an interim-to-final flip", () => {
    const interim = segmentsToTurns(
      [stream(CANDIDATE, "partial", { id: "stream-a", segmentId: "seg-9", final: false })],
      options
    );
    const settled = segmentsToTurns(
      [stream(CANDIDATE, "partial and complete", { id: "stream-b", segmentId: "seg-9", final: true })],
      options
    );

    expect(interim[0].id).toBe("seg-9");
    expect(settled[0].id).toBe("seg-9");
  });

  describe("a segment with no lk.transcription_final attribute", () => {
    // The attribute is documented for user STT; whether the Python agent sets it
    // on its own speech is not knowable statically. Both readings are pinned so
    // the choice is visible if it ever has to change.
    it("is treated as final, so the interviewer's turn is not left dimmed", () => {
      const turns = segmentsToTurns([stream(AGENT, "Two quarters is a long time.")], options);

      expect("inProgress" in turns[0]).toBe(false);
    });

    it("would leave it in progress under the opposite reading", () => {
      // Documents the alternative explicitly: if the agent turns out to publish
      // interim segments without the attribute, this is the behaviour to switch
      // to, and this test is the one that changes.
      const turns = segmentsToTurns(
        [stream(AGENT, "Two quarters is a long time.", { final: false })],
        options
      );

      expect(turns[0].inProgress).toBe(true);
    });
  });

  it("folds consecutive segments from the same speaker into one turn", () => {
    const turns = segmentsToTurns(
      [
        stream(AGENT, "Before the migration.", { id: "a", atMs: STARTED_AT + 1000, final: true }),
        stream(AGENT, "What failed?", { id: "b", atMs: STARTED_AT + 2000, final: true }),
      ],
      options
    );

    expect(turns).toHaveLength(1);
    expect(turns[0].text).toBe("Before the migration. What failed?");
    expect(turns[0].id).toBe("a");
  });

  it("does not fold across a change of speaker", () => {
    const turns = segmentsToTurns(
      [
        stream(AGENT, "What failed?", { id: "a", atMs: STARTED_AT + 1000, final: true }),
        stream(CANDIDATE, "Write amplification.", { id: "b", atMs: STARTED_AT + 2000, final: true }),
        stream(AGENT, "How did you find it?", { id: "c", atMs: STARTED_AT + 3000, final: true }),
      ],
      options
    );

    expect(turns.map((t) => t.speaker)).toEqual(["interviewer", "candidate", "interviewer"]);
  });

  it("folds a later final segment into a turn that was in progress", () => {
    const turns = segmentsToTurns(
      [
        stream(CANDIDATE, "We had per-endpoint latency", { id: "a", atMs: STARTED_AT + 1000, final: false }),
        stream(CANDIDATE, "but nothing tying lock waits back.", {
          id: "b",
          atMs: STARTED_AT + 2000,
          final: true,
        }),
      ],
      options
    );

    expect(turns).toHaveLength(1);
    expect("inProgress" in turns[0]).toBe(false);
    expect(turns[0].text).toBe("We had per-endpoint latency but nothing tying lock waits back.");
  });

  it("orders by timestamp rather than arrival", () => {
    const turns = segmentsToTurns(
      [
        stream(CANDIDATE, "second", { id: "b", atMs: STARTED_AT + 5000, final: true }),
        stream(AGENT, "first", { id: "a", atMs: STARTED_AT + 1000, final: true }),
      ],
      options
    );

    expect(turns.map((t) => t.text)).toEqual(["first", "second"]);
  });

  it("baselines atSeconds off the session start, not the clock", () => {
    const turns = segmentsToTurns(
      [stream(AGENT, "much later", { atMs: STARTED_AT + 492_000, final: true })],
      options
    );

    expect(turns[0].atSeconds).toBe(492);
  });

  it("never produces a negative timestamp for a segment older than the session", () => {
    const turns = segmentsToTurns(
      [stream(AGENT, "from before", { atMs: STARTED_AT - 9000, final: true })],
      options
    );

    expect(turns[0].atSeconds).toBe(0);
  });

  it("falls back to zero when the session has no start time yet", () => {
    const turns = segmentsToTurns([stream(AGENT, "no baseline", { final: true })], {
      agentIdentities: [AGENT],
      startedAtMs: null,
    });

    expect(turns[0].atSeconds).toBe(0);
  });

  it("drops empty and whitespace-only segments", () => {
    const turns = segmentsToTurns(
      [
        stream(AGENT, "", { id: "a", final: true }),
        stream(AGENT, "   ", { id: "b", final: true }),
        stream(AGENT, "real", { id: "c", final: true }),
      ],
      options
    );

    expect(turns.map((t) => t.text)).toEqual(["real"]);
  });

  it("treats an unknown identity as the candidate", () => {
    // Erring this way means a stray participant reads as the person being
    // interviewed rather than being given the interviewer's voice.
    const turns = segmentsToTurns([stream("someone-else", "hello", { final: true })], options);

    expect(turns[0].speaker).toBe("candidate");
  });

  it("returns nothing for no streams", () => {
    expect(segmentsToTurns([], options)).toEqual([]);
  });
});
