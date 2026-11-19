// 可序列化的種子亂數（mulberry32）。同樣的種子＋同樣的行動 → 同樣的結果，
// 之後做連線對戰時，兩端只要交換行動就能同步。
export interface Rng { s: number }

export function makeRng(seed: number): Rng { return { s: seed >>> 0 }; }

export function next(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const chance = (r: Rng, p: number) => next(r) < p;
export const range = (r: Rng, a: number, b: number) => a + next(r) * (b - a);
export const int = (r: Rng, a: number, b: number) => Math.floor(range(r, a, b + 1));
export const pick = <T,>(r: Rng, arr: readonly T[]): T => arr[Math.floor(next(r) * arr.length)];
export function weighted<T>(r: Rng, items: readonly [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = next(r) * total;
  for (const [v, w] of items) { if ((x -= w) < 0) return v; }
  return items[items.length - 1][0];
}
export const newSeed = () => (Math.random() * 2 ** 32) >>> 0;
