import * as React from "react";
import { cn } from "@/lib/utils";

/** The numbered chip that ties a claim back to the line it came from. Sized and
 * baseline-shifted to sit inside running prose without disturbing line height. */
function Citation({
  n,
  selected,
  className,
  ...props
}: React.ComponentProps<"button"> & { n: number; selected?: boolean }) {
  return (
    <button
      type="button"
      data-slot="citation"
      data-selected={selected}
      aria-label={`Source ${n}`}
      className={cn(
        "inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-[3px] border-[0.5px] border-content-muted/30 bg-transparent px-0.5 align-[2px] font-sans text-[10px] font-medium text-content-muted transition-colors duration-[80ms] mx-px hover:bg-surface-component",
        "data-[selected=true]:border-surface-interactive data-[selected=true]:bg-surface-interactive data-[selected=true]:text-content-on-color",
        className
      )}
      {...props}
    >
      {n}
    </button>
  );
}

export { Citation };
