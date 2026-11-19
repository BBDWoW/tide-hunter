// 收服判定：收線成功後，魚在網裡晃動三次，每次都有機率掙脫。
import { FORMS } from '../data/creatures';
import type { Rarity } from '../data/types';
import { maxHp, type Mon } from './creature';
import { next, type Rng } from './rng';

const RARITY_CATCH: Record<Rarity, number> = { N: 1, B: 0.85, A: 0.68, S: 0.5, SSR: 0.36 };

// 整體成功率（三次晃動都要通過）
export function catchChance(mon: Mon, quality: number, shakeBoon: number): number {
  const hpRatio = Math.max(0, mon.hp) / maxHp(mon);
  let c = (1 - 0.8 * hpRatio) * RARITY_CATCH[FORMS[mon.form].rarity];
  if (mon.status) c *= 1.35;
  c *= 0.75 + 0.45 * quality; // 收線時張力壓得越低越好
  c *= 1 + 0.12 * shakeBoon;
  return Math.max(0.04, Math.min(0.97, c));
}

// 回傳每次晃動是否撐住（最多 3 次；第一次失敗就停止）
export function rollShakes(rng: Rng, chance: number): boolean[] {
  const per = Math.pow(chance, 1 / 3), out: boolean[] = [];
  for (let i = 0; i < 3; i++) { const ok = next(rng) < per; out.push(ok); if (!ok) break; }
  return out;
}
