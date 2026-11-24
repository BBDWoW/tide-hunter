// 潮汐卵：打倒霸主、守護者，或開到黃金寶箱時，有小機率拿到。
// 放在棲息灣，每出海一局（不管輸贏）前進一格，時間到就孵化；有機率孵化失敗，可以花珍珠「暖蛋」降低失敗率。
// 孵出來的夥伴一定帶一招平常學不到的「遺傳技」，異變機率也比較高。
import { FORMS, ZONE1_POOL, ICE_POOL, LAVA_POOL, CYBER_POOL, ABYSS_POOL, FOREST_POOL, VOID_POOL, CORE_POOL } from '../data/creatures';
import { SKILLS } from '../data/skills';
import type { Elem, Rarity } from '../data/types';
import { ancestryOf, newUid } from './creature';
import { ZONE_BOSSES, newBayMon, type BayMon, type Meta } from './meta';

export type EggZone = 'shallows' | 'ice' | 'lava' | 'cyber' | 'abyss' | 'forest' | 'void' | 'core';
export interface Egg { id: string; zone: EggZone; left: number; total: number; warm: number }

export const EGG_INFO: Record<EggZone, { name: string; shell: string; spot: string; dark: string; pool: string[]; runs: number; better?: boolean }> = {
  shallows: { name: '淺灘卵', shell: '#f4ead2', spot: '#5fb4ff', dark: '#8a7a5a', pool: ZONE1_POOL, runs: 2 },
  ice: { name: '冰封卵', shell: '#eaf6ff', spot: '#8ad8ff', dark: '#6a8aa8', pool: ICE_POOL, runs: 2 },
  lava: { name: '熔岩卵', shell: '#3a2620', spot: '#ff7a2a', dark: '#1a0e0c', pool: LAVA_POOL, runs: 2 },
  cyber: { name: '電子卵', shell: '#2a2060', spot: '#5ff1ff', dark: '#120a30', pool: CYBER_POOL, runs: 3 },
  abyss: { name: '深淵卵', shell: '#1a2440', spot: '#9ad8ff', dark: '#080c1a', pool: ABYSS_POOL, runs: 3 },
  forest: { name: '聖林卵', shell: '#d8f0b8', spot: '#4ab04a', dark: '#5a7a3a', pool: FOREST_POOL, runs: 3, better: true },
  void: { name: '無稽卵', shell: '#2a1444', spot: '#c89aff', dark: '#10061e', pool: VOID_POOL, runs: 3, better: true },
  core: { name: '域核卵', shell: '#0e3050', spot: '#5ff1ff', dark: '#041624', pool: CORE_POOL, runs: 3, better: true },
};
/** 拿到蛋的機率 */
export const EGG_DROP = { boss: 0.2, guardian: 0.35, goldChest: 0.03 };
/** 棲息灣最多放幾顆蛋 */
export const NEST_CAP = 3;
/** 孵化失敗率：基本 25%，每暖一次 −8%，最多暖 3 次 */
export const EGG_FAIL = 0.25, WARM_STEP = 0.08, WARM_MAX = 3, WARM_COST = 50;
export const failRate = (e: Egg) => Math.max(0.01, EGG_FAIL - e.warm * WARM_STEP);

export const newEgg = (zone: EggZone): Egg => ({ id: newUid(), zone, left: EGG_INFO[zone].runs, total: EGG_INFO[zone].runs, warm: 0 });

/** 冒險結束：棲息灣的蛋都前進一格，再把這局拿到的蛋放進去（放不下的換成珍珠） */
export function settleEggs(m: Meta, found: EggZone[]): { added: number; sold: number } {
  m.eggs ??= [];
  for (const e of m.eggs) e.left = Math.max(0, e.left - 1);
  let added = 0, sold = 0;
  for (const z of found) {
    if (m.eggs.length < NEST_CAP) { m.eggs.push(newEgg(z)); added++; }
    else { m.pearls += 30; m.totalPearls += 30; sold++; }
  }
  return { added, sold };
}

/** 暖蛋：花珍珠降低失敗率 */
export function warmEgg(m: Meta, id: string): boolean {
  const e = m.eggs?.find((x) => x.id === id);
  if (!e || e.warm >= WARM_MAX || m.pearls < WARM_COST) return false;
  m.pearls -= WARM_COST; e.warm++;
  return true;
}

export type HatchResult = { ok: false } | { ok: true; mon: BayMon; legacyName: string };
/** 孵化：失敗就只剩空蛋殼；成功的話孵出這片海域的夥伴，帶一招遺傳技 */
export function hatchEgg(m: Meta, id: string, rnd: () => number = Math.random): HatchResult | null {
  const e = m.eggs?.find((x) => x.id === id);
  if (!e || e.left > 0) return null;
  m.eggs = m.eggs!.filter((x) => x.id !== id);
  if (rnd() < failRate(e)) return { ok: false };
  const info = EGG_INFO[e.zone];
  const targets = new Set(Object.values(FORMS).flatMap((f) => (f.evolve ?? []).map((v) => v.to)));
  const roots = [...new Set(info.pool.map((id) => ancestryOf(id)[0].id))].filter((id) => FORMS[id] && !targets.has(id) && !ZONE_BOSSES.has(id) && !FORMS[id].secret);
  const W: Record<Rarity, number> = info.better ? { N: 20, B: 32, A: 28, S: 15, SSR: 5 } : { N: 35, B: 35, A: 20, S: 8, SSR: 2 };
  const total = roots.reduce((a, id) => a + W[FORMS[id].rarity], 0);
  let x = rnd() * total, form = roots[0];
  for (const id of roots) { x -= W[FORMS[id].rarity]; if (x <= 0) { form = id; break; } }
  const mon = newBayMon(form, rnd() < 1 / 8);
  mon.legacy = eggMove(form, rnd);
  return { ok: true, mon, legacyName: mon.legacy ? SKILLS[mon.legacy]?.name ?? '' : '' };
}

/** 遺傳技：跟自己屬性相同、但整條進化線都學不到的攻擊技（挑比較強的） */
export function eggMove(form: string, rnd: () => number = Math.random): string | null {
  const line = new Set<string>();
  for (const f of Object.values(FORMS)) if (ancestryOf(f.id)[0].id === ancestryOf(form)[0].id) for (const [, sk] of f.learn) line.add(sk);
  const elems = FORMS[form].elems as Elem[];
  const ok = (sk: { id: string }) => !line.has(sk.id) && !sk.id.startsWith('gh_');
  const all = Object.values(SKILLS).filter(ok);
  // 先找同屬性的強力攻擊技；找不到就放寬條件，保證一定有一招遺傳技
  let cands = all.filter((s) => s.power >= 55 && s.cost <= 2 && s.elem && elems.includes(s.elem));
  if (!cands.length) cands = all.filter((s) => s.power >= 35 && s.elem && elems.includes(s.elem));
  if (!cands.length) cands = all.filter((s) => s.power >= 60 && s.cost <= 2);
  if (!cands.length) return null;
  cands.sort((a, b) => b.power - a.power);
  const top = cands.slice(0, Math.max(3, Math.ceil(cands.length / 2)));
  return top[Math.floor(rnd() * top.length)].id;
}
