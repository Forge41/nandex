"use client";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { MicIcon, VideoIcon, MonitorIcon, CaptionsIcon, SkipIcon } from "@/components/interview/icons";
import { InterviewerVoicePill } from "@/components/interview/molecules/interviewer-voice-pill";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { useRoomState } from "@/lib/interview/room-provider";

function Divider() {
  return <span className="mx-1 h-5 w-px bg-line-strong" />;
}

export function ControlBar() {
  const { session, dispatch } = useInterviewSession();
  const room = useRoomState();

  const roundIndex = session.rounds.findIndex((r) => r.id === session.activeStage);
  const isLastRound = roundIndex === session.rounds.length - 1;
  // Skipping is only offered once the interview proper has started -- there is
  // nothing to skip during set-up, and nothing after wrap-up.
  const canSkip = roundIndex >= 2 && !isLastRound;

  return (
    <footer className="flex h-13 shrink-0 items-center justify-center gap-2 border-t border-line bg-surface-subtle px-4">
      <IconButton
        danger={!room.micEnabled}
        disabled={room.devicePending}
        onClick={room.toggleMic}
        title={room.micEnabled ? "Microphone on" : "Microphone muted"}
        aria-pressed={room.micEnabled}
      >
        <MicIcon />
      </IconButton>
      <IconButton
        danger={!room.cameraEnabled}
        disabled={room.devicePending}
        onClick={room.toggleCamera}
        title={room.cameraEnabled ? "Camera on" : "Camera off"}
        aria-pressed={room.cameraEnabled}
      >
        <VideoIcon />
      </IconButton>
      <IconButton
        off={!room.screenEnabled}
        disabled={room.devicePending}
        onClick={room.toggleScreen}
        title={room.screenEnabled ? "Sharing screen" : "Not sharing screen"}
        aria-pressed={room.screenEnabled}
      >
        <MonitorIcon />
      </IconButton>
      <IconButton
        off={!room.captionsEnabled}
        onClick={room.toggleCaptions}
        title={room.captionsEnabled ? "Captions on" : "Captions off"}
        aria-pressed={room.captionsEnabled}
      >
        <CaptionsIcon />
      </IconButton>

      <Divider />

      <InterviewerVoicePill
        enabled={room.interviewerVoiceEnabled}
        onToggle={room.toggleInterviewerVoice}
        levels={room.agentLevels}
        agentState={room.agentState}
      />

      {canSkip && (
        <>
          <Divider />
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-content-subtle"
            onClick={() => dispatch({ type: "ADVANCE" })}
          >
            Skip round
            <SkipIcon width={13} height={13} />
          </Button>
        </>
      )}
    </footer>
  );
}
