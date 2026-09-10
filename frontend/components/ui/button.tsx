import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-1 whitespace-nowrap rounded-md border border-transparent font-medium transition-[background-color,border-color,color] duration-[80ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line-interactive disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-btn-inverted text-content-on-color hover:bg-btn-inverted-hover active:bg-btn-inverted-pressed",
        secondary:
          "border-line bg-btn-neutral text-content hover:border-line-strong hover:bg-btn-neutral-hover active:bg-btn-neutral-pressed",
        tertiary: "bg-btn-neutral text-content hover:bg-btn-neutral-hover active:bg-btn-neutral-pressed",
        ghost: "bg-transparent text-content hover:bg-btn-neutral-hover active:bg-btn-neutral-pressed",
        danger: "bg-btn-danger text-content-on-color hover:bg-btn-danger-hover active:bg-btn-danger-pressed",
      },
      size: {
        default: "h-8 px-3 py-[5px] text-sm [&_svg:not([class*='size-'])]:size-4",
        sm: "h-6 rounded-sm px-2 py-[3px] text-xs [&_svg:not([class*='size-'])]:size-3.5",
        xs: "h-5 rounded-sm px-1.5 py-px text-xs [&_svg:not([class*='size-'])]:size-3",
        icon: "size-8 px-0",
        "icon-sm": "size-6 rounded-sm px-0",
        "icon-xs": "size-5 rounded-sm px-0",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
