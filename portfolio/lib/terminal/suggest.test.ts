import { describe, expect, it } from "vitest";

import { ghost, suggest } from "./suggest";

const base = { history: [], commands: [], sugSeed: 0, landing: true, fitPending: false, sudoPending: false };

describe("ghost", () => {
  it("offers the first suggestion on the landing screen", () => {
    expect(ghost(base)).toBe(suggest(base)[0]);
    expect(ghost(base)).not.toBe("/voice");
  });

  it("is empty while a prompt is pending", () => {
    expect(ghost({ ...base, fitPending: true })).toBe("");
  });
});
