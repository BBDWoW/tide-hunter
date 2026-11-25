// 生物資料：一個「形態」就是圖鑑中的一筆。進化關係寫在 evolve。
import type { Elem, Rarity, Stage } from './types';
import type { PalName } from '../render/pixel';
import { EVO2 } from './evolutions2';

export interface Stats { hp: number; atk: number; def: number; spd: number }

export type AbilityId =
  | 'moist' | 'blazing' | 'photosyn' | 'hardshell' | 'firststrike' | 'undying'
  | 'lure' | 'regen' | 'sturdy' | 'static' | 'stinger' | 'tidegod' | 'colossal' | 'stormking'
  | 'oceanpower' | 'dragonpresence' | 'waterbarrier' | 'swiftswim' | 'waterabsorb' | 'thickfat' | 'waterveil' | 'poisonbody' | 'none';

export const ABILITIES: Record<AbilityId, { name: string; desc: string }> = {
  moist: { name: '潤澤', desc: '每回合結束回復最大 HP 的 1/16。' },
  blazing: { name: '火爆', desc: 'HP 低於 1/3 時，火屬性技能威力 ×1.5。' },
  photosyn: { name: '光合', desc: '每回合結束回復最大 HP 的 1/16。' },
  hardshell: { name: '硬殼', desc: '受到的傷害減少 15%。' },
  firststrike: { name: '先發制人', desc: '出場第一回合速度加倍。' },
  undying: { name: '不死骨', desc: '第一次受到致命傷時保留 1 HP。' },
  lure: { name: '誘光', desc: '攻擊時有 20% 機率使對手麻痺。' },
  regen: { name: '再生', desc: '換下場時回復最大 HP 的 1/4。' },
  sturdy: { name: '堅硬', desc: '防禦提高 20%。' },
  static: { name: '帶電', desc: '受到攻擊時，30% 機率使攻擊者麻痺。' },
  stinger: { name: '毒刺', desc: '受到攻擊時，30% 機率使攻擊者中毒。' },
  tidegod: { name: '潮神', desc: '水屬性技能威力 ×1.3，每回合多回復 1 點能量。' },
  colossal: { name: '巨軀', desc: 'HP 大幅提高，不會被冰凍。' },
  thickfat: { name: '厚脂', desc: '受到火屬性和冰屬性的傷害減半。' },
  waterveil: { name: '水之護體', desc: '不會被灼傷，每回合回復最大 HP 的 1/16。' },
  poisonbody: { name: '毒之體質', desc: '受到攻擊時，30% 機率使攻擊者中毒。' },
  swiftswim: { name: '悠游自如', desc: '速度提高 15%。' },
  waterabsorb: { name: '蓄水', desc: '受到水屬性攻擊時不會受傷，改為回復最大 HP 的 25%。' },
  oceanpower: { name: '海洋之力', desc: '水屬性技能威力 ×1.3。' },
  dragonpresence: { name: '龍之氣勢', desc: '每回合多回復 1 點能量。' },
  waterbarrier: { name: '水之結界', desc: '不會陷入任何異常狀態。' },
  stormking: { name: '雷霆之王', desc: '速度提高 20%，攻擊時 30% 使對手麻痺。' },
  none: { name: '—', desc: '' },
};

export type Category = '魚類' | '甲殼' | '水鳥' | '海怪' | '礦物' | '水母' | '抽象' | '骷髏' | '龍' | '巨獸' | '神獸' | '機械';

export interface Form {
  id: string;
  name: string;
  family: string;
  stage: Stage;
  rarity: Rarity;
  category: Category;
  elems: Elem[];
  sprite: string;
  pal: PalName;
  base: Stats;
  ability: AbilityId;
  extra?: AbilityId[]; // 傳說級可以有多個特性
  learn: [number, string][]; // [等級, 技能]
  evolve?: { to: string; level: number; style?: 'atk' | 'guard'; zone?: string }[]; // style：分支進化；zone：在這個區域進化才會變成這個形態
  recolor?: Recolor; // 環境形態：沿用別的圖再換色
  desc: string;
  scale?: number; // 戰鬥畫面中的放大倍率
  placeholder?: boolean; // 還在用前一階的圖暫代，等新美術
  regional?: boolean; // 地區形態（在特定海域進化才會變成）
  secret?: boolean; // 不能收集、不會出現在圖鑑和招募（例如神之手）
  no?: number; // 圖鑑編號
  height?: number; // 公尺
  weight?: number; // 公斤
}

import type { Recolor } from '../render/pixel';
/** 這隻生物的換色：環境形態本身的換色，加上異變的色相偏移（同一族固定） */
export function recolorOf(formId: string, mutant?: boolean): Recolor | undefined {
  const f = FORMS[formId];
  const base = f?.recolor;
  if (!mutant) return base;
  let h = 0; for (const c of f.family) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const shift = 100 + (h % 160); // 100～260 度
  return { h: (base?.h ?? 0) + shift, s: (base?.s ?? 1) * 1.15, l: base?.l ?? 0, mutant: true };
}

export const abilitiesOf = (f: Form): AbilityId[] => [f.ability, ...(f.extra ?? [])];
export const hasAb = (f: Form, id: AbilityId) => f.ability === id || !!f.extra?.includes(id);

const F: Form[] = [
  // ── 初始夥伴：水 ──
  { id: 'water1', name: '潮仔', family: 'water', stage: 1, rarity: 'N', category: '魚類', elems: ['water'], sprite: 'water1', pal: 'tide',
    base: { hp: 48, atk: 46, def: 48, spd: 50 }, ability: 'swiftswim', extra: ['waterabsorb'], no: 2, height: 0.3, weight: 0.5,
    learn: [[1, 'watergun'], [1, 'bubble'], [6, 'waterpulse'], [9, 'tidewave']], evolve: [{ to: 'water2', level: 9 }],
    desc: '在淺灘出生的小魚，喜歡跟在船邊游泳。' },
  { id: 'water2', name: '浪鰭', family: 'water', stage: 2, rarity: 'N', category: '魚類', elems: ['water'], sprite: 'water2', pal: 'tide',
    base: { hp: 62, atk: 60, def: 60, spd: 64 }, ability: 'moist',
    learn: [[9, 'tidewave'], [11, 'aquajet'], [12, 'surge'], [13, 'counterflow']], evolve: [{ to: 'water3a', level: 15, style: 'atk' }, { to: 'water3b', level: 15, style: 'guard' }],
    desc: '背鰭能感應浪潮的方向，游得又快又穩。' },
  { id: 'water3a', name: '怒濤鯊', family: 'water', stage: 3, rarity: 'N', category: '魚類', elems: ['water'], sprite: 'water3a', pal: 'tide',
    base: { hp: 78, atk: 96, def: 70, spd: 90 }, ability: 'moist', learn: [[15, 'sharkrend'], [16, 'tidecharge'], [17, 'roar'], [18, 'whalecry']], desc: '攻擊型完全體。追著浪頭獵食的猛鯊。' },
  { id: 'water3b', name: '盾殼鯨', family: 'water', stage: 3, rarity: 'N', category: '魚類', elems: ['water'], sprite: 'water3b', pal: 'tide',
    base: { hp: 105, atk: 70, def: 100, spd: 55 }, ability: 'hardshell', learn: [[15, 'counterscale'], [16, 'harden'], [17, 'whalecry'], [18, 'bubbleguard']], desc: '守護型完全體。背殼能擋下暴風浪。' },
  // ── 初始夥伴：火 ──
  { id: 'fire1', name: '火鬚', family: 'fire', stage: 1, rarity: 'N', category: '魚類', elems: ['fire'], sprite: 'fire1', pal: 'ember',
    base: { hp: 44, atk: 54, def: 42, spd: 52 }, ability: 'blazing',
    learn: [[1, 'ember'], [1, 'tackle'], [6, 'heatup'], [9, 'flamebite']], evolve: [{ to: 'fire2', level: 9 }],
    desc: '鬍鬚末端燃著小火苗，在水裡也不會熄滅。' },
  { id: 'fire2', name: '焰鯰', family: 'fire', stage: 2, rarity: 'N', category: '魚類', elems: ['fire'], sprite: 'fire2', pal: 'ember',
    base: { hp: 58, atk: 72, def: 54, spd: 62 }, ability: 'blazing',
    learn: [[9, 'flamebite'], [11, 'scorch'], [12, 'roar'], [14, 'blaze']], evolve: [{ to: 'fire3a', level: 15, style: 'atk' }, { to: 'fire3b', level: 15, style: 'guard' }],
    desc: '背上的火焰越旺，代表心情越好。' },
  { id: 'fire3a', name: '爆炎龍鯰', family: 'fire', stage: 3, rarity: 'N', category: '魚類', elems: ['fire'], sprite: 'fire3a', pal: 'magma',
    base: { hp: 74, atk: 105, def: 66, spd: 85 }, ability: 'blazing', learn: [[15, 'flareblitz'], [17, 'lavafloor']], desc: '攻擊型完全體。頭上的角能噴出爆炎。' },
  { id: 'fire3b', name: '熔甲鯰', family: 'fire', stage: 3, rarity: 'N', category: '魚類', elems: ['fire', 'rock'], sprite: 'fire3b', pal: 'magma',
    base: { hp: 95, atk: 80, def: 100, spd: 50 }, ability: 'sturdy', learn: [[15, 'rockslide'], [16, 'reefspikes'], [17, 'harden']], desc: '守護型完全體。身披冷卻的熔岩鎧甲。' },
  // ── 初始夥伴：草 ──
  { id: 'grass1', name: '芽鰭', family: 'grass', stage: 1, rarity: 'N', category: '魚類', elems: ['grass'], sprite: 'grass1', pal: 'grass',
    base: { hp: 52, atk: 44, def: 52, spd: 46 }, ability: 'photosyn',
    learn: [[1, 'leafblade'], [1, 'tackle'], [6, 'vinebind'], [9, 'photosynth']], evolve: [{ to: 'grass2', level: 9 }],
    desc: '頭上的嫩芽會朝著陽光的方向轉動。' },
  { id: 'grass2', name: '藻鬣魚', family: 'grass', stage: 2, rarity: 'N', category: '魚類', elems: ['grass'], sprite: 'grass2', pal: 'kelp',
    base: { hp: 68, atk: 58, def: 66, spd: 56 }, ability: 'photosyn',
    learn: [[9, 'photosynth'], [11, 'sporecloud'], [12, 'seedleech'], [14, 'venomstrike']], evolve: [{ to: 'grass3a', level: 15, style: 'atk' }, { to: 'grass3b', level: 15, style: 'guard' }],
    desc: '海藻般的鬃毛能躲藏小魚。' },
  { id: 'grass3a', name: '棘藤魚龍', family: 'grass', stage: 3, rarity: 'N', category: '龍', elems: ['grass'], sprite: 'grass3a', pal: 'thornvine',
    base: { hp: 80, atk: 95, def: 75, spd: 80 }, ability: 'photosyn', learn: [[15, 'thornburst'], [17, 'sacredgrove']], desc: '攻擊型完全體。全身長滿荊棘。' },
  { id: 'grass3b', name: '森苔龜魚', family: 'grass', stage: 3, rarity: 'N', category: '魚類', elems: ['grass'], sprite: 'grass3b', pal: 'grass',
    base: { hp: 110, atk: 65, def: 105, spd: 45 }, ability: 'regen', learn: [[15, 'harden'], [16, 'sacredgrove'], [17, 'purify']], desc: '守護型完全體。背上長著一棵小樹。' },

  // ── 淺灘野生 ──
  { id: 'bubcrab', name: '泡泡蟹', family: 'bubcrab', stage: 1, rarity: 'N', category: '甲殼', elems: ['water'], sprite: 'bubcrab', pal: 'crab',
    base: { hp: 46, atk: 50, def: 62, spd: 34 }, ability: 'hardshell',
    learn: [[1, 'bubblebarrage'], [4, 'harden'], [7, 'bubbleguard']], evolve: [{ to: 'moss_crab', level: 11, zone: 'forest' }, { to: 'cannoncrab', level: 11 }],
    desc: '會吐泡泡的小螃蟹。牠沒有成長體，某天會突然變成巨鉗砲台。' },
  { id: 'cannoncrab', name: '鉗砲蟹', family: 'bubcrab', stage: 3, rarity: 'N', category: '甲殼', elems: ['water', 'rock'], sprite: 'cannoncrab', pal: 'crab',
    base: { hp: 72, atk: 92, def: 96, spd: 40 }, ability: 'hardshell', learn: [[11, 'crabcannon'], [12, 'tidecharge'], [12, 'rockslide'], [14, 'counterscale']],
    desc: '跳階進化的完全體。右鉗是一座高壓水砲。' },
  { id: 'starsand', name: '星砂仔', family: 'starsand', stage: 1, rarity: 'N', category: '礦物', elems: ['rock'], sprite: 'starsand', pal: 'star',
    base: { hp: 44, atk: 42, def: 60, spd: 40 }, ability: 'sturdy',
    learn: [[1, 'pebble'], [3, 'starshard'], [7, 'sandtoss']], evolve: [{ to: 'crystal_starrock', level: 10, zone: 'core' }, { to: 'starrock', level: 10 }],
    desc: '星砂聚集而成的礦物生命，晚上會微微發光。' },
  { id: 'starrock', name: '星岩獸', family: 'starsand', stage: 2, rarity: 'N', category: '礦物', elems: ['rock'], sprite: 'starrock', pal: 'crystal',
    base: { hp: 62, atk: 70, def: 85, spd: 42 }, ability: 'sturdy', learn: [[10, 'rockslide'], [12, 'reefspikes'], [14, 'harden'], [15, 'recklessram']], desc: '核心的晶石越亮，力量越強。' },
  { id: 'zaploach', name: '微電鰍', family: 'zaploach', stage: 1, rarity: 'N', category: '魚類', elems: ['elec'], sprite: 'zaploach', pal: 'volteel',
    base: { hp: 40, atk: 48, def: 38, spd: 66 }, ability: 'static',
    learn: [[1, 'zap'], [4, 'paralywave']], evolve: [{ to: 'zapeel', level: 9 }], desc: '摸起來會刺刺麻麻的小泥鰍。' },
  { id: 'zapeel', name: '雷紋鰻', family: 'zaploach', stage: 2, rarity: 'N', category: '魚類', elems: ['elec'], sprite: 'zapeel', pal: 'volteel',
    base: { hp: 56, atk: 68, def: 50, spd: 82 }, ability: 'static', learn: [[9, 'conduct'], [11, 'thunder'], [13, 'energydrain']], desc: '身上的閃電紋路會隨情緒閃爍。' },
  { id: 'jelly1', name: '漂流水母', family: 'jelly', stage: 1, rarity: 'N', category: '水母', elems: ['water'], sprite: 'jelly1', pal: 'jellyblue',
    base: { hp: 50, atk: 38, def: 46, spd: 44 }, ability: 'stinger',
    learn: [[1, 'watergun'], [3, 'sporecloud']], evolve: [{ to: 'ghost_jelly', level: 10, zone: 'void' }, { to: 'jelly2', level: 10 }], desc: '隨著洋流漂浮，觸手帶有微毒。' },
  { id: 'jelly2', name: '霓光水母', family: 'jelly', stage: 2, rarity: 'N', category: '水母', elems: ['water', 'elec'], sprite: 'jelly2', pal: 'jelly',
    base: { hp: 70, atk: 58, def: 62, spd: 56 }, ability: 'stinger', learn: [[10, 'paralywave'], [11, 'energydrain'], [12, 'waterpulse'], [14, 'bubbleguard']], desc: '夜裡會發出霓虹色的光。' },
  { id: 'gull1', name: '鷗哨兵', family: 'gull', stage: 1, rarity: 'B', category: '水鳥', elems: ['fly'], sprite: 'gull1', pal: 'gull',
    base: { hp: 46, atk: 54, def: 40, spd: 70 }, ability: 'firststrike',
    learn: [[1, 'peck'], [3, 'gust'], [8, 'divebomb']], evolve: [{ to: 'gull2', level: 11 }], desc: '戴著小帽巡邏海岸的海鷗。' },
  { id: 'gull2', name: '鷗隊長', family: 'gull', stage: 2, rarity: 'B', category: '水鳥', elems: ['fly', 'water'], sprite: 'gull2', pal: 'gull',
    base: { hp: 62, atk: 74, def: 54, spd: 88 }, ability: 'firststrike', learn: [[11, 'tailwind'], [12, 'featherblade'], [13, 'waterpulse'], [15, 'hurricane']], desc: '率領整片海岸的鷗群。' },
  { id: 'coral', name: '珊瑚精', family: 'coral', stage: 2, rarity: 'B', category: '抽象', elems: ['grass', 'water'], sprite: 'coral', pal: 'coral',
    base: { hp: 66, atk: 50, def: 64, spd: 40 }, ability: 'regen',
    learn: [[1, 'leafblade'], [5, 'seedleech'], [8, 'purify'], [10, 'sporecloud'], [11, 'photosynth']], desc: '珊瑚礁的意識凝聚成形。沒有人見過它的幼體。' },
  { id: 'bonebream', name: '白骨鯛', family: 'bonebream', stage: 2, rarity: 'A', category: '骷髏', elems: ['dark', 'water'], sprite: 'bonebream', pal: 'bone',
    base: { hp: 58, atk: 72, def: 58, spd: 64 }, ability: 'undying',
    learn: [[1, 'darkbite'], [1, 'bonecurse'], [6, 'soulsip'], [10, 'bonerend'], [12, 'opportunist']], evolve: [{ to: 'bonereaper', level: 17 }], desc: '沉船旁游蕩的骨頭魚。據說是被遺忘的漁獲。' },
  { id: 'bonereaper', name: '冥火骨鯛', family: 'bonebream', stage: 3, rarity: 'A', category: '骷髏', elems: ['dark', 'water'], sprite: 'bonereaper', pal: 'bone',
    base: { hp: 74, atk: 98, def: 72, spd: 84 }, ability: 'undying',
    learn: [[17, 'bloodtide'], [18, 'shadowsneak'], [20, 'abyssmaw'], [23, 'engulf']], desc: '白骨鯛吸收了沉船裡的亡魂，頭上燃起青色的冥火。紅色的眼睛盯上的獵物，從來沒有逃掉過。' },
  { id: 'angler', name: '觸鬚燈怪', family: 'angler', stage: 3, rarity: 'S', category: '海怪', elems: ['elec', 'dark'], sprite: 'angler', pal: 'abyss',
    base: { hp: 82, atk: 88, def: 70, spd: 58 }, ability: 'lure',
    learn: [[1, 'darkbite'], [1, 'luresnap'], [1, 'paralywave'], [8, 'abyssmaw'], [11, 'energydrain'], [14, 'conduct'], [16, 'flash']], desc: '從深海浮上來的海怪，頭上的燈會引誘獵物。' },
  { id: 'dragon', name: '蒼鱗龍', family: 'dragon', stage: 3, rarity: 'SSR', category: '龍', elems: ['water'], sprite: 'dragon', pal: 'dragon',
    base: { hp: 92, atk: 100, def: 82, spd: 95 }, ability: 'oceanpower', extra: ['dragonpresence', 'waterbarrier'], no: 1001, height: 12.5, weight: 860,
    learn: [[1, 'seagodbreath'], [1, 'waterspout'], [1, 'dragonpulse'], [1, 'aurorawing'], [17, 'hightide'], [20, 'azuretide']], desc: '傳說中守護淺灘的龍。一生只會現身一次。' },
  { id: 'thunderfang', name: '霆牙', family: 'thunderfang', stage: 3, rarity: 'SSR', category: '巨獸', elems: ['elec', 'water'], sprite: 'thunderfang', pal: 'thunder',
    base: { hp: 90, atk: 108, def: 78, spd: 104 }, ability: 'stormking',
    learn: [[1, 'zap'], [1, 'tidewave'], [1, 'stormfang'], [1, 'roar'], [17, 'thunderstorm'], [19, 'conduct']], desc: '雷雨夜踏浪而來的獸王。閃電角每閃一次，海面就會落下一道雷。' },
  { id: 'chubby1', name: '小肥源', family: 'chubby', stage: 1, rarity: 'SSR', category: '巨獸', elems: ['water', 'rock'], sprite: 'chubby1', pal: 'capy',
    base: { hp: 95, atk: 80, def: 90, spd: 30 }, ability: 'thickfat', extra: ['waterveil'], no: 301, height: 0.4, weight: 6.5,
    learn: [[1, 'microquake'], [1, 'wobble'], [1, 'rollout'], [1, 'tackle'], [4, 'microtoxin']], evolve: [{ to: 'chubby2', level: 11 }],
    desc: '雖然體型很小，卻擁有驚人的破壞力。一個抖動就能讓地面顫動。' },
  { id: 'chubby2', name: '巨肥源', family: 'chubby', stage: 3, rarity: 'SSR', category: '巨獸', elems: ['water', 'rock'], sprite: 'chubby2', pal: 'capy',
    base: { hp: 140, atk: 115, def: 120, spd: 35 }, ability: 'thickfat', extra: ['poisonbody'], no: 302,
    learn: [[11, 'bodyslam'], [11, 'deepsleep'], [12, 'bigquake'], [14, 'stunslam'], [15, 'megatoxin'], [16, 'reefspikes']],
    desc: '體型變得異常巨大，只要一跺腳就能引發地震，是整片海灘的霸主。' },
  // ── 冰封峽灣 ──
  { id: 'iceshrimp', name: '冰晶蝦', family: 'iceshrimp', stage: 1, rarity: 'N', category: '甲殼', elems: ['ice'], sprite: 'iceshrimp', pal: 'ice',
    base: { hp: 46, atk: 52, def: 56, spd: 50 }, ability: 'hardshell',
    learn: [[1, 'icepebble'], [1, 'hail'], [10, 'iceshard'], [12, 'frostfang']], evolve: [{ to: 'iceshrimp2', level: 15 }], desc: '殼像冰晶一樣透明，在冰縫裡成群生活。' },
  { id: 'iceshrimp2', name: '冰甲蝦', family: 'iceshrimp', stage: 2, rarity: 'N', category: '甲殼', elems: ['ice', 'rock'], sprite: 'iceshrimp2', pal: 'ice',
    base: { hp: 64, atk: 74, def: 82, spd: 56 }, ability: 'hardshell', learn: [[15, 'rockslide'], [16, 'icebeam'], [17, 'frostcrack']], desc: '冰晶殼長成了厚重的鎧甲，雙鉗能夾碎冰山。' },
  { id: 'snowgull', name: '雪羽鷗', family: 'snowgull', stage: 2, rarity: 'B', category: '水鳥', elems: ['ice', 'fly'], sprite: 'snowgull', pal: 'snow',
    base: { hp: 60, atk: 70, def: 54, spd: 86 }, ability: 'firststrike',
    learn: [[1, 'peck'], [1, 'icepebble'], [11, 'gust'], [12, 'tailwind'], [14, 'featherblade'], [16, 'frostfang']], desc: '羽毛像新雪一樣白，暴風雪中也能精準捕魚。' },
  { id: 'icegolem', name: '冰核石偶', family: 'icegolem', stage: 2, rarity: 'A', category: '礦物', elems: ['ice', 'rock'], sprite: 'icegolem', pal: 'glacier',
    base: { hp: 72, atk: 78, def: 96, spd: 30 }, ability: 'sturdy',
    learn: [[1, 'pebble'], [1, 'icepebble'], [11, 'harden'], [12, 'reefspikes'], [14, 'rockslide'], [16, 'icebeam']], desc: '萬年冰核外包著岩石的生命。不會進化，但聽說會在某天「覺醒」。' },
  { id: 'walrus', name: '霜牙海象', family: 'walrus', stage: 3, rarity: 'S', category: '巨獸', elems: ['ice', 'water'], sprite: 'walrus', pal: 'walrus',
    base: { hp: 96, atk: 98, def: 84, spd: 48 }, ability: 'thickfat',
    learn: [[1, 'frostfang'], [1, 'tidewave'], [1, 'roar'], [14, 'icebeam'], [15, 'frostcrack'], [17, 'recklessram']], desc: '冰海的戰士，一對冰牙能鑿穿冰層。' },
  { id: 'aurorawhale', name: '極光鯨', family: 'aurorawhale', stage: 3, rarity: 'SSR', category: '神獸', elems: ['ice', 'fly'], sprite: 'aurorawhale', pal: 'aurora',
    base: { hp: 110, atk: 92, def: 88, spd: 82 }, ability: 'waterbarrier', extra: ['dragonpresence'],
    learn: [[1, 'aurorabeam'], [1, 'icebeam'], [1, 'gust'], [1, 'surge'], [17, 'auroraveil']], desc: '只在極光之夜浮出海面的神鯨，身上流動著七彩的光。' },
  { id: 'frostking', name: '冰冠海豹王', family: 'frostking', stage: 3, rarity: 'A', category: '巨獸', elems: ['ice', 'water'], sprite: 'frostking', pal: 'seal',
    base: { hp: 112, atk: 90, def: 86, spd: 58 }, ability: 'colossal',
    learn: [[1, 'frostfang'], [1, 'frostcrack'], [1, 'hail'], [1, 'tidewave'], [1, 'icebeam'], [1, 'auroraveil']], desc: '冰封峽灣的霸主，頭戴萬年不化的冰冠的巨型海豹。' },
  // ── 熔岩裂谷 ──
  { id: 'lavasnail', name: '火山蝸', family: 'lavasnail', stage: 1, rarity: 'N', category: '礦物', elems: ['fire', 'rock'], sprite: 'lavasnail', pal: 'magma',
    base: { hp: 52, atk: 46, def: 66, spd: 30 }, ability: 'sturdy',
    learn: [[1, 'ember'], [1, 'pebble'], [12, 'lavaflow']], evolve: [{ to: 'frost_snail', level: 15, zone: 'ice' }, { to: 'lavasnail2', level: 15 }], desc: '背著一座小火山慢慢爬，殼裡的岩漿永遠不會冷卻。' },
  { id: 'lavasnail2', name: '熔岩蝸', family: 'lavasnail', stage: 2, rarity: 'N', category: '礦物', elems: ['fire', 'rock'], sprite: 'lavasnail2', pal: 'magma',
    base: { hp: 72, atk: 70, def: 92, spd: 34 }, ability: 'sturdy', learn: [[15, 'rockslide'], [16, 'reefspikes'], [17, 'eruption']], desc: '殼上的火山會定時噴發，附近的海水都在沸騰。' },
  { id: 'magmaeel', name: '熔岩鰻', family: 'magmaeel', stage: 2, rarity: 'B', category: '魚類', elems: ['fire'], sprite: 'magmaeel', pal: 'lavaeel',
    base: { hp: 60, atk: 80, def: 54, spd: 82 }, ability: 'blazing',
    learn: [[1, 'ember'], [1, 'flamebite'], [12, 'lavaflow'], [14, 'scorch'], [15, 'heatup']], desc: '在岩漿縫隙間穿梭的鰻魚，身上的紋路像流動的熔岩。' },
  { id: 'obsidiancrab', name: '黑曜石蟹', family: 'obsidiancrab', stage: 2, rarity: 'A', category: '甲殼', elems: ['rock', 'fire'], sprite: 'obsidiancrab', pal: 'obsidian',
    base: { hp: 66, atk: 92, def: 98, spd: 44 }, ability: 'hardshell',
    learn: [[1, 'pebble'], [1, 'ember'], [11, 'obsidianedge'], [12, 'counterscale'], [14, 'harden'], [16, 'lavaflow']], desc: '冷卻的岩漿凝成了黑曜石外殼，鉗子鋒利得像玻璃刀。' },
  { id: 'cinderbone', name: '焦骨鰻', family: 'cinderbone', stage: 3, rarity: 'S', category: '骷髏', elems: ['fire', 'dark'], sprite: 'cinderbone', pal: 'cinder',
    base: { hp: 80, atk: 102, def: 70, spd: 76 }, ability: 'undying',
    learn: [[1, 'flamebite'], [1, 'soulsip'], [1, 'bonecurse'], [12, 'bonerend'], [14, 'eruption'], [15, 'bloodtide']], desc: '被熔岩燒成骨頭也不肯死去的鰻魚，眼窩裡燃著鬼火。' },
  { id: 'magmacore', name: '熔核巨獸', family: 'magmacore', stage: 3, rarity: 'SSR', category: '巨獸', elems: ['fire', 'rock'], sprite: 'magmacore', pal: 'magma',
    base: { hp: 112, atk: 112, def: 104, spd: 50 }, ability: 'colossal', extra: ['blazing'],
    learn: [[1, 'roar'], [1, 'lavaflow'], [1, 'obsidianedge'], [1, 'eruption'], [16, 'lavafloor'], [20, 'coreburst']], desc: '心臟是一顆熔岩核心的巨獸，傳說裂谷就是牠翻身時撕開的。' },
  { id: 'lavadragon', name: '熔岩海龍王', family: 'lavadragon', stage: 3, rarity: 'A', category: '龍', elems: ['fire', 'water'], sprite: 'lavadragon', pal: 'lavaeel',
    base: { hp: 100, atk: 78, def: 76, spd: 58 }, ability: 'colossal',
    learn: [[1, 'heatup'], [1, 'tidewave'], [1, 'lavaflow'], [1, 'eruption'], [1, 'lavafloor']], desc: '熔岩裂谷的霸主，在岩漿與海水的交界處沉睡。' },
  // ── 美術包新增角色（31 隻） ──
  { id: 'thunder_wyrmling', name: '雷靈幼龍', family: 'thunderline', stage: 1, rarity: 'S', category: '龍', elems: ['elec', 'fly'], sprite: 'thunder_wyrmling', pal: 'water',
    base: { hp: 62, atk: 70, def: 56, spd: 76 }, ability: 'static',
    learn: [[1, 'zap'], [1, 'gust'], [11, 'thunder']], evolve: [{ to: 'sky_thunder_dragon', level: 14 }], desc: '在雷雨中誕生的小龍，打噴嚏的時候會冒出電火花。' },
  { id: 'sky_thunder_dragon', name: '天雷蒼龍', family: 'thunderline', stage: 3, rarity: 'S', category: '龍', elems: ['elec', 'fly'], sprite: 'sky_thunder_dragon', pal: 'water',
    base: { hp: 88, atk: 108, def: 78, spd: 100 }, ability: 'stormking',
    learn: [[14, 'divebomb'], [14, 'roar'], [15, 'stormfang'], [16, 'thunderstorm'], [18, 'conduct'], [19, 'hurricane']], desc: '駕著雷雲巡視海面的蒼龍，翅膀一拍就是一道落雷。' },
  { id: 'tide_cell', name: '潮汐胞體', family: 'tideline', stage: 1, rarity: 'A', category: '抽象', elems: ['water', 'dark'], sprite: 'tide_cell', pal: 'water',
    base: { hp: 56, atk: 52, def: 58, spd: 54 }, ability: 'moist',
    learn: [[1, 'watergun'], [1, 'darkbite'], [10, 'surge'], [12, 'inkshot']], evolve: [{ to: 'frost_vortex', level: 14, zone: 'ice' }, { to: 'magma_vortex', level: 14, zone: 'lava' }, { to: 'deepsea_star_vortex', level: 14 }], desc: '隨著潮汐脈動的神秘胞體，裡面好像藏著一小片星空。' },
  { id: 'deepsea_star_vortex', name: '深海星渦', family: 'tideline', stage: 3, rarity: 'A', category: '抽象', elems: ['water', 'dark'], sprite: 'deepsea_star_vortex', pal: 'water',
    base: { hp: 90, atk: 92, def: 84, spd: 80 }, ability: 'oceanpower',
    learn: [[14, 'counterflow'], [14, 'soulsip'], [15, 'hightide'], [16, 'abyssmaw'], [17, 'whalecry']], desc: '在深海捲起星光漩渦的存在，據說漩渦的盡頭連著夜空。' },
  { id: 'snow_crystal_spirit', name: '雪晶靈', family: 'snowspirit', stage: 1, rarity: 'N', category: '抽象', elems: ['ice'], sprite: 'snow_crystal_spirit', pal: 'water',
    base: { hp: 48, atk: 44, def: 52, spd: 52 }, ability: 'regen',
    learn: [[1, 'icepebble'], [1, 'hail'], [11, 'iceshard'], [13, 'frostfang']], desc: '雪花聚在一起變成的小精靈，摸起來涼涼軟軟的。' },
  { id: 'frost_wing_core', name: '霜翼核', family: 'frostwing', stage: 2, rarity: 'B', category: '抽象', elems: ['ice', 'fly'], sprite: 'frost_wing_core', pal: 'water',
    base: { hp: 58, atk: 70, def: 56, spd: 84 }, ability: 'firststrike',
    learn: [[1, 'icepebble'], [1, 'gust'], [12, 'frostfang'], [14, 'tailwind'], [15, 'aurorabeam']], desc: '冰核長出了霜之翼，在冰峽之間飛得飛快。' },
  { id: 'ice_ink_beast', name: '冰墨獸', family: 'iceink', stage: 2, rarity: 'B', category: '巨獸', elems: ['ice', 'dark'], sprite: 'ice_ink_beast', pal: 'water',
    base: { hp: 66, atk: 76, def: 60, spd: 66 }, ability: 'thickfat',
    learn: [[1, 'darkbite'], [1, 'icepebble'], [11, 'inkshot'], [12, 'soulsip'], [14, 'rendclaw'], [15, 'icebeam']], desc: '會噴出冰冷墨汁的野獸，墨汁一碰到空氣就結成冰。' },
  { id: 'frost_crystal_fawn', name: '霜晶幼鹿', family: 'frostdeer', stage: 1, rarity: 'SSR', category: '神獸', elems: ['ice', 'grass'], sprite: 'frost_crystal_fawn', pal: 'water',
    base: { hp: 70, atk: 68, def: 68, spd: 72 }, ability: 'waterbarrier',
    learn: [[1, 'icepebble'], [1, 'leafblade'], [11, 'iceshard'], [14, 'frostfang']], evolve: [{ to: 'frost_qilin', level: 16 }], desc: '鹿角是透明冰晶的小鹿，走過的地方會開出霜花。' },
  { id: 'frost_qilin', name: '極霜麒麟', family: 'frostdeer', stage: 3, rarity: 'SSR', category: '神獸', elems: ['ice', 'grass'], sprite: 'frost_qilin', pal: 'water',
    base: { hp: 96, atk: 104, def: 92, spd: 96 }, ability: 'waterbarrier', extra: ['dragonpresence'],
    learn: [[16, 'aurorabeam'], [16, 'icebeam'], [17, 'frostcrack'], [18, 'thornburst'], [20, 'purify']], desc: '守護冰封峽灣的聖獸，祥雲般的寒氣讓萬物沉睡。' },
  { id: 'lava_bubble', name: '熔岩泡', family: 'lavabubble', stage: 1, rarity: 'N', category: '抽象', elems: ['fire'], sprite: 'lava_bubble', pal: 'water',
    base: { hp: 46, atk: 50, def: 44, spd: 56 }, ability: 'blazing',
    learn: [[1, 'ember'], [10, 'scorch'], [12, 'flamebite']], desc: '從岩漿裡冒出來的泡泡，有了意識之後就到處亂跳。' },
  { id: 'fire_rock_bug', name: '火岩蟲', family: 'firebug', stage: 1, rarity: 'N', category: '甲殼', elems: ['fire', 'rock'], sprite: 'fire_rock_bug', pal: 'water',
    base: { hp: 48, atk: 54, def: 60, spd: 42 }, ability: 'hardshell',
    learn: [[1, 'ember'], [1, 'pebble'], [10, 'sandtoss'], [12, 'lavaflow']], desc: '背著燒紅岩塊的小蟲，喜歡躲在熔岩縫裡取暖。' },
  { id: 'magma_core_rock', name: '熔核巨石', family: 'magmarock', stage: 2, rarity: 'B', category: '礦物', elems: ['rock', 'fire'], sprite: 'magma_core_rock', pal: 'water',
    base: { hp: 72, atk: 74, def: 90, spd: 34 }, ability: 'sturdy',
    learn: [[1, 'pebble'], [1, 'ember'], [12, 'rockslide'], [15, 'eruption'], [17, 'coreburst']], desc: '裡面裹著熔岩核心的巨石，平常一動也不動。' },
  { id: 'ember_chick', name: '炎羽雛鳳', family: 'phoenix', stage: 1, rarity: 'SSR', category: '神獸', elems: ['fire', 'fly'], sprite: 'ember_chick', pal: 'water',
    base: { hp: 66, atk: 74, def: 58, spd: 80 }, ability: 'blazing',
    learn: [[1, 'ember'], [1, 'peck'], [14, 'flamebite']], evolve: [{ to: 'cinder_phoenix', level: 16 }], desc: '羽毛是火焰做的雛鳥，生氣時全身會燒得更旺。' },
  { id: 'cinder_phoenix', name: '燼天凰', family: 'phoenix', stage: 3, rarity: 'SSR', category: '神獸', elems: ['fire', 'fly'], sprite: 'cinder_phoenix', pal: 'water',
    base: { hp: 92, atk: 110, def: 80, spd: 104 }, ability: 'blazing', extra: ['undying'],
    learn: [[16, 'featherblade'], [16, 'lavaflow'], [17, 'eruption'], [18, 'tailwind'], [20, 'flareblitz']], desc: '浴火重生的神鳥，傳說牠倒下的地方會長出新的火山。' },
  { id: 'sprout_orb', name: '芽靈球', family: 'sproutorb', stage: 1, rarity: 'N', category: '抽象', elems: ['grass'], sprite: 'sprout_orb', pal: 'water',
    base: { hp: 52, atk: 44, def: 54, spd: 48 }, ability: 'photosyn',
    learn: [[1, 'leafblade'], [1, 'vinebind'], [10, 'seedleech'], [11, 'photosynth']], desc: '聖林裡滾來滾去的嫩芽球，曬到太陽就會長出新葉。' },
  { id: 'mushroom_sprite', name: '傘菇妖', family: 'mushroom', stage: 2, rarity: 'B', category: '抽象', elems: ['grass', 'dark'], sprite: 'mushroom_sprite', pal: 'water',
    base: { hp: 62, atk: 66, def: 62, spd: 52 }, ability: 'stinger',
    learn: [[1, 'leafblade'], [1, 'sporecloud'], [11, 'venomstrike'], [13, 'opportunist'], [15, 'thornburst']], desc: '頂著毒傘的妖精，會在聖林的陰影裡惡作劇。' },
  { id: 'vine_antler_deer', name: '藤角鹿', family: 'vinedeer', stage: 3, rarity: 'A', category: '巨獸', elems: ['grass'], sprite: 'vine_antler_deer', pal: 'water',
    base: { hp: 84, atk: 90, def: 80, spd: 78 }, ability: 'regen',
    learn: [[1, 'leafblade'], [1, 'vinebind'], [1, 'photosynth'], [12, 'thornburst'], [14, 'sacredgrove']], desc: '聖林域的守護者，鹿角上纏繞的藤蔓會開出花。' },
  { id: 'shadow_soul_flame', name: '影魂火', family: 'soulflame', stage: 1, rarity: 'N', category: '抽象', elems: ['dark', 'fire'], sprite: 'shadow_soul_flame', pal: 'water',
    base: { hp: 46, atk: 56, def: 40, spd: 60 }, ability: 'undying',
    learn: [[1, 'darkbite'], [1, 'ember'], [9, 'scorch'], [11, 'bonecurse']], desc: '在無稽區飄蕩的鬼火，偶爾會模仿聽到的聲音。' },
  { id: 'rune_wraith', name: '纏符靈', family: 'runewraith', stage: 2, rarity: 'B', category: '抽象', elems: ['dark', 'data'], sprite: 'rune_wraith', pal: 'water',
    base: { hp: 60, atk: 72, def: 52, spd: 70 }, ability: 'static',
    learn: [[1, 'darkbite'], [1, 'glitchwave'], [11, 'crash'], [12, 'soulsip'], [15, 'datastorm']], desc: '身上纏滿看不懂的符文，符文一亮就會讓周圍的東西出錯。' },
  { id: 'vine_trace_spirit', name: '藤痕靈', family: 'vinetrace', stage: 2, rarity: 'B', category: '抽象', elems: ['dark', 'grass'], sprite: 'vine_trace_spirit', pal: 'water',
    base: { hp: 62, atk: 66, def: 60, spd: 64 }, ability: 'regen',
    learn: [[1, 'darkbite'], [1, 'vinebind'], [11, 'sporecloud'], [13, 'venomstrike'], [15, 'soulsip']], desc: '只剩下藤蔓痕跡的影子生物，摸不到也抓不住。' },
  { id: 'phantom_cub', name: '虛影幼獸', family: 'voidline', stage: 1, rarity: 'S', category: '巨獸', elems: ['dark'], sprite: 'phantom_cub', pal: 'water',
    base: { hp: 60, atk: 70, def: 56, spd: 74 }, ability: 'firststrike',
    learn: [[1, 'darkbite'], [8, 'shadowsneak'], [10, 'bonecurse']], evolve: [{ to: 'void_star_dragon', level: 14 }], desc: '半透明的小獸，眨眼間就會從視線裡消失。' },
  { id: 'void_star_dragon', name: '虛無星龍', family: 'voidline', stage: 3, rarity: 'S', category: '龍', elems: ['dark', 'fly'], sprite: 'void_star_dragon', pal: 'water',
    base: { hp: 90, atk: 106, def: 78, spd: 96 }, ability: 'lure', extra: ['dragonpresence'],
    learn: [[14, 'gust'], [14, 'abyssmaw'], [14, 'seafog'], [15, 'opportunist'], [16, 'datastorm']], desc: '無稽區的主宰，鱗片上倒映著不存在的星空。' },
  { id: 'cubelet', name: '立方子', family: 'cubelet', stage: 1, rarity: 'N', category: '機械', elems: ['data'], sprite: 'cubelet', pal: 'water',
    base: { hp: 46, atk: 48, def: 58, spd: 50 }, ability: 'sturdy',
    learn: [[1, 'bitshot'], [8, 'virus'], [11, 'firewall']], desc: '由小方塊組成的生命，會把自己拆開再重新拼起來。' },
  { id: 'orbit_construct', name: '環構機', family: 'orbit', stage: 2, rarity: 'B', category: '機械', elems: ['data', 'elec'], sprite: 'orbit_construct', pal: 'water',
    base: { hp: 60, atk: 68, def: 64, spd: 70 }, ability: 'static',
    learn: [[1, 'bitshot'], [1, 'zap'], [11, 'scanlock'], [12, 'glitchwave'], [15, 'thunder']], desc: '核心周圍有圓環不停旋轉的構造體，轉得越快力量越強。' },
  { id: 'polyhedral_sentinel', name: '多面傀', family: 'polyhedral', stage: 2, rarity: 'A', category: '機械', elems: ['data', 'rock'], sprite: 'polyhedral_sentinel', pal: 'water',
    base: { hp: 70, atk: 80, def: 88, spd: 52 }, ability: 'hardshell',
    learn: [[1, 'bitshot'], [1, 'pebble'], [11, 'reefspikes'], [12, 'firewall'], [15, 'rockslide'], [17, 'selfdestruct']], desc: '由多面體組成的守衛，會擋在域核的入口不讓人通過。' },
  { id: 'domain_coreling', name: '域核幼體', family: 'domaincore', stage: 1, rarity: 'S', category: '抽象', elems: ['data'], sprite: 'domain_coreling', pal: 'water',
    base: { hp: 58, atk: 66, def: 62, spd: 70 }, ability: 'static',
    learn: [[1, 'bitshot'], [1, 'glitchwave'], [6, 'focus'], [10, 'scanlock'], [12, 'datastorm']], evolve: [{ to: 'domain_realm_core', level: 14 }], desc: '剛剛誕生的域核，發出閃爍的光芒。' },
  { id: 'domain_realm_core', name: '域界核心', family: 'domaincore', stage: 3, rarity: 'S', category: '抽象', elems: ['data'], sprite: 'domain_realm_core', pal: 'water',
    base: { hp: 92, atk: 100, def: 90, spd: 86 }, ability: 'waterbarrier',
    learn: [[14, 'datagrid'], [14, 'datastorm'], [15, 'crash'], [16, 'firewall'], [17, 'focus']], desc: '支撐整個域核區域的核心，環繞著它的光帶就是區域的邊界。' },
  { id: 'cube_coreling', name: '方核幼體', family: 'cubecore', stage: 1, rarity: 'A', category: '機械', elems: ['data', 'water'], sprite: 'cube_coreling', pal: 'water',
    base: { hp: 56, atk: 60, def: 66, spd: 58 }, ability: 'hardshell',
    learn: [[1, 'bitshot'], [1, 'watergun'], [11, 'firewall']], evolve: [{ to: 'matrix_domain_core', level: 14 }], desc: '被水晶環包住的小方核，會把海水轉換成資料。' },
  { id: 'matrix_domain_core', name: '矩陣域核', family: 'cubecore', stage: 3, rarity: 'A', category: '機械', elems: ['data', 'water'], sprite: 'matrix_domain_core', pal: 'water',
    base: { hp: 86, atk: 94, def: 96, spd: 72 }, ability: 'hardshell',
    learn: [[14, 'tidewave'], [14, 'datastorm'], [15, 'scanlock'], [16, 'crabcannon']], desc: '無數方核排成矩陣的巨大存在，運算著海流的方向。' },
  { id: 'chaos_zygote', name: '混沌胚核', family: 'chaosline', stage: 1, rarity: 'SSR', category: '抽象', elems: ['data', 'dark'], sprite: 'chaos_zygote', pal: 'water',
    base: { hp: 68, atk: 76, def: 62, spd: 74 }, ability: 'lure',
    learn: [[1, 'bitshot'], [1, 'darkbite'], [10, 'virus'], [12, 'glitchwave']], evolve: [{ to: 'chaos_eye_realm', level: 15 }], desc: '混沌之中凝聚成形的胚核，裡面的眼睛一直在看著你。' },
  { id: 'chaos_eye_realm', name: '渾沌瞳域', family: 'chaosline', stage: 3, rarity: 'SSR', category: '抽象', elems: ['data', 'dark'], sprite: 'chaos_eye_realm', pal: 'water',
    base: { hp: 98, atk: 112, def: 86, spd: 96 }, ability: 'lure', extra: ['dragonpresence'],
    learn: [[15, 'abyssmaw'], [15, 'datastorm'], [16, 'crash'], [17, 'datagrid'], [18, 'opportunist']], desc: '被這隻眼睛注視的地方，現實就會開始崩解。' },
  // ── 超特殊：神之手（打倒霸主後極低機率出現） ──
  { id: 'godhand', name: '神之手', family: 'godhand', stage: 3, rarity: 'SSR', category: '神獸', elems: [], sprite: 'godhand', pal: 'water', secret: true, scale: 0.95,
    base: { hp: 100, atk: 1, def: 200, spd: 60 }, ability: 'none',
    learn: [[1, 'gh_toss'], [1, 'gh_love'], [1, 'gh_fire'], [1, 'gh_stay'], [1, 'gh_pull']], desc: '從天上伸出的一隻白色的手，擁有壓垮世界的力量。但其實，它只是想有人陪。' },
  // ── 最終大Boss：統領者（不能收服、不會出現在圖鑑和招募）。美術：日蝕戰裝 ──
  { id: 'tide_moxu', name: '潮汐・默旭', family: 'tide_moxu', stage: 3, rarity: 'SSR', category: '神獸', elems: ['water', 'dark'], sprite: 'tide_moxu', pal: 'dragon', secret: true, scale: 1.25,
    // 兩條血＋第二條血召喚霸主（1 對 2）＋大絕招，所以攻擊刻意壓低；每條血是 HP 的 70%（FINAL_TUNE）
    // 模擬：5 隻 Lv26、八成 HP、會用漁夫的釣竿的隊伍，勝率約 40%（6 隻約 46%）；大招會讓全隊各中一種異常
    base: { hp: 77, atk: 32, def: 66, spd: 65 }, ability: 'oceanpower', extra: ['waterbarrier'],
    learn: [[1, 'seagodbreath'], [1, 'moxu_choir'], [1, 'moxu_palace'], [1, 'moxu_lens']], desc: '統領萬潮的存在。所有海域的霸主都聽從祂的潮聲，祂在最深的海裡，等待一個配得上「潮汐獵手」之名的人。' },
  // ── 霸主 ──
  { id: 'whale', name: '鯨嘯', family: 'whale', stage: 3, rarity: 'A', category: '巨獸', elems: ['water'], sprite: 'whale', pal: 'whale',
    base: { hp: 110, atk: 74, def: 70, spd: 46 }, ability: 'colossal',
    learn: [[1, 'surge'], [1, 'hightide'], [1, 'bubblebarrage'], [1, 'tidewave'], [1, 'whalecry']], desc: '淺灘的霸主。一聲長嘯就能掀起巨浪。' },
  // ── 第三片海域：電子海域 ──
  { id: 'pixfish', name: '像素仔', family: 'pixfish', stage: 1, rarity: 'N', category: '魚類', elems: ['data', 'water'], sprite: 'pixfish', pal: 'water',
    base: { hp: 48, atk: 52, def: 44, spd: 62 }, ability: 'swiftswim', learn: [[1, 'bitshot'], [1, 'watergun'], [10, 'aquajet'], [15, 'virus']], evolve: [{ to: 'glitchfin', level: 17 }], desc: '由方塊像素拼成的小魚，身體有幾格會閃爍消失。' },
  { id: 'glitchfin', name: '雜訊鰭魚', family: 'pixfish', stage: 2, rarity: 'N', category: '魚類', elems: ['data', 'water'], sprite: 'glitchfin', pal: 'water',
    base: { hp: 66, atk: 74, def: 58, spd: 82 }, ability: 'swiftswim', learn: [[17, 'crash'], [18, 'glitchwave'], [20, 'datastorm']], desc: '游得太快，身上留下一道道錯位的殘影。' },
  { id: 'cablesnake', name: '纜線海蛇', family: 'cablesnake', stage: 2, rarity: 'B', category: '海怪', elems: ['elec', 'data'], sprite: 'cablesnake', pal: 'water',
    base: { hp: 64, atk: 74, def: 58, spd: 76 }, ability: 'static', learn: [[1, 'zap'], [1, 'bitshot'], [16, 'energydrain'], [18, 'conduct'], [21, 'thunder']], desc: '由海底電纜組成的海蛇，頭是插頭的形狀，會偷吸別人的電。' },
  { id: 'routercrab', name: '路由蟹', family: 'routercrab', stage: 1, rarity: 'B', category: '甲殼', elems: ['data', 'rock'], sprite: 'routercrab', pal: 'water',
    base: { hp: 56, atk: 56, def: 74, spd: 36 }, ability: 'hardshell', learn: [[1, 'bitshot'], [1, 'pebble'], [15, 'firewall']], evolve: [{ to: 'servercrab', level: 18 }], desc: '背著路由器外殼的螃蟹，指示燈閃個不停。' },
  { id: 'servercrab', name: '伺服蟹砦', family: 'routercrab', stage: 3, rarity: 'B', category: '甲殼', elems: ['data', 'rock'], sprite: 'servercrab', pal: 'water',
    base: { hp: 86, atk: 82, def: 104, spd: 34 }, ability: 'hardshell', learn: [[18, 'reefspikes'], [20, 'rockslide'], [21, 'counterscale'], [22, 'selfdestruct']], desc: '背上扛著整座伺服器機櫃，是電子海域的移動要塞。' },
  { id: 'neonray', name: '霓虹鰩', family: 'neonray', stage: 2, rarity: 'A', category: '魚類', elems: ['elec', 'water'], sprite: 'neonray', pal: 'water',
    base: { hp: 62, atk: 66, def: 58, spd: 82 }, ability: 'static', learn: [[1, 'zap'], [1, 'aquajet'], [16, 'flash'], [18, 'conduct']], evolve: [{ to: 'plasmaray', level: 20 }], desc: '身體邊緣是霓虹燈管，在黑暗的資料海裡特別顯眼。' },
  { id: 'plasmaray', name: '電漿魟', family: 'neonray', stage: 3, rarity: 'A', category: '魚類', elems: ['elec', 'water'], sprite: 'plasmaray', pal: 'water',
    base: { hp: 76, atk: 92, def: 70, spd: 96 }, ability: 'static', learn: [[20, 'thunderstorm'], [21, 'thunder'], [22, 'energydrain']], desc: '半透明的身體裡流著電漿，滑過的地方會留下電光。' },
  { id: 'dronegull', name: '巡檢鷗機', family: 'dronegull', stage: 2, rarity: 'B', category: '機械', elems: ['fly', 'data'], sprite: 'dronegull', pal: 'water',
    base: { hp: 56, atk: 70, def: 56, spd: 88 }, ability: 'firststrike', learn: [[1, 'peck'], [1, 'bitshot'], [16, 'scanlock'], [18, 'divebomb'], [21, 'hurricane']], desc: '巡邏電子海域的機械海鷗，紅色鏡頭會鎖定入侵者。' },
  { id: 'virus_jelly', name: '病毒水母', family: 'virus_jelly', stage: 2, rarity: 'A', category: '水母', elems: ['data', 'dark'], sprite: 'virus_jelly', pal: 'water',
    base: { hp: 70, atk: 72, def: 64, spd: 62 }, ability: 'stinger', learn: [[1, 'virus'], [1, 'darkbite'], [16, 'glitchwave'], [18, 'crash'], [21, 'opportunist']], desc: '觸手是一串串亂碼，被碰到的資料都會壞掉。' },
  { id: 'cipher_whale', name: '密鑰鯨', family: 'cipher_whale', stage: 3, rarity: 'S', category: '巨獸', elems: ['data', 'water'], sprite: 'cipher_whale', pal: 'water',
    base: { hp: 96, atk: 84, def: 86, spd: 60 }, ability: 'waterbarrier', learn: [[1, 'bitshot'], [1, 'tidewave'], [1, 'scanlock'], [1, 'datagrid'], [21, 'datastorm']], desc: '身上刻滿發光的密碼，據說背上的鑰匙能打開資料海的最深處。' },
  { id: 'zero_dragon', name: '零式電龍', family: 'zero_dragon', stage: 3, rarity: 'SSR', category: '龍', elems: ['data', 'elec'], sprite: 'zero_dragon', pal: 'water',
    base: { hp: 90, atk: 104, def: 80, spd: 100 }, ability: 'dragonpresence', extra: ['static'], learn: [[1, 'datastorm'], [1, 'stormfang'], [1, 'scanlock'], [1, 'datagrid'], [22, 'thunderstorm']], desc: '傳說中第一個誕生在資料海裡的生命。身體一半是實體、一半是發光的線框。' },
  { id: 'mainframe_leviathan', name: '主機海皇', family: 'mainframe_leviathan', stage: 3, rarity: 'A', category: '龍', elems: ['data', 'elec'], sprite: 'mainframe_leviathan', pal: 'water',
    base: { hp: 100, atk: 82, def: 84, spd: 56 }, ability: 'colossal', learn: [[1, 'thunder'], [1, 'bitshot'], [1, 'datastorm'], [1, 'reboot'], [1, 'datagrid']], desc: '電子海域的霸主。胸口的核心處理器是整片資料海的心臟。' },
  // ── 第三片海域：深淵 ──
  { id: 'lanternlarva', name: '燈籠幼魚', family: 'lanternlarva', stage: 1, rarity: 'N', category: '魚類', elems: ['dark', 'water'], sprite: 'lanternlarva', pal: 'water',
    base: { hp: 50, atk: 50, def: 46, spd: 56 }, ability: 'lure', learn: [[1, 'darkbite'], [1, 'watergun'], [11, 'flash'], [15, 'inkshot']], evolve: [{ to: 'abyss_lantern', level: 17 }], desc: '頭頂掛著小燈籠的深海小魚，用光吸引獵物靠近。' },
  { id: 'abyss_lantern', name: '深淵燈鮟', family: 'lanternlarva', stage: 2, rarity: 'N', category: '魚類', elems: ['dark', 'water'], sprite: 'abyss_lantern', pal: 'water',
    base: { hp: 70, atk: 82, def: 62, spd: 64 }, ability: 'lure', learn: [[17, 'abyssmaw'], [18, 'conduct'], [20, 'shadowsneak']], desc: '燈籠的光讓獵物動彈不得，接著就是滿嘴的尖牙。' },
  { id: 'abyss_wisp', name: '淵火靈', family: 'abyss_wisp', stage: 1, rarity: 'N', category: '抽象', elems: ['dark', 'ice'], sprite: 'abyss_wisp', pal: 'water',
    base: { hp: 48, atk: 56, def: 48, spd: 72 }, ability: 'firststrike', learn: [[1, 'darkbite'], [1, 'icepebble'], [14, 'iceshard'], [17, 'frostcrack']], desc: '在深海漂浮的冷白色鬼火，摸起來冰冰涼涼的。' },
  { id: 'bonecrab', name: '骸骨寄居蟹', family: 'bonecrab', stage: 2, rarity: 'B', category: '骷髏', elems: ['dark', 'rock'], sprite: 'bonecrab', pal: 'water',
    base: { hp: 70, atk: 76, def: 92, spd: 34 }, ability: 'undying', learn: [[1, 'darkbite'], [1, 'pebble'], [16, 'bonerend'], [18, 'rockslide'], [21, 'reefspikes']], desc: '用巨大魚頭骨當殼的寄居蟹，眼窩裡發著微弱的綠光。' },
  { id: 'gulper', name: '吞噬幼鰻', family: 'gulper', stage: 1, rarity: 'B', category: '海怪', elems: ['dark', 'water'], sprite: 'gulper', pal: 'water',
    base: { hp: 56, atk: 64, def: 44, spd: 60 }, ability: 'swiftswim', learn: [[1, 'darkbite'], [1, 'watergun'], [15, 'soulsip']], evolve: [{ to: 'maw_eel', level: 18 }], desc: '嘴巴大得不成比例，什麼都想吞下去。' },
  { id: 'maw_eel', name: '巨口鰻', family: 'gulper', stage: 3, rarity: 'B', category: '海怪', elems: ['dark', 'water'], sprite: 'maw_eel', pal: 'water',
    base: { hp: 82, atk: 102, def: 66, spd: 70 }, ability: 'swiftswim', learn: [[18, 'abyssmaw'], [20, 'bloodtide'], [21, 'sharkrend'], [22, 'recklessram']], desc: '張開的大嘴佔了半個身體，嘴裡一圈圈的牙會發光。' },
  { id: 'pressure_shell', name: '深壓貝', family: 'pressure_shell', stage: 2, rarity: 'A', category: '礦物', elems: ['rock', 'water'], sprite: 'pressure_shell', pal: 'water',
    base: { hp: 72, atk: 60, def: 100, spd: 30 }, ability: 'hardshell', learn: [[1, 'pebble'], [1, 'watergun'], [16, 'harden'], [18, 'counterscale']], evolve: [{ to: 'abyss_pearl', level: 20 }], desc: '在深海高壓下長成的貝，外殼一層層像岩石。' },
  { id: 'abyss_pearl', name: '淵珠母', family: 'pressure_shell', stage: 3, rarity: 'A', category: '礦物', elems: ['rock', 'water'], sprite: 'abyss_pearl', pal: 'water',
    base: { hp: 90, atk: 78, def: 112, spd: 34 }, ability: 'waterbarrier', learn: [[20, 'bubbleguard'], [21, 'rockslide'], [22, 'purify'], [23, 'whalecry']], desc: '殼裡托著一顆發出冷光的黑珍珠，據說能照亮整片深淵。' },
  { id: 'ghost_squid', name: '幽光烏賊', family: 'ghost_squid', stage: 2, rarity: 'A', category: '海怪', elems: ['dark', 'elec'], sprite: 'ghost_squid', pal: 'water',
    base: { hp: 66, atk: 78, def: 62, spd: 82 }, ability: 'static', learn: [[1, 'inkshot'], [1, 'zap'], [16, 'energydrain'], [18, 'conduct'], [21, 'opportunist']], desc: '半透明的烏賊，身上的光斑會像霓虹一樣流動。' },
  { id: 'drowned_bell', name: '沉鐘靈', family: 'drowned_bell', stage: 2, rarity: 'S', category: '抽象', elems: ['dark', 'ice'], sprite: 'drowned_bell', pal: 'water',
    base: { hp: 84, atk: 78, def: 96, spd: 44 }, ability: 'sturdy', learn: [[1, 'darkbite'], [1, 'frostfang'], [1, 'seafog'], [18, 'frostcrack'], [21, 'abyssmaw']], desc: '沉在海底的古老銅鐘化成的靈。鐘響的時候，整片海都會結霜。' },
  { id: 'abyss_eye', name: '淵瞳神', family: 'abyss_eye', stage: 3, rarity: 'SSR', category: '神獸', elems: ['dark', 'water'], sprite: 'abyss_eye', pal: 'water',
    base: { hp: 96, atk: 102, def: 88, spd: 86 }, ability: 'waterbarrier', extra: ['dragonpresence'], learn: [[1, 'abyssmaw'], [1, 'seagodbreath'], [1, 'seafog'], [1, 'inkshot'], [22, 'abyssveil']], desc: '深淵的守望者。巨大的眼睛看得見海裡所有的祕密。' },
  { id: 'nether_whale', name: '冥海巨鯨', family: 'nether_whale', stage: 3, rarity: 'A', category: '巨獸', elems: ['dark', 'water'], sprite: 'nether_whale', pal: 'water',
    base: { hp: 125, atk: 90, def: 80, spd: 48 }, ability: 'colossal', learn: [[1, 'darkbite'], [1, 'soulsip'], [1, 'tidewave'], [1, 'engulf'], [1, 'abyssveil']], desc: '深淵的霸主。全身佈滿傷痕的遠古巨鯨，張開嘴就是一片星空。' },
  // ── 環境形態：在特定區域進化才會出現（沿用原本的圖換色） ──
  { id: 'ghost_jelly', name: '幽靈水母', family: 'jelly', stage: 2, rarity: 'B', category: '水母', elems: ['water', 'dark'], sprite: 'ghost_jelly', pal: 'jelly', regional: true,
    base: { hp: 68, atk: 62, def: 60, spd: 64 }, ability: 'stinger', learn: [[10, 'inkshot'], [11, 'energydrain'], [12, 'bonecurse']], desc: '在無稽區進化的漂流水母。半透明的身體會在黑暗中忽隱忽現。' },
  { id: 'crystal_starrock', name: '晶核星岩', family: 'starsand', stage: 2, rarity: 'B', category: '礦物', elems: ['rock', 'data'], sprite: 'crystal_starrock', pal: 'crystal', regional: true,
    base: { hp: 62, atk: 74, def: 84, spd: 48 }, ability: 'sturdy', learn: [[10, 'rockslide'], [12, 'scanlock'], [14, 'crash']], desc: '在域核區域進化的星砂仔。晶石裡流動著資料的光。' },
  { id: 'moss_crab', name: '苔甲蟹', family: 'bubcrab', stage: 3, rarity: 'B', category: '甲殼', elems: ['water', 'grass'], sprite: 'moss_crab', pal: 'crab', regional: true,
    base: { hp: 84, atk: 82, def: 92, spd: 40 }, ability: 'regen', learn: [[11, 'crabcannon'], [12, 'seedleech'], [14, 'sacredgrove']], desc: '在聖林域進化的泡泡蟹。殼上長滿了青苔與小花。' },
  { id: 'frost_vortex', name: '冰晶星渦', family: 'tideline', stage: 3, rarity: 'A', category: '抽象', elems: ['water', 'ice'], sprite: 'frost_vortex', pal: 'water', regional: true,
    base: { hp: 90, atk: 88, def: 90, spd: 78 }, ability: 'oceanpower', learn: [[14, 'counterflow'], [14, 'frostcrack'], [15, 'auroraveil'], [16, 'icebeam']], desc: '在冰封峽灣進化的潮汐胞體。星渦凍結成一片片冰晶。' },
  { id: 'magma_vortex', name: '熔渦星核', family: 'tideline', stage: 3, rarity: 'A', category: '抽象', elems: ['fire', 'dark'], sprite: 'magma_vortex', pal: 'water', regional: true,
    base: { hp: 86, atk: 98, def: 80, spd: 82 }, ability: 'blazing', learn: [[14, 'lavaflow'], [14, 'soulsip'], [15, 'lavafloor'], [16, 'eruption']], desc: '在熔岩裂谷進化的潮汐胞體。星空被熔岩染成了火紅色。' },
  { id: 'frost_snail', name: '霜岩蝸', family: 'lavasnail', stage: 2, rarity: 'N', category: '礦物', elems: ['ice', 'rock'], sprite: 'frost_snail', pal: 'magma', regional: true,
    base: { hp: 74, atk: 66, def: 94, spd: 36 }, ability: 'sturdy', learn: [[15, 'rockslide'], [16, 'reefspikes'], [17, 'icebeam']], desc: '在冰封峽灣進化的火山蝸。殼上的火山結冰了，噴出的是雪。' },
];

// 第二波進化：補上原本不會進化的角色的下一個形態
for (const e of EVO2) {
  const p = F.find((f) => f.id === e.from);
  if (!p || F.some((f) => f.id === e.id)) continue;
  const up = (v: number) => Math.round(v * e.mult);
  (p.evolve ??= []).push({ to: e.id, level: e.level });
  F.push({
    id: e.id, name: e.name, family: p.family, stage: e.stage, rarity: p.rarity, category: p.category, elems: e.elems ?? p.elems,
    sprite: e.id, pal: p.pal, scale: p.scale, // 正式美術已完成（舊的暫代：沿用前一階的圖＋換色放大）
    base: { hp: up(p.base.hp), atk: up(p.base.atk), def: up(p.base.def), spd: up(p.base.spd) }, ability: p.ability, extra: p.extra,
    learn: e.learn, desc: e.desc,
  });
}
export const FORMS: Record<string, Form> = Object.fromEntries(F.map((f) => [f.id, f]));
export const STARTERS = ['water1', 'fire1', 'grass1'];

// 淺灘出現的野生生物（以家族的第一個形態表示）
export const ICE_POOL = ['snow_crystal_spirit', 'frost_wing_core', 'ice_ink_beast', 'frost_crystal_fawn', 'iceshrimp', 'snowgull', 'icegolem', 'walrus', 'aurorawhale', 'jelly1', 'zaploach', 'starsand', 'thunderfang', 'chubby1'];
export const LAVA_POOL = ['lava_bubble', 'fire_rock_bug', 'magma_core_rock', 'ember_chick', 'lavasnail', 'magmaeel', 'obsidiancrab', 'cinderbone', 'magmacore', 'bonebream', 'starsand', 'bubcrab', 'dragon', 'chubby1'];
export const FOREST_POOL = ['sprout_orb', 'mushroom_sprite', 'vine_antler_deer', 'coral', 'grass1', 'frost_crystal_fawn'];
export const VOID_POOL = ['shadow_soul_flame', 'rune_wraith', 'vine_trace_spirit', 'phantom_cub', 'bonebream', 'cinderbone', 'chaos_zygote'];
export const CORE_POOL = ['cubelet', 'orbit_construct', 'polyhedral_sentinel', 'domain_coreling', 'cube_coreling', 'chaos_zygote', 'zaploach'];
export const CYBER_POOL = ['pixfish', 'cablesnake', 'routercrab', 'neonray', 'dronegull', 'virus_jelly', 'cipher_whale', 'zero_dragon', 'orbit_construct', 'polyhedral_sentinel', 'cube_coreling', 'zaploach'];
export const ABYSS_POOL = ['lanternlarva', 'abyss_wisp', 'bonecrab', 'gulper', 'pressure_shell', 'ghost_squid', 'drowned_bell', 'abyss_eye', 'angler', 'bonebream', 'tide_cell', 'cinderbone'];
export const ZONE1_POOL = ['bubcrab', 'starsand', 'zaploach', 'jelly1', 'gull1', 'coral', 'bonebream', 'angler', 'dragon', 'thunderfang', 'chubby1', 'thunder_wyrmling', 'tide_cell'];
export const ZONE1_BOSS = 'whale';
