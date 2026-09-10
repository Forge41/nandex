"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/typography";
import { useInterviewSession } from "@/lib/interview/session-provider";

/** Scaffolding for rounds that aren't built yet. Says so plainly rather than
 * mocking up a screen that could be mistaken for a finished one. */
export function StagePlaceholder() {
  const { session, dispatch } = useInterviewSession();
  const round = session.rounds.find((r) => r.id === session.activeStage);
  const index = session.rounds.findIndex((r) => r.id === session.activeStage);
  const isLast = index === session.rounds.length - 1;

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-10">
      <div className="max-w-[46ch] text-center">
        <Eyebrow>
          Round {index + 1} · {round?.label}
        </Eyebrow>
        <h2 className="t-h2 mt-3">Not built yet</h2>
        <p className="t-small mt-2 text-content-subtle">
          This round&apos;s screen is still to come. The room chrome, the agenda and the round state around it are
          real — only the centre panel is missing.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Badge tone="neutral">{round?.durationMin} min</Badge>
          <Badge tone="neutral">{round?.kind}</Badge>
        </div>
        {!isLast && (
          <Button variant="secondary" className="mt-6" onClick={() => dispatch({ type: "ADVANCE" })}>
            Continue to next round
          </Button>
        )}
      </div>
    </div>
  );
}
