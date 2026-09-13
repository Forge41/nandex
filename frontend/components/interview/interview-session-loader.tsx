"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import {
  fetchSession,
  resumeFileUrl,
  type PlanProgress,
  type SessionPayload,
} from "@/lib/api/interview";
import { InterviewSessionProvider } from "@/lib/interview/session-provider";
import { usePlanGate } from "@/lib/interview/use-plan-progress";
import { RoomShell } from "@/components/interview/room-shell";
import { InterviewRoom } from "@/components/interview/interview-room";
import { SessionSync } from "@/components/interview/session-sync";
import { PlanProgress as PlanProgressView } from "@/components/interview/organisms/plan-progress";
import { Button } from "@/components/ui/button";
import { MOCK_ROUND_CONTENT } from "@/lib/interview/mock/rounds.fixture";
import type { InterviewSession } from "@/lib/interview/types";

/** Round content for the stages nothing writes yet.
 *
 * Only those: a round the server has generated arrives with its own content and
 * is left alone. Six stages still have no generator, and six empty rounds read
 * as broken rather than unfinished. This comes out one stage at a time as their
 * prompts land, and disappears with the last of them. */
// Long enough to read the sentence, short enough not to feel stuck.
const LEFT_ROOM_MS = 4000;

function withFixtureContent(payload: SessionPayload): InterviewSession {
  return {
    ...payload,
    content: { ...MOCK_ROUND_CONTENT, ...payload.content },
    // The document itself, served back by the session it belongs to. The object
    // URL the dropzone made died at the navigation here, and the plan screen
    // offers to open the source -- an offer it can only make with a real link.
    resume: payload.resume && { ...payload.resume, previewUrl: resumeFileUrl(payload.id) },
  };
}

/** Sends the candidate back to the start, and says why first.
 *
 * A redirect on its own reads as the app losing their interview. One sentence is the
 * difference between "this is over" and "something went wrong". */
function LeftTheRoom() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace("/"), LEFT_ROOM_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <Centred>
      <p className="t-body text-content">That interview is over.</p>
      <p className="t-small max-w-[46ch] text-center text-content-muted">
        Leaving the room ends a session, and an ended one cannot be rejoined. Taking you
        back to the start.
      </p>
      <Button variant="secondary" size="sm" onClick={() => router.replace("/")}>
        Start again
      </Button>
    </Centred>
  );
}

function Centred({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-surface text-content">
      {children}
    </div>
  );
}

/** Holds the candidate on the progress screen until there is an interview to
 * show them, then hands over. Mounted only when the plan is not already done,
 * so a returning visitor pays for none of it. */
function PlanGateway({
  session,
  initial,
  onOpen,
}: {
  session: SessionPayload;
  initial: PlanProgress;
  onOpen: () => void;
}) {
  const router = useRouter();
  const gate = usePlanGate(session.id, initial);
  const handed = useRef(false);

  useEffect(() => {
    // Once: the handover refetches the session, and asking for it again on every
    // render while that is in flight would be a request per frame.
    if (!gate.open || handed.current) return;
    handed.current = true;
    onOpen();
  }, [gate.open, onOpen]);

  return (
    <PlanProgressView
      steps={gate.steps}
      error={gate.error}
      onRetry={gate.error ? () => router.push("/") : undefined}
    />
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

  // An interview that is over is not re-enterable. Clicking End keeps the candidate on
  // the closing screen for as long as that page lives -- that is client state and this
  // never runs -- but coming back to the URL afterwards starts again from the top.
  //
  // Leaving the room ends it: the pagehide beacon fires on a reload as much as on a
  // close, so a refresh mid-interview is a candidate leaving. That is the rule this
  // makes visible rather than a rule it adds; before, the same refresh left them sitting
  // in a room that was already over.
  if (session?.status === "ended") {
    return <LeftTheRoom />;
  }

  if (!session) {
    return (
      <Centred>
        <p className="t-body text-content-muted">Loading your interview…</p>
      </Centred>
    );
  }

  // A session whose plan is still being built has no rounds worth showing yet,
  // and one that failed has none coming.
  if (session.planState === "processing" || session.planState === "failed") {
    return (
      <PlanGateway
        session={session}
        initial={{
          status: session.planState ?? "processing",
          error: session.planError ?? "",
          steps: [],
        }}
        // Handed the *fresh* session, not just a signal to move on: the plan gave
        // the session its rounds and moved it to the round that shows them, and
        // the provider below seeds itself once from whatever it is given.
        onOpen={() => {
          void fetchSession(sessionId)
            .then(setSession)
            .catch(() => setAttempt((n) => n + 1));
        }}
      />
    );
  }

  return (
    <InterviewSessionProvider initialSession={withFixtureContent(session)}>
      <SessionSync />
      {/* No fixture fallback: an empty transcript is what a session that has not
          started actually has, and the panel already says so. */}
      <RoomShell transcript={session.transcript}>
        <InterviewRoom />
      </RoomShell>
    </InterviewSessionProvider>
  );
}
