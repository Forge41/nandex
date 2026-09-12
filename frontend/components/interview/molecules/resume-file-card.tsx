import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/interview/format";
import type { ResumeDoc } from "@/lib/interview/types";

/** Stand-in for a file the browser cannot render -- a DOCX, or a session
 * restored from the server with no local blob. Deliberately a glyph and not a
 * blank page: it says "no preview", rather than showing an empty document. */
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

const THUMB_WIDTH = 34;
const THUMB_HEIGHT = 42;
/** Rendered large and scaled down rather than rendered small: a PDF viewer
 * given a 34px viewport lays the page out for 34px. This renders it at a real
 * reading width and shrinks the result, so the thumbnail is the document's
 * actual first page. */
const RENDER_SCALE = 8;

/** The candidate's own file, at thumbnail size.
 *
 * The same browser PDF viewer the full preview below uses -- the point of this
 * step is confirming the right document, which a generic icon cannot do. */
function FileThumbnail({ resume }: { resume: ResumeDoc }) {
  if (!resume.previewUrl || resume.previewType !== "application/pdf") return <PageGlyph />;

  return (
    <span
      aria-hidden
      className="relative block shrink-0 overflow-hidden rounded-[3px] border border-line-strong bg-white"
      style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
    >
      <iframe
        // The viewer's own chrome would fill a box this size, so it is asked for
        // the page alone. The filename beside this carries the meaning, which is
        // why the frame is hidden from assistive tech rather than labelled.
        src={`${resume.previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
        tabIndex={-1}
        scrolling="no"
        className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
        style={{
          width: THUMB_WIDTH * RENDER_SCALE,
          height: THUMB_HEIGHT * RENDER_SCALE,
          transform: `scale(${1 / RENDER_SCALE})`,
        }}
      />
    </span>
  );
}

export function ResumeFileCard({ resume, onReplace }: { resume: ResumeDoc; onReplace: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-surface-subtle p-3">
      <FileThumbnail resume={resume} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{resume.fileName}</div>
        <div className="mt-0.5 text-xs text-content-muted">
          {[
            formatFileSize(resume.sizeBytes),
            resume.pageCount === undefined ? null : `${resume.pageCount} pages`,
            `${resume.entityCount} entities extracted`,
          ]
            .filter(Boolean)
            .join(" · ")}
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
