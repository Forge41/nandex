import { afterEach, describe, expect, it, vi } from "vitest";

import { ACTIVITY_USER, cellInfo, loadContributions } from "./github";

afterEach(() => vi.unstubAllGlobals());

describe("loadContributions", () => {
  it("reads the activity account's last 52 weeks", async () => {
    const days = Array.from({ length: 367 }, (_, i) => ({ date: `d${i}`, count: i % 3 }));
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ contributions: days })));
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => undefined });

    const grid = await loadContributions();

    expect(ACTIVITY_USER).toBe("Nandisha-D");
    expect(fetcher).toHaveBeenCalledWith("https://github-contributions-api.jogruber.de/v4/Nandisha-D?y=last");
    expect(grid).toHaveLength(364);
    expect(grid?.at(-1)).toBe(366 % 3);
  });
});

describe("cellInfo", () => {
  const grid = Array.from({ length: 364 }, (_, i) => (i === 363 ? 2 : i === 362 ? 1 : 0));
  const today = new Date(2026, 8, 29);

  it("dates the last cell today and counts back a day per cell", () => {
    expect(cellInfo(grid, 363, today)).toMatchObject({ date: "Tue, Sep 29", count: "2 commits", active: true });
    expect(cellInfo(grid, 362, today)).toMatchObject({ date: "Mon, Sep 28", count: "1 commit" });
    expect(cellInfo(grid, 0, today)).toMatchObject({ date: "Wed, Oct 1", count: "rest day", active: false });
  });

  it("picks the same commit line for a cell every time", () => {
    expect(cellInfo(grid, 363, today).msg).toBe(cellInfo(grid, 363, today).msg);
  });
});
