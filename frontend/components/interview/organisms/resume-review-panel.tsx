"use client";

import { Button } from "@/components/ui/button";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { SectionHeading } from "@/components/interview/molecules/section-heading";
import { ResumeProse } from "@/components/interview/molecules/resume-prose";
import { ProbeRow, roundNumberFor } from "@/components/interview/molecules/probe-row";
import type { ResumeDoc, Round } from "@/lib/interview/types";

export function ResumeReviewPanel({ resume, rounds }: { resume: ResumeDoc; rounds: Round[] }) {
  const { candidate, probes } = resume;

  return (
    <div className="scrollbar-thin flex-1 min-w-0 overflow-y-auto border-r border-line px-7 py-6">
      <div className="flex items-start justify-between gap-5">
        <div>
          <Eyebrow>Source document</Eyebrow>
          <h2 className="t-h2 mt-1.5 font-serif font-normal">{candidate.name}</h2>
          <p className="t-small mt-1 text-content-subtle">
            {candidate.title} · {candidate.yearsExperience} years · {candidate.location}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Mono className="text-2xs text-content-muted">
            {[resume.pageCount === undefined ? null : `${resume.pageCount} pages`, `${resume.entityCount} entities`]
              .filter(Boolean)
              .join(" · ")}
          </Mono>
          {/* Only offered when there is a real document behind it. */}
          {resume.previewUrl && (
            <Button variant="secondary" size="sm" asChild>
              <a href={resume.previewUrl} target="_blank" rel="noreferrer">
                Open PDF
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {resume.sections.map((section) => (
          <div key={section.id}>
            <SectionHeading label={section.label} />
            <ResumeProse paragraphs={section.paragraphs} className="t-body-md mt-3" />
          </div>
        ))}

        <div>
          <SectionHeading label="What we'll probe" meta={`${probes.length} items`} />
          <div className="mt-3 overflow-hidden rounded-md border border-line">
            {probes.map((probe, index) => (
              <ProbeRow
                key={probe.id}
                probe={probe}
                index={index}
                roundNumber={roundNumberFor(rounds, probe.round)}
                isLast={index === probes.length - 1}
              />
            ))}
          </div>
          <p className="t-xs mt-2.5 text-content-muted">
            Underlined phrases are the lines these rounds came from. Nothing here is a judgement yet.
          </p>
        </div>
      </div>
    </div>
  );
}
