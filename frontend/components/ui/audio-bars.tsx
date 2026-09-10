import * as React from "react";
import { cn } from "@/lib/utils";

/** Bar equaliser matching LiveKit's BarVisualizer geometry: uniform bars, gap
 * equal to bar width, scaled from the centre.
 *
 * Pass `levels` (0-1 per bar) to drive it from a real audio track; with no
 * levels it self-animates, which is what the pre-join and idle states want. */
function AudioBars({
  barCount = 5,
  barWidth = 3,
  gap = 3,
  levels,
  className,
  style,
  ...props
}: React.ComponentProps<"span"> & {
  barCount?: number;
  barWidth?: number;
  gap?: number;
  levels?: number[];
}) {
  const centre = (barCount - 1) / 2;

  return (
    <span
      aria-hidden
      data-slot="audio-bars"
      className={cn("flex items-center justify-center text-content", className)}
      style={{ gap, ...style }}
      {...props}
    >
      {Array.from({ length: barCount }, (_, i) => {
        const level = levels?.[i];
        return (
          <span
            key={i}
            className={cn("h-full origin-center rounded-[2px] bg-current", level === undefined && "animate-audio-bar")}
            style={{
              width: barWidth,
              // Mirror the delay outward from the centre bar so the motion reads
              // as a pulse rather than a left-to-right wave.
              animationDelay: level === undefined ? `${Math.abs(i - centre) * 120}ms` : undefined,
              transform: level === undefined ? undefined : `scaleY(${Math.max(0.22, level)})`,
            }}
          />
        );
      })}
    </span>
  );
}

export { AudioBars };
