import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** A bordered panel. Deliberately has no header/footer slots -- every card in
 * the design lays its own contents out, so the extra structure would only be
 * overridden. */
const cardVariants = cva("rounded-lg border border-line p-6", {
  variants: {
    variant: {
      default: "bg-surface",
      subtle: "bg-surface-subtle",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Card({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return <div data-slot="card" className={cn(cardVariants({ variant, className }))} {...props} />;
}

export { Card, cardVariants };
