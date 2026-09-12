"use client";

import { LIVE_STAGES, RoomProvider } from "@/lib/interview/room-provider";
import { LiveTranscriptProvider } from "@/lib/interview/live-transcript-provider";
import { TranscriptProvider } from "@/lib/interview/transcript-provider";
import { useInterviewSession } from "@/lib/interview/session-provider";
import type { TranscriptTurn } from "@/lib/interview/types";

/** Bridges the session reducer to the room and the transcript.
 *
 * Both need the active stage, and the active stage is client state -- so this
 * has to sit inside the session provider rather than beside it.
 *
 * The live transcript provider must also sit inside the room, which is why the
 * transcript is provided here rather than from the page: it reads the room's
 * transcription streams. */
export function RoomShell({
  transcript,
  children,
}: {
  transcript: TranscriptTurn[];
  children: React.ReactNode;
}) {
  const { session } = useInterviewSession();
  const live = LIVE_STAGES.has(session.activeStage);

  return (
    <RoomProvider sessionId={session.id} activeStage={session.activeStage}>
      {live ? (
        <LiveTranscriptProvider startedAt={session.startedAt} persisted={transcript}>
          {children}
        </LiveTranscriptProvider>
      ) : (
        <TranscriptProvider turns={transcript}>{children}</TranscriptProvider>
      )}
    </RoomProvider>
  );
}
