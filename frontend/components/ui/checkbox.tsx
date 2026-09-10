"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-xs border-[1.5px] border-content-muted bg-transparent transition-[background-color,border-color] duration-[80ms] outline-none hover:border-content-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line-interactive disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-surface-interactive data-[state=checked]:bg-surface-interactive data-[state=checked]:text-content-on-interactive",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="grid place-content-center text-current">
        <CheckIcon className="size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
