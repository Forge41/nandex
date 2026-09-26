import { answers as authored } from "@/content/data";
import type { Answer, AnswerPara, Source } from "@/lib/types";

export type LocalAnswer = { paras: AnswerPara[]; ids: string[] };

const STOP = /what|have|with|about|your|does|tell|which|where|when|been|this|that|know|some|thing|much|many/;

export function answer(q: string, sources: Source[], answers: Answer[] = authored): LocalAnswer | null {
  const ql = q.toLowerCase();
  let best: Answer | null = null;
  let bestScore = 0;
  for (const a of answers) {
    const sc = a.keys.reduce((n, k) => n + (ql.includes(k) ? (k.length > 4 ? 2 : 1) : 0), 0);
    if (sc > bestScore) {
      bestScore = sc;
      best = a;
    }
  }
  if (best) return { paras: best.paras, ids: [] };

  const words = ql.split(/[^a-z0-9+.#-]+/).filter((w) => w.length > 3 && !STOP.test(w));
  const scored = sources
    .map((s) => ({ s, n: words.filter((w) => s.text.toLowerCase().includes(w)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  if (!scored.length) return null;

  return {
    paras: scored.slice(0, 2).map((x) => [{ t: x.s.text.split(/(?<=\.)\s/).slice(0, 2).join(" ") }, { c: x.s.id }]),
    ids: [],
  };
}
