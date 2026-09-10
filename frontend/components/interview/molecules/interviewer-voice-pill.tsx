"use client";

import { Button } from "@/components/ui/button";
import { AudioBars } from "@/components/ui/audio-bars";
import { VolumeOnIcon, VolumeOffIcon } from "@/components/interview/icons";

export function InterviewerVoicePill({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-[9px] rounded-full border border-line bg-surface px-[11px] py-1">
      <AudioBars className="h-4" barWidth={3} gap={3} />
      <span className="text-2xs text-content-subtle">Interviewer voice</span>
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
