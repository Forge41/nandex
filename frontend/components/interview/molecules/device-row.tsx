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

/** One line of the device check.
 *
 * The trailing cells are fixed-width columns rather than flowing content: the
 * badges differ in width ("OK" against "Untested"), and letting them size
 * themselves pushed each row's preview to a different place. */
export function DeviceRow({
  icon,
  label,
  status,
  onTest,
  testLabel,
  preview,
  meta,
  isLast,
}: {
  icon: React.ReactNode;
  label: string;
  status: DeviceStatus;
  onTest?: () => void;
  /** Overrides the default "Test <label>" -- screen sharing is a request to the
   * candidate, not a probe we can run on them. */
  testLabel?: string;
  preview?: React.ReactNode;
  meta?: string;
  isLast?: boolean;
}) {
  const badge = STATUS_BADGE[status];

  return (
    <div className={`flex items-center gap-3 py-[11px] ${isLast ? "" : "border-b border-line"}`}>
      {onTest ? (
        <IconButton onClick={onTest} title={testLabel ?? `Test ${label.toLowerCase()}`}>
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
          className="min-w-0 flex-1 justify-start pl-0 text-sm font-normal"
          onClick={onTest}
        >
          {label}
        </Button>
      ) : (
        <span className="min-w-0 flex-1 text-sm">{label}</span>
      )}

      {/* Reserved whether or not this row has meta, so the previews align. */}
      <Mono className="w-[72px] shrink-0 truncate text-right text-2xs text-content-muted">
        {meta ?? ""}
      </Mono>
      {/* Reserved whether or not this row has a preview, for the same reason. */}
      <span className="flex h-9 w-[62px] shrink-0 items-center justify-center">{preview}</span>
      <span className="flex w-[68px] shrink-0 justify-end">
        <Badge tone={badge.tone} size="sm">
          {badge.label}
        </Badge>
      </span>
    </div>
  );
}
