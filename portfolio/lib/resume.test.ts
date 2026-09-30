import { describe, expect, it, vi } from "vitest";

import { cachedResume, driveDownloadUrl, driveViewUrl, loadResume } from "./resume";

const PDF = new TextEncoder().encode("%PDF-1.7 drive");
const FALLBACK = new TextEncoder().encode("%PDF-1.7 bundled");
const readFallback = () => Promise.resolve(FALLBACK);
const reply = (body: BodyInit, status = 200) => vi.fn().mockResolvedValue(new Response(body, { status }));

describe("résumé links", () => {
  it("builds the Drive view and download urls from the id", () => {
    expect(driveViewUrl("abc")).toBe("https://drive.google.com/file/d/abc/view");
    expect(driveDownloadUrl("abc")).toBe("https://drive.google.com/uc?export=download&id=abc");
  });
});

describe("loadResume", () => {
  it("serves the Drive copy when it is a PDF", async () => {
    const fetcher = reply(PDF);
    const res = await loadResume("abc", readFallback, fetcher);
    expect(res).toEqual({ body: PDF, source: "drive" });
    expect(fetcher).toHaveBeenCalledWith(driveDownloadUrl("abc"), expect.objectContaining({ redirect: "follow" }));
  });

  it("falls back when Drive answers with an HTML page instead of the file", async () => {
    const res = await loadResume("abc", readFallback, reply("<html>virus scan warning</html>"));
    expect(res.source).toBe("fallback");
    expect(res.body).toBe(FALLBACK);
  });

  it("falls back on a Drive error status or a network failure", async () => {
    expect((await loadResume("abc", readFallback, reply(PDF, 404))).source).toBe("fallback");
    expect((await loadResume("abc", readFallback, vi.fn().mockRejectedValue(new Error("offline")))).source).toBe("fallback");
  });

  it("does not call Drive without an id", async () => {
    const fetcher = reply(PDF);
    expect((await loadResume("", readFallback, fetcher)).source).toBe("fallback");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("cachedResume", () => {
  const drive = { body: PDF, source: "drive" as const };
  const bundled = { body: FALLBACK, source: "fallback" as const };

  it("fetches once for concurrent requests and reuses it within the hour", async () => {
    const load = vi.fn().mockResolvedValue(drive);
    let t = 0;
    const get = cachedResume(load, () => t);

    await Promise.all([get(), get(), get()]);
    t = 59 * 60 * 1000;
    await get();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("serves the stale copy while refreshing after the hour", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(drive)
      .mockResolvedValueOnce({ body: new TextEncoder().encode("%PDF-new"), source: "drive" });
    let t = 0;
    const get = cachedResume(load, () => t);
    await get();

    t = 61 * 60 * 1000;
    expect(await get()).toBe(drive);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps the last Drive copy when a refresh can only reach the bundled file", async () => {
    const load = vi.fn().mockResolvedValueOnce(drive).mockResolvedValueOnce(bundled);
    let t = 0;
    const get = cachedResume(load, () => t);
    await get();

    t = 61 * 60 * 1000;
    await get();
    await new Promise((r) => setTimeout(r, 0));

    expect(await get()).toBe(drive);
  });

  it("retries a minute later when it only has the bundled file", async () => {
    const load = vi.fn().mockResolvedValue(bundled);
    let t = 0;
    const get = cachedResume(load, () => t);
    await get();

    t = 61 * 1000;
    await get();

    expect(load).toHaveBeenCalledTimes(2);
  });
});
