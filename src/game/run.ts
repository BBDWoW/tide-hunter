// 一局冒險的狀態：隊伍、道具、航程站點、存檔
import { FORMS, ZONE1_BOSS, ZONE1_POOL } from '../data/creatures';
import { effectiveness, RARITY_ORDER, type Rarity } from '../data/types';
import { makeMon, maxHp, type Mon } from './creature';
import { int, makeRng, newSeed, next, weighted, type Rng } from './rng';
import type { ItemId } from './battle';
import { BOON_LIST, BOON_TIER, BOONS, type LureId } from '../data/boons';
import { gainXp, xpToNext } from './creature';
import { upLv, type Meta, type UpgradeId } from './meta';

export type NodeKind = 'fish' | 'elite' | 'treasure' | 'camp' | 'shop' | 'boss';
export const NODE_INFO: Record<NodeKind, { name: string; desc: string }> = {
  fish: { name: '釣點', desc: '普通的釣點，水面下有東西在游動。' },
  elite: { name: '精英釣點', desc: '強大的潮靈盤據在這裡。更難打，但戰後的能力卡更好。' },
  treasure: { name: '寶藏點', desc: '海面閃閃發光，這裡只會釣到寶箱。' },
  camp: { name: '營地', desc: '可以紮營休息的小島。' },
  shop: { name: '漂流商店', desc: '一艘賣漁具的小船，可以用貝殼幣買東西。' },
  boss: { name: '霸主', desc: '淺灘的霸主就在前方。' },
};
export interface RouteNode { kind: NodeKind; spot: SpotKind }
export const ROUTE_LEN = 10;

export type SpotKind = 'shallow' | 'reef' | 'wreck' | 'deep';
export const SPOT_INFO: Record<SpotKind, { name: string; desc: string }> = {
  shallow: { name: '淺灘', desc: '陽光照得到底的淺水，常有海鷗和小蟹。' },
  reef: { name: '珊瑚礁', desc: '五顏六色的礁岩，礦物與珊瑚生物聚集。' },
  wreck: { name: '沉船', desc: '海底躺著一艘舊船，寶箱和骷髏魚出沒。' },
  deep: { name: '深水區', desc: '看不見底的深藍，有發光的生物在游動。' },
};
const SPOT_BIAS: Record<SpotKind, Record<string, number>> = {
  shallow: { gull1: 3, bubcrab: 2, starsand: 2 },
  reef: { coral: 3, starsand: 3, bubcrab: 2 },
  wreck: { bonebream: 4, jelly1: 2 },
  deep: { angler: 3, jelly1: 3, zaploach: 2 },
};

export interface RunState {
  version: 3;
  catchBait: number;
  lures: Record<'star' | 'legend', number>;
  boons: Record<string, number>;
  perks: { reel: number; discount: number }; // 港口設施帶來的永久加成
  route: RouteNode[][]; // 每一站有 1–3 個岔路可選
  picked: number | null; // 這一站選了哪一條
  path: number[]; // 走過的路線
  seed: number;
  rng: Rng;
  party: Mon[];
  items: Record<ItemId, number>;
  station: number;
  shells: number;
  caught: number;
  battlesWon: number;
}

export const PARTY_MAX = 6;

export function newRun(first: Mon, meta?: Meta): RunState {
  const seed = newSeed(), rng = makeRng(seed);
  const up = (id: UpgradeId) => (meta ? upLv(meta, id) : 0);
  return {
    version: 3, seed, rng,
    party: [first],
    items: { potion: 3 + up('supply'), superpotion: 0, revive: 1, ether: 1 },
    catchBait: 1 + up('bait'), lures: { star: up('star'), legend: 0 }, boons: {},
    perks: { reel: up('rod') * 0.08, discount: up('discount') * 0.1 },
    route: generateRoute(rng), picked: null, path: [],
    station: 0, shells: up('supply') * 20, caught: 0, battlesWon: 0,
  };
}

// 產生分岔航線：第一站固定釣點、最後一站是霸主，中間每站 2–3 個選項
function generateRoute(rng: Rng): RouteNode[][] {
  const spots: SpotKind[] = ['shallow', 'reef', 'wreck', 'deep'];
  const sp = () => spots[Math.floor(next(rng) * spots.length)];
  const route: RouteNode[][] = [[{ kind: 'fish', spot: 'shallow' }]];
  for (let i = 1; i < ROUTE_LEN - 1; i++) {
    const n = next(rng) < 0.45 ? 3 : 2, opts: RouteNode[] = [];
    const weights: [NodeKind, number][] = [['fish', 46], ['treasure', 12]];
    if (i >= 3) weights.push(['elite', 16], ['camp', 12]);
    if (i >= 2) weights.push(['shop', 12]);
    for (let k = 0; k < n; k++) {
      let kind = weighted(rng, weights);
      if (kind !== 'fish' && opts.some((o) => o.kind === kind)) kind = 'fish';
      opts.push({ kind, spot: sp() });
    }
    route.push(opts);
  }
  // 保證中段有商店、霸主前有營地可以選
  const ensure = (kind: NodeKind, from: number, to: number) => {
    for (let i = from; i <= to; i++) if (route[i].some((o) => o.kind === kind)) return;
    const i = from + Math.floor(next(rng) * (to - from + 1));
    route[i][route[i].length - 1] = { kind, spot: sp() };
  };
  ensure('shop', 3, 6);
  ensure('camp', 7, 8);
  ensure('fish', 1, 1);
  route.push([{ kind: 'boss', spot: 'deep' }]);
  return route;
}

export const nodeOf = (run: RunState): RouteNode => run.route[run.station][run.picked ?? 0];
export const isBoss = (run: RunState) => run.route[run.station]?.[0].kind === 'boss';

export interface Encounter { mon: Mon; rarity: Rarity }

// ── 魚影：拋竿前海面上的影子，大小暗示稀有度 ──
export type ShadowKind = 'fish' | 'treasure' | 'junk';
export interface Shadow { size: 1 | 2 | 3; kind: ShadowKind; rarity: Rarity; x: number }

export function rollShadows(run: RunState, lure: LureId): Shadow[] {
  const r = run.rng, luck = boon(run, 'lucky');
  const node = nodeOf(run);
  if (node.kind === 'boss') return [{ size: 3, kind: 'fish', rarity: FORMS[ZONE1_BOSS].rarity, x: 170 }];
  if (node.kind === 'treasure') return [118, 168, 218].map((x, i) => ({ size: (i === 1 ? 3 : 2) as 2 | 3, kind: 'treasure' as const, rarity: 'N' as Rarity, x }));
  const sizes: (1 | 2 | 3)[] = [];
  const n = 3;
  for (let i = 0; i < n; i++) sizes.push(weighted(r, [[1, 45 - luck * 8], [2, 40], [3, 15 + luck * 8]] as [1 | 2 | 3, number][]));
  if (lure !== 'normal' && !sizes.includes(3)) sizes[Math.floor(next(r) * n)] = 3;
  if (run.station === 0) sizes.fill(1).splice(0, 1, 2);
  const xs = [118, 168, 218].sort(() => next(r) - 0.5);
  return sizes.map((size, i) => {
    let kind: ShadowKind = 'fish', rarity: Rarity = 'N';
    if (size === 1) {
      if (chanceOf(r, 0.22)) kind = 'junk';
      rarity = weighted(r, [['N', 78], ['B', 22]] as [Rarity, number][]);
    } else if (size === 2) {
      if (chanceOf(r, 0.22 + luck * 0.06)) kind = 'treasure';
      rarity = weighted(r, [['N', 20], ['B', 45], ['A', 35]] as [Rarity, number][]);
    } else {
      rarity = lure === 'legend' ? weighted(r, [['SSR', 45], ['S', 35], ['A', 20]] as [Rarity, number][])
        : lure === 'star' ? weighted(r, [['S', 55], ['A', 45]] as [Rarity, number][])
          : weighted(r, [['A', 60], ['B', 40]] as [Rarity, number][]);
    }
    if (run.station === 0) { kind = 'fish'; rarity = 'N'; }
    if (node.kind === 'elite') { kind = 'fish'; if (rarity === 'N' || rarity === 'B') rarity = 'A'; }
    return { size, kind, rarity, x: xs[i] };
  });
}
const chanceOf = (r: Rng, p: number) => next(r) < p;

// 拋竿品質 q（0–1）：完美拋竿可以把稀有度往上推一級（但推不到 S／SSR）
export function rollEncounter(run: RunState, q: number, shadow: Shadow): Encounter {
  if (isBoss(run)) {
    const mon = makeMon(ZONE1_BOSS, 12, true, true);
    return { mon, rarity: FORMS[ZONE1_BOSS].rarity };
  }
  let rarity = shadow.rarity;
  if (q >= perfectAt(run) && (rarity === 'N' || rarity === 'B')) rarity = RARITY_ORDER[RARITY_ORDER.indexOf(rarity) + 1];
  let pool: string[] = [];
  for (let i = RARITY_ORDER.indexOf(rarity); i >= 0 && !pool.length; i--) {
    rarity = RARITY_ORDER[i];
    pool = ZONE1_POOL.filter((id) => FORMS[id].rarity === rarity);
  }
  if (run.station === 0) {
    // 第一站避開剋制初始夥伴的屬性
    const mine = FORMS[run.party[0].form].elems;
    const safe = pool.filter((id) => FORMS[id].elems.every((e) => effectiveness(e, mine) <= 1));
    if (safe.length) pool = safe;
  }
  const bias = SPOT_BIAS[nodeOf(run).spot];
  let formId = weighted(run.rng, pool.map((id) => [id, bias[id] ?? 1] as [string, number]));
  const elite = nodeOf(run).kind === 'elite' ? 2 : 0;
  const lv = run.station === 0 ? 3 : Math.max(2, Math.round(3 + run.station * 0.8 + int(run.rng, 0, 2)) - ({ N: 0, B: 0, A: 1, S: 2, SSR: 2 } as const)[rarity] + elite);
  const ev = FORMS[formId].evolve?.find((e) => lv >= e.level);
  if (ev) formId = ev.to;
  return { mon: makeMon(formId, lv, false, true), rarity };
}

export const perfectAt = (run: RunState) => 0.92 - boon(run, 'steady') * 0.05;

// ── 寶物與垃圾 ──
export interface Loot { title: string; text: string }
export function rollTreasure(run: RunState, kind: 'treasure' | 'junk'): Loot {
  const r = run.rng;
  if (kind === 'junk') {
    const j = ['一隻舊靴子', '破掉的漁網', '生鏽的空罐', '一團海帶'][Math.floor(next(r) * 4)];
    run.shells += 5;
    return { title: '釣到了垃圾……', text: `是${j}。賣給回收商換了 5 枚貝殼幣。` };
  }
  const pick = weighted(r, [['shells', 38], ['bait', 26], ['potion', 18], ['star', 10], ['revive', 8]] as [string, number][]);
  if (pick === 'shells') { const n = int(r, 25, 60); run.shells += n; return { title: '釣到寶箱！', text: `裡面有 ${n} 枚貝殼幣。` }; }
  if (pick === 'bait') { run.catchBait += 1; return { title: '釣到寶箱！', text: '裡面有一個捕捉餌！' }; }
  if (pick === 'potion') { run.items.potion += 2; return { title: '釣到寶箱！', text: '裡面有海藻藥膏 ×2。' }; }
  if (pick === 'star') { run.lures.star += 1; return { title: '釣到寶箱！', text: '裡面閃著光……是星光餌！' }; }
  run.items.revive += 1; return { title: '釣到寶箱！', text: '裡面有一個復甦貝。' };
}

// ── 能力卡 ──
export const boon = (run: RunState, id: string) => run.boons?.[id] ?? 0;
export function rollBoons(run: RunState, better = false): string[] {
  const out: string[] = [];
  for (let guard = 0; out.length < 3 && guard < 80; guard++) {
    const tier = weighted(run.rng, Object.entries(BOON_TIER).map(([k, v]) => [k, better && k === 'common' ? v.weight * 0.25 : better ? v.weight * 2 : v.weight] as [string, number]));
    const cands = BOON_LIST.filter((b) => b.tier === tier && !out.includes(b.id) && (b.instant || boon(run, b.id) < (b.max ?? 99)));
    if (cands.length) out.push(cands[Math.floor(next(run.rng) * cands.length)].id);
  }
  return out;
}
export function applyBoon(run: RunState, id: string): string {
  const b = BOONS[id];
  if (!b.instant) { run.boons[id] = boon(run, id) + 1; return `獲得能力「${b.name}」（第 ${run.boons[id]} 層）`; }
  switch (id) {
    case 'bait2': run.catchBait += 2; break;
    case 'starlure': run.lures.star += 1; break;
    case 'legendlure': run.lures.legend += 1; break;
    case 'supply': run.items.potion += 2; break;
    case 'revive': run.items.revive += 1; break;
    case 'spring': healParty(run, 1, true); break;
    case 'train': {
      const m = [...run.party].sort((a, b2) => a.lv - b2.lv)[0];
      for (let i = 0; i < 2; i++) gainXp(m, xpToNext(m.lv) - m.xp);
      return `${FORMS[m.form].name} 升到了 Lv${m.lv}！`;
    }
  }
  return `獲得「${b.name}」`;
}
export function battleMods(run: RunState) {
  return { atk: 1 + boon(run, 'atk') * 0.1, def: 1 + boon(run, 'def') * 0.1, energy: boon(run, 'energy'), crit: boon(run, 'crit') * 0.06 };
}

export function healParty(run: RunState, ratio: number, revive = false) {
  for (const m of run.party) {
    if (m.hp <= 0 && !revive) continue;
    const mx = maxHp(m);
    m.hp = Math.min(mx, Math.max(m.hp, 0) + Math.ceil(mx * ratio));
    m.status = null;
  }
}

// ── 存檔 ──
const SAVE_KEY = 'tidehunter.run.v3';
const DEX_KEY = 'tidehunter.dex.v1';

export function saveRun(run: RunState | null) {
  try { if (run) localStorage.setItem(SAVE_KEY, JSON.stringify(run)); else localStorage.removeItem(SAVE_KEY); } catch { /* 無法存檔時略過 */ }
}
export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as RunState;
    if (r.version !== 3 || !r.party?.every((m) => FORMS[m.form])) return null;
    return r;
  } catch { return null; }
}

export interface Dex { seen: string[]; caught: string[]; bestStation: number; clears: number }
export function loadDex(): Dex {
  try {
    const d = JSON.parse(localStorage.getItem(DEX_KEY) || 'null');
    if (d && Array.isArray(d.seen)) return d;
  } catch { /* 略過 */ }
  return { seen: [], caught: [], bestStation: 0, clears: 0 };
}
export function updateDex(fn: (d: Dex) => void) {
  const d = loadDex();
  fn(d);
  try { localStorage.setItem(DEX_KEY, JSON.stringify(d)); } catch { /* 略過 */ }
}
export const markSeen = (form: string) => updateDex((d) => { if (!d.seen.includes(form)) d.seen.push(form); });
export const markCaught = (form: string) => updateDex((d) => {
  if (!d.seen.includes(form)) d.seen.push(form);
  if (!d.caught.includes(form)) d.caught.push(form);
});

// ── 商店 ──
export interface ShopItem { id: string; name: string; desc: string; price: number; buy: (run: RunState) => void }
export const priceOf = (run: RunState, it: ShopItem) => Math.round(it.price * (1 - (run.perks?.discount ?? 0)));
export const SHOP: ShopItem[] = [
  { id: 'bait', name: '捕捉餌', desc: '收服夥伴時消耗 1 個。', price: 30, buy: (r) => { r.catchBait++; } },
  { id: 'star', name: '星光餌', desc: '大魚影有機會是 S 級。', price: 90, buy: (r) => { r.lures.star++; } },
  { id: 'legend', name: '傳說餌', desc: '大魚影有機會是 SSR 傳說級。', price: 220, buy: (r) => { r.lures.legend++; } },
  { id: 'potion', name: '海藻藥膏', desc: '回復 50% HP。', price: 18, buy: (r) => { r.items.potion++; } },
  { id: 'superpotion', name: '珍珠精華', desc: '回復全部 HP 並治癒異常。', price: 45, buy: (r) => { r.items.superpotion++; } },
  { id: 'revive', name: '復甦貝', desc: '使倒下的夥伴復活。', price: 40, buy: (r) => { r.items.revive++; } },
];
