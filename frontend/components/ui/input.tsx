import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "block h-9 w-full min-w-0 rounded-md px-3 text-sm text-content transition-[background-color,border-color] duration-[80ms] outline-none placeholder:text-content-muted disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border border-line bg-surface hover:bg-surface-subtle focus-visible:border-line-interactive focus-visible:bg-surface-subtle",
        filled: "border border-transparent bg-surface-input hover:bg-surface-input-hover focus-visible:border-line-interactive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Input({
  className,
  variant,
  type,
  ...props
}: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return <input type={type} data-slot="input" className={cn(inputVariants({ variant, className }))} {...props} />;
}

export { Input, inputVariants };
