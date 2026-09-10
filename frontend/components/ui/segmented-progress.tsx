import * as React from "react";
import { cn } from "@/lib/utils";

const SEGMENT_TONE = {
  on: "bg-content",
  off: "bg-line-strong",
  active: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

export type SegmentTone = keyof typeof SEGMENT_TONE;

/** Row of discrete bars. Serves the header round ticks, the quiz step meter and
 * the attempts meter -- same shape, different fills and geometry. */
function SegmentedProgress({
  segments,
  segmentClassName,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  segments: SegmentTone[];
  segmentClassName?: string;
}) {
  return (
    <div data-slot="segmented-progress" className={cn("flex items-center gap-1", className)} {...props}>
      {segments.map((tone, i) => (
        <span
          key={i}
          className={cn("h-[3px] flex-1 rounded-[2px]", SEGMENT_TONE[tone], segmentClassName)}
        />
      ))}
    </div>
  );
}

export { SegmentedProgress };
