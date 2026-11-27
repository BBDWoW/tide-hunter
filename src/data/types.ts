// 屬性、稀有度與相剋表

export type Elem = 'water' | 'fire' | 'grass' | 'elec' | 'ice' | 'rock' | 'spirit' | 'fly' | 'dark' | 'data';

export const ELEM: Record<Elem, { name: string; color: string }> = {
  water: { name: '水', color: '#3d9be9' },
  fire: { name: '火', color: '#f0602f' },
  grass: { name: '草', color: '#56b85a' },
  elec: { name: '電', color: '#f5c932' },
  ice: { name: '冰', color: '#8fd8ee' },
  spirit: { name: '靈', color: '#8abcf8' },
  rock: { name: '岩', color: '#b08a5a' },
  fly: { name: '飛', color: '#9fb4ff' },
  dark: { name: '暗', color: '#8a62d8' },
  data: { name: '數碼', color: '#2fe0c8' },
};

// 攻擊方 → 效果絕佳的防守方
const STRONG: Record<Elem, Elem[]> = {
  water: ['fire', 'rock'],
  fire: ['grass', 'ice'],
  grass: ['water', 'rock'],
  elec: ['water', 'fly'],
  ice: ['grass', 'fly'],
  spirit: [],
  rock: ['fire', 'ice', 'fly'],
  fly: ['grass'],
  dark: ['data'],
  data: ['elec', 'dark'],
};
// 攻擊方 → 效果不好的防守方
const WEAK: Record<Elem, Elem[]> = {
  water: ['water', 'grass'],
  fire: ['fire', 'water', 'rock'],
  grass: ['grass', 'fire', 'fly'],
  elec: ['elec', 'grass', 'rock'],
  ice: ['ice', 'fire', 'water'],
  spirit: [],
  rock: ['rock'],
  fly: ['elec', 'rock'],
  dark: ['dark'],
  data: ['data'],
};

export function effectiveness(att: Elem | null, def: Elem[]): number {
  if (!att) return 1;
  let m = 1;
  for (const d of def) {
    if (STRONG[att].includes(d)) m *= 2;
    else if (WEAK[att].includes(d)) m *= 0.5;
  }
  return m;
}

export type Rarity = 'N' | 'B' | 'A' | 'S' | 'SSR';
export const RARITY: Record<Rarity, { name: string; color: string; weight: number; mult: number; reel: number }> = {
  N: { name: '普通', color: '#d8e2f0', weight: 55, mult: 1.0, reel: 0 },
  B: { name: '優良', color: '#7ee36a', weight: 25, mult: 1.1, reel: 0.08 },
  A: { name: '稀有', color: '#5fb4ff', weight: 13, mult: 1.25, reel: 0.16 },
  S: { name: '史詩', color: '#c58cff', weight: 6, mult: 1.45, reel: 0.26 },
  SSR: { name: '傳說', color: '#ffcf4a', weight: 1, mult: 1.7, reel: 0.38 },
};
export const RARITY_ORDER: Rarity[] = ['N', 'B', 'A', 'S', 'SSR'];

export type Stage = 1 | 2 | 3;
export const STAGE_NAME: Record<Stage, string> = { 1: '幼體', 2: '成長體', 3: '完全體' };
// 每個階段可攜帶的技能上限
/** 技能槽：不分階段都是 4 格（第 1 格固定是普攻）；技能還是要升級才學得到 */
export const STAGE_SLOTS: Record<Stage, number> = { 1: 4, 2: 4, 3: 4 };
