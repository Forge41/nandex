"use client";

import { Badge } from "@/components/ui/badge";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { ResumeFileCard } from "@/components/interview/molecules/resume-file-card";
import type { ResumeFile } from "@/lib/interview/types";

/** The document the candidate chose, before anything is done with it.
 *
 * `parsed` is the difference between "this is your file" and "this is what we
 * read": the badge, the page count and the entity count are all results, and
 * showing them for a file nobody has opened yet claims work that has not
 * happened.
 */
export function ResumeInspector({
  file,
  parsed,
  onReplace,
}: {
  file: ResumeFile;
  parsed: boolean;
  onReplace: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <Eyebrow>Resume</Eyebrow>
        <Badge tone={parsed ? "success" : "neutral"}>{parsed ? "Parsed" : "Ready to send"}</Badge>
      </div>

      <div className="mt-3">
        <ResumeFileCard file={file} onReplace={onReplace} />
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-line-strong">
        <div className="flex h-[34px] shrink-0 items-center gap-2.5 border-b border-line-strong bg-surface-component px-2.5">
          <Mono className="flex-1 truncate text-2xs text-content-subtle">{file.fileName}</Mono>
          {file.pageCount !== undefined && (
            <Mono className="text-2xs text-content-muted">
              {file.pageCount} {file.pageCount === 1 ? "page" : "pages"}
            </Mono>
          )}
        </div>
        {/* The browser's own PDF viewer, on the real file -- the point of the
            step is checking the actual document, which an approximation of it
            cannot do. A format the browser cannot render says so instead of
            being drawn from memory. */}
        {file.previewUrl ? (
          <iframe
            src={file.previewUrl}
            title={`Preview of ${file.fileName}`}
            className="min-h-0 flex-1 border-0 bg-[hsl(40_3%_22%)]"
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-[hsl(40_3%_22%)] p-6">
            <p className="t-small max-w-[36ch] text-center text-content-muted">
              This browser can&apos;t preview {file.fileName}. It will still be read in full.
            </p>
          </div>
        )}
      </div>

      <p className="t-xs mt-2 text-content-muted">
        Check this is the version you want reviewed. It is the only document the interviewer reads.
      </p>
    </>
  );
}
