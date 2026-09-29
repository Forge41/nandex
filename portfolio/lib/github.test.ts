import { afterEach, describe, expect, it, vi } from "vitest";

import { ACTIVITY_USER, loadContributions } from "./github";

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
