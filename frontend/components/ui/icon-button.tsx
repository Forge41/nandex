import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** `off` and `danger` are deliberately independent, matching the design: a
 * muted mic reads as danger (red fill, no strike) while a stopped screen share
 * reads as off (struck through, no alarm). */
const iconButtonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center border border-line bg-surface text-content transition-[background-color,border-color,color] duration-[80ms]",
    "hover:bg-btn-neutral-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line-interactive disabled:pointer-events-none disabled:opacity-50",
    "data-[off=true]:border-transparent data-[off=true]:bg-transparent data-[off=true]:text-content-muted",
    "data-[off=true]:after:absolute data-[off=true]:after:inset-x-[5px] data-[off=true]:after:top-1/2 data-[off=true]:after:h-[1.4px] data-[off=true]:after:-rotate-45 data-[off=true]:after:rounded-[1px] data-[off=true]:after:bg-current data-[off=true]:after:content-['']",
    "data-[danger=true]:border-danger-border data-[danger=true]:bg-danger-bg data-[danger=true]:text-danger",
  ],
  {
    variants: {
      size: {
        default: "size-[30px] rounded-md",
        sm: "size-[26px] rounded-sm",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

function IconButton({
  className,
  size,
  off,
  danger,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof iconButtonVariants> & { off?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      data-slot="icon-button"
      data-off={off}
      data-danger={danger}
      className={cn(iconButtonVariants({ size, className }))}
      {...props}
    />
  );
}

export { IconButton, iconButtonVariants };
