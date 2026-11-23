import { HELD, HELD_IDS, resonance, type HeldId } from '../data/held';
// 一局冒險的狀態：隊伍、道具、航程站點、存檔
import { ABYSS_POOL, CORE_POOL, CYBER_POOL, FOREST_POOL, FORMS, ICE_POOL, LAVA_POOL, VOID_POOL, ZONE1_POOL } from '../data/creatures';
import { effectiveness, RARITY_ORDER, type Rarity } from '../data/types';
import { formOf, makeMon, makeMutant, maxHp, MUTANT_CHANCE, type Mon } from './creature';
import { int, makeRng, newSeed, next, weighted, type Rng } from './rng';
import type { ItemId } from './battle';
import { BOON_LIST, BOON_TIER, BOONS, type LureId } from '../data/boons';
import { ensureBasic, gainXp, xpToNext } from './creature';
import { upLv, type Meta, type UpgradeId } from './meta';

export type NodeKind = 'fish' | 'elite' | 'treasure' | 'camp' | 'shop' | 'event' | 'portal' | 'boss' | 'crew';
export const NODE_INFO: Record<NodeKind, { name: string; desc: string }> = {
  fish: { name: '釣點', desc: '普通的釣點，水面下有東西在游動。' },
  elite: { name: '精英釣點', desc: '強大的潮靈盤據在這裡。更難打，但戰後的能力卡更好。' },
  treasure: { name: '寶藏點', desc: '海面閃閃發光，這裡只會釣到寶箱。' },
  camp: { name: '營地', desc: '可以紮營休息的小島。' },
  shop: { name: '漂流商店', desc: '一艘賣漁具的小船，可以用貝殼幣買東西。' },
  event: { name: '神秘事件', desc: '海面上好像發生了什麼事……' },
  portal: { name: '神秘入口', desc: '海面裂開了一道發光的縫隙，不知道通往哪裡……' },
  boss: { name: '霸主', desc: '這片海域的霸主就在前方。' },
  crew: { name: '馴潮船隊', desc: '一支馴潮師船隊攔住了去路。2–3 隻夥伴輪番上陣，不能收服，但獎勵很豐厚。' },
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
export type ZoneId = 'shallows' | 'ice' | 'lava' | 'cyber' | 'abyss' | 'forest' | 'void' | 'core';
export type ThemeName = 'day' | 'ice' | 'lava' | 'cyber' | 'abyss' | 'forest' | 'void' | 'core';
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
    pool: ICE_POOL, boss: 'frostking', bossLv: 18, lvBase: 11,
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
    pool: LAVA_POOL, boss: 'lavadragon', bossLv: 18, lvBase: 11,
    spots: {
      shallow: { name: '黑沙灘', desc: '火山灰堆成的黑色沙灘，沙子是溫的。' },
      reef: { name: '熔岩礁', desc: '冷卻的熔岩形成礁岩，縫隙還在發紅。' },
      wreck: { name: '焦黑沉船', desc: '被火山燒過的沉船，鬼火在船骨間飄蕩。' },
      deep: { name: '熔岩深淵', desc: '海底裂縫湧出岩漿，海水在沸騰。' },
    },
    bias: { shallow: { lavasnail: 3, bubcrab: 2 }, reef: { obsidiancrab: 3, lavasnail: 2, starsand: 2 }, wreck: { cinderbone: 3, bonebream: 3 }, deep: { magmaeel: 3, magmacore: 1 } },
  },
  // ── 第三片海域 ──
  cyber: {
    name: '電子海域', desc: '海面是發光的網格，水裡流動著資料。霸主是由主機構成的機械海龍。', theme: 'cyber',
    pool: CYBER_POOL, boss: 'mainframe_leviathan', bossLv: 25, lvBase: 17,
    spots: {
      shallow: { name: '訊號淺灘', desc: '網格海面上跳動著一格格光點。' },
      reef: { name: '電路礁', desc: '由電路板堆成的礁石，指示燈閃個不停。' },
      wreck: { name: '廢棄機房', desc: '沉在海裡的機房，伺服器還在運轉。' },
      deep: { name: '資料深流', desc: '所有資料都往這裡流，越深越亮。' },
    },
    bias: { shallow: { pixfish: 3, dronegull: 2 }, reef: { routercrab: 3, polyhedral_sentinel: 2 }, wreck: { virus_jelly: 3, cablesnake: 2 }, deep: { neonray: 3, cipher_whale: 1 } },
  },
  abyss: {
    name: '深淵', desc: '照不到光的海底，只有生物自己發出的光。霸主是全身佈滿傷痕的遠古巨鯨。', theme: 'abyss',
    pool: ABYSS_POOL, boss: 'nether_whale', bossLv: 25, lvBase: 17,
    spots: {
      shallow: { name: '海雪坡', desc: '細細的海雪不停落下，堆成白色的斜坡。' },
      reef: { name: '岩柱林', desc: '一根根黑色岩柱，縫隙裡有東西在發光。' },
      wreck: { name: '骸骨海床', desc: '巨大生物的骨頭散落一地。' },
      deep: { name: '無光海溝', desc: '連生物光都吞沒的海溝。' },
    },
    bias: { shallow: { lanternlarva: 3, abyss_wisp: 2 }, reef: { pressure_shell: 3, bonecrab: 2 }, wreck: { bonecrab: 3, bonebream: 2 }, deep: { gulper: 3, ghost_squid: 2, drowned_bell: 1 } },
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
  lifeStones?: number; // 生命石：全滅時可以讓全隊復活
  seenEvents?: string[]; // 這一局已經遇過的事件（不重複）
  eventFight?: { form: string; lv: number }; // 事件引發的戰鬥
  catchBait: number;
  lures: Record<'star' | 'legend', number>;
  boons: Record<string, number>;
  perks: { reel: number; discount: number; camp?: number }; // 港口設施帶來的永久加成
  route: RouteNode[][]; // 每一站有 1–3 個岔路可選
  picked: number | null; // 這一站選了哪一條
  path: number[]; // 走過的路線
  seed: number;
  rng: Rng;
  party: Mon[];
  items: Record<ItemId, number>;
  heldBag?: HeldId[]; // 還沒裝上的攜帶道具
  star?: number; // 潮位（難度）
  daily?: string; // 每日挑戰的日期
  after?: { boons?: string[]; bossWin?: string }; // 戰鬥已結算、還沒離開這一站（中途關掉 App 也能接著繼續）
  camp?: { key: string; text: string }; // 這個營地已經做過的事
  shopStock?: { key: string; held: HeldId[]; refreshes: number }; // 這間商店的攜帶道具貨架
  station: number;
  shells: number;
  caught: number;
  battlesWon: number;
}

export const PARTY_MAX = 6;

// ── 潮位（難度）：通關後解鎖下一級，效果會累加 ──
export const MAX_STAR = 5;
export const STAR_RULES = [
  '野生潮靈與對手的能力 +10%',
  '商店價格 +25%',
  '開局少 1 個捕捉餌和 1 個海藻藥膏',
  '霸主等級 +2',
  '營地休息的回復量減半，對手能力再 +10%',
];
export const starOf = (run: RunState) => run.star ?? 0;
/** 對手的能力加成（潮位 1、5） */
export function foeMods(run: RunState) {
  const k = 1 + (starOf(run) >= 1 ? 0.1 : 0) + (starOf(run) >= 5 ? 0.1 : 0);
  return { atk: k, def: k, energy: 0, crit: 0 };
}
export const priceMul = (run: RunState) => (1 - (run.perks?.discount ?? 0)) * (starOf(run) >= 2 ? 1.25 : 1);
export const campHealMul = (run: RunState) => (starOf(run) >= 5 ? 0.5 : 1);
export const pearlMul = (star: number) => 1 + star * 0.2;

// ── 每日挑戰：同一天所有人拿到同一個種子、同一隻夥伴 ──
export const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function dailySeed(day: string): number {
  let h = 2166136261;
  for (const c of day) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const DAILY_STAR = 1;
/** 今天的每日挑戰夥伴（從第一片海域的 N／B 幼體和御三家裡挑） */
export function dailyPartner(day: string): Mon {
  const rng = makeRng(dailySeed(day) ^ 0x5bd1e995);
  const roots = [...new Set(['water1', 'fire1', 'grass1', ...ZONES.shallows.pool.filter((id) => ['N', 'B'].includes(FORMS[id].rarity) && FORMS[id].stage === 1)])];
  const id = roots[Math.floor(next(rng) * roots.length)];
  return makeMon(id, 5, false, false, () => next(rng));
}

export function newRun(first: Mon, meta?: Meta, opt: { star?: number; daily?: string } = {}): RunState {
  const seed = opt.daily ? dailySeed(opt.daily) : newSeed(), rng = makeRng(seed);
  const up = (id: UpgradeId) => (meta && !opt.daily ? upLv(meta, id) : 0);
  const star = opt.daily ? DAILY_STAR : opt.star ?? 0, lean = star >= 3 ? 1 : 0;
  return {
    star, daily: opt.daily,
    version: 4, seed, rng, zone: 'shallows', zoneNo: 0,
    party: [first],
    items: { potion: 3 + up('supply') - lean, superpotion: 0, revive: 1, ether: 1 },
    catchBait: Math.max(0, 1 + up('bait') - lean), lures: { star: up('star'), legend: up('legend') }, boons: {},
    perks: { reel: up('rod') * 0.08, discount: up('discount') * 0.1, camp: up('herbal') * 0.15 },
    lifeStones: up('kiln'),
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
    if (!special && i >= 2) weights.push(['shop', 12], ['crew', 11]);
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
/** 第幾片海域（0 起算）打完霸主就通關 */
export const FINAL_ZONE = 2;
/** 每一階段可以選的海域 */
export const ZONE_CHOICES: ZoneId[][] = [['shallows'], ['ice', 'lava'], ['cyber', 'abyss']];
export const totalStation = (run: RunState) => run.zoneNo * ROUTE_LEN + run.station + 1;

export const nodeOf = (run: RunState): RouteNode => run.route[run.station][run.picked ?? 0];
export const isBoss = (run: RunState) => run.route[run.station]?.[0].kind === 'boss';

export interface Encounter { mon: Mon; rarity: Rarity; landing?: Landing; team?: Mon[]; crew?: string } // team／crew：對手船隊（多隻、不能收服）

// ── 水面下的魚：大小決定稀有度（玩家拋竿前看不到，上鉤才知道） ──
export type ShadowKind = 'fish' | 'treasure' | 'junk';
export interface Shadow { size: 1 | 2 | 3; kind: ShadowKind; rarity: Rarity; x: number }

export function rollShadows(run: RunState, lure: LureId, fishOnly = false): Shadow[] {
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
    if (fishOnly) kind = 'fish';
    if (node.kind === 'elite') { kind = 'fish'; if (rarity === 'N' || rarity === 'B') rarity = 'A'; }
    return { size, kind, rarity, x: xs[i] };
  });
}
const chanceOf = (r: Rng, p: number) => next(r) < p;

// ── 馴潮船隊：2–3 隻不能收服的對手 ──
const CAPTAINS = ['浪花姊妹', '老船長海鷗', '珊瑚幫', '霧笛團', '鹹魚兄弟', '燈塔守衛', '漂流詩人', '潮聲樂團'];
export function rollCrew(run: RunState): Encounter {
  const z = zoneOf(run), r = run.rng;
  const n = run.station >= 5 ? 3 : 2;
  const pool = z.pool.filter((id) => ['N', 'B', 'A'].includes(FORMS[id].rarity));
  const base = (z.special ? (run.specialLv ?? 10) : z.lvBase) + run.station * 0.8;
  const team: Mon[] = [];
  for (let i = 0; i < n; i++) {
    let id = pool[Math.floor(next(r) * pool.length)];
    const lv = Math.max(3, Math.round(base - 1 + int(r, 0, 2) + (i === n - 1 ? 1 : 0)));
    const ev = FORMS[id].evolve?.find((e) => lv >= e.level);
    if (ev) id = ev.to;
    const m = makeMon(id, lv, false, true, () => next(r));
    team.push(m);
  }
  // 壓軸的那隻帶著攜帶道具
  if (run.station >= 4) team[n - 1].held = HELD_IDS[Math.floor(next(r) * HELD_IDS.length)];
  return { mon: team[0], rarity: FORMS[team[0].form].rarity, team, crew: CAPTAINS[Math.floor(next(r) * CAPTAINS.length)] };
}

// 拋竿品質 q（0–1）：完美拋竿可以把稀有度往上推一級（但推不到 S／SSR）
export function rollEncounter(run: RunState, q: number, shadow: Shadow): Encounter {
  if (isBoss(run)) {
    const z = zoneOf(run), mon = makeMon(z.boss, (z.special ? (run.specialLv ?? 10) + 3 : z.bossLv) + (starOf(run) >= 4 ? 2 : 0), true, true);
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
  const mon = makeMon(formId, lv, false, true, () => next(run.rng));
  if (next(run.rng) < MUTANT_CHANCE * (1 + boon(run, 'lucky') * 0.5)) makeMutant(mon);
  return { mon, rarity };
}

export const perfectAt = (run: RunState) => 0.92 - boon(run, 'steady') * 0.05;

// ── 甩竿落點：力量條要停在漣漪的目標區 ──
export type Landing = 'perfect' | 'good' | 'miss' | 'far';
/** 漣漪越遠，需要的力量越大 */
export const castTarget = (x: number) => 0.22 + ((x - 118) / 100) * 0.56;
/** 目標區的寬度（穩定手腕能力卡會變寬） */
export const landingZones = (run: RunState) => ({ perfect: 0.045 + boon(run, 'steady') * 0.015, good: 0.11 + boon(run, 'steady') * 0.02 });
export function judgeLanding(run: RunState, power: number, x: number): Landing {
  const d = Math.abs(power - castTarget(x)), z = landingZones(run);
  return d <= z.perfect ? 'perfect' : d <= z.good ? 'good' : d <= 0.25 ? 'miss' : 'far';
}
/** 落點帶來的好處：對手開場 HP 減少、比較好捕捉（霸主減半） */
export const LANDING_BONUS: Record<Landing, { hpCut: number; catch: number; label: string }> = {
  perfect: { hpCut: 0.25, catch: 0.15, label: '完美落點' },
  good: { hpCut: 0.1, catch: 0.06, label: '不錯的落點' },
  miss: { hpCut: 0, catch: 0, label: '' },
  far: { hpCut: 0, catch: 0, label: '' },
};

// ── 寶物與垃圾 ──
export interface Loot { title: string; text: string }
export function rollTreasure(run: RunState, kind: 'treasure' | 'junk'): Loot {
  const r = run.rng;
  if (kind === 'junk') {
    const j = ['一隻舊靴子', '破掉的漁網', '生鏽的空罐', '一團海帶'][Math.floor(next(r) * 4)];
    run.shells += 5;
    return { title: '釣到了垃圾……', text: `是${j}。賣給回收商換了 5 枚貝殼幣。` };
  }
  const pick = weighted(r, [['shells', 34], ['bait', 22], ['potion', 16], ['held', 14], ['star', 8], ['revive', 6]] as [string, number][]);
  if (pick === 'held') { const h = giveHeld(run); return { title: '釣到寶箱！', text: `裡面有攜帶道具「${HELD[h].name}」！到隊伍裡讓夥伴裝上吧。` }; }
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
  return { atk: 1 + boon(run, 'atk') * 0.1, def: 1 + boon(run, 'def') * 0.1, energy: boon(run, 'energy'), crit: boon(run, 'crit') * 0.06, reso: resonance(run.party.map((m) => FORMS[m.form].elems)) };
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
    r.party.forEach(ensureBasic);
    return r;
  } catch { return null; }
}

export interface Dex { seen: string[]; caught: string[]; bestStation: number; clears: number; bosses?: string[]; evolved?: string[]; mutants?: number }
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
// ── 攜帶道具 ──
/** 隨機一個攜帶道具（盡量不跟身上已有的重複） */
export function randomHeld(run: RunState, exclude: HeldId[] = []): HeldId {
  const have = new Set<HeldId>([...(run.heldBag ?? []), ...run.party.map((m) => m.held).filter((x): x is HeldId => !!x), ...exclude]);
  const pool = HELD_IDS.filter((h) => !have.has(h));
  const from = pool.length ? pool : HELD_IDS;
  return from[Math.floor(next(run.rng) * from.length)];
}
export function giveHeld(run: RunState, id: HeldId = randomHeld(run)): HeldId {
  (run.heldBag ??= []).push(id);
  return id;
}
/** 裝上（或換下）攜帶道具；id = null 代表卸下 */
export function equipHeld(run: RunState, m: Mon, id: HeldId | null) {
  const bag = (run.heldBag ??= []);
  if (id) { const i = bag.indexOf(id); if (i < 0) return; bag.splice(i, 1); }
  if (m.held) bag.push(m.held);
  m.held = id ?? undefined;
}
/** 營地特訓：活著的夥伴各獲得大約 0.8 級的經驗 */
export function campTrain(run: RunState): string {
  const ups: string[] = [];
  for (const m of run.party) {
    if (m.hp <= 0) continue;
    const before = m.lv;
    gainXp(m, Math.floor(xpToNext(m.lv) * 0.8), run.zone);
    if (m.lv > before) ups.push(`${FORMS[m.form].name} Lv${m.lv}`);
  }
  return `夥伴們在沙灘上練習到天黑。${ups.length ? `升級了：${ups.join('、')}！` : '大家都進步了一些。'}`;
}
/** 營地探索：找到攜帶道具或寶箱 */
export function campSearch(run: RunState): string {
  if (next(run.rng) < 0.55) { const h = giveHeld(run); return `在小島的岩縫裡找到了「${HELD[h].name}」！${HELD[h].desc}`; }
  const l = rollTreasure(run, 'treasure');
  return `在沙灘上挖到一個小箱子……${l.text}`;
}
export const SHOP_REFRESH = 20;
const shopKey = (run: RunState) => `${run.zone}-${run.zoneNo}-${run.station}`;
/** 這間商店今天賣的攜帶道具（每間店 2 樣，可以花貝殼幣換一批） */
export function shopHeld(run: RunState): HeldId[] {
  if (run.shopStock?.key !== shopKey(run)) {
    const a = randomHeld(run), b = randomHeld(run, [a]);
    run.shopStock = { key: shopKey(run), held: [a, b], refreshes: 0 };
  }
  return run.shopStock.held;
}
export const refreshCost = (run: RunState) => SHOP_REFRESH * (1 + (run.shopStock?.refreshes ?? 0));
export function refreshShop(run: RunState): boolean {
  shopHeld(run);
  const cost = refreshCost(run);
  if (run.shells < cost) return false;
  run.shells -= cost;
  const st = run.shopStock!;
  const a = randomHeld(run, st.held), b = randomHeld(run, [...st.held, a]);
  st.held = [a, b]; st.refreshes++;
  return true;
}
export function buyHeld(run: RunState, id: HeldId): boolean {
  const st = run.shopStock, price = heldPrice(run, id);
  if (!st || run.shells < price) return false;
  const i = st.held.indexOf(id); if (i < 0) return false;
  run.shells -= price; st.held.splice(i, 1); giveHeld(run, id);
  return true;
}

export interface ShopItem { id: string; name: string; desc: string; price: number; buy: (run: RunState) => void }
export const priceOf = (run: RunState, it: ShopItem) => Math.round(it.price * priceMul(run));
export const heldPrice = (run: RunState, id: HeldId) => Math.round(HELD[id].price * priceMul(run));
export const SHOP: ShopItem[] = [
  { id: 'bait', name: '捕捉餌', desc: '收服夥伴時消耗 1 個。', price: 30, buy: (r) => { r.catchBait++; } },
  { id: 'star', name: '星光餌', desc: '會引來大魚，有機會是 S 級。', price: 90, buy: (r) => { r.lures.star++; } },
  { id: 'legend', name: '傳說餌', desc: '會引來大魚，有機會是 SSR 傳說級。', price: 220, buy: (r) => { r.lures.legend++; } },
  { id: 'potion', name: '海藻藥膏', desc: '回復 50% HP。', price: 18, buy: (r) => { r.items.potion++; } },
  { id: 'superpotion', name: '珍珠精華', desc: '回復全部 HP 並治癒異常。', price: 45, buy: (r) => { r.items.superpotion++; } },
  { id: 'revive', name: '復甦貝', desc: '使倒下的夥伴復活。', price: 40, buy: (r) => { r.items.revive++; } },
  { id: 'lifestone', name: '生命石', desc: '戰鬥中全隊倒下時，讓全隊以 50% HP 復活，可以繼續戰鬥或逃跑。', price: 120, buy: (r) => { r.lifeStones = (r.lifeStones ?? 0) + 1; } },
];

// ── 背包：戰鬥外使用道具 ──
/** 這個道具能不能對這隻夥伴使用（戰鬥外） */
export function canUseOutside(m: Mon, item: ItemId): boolean {
  const mx = maxHp(m);
  if (item === 'revive') return m.hp <= 0;
  if (item === 'potion') return m.hp > 0 && m.hp < mx;
  if (item === 'superpotion') return m.hp > 0 && (m.hp < mx || !!m.status);
  return false; // 能量海膽只能在戰鬥中用
}
export function applyItemOutside(run: RunState, item: ItemId, idx: number): string {
  const m = run.party[idx], mx = maxHp(m), name = formOf(m).name;
  if (!run.items[item] || !canUseOutside(m, item)) return '';
  run.items[item]--;
  if (item === 'revive') { m.hp = Math.floor(mx / 2); m.status = null; return `${name} 復活了！`; }
  const amt = item === 'potion' ? Math.min(mx - m.hp, Math.floor(mx / 2)) : mx - m.hp;
  m.hp += amt;
  if (item === 'superpotion') m.status = null;
  return `${name} 回復了 ${amt} HP${item === 'superpotion' ? '，異常狀態也治好了' : ''}。`;
}
