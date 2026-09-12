"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSession } from "@/lib/api/interview";
import { Button } from "@/components/ui/button";

/** Until a real invitation flow exists, every interview is for this role. It is
 * one constant rather than scattered defaults so there is a single thing to
 * replace when the role comes from whoever set the interview up. */
const ROLE_TITLE = "Senior Backend Engineer — Payments";

/** Starts a real interview and hands the candidate its own URL.
 *
 * Client-side because the session belongs to whoever's browser asks: the
 * anonymous identity is a cookie minted on first contact, and creating the
 * session from the server would attach it to the wrong one. */
export default function Home() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // React runs effects twice in development; without this the candidate gets
  // two sessions and lands in the second, orphaning the first.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    createSession(ROLE_TITLE)
      .then((session) => router.replace(`/interview/${session.id}`))
      .catch(() => {
        started.current = false;
        setFailed(true);
      });
  }, [router, attempt]);

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-surface text-content">
      {failed ? (
        <>
          <p className="t-body text-content-subtle">We couldn&apos;t start your interview.</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </>
      ) : (
        <p className="t-body text-content-muted">Setting up your interview…</p>
      )}
    </div>
  );
}
