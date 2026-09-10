import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const tagVariants = cva("inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-sm", {
  variants: {
    variant: {
      default: "bg-surface-component font-semibold text-content-subtle",
      outline: "border border-line bg-transparent font-medium text-content-subtle",
      inverted: "border border-transparent bg-surface-interactive font-medium text-content-on-color",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Tag({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof tagVariants>) {
  return <span data-slot="tag" className={cn(tagVariants({ variant, className }))} {...props} />;
}

export { Tag, tagVariants };
