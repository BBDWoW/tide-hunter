import { FORMS } from '../../src/data/creatures';
import { ZONES } from '../../src/game/run';
import { ancestryOf } from '../../src/game/creature';
const R = ['N', 'B', 'A', 'S', 'SSR'] as const;
const out: Record<string, unknown> = {};
for (const [z, d] of Object.entries(ZONES)) {
  const cnt: Record<string, number> = { N: 0, B: 0, A: 0, S: 0, SSR: 0 }, names: Record<string, string[]> = { N: [], B: [], A: [], S: [], SSR: [] };
  for (const id of d.pool) { const f = FORMS[id]; cnt[f.rarity]++; names[f.rarity].push(f.name); }
  // 進化後才會遇到的形態（在這片海域等級夠高時，野生的會直接是進化後的樣子）
  const evo = new Set<string>();
  const walk = (id: string) => { for (const e of FORMS[id].evolve ?? []) { if (!e.zone || e.zone === z) { evo.add(e.to); walk(e.to); } } };
  d.pool.forEach(walk);
  out[z] = { name: d.name, special: !!d.special, total: d.pool.length, cnt, names, boss: FORMS[d.boss].name, bossR: FORMS[d.boss].rarity, evo: [...evo].filter((x) => !d.pool.includes(x)).map((x) => `${FORMS[x].name}(${FORMS[x].rarity})`) };
}
const all = Object.values(FORMS).filter((f) => !f.secret);
const tot: Record<string, number> = {}; for (const f of all) tot[f.rarity] = (tot[f.rarity] ?? 0) + 1;
const inPool = new Set(Object.values(ZONES).flatMap((d) => d.pool));
const nowhere = all.filter((f) => !inPool.has(f.id) && ancestryOf(f.id).length === 1).map((f) => `${f.name}(${f.rarity})`);
console.log(JSON.stringify({ out, tot, total: all.length, nowhere }, null, 0));
