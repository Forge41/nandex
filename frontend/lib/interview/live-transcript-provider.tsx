"use client";

import { useMemo } from "react";
import { useTranscriptions } from "@livekit/components-react";
import { useRoomState } from "./room-provider";
import { TranscriptProvider } from "./transcript-provider";
import { segmentsToTurns } from "./transcript-mapping";
import type { TranscriptTurn } from "./types";

/** Feeds the transcript panel from the room's live transcription streams.
 *
 * Must sit inside SessionProvider. TranscriptProvider keeps its exact
 * signature, so the side panel and the behavioural round are unchanged --
 * they render turns and do not care where the turns came from.
 *
 * Turns already stored on the session come first: the agent persists them, so a
 * candidate who reloads mid-round keeps what was said before the reload, and
 * the live streams only carry this connection's speech. */
export function LiveTranscriptProvider({
  startedAt,
  persisted,
  children,
}: {
  startedAt: string | null;
  persisted: TranscriptTurn[];
  children: React.ReactNode;
}) {
  const streams = useTranscriptions();
  // Read from the room rather than constructed: the agent joins under whatever
  // identity its worker sets, and a guessed format would mislabel every turn.
  const { agentIdentity } = useRoomState();

  const turns = useMemo(() => {
    // Computed from a prop rather than read off the clock: Date.now() during
    // render is a purity violation this lint config treats as an error.
    const startedAtMs = startedAt ? new Date(startedAt).getTime() : null;
    const live = segmentsToTurns(streams, {
      agentIdentities: agentIdentity ? [agentIdentity] : [],
      startedAtMs,
    });
    const seen = new Set(live.map((turn) => turn.id));
    return [...persisted.filter((turn) => !seen.has(turn.id)), ...live];
  }, [streams, agentIdentity, startedAt, persisted]);

  return <TranscriptProvider turns={turns}>{children}</TranscriptProvider>;
}
