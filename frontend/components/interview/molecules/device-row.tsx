"use client";

import { Badge } from "@/components/ui/badge";
import { Mono } from "@/components/ui/typography";
import type { DeviceStatus } from "@/lib/interview/types";

const STATUS_BADGE = {
  ok: { tone: "success", label: "OK" },
  check: { tone: "warning", label: "Check" },
  fail: { tone: "danger", label: "Fail" },
  untested: { tone: "neutral", label: "Untested" },
} as const;

const STATUS_SPOKEN: Record<DeviceStatus, string> = {
  ok: "passed",
  check: "needs a look",
  fail: "failed",
  untested: "not yet tested",
};

/** One line of the device check.
 *
 * The whole row is the control. It used to be two separate buttons -- the icon
 * and the label -- inside a row whose preview was a third, all opening the same
 * panel; a single hit target is both easier to hit and one accessible name
 * instead of three.
 *
 * The trailing cells are fixed-width columns rather than flowing content: the
 * badges differ in width ("OK" against "Untested"), and letting them size
 * themselves pushed each row's preview to a different place.
 */
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
  /** Omitted when there is nothing to open -- the row then renders inert
   * rather than as a control that does nothing. */
  onTest?: () => void;
  /** Overrides the default action wording. Screen sharing is a request to the
   * candidate, not a probe we can run on them. */
  testLabel?: string;
  preview?: React.ReactNode;
  meta?: string;
  isLast?: boolean;
}) {
  const badge = STATUS_BADGE[status];

  const cells = (
    <>
      <span
        aria-hidden
        className="flex size-[30px] shrink-0 items-center justify-center rounded-md border border-line bg-surface text-content transition-colors group-hover:border-line-interactive"
      >
        {icon}
      </span>
      {/* Never wrapped: the fixed columns leave it a narrow lane, and a label
          breaking onto two lines makes one row taller than its neighbours. */}
      <span className="min-w-0 flex-1 truncate text-left text-sm whitespace-nowrap">{label}</span>
      {/* Reserved whether or not this row has meta, so the previews align. */}
      <Mono className="w-[64px] shrink-0 truncate text-right text-2xs text-content-muted">
        {meta ?? ""}
      </Mono>
      {/* Reserved whether or not this row has a preview, for the same reason. */}
      <span className="flex h-9 w-[62px] shrink-0 items-center justify-center">{preview}</span>
      <span className="flex w-[64px] shrink-0 justify-end">
        <Badge tone={badge.tone} size="sm">
          {badge.label}
        </Badge>
      </span>
    </>
  );

  const frame = `flex w-full items-center gap-2.5 py-[11px] ${isLast ? "" : "border-b border-line"}`;

  if (!onTest) {
    return <div className={frame}>{cells}</div>;
  }

  return (
    <button
      type="button"
      onClick={onTest}
      // The visible cells are decorative as a group -- read out, "Microphone 1
      // display OK" is worse than saying what the control does and where the
      // check currently stands.
      aria-label={`${testLabel ?? `Test ${label.toLowerCase()}`} — currently ${STATUS_SPOKEN[status]}`}
      className={`${frame} group cursor-pointer rounded-md outline-offset-2 transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-line-interactive`}
    >
      {cells}
    </button>
  );
}
