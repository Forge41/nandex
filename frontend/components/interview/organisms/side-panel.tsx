"use client";

import { VideoTrack } from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { LiveDot } from "@/components/ui/indicators";
import { Mono } from "@/components/ui/typography";
import { CollapseIcon } from "@/components/interview/icons";
import { TranscriptTurn } from "@/components/interview/molecules/transcript-turn";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { useRoomState } from "@/lib/interview/room-provider";
import { derivePanelCopy } from "@/lib/interview/selectors";
import { useTranscript } from "@/lib/interview/transcript-provider";
import { formatClock, initialsOf } from "@/lib/interview/format";

/** The candidate's own camera, as published to the room -- not a second
 * independent stream, which would fight the pre-flight camera test for the
 * device. Falls back to the hatched placeholder when no camera is published.
 *
 * The REC badge is conditional on the provider reporting an active recording.
 * Claiming "REC" with nothing recording is the same fabrication the rail's
 * connection label was deliberately left empty to avoid. */
function ProctorTile() {
  const { selfCameraTrack, isRecording } = useRoomState();

  return (
    <div className="flex gap-2 border-b border-line p-3">
      <div className="bg-stripes relative flex aspect-4/3 flex-1 items-center justify-center overflow-hidden rounded-md">
        {selfCameraTrack ? (
          <VideoTrack
            trackRef={selfCameraTrack}
            // Mirrored, so the candidate sees themselves the way a mirror does.
            className="absolute inset-0 size-full scale-x-[-1] object-cover"
          />
        ) : (
          <Mono className="text-[10px] text-content-muted">camera off</Mono>
        )}
        {isRecording && (
          <span className="absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded-full bg-surface px-1.5 py-0.5">
            <LiveDot size={5} />
            <span className="text-[9px] font-medium">REC</span>
          </span>
        )}
      </div>
    </div>
  );
}

export function SidePanel({ showProctor }: { showProctor: boolean }) {
  const { session } = useInterviewSession();
  const transcript = useTranscript();
  const { panelOpen, togglePanel } = useRoomState();
  const panel = derivePanelCopy(session.activeStage, panelOpen);
  const initials = initialsOf(session.candidateName);

  const copyTranscript = () => {
    const text = transcript
      .map((turn) => `[${formatClock(turn.atSeconds)}] ${turn.speaker === "interviewer" ? "Interviewer" : "You"}: ${turn.text}`)
      .join("\n");
    void navigator.clipboard?.writeText(text);
  };

  return (
    <aside
      data-open={panelOpen}
      className="w-[312px] shrink-0 overflow-hidden border-l border-line bg-surface transition-[width] duration-[260ms] ease-out data-[open=false]:w-[42px]"
    >
      {!panelOpen ? (
        <div className="flex h-full w-[42px] flex-col items-center gap-3 bg-surface-subtle py-3">
          <IconButton size="sm" onClick={togglePanel} title={panel.title}>
            <CollapseIcon width={13} height={13} />
          </IconButton>
          <span className="t-eyebrow text-content-muted [writing-mode:vertical-rl]">{panel.railLabel}</span>
        </div>
      ) : (
        <div className="flex h-full w-[312px] min-h-0 flex-col">
          {showProctor && <ProctorTile />}

          <header className="flex shrink-0 items-center gap-2 border-b border-line py-[11px] pr-2.5 pl-3.5">
            <LiveDot size={6} />
            <span className="flex-1 text-sm font-medium">Live transcript</span>
            <Button variant="ghost" size="xs" className="text-content-subtle" onClick={copyTranscript}>
              Copy
            </Button>
          </header>

          <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-3.5">
            {transcript.length === 0 ? (
              <p className="text-sm text-content-muted">The transcript starts when the interviewer does.</p>
            ) : (
              transcript.map((turn) => (
                <TranscriptTurn key={turn.id} turn={turn} variant="compact" candidateInitials={initials} />
              ))
            )}
          </div>

          <footer className="flex shrink-0 items-center gap-2 border-t border-line bg-surface-subtle py-3 pr-3 pl-3.5">
            <span className="t-xs flex-1 text-content-muted">Transcript is saved with the session.</span>
            <Button variant="secondary" size="xs" disabled title="Available once the live interviewer is connected">
              Ask for a hint
            </Button>
          </footer>
        </div>
      )}
    </aside>
  );
}
