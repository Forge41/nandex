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

const DRIVE_TTL_MS = 60 * 60 * 1000;
const RETRY_MS = 60 * 1000;

/**
 * One Drive fetch per hour per server process, shared by concurrent requests. A stale copy
 * is served while the next one loads, and a failed refresh keeps the last Drive copy
 * rather than swapping in the bundled one.
 */
export function cachedResume(load: () => Promise<ResumeFile>, now: () => number = Date.now) {
  let entry: { file: ResumeFile; fresh: number } | null = null;
  let inflight: Promise<ResumeFile> | null = null;

  const refresh = () =>
    (inflight ??= load()
      .then((file) => {
        const keep = file.source === "fallback" && entry?.file.source === "drive" ? entry.file : file;
        entry = { file: keep, fresh: now() + (file.source === "drive" ? DRIVE_TTL_MS : RETRY_MS) };
        return keep;
      })
      .finally(() => {
        inflight = null;
      }));

  return async (): Promise<ResumeFile> => {
    if (!entry) return refresh();
    if (now() >= entry.fresh) void refresh().catch(() => {});
    return entry.file;
  };
}
