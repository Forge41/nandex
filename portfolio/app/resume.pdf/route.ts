import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadResume, RESUME_DRIVE_ID } from "@/lib/resume";

// pdf.js previews need the PDF same-origin, and Drive sends no CORS headers, so the
// file is proxied here. The CDN cache is what keeps this from hitting Drive per view.
export const dynamic = "force-dynamic";

const FALLBACK = path.join(process.cwd(), "content", "resume-fallback.pdf");

export async function GET() {
  const { body, source } = await loadResume(RESUME_DRIVE_ID, async () => new Uint8Array(await readFile(FALLBACK)));
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Nandisha-D-resume.pdf"',
      "Cache-Control": "public, max-age=300",
      "CDN-Cache-Control": source === "drive" ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store",
      "X-Resume-Source": source,
    },
  });
}
