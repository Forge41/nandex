// The résumé lives in Google Drive; replace it there with "Manage versions" so the id stays.
export const RESUME_DRIVE_ID = process.env.NEXT_PUBLIC_RESUME_DRIVE_ID || "1lbKDZSdoNfvTDVHhoS_xlOa5XfdLzpu8";

export const driveViewUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`;
export const driveDownloadUrl = (id: string) => `https://drive.google.com/uc?export=download&id=${id}`;

export type ResumeFile = { body: Uint8Array; source: "drive" | "fallback" };

const isPdf = (b: Uint8Array) => b.length > 4 && String.fromCharCode(...b.subarray(0, 5)) === "%PDF-";

/** The Drive copy, or the bundled one when Drive is unreachable, slow, or answers with anything but a PDF. */
export async function loadResume(
  id: string,
  readFallback: () => Promise<Uint8Array>,
  fetcher: typeof fetch = fetch,
): Promise<ResumeFile> {
  if (id) {
    try {
      const res = await fetcher(driveDownloadUrl(id), { redirect: "follow", signal: AbortSignal.timeout(8000) });
      const body = new Uint8Array(await res.arrayBuffer());
      if (res.ok && isPdf(body)) return { body, source: "drive" };
    } catch {}
  }
  return { body: await readFallback(), source: "fallback" };
}
