"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { fetchSession, type SessionPayload } from "@/lib/api/interview";
import { InterviewSessionProvider } from "@/lib/interview/session-provider";
import { RoomShell } from "@/components/interview/room-shell";
import { InterviewRoom } from "@/components/interview/interview-room";
import { Button } from "@/components/ui/button";
import { MOCK_ROUND_CONTENT } from "@/lib/interview/mock/rounds.fixture";
import type { InterviewSession } from "@/lib/interview/types";

/** Round content is still fixture; nothing else is.
 *
 * Deliberately not the resume: handing a new session one it never uploaded
 * shows "Parsed" for a document that does not exist and skips the candidate
 * past the first step entirely. An absent resume is the truth, and the
 * pre-flight already renders the dropzone for it.
 *
 * Round content stays because nothing generates a coding task yet, and seven
 * empty rounds read as broken rather than unfinished -- and unlike the resume,
 * none of it is on screen when the candidate arrives. It comes out when the
 * generator lands; the merge is one function so there is one thing to delete. */
function withFixtureContent(payload: SessionPayload): InterviewSession {
  return {
    ...payload,
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
      {/* No fixture fallback: an empty transcript is what a session that has not
          started actually has, and the panel already says so. */}
      <RoomShell transcript={session.transcript}>
        <InterviewRoom />
      </RoomShell>
    </InterviewSessionProvider>
  );
}
