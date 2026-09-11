"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Eyebrow } from "@/components/ui/typography";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { MissingRoundContent } from "./missing-round-content";
import type { TimelineStep } from "@/lib/interview/types";

const SCALE = [1, 2, 3, 4, 5];

function TimelineRow({ step, isLast }: { step: TimelineStep; isLast: boolean }) {
  return (
    <div className="flex gap-3.5">
      <div className="flex flex-col items-center">
        <span
          className={
            step.state === "done"
              ? "mt-[5px] size-2.5 rounded-full bg-content"
              : step.state === "current"
                ? "mt-[5px] size-2.5 rounded-full border-[1.5px] border-content"
                : "mt-[5px] size-2.5 rounded-full border-[1.5px] border-line-strong"
          }
        />
        {!isLast && <span className="w-[1.5px] flex-1 bg-line-strong" />}
      </div>
      <div className={isLast ? "" : "pb-4.5"}>
        <div className={`text-sm font-medium ${step.state === "upcoming" ? "text-content-subtle" : ""}`}>
          {step.label}
        </div>
        <div className="t-xs mt-0.5 text-content-muted">{step.detail}</div>
      </div>
    </div>
  );
}

export function WrapStage() {
  const { session } = useInterviewSession();
  const wrap = session.content.wrap;
  const roundNumber = session.rounds.findIndex((r) => r.id === "wrap") + 1;
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!wrap) return <MissingRoundContent />;

  return (
    <div className="scrollbar-thin flex min-h-0 flex-1 justify-center overflow-y-auto px-8 py-9">
      <div className="w-full max-w-[640px]">
        <Eyebrow>Round {roundNumber} · Wrap-up</Eyebrow>
        <h2 className="t-title mt-2.5 text-3xl">{wrap.headline}</h2>
        <p className="t-body mt-2.5 max-w-[58ch] text-content-subtle">{wrap.body}</p>

        <div className="mt-6 flex flex-col">
          {wrap.timeline.map((step, index) => (
            <TimelineRow key={step.label} step={step} isLast={index === wrap.timeline.length - 1} />
          ))}
        </div>

        <Card className="mt-6.5 p-5">
          <h3 className="t-h3">How was the interviewer?</h3>
          <p className="t-small mt-1.5 text-content-subtle">
            Not scored. Shown to the team without your name attached.
          </p>

          <div className="mt-4.5 flex flex-col gap-3.5">
            {wrap.feedbackQuestions.map((question) => (
              <div key={question.id}>
                <div className="text-sm">{question.label}</div>
                <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label={question.label}>
                  {SCALE.map((score) => {
                    const active = ratings[question.id] === score;
                    return (
                      <button
                        key={score}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={`${score} out of 5`}
                        onClick={() => setRatings((current) => ({ ...current, [question.id]: score }))}
                        className={`flex h-7 flex-1 items-center justify-center rounded-sm text-xs transition-colors ${
                          active
                            ? "bg-surface-interactive text-content-on-interactive"
                            : "border border-line text-content-muted hover:bg-surface-hover"
                        }`}
                      >
                        {score}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <Label htmlFor="wrap-notes" className="mb-1.5 block text-xs font-medium text-content-subtle">
                Anything the agent got wrong?
              </Label>
              <Textarea
                id="wrap-notes"
                placeholder="Optional"
                className="h-[76px] resize-none"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>

          {submitted ? (
            <Banner tone="success" className="mt-4.5">
              <span>Thanks — your feedback is recorded against the session, without your name.</span>
            </Banner>
          ) : (
            <Button
              variant="primary"
              className="mt-4.5"
              disabled={Object.keys(ratings).length === 0}
              onClick={() => setSubmitted(true)}
            >
              Submit feedback
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
