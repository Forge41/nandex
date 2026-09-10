"use client";

import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { Eyebrow } from "@/components/ui/typography";
import { LockIcon } from "@/components/interview/icons";
import { PlanCard } from "@/components/interview/molecules/plan-card";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { derivePlanSummary, deriveNextLockLabel } from "@/lib/interview/selectors";

export function GeneratedPlanPanel() {
  const { session, dispatch } = useInterviewSession();
  const plan = derivePlanSummary(session);
  const lockLabel = deriveNextLockLabel(session);

  return (
    <div className="scrollbar-thin flex w-[400px] shrink-0 flex-col overflow-y-auto bg-surface-subtle px-6 py-6">
      <Eyebrow>Generated plan</Eyebrow>
      <h3 className="t-h3 mt-1.5">{plan.heading}</h3>
      <p className="t-small mt-2 text-content-subtle">Each round cites the resume line that motivated it.</p>

      {/* Negative inset gives the cards room to scale on hover without being
          clipped by the scroll container. */}
      <div className="my-4 -mx-1 flex flex-none flex-col gap-2 px-1 py-0.5">
        {plan.cards.map((card) => (
          <PlanCard
            key={card.id}
            label={card.label}
            durationMin={card.durationMin}
            summary={card.summary}
            citation={card.citation}
          />
        ))}
        {plan.remainder && (
          <PlanCard
            dashed
            muted
            label={`+ ${plan.remainder.count} shorter rounds`}
            durationMin={plan.remainder.durationMin}
            summary={plan.remainder.labels}
          />
        )}
      </div>

      <Banner tone="info" className="mt-auto">
        <span>Rounds unlock one at a time. You&apos;ll always see what&apos;s next before it starts.</span>
      </Banner>

      <Button variant="primary" className="mt-4 w-full" onClick={() => dispatch({ type: "ADVANCE" })}>
        Start interview
      </Button>

      <div className="mt-3 flex items-center justify-center gap-[7px]">
        <LockIcon width={11} height={11} className="shrink-0 text-content-muted" />
        <span className="text-xs leading-[1.45] text-content-muted">{lockLabel}</span>
      </div>
    </div>
  );
}
