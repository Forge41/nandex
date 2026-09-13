"use client";

import { cn } from "@/lib/utils";
import type { RoundStatus } from "@/lib/interview/types";

/** One notch in the rail. Width alone carries the state -- longer means
 * further along -- so the rail reads as a progress spine at 52px wide. */
export function AgendaTick({
  label,
  status,
  isCurrent,
  onSelect,
}: {
  label: string;
  status: RoundStatus;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  // Complete counts as unreachable too: an interview runs forwards, so a round
  // already finished is no more selectable than one not yet unlocked.
  const unreachable = status === "locked" || status === "complete";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={unreachable}
      title={label}
      aria-current={isCurrent ? "step" : undefined}
      className={cn(
        "group/tick flex h-[15px] cursor-pointer items-center justify-end pr-[13px] outline-none",
        unreachable && "pointer-events-none",
        status === "locked" && "opacity-55"
      )}
    >
      <span
        className={cn(
          "block h-0.5 rounded-[1px] transition-[width,background-color] duration-150",
          "group-hover/tick:w-5 group-hover/tick:bg-content-subtle group-focus-visible/tick:w-5 group-focus-visible/tick:bg-content-subtle",
          isCurrent
            ? "w-[22px] bg-content"
            : status === "complete"
              ? "w-[11px] bg-line-strong"
              : "w-[13px] bg-content-disabled"
        )}
      />
    </button>
  );
}
