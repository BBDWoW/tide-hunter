// 局外養成：港口（珍珠、設施升級、招募）與棲息灣（保留夥伴）
import { FORMS } from '../data/creatures';
import { SKILLS } from '../data/skills';
import { STAGE_SLOTS } from '../data/types';
import { ancestryOf, makeMon, maxHp, newUid, type Mon } from './creature';

export type UpgradeId = 'bait' | 'rod' | 'discount' | 'supply' | 'bay' | 'star';
export const UPGRADES: Record<UpgradeId, { name: string; desc: (lv: number) => string; costs: number[] }> = {
  bait: { name: '餌料倉', desc: (lv) => `開局的捕捉餌 +${lv}`, costs: [20, 45, 80] },
  rod: { name: '釣竿工坊', desc: (lv) => `收線時的捕捉區變寬 ${lv * 8}%`, costs: [25, 55, 95] },
  discount: { name: '漁具商會', desc: (lv) => `漂流商店打 ${10 - lv} 折`, costs: [30, 60, 100] },
  supply: { name: '補給庫', desc: (lv) => `開局多 ${lv} 個海藻藥膏、${lv * 20} 枚貝殼幣`, costs: [15, 35, 60] },
  bay: { name: '棲息灣擴建', desc: (lv) => `棲息灣可以住 ${2 + lv} 隻夥伴`, costs: [30, 65, 110] },
  star: { name: '星光祭壇', desc: () => '開局獲得 1 個星光餌', costs: [120] },
};

export const RECRUITS: { form: string; cost: number }[] = [
  { form: 'zaploach', cost: 30 },
  { form: 'starsand', cost: 30 },
  { form: 'bubcrab', cost: 40 },
  { form: 'gull1', cost: 60 },
];

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
}

const KEY = 'tidehunter.meta.v1';
export function loadMeta(): Meta {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (m && m.version === 1) return m;
  } catch { /* 略過 */ }
  return { version: 1, pearls: 0, totalPearls: 0, upgrades: {}, recruits: [], bay: [], runs: 0 };
}
export function saveMeta(m: Meta) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* 略過 */ } }
export const upLv = (m: Meta, id: UpgradeId) => m.upgrades[id] ?? 0;
export const bayCap = (m: Meta) => 2 + upLv(m, 'bay');

export function buyUpgrade(m: Meta, id: UpgradeId): boolean {
  const lv = upLv(m, id), cost = UPGRADES[id].costs[lv];
  if (cost === undefined || m.pearls < cost) return false;
  m.pearls -= cost; m.upgrades[id] = lv + 1; saveMeta(m); return true;
}
export function buyRecruit(m: Meta, form: string): boolean {
  const r = RECRUITS.find((x) => x.form === form);
  if (!r || m.recruits.includes(form) || m.pearls < r.cost) return false;
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
export function bayStartLevel(b: BayMon) { return Math.min(10, 5 + Math.floor(b.bond / 2)); }
export function monFromBay(b: BayMon): Mon {
  const mon = makeMon(b.root, bayStartLevel(b));
  mon.bayId = b.id;
  mon.bond = b.bond;
  mon.evoBonus = b.evoMemory.length ? 2 : 0;
  if (b.iv) { mon.iv = [...b.iv]; mon.hp = maxHp(mon); }
  if (b.mutant) mon.mutant = true;
  if (b.legacy && !mon.skills.includes(b.legacy)) {
    const slots = STAGE_SLOTS[FORMS[mon.form].stage];
    if (mon.skills.length < slots) mon.skills.push(b.legacy); else mon.skills[mon.skills.length - 1] = b.legacy;
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
