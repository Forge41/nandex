import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { experience, projects, stackGroups } from "@/content/data";
import { markFor } from "@/lib/terminal/marks";
import { loadSources } from "./content";

const ids = new Set(loadSources().map((s) => s.id));

describe("content", () => {
  it("cites a real source from every role and project", () => {
    const dangling = [...experience, ...projects].filter((x) => !ids.has(x.src)).map((x) => x.src);
    expect(dangling).toEqual([]);
  });

  it("ships a screenshot for every project on the shelf", () => {
    for (const p of projects.filter((x) => x.live)) {
      const shot = path.join(process.cwd(), "public", p.live!.shot);
      expect(existsSync(shot), `${p.name}: ${p.live!.shot} is missing`).toBe(true);
    }
  });

  it("describes what was done on every role", () => {
    for (const r of experience) expect(r.did.length, `${r.id} has no bullets`).toBeGreaterThan(0);
  });

  it("gives every stack item a mark or a monogram of its own", () => {
    for (const g of stackGroups)
      for (const item of g.items) {
        const mark = markFor(item);
        if ("mono" in mark) expect(mark.mono, item).toMatch(/^[A-Z0-9]{1,3}$/);
        else expect(mark.slug, item).toMatch(/^[a-z0-9.]+$/);
      }
  });

  it("lists each stack item once across the groups", () => {
    const all = stackGroups.flatMap((g) => g.items);
    expect(all.length).toBe(new Set(all).size);
  });

  it("marks exactly one role as current", () => {
    expect(experience.filter((r) => r.current)).toHaveLength(1);
  });
});
