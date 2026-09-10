import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Mono } from "@/components/ui/typography";
import { TypingCaret } from "@/components/ui/indicators";
import { formatClock } from "@/lib/interview/format";
import type { TranscriptTurn as Turn } from "@/lib/interview/types";

/** `full` is the centre-stage transcript, `compact` the side panel. Same turn,
 * two densities -- the panel drops avatars and assessment chips for width. */
export function TranscriptTurn({
  turn,
  variant = "full",
  candidateInitials,
}: {
  turn: Turn;
  variant?: "full" | "compact";
  candidateInitials: string;
}) {
  const isInterviewer = turn.speaker === "interviewer";
  const speaker = isInterviewer ? "Interviewer" : "You";
  const timestamp = formatClock(turn.atSeconds);

  if (variant === "compact") {
    return (
      <div className={cn(turn.inProgress && "opacity-80")}>
        <div className="flex items-baseline gap-2">
          <Mono className="text-[10px] text-content-disabled">{timestamp}</Mono>
          <span className="text-xs font-medium text-content-subtle">
            {speaker}
            {turn.inProgress && <span className="font-normal text-content-muted"> · speaking</span>}
          </span>
        </div>
        <p className="mt-1 text-sm leading-[1.55]">
          {turn.text}
          {turn.inProgress && <TypingCaret width={6} height={12} className="ml-[3px]" />}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", turn.inProgress && "opacity-75")}>
      <Mono className="w-[34px] shrink-0 pt-[3px] text-2xs text-content-muted">{timestamp}</Mono>
      <Avatar size="sm">
        <AvatarFallback className={isInterviewer ? "bg-surface-interactive text-content-on-interactive" : undefined}>
          {isInterviewer ? "AI" : candidateInitials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-content-subtle">
          {speaker}
          {turn.inProgress && <span className="font-normal text-content-muted"> · speaking</span>}
        </div>
        <p className="mt-[3px] text-base leading-[1.6]">
          {turn.text}
          {turn.inProgress && <TypingCaret className="ml-[3px]" />}
        </p>
        {turn.assessments && turn.assessments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {turn.assessments.map((assessment) => (
              <Badge key={assessment.label} tone={assessment.tone} size="sm">
                {assessment.label}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
