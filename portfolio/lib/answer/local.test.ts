import { describe, expect, it } from "vitest";

import { answers, projects, sourceOrder } from "@/content/data";
import { loadSources, orderSources } from "@/lib/content";
import { answer } from "./local";

const sources = orderSources(loadSources());

describe("local answer", () => {
  it("picks the authored answer with the best keyword score", () => {
    const res = answer("what have you built with LiveKit?", sources);
    expect(res?.paras[0][0]).toEqual({
      t: "AutoInterviewer runs live voice interviews on LiveKit: 1,000 concurrent interviews at 300ms live-audio round-trip latency",
    });
  });

  it("weights long keywords double", () => {
    expect(answer("temporal", sources)?.paras[0][1]).toEqual({ c: "summary-think41" });
  });

  it("falls back to the two best matching source passages", () => {
    const res = answer("reducto ocr turbopuffer", sources);
    expect(res?.paras).toHaveLength(1);
    expect(res?.paras[0][1]).toEqual({ c: "resume-voice" });
  });

  it("returns null when nothing matches", () => {
    expect(answer("favourite pizza topping?", sources)).toBeNull();
  });

  it("cites the nantex summary for LaTeX questions", () => {
    expect(answer("what is nantex?", sources)?.paras[0][1]).toEqual({ c: "summary-nantex" });
  });
});

describe("authored content", () => {
  const ids = new Set(sources.map((s) => s.id));

  it("cites only sources that exist", () => {
    const cited = answers.flatMap((a) => a.paras.flat()).flatMap((p) => ("c" in p ? [p.c] : []));
    expect(cited.filter((id) => !ids.has(id))).toEqual([]);
  });

  it("points every project and ordered source at a real file", () => {
    expect(projects.map((p) => p.src).filter((id) => !ids.has(id))).toEqual([]);
    expect(sourceOrder.filter((id) => !ids.has(id))).toEqual([]);
  });
});
