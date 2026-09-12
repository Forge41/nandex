"use client";

import { Button } from "@/components/ui/button";
import { AudioBars } from "@/components/ui/audio-bars";
import { VolumeOnIcon, VolumeOffIcon } from "@/components/interview/icons";

const STATE_LABEL: Record<string, string> = {
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  "pre-connect-buffering": "Listening",
  initializing: "Starting up",
  connecting: "Connecting",
  failed: "Unavailable",
  disconnected: "Not connected",
  idle: "Idle",
};

export function InterviewerVoicePill({
  enabled,
  onToggle,
  levels,
  agentState,
}: {
  enabled: boolean;
  onToggle: () => void;
  /** Per-band levels of the interviewer's voice. Absent with no track, which
   * lets the bars self-animate instead of sitting flat. */
  levels?: number[];
  agentState?: string;
}) {
  // Only the agent's own reported state, never a guess: with no agent the pill
  // keeps the design's static label rather than claiming someone is listening.
  const label = (agentState && STATE_LABEL[agentState]) ?? "Interviewer voice";

  return (
    <div className="flex items-center gap-[9px] rounded-full border border-line bg-surface px-[11px] py-1">
      <AudioBars className="h-4" barWidth={3} gap={3} levels={levels} />
      <span className="text-2xs text-content-subtle">{label}</span>
      <span className="h-3 w-px bg-line-strong" />
      <Button
        variant="ghost"
        size="xs"
        className="px-1 text-content-subtle"
        onClick={onToggle}
        title={enabled ? "Mute interviewer voice" : "Unmute interviewer voice"}
      >
        {enabled ? <VolumeOnIcon width={14} height={14} /> : <VolumeOffIcon width={14} height={14} />}
      </Button>
    </div>
  );
}
