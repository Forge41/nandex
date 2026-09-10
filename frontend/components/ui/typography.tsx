import * as React from "react";
import { cn } from "@/lib/utils";

/** Uppercase tracked section label. The most repeated text style in the design,
 * so it earns a component over a repeated utility string. */
function Eyebrow({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="eyebrow" className={cn("t-eyebrow text-content-muted", className)} {...props} />;
}

function Mono({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="mono" className={cn("t-mono", className)} {...props} />;
}

export { Eyebrow, Mono };
