// 每場戰鬥後三選一的能力卡
export type BoonTier = 'common' | 'rare' | 'epic' | 'legend';
export const BOON_TIER: Record<BoonTier, { name: string; color: string; weight: number }> = {
  common: { name: '普通', color: '#c8d6f0', weight: 68 },
  rare: { name: '稀有', color: '#5fb4ff', weight: 26 },
  epic: { name: '史詩', color: '#ffcf4a', weight: 6 },
  legend: { name: '傳說', color: '#ff7ad8', weight: 0 }, // 另外抽，一局最多一張
};
/** 流派：同流派的能力卡互相加乘 */
export const BOON_STYLE: Record<string, { name: string; color: string }> = {
  burn: { name: '灼燒流', color: '#ff7a3a' },
  shield: { name: '護盾流', color: '#7ad8ff' },
  multi: { name: '連擊流', color: '#ffe04a' },
  catch: { name: '捕捉流', color: '#7ee36a' },
  reso: { name: '共鳴流', color: '#c58cff' },
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
  guardian?: boolean; // 只有打倒特殊區域守護者才拿得到（不會出現在一般能力卡）
  style?: keyof typeof BOON_STYLE; // 所屬流派
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
  // ── 流派：灼燒 ──
  { id: 'x_ignite', name: '點火', desc: '攻擊命中時有 15% 機率讓對手灼傷（每層 +15%）。', tier: 'rare', cat: '戰鬥', max: 2, style: 'burn' },
  { id: 'x_fuel', name: '助燃', desc: '對灼傷中的對手傷害 +25%（每層再 +25%）。', tier: 'common', cat: '戰鬥', max: 2, style: 'burn' },
  { id: 'x_wildfire', name: '燎原', desc: '對手的灼傷傷害變 2 倍；灼傷的對手倒下時，下一隻上場的也會被灼傷。', tier: 'epic', cat: '戰鬥', max: 1, style: 'burn' },
  // ── 流派：護盾 ──
  { id: 'x_tidearmor', name: '潮汐護甲', desc: '每場戰鬥開始，先發夥伴獲得 20% HP 的護盾（每層 +10%）。', tier: 'common', cat: '戰鬥', max: 2, style: 'shield' },
  { id: 'x_surge', name: '浪湧', desc: '換人上場的夥伴獲得 12% HP 的護盾（每層 +12%）。', tier: 'common', cat: '戰鬥', max: 2, style: 'shield' },
  { id: 'x_thorns', name: '珊瑚刺', desc: '護盾擋下的傷害，有一半會反彈給攻擊者。', tier: 'epic', cat: '戰鬥', max: 1, style: 'shield' },
  // ── 流派：連擊 ──
  { id: 'x_chain', name: '連環', desc: '連擊技能多打 1 下（每層再 +1）。', tier: 'rare', cat: '戰鬥', max: 2, style: 'multi' },
  { id: 'x_ramp', name: '越打越猛', desc: '連擊技能每多打一下，那一下威力 +25%（每層再 +25%）。', tier: 'common', cat: '戰鬥', max: 2, style: 'multi' },
  { id: 'x_echo', name: '回音', desc: '普攻有 40% 機率再打一次。', tier: 'rare', cat: '戰鬥', max: 1, style: 'multi' },
  // ── 流派：捕捉 ──
  { id: 'x_hunter', name: '獵人之心', desc: '這一局每收服一隻夥伴，全隊攻擊 +4%（一直疊加）。', tier: 'rare', cat: '捕捉', max: 1, style: 'catch' },
  { id: 'x_thrift', name: '回收網', desc: '收服成功時，有一半機率把捕捉餌拿回來。', tier: 'common', cat: '捕捉', max: 1, style: 'catch' },
  { id: 'x_tranq', name: '安撫', desc: '野生潮靈 HP 低於 1/3 時，收服成功率 ×1.3。', tier: 'common', cat: '捕捉', max: 1, style: 'catch' },
  // ── 流派：共鳴 ──
  { id: 'x_duo', name: '二重奏', desc: '隊伍裡只要 2 隻同屬性，就能觸發 +10% 的屬性共鳴。', tier: 'rare', cat: '戰鬥', max: 1, style: 'reso' },
  { id: 'x_relay', name: '接力', desc: '換人上場後，那隻夥伴的下一招威力 +30%（每層再 +30%）。', tier: 'common', cat: '戰鬥', max: 2, style: 'reso' },
  // ── 傳說（一局最多一張） ──
  { id: 'L_phoenix', name: '不死鳥之羽', desc: '每場戰鬥第一隻倒下的夥伴，會立刻以 50% HP 復活。', tier: 'legend', cat: '回復', max: 1 },
  { id: 'L_tideking', name: '潮汐之王', desc: '每回合多回復 1 點能量。', tier: 'legend', cat: '戰鬥', max: 1 },
  { id: 'L_execute', name: '處刑者', desc: '擊中要害的機率 +10%，要害傷害從 1.5 倍變成 2.5 倍。', tier: 'legend', cat: '戰鬥', max: 1 },
  { id: 'L_midas', name: '點石成金', desc: '每打贏一場戰鬥多拿 25 枚貝殼幣，商店價格 −30%。', tier: 'legend', cat: '養成', max: 1 },
  { id: 'L_twin', name: '萬物共鳴', desc: '所有屬性共鳴的效果加倍，而且 2 隻同屬性就會觸發。', tier: 'legend', cat: '戰鬥', max: 1, style: 'reso' },
  // ── 守護者的祝福（特殊區域獎勵） ──
  { id: 'g_forest', name: '林之恩惠', desc: '每場戰鬥後，倒下的夥伴會以 30% HP 醒來。', tier: 'epic', cat: '回復', max: 1, guardian: true },
  { id: 'g_void', name: '虛空之眼', desc: '擊中要害的機率 +12%。', tier: 'epic', cat: '戰鬥', max: 2, guardian: true },
  { id: 'g_core', name: '核心同步', desc: '每場戰鬥開始時能量 +1（可以和滿潮開局疊加）。', tier: 'epic', cat: '戰鬥', max: 2, guardian: true },
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
