"use client";

import { cn } from "@/lib/utils";
import { Mono } from "@/components/ui/typography";
import { CitationChip } from "./citation-chip";

/** Plan tile that lifts on hover and reveals why the round exists.
 *
 * The description collapses via max-height rather than display:none so it
 * stays in the accessibility tree for anyone who can't hover. */
export function PlanCard({
  label,
  durationMin,
  summary,
  citation,
  dashed,
  muted,
}: {
  label: string;
  durationMin: number;
  summary?: string;
  citation?: number;
  dashed?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "group/plan relative overflow-hidden rounded-md border bg-surface p-3 transition-[transform,box-shadow,border-color] duration-[240ms] ease-[cubic-bezier(.2,.8,.2,1)]",
        "hover:z-[2] hover:scale-[1.035] hover:border-line-strong hover:shadow-[0_12px_28px_-12px_hsl(40_20%_10%/0.28)]",
        dashed ? "border-dashed border-line-strong" : "border-line"
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] bg-[linear-gradient(180deg,hsl(var(--ui-danger-fg)),hsl(var(--ui-gold-fg)),hsl(var(--ui-jade-fg)),hsl(var(--ui-blue-fg)),hsl(var(--ui-violet-fg)))] opacity-0 transition-opacity duration-[240ms] group-hover/plan:opacity-100"
      />

      <div className="flex items-center justify-between gap-2.5">
        <span className={cn("text-sm font-medium", muted && "text-content-subtle")}>{label}</span>
        <Mono className="shrink-0 text-2xs text-content-muted">{durationMin} min</Mono>
      </div>

      {summary && (
        <p
          className={cn(
            "t-xs max-h-0 overflow-hidden opacity-0 transition-[max-height,opacity,margin-top] duration-[260ms] ease-[cubic-bezier(.2,.8,.2,1)]",
            "group-hover/plan:mt-1.5 group-hover/plan:max-h-[70px] group-hover/plan:opacity-100",
            muted ? "text-content-muted" : "text-content-subtle"
          )}
        >
          {summary}
          {citation !== undefined && <CitationChip n={citation} />}
        </p>
      )}
    </div>
  );
}
