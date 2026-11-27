// 局外養成：港口（珍珠、設施升級、招募）與棲息灣（保留夥伴）
import { FORMS } from '../data/creatures';
import { SKILLS } from '../data/skills';
import { STAGE_SLOTS } from '../data/types';
import { ancestryOf, makeMon, maxHp, newUid, rollIv, type Mon } from './creature';
import type { Rarity } from '../data/types';
import type { Egg } from './eggs';

export type UpgradeId = 'bait' | 'rod' | 'discount' | 'supply' | 'bay' | 'star' | 'school' | 'herbal' | 'kiln' | 'legend' | 'cabin';
export const UPGRADES: Record<UpgradeId, { name: string; desc: (lv: number) => string; costs: number[] }> = {
  bait: { name: '餌料倉', desc: (lv) => `開局的捕捉餌 +${lv}`, costs: [20, 45, 80] },
  rod: { name: '釣竿工坊', desc: (lv) => `收線時的捕捉區變寬 ${lv * 8}%`, costs: [25, 55, 95] },
  discount: { name: '漁具商會', desc: (lv) => `漂流商店打 ${10 - lv} 折`, costs: [30, 60, 100] },
  supply: { name: '補給庫', desc: (lv) => `開局多 ${lv} 個海藻藥膏、${lv * 20} 枚貝殼幣`, costs: [15, 35, 60] },
  bay: { name: '棲息灣擴建', desc: (lv) => `棲息灣可以住 ${10 + lv * 5} 隻夥伴`, costs: [80, 160, 260] },
  star: { name: '星光祭壇', desc: () => '開局獲得 1 個星光餌', costs: [120] },
  school: { name: '訓練所', desc: (lv) => `初始夥伴開局等級 +${lv}`, costs: [40, 85, 140] },
  herbal: { name: '藥草園', desc: (lv) => `營地休息多回復 ${lv * 15}% HP`, costs: [35, 75] },
  kiln: { name: '生命石窯', desc: () => '開局獲得 1 顆生命石', costs: [150] },
  legend: { name: '傳說祭壇', desc: () => '開局獲得 1 個傳說餌', costs: [260] },
  cabin: { name: '船艙擴建', desc: (lv) => `冒險結束時可以帶 ${1 + lv} 隻新夥伴回棲息灣`, costs: [60, 140] },
};

// 招募：前四隻一開始就能招募；其他的要先在圖鑑收服過（同一條進化線的任何型態都算）
export const RECRUITS: { form: string; cost: number; needDex?: boolean }[] = [
  { form: 'zaploach', cost: 30 },
  { form: 'starsand', cost: 30 },
  { form: 'bubcrab', cost: 40 },
  { form: 'gull1', cost: 60 },
  { form: 'jelly1', cost: 40, needDex: true },
  { form: 'iceshrimp', cost: 50, needDex: true },
  { form: 'lavasnail', cost: 50, needDex: true },
  { form: 'sprout_orb', cost: 55, needDex: true },
  { form: 'snow_crystal_spirit', cost: 60, needDex: true },
  { form: 'lava_bubble', cost: 60, needDex: true },
  { form: 'shadow_soul_flame', cost: 70, needDex: true },
  { form: 'cubelet', cost: 70, needDex: true },
  { form: 'pixfish', cost: 90, needDex: true },
  { form: 'lanternlarva', cost: 90, needDex: true },
  { form: 'abyss_wisp', cost: 90, needDex: true },
  { form: 'coral', cost: 80, needDex: true },
  { form: 'tide_cell', cost: 130, needDex: true },
  { form: 'thunder_wyrmling', cost: 220, needDex: true },
  { form: 'phantom_cub', cost: 220, needDex: true },
];
/** 這隻能不能招募：不需要圖鑑，或圖鑑收服過牠的任何一個型態 */
export function recruitUnlocked(form: string, caught: string[]): boolean {
  const r = RECRUITS.find((x) => x.form === form);
  if (!r?.needDex) return true;
  const family = FORMS[form].family;
  return caught.some((id) => FORMS[id]?.family === family);
}

export interface BayMon {
  id: string;
  form: string; // 結束冒險時的型態（顯示用）
  root: string; // 出海時的起始型態
  bond: number; // 羈絆：每一起出航一次 +1
  legacy: string | null; // 傳承技能
  evoMemory: string[]; // 曾經到達過的型態
  iv?: number[]; // 個體值（帶回港時保留）
  mutant?: boolean; // 異變個體
}

export interface Meta {
  version: 1;
  pearls: number;
  totalPearls: number;
  upgrades: Partial<Record<UpgradeId, number>>;
  recruits: string[];
  bay: BayMon[];
  runs: number;
  selected?: string; // 棲息灣裡「出航夥伴」的 id
  achieved?: string[]; // 已經領取獎勵的成就
  godHand?: boolean; // 撐過了神之手
  title?: string; // 目前顯示的稱號（成就 id）
  maxStar?: number; // 已解鎖的最高潮位
  star?: number; // 上次選的潮位
  daily?: { day: string; best: number; win: boolean; paid: boolean }; // 每日挑戰紀錄
  eggs?: Egg[]; // 棲息灣裡的潮汐卵
}

const KEY = 'tidehunter.meta.v1';
export function loadMeta(): Meta {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (m && m.version === 1) return migrate(m);
  } catch { /* 略過 */ }
  return { version: 1, pearls: 0, totalPearls: 0, upgrades: {}, recruits: [], bay: [], runs: 0 };
}
export function saveMeta(m: Meta) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* 略過 */ } }
export const upLv = (m: Meta, id: UpgradeId) => m.upgrades[id] ?? 0;
export const bayCap = (m: Meta) => 10 + upLv(m, 'bay') * 5;

// 舊存檔：以前「招募」的夥伴改成直接住進棲息灣
function migrate(m: Meta): Meta {
  if (m.recruits?.length) {
    for (const form of m.recruits) if (FORMS[form]) m.bay.push(newBayMon(form));
    m.recruits = [];
    saveMeta(m);
  }
  if (m.selected && !m.bay.some((b) => b.id === m.selected)) m.selected = undefined;
  return m;
}

/** 新的一隻棲息灣夥伴（抽到的、第一次選的初始夥伴） */
export function newBayMon(form: string, mutant = false): BayMon {
  return { id: newUid(), form, root: ancestryOf(form)[0].id, bond: 0, legacy: null, evoMemory: [], iv: rollIv(), mutant };
}
export const selectedBay = (m: Meta) => m.bay.find((b) => b.id === m.selected) ?? null;

// ── 分解：多出來的夥伴換成少量珍珠 ──
export const DISMANTLE: Record<Rarity, number> = { N: 5, B: 10, A: 25, S: 50, SSR: 100 };
/** 冒險結束時可以帶回棲息灣的新夥伴數量 */
export const bringBackSlots = (m: Meta) => 1 + upLv(m, 'cabin');
/** 沒帶回去的夥伴回到大海，留下的珍珠 */
export const releaseValue = (mon: Mon) => DISMANTLE[FORMS[rootOf(mon.form)]?.rarity ?? 'N'] * (mon.mutant ? 2 : 1);
export const dismantleValue = (b: BayMon) => DISMANTLE[FORMS[b.root]?.rarity ?? 'N'] * (b.mutant ? 2 : 1);
export function dismantle(m: Meta, id: string): number {
  const b = m.bay.find((x) => x.id === id);
  if (!b || m.selected === id) return 0;
  const v = dismantleValue(b);
  m.bay = m.bay.filter((x) => x.id !== id); m.pearls += v; m.totalPearls += v;
  saveMeta(m); return v;
}

// ── 招募抽卡 ──
export const PULL_COST = 200, TEN_COST = 1800, BROKEN_REFUND = 30;
export type Tier = 'broken' | Rarity;
export const TIERS: Tier[] = ['broken', 'N', 'B', 'A', 'S', 'SSR'];
/** 拋竿時拿到的釣竿（決定基本稀有度） */
export const ROD_RATES: [Tier, number][] = [['broken', 10], ['N', 55], ['B', 25], ['A', 8], ['S', 1.6], ['SSR', 0.4]];
/** 「轉」：水面變色、升一級的機率（可以連續轉） */
export const TURN_RATES: Partial<Record<Tier, number>> = { broken: 0.15, N: 0.08, B: 0.06, A: 0.04, S: 0.03 };
export const ROD_NAME: Record<Tier, string> = { broken: '破損釣竿', N: '普通釣竿', B: '綠色釣竿', A: '藍色釣竿', S: '紅色釣竿', SSR: '金色釣竿' };

/** 五片海域的霸主＋三個特殊區域的守護者：只能靠超特殊事件「神之手」得到，抓不到、抽不到、孵不出來 */
export const ZONE_BOSSES = new Set(['whale', 'frostking', 'lavadragon', 'mainframe_leviathan', 'nether_whale', 'vine_antler_deer', 'void_star_dragon', 'domain_realm_core']);
/** 可以抽到的生物：每一族的最初型態（不含霸主、環境形態） */
export function gachaPool(r: Rarity): string[] {
  const targets = new Set(Object.values(FORMS).flatMap((f) => (f.evolve ?? []).map((e) => e.to)));
  return Object.values(FORMS).filter((f) => !f.secret && f.id !== 'oracle' && !ZONE_BOSSES.has(f.id) && !targets.has(f.id) && !f.regional && f.rarity === r).map((f) => f.id);
}
export interface PullResult { rod: Tier; path: Tier[]; tier: Tier; form: string | null; mutant: boolean; bayId?: string }
export function rollPull(rnd: () => number = Math.random): PullResult {
  const total = ROD_RATES.reduce((a, [, w]) => a + w, 0);
  let x = rnd() * total, rod: Tier = 'N';
  for (const [t, w] of ROD_RATES) { x -= w; if (x <= 0) { rod = t; break; } }
  const path: Tier[] = [];
  let tier = rod;
  while (TURN_RATES[tier] !== undefined && rnd() < TURN_RATES[tier]!) { tier = TIERS[TIERS.indexOf(tier) + 1]; path.push(tier); }
  if (tier === 'broken') return { rod, path, tier, form: null, mutant: false };
  const pool = gachaPool(tier);
  return { rod, path, tier, form: pool[Math.floor(rnd() * pool.length)], mutant: rnd() < 1 / 40 };
}
/** 抽 n 次：扣珍珠、結果直接住進棲息灣；破損釣竿退還少量珍珠 */
export function doPulls(m: Meta, n: 1 | 10): PullResult[] | null {
  const cost = n === 10 ? TEN_COST : PULL_COST;
  if (m.pearls < cost || bayCap(m) - m.bay.length < n) return null;
  m.pearls -= cost;
  const res: PullResult[] = [];
  for (let i = 0; i < n; i++) {
    const r = rollPull();
    if (r.form) { const b = newBayMon(r.form, r.mutant); m.bay.push(b); r.bayId = b.id; }
    else m.pearls += BROKEN_REFUND;
    res.push(r);
  }
  saveMeta(m);
  return res;
}

export function buyUpgrade(m: Meta, id: UpgradeId): boolean {
  const lv = upLv(m, id), cost = UPGRADES[id].costs[lv];
  if (cost === undefined || m.pearls < cost) return false;
  m.pearls -= cost; m.upgrades[id] = lv + 1; saveMeta(m); return true;
}
/** @deprecated 招募改成抽卡，保留給舊程式相容 */
export function buyRecruit(m: Meta, form: string, caught: string[] = []): boolean {
  const r = RECRUITS.find((x) => x.form === form);
  if (!r || m.recruits.includes(form) || m.pearls < r.cost || !recruitUnlocked(form, caught)) return false;
  m.pearls -= r.cost; m.recruits.push(form); saveMeta(m); return true;
}

// ── 冒險結算 ──
export interface RunSummary { station: number; battlesWon: number; caught: number; win: boolean }
export function pearlsFor(s: RunSummary) {
  return s.station * 4 + s.battlesWon * 2 + s.caught * 4 + (s.win ? 60 : 0);
}

const rootOf = (form: string) => ancestryOf(form)[0].id;

// 把一隻夥伴帶回棲息灣（如果牠本來就是從棲息灣出來的，就更新原本那一筆）
export function bringBack(m: Meta, mon: Mon, replaceId?: string): BayMon {
  const chain = ancestryOf(mon.form).map((f) => f.id);
  const reached = chain.filter((id) => FORMS[id].stage > FORMS[chain[0]].stage);
  const rootLearn = new Set(ancestryOf(rootOf(mon.form))[0].learn.map(([, s]) => s));
  const legacyCand = mon.skills.filter((s) => !rootLearn.has(s)).sort((a, b) => (SKILLS[b]?.power ?? 0) - (SKILLS[a]?.power ?? 0));
  const existing = mon.bayId ? m.bay.find((b) => b.id === mon.bayId) : undefined;
  if (existing) return existing; // 本來就住在棲息灣，結算時已經由 returnFromRun 更新
  const rec: BayMon = { id: newUid(), form: mon.form, root: rootOf(mon.form), bond: 0, legacy: null, evoMemory: [], iv: mon.iv, mutant: mon.mutant };
  rec.form = mon.form;
  rec.bond += 1;
  rec.legacy = legacyCand[0] ?? rec.legacy;
  rec.evoMemory = [...new Set([...rec.evoMemory, ...reached])];
  if (replaceId) m.bay = m.bay.filter((b) => b.id !== replaceId);
  m.bay.push(rec);
  saveMeta(m);
  return rec;
}

// 從棲息灣帶夥伴出海
export function bayStartLevel(b: BayMon, m?: Meta) { return Math.min(10, 5 + Math.floor(b.bond / 2)) + (m ? upLv(m, 'school') : 0); }
export function monFromBay(b: BayMon): Mon {
  const mon = makeMon(b.root, bayStartLevel(b, loadMeta()));
  mon.bayId = b.id;
  mon.bond = b.bond;
  mon.evoBonus = b.evoMemory.length ? 2 : 0;
  if (b.iv) { mon.iv = [...b.iv]; mon.hp = maxHp(mon); }
  if (b.mutant) mon.mutant = true;
  if (b.legacy && !mon.skills.includes(b.legacy)) {
    const slots = STAGE_SLOTS[FORMS[mon.form].stage];
    if (mon.skills.length < slots) mon.skills.push(b.legacy); else if (mon.skills.length > 1) mon.skills[mon.skills.length - 1] = b.legacy;
  }
  return mon;
}
// 出海一次後，棲息灣裡的牠羈絆增加（不論有沒有被選回）
export function returnFromRun(m: Meta, party: Mon[]) {
  for (const mon of party) {
    if (!mon.bayId) continue;
    const b = m.bay.find((x) => x.id === mon.bayId);
    if (!b) continue;
    b.bond += 1;
    b.iv ??= mon.iv; // 舊存檔的夥伴：第一次出海後固定個體值
    const chain = ancestryOf(mon.form).map((f) => f.id);
    b.evoMemory = [...new Set([...b.evoMemory, ...chain.filter((id) => FORMS[id].stage > FORMS[b.root].stage)])];
  }
  saveMeta(m);
}

// ── 成就與稱號 ──
export interface AchStats { godhand?: boolean; caught: string[]; clears: number; bestStation: number; bosses: string[]; evolved: string[]; mutants: number; bay: number; runs: number }
export interface Achievement { id: string; title: string; desc: string; reward: number; secret?: boolean; check: (s: AchStats) => boolean }
const has = (arr: string[], ...ids: string[]) => ids.every((id) => arr.includes(id));
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'catch2', title: '新手獵手', desc: '第一次收服夥伴', reward: 10, check: (s) => s.caught.length >= 2 },
  { id: 'catch10', title: '見習獵手', desc: '圖鑑收服 10 種', reward: 20, check: (s) => s.caught.length >= 10 },
  { id: 'catch30', title: '資深獵手', desc: '圖鑑收服 30 種', reward: 40, check: (s) => s.caught.length >= 30 },
  { id: 'catch60', title: '海洋博物學家', desc: '圖鑑收服 60 種', reward: 80, check: (s) => s.caught.length >= 60 },
  { id: 'catch100', title: '潮汐百科', desc: '圖鑑收服 100 種', reward: 150, check: (s) => s.caught.length >= 100 },
  { id: 'whale', title: '鯨嘯克星', desc: '打倒碧藍淺灘的霸主', reward: 20, check: (s) => has(s.bosses, 'whale') },
  { id: 'twokings', title: '冰火雙王', desc: '打倒冰冠海豹王與熔岩海龍王', reward: 60, check: (s) => has(s.bosses, 'frostking', 'lavadragon') },
  { id: 'deep', title: '深海終結者', desc: '打倒主機海皇與冥海巨鯨', reward: 90, check: (s) => has(s.bosses, 'mainframe_leviathan', 'nether_whale') },
  { id: 'moxu', title: '萬潮的繼承者', desc: '打倒統領者・潮汐默旭', reward: 200, check: (s) => has(s.bosses, 'tide_moxu') },
  { id: 'guardians', title: '秘境探索家', desc: '打倒三個特殊區域的守護者', reward: 70, check: (s) => has(s.bosses, 'vine_antler_deer', 'void_star_dragon', 'domain_realm_core') },
  { id: 'clear1', title: '潮汐獵手', desc: '第一次通關', reward: 60, check: (s) => s.clears >= 1 },
  { id: 'clear5', title: '傳奇船長', desc: '通關 5 次', reward: 120, check: (s) => s.clears >= 5 },
  { id: 'far', title: '遠洋航海士', desc: '一局航行到第 30 站', reward: 50, check: (s) => s.bestStation >= 30 },
  { id: 'ssr', title: '傳說的邂逅', desc: '收服任何一隻傳說級（SSR）', reward: 50, check: (s) => s.caught.some((id) => FORMS[id]?.rarity === 'SSR') },
  { id: 'mutant', title: '異色收藏家', desc: '收服一隻 ✦ 異變個體', reward: 40, check: (s) => s.mutants >= 1 },
  { id: 'guard', title: '守護之心', desc: '讓初始夥伴進化成守護型', reward: 30, check: (s) => s.evolved.some((id) => ['water3b', 'fire3b', 'grass3b'].includes(id)) },
  { id: 'env', title: '環境之子', desc: '讓夥伴進化成地區形態', reward: 30, check: (s) => s.evolved.some((id) => !!FORMS[id]?.regional) },
  { id: 'baylove', title: '棲息灣大家庭', desc: '棲息灣住了 10 隻夥伴', reward: 30, check: (s) => s.bay >= 10 },
  { id: 'godhand', title: '神之手認可者', desc: '陪神之手玩滿 20 回合', reward: 2000, secret: true, check: (s) => !!s.godhand },
  { id: 'runs10', title: '老練的水手', desc: '出海 10 次', reward: 30, check: (s) => s.runs >= 10 },
];
export function claimAchievement(m: Meta, id: string): boolean {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a || m.achieved?.includes(id)) return false;
  m.achieved = [...(m.achieved ?? []), id]; m.pearls += a.reward; m.totalPearls += a.reward;
  if (!m.title) m.title = id;
  saveMeta(m); return true;
}
/** 從圖鑑與港口資料整理出成就要用的統計 */
export function achStats(m: Meta, d: { caught: string[]; clears: number; bestStation: number; bosses?: string[]; evolved?: string[]; mutants?: number }): AchStats {
  return { godhand: !!m.godHand, caught: d.caught, clears: d.clears, bestStation: d.bestStation, bosses: d.bosses ?? [], evolved: d.evolved ?? [], mutants: d.mutants ?? 0, bay: m.bay.length, runs: m.runs };
}
export const claimable = (m: Meta, st: AchStats) => ACHIEVEMENTS.filter((a) => !m.achieved?.includes(a.id) && a.check(st)).length;
export const titleOf = (m: Meta) => ACHIEVEMENTS.find((a) => a.id === m.title)?.title ?? null;
