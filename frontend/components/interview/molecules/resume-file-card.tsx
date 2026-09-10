import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/interview/format";
import type { ResumeDoc } from "@/lib/interview/types";

function PageGlyph() {
  return (
    <span
      aria-hidden
      className="flex h-[42px] w-[34px] items-end gap-0.5 rounded-[3px] border border-line-strong bg-surface p-[5px]"
    >
      <span className="h-[3px] flex-1 bg-line-strong" />
      <span className="h-[7px] flex-1 bg-line-strong" />
      <span className="h-[5px] flex-1 bg-line-strong" />
    </span>
  );
}

export function ResumeFileCard({ resume, onReplace }: { resume: ResumeDoc; onReplace: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-surface-subtle p-3">
      <PageGlyph />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{resume.fileName}</div>
        <div className="mt-0.5 text-xs text-content-muted">
          {formatFileSize(resume.sizeBytes)} · {resume.pageCount} pages · {resume.entityCount} entities extracted
        </div>
        <div className="mt-2 h-[3px] overflow-hidden rounded-[2px] bg-line-strong">
          <div className="h-full w-full bg-success" />
        </div>
      </div>
      <Button variant="ghost" size="sm" className="text-content-subtle" onClick={onReplace}>
        Replace
      </Button>
    </div>
  );
}
