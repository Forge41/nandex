import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-xs font-medium [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-tag-neutral text-content-subtle",
        success: "bg-tag-green text-success",
        warning: "bg-tag-orange text-warning",
        danger: "bg-tag-red text-danger",
        info: "bg-tag-blue text-info",
        violet: "bg-tag-violet text-violet",
        jade: "bg-tag-jade text-jade",
        gold: "bg-tag-gold text-gold",
        olive: "bg-olive-bg-subtle text-olive",
      },
      size: {
        default: "px-2 py-0.5 text-xs leading-4",
        sm: "px-1 text-2xs leading-[14px]",
      },
      pill: {
        true: "rounded-full",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "default",
    },
  }
);

function Badge({
  className,
  tone,
  size,
  pill,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return <Comp data-slot="badge" className={cn(badgeVariants({ tone, size, pill, className }))} {...props} />;
}

export { Badge, badgeVariants };
