import type { AnswerPara, AnswerSeg } from "@/lib/types";

export type RenderSeg =
  | { kind: "text"; t: string }
  | { kind: "code"; t: string }
  | { kind: "cite"; id: string; n: number };

const ID = "[A-Za-z0-9][\\w-]*";
const TOKEN = new RegExp(`(\`[^\`\\n]+\`)|\\s*\\[(${ID}(?:\\s*,\\s*${ID})*)\\]`, "g");
const PARTIAL_TAIL = /\s*\[[\w\s,-]*$|`[^`\n]*$/;

/** Only ids in `valid` become citations; any other bracketed id is dropped, so a
 * model that invents a source cannot render a chip pointing at nothing. */
export function parseAnswer(raw: string, valid: readonly string[], streaming = false): AnswerPara[] {
  const allowed = new Set(valid);
  const text = (streaming ? raw.replace(PARTIAL_TAIL, "") : raw).replace(/\*\*/g, "");
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const segs: AnswerSeg[] = [];
      let last = 0;
      for (const m of block.matchAll(TOKEN)) {
        const start = m.index ?? 0;
        if (start > last) segs.push({ t: block.slice(last, start) });
        if (m[1]) segs.push({ t: m[1].slice(1, -1), code: true });
        else
          m[2]
            .split(",")
            .map((id) => id.trim())
            .filter((id) => allowed.has(id))
            .forEach((c) => segs.push({ c }));
        last = start + m[0].length;
      }
      if (last < block.length) segs.push({ t: block.slice(last) });
      return segs;
    })
    .filter((segs) => segs.length > 0);
}

/** Numbers citations in first-appearance order across the whole answer, which is
 * the order the refs list is printed in. */
export function numberCitations(paras: AnswerPara[]): { order: string[]; paras: RenderSeg[][] } {
  const order: string[] = [];
  const num = (id: string) => {
    let i = order.indexOf(id);
    if (i < 0) {
      order.push(id);
      i = order.length - 1;
    }
    return i + 1;
  };
  const out = paras.map((p) =>
    p.map((s): RenderSeg => {
      if ("c" in s) return { kind: "cite", id: s.c, n: num(s.c) };
      return s.code ? { kind: "code", t: s.t } : { kind: "text", t: s.t };
    }),
  );
  return { order, paras: out };
}

export const plainText = (paras: AnswerPara[]) =>
  paras.map((p) => p.map((s) => ("c" in s ? "" : s.t)).join("")).join(" ");

export const estimateTokens = (paras: AnswerPara[]) =>
  Math.round(paras.reduce((n, p) => n + p.reduce((m, s) => m + ("c" in s ? 0 : s.t.length), 0), 0) / 4);
