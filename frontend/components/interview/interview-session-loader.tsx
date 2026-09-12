"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { fetchSession, type SessionPayload } from "@/lib/api/interview";
import { InterviewSessionProvider } from "@/lib/interview/session-provider";
import { RoomShell } from "@/components/interview/room-shell";
import { InterviewRoom } from "@/components/interview/interview-room";
import { Button } from "@/components/ui/button";
import { MOCK_RESUME, MOCK_TRANSCRIPT } from "@/lib/interview/mock/session.fixture";
import { MOCK_ROUND_CONTENT } from "@/lib/interview/mock/rounds.fixture";
import type { InterviewSession } from "@/lib/interview/types";

/** Round content and the parsed resume are still fixture.
 *
 * The session itself -- its id, rounds, consent, progress and timing -- is now
 * the server's. These two are not: nothing generates a coding task or reads a
 * resume yet, and rendering ten empty rounds would say the interview is broken
 * rather than unfinished. Both come out when the generator lands; the merge is
 * in one place so there is one thing to delete. */
function withFixtureContent(payload: SessionPayload): InterviewSession {
  return {
    ...payload,
    resume: payload.resume ?? MOCK_RESUME,
    content: Object.keys(payload.content).length > 0 ? payload.content : MOCK_ROUND_CONTENT,
  };
}

function Centred({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-surface text-content">
      {children}
    </div>
  );
}

export function InterviewSessionLoader({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchSession(sessionId)
      .then((payload) => {
        if (!cancelled) setSession(payload);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof ApiError && cause.status === 404
            ? "This interview could not be found. It may belong to another browser."
            : "We couldn't load this interview."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, attempt]);

  if (error) {
    return (
      <Centred>
        <p className="t-body text-content-subtle">{error}</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </Button>
      </Centred>
    );
  }

  if (!session) {
    return (
      <Centred>
        <p className="t-body text-content-muted">Loading your interview…</p>
      </Centred>
    );
  }

  return (
    <InterviewSessionProvider initialSession={withFixtureContent(session)}>
      <RoomShell transcript={session.transcript.length ? session.transcript : MOCK_TRANSCRIPT}>
        <InterviewRoom />
      </RoomShell>
    </InterviewSessionProvider>
  );
}
