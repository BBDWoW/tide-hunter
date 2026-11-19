// 生物實例：等級、經驗、HP、技能
import { FORMS, hasAb, type Form, type Stats } from '../data/creatures';
import { RARITY, STAGE_SLOTS } from '../data/types';
import { SKILLS, type StatusId } from '../data/skills';

export interface Mon {
  uid: string;
  form: string;
  lv: number;
  xp: number;
  hp: number;
  skills: string[];
  status: StatusId | null;
  boss?: boolean;
  wild?: boolean; // 野生個體能力值較低；被收服後就會恢復正常
  bayId?: string; // 從棲息灣帶出來的夥伴
  bond?: number; // 羈絆值（經驗加成）
  evoBonus?: number; // 進化記憶：提早幾級進化
}

let uidCounter = 0;
export const newUid = () => `m${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

export const WILD_MULT = 0.82;

export const formOf = (m: Mon): Form => FORMS[m.form];

export function statsOf(m: Mon): Stats {
  const f = formOf(m), L = m.lv;
  const mult = RARITY[f.rarity].mult * (m.wild && !m.boss ? WILD_MULT : 1);
  const s = (b: number) => Math.floor(((b * 2 * L) / 50 + 5) * mult);
  let hp = Math.floor(((f.base.hp * 2 * L) / 50 + L + 10) * mult);
  if (hasAb(f, 'colossal')) hp = Math.floor(hp * 1.6);
  return { hp, atk: s(f.base.atk), def: s(f.base.def), spd: s(f.base.spd) };
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

export function makeMon(formId: string, lv: number, boss = false, wild = false): Mon {
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
  const m: Mon = { uid: newUid(), form: formId, lv, xp: 0, hp: 0, skills: picked, status: null, boss, wild };
  m.hp = maxHp(m);
  return m;
}

export const xpToNext = (lv: number) => 15 + lv * 8;
export function xpReward(enemy: Mon): number {
  const f = formOf(enemy);
  return Math.floor((20 + enemy.lv * 6) * RARITY[f.rarity].mult * (enemy.boss ? 2 : 1));
}

export interface LevelResult { levels: number; learnable: string[]; evolveTo: string | null }

// 加經驗並升級；回傳本次升了幾級、可學的新技能、是否可進化
export function gainXp(m: Mon, amount: number): LevelResult {
  const res: LevelResult = { levels: 0, learnable: [], evolveTo: null };
  m.xp += amount;
  while (m.xp >= xpToNext(m.lv) && m.lv < 50) {
    const before = maxHp(m);
    m.xp -= xpToNext(m.lv);
    m.lv++;
    res.levels++;
    if (m.hp > 0) m.hp += maxHp(m) - before;
    for (const [l, sk] of formOf(m).learn) if (l === m.lv && !m.skills.includes(sk)) res.learnable.push(sk);
  }
  res.evolveTo = evolveTarget(m);
  return res;
}

export function evolveTarget(m: Mon): string | null {
  const ev = formOf(m).evolve?.find((e) => m.lv >= e.level - (m.evoBonus ?? 0));
  return ev ? ev.to : null;
}

// 進化：換形態、按比例保留 HP，回傳新形態可學的技能
export function evolve(m: Mon, to: string): string[] {
  const ratio = m.hp / maxHp(m);
  m.form = to;
  m.hp = Math.max(1, Math.round(maxHp(m) * ratio));
  return FORMS[to].learn.filter(([l, sk]) => l <= m.lv && !m.skills.includes(sk)).map(([, sk]) => sk);
}

export const skillSlots = (m: Mon) => STAGE_SLOTS[formOf(m).stage];
