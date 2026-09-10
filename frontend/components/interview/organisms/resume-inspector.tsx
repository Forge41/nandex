"use client";

import { Badge } from "@/components/ui/badge";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { SkeletonLines } from "@/components/ui/skeleton-lines";
import { ResumeFileCard } from "@/components/interview/molecules/resume-file-card";
import type { ResumeDoc } from "@/lib/interview/types";

/** Fallback for a session with no local blob to render -- one restored from the
 * server, say. Real metadata and headings, redacted body copy, and no page or
 * zoom controls that would imply a renderer isn't there. */
function DocumentOutline({ resume }: { resume: ResumeDoc }) {
  const { candidate } = resume;

  return (
    <div className="flex w-[392px] flex-none flex-col bg-white px-[34px] py-[30px] text-[hsl(40_6%_10%)] shadow-[0_2px_10px_rgba(0,0,0,0.4)]">
      <div className="font-serif text-[15px] leading-tight">{candidate.name}</div>
      <div className="mt-1 text-[8px] tracking-[0.02em] text-[#85827c]">
        {candidate.title} · {candidate.location} · {candidate.email}
      </div>
      <div className="mt-3 h-px bg-[#e5e1db]" />

      <div className="mt-3 text-[7.5px] font-semibold tracking-[0.1em] text-[#6b6862] uppercase">Experience</div>
      <div className="mt-[7px] flex items-baseline justify-between">
        <span className="text-[9px] font-semibold">Northwind — Payments Platform</span>
        <span className="text-[7.5px] text-[#85827c]">2021 — present</span>
      </div>
      <SkeletonLines widths={[100, 96, 88, 64]} className="mt-1.5 [&>span]:bg-[#eceae5]" />

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-[9px] font-semibold">Velo — Card Authorisation</span>
        <span className="text-[7.5px] text-[#85827c]">2018 — 2021</span>
      </div>
      <SkeletonLines widths={[100, 92, 54]} className="mt-1.5 [&>span]:bg-[#eceae5]" />

      <div className="mt-3.5 text-[7.5px] font-semibold tracking-[0.1em] text-[#6b6862] uppercase">Skills</div>
      <SkeletonLines widths={[82, 46]} className="mt-1.5 [&>span]:bg-[#eceae5]" />

      <div className="mt-3.5 text-[7.5px] font-semibold tracking-[0.1em] text-[#6b6862] uppercase">Education</div>
      <SkeletonLines widths={[70]} className="mt-1.5 [&>span]:bg-[#eceae5]" />
    </div>
  );
}

export function ResumeInspector({ resume, onReplace }: { resume: ResumeDoc; onReplace: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <Eyebrow>Resume</Eyebrow>
        <Badge tone="success">Parsed</Badge>
      </div>

      <div className="mt-3">
        <ResumeFileCard resume={resume} onReplace={onReplace} />
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-line-strong">
        <div className="flex h-[34px] shrink-0 items-center gap-2.5 border-b border-line-strong bg-surface-component px-2.5">
          <Mono className="flex-1 truncate text-2xs text-content-subtle">{resume.fileName}</Mono>
          {resume.pageCount !== undefined && (
            <Mono className="text-2xs text-content-muted">
              {resume.pageCount} {resume.pageCount === 1 ? "page" : "pages"}
            </Mono>
          )}
        </div>
        {/* The browser's own PDF viewer when there's a real file behind this --
            the point of the step is checking the actual document, which an
            approximation of it cannot do. */}
        {resume.previewUrl ? (
          <iframe
            src={resume.previewUrl}
            title={`Preview of ${resume.fileName}`}
            className="min-h-0 flex-1 border-0 bg-[hsl(40_3%_22%)]"
          />
        ) : (
          <div className="scrollbar-thin flex min-h-0 flex-1 justify-center overflow-auto bg-[hsl(40_3%_22%)] p-4">
            <DocumentOutline resume={resume} />
          </div>
        )}
      </div>

      <p className="t-xs mt-2 text-content-muted">
        Check this is the version you want reviewed. It is the only document the interviewer reads.
      </p>
    </>
  );
}
