"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar as AvatarPrimitive } from "radix-ui";

function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "default" | "sm" | "lg";
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 select-none overflow-hidden rounded-full data-[size=lg]:size-10 data-[size=sm]:size-6",
        className
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return <AvatarPrimitive.Image data-slot="avatar-image" className={cn("aspect-square size-full", className)} {...props} />;
}

function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-surface-component text-xs font-medium text-content group-data-[size=lg]/avatar:text-sm group-data-[size=sm]/avatar:text-[10px]",
        className
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
