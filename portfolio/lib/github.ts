const DAYS = 364;
const CACHE_KEY = "nandisha_contrib_v1";
const ENDPOINT = "https://github-contributions-api.jogruber.de/v4/NandishNaik01?y=last";

export function sampleGrid(): number[] {
  let seed = 41;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const g: number[] = [];
  for (let i = 0; i < DAYS; i++) {
    const dow = i % 7;
    const wk = Math.floor(i / 7);
    const base = dow === 0 || dow === 6 ? 0.35 : 0.8;
    const season = 0.6 + 0.4 * Math.sin(wk / 8);
    g.push(rnd() < base * season ? Math.floor(rnd() * 12) + 1 : 0);
  }
  return g;
}

export function streaks(g: number[]) {
  let now = 0;
  for (let i = g.length - 1; i >= 0 && g[i] > 0; i--) now++;
  let max = 0;
  let cur = 0;
  for (const c of g) {
    cur = c > 0 ? cur + 1 : 0;
    max = Math.max(max, cur);
  }
  return { now, max, total: g.reduce((a, b) => a + b, 0) };
}

function readCache(): number[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) && v.length === DAYS ? v.map(Number) : null;
  } catch {
    return null;
  }
}

export async function loadContributions(): Promise<number[] | null> {
  const cached = readCache();
  if (cached) return cached;
  try {
    const res = await fetch(ENDPOINT);
    if (!res.ok) return null;
    const d = (await res.json()) as { contributions?: { count: number }[] };
    const arr = (d.contributions ?? []).slice(-DAYS).map((c) => c.count);
    if (arr.length !== DAYS) return null;
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(arr));
    } catch {}
    return arr;
  } catch {
    return null;
  }
}
