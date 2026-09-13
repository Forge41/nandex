"use client";

import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/typography";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { formatClock } from "@/lib/interview/format";

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
  const elapsed = elapsedSeconds(session.startedAt);

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[64ch] px-6 py-10">
        <Eyebrow>Interview complete</Eyebrow>
        <h2 className="t-h2 mt-2">That&rsquo;s everything. Thank you.</h2>
        <p className="t-body mt-3 leading-[1.7] text-content-subtle">
          Nothing else is asked of you here. You can close this tab.
        </p>

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

function elapsedSeconds(startedAt: string | null): number | null {
  if (!startedAt) return null;
  const seconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  return seconds > 0 ? seconds : null;
}
