import * as React from "react";
import { cn } from "@/lib/utils";

const DOT_TONE = {
  danger: "bg-danger",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  neutral: "bg-content",
  disabled: "bg-content-disabled",
} as const;

export type DotTone = keyof typeof DOT_TONE;

/** Pulsing dot for anything actively happening -- recording, streaming, watching. */
function LiveDot({
  tone = "danger",
  size = 7,
  className,
  style,
  ...props
}: React.ComponentProps<"span"> & { tone?: DotTone; size?: number }) {
  return (
    <span
      data-slot="live-dot"
      className={cn("shrink-0 rounded-full animate-live-pulse", DOT_TONE[tone], className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    />
  );
}

/** Static state dot -- test results, timeline steps, connection health. */
function StatusDot({
  tone = "neutral",
  size = 6,
  className,
  style,
  ...props
}: React.ComponentProps<"span"> & { tone?: DotTone; size?: number }) {
  return (
    <span
      data-slot="status-dot"
      className={cn("shrink-0 rounded-full", DOT_TONE[tone], className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    />
  );
}

/** Blinking block caret marking speech or output still arriving. */
function TypingCaret({
  width = 7,
  height = 15,
  className,
  style,
  ...props
}: React.ComponentProps<"span"> & { width?: number; height?: number }) {
  return (
    <span
      aria-hidden
      data-slot="typing-caret"
      className={cn("inline-block bg-content align-[-2px] animate-caret-blink", className)}
      style={{ width, height, ...style }}
      {...props}
    />
  );
}

export { LiveDot, StatusDot, TypingCaret };
