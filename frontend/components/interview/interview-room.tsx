"use client";

import { InterviewTopBar } from "./organisms/interview-top-bar";
import { AgendaRail } from "./organisms/agenda-rail";
import { ControlBar } from "./organisms/control-bar";
import { SidePanel } from "./organisms/side-panel";
import { StagePlaceholder } from "./stages/stage-placeholder";
import { STAGE_COMPONENTS } from "./stages/registry";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { stageChrome } from "@/lib/interview/selectors";

export function InterviewRoom() {
  const { session } = useInterviewSession();
  const chrome = stageChrome(session.activeStage, session.consent);
  const Stage = STAGE_COMPONENTS[session.activeStage] ?? StagePlaceholder;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface text-content">
      {chrome.topBar && <InterviewTopBar />}

      <div className="relative flex min-h-0 flex-1">
        <AgendaRail />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
          <Stage />
          {chrome.controlBar && <ControlBar />}
        </div>

        {chrome.sidePanel && <SidePanel showProctor={chrome.proctor} />}
      </div>
    </div>
  );
}
