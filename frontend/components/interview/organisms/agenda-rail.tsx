"use client";

import { Eyebrow } from "@/components/ui/typography";
import { StatusDot } from "@/components/ui/indicators";
import { AgendaTick } from "@/components/interview/molecules/agenda-tick";
import { AgendaItem } from "@/components/interview/molecules/agenda-item";
import { ThemeToggle } from "@/components/interview/molecules/theme-toggle";
import { useInterviewSession } from "@/lib/interview/session-provider";
import { deriveAgenda } from "@/lib/interview/selectors";

/** Hover-revealed detail for the rail. Also opens on keyboard focus, which the
 * design's hover-only rule would otherwise make unreachable. */
function AgendaFlyout({
  children,
  connectionLabel,
}: {
  children: React.ReactNode;
  connectionLabel?: string;
}) {
  return (
    <div
      className={[
        "absolute top-1/2 left-[63px] w-[274px] overflow-hidden rounded-lg border border-line-strong bg-surface",
        "shadow-[0_16px_40px_-12px_hsl(40_20%_10%/0.22),0_2px_6px_hsl(40_20%_10%/0.06)]",
        "-translate-x-[18px] -translate-y-1/2 opacity-0 transition-[opacity,transform] duration-200 ease-out pointer-events-none",
        "group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100",
        "group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100",
      ].join(" ")}
    >
      <div className="px-3.5 pt-3 pb-2">
        <Eyebrow>Session agenda</Eyebrow>
        <p className="mt-[7px] text-xs leading-[1.45] text-content-subtle">
          Generated from your resume. Order adapts as we go.
        </p>
      </div>

      <div className="scrollbar-thin flex max-h-[520px] flex-col gap-px overflow-y-auto px-[7px] pt-0.5 pb-2">
        {children}
      </div>

      {connectionLabel && (
        <div className="flex items-center gap-2 border-t border-line bg-surface-subtle px-3.5 py-2">
          <StatusDot tone="success" size={7} />
          <span className="text-2xs text-content-subtle">{connectionLabel}</span>
        </div>
      )}
    </div>
  );
}

export function AgendaRail({ connectionLabel }: { connectionLabel?: string }) {
  const { session, dispatch } = useInterviewSession();
  const agenda = deriveAgenda(session);
  // Only the round in progress is selectable. The reducer refuses the rest, so
  // this is about not offering a click that does nothing rather than about
  // enforcement -- the enforcement is there and on the server.
  const goTo = (stage: (typeof agenda)[number]["id"]) => dispatch({ type: "GO_TO_STAGE", stage });

  return (
    <nav
      aria-label="Interview agenda"
      className="group relative z-30 flex w-13 shrink-0 flex-col items-center border-r border-line bg-surface-subtle"
    >
      <div className="py-3" />

      <div className="flex w-full flex-1 flex-col justify-center py-1">
        {agenda.map((item) => (
          <AgendaTick
            key={item.id}
            label={item.label}
            status={item.status}
            isCurrent={item.isCurrent}
            onSelect={() => goTo(item.id)}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 pb-3">
        <ThemeToggle />
      </div>

      {session.resume && (
        <AgendaFlyout connectionLabel={connectionLabel}>
          {agenda.map((item) => (
            <AgendaItem key={item.id} item={item} onSelect={() => goTo(item.id)} />
          ))}
        </AgendaFlyout>
      )}
    </nav>
  );
}
