// 生物實例：等級、經驗、HP、技能
import { FORMS, hasAb, type Form, type Stats } from '../data/creatures';
import { RARITY, STAGE_SLOTS } from '../data/types';
import { SKILLS, type StatusId } from '../data/skills';

import type { HeldId } from '../data/held';
export interface Mon {
  uid: string;
  form: string;
  lv: number;
  xp: number;
  hp: number;
  skills: string[];
  status: StatusId | null;
  statusTurns?: number; // 異常狀態剩幾回合（灼傷、中毒、流血、麻痺、致盲、資料錯亂）
  boss?: boolean;
  wild?: boolean; // 野生個體能力值較低；被收服後就會恢復正常
  bayId?: string; // 從棲息灣帶出來的夥伴
  bond?: number; // 羈絆值（經驗加成）
  evoBonus?: number; // 進化記憶：提早幾級進化
  iv?: number[]; // 個體值：[HP, 攻擊, 防禦, 速度]，各 -10～+10（%）
  style?: { atk: number; guard: number }; // 戰鬥風格：用攻擊技／變化技的次數（決定分支進化）
  mutant?: boolean; // 異變個體：顏色不同、個體值較好
  held?: HeldId; // 攜帶道具
}

export const MUTANT_CHANCE = 1 / 30;
/** 變成異變個體：換色、每項個體值至少 +3 */
export function makeMutant(m: Mon) {
  m.mutant = true;
  m.iv = (m.iv ?? [0, 0, 0, 0]).map((v) => Math.max(v, 3));
  m.hp = maxHp(m);
}
export { recolorOf } from '../data/creatures';

export const IV_RANGE = 10;
/** 產生隨機個體值；rng 不給就用 Math.random */
export function rollIv(rnd: () => number = Math.random): number[] {
  return [0, 1, 2, 3].map(() => Math.round(rnd() * IV_RANGE * 2 - IV_RANGE));
}
/** 個體評價：1～5 顆星 */
export function ivStars(iv?: number[]): number {
  if (!iv) return 3;
  const avg = iv.reduce((a, b) => a + b, 0) / iv.length;
  return Math.max(1, Math.min(5, Math.round(((avg + IV_RANGE) / (IV_RANGE * 2)) * 4) + 1));
}
export const IV_LABELS = ['HP', '攻擊', '防禦', '速度'];

// 分支進化：變化技使用比例達到這個值就走守護型
export const GUARD_THRESHOLD = 0.35;
export function styleRatio(m: Mon): number {
  const st = m.style; if (!st || st.atk + st.guard === 0) return 0;
  return st.guard / (st.atk + st.guard);
}
export const styleOf = (m: Mon): 'atk' | 'guard' => (styleRatio(m) >= GUARD_THRESHOLD ? 'guard' : 'atk');

let uidCounter = 0;
export const newUid = () => `m${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

export const WILD_MULT = 0.82;

export const formOf = (m: Mon): Form => FORMS[m.form];

export function statsOf(m: Mon): Stats {
  const f = formOf(m), L = m.lv;
  const mult = RARITY[f.rarity].mult * (m.wild && !m.boss ? WILD_MULT : 1);
  const iv = (i: number) => 1 + (m.iv?.[i] ?? 0) / 100;
  const s = (b: number, i: number) => Math.floor(((b * 2 * L) / 50 + 5) * mult * iv(i));
  let hp = Math.floor(((f.base.hp * 2 * L) / 50 + L + 10) * mult * iv(0));
  if (hasAb(f, 'colossal')) hp = Math.floor(hp * 1.6);
  return { hp, atk: s(f.base.atk, 1), def: s(f.base.def, 2), spd: s(f.base.spd, 3) };
}
export const maxHp = (m: Mon) => statsOf(m).hp;

// 往回找祖先形態，取得完整的技能學習表
export function ancestryOf(formId: string): Form[] {
  const chain: Form[] = [FORMS[formId]];
  let cur = formId;
  for (let guard = 0; guard < 5; guard++) {
    const parent = Object.values(FORMS).find((f) => f.evolve?.some((e) => e.to === cur));
    if (!parent) break;
    chain.unshift(parent);
    cur = parent.id;
  }
  return chain;
}

export function makeMon(formId: string, lv: number, boss = false, wild = false, rnd?: () => number): Mon {
  const f = FORMS[formId];
  const known: string[] = [];
  for (const anc of ancestryOf(formId)) for (const [l, sk] of anc.learn) if (l <= lv && !known.includes(sk)) known.push(sk);
  const slots = STAGE_SLOTS[f.stage];
  const picked = known.slice(-slots);
  // 確保至少有一招不耗能量的攻擊，優先選本系
  const basic = (id: string) => SKILLS[id] && SKILLS[id].cost === 0 && SKILLS[id].power > 0;
  if (!picked.some(basic)) {
    const b = known.find((id) => basic(id) && SKILLS[id].elem && f.elems.includes(SKILLS[id].elem!)) ?? known.find(basic);
    if (b) picked[0] = b;
  }
  // 至少要有一招攻擊技：沒有的話，用最近學會的攻擊技換掉最早的變化技
  const atk = (id: string) => SKILLS[id] && SKILLS[id].power > 0;
  if (!picked.some(atk)) {
    const a = [...known].reverse().find(atk);
    if (a) picked[0] = a;
  }
  const m: Mon = { uid: newUid(), form: formId, lv, xp: 0, hp: 0, skills: picked, status: null, boss, wild, iv: boss ? [0, 0, 0, 0] : rollIv(rnd) };
  m.hp = maxHp(m);
  return m;
}

/** 閃避率、格擋率：看種族的速度與防禦（2%～15%） */
const clampRate = (v: number) => Math.max(2, Math.min(15, v)) / 100;
export const dodgeRate = (f: Form) => clampRate((f.base.spd - 40) / 6);
export const blockRate = (f: Form) => clampRate((f.base.def - 40) / 6);

/** 等級上限 */
export const MAX_LV = 30;
export const xpToNext = (lv: number) => 15 + lv * 8;
export function xpReward(enemy: Mon): number {
  const f = formOf(enemy);
  return Math.floor((20 + enemy.lv * 6) * RARITY[f.rarity].mult * (enemy.boss ? 2 : 1));
}

export interface LevelResult { levels: number; learnable: string[]; evolveTo: string | null }

// 加經驗並升級；回傳本次升了幾級、可學的新技能、是否可進化
export function gainXp(m: Mon, amount: number, zone?: string): LevelResult {
  const res: LevelResult = { levels: 0, learnable: [], evolveTo: null };
  m.xp += amount;
  while (m.xp >= xpToNext(m.lv) && m.lv < MAX_LV) {
    const before = maxHp(m);
    m.xp -= xpToNext(m.lv);
    m.lv++;
    res.levels++;
    if (m.hp > 0) m.hp += maxHp(m) - before;
    for (const [l, sk] of formOf(m).learn) if (l === m.lv && !m.skills.includes(sk)) res.learnable.push(sk);
  }
  res.evolveTo = evolveTarget(m, zone);
  return res;
}

export function evolveTarget(m: Mon, zone?: string): string | null {
  const ready = (formOf(m).evolve ?? []).filter((e) => m.lv >= e.level - (m.evoBonus ?? 0) && (!e.zone || e.zone === zone));
  if (!ready.length) return null;
  // 環境進化優先：在指定區域進化會變成地區形態
  const env = ready.find((e) => e.zone);
  if (env) return env.to;
  // 有分支時，依戰鬥風格選擇
  const st = styleOf(m);
  return (ready.find((e) => e.style === st) ?? ready.find((e) => !e.style && !e.zone) ?? ready[0]).to;
}

// 進化：換形態、按比例保留 HP，回傳新形態可學的技能
export function evolve(m: Mon, to: string): string[] {
  const ratio = m.hp / maxHp(m);
  m.form = to;
  m.hp = Math.max(1, Math.round(maxHp(m) * ratio));
  return FORMS[to].learn.filter(([l, sk]) => l <= m.lv && !m.skills.includes(sk)).map(([, sk]) => sk);
}

export const skillSlots = (m: Mon) => STAGE_SLOTS[formOf(m).stage];
