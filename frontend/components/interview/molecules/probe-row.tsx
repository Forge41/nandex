import { Mono } from "@/components/ui/typography";
import { CitationChip } from "./citation-chip";
import type { Probe, Round } from "@/lib/interview/types";

export function ProbeRow({
  probe,
  index,
  roundNumber,
  isLast,
}: {
  probe: Probe;
  index: number;
  roundNumber: number | null;
  isLast: boolean;
}) {
  return (
    <div className={`flex items-baseline gap-3.5 px-3.5 py-3 ${isLast ? "" : "border-b border-line"}`}>
      <Mono className="w-4 shrink-0 text-2xs text-content-disabled">{String(index + 1).padStart(2, "0")}</Mono>
      <span className="w-[190px] shrink-0 text-sm font-medium">{probe.title}</span>
      <span className="t-small flex-1 text-content-subtle">
        {probe.note}
        {probe.citation !== undefined && <CitationChip n={probe.citation} />}
      </span>
      {roundNumber !== null && (
        <Mono className="shrink-0 text-2xs text-content-muted">round {roundNumber}</Mono>
      )}
    </div>
  );
}

/** Probes name the round they'll be tested in; the number comes from the
 * agenda so it stays right if the plan is reordered. */
export function roundNumberFor(rounds: Round[], id: Probe["round"]): number | null {
  const index = rounds.findIndex((round) => round.id === id);
  return index < 0 ? null : index + 1;
}
