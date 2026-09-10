"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";

/** Inset pill track with a raised active item. Always single-select, so `type`
 * is fixed rather than exposed. */
function Segmented({
  className,
  children,
  ...props
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      data-slot="segmented"
      className={cn("inline-flex w-fit items-center gap-0.5 rounded-md bg-surface-component p-0.5", className)}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Root>
  );
}

function SegmentedItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="segmented-item"
      className={cn(
        "shrink-0 rounded-sm px-3 py-1 text-xs font-medium whitespace-nowrap text-content-subtle transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-line-interactive disabled:pointer-events-none disabled:opacity-50",
        "data-[state=on]:bg-surface data-[state=on]:text-content data-[state=on]:shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className
      )}
      {...props}
    />
  );
}

export { Segmented, SegmentedItem };
