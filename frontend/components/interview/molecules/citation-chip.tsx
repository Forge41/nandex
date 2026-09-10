"use client";

import { Citation } from "@/components/ui/citation";
import { useCitationSelection } from "@/lib/interview/citation-context";

/** A citation wired to the shared selection, so clicking it anywhere lights up
 * the resume line it refers to. */
export function CitationChip({ n }: { n: number }) {
  const { selected, toggle } = useCitationSelection();

  return (
    <Citation
      n={n}
      selected={selected === n}
      onClick={() => toggle(n)}
      title={selected === n ? "Hide the line this came from" : "Show the line this came from"}
    />
  );
}
