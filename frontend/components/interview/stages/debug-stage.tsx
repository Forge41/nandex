"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mono } from "@/components/ui/typography";
import { CodeSurface } from "@/components/ui/code-surface";
import { RoundHeader } from "@/components/interview/molecules/round-header";
import { TerminalPanel } from "@/components/interview/organisms/terminal-panel";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { useCountdown } from "@/lib/hooks/use-countdown";
import { formatClock } from "@/lib/interview/format";
import { MissingRoundContent } from "./missing-round-content";

export function DebugStage() {
  const { session, dispatch } = useInterviewSession();
  const task = session.content.debug;
  const roundNumber = session.rounds.findIndex((r) => r.id === "debug") + 1;
  const remaining = useCountdown(task?.secondsRemaining ?? 0);
  const [code, setCode] = useState(task?.file.content ?? "");

  if (!task) return <MissingRoundContent />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RoundHeader
        eyebrow={`Round ${roundNumber} · Debug drill`}
        prompt={task.prompt}
        className="px-6 py-4"
        aside={
          <>
            <Badge tone="danger">{task.badgeLabel}</Badge>
            <Mono className={remaining === 0 ? "text-xs text-content-muted" : "text-xs text-danger"}>
              {remaining === 0 ? "time up" : `${formatClock(remaining)} left`}
            </Mono>
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        <CodeSurface
          value={code}
          language={task.file.language}
          onChange={setCode}
          startLine={task.startLine}
          highlightLine={task.faultLine}
          className="min-w-0 flex-1"
        />

        <TerminalPanel
          title="Trace · reproduce"
          lines={task.trace}
          className="w-[340px] shrink-0 border-l border-line"
          footer={
            <div className="flex shrink-0 gap-2 border-t border-[hsl(0_0%_100%/0.1)] p-3">
              <Button variant="secondary" size="sm" className="flex-1" disabled title="Speak to the interviewer instead">
                Explain out loud
              </Button>
              <Button variant="primary" size="sm" className="flex-1" onClick={() => dispatch({ type: "ADVANCE" })}>
                Submit fix
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}
