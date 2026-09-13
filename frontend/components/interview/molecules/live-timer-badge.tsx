import { LiveDot, StatusDot } from "@/components/ui/indicators";
import { Mono } from "@/components/ui/typography";
import { formatClock, formatMinutesAsClock } from "@/lib/interview/format";

export function LiveTimerBadge({
  elapsedSeconds,
  totalMinutes,
  ended = false,
}: {
  elapsedSeconds: number;
  totalMinutes: number;
  /** An interview that is over is not live, and a pulsing dot next to the word
   * says it is. The badge still shows how long it ran, which is true. */
  ended?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-surface-subtle py-1 pr-2.5 pl-2 whitespace-nowrap">
      {ended ? <StatusDot tone="disabled" /> : <LiveDot />}
      <span className={`text-xs font-medium ${ended ? "text-content-muted" : ""}`}>
        {ended ? "Ended" : "Live"}
      </span>
      <span className="h-3 w-px bg-line-strong" />
      <Mono className="text-xs text-content-subtle">{formatClock(elapsedSeconds)}</Mono>
      {!ended && (
        <span className="text-xs text-content-muted">/ {formatMinutesAsClock(totalMinutes)}</span>
      )}
    </div>
  );
}
