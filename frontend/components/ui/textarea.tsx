import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-content transition-[background-color,border-color] duration-[80ms] outline-none placeholder:text-content-muted hover:bg-surface-subtle focus-visible:border-line-interactive focus-visible:bg-surface-subtle disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
