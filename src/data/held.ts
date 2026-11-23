// 攜帶道具：每隻夥伴可以帶一個，戰鬥中自動生效
import type { Elem } from './types';

export type HeldId =
  | 'sharpfang' | 'shellplate' | 'swiftfin' | 'leechcoral' | 'lastpearl' | 'sparkcell' | 'scope'
  | 'venomspine' | 'cleansebell' | 'ripplecloak' | 'berserkscale' | 'tidecrest' | 'bubblecharm';

export const HELD: Record<HeldId, { name: string; icon: string; desc: string; price: number }> = {
  sharpfang: { name: '鯊齒', icon: '🦷', desc: '攻擊 +20%。', price: 70 },
  shellplate: { name: '硬殼片', icon: '🐚', desc: '受到的傷害 −15%。', price: 70 },
  swiftfin: { name: '迅鰭', icon: '🪶', desc: '速度 +20%。', price: 60 },
  leechcoral: { name: '吸血珊瑚', icon: '🪸', desc: '造成傷害的 15% 轉為回復。', price: 80 },
  lastpearl: { name: '不屈珍珠', icon: '⚪', desc: '每場戰鬥一次，受到致命傷時保留 1 HP。', price: 90 },
  sparkcell: { name: '電池海膽', icon: '🔋', desc: '上場時能量 +1。', price: 70 },
  scope: { name: '瞄準鏡片', icon: '🔍', desc: '擊中要害的機率 +12%。', price: 60 },
  venomspine: { name: '毒棘', icon: '🌵', desc: '攻擊命中時 20% 使對手中毒。', price: 60 },
  cleansebell: { name: '淨化鈴', icon: '🔔', desc: '異常狀態的回合數減半。', price: 50 },
  ripplecloak: { name: '漣漪披風', icon: '🌀', desc: '閃避率 +8%。', price: 70 },
  berserkscale: { name: '狂戰之鱗', icon: '🔥', desc: '攻擊 +35%，但防禦 −20%。', price: 80 },
  tidecrest: { name: '潮之冠', icon: '👑', desc: '自己展開的場地多持續 2 回合。', price: 50 },
  bubblecharm: { name: '泡泡護符', icon: '🫧', desc: '上場時獲得 15% HP 的護盾。', price: 70 },
};
export const HELD_IDS = Object.keys(HELD) as HeldId[];

/** 屬性共鳴：隊伍裡同屬性的夥伴越多，那個屬性的技能越強 */
export const RESONANCE = [{ n: 4, bonus: 0.25 }, { n: 3, bonus: 0.15 }];
export function resonance(elemLists: Elem[][]): Partial<Record<Elem, number>> {
  const count: Partial<Record<Elem, number>> = {};
  for (const l of elemLists) for (const e of new Set(l)) count[e] = (count[e] ?? 0) + 1;
  const out: Partial<Record<Elem, number>> = {};
  for (const [e, n] of Object.entries(count) as [Elem, number][]) {
    const tier = RESONANCE.find((r) => n >= r.n);
    if (tier) out[e] = tier.bonus;
  }
  return out;
}
