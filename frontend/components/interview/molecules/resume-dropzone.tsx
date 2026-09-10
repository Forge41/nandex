"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/typography";

const ACCEPTED = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_BYTES = 5 * 1024 * 1024;

function validate(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) return "That file type isn't supported. Upload a PDF or DOCX.";
  if (file.size > MAX_BYTES) return "That file is over 5 MB. Upload a smaller PDF or DOCX.";
  return null;
}

/** Sheet-of-paper glyph. Purely decorative, so it carries no label. */
function DocumentGlyph() {
  return (
    <span
      aria-hidden
      className="flex h-14 w-[46px] items-end gap-[3px] rounded-xs border border-line-strong bg-surface p-[7px]"
    >
      <span className="h-1 flex-1 bg-line-strong" />
      <span className="h-2.5 flex-1 bg-line-strong" />
      <span className="h-1.5 flex-1 bg-line-strong" />
    </span>
  );
}

export function ResumeDropzone({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = (file: File | undefined) => {
    if (!file) return;
    const problem = validate(file);
    setError(problem);
    if (!problem) onFile(file);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <Eyebrow>Resume</Eyebrow>
        <Badge tone="neutral">Required</Badge>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files[0]);
        }}
        className={cn(
          "mt-3 flex min-h-0 flex-1 flex-col items-center justify-center gap-3.5 rounded-lg border-[1.5px] border-dashed p-7 text-center transition-colors",
          isDragging ? "border-line-interactive bg-surface-component" : "border-line-strong bg-surface-subtle"
        )}
      >
        <DocumentGlyph />

        <div>
          <div className="t-h3">Drop your resume here</div>
          <p className="t-small mx-auto mt-1.5 max-w-[38ch] text-content-subtle">
            The interviewer builds every question from this document. PDF or DOCX, up to 5 MB.
          </p>
        </div>

        <Button variant="primary" onClick={() => inputRef.current?.click()}>
          Choose file
        </Button>

        {error ? (
          <p className="t-xs max-w-[40ch] text-content-danger">{error}</p>
        ) : (
          <p className="t-xs max-w-[40ch] text-content-muted">
            You&apos;ll see exactly what was extracted before anything is scored.
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            accept(file);
          }}
        />
      </div>
    </>
  );
}
