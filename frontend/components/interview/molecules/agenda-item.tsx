"use client";

import { cn } from "@/lib/utils";
import { Mono } from "@/components/ui/typography";
import { LockIcon } from "@/components/interview/icons";
import type { AgendaItemView } from "@/lib/interview/selectors";

export function AgendaItem({ item, onSelect }: { item: AgendaItemView; onSelect: () => void }) {
  const locked = item.status === "locked";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={locked}
      data-active={item.isCurrent}
      className={cn(
        "flex w-full items-start gap-[9px] rounded-sm px-2 py-[7px] text-left transition-colors",
        "hover:bg-surface-hover data-[active=true]:bg-surface-component data-[active=true]:font-medium",
        locked && "pointer-events-none opacity-55"
      )}
    >
      <Mono className="flex w-4 shrink-0 justify-center pt-0.5 text-2xs text-content-muted">{item.mark}</Mono>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm leading-[1.3]">{item.label}</span>
        <span className="text-2xs text-content-muted">{item.meta}</span>
      </span>
      {locked && <LockIcon width={11} height={11} className="mt-[3px] shrink-0 text-content-muted" />}
    </button>
  );
}
