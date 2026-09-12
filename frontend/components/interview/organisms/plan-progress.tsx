"use client";

import { Button } from "@/components/ui/button";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { CheckIcon } from "@/components/interview/icons";
import type { PlanStep } from "@/lib/api/interview";

/** One step of the work being done to the candidate's resume.
 *
 * Nothing here decides what the steps are: they arrive from the workflow that
 * is running them, so a step on screen is a thing being done rather than a
 * thing this file believes happens. */
function Step({ step }: { step: PlanStep }) {
  const done = step.state === "done";
  const running = step.state === "running";
  const failed = step.state === "failed";

  return (
    <li className="flex items-start gap-3 py-2.5">
      <span
        aria-hidden
        className={`mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full border ${
          done
            ? "border-success bg-success-bg text-success"
            : failed
              ? "border-danger bg-danger-bg text-danger"
              : running
                ? "border-line-interactive"
                : "border-line"
        }`}
      >
        {done && <CheckIcon width={10} height={10} />}
        {failed && <span className="text-[11px] leading-none">!</span>}
        {running && (
          <span className="size-[6px] animate-[live-pulse_1.4s_ease-in-out_infinite] rounded-full bg-content" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm ${done || running ? "text-content" : failed ? "text-danger" : "text-content-muted"}`}
        >
          {step.label}
        </span>
        {step.detail && (
          <Mono className="mt-0.5 block truncate text-2xs text-content-muted">{step.detail}</Mono>
        )}
      </span>
    </li>
  );
}

export function PlanProgress({
  steps,
  error,
  onRetry,
}: {
  steps: PlanStep[];
  error?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex h-dvh items-center justify-center bg-surface px-6 text-content">
      <div className="w-full max-w-[420px]">
        <Eyebrow>Reading your resume</Eyebrow>
        <h1 className="t-h1 mt-2">Building your interview</h1>
        <p className="t-small mt-2 text-content-subtle">
          Every round is written from your own document, so this takes a moment.
        </p>

        {/* No placeholder rows: until the workflow has said what it is doing,
            inventing a list here would be guessing at its plan. */}
        <ul className="mt-6 flex flex-col">
          {steps.map((step) => (
            <Step key={step.id} step={step} />
          ))}
        </ul>

        {error && (
          <div className="mt-5 rounded-md bg-danger-bg px-3 py-2.5">
            <p className="text-sm text-danger">{error}</p>
            {onRetry && (
              <Button variant="secondary" size="sm" className="mt-2.5" onClick={onRetry}>
                Start over
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
