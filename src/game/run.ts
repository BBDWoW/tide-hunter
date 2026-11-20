// 一局冒險的狀態：隊伍、道具、航程站點、存檔
import { CORE_POOL, FOREST_POOL, FORMS, ICE_POOL, LAVA_POOL, VOID_POOL, ZONE1_POOL } from '../data/creatures';
import { effectiveness, RARITY_ORDER, type Rarity } from '../data/types';
import { makeMon, maxHp, type Mon } from './creature';
import { int, makeRng, newSeed, next, weighted, type Rng } from './rng';
import type { ItemId } from './battle';
import { BOON_LIST, BOON_TIER, BOONS, type LureId } from '../data/boons';
import { gainXp, xpToNext } from './creature';
import { upLv, type Meta, type UpgradeId } from './meta';

export type NodeKind = 'fish' | 'elite' | 'treasure' | 'camp' | 'shop' | 'event' | 'portal' | 'boss';
export const NODE_INFO: Record<NodeKind, { name: string; desc: string }> = {
  fish: { name: '釣點', desc: '普通的釣點，水面下有東西在游動。' },
  elite: { name: '精英釣點', desc: '強大的潮靈盤據在這裡。更難打，但戰後的能力卡更好。' },
  treasure: { name: '寶藏點', desc: '海面閃閃發光，這裡只會釣到寶箱。' },
  camp: { name: '營地', desc: '可以紮營休息的小島。' },
  shop: { name: '漂流商店', desc: '一艘賣漁具的小船，可以用貝殼幣買東西。' },
  event: { name: '神秘事件', desc: '海面上好像發生了什麼事……' },
  portal: { name: '神秘入口', desc: '海面裂開了一道發光的縫隙，不知道通往哪裡……' },
  boss: { name: '霸主', desc: '這片海域的霸主就在前方。' },
};
export interface RouteNode { kind: NodeKind; spot: SpotKind; target?: ZoneId }
export const ROUTE_LEN = 10;

export type SpotKind = 'shallow' | 'reef' | 'wreck' | 'deep';
export const SPOT_INFO: Record<SpotKind, { name: string; desc: string }> = {
  shallow: { name: '淺灘', desc: '陽光照得到底的淺水，常有海鷗和小蟹。' },
  reef: { name: '珊瑚礁', desc: '五顏六色的礁岩，礦物與珊瑚生物聚集。' },
  wreck: { name: '沉船', desc: '海底躺著一艘舊船，寶箱和骷髏魚出沒。' },
  deep: { name: '深水區', desc: '看不見底的深藍，有發光的生物在游動。' },
};
// ── 海域 ──
export type ZoneId = 'shallows' | 'ice' | 'lava' | 'forest' | 'void' | 'core';
export type ThemeName = 'day' | 'ice' | 'lava' | 'forest' | 'void' | 'core';
export interface ZoneInfo {
  name: string; desc: string; theme: ThemeName; special?: boolean;
  pool: string[]; boss: string; bossLv: number; lvBase: number;
  spots: Record<SpotKind, { name: string; desc: string }>;
  bias: Record<SpotKind, Record<string, number>>;
}
export const ZONES: Record<ZoneId, ZoneInfo> = {
  shallows: {
    name: '碧藍淺灘', desc: '旅程的起點，溫暖明亮的淺海。', theme: 'day',
    pool: ZONE1_POOL, boss: 'whale', bossLv: 12, lvBase: 3, spots: SPOT_INFO,
    bias: { shallow: { gull1: 3, bubcrab: 2, starsand: 2 }, reef: { coral: 3, starsand: 3, bubcrab: 2 }, wreck: { bonebream: 4, jelly1: 2 }, deep: { angler: 3, jelly1: 3, zaploach: 2 } },
  },
  ice: {
    name: '冰封峽灣', desc: '冰與永恆的海。浮冰之間住著耐寒的潮靈，霸主是頭戴冰冠的巨型海豹。', theme: 'ice',
    pool: ICE_POOL, boss: 'frostking', bossLv: 21, lvBase: 13,
    spots: {
      shallow: { name: '浮冰區', desc: '大大小小的浮冰漂在海面上。' },
      reef: { name: '冰洞', desc: '海浪鑿出的冰洞，裡面閃著藍光。' },
      wreck: { name: '冰封沉船', desc: '被冰凍住的舊船，船艙裡好像有東西。' },
      deep: { name: '冰淵', desc: '冰層下的深淵，冷得連光都會結冰。' },
    },
    bias: { shallow: { snowgull: 3, iceshrimp: 3 }, reef: { icegolem: 3, iceshrimp: 2, starsand: 2 }, wreck: { jelly1: 3, iceshrimp: 2 }, deep: { walrus: 3, zaploach: 2 } },
  },
  lava: {
    name: '熔岩裂谷', desc: '火與海交匯的灼熱之境。海底裂縫湧出岩漿，霸主是在交界處沉睡的海龍。', theme: 'lava',
    pool: LAVA_POOL, boss: 'lavadragon', bossLv: 21, lvBase: 13,
    spots: {
      shallow: { name: '黑沙灘', desc: '火山灰堆成的黑色沙灘，沙子是溫的。' },
      reef: { name: '熔岩礁', desc: '冷卻的熔岩形成礁岩，縫隙還在發紅。' },
      wreck: { name: '焦黑沉船', desc: '被火山燒過的沉船，鬼火在船骨間飄蕩。' },
      deep: { name: '熔岩深淵', desc: '海底裂縫湧出岩漿，海水在沸騰。' },
    },
    bias: { shallow: { lavasnail: 3, bubcrab: 2 }, reef: { obsidiancrab: 3, lavasnail: 2, starsand: 2 }, wreck: { cinderbone: 3, bonebream: 3 }, deep: { magmaeel: 3, magmacore: 1 } },
  },
  // ── 特殊區域：航行途中有機率出現入口 ──
  forest: {
    name: '聖林域', desc: '海中央長出一整片古老的森林，草木的潮靈在這裡生活。守護者是藤角鹿。', theme: 'forest', special: true,
    pool: FOREST_POOL, boss: 'vine_antler_deer', bossLv: 0, lvBase: 0,
    spots: {
      shallow: { name: '林間淺溪', desc: '清澈的溪水流過樹根。' },
      reef: { name: '苔石灘', desc: '長滿青苔的石頭，踩上去軟軟的。' },
      wreck: { name: '古木殘骸', desc: '倒下的巨木泡在水裡，裡面住著小生物。' },
      deep: { name: '聖泉', desc: '森林中央的泉水，深不見底。' },
    },
    bias: { shallow: { sprout_orb: 3 }, reef: { mushroom_sprite: 3 }, wreck: { mushroom_sprite: 2, coral: 2 }, deep: { vine_antler_deer: 2, frost_crystal_fawn: 1 } },
  },
  void: {
    name: '無稽區', desc: '一切都說不通的地方。影子會自己走動，符文浮在半空中。守護者是虛無星龍。', theme: 'void', special: true,
    pool: VOID_POOL, boss: 'void_star_dragon', bossLv: 0, lvBase: 0,
    spots: {
      shallow: { name: '倒影水面', desc: '水面映出的不是天空，而是另一片海。' },
      reef: { name: '浮空碎石', desc: '石頭飄在半空中，下面是看不見底的黑。' },
      wreck: { name: '幽靈船', desc: '一艘半透明的船，時隱時現。' },
      deep: { name: '虛無之淵', desc: '什麼都沒有的深淵，只有一雙雙眼睛。' },
    },
    bias: { shallow: { shadow_soul_flame: 3 }, reef: { rune_wraith: 3 }, wreck: { bonebream: 3, vine_trace_spirit: 2 }, deep: { phantom_cub: 2, cinderbone: 2 } },
  },
  core: {
    name: '域核區域', desc: '由光與資料構成的奇異海域，方塊和圓環在空中運轉。守護者是域界核心。', theme: 'core', special: true,
    pool: CORE_POOL, boss: 'domain_realm_core', bossLv: 0, lvBase: 0,
    spots: {
      shallow: { name: '資料淺層', desc: '海水裡流動著發光的數字。' },
      reef: { name: '方塊礁', desc: '由立方體堆成的礁石。' },
      wreck: { name: '廢棄節點', desc: '停止運轉的舊核心，偶爾還會閃一下。' },
      deep: { name: '核心深層', desc: '越往下越亮，所有資料都流向這裡。' },
    },
    bias: { shallow: { cubelet: 3, zaploach: 2 }, reef: { polyhedral_sentinel: 3, cube_coreling: 2 }, wreck: { orbit_construct: 3 }, deep: { domain_coreling: 2, chaos_zygote: 1 } },
  },
};
export const zoneOf = (run: RunState) => ZONES[run.zone ?? 'shallows'];
export const spotName = (run: RunState, spot: SpotKind) => zoneOf(run).spots[spot];
const firstStop = (run: RunState) => run.zoneNo === 0 && run.station === 0;

export interface RunState {
  version: 4;
  zone: ZoneId;
  zoneNo: number; // 第幾片海域（0 起算）
  pendingZone?: boolean; // 已打倒霸主、還沒選下一片海域
  returnTo?: { zone: ZoneId; route: RouteNode[][]; station: number; path: number[] }; // 在特殊區域時，原本的航線
  specialLv?: number; // 特殊區域的基準等級（依進入時的位置決定）
  notice?: string; // 回到海圖時要顯示的訊息
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
    version: 4, seed, rng, zone: 'shallows', zoneNo: 0,
    party: [first],
    items: { potion: 3 + up('supply'), superpotion: 0, revive: 1, ether: 1 },
    catchBait: 1 + up('bait'), lures: { star: up('star'), legend: 0 }, boons: {},
    perks: { reel: up('rod') * 0.08, discount: up('discount') * 0.1 },
    route: generateRoute(rng), picked: null, path: [],
    station: 0, shells: up('supply') * 20, caught: 0, battlesWon: 0,
  };
}

// 產生分岔航線：第一站固定釣點、最後一站是霸主，中間每站 2–3 個選項
// 主海域有機率在中段出現通往特殊區域的「神秘入口」
const SPECIALS: ZoneId[] = ['forest', 'void', 'core'];
function generateRoute(rng: Rng, len = ROUTE_LEN, special = false): RouteNode[][] {
  const spots: SpotKind[] = ['shallow', 'reef', 'wreck', 'deep'];
  const sp = () => spots[Math.floor(next(rng) * spots.length)];
  const route: RouteNode[][] = [[{ kind: 'fish', spot: special ? sp() : 'shallow' }]];
  for (let i = 1; i < len - 1; i++) {
    const n = next(rng) < 0.45 ? 3 : 2, opts: RouteNode[] = [];
    const weights: [NodeKind, number][] = special
      ? [['fish', 40], ['elite', 20], ['treasure', 18], ['event', 16]]
      : [['fish', 42], ['treasure', 10], ['event', 16]];
    if (!special && i >= 3) weights.push(['elite', 16], ['camp', 12]);
    if (!special && i >= 2) weights.push(['shop', 12]);
    for (let k = 0; k < n; k++) {
      let kind = weighted(rng, weights);
      if (kind !== 'fish' && opts.some((o) => o.kind === kind)) kind = 'fish';
      opts.push({ kind, spot: sp() });
    }
    route.push(opts);
  }
  if (!special) {
    // 保證中段有商店、霸主前有營地可以選
    const ensure = (kind: NodeKind, from: number, to: number) => {
      for (let i = from; i <= to; i++) if (route[i].some((o) => o.kind === kind)) return;
      const i = from + Math.floor(next(rng) * (to - from + 1));
      route[i][route[i].length - 1] = { kind, spot: sp() };
    };
    ensure('shop', 3, 6);
    ensure('camp', 7, 8);
    ensure('fish', 1, 1);
    // 40% 機率在第 3–7 站出現神秘入口
    if (next(rng) < 0.4) {
      const i = 3 + Math.floor(next(rng) * 5);
      const target = SPECIALS[Math.floor(next(rng) * SPECIALS.length)];
      const node: RouteNode = { kind: 'portal', spot: sp(), target };
      if (route[i].length < 3) route[i].push(node); else route[i][0] = node;
    }
  }
  route.push([{ kind: 'boss', spot: 'deep' }]);
  return route;
}

// 進入特殊區域：記住原本的航線，換成一段 5 站的短航線（最後是守護者）
export function enterSpecial(run: RunState, target: ZoneId) {
  run.returnTo = { zone: run.zone, route: run.route, station: run.station, path: [...run.path, run.picked ?? 0] };
  run.specialLv = Math.round(ZONES[run.zone].lvBase + run.station * 0.8 + 2);
  run.zone = target;
  run.route = generateRoute(run.rng, 5, true); run.station = 0; run.picked = null; run.path = [];
}
// 打倒守護者後回到原本的航線（入口那一站算走過），並拿到獎勵
export function leaveSpecial(run: RunState) {
  const back = run.returnTo; if (!back) return;
  const name = ZONES[run.zone].name;
  run.zone = back.zone; run.route = back.route; run.path = back.path; run.station = back.station + 1; run.picked = null;
  run.returnTo = undefined; run.specialLv = undefined;
  run.lures.legend += 1; run.shells += 60; run.catchBait += 1;
  run.notice = `你從${name}回來了！守護者留下了謝禮：傳說餌 ×1、捕捉餌 ×1、60 枚貝殼幣。`;
}

// 打倒霸主後前往下一片海域：重新產生航線，全隊回復一半（倒下的也會醒來）
export function enterZone(run: RunState, zone: ZoneId) {
  run.zone = zone; run.zoneNo++; run.pendingZone = false;
  run.route = generateRoute(run.rng); run.station = 0; run.picked = null; run.path = [];
  healParty(run, 0.5, true);
}
export const totalStation = (run: RunState) => run.zoneNo * ROUTE_LEN + run.station + 1;

export const nodeOf = (run: RunState): RouteNode => run.route[run.station][run.picked ?? 0];
export const isBoss = (run: RunState) => run.route[run.station]?.[0].kind === 'boss';

export interface Encounter { mon: Mon; rarity: Rarity }

// ── 魚影：拋竿前海面上的影子，大小暗示稀有度 ──
export type ShadowKind = 'fish' | 'treasure' | 'junk';
export interface Shadow { size: 1 | 2 | 3; kind: ShadowKind; rarity: Rarity; x: number }

export function rollShadows(run: RunState, lure: LureId): Shadow[] {
  const r = run.rng, luck = boon(run, 'lucky');
  const node = nodeOf(run);
  if (node.kind === 'boss') return [{ size: 3, kind: 'fish', rarity: FORMS[zoneOf(run).boss].rarity, x: 170 }];
  if (node.kind === 'treasure') return [118, 168, 218].map((x, i) => ({ size: (i === 1 ? 3 : 2) as 2 | 3, kind: 'treasure' as const, rarity: 'N' as Rarity, x }));
  const sizes: (1 | 2 | 3)[] = [];
  const n = 3;
  for (let i = 0; i < n; i++) sizes.push(weighted(r, [[1, 45 - luck * 8], [2, 40], [3, 15 + luck * 8]] as [1 | 2 | 3, number][]));
  if (lure !== 'normal' && !sizes.includes(3)) sizes[Math.floor(next(r) * n)] = 3;
  if (firstStop(run)) sizes.fill(1).splice(0, 1, 2);
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
    if (firstStop(run)) { kind = 'fish'; rarity = 'N'; }
    if (node.kind === 'elite') { kind = 'fish'; if (rarity === 'N' || rarity === 'B') rarity = 'A'; }
    return { size, kind, rarity, x: xs[i] };
  });
}
const chanceOf = (r: Rng, p: number) => next(r) < p;

// 拋竿品質 q（0–1）：完美拋竿可以把稀有度往上推一級（但推不到 S／SSR）
export function rollEncounter(run: RunState, q: number, shadow: Shadow): Encounter {
  if (isBoss(run)) {
    const z = zoneOf(run), mon = makeMon(z.boss, z.special ? (run.specialLv ?? 10) + 3 : z.bossLv, true, true);
    return { mon, rarity: FORMS[z.boss].rarity };
  }
  let rarity = shadow.rarity;
  if (q >= perfectAt(run) && (rarity === 'N' || rarity === 'B')) rarity = RARITY_ORDER[RARITY_ORDER.indexOf(rarity) + 1];
  let pool: string[] = [];
  for (let i = RARITY_ORDER.indexOf(rarity); i >= 0 && !pool.length; i--) {
    rarity = RARITY_ORDER[i];
    pool = zoneOf(run).pool.filter((id) => FORMS[id].rarity === rarity);
  }
  if (firstStop(run)) {
    // 第一站避開剋制初始夥伴的屬性
    const mine = FORMS[run.party[0].form].elems;
    const safe = pool.filter((id) => FORMS[id].elems.every((e) => effectiveness(e, mine) <= 1));
    if (safe.length) pool = safe;
  }
  const bias = zoneOf(run).bias[nodeOf(run).spot];
  let formId = weighted(run.rng, pool.map((id) => [id, bias[id] ?? 1] as [string, number]));
  const elite = nodeOf(run).kind === 'elite' ? 2 : 0;
  const lv = firstStop(run) ? 3 : Math.max(2, Math.round((zoneOf(run).special ? (run.specialLv ?? 10) : zoneOf(run).lvBase) + run.station * 0.8 + int(run.rng, 0, 2)) - ({ N: 0, B: 0, A: 1, S: 2, SSR: 2 } as const)[rarity] + elite);
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
const SAVE_KEY = 'tidehunter.run.v4';
const DEX_KEY = 'tidehunter.dex.v1';

export function saveRun(run: RunState | null) {
  try { if (run) localStorage.setItem(SAVE_KEY, JSON.stringify(run)); else localStorage.removeItem(SAVE_KEY); } catch { /* 無法存檔時略過 */ }
}
export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as RunState;
    if (r.version !== 4 || !r.party?.every((m) => FORMS[m.form])) return null;
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
