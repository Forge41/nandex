import { readFile } from "node:fs/promises";
import path from "node:path";

import { cachedResume, loadResume, RESUME_DRIVE_ID } from "@/lib/resume";

// pdf.js previews need the PDF same-origin, and Drive sends no CORS headers, so the
// file is proxied here. cachedResume keeps this from hitting Drive per view.
export const dynamic = "force-dynamic";

const FALLBACK = path.join(process.cwd(), "content", "resume-fallback.pdf");

const resume = cachedResume(() => loadResume(RESUME_DRIVE_ID, async () => new Uint8Array(await readFile(FALLBACK))));

export async function GET() {
  const { body, source } = await resume();
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Nandisha-D-resume.pdf"',
      "Cache-Control": source === "drive" ? "public, max-age=300" : "no-store",
      "X-Resume-Source": source,
    },
  });
}
