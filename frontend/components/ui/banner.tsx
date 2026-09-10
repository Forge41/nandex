import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const bannerVariants = cva("flex items-start gap-3 rounded-md px-4 py-3 text-sm leading-[1.45]", {
  variants: {
    tone: {
      info: "bg-info-bg text-info",
      success: "bg-success-bg text-success",
      warning: "bg-warning-bg text-warning",
      danger: "bg-danger-bg text-danger",
    },
  },
  defaultVariants: {
    tone: "info",
  },
});

function Banner({ className, tone, ...props }: React.ComponentProps<"div"> & VariantProps<typeof bannerVariants>) {
  return <div data-slot="banner" role="status" className={cn(bannerVariants({ tone, className }))} {...props} />;
}

export { Banner, bannerVariants };
