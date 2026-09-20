"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/typography";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { useSessionEnd } from "@/lib/interview/use-session-end";
import { formatClock } from "@/lib/interview/format";

/** Long enough to read the two sentences above it, short enough not to strand
 * someone on a screen that has nothing left for them. */
const REDIRECT_SECONDS = 5;

/** The closing screen.
 *
 * Everything here comes from the session. The version this replaces named the two
 * people who would review the candidate, gave a date they would hear by, and
 * promised written feedback either way -- none of which this system knows. A
 * fabricated test result is bad; a fabricated promise about someone's job
 * application is worse, and it is the one a candidate would actually act on.
 *
 * So this says what is true: the interview is over, and here is what was kept. */
export function WrapStage() {
  const { session } = useInterviewSession();
  const elapsed = elapsedSeconds(session.startedAt, session.endedAt);
  const remaining = useCountdown(REDIRECT_SECONDS);
  const router = useRouter();
  // The wrap screen is reachable by advancing as well as by clicking End, so a
  // candidate can arrive here with the interview still running. Leaving from here is a
  // deliberate departure and ends it -- and a client-side navigation fires no pagehide,
  // so nothing else would.
  const endSession = useSessionEnd(session.id, session.startedAt !== null);

  const leave = useCallback(async () => {
    await endSession();
    router.replace("/");
  }, [endSession, router]);

  useEffect(() => {
    if (remaining > 0) return;
    void leave();
  }, [remaining, leave]);

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[64ch] px-6 py-10">
        <Eyebrow>Interview complete</Eyebrow>
        <h2 className="t-h2 mt-2">That&rsquo;s everything. Thank you.</h2>
        <p className="t-body mt-3 leading-[1.7] text-content-subtle">
          Nothing else is asked of you here. You can close this tab, or wait and we
          will take you back to the start.
        </p>

        <div className="mt-5 flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => void leave()}>
            Back to the start
          </Button>
          {/* A count rather than a bare "redirecting": a screen that navigates on its
              own with no warning reads as the app losing the page. */}
          <span className="t-xs text-content-muted" aria-live="polite">
            {remaining > 0
              ? `Going back in ${remaining} second${remaining === 1 ? "" : "s"}.`
              : "Going back now."}
          </span>
        </div>

        <Card className="mt-6 p-4">
          <Eyebrow>What was saved with this session</Eyebrow>
          <ul className="t-small mt-3 flex flex-col gap-2 text-content-subtle">
            <li>The transcript of everything said.</li>
            <li>The code you wrote, every run of it, and what those runs reported.</li>
            {session.consent.recording && <li>The recording you agreed to at the start.</li>}
          </ul>
          {elapsed !== null && (
            <p className="t-xs mt-3 text-content-muted">
              Session length: {formatClock(elapsed)}.
            </p>
          )}
        </Card>

        {/* Deliberately no review timeline and no named reviewers: this system does
            not know who reads an interview or when, and a date invented here is a
            date a candidate would plan around. */}
        <Banner tone="info" className="mt-5">
          <span>
            What happens next is with the team who invited you &mdash; this system
            does not decide it, and will not guess at it.
          </span>
        </Banner>
      </div>
    </div>
  );
}

/** Seconds left before this screen sends the candidate back.
 *
 * In state rather than read from a clock during render, and started from the full
 * count so the server and the first client render agree. */
function useCountdown(from: number): number {
  const [remaining, setRemaining] = useState(from);

  useEffect(() => {
    const timer = setInterval(() => setRemaining((left) => (left > 0 ? left - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  return remaining;
}

/** How long the interview ran.
 *
 * Measured to the end rather than to now, and to the same end the badge in the top bar
 * uses -- this screen said "Session length: 00:30" beside a badge reading "Ended 00:02",
 * which is two answers to one question on one screen. */
function elapsedSeconds(startedAt: string | null, endedAt?: string | null): number | null {
  if (!startedAt) return null;
  const until = endedAt ? new Date(endedAt).getTime() : Date.now();
  const seconds = Math.floor((until - new Date(startedAt).getTime()) / 1000);
  return seconds > 0 ? seconds : null;
}
