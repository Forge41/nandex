export function waveLevels(count: number, energy: number, rnd: () => number = Math.random): number[] {
  return Array.from({ length: count }, (_, i) => {
    const env = Math.sin((i / count) * Math.PI);
    return Math.max(0, Math.min(1, env * energy * (0.35 + rnd() * 0.9)));
  });
}
