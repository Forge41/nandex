"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSession } from "@/lib/api/interview";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/typography";
import { ThemeToggle } from "@/components/interview/molecules/theme-toggle";
import { DEFAULT_ROUNDS } from "@/lib/interview/agenda";

/** Until a real invitation flow exists, every interview is for this role. One
 * constant, so there is a single thing to replace when the role comes from
 * whoever set the interview up. */
const ROLE_TITLE = "Senior Backend Engineer — Payments";

const TOTAL_MINUTES = DEFAULT_ROUNDS.reduce((total, round) => total + round.durationMin, 0);

/** The front door.
 *
 * Deliberately does not create anything on arrival. Visiting a URL should not
 * enrol you in a recorded interview -- the session is real from the moment it
 * exists, so it exists when the candidate says to start.
 */
export default function Home() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);

  const start = () => {
    setStarting(true);
    setFailed(false);
    createSession(ROLE_TITLE)
      .then((session) => router.push(`/interview/${session.id}`))
      .catch(() => {
        setStarting(false);
        setFailed(true);
      });
  };

  return (
    <main className="flex h-dvh flex-col bg-surface text-content">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-[520px]">
          <Eyebrow>AI interview room</Eyebrow>
          <h1 className="t-display mt-3 text-4xl">Your interview, when you&apos;re ready.</h1>
          <p className="t-body mt-4 text-content-subtle">
            {DEFAULT_ROUNDS.length} rounds, about {TOTAL_MINUTES} minutes. You upload a resume, the
            interviewer builds every question from it, and you see what was read before anything is
            scored.
          </p>
          <p className="t-small mt-3 text-content-muted">
            Nothing is recorded until you have checked your devices and agreed to the terms. The
            next screen is that check.
          </p>

          <div className="mt-8 flex items-center gap-3">
            <Button variant="primary" onClick={start} disabled={starting}>
              {starting ? "Setting up…" : "Start interview"}
            </Button>
            {failed && (
              <span role="alert" className="t-small text-danger">
                We couldn&apos;t start your interview. Try again.
              </span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
