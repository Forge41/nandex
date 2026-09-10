"use client";

import { cn } from "@/lib/utils";
import { CitationChip } from "./citation-chip";
import { useCitationSelection } from "@/lib/interview/citation-context";
import type { ResumeFragment } from "@/lib/interview/types";

/** Resume body copy. A fragment carrying a citation is a phrase a round was
 * generated from: it is underlined always, and highlighted while its citation
 * is selected, so "which line did this come from" has a visible answer. */
export function ResumeProse({
  paragraphs,
  className,
}: {
  paragraphs: ResumeFragment[][];
  className?: string;
}) {
  const { selected } = useCitationSelection();

  return (
    <>
      {paragraphs.map((fragments, paragraphIndex) => (
        <p
          key={paragraphIndex}
          className={cn("max-w-[70ch] leading-[1.75]", paragraphIndex > 0 && "mt-3.5", className)}
        >
          {fragments.map((fragment, fragmentIndex) =>
            fragment.citation === undefined ? (
              <span key={fragmentIndex}>{fragment.text}</span>
            ) : (
              <span key={fragmentIndex}>
                <span
                  className={cn(
                    "border-b border-dashed border-content-muted transition-colors duration-150",
                    selected === fragment.citation && "rounded-xs bg-tag-gold px-0.5 text-gold"
                  )}
                >
                  {fragment.text}
                </span>
                <CitationChip n={fragment.citation} />
              </span>
            )
          )}
        </p>
      ))}
    </>
  );
}
