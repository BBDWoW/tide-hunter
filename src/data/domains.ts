// 特殊區域的「領域效果」：在那片區域裡的每一場戰鬥都會生效（敵我雙方都受影響）
import type { Elem } from './types';

export type DomainId = 'forest' | 'void' | 'core';
export const DOMAINS: Record<DomainId, { name: string; desc: string; color: string; elem: Elem; short: string }> = {
  forest: { name: '萬物生長', short: '雙方每回合回復・草系 +25%', desc: '每回合結束時，你場上的夥伴回復 1/16 HP（草屬性 1/10）；敵人也會回復 1/24 HP。雙方的草屬性技能威力 +25%。', color: '#6fdc6a', elem: 'grass' },
  void: { name: '顛倒法則', short: '慢的先動・暗系 +25%', desc: '速度比較慢的一方會先行動（先制技能不受影響）。雙方的暗屬性技能威力 +25%。', color: '#b07aff', elem: 'dark' },
  core: { name: '資料超載', short: '雙方能量加速・資料系 +25%', desc: '你的夥伴每回合多回復 1 點能量；敵人每 2 回合多回復 1 點。雙方的資料屬性技能威力 +25%。', color: '#4ee6ff', elem: 'data' },
};
export const isDomain = (z: string): z is DomainId => z in DOMAINS;
