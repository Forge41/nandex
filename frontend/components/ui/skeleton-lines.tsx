import * as React from "react";
import { cn } from "@/lib/utils";

/** Redacted text lines. Stands in for resume body copy in the document preview,
 * where the words are deliberately unreadable and only the shape matters. */
function SkeletonLines({
  widths,
  lineHeight = 3,
  className,
  ...props
}: React.ComponentProps<"div"> & { widths: number[]; lineHeight?: number }) {
  return (
    <div data-slot="skeleton-lines" className={cn("flex flex-col gap-[5px]", className)} {...props}>
      {widths.map((width, i) => (
        <span key={i} className="rounded-[2px] bg-line-strong" style={{ width: `${width}%`, height: lineHeight }} />
      ))}
    </div>
  );
}

export { SkeletonLines };
