import { LiveDot } from "@/components/ui/indicators";
import { Mono } from "@/components/ui/typography";
import { formatClock, formatMinutesAsClock } from "@/lib/interview/format";

export function LiveTimerBadge({
  elapsedSeconds,
  totalMinutes,
}: {
  elapsedSeconds: number;
  totalMinutes: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-surface-subtle py-1 pr-2.5 pl-2 whitespace-nowrap">
      <LiveDot />
      <span className="text-xs font-medium">Live</span>
      <span className="h-3 w-px bg-line-strong" />
      <Mono className="text-xs text-content-subtle">{formatClock(elapsedSeconds)}</Mono>
      <span className="text-xs text-content-muted">/ {formatMinutesAsClock(totalMinutes)}</span>
    </div>
  );
}
