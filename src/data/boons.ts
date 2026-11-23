// 每場戰鬥後三選一的能力卡
export type BoonTier = 'common' | 'rare' | 'epic';
export const BOON_TIER: Record<BoonTier, { name: string; color: string; weight: number }> = {
  common: { name: '普通', color: '#c8d6f0', weight: 68 },
  rare: { name: '稀有', color: '#5fb4ff', weight: 26 },
  epic: { name: '史詩', color: '#ffcf4a', weight: 6 },
};

export type BoonCat = '戰鬥' | '捕捉' | '釣魚' | '養成' | '回復';

export interface Boon {
  id: string;
  name: string;
  desc: string;
  tier: BoonTier;
  cat: BoonCat;
  max?: number; // 最多可疊幾層（沒寫 = 可無限疊加；instant 卡不計）
  instant?: boolean; // 選了立刻生效、不會留在身上
}

const B: Boon[] = [
  { id: 'atk', name: '怒潮之力', desc: '全隊攻擊 +10%。', tier: 'common', cat: '戰鬥', max: 5 },
  { id: 'def', name: '鐵殼守護', desc: '全隊防禦 +10%。', tier: 'common', cat: '戰鬥', max: 5 },
  { id: 'energy', name: '滿潮開局', desc: '每場戰鬥開始時能量 +1。', tier: 'rare', cat: '戰鬥', max: 2 },
  { id: 'crit', name: '銳眼', desc: '擊中要害的機率 +6%。', tier: 'common', cat: '戰鬥', max: 3 },
  { id: 'shake', name: '結實的網', desc: '收服時每次晃動的成功率提高。', tier: 'common', cat: '捕捉', max: 4 },
  { id: 'reelzone', name: '寬口網', desc: '收線小遊戲的捕捉區變寬 15%。', tier: 'common', cat: '捕捉', max: 3 },
  { id: 'bait2', name: '補給：捕捉餌', desc: '立刻獲得捕捉餌 ×2。', tier: 'common', cat: '捕捉', instant: true },
  { id: 'starlure', name: '星光餌', desc: '立刻獲得星光餌 ×1（有機會釣到 S 級）。', tier: 'rare', cat: '釣魚', instant: true },
  { id: 'legendlure', name: '傳說餌', desc: '立刻獲得傳說餌 ×1（有機會釣到 SSR）。', tier: 'epic', cat: '釣魚', instant: true },
  { id: 'steady', name: '穩定手腕', desc: '拋竿的完美區變大。', tier: 'common', cat: '釣魚', max: 3 },
  { id: 'lucky', name: '幸運浮標', desc: '更容易釣到大魚與寶箱。', tier: 'rare', cat: '釣魚', max: 3 },
  { id: 'xp', name: '潮汐訓練', desc: '獲得的經驗值 +30%。', tier: 'common', cat: '養成', max: 4 },
  { id: 'train', name: '特訓', desc: '等級最低的夥伴立刻提升 2 級。', tier: 'rare', cat: '養成', instant: true },
  { id: 'breeze', name: '海風', desc: '每場戰鬥後多回復 15% HP。', tier: 'common', cat: '回復', max: 3 },
  { id: 'spring', name: '海底溫泉', desc: '立刻讓全隊完全回復（包含倒下的夥伴）。', tier: 'rare', cat: '回復', instant: true },
  { id: 'supply', name: '補給：藥膏', desc: '立刻獲得海藻藥膏 ×2。', tier: 'common', cat: '回復', instant: true },
  { id: 'revive', name: '補給：復甦貝', desc: '立刻獲得復甦貝 ×1。', tier: 'rare', cat: '回復', instant: true },
];
export const BOONS: Record<string, Boon> = Object.fromEntries(B.map((b) => [b.id, b]));
export const BOON_LIST = B;

// ── 魚餌 ──
export type LureId = 'normal' | 'star' | 'legend';
export const LURES: Record<LureId, { name: string; desc: string }> = {
  normal: { name: '普通餌', desc: '只會釣到 N／B／A 級。不會用完。' },
  star: { name: '星光餌', desc: '會引來大魚，有機會是 S 級。' },
  legend: { name: '傳說餌', desc: '會引來大魚，有機會是 SSR 傳說級。' },
};
