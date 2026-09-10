"use client";

import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { SegmentedProgress } from "@/components/ui/segmented-progress";
import { PanelIcon } from "@/components/interview/icons";
import { LiveTimerBadge } from "@/components/interview/molecules/live-timer-badge";
import { useElapsedSeconds } from "@/lib/hooks/use-elapsed-seconds";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { useRoomState } from "@/lib/interview/room-provider";
import { deriveRoundHeader, derivePanelCopy } from "@/lib/interview/selectors";

function SessionHelp() {
  const { session } = useInterviewSession();

  return (
    <HoverCard openDelay={120}>
      <HoverCardTrigger asChild>
        <Button variant="secondary" size="sm">
          Help
        </Button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-[280px] text-sm">
        <ul className="flex flex-col gap-2 text-content-subtle">
          <li>
            {session.rounds.length} rounds, about {session.totalDurationMin} minutes. Rounds unlock one at a time.
          </li>
          <li>Your interviewer is an AI agent. You can ask for a human interviewer at any point.</li>
          <li>Two humans review the transcript and your code before anything is decided.</li>
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}

export function InterviewTopBar() {
  const { session, dispatch } = useInterviewSession();
  const { panelOpen, togglePanel } = useRoomState();
  const elapsedSeconds = useElapsedSeconds(session.startedAt);

  const header = deriveRoundHeader(session);
  const panel = derivePanelCopy(session.activeStage, panelOpen);

  return (
    <header className="relative flex h-13 shrink-0 items-center gap-4 border-b border-line bg-surface px-4">
      <LiveTimerBadge elapsedSeconds={elapsedSeconds} totalMinutes={session.totalDurationMin} />

      <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 text-xs whitespace-nowrap text-content-muted">
        <span>{header.label}</span>
        <SegmentedProgress
          segments={header.ticks}
          segmentClassName="h-[3px] w-2 flex-none"
          className="gap-[3px]"
        />
      </div>

      <div className="ml-auto flex items-center justify-end gap-2 whitespace-nowrap">
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={togglePanel} title={panel.title}>
          <PanelIcon width={14} height={14} />
          {panel.buttonLabel}
        </Button>
        <SessionHelp />
        <Button variant="danger" size="sm" onClick={() => dispatch({ type: "END_SESSION" })}>
          End session
        </Button>
      </div>
    </header>
  );
}
