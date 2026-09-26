import { describe, expect, it } from "vitest";

import { loadSources, orderSources } from "@/lib/content";
import { answer } from "./local";

const sources = orderSources(loadSources());

describe("local answer", () => {
  it("picks the authored answer with the best keyword score", () => {
    const res = answer("what have you built with LiveKit?", sources);
    expect(res?.paras[0][0]).toEqual({
      t: "Two things. At Think41 I architected RQ, a LangChain-based PRD generator with LiveKit real-time collaboration",
    });
  });

  it("weights long keywords double", () => {
    expect(answer("temporal", sources)?.paras[0][1]).toEqual({ c: "resume-sde2" });
  });

  it("falls back to the two best matching source passages", () => {
    const res = answer("reducto ocr turbopuffer", sources);
    expect(res?.paras).toHaveLength(1);
    expect(res?.paras[0][1]).toEqual({ c: "resume-voice" });
  });

  it("returns null when nothing matches", () => {
    expect(answer("favourite pizza topping?", sources)).toBeNull();
  });
});
