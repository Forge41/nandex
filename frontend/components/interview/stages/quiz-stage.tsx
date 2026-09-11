"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { SegmentedProgress, type SegmentTone } from "@/components/ui/segmented-progress";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { useCountdown } from "@/lib/hooks/use-countdown";
import { formatClock } from "@/lib/interview/format";
import { MissingRoundContent } from "./missing-round-content";

function confidenceLabel(value: number): string {
  if (value < 25) return "not sure";
  if (value < 55) return "leaning";
  if (value < 85) return "fairly sure";
  return "high";
}

export function QuizStage() {
  const { session, dispatch } = useInterviewSession();
  const question = session.content.quiz;
  const roundNumber = session.rounds.findIndex((r) => r.id === "quiz") + 1;
  const remaining = useCountdown(question?.secondsRemaining ?? 0);
  const [choice, setChoice] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(78);

  if (!question) return <MissingRoundContent />;

  const progress: SegmentTone[] = Array.from({ length: question.total }, (_, index) =>
    index < question.index - 1 ? "on" : index === question.index - 1 ? "active" : "off"
  );

  return (
    <div className="scrollbar-thin flex min-h-0 flex-1 justify-center overflow-y-auto px-8 py-9">
      <div className="w-full max-w-[660px]">
        <div className="flex items-center justify-between">
          <Eyebrow>Round {roundNumber} · Knowledge check</Eyebrow>
          <Mono className="text-xs text-content-subtle">
            {question.index} of {question.total} · {formatClock(remaining)} left
          </Mono>
        </div>

        <SegmentedProgress className="mt-2.5 gap-1" segments={progress} />

        <h2 className="t-h2 mt-6 leading-[1.35]">{question.prompt}</h2>

        <div className="mt-5 flex flex-col gap-2" role="radiogroup" aria-label="Answer options">
          {question.options.map((option) => {
            const selected = choice === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setChoice(option.id)}
                className={`flex items-start gap-3 rounded-md p-3.5 text-left transition-colors ${
                  selected
                    ? "border-[1.5px] border-line-interactive bg-surface-subtle"
                    : "border border-line hover:bg-surface-hover"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 grid size-4 shrink-0 place-content-center rounded-full border-[1.5px] ${
                    selected ? "border-surface-interactive bg-surface-interactive" : "border-content-muted"
                  }`}
                >
                  {selected && <span className="size-1.5 rounded-full bg-content-on-interactive" />}
                </span>
                <span className="t-body">{option.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5.5 rounded-md border border-line bg-surface-subtle px-4 py-3.5">
          <div className="flex items-center justify-between">
            <Eyebrow>How sure are you?</Eyebrow>
            <Mono className="text-xs">{confidenceLabel(confidence)}</Mono>
          </div>
          <Slider
            className="mt-2.5"
            value={[confidence]}
            onValueChange={([next]) => setConfidence(next)}
            max={100}
            step={1}
            aria-label="Confidence"
          />
          <p className="t-xs mt-2 text-content-muted">
            Confidence is scored separately — a calibrated “not sure” costs you nothing.
          </p>
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          <Button variant="primary" disabled={choice === null} onClick={() => dispatch({ type: "ADVANCE" })}>
            Next question
          </Button>
          <Button variant="ghost" className="text-content-subtle" onClick={() => dispatch({ type: "ADVANCE" })}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}
