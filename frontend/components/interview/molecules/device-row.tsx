"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Mono } from "@/components/ui/typography";
import type { DeviceStatus } from "@/lib/interview/types";

const STATUS_BADGE = {
  ok: { tone: "success", label: "OK" },
  check: { tone: "warning", label: "Check" },
  fail: { tone: "danger", label: "Fail" },
  untested: { tone: "neutral", label: "Untested" },
} as const;

/** One line of the device check. `onTest` makes the icon and the label a single
 * hit target for opening the test; rows with nothing to test (screen share)
 * omit it and render inert. */
export function DeviceRow({
  icon,
  label,
  status,
  onTest,
  preview,
  meta,
  isLast,
}: {
  icon: React.ReactNode;
  label: string;
  status: DeviceStatus;
  onTest?: () => void;
  preview?: React.ReactNode;
  meta?: string;
  isLast?: boolean;
}) {
  const badge = STATUS_BADGE[status];

  return (
    <div className={`flex items-center gap-3 py-[11px] ${isLast ? "" : "border-b border-line"}`}>
      {onTest ? (
        <IconButton onClick={onTest} title={`Test ${label.toLowerCase()}`}>
          {icon}
        </IconButton>
      ) : (
        <span className="flex size-[30px] shrink-0 items-center justify-center rounded-md border border-line bg-surface text-content">
          {icon}
        </span>
      )}

      {onTest ? (
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 justify-start pl-0 text-sm font-normal"
          onClick={onTest}
        >
          {label}
        </Button>
      ) : (
        <span className="flex-1 text-sm">{label}</span>
      )}

      {meta && <Mono className="text-2xs text-content-muted">{meta}</Mono>}
      {preview}
      <Badge tone={badge.tone} size="sm">
        {badge.label}
      </Badge>
    </div>
  );
}
