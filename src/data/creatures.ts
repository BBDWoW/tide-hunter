// 生物資料：一個「形態」就是圖鑑中的一筆。進化關係寫在 evolve。
import type { Elem, Rarity, Stage } from './types';
import type { PalName } from '../render/pixel';

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

export type Category = '魚類' | '甲殼' | '水鳥' | '海怪' | '礦物' | '水母' | '抽象' | '骷髏' | '龍' | '巨獸' | '神獸';

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
  evolve?: { to: string; level: number }[];
  desc: string;
  scale?: number; // 戰鬥畫面中的放大倍率
  no?: number; // 圖鑑編號
  height?: number; // 公尺
  weight?: number; // 公斤
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
    learn: [[9, 'tidewave'], [12, 'surge'], [15, 'bubblebarrage']], evolve: [{ to: 'water3a', level: 18 }],
    desc: '背鰭能感應浪潮的方向，游得又快又穩。' },
  { id: 'water3a', name: '怒濤鯊', family: 'water', stage: 3, rarity: 'N', category: '魚類', elems: ['water'], sprite: 'water3a', pal: 'tide',
    base: { hp: 78, atk: 96, def: 70, spd: 90 }, ability: 'moist', learn: [[18, 'roar'], [22, 'whalecry']], desc: '攻擊型完全體。追著浪頭獵食的猛鯊。' },
  { id: 'water3b', name: '盾殼鯨', family: 'water', stage: 3, rarity: 'N', category: '魚類', elems: ['water'], sprite: 'water3b', pal: 'tide',
    base: { hp: 105, atk: 70, def: 100, spd: 55 }, ability: 'hardshell', learn: [[18, 'harden'], [22, 'whalecry']], desc: '守護型完全體。背殼能擋下暴風浪。' },
  // ── 初始夥伴：火 ──
  { id: 'fire1', name: '火鬚', family: 'fire', stage: 1, rarity: 'N', category: '魚類', elems: ['fire'], sprite: 'fire1', pal: 'ember',
    base: { hp: 44, atk: 54, def: 42, spd: 52 }, ability: 'blazing',
    learn: [[1, 'ember'], [1, 'tackle'], [6, 'heatup'], [9, 'flamebite']], evolve: [{ to: 'fire2', level: 9 }],
    desc: '鬍鬚末端燃著小火苗，在水裡也不會熄滅。' },
  { id: 'fire2', name: '焰鯰', family: 'fire', stage: 2, rarity: 'N', category: '魚類', elems: ['fire'], sprite: 'fire2', pal: 'ember',
    base: { hp: 58, atk: 72, def: 54, spd: 62 }, ability: 'blazing',
    learn: [[9, 'flamebite'], [13, 'roar'], [16, 'blaze']], evolve: [{ to: 'fire3a', level: 18 }],
    desc: '背上的火焰越旺，代表心情越好。' },
  { id: 'fire3a', name: '爆炎龍鯰', family: 'fire', stage: 3, rarity: 'N', category: '魚類', elems: ['fire'], sprite: 'fire3a', pal: 'magma',
    base: { hp: 74, atk: 105, def: 66, spd: 85 }, ability: 'blazing', learn: [[18, 'blaze']], desc: '攻擊型完全體。頭上的角能噴出爆炎。' },
  { id: 'fire3b', name: '熔甲鯰', family: 'fire', stage: 3, rarity: 'N', category: '魚類', elems: ['fire', 'rock'], sprite: 'fire3b', pal: 'magma',
    base: { hp: 95, atk: 80, def: 100, spd: 50 }, ability: 'sturdy', learn: [[18, 'rockslide']], desc: '守護型完全體。身披冷卻的熔岩鎧甲。' },
  // ── 初始夥伴：草 ──
  { id: 'grass1', name: '芽鰭', family: 'grass', stage: 1, rarity: 'N', category: '魚類', elems: ['grass'], sprite: 'grass1', pal: 'grass',
    base: { hp: 52, atk: 44, def: 52, spd: 46 }, ability: 'photosyn',
    learn: [[1, 'leafblade'], [1, 'tackle'], [6, 'vinebind'], [9, 'photosynth']], evolve: [{ to: 'grass2', level: 9 }],
    desc: '頭上的嫩芽會朝著陽光的方向轉動。' },
  { id: 'grass2', name: '藻鬣魚', family: 'grass', stage: 2, rarity: 'N', category: '魚類', elems: ['grass'], sprite: 'grass2', pal: 'kelp',
    base: { hp: 68, atk: 58, def: 66, spd: 56 }, ability: 'photosyn',
    learn: [[9, 'photosynth'], [12, 'sporecloud'], [16, 'thornburst']], evolve: [{ to: 'grass3a', level: 18 }],
    desc: '海藻般的鬃毛能躲藏小魚。' },
  { id: 'grass3a', name: '棘藤魚龍', family: 'grass', stage: 3, rarity: 'N', category: '龍', elems: ['grass'], sprite: 'grass3a', pal: 'thornvine',
    base: { hp: 80, atk: 95, def: 75, spd: 80 }, ability: 'photosyn', learn: [[18, 'thornburst']], desc: '攻擊型完全體。全身長滿荊棘。' },
  { id: 'grass3b', name: '森苔龜魚', family: 'grass', stage: 3, rarity: 'N', category: '魚類', elems: ['grass'], sprite: 'grass3b', pal: 'grass',
    base: { hp: 110, atk: 65, def: 105, spd: 45 }, ability: 'regen', learn: [[18, 'harden']], desc: '守護型完全體。背上長著一棵小樹。' },

  // ── 淺灘野生 ──
  { id: 'bubcrab', name: '泡泡蟹', family: 'bubcrab', stage: 1, rarity: 'N', category: '甲殼', elems: ['water'], sprite: 'bubcrab', pal: 'crab',
    base: { hp: 46, atk: 50, def: 62, spd: 34 }, ability: 'hardshell',
    learn: [[1, 'bubblebarrage'], [4, 'harden']], evolve: [{ to: 'cannoncrab', level: 12 }],
    desc: '會吐泡泡的小螃蟹。牠沒有成長體，某天會突然變成巨鉗砲台。' },
  { id: 'cannoncrab', name: '鉗砲蟹', family: 'bubcrab', stage: 3, rarity: 'N', category: '甲殼', elems: ['water', 'rock'], sprite: 'cannoncrab', pal: 'crab',
    base: { hp: 72, atk: 92, def: 96, spd: 40 }, ability: 'hardshell', learn: [[12, 'crabcannon'], [14, 'rockslide']],
    desc: '跳階進化的完全體。右鉗是一座高壓水砲。' },
  { id: 'starsand', name: '星砂仔', family: 'starsand', stage: 1, rarity: 'N', category: '礦物', elems: ['rock'], sprite: 'starsand', pal: 'star',
    base: { hp: 44, atk: 42, def: 60, spd: 40 }, ability: 'sturdy',
    learn: [[1, 'pebble'], [3, 'starshard'], [7, 'harden']], evolve: [{ to: 'starrock', level: 10 }],
    desc: '星砂聚集而成的礦物生命，晚上會微微發光。' },
  { id: 'starrock', name: '星岩獸', family: 'starsand', stage: 2, rarity: 'N', category: '礦物', elems: ['rock'], sprite: 'starrock', pal: 'crystal',
    base: { hp: 62, atk: 70, def: 85, spd: 42 }, ability: 'sturdy', learn: [[10, 'rockslide']], desc: '核心的晶石越亮，力量越強。' },
  { id: 'zaploach', name: '微電鰍', family: 'zaploach', stage: 1, rarity: 'N', category: '魚類', elems: ['elec'], sprite: 'zaploach', pal: 'volteel',
    base: { hp: 40, atk: 48, def: 38, spd: 66 }, ability: 'static',
    learn: [[1, 'zap'], [4, 'paralywave']], evolve: [{ to: 'zapeel', level: 9 }], desc: '摸起來會刺刺麻麻的小泥鰍。' },
  { id: 'zapeel', name: '雷紋鰻', family: 'zaploach', stage: 2, rarity: 'N', category: '魚類', elems: ['elec'], sprite: 'zapeel', pal: 'volteel',
    base: { hp: 56, atk: 68, def: 50, spd: 82 }, ability: 'static', learn: [[9, 'thunder']], desc: '身上的閃電紋路會隨情緒閃爍。' },
  { id: 'jelly1', name: '漂流水母', family: 'jelly', stage: 1, rarity: 'N', category: '水母', elems: ['water'], sprite: 'jelly1', pal: 'jellyblue',
    base: { hp: 50, atk: 38, def: 46, spd: 44 }, ability: 'stinger',
    learn: [[1, 'watergun'], [3, 'sporecloud']], evolve: [{ to: 'jelly2', level: 10 }], desc: '隨著洋流漂浮，觸手帶有微毒。' },
  { id: 'jelly2', name: '霓光水母', family: 'jelly', stage: 2, rarity: 'N', category: '水母', elems: ['water', 'elec'], sprite: 'jelly2', pal: 'jelly',
    base: { hp: 70, atk: 58, def: 62, spd: 56 }, ability: 'stinger', learn: [[10, 'paralywave'], [13, 'tidewave']], desc: '夜裡會發出霓虹色的光。' },
  { id: 'gull1', name: '鷗哨兵', family: 'gull', stage: 1, rarity: 'B', category: '水鳥', elems: ['fly'], sprite: 'gull1', pal: 'gull',
    base: { hp: 46, atk: 54, def: 40, spd: 70 }, ability: 'firststrike',
    learn: [[1, 'peck'], [3, 'gust'], [8, 'divebomb']], evolve: [{ to: 'gull2', level: 11 }], desc: '戴著小帽巡邏海岸的海鷗。' },
  { id: 'gull2', name: '鷗隊長', family: 'gull', stage: 2, rarity: 'B', category: '水鳥', elems: ['fly', 'water'], sprite: 'gull2', pal: 'gull',
    base: { hp: 62, atk: 74, def: 54, spd: 88 }, ability: 'firststrike', learn: [[11, 'roar'], [13, 'tidewave']], desc: '率領整片海岸的鷗群。' },
  { id: 'coral', name: '珊瑚精', family: 'coral', stage: 2, rarity: 'B', category: '抽象', elems: ['grass', 'water'], sprite: 'coral', pal: 'coral',
    base: { hp: 66, atk: 50, def: 64, spd: 40 }, ability: 'regen',
    learn: [[1, 'leafblade'], [1, 'photosynth'], [5, 'sporecloud']], desc: '珊瑚礁的意識凝聚成形。沒有人見過它的幼體。' },
  { id: 'bonebream', name: '白骨鯛', family: 'bonebream', stage: 2, rarity: 'A', category: '骷髏', elems: ['dark', 'water'], sprite: 'bonebream', pal: 'bone',
    base: { hp: 58, atk: 72, def: 58, spd: 64 }, ability: 'undying',
    learn: [[1, 'darkbite'], [1, 'bonecurse'], [6, 'soulsip']], desc: '沉船旁游蕩的骨頭魚。據說是被遺忘的漁獲。' },
  { id: 'angler', name: '觸鬚燈怪', family: 'angler', stage: 3, rarity: 'S', category: '海怪', elems: ['elec', 'dark'], sprite: 'angler', pal: 'abyss',
    base: { hp: 82, atk: 88, def: 70, spd: 58 }, ability: 'lure',
    learn: [[1, 'darkbite'], [1, 'luresnap'], [1, 'paralywave'], [8, 'abyssmaw']], desc: '從深海浮上來的海怪，頭上的燈會引誘獵物。' },
  { id: 'dragon', name: '蒼鱗龍', family: 'dragon', stage: 3, rarity: 'SSR', category: '龍', elems: ['water'], sprite: 'dragon', pal: 'dragon',
    base: { hp: 92, atk: 100, def: 82, spd: 95 }, ability: 'oceanpower', extra: ['dragonpresence', 'waterbarrier'], no: 1001, height: 12.5, weight: 860,
    learn: [[1, 'seagodbreath'], [1, 'waterspout'], [1, 'dragonpulse'], [1, 'aurorawing']], desc: '傳說中守護淺灘的龍。一生只會現身一次。' },
  { id: 'thunderfang', name: '霆牙', family: 'thunderfang', stage: 3, rarity: 'SSR', category: '巨獸', elems: ['elec', 'water'], sprite: 'thunderfang', pal: 'thunder',
    base: { hp: 90, atk: 108, def: 78, spd: 104 }, ability: 'stormking',
    learn: [[1, 'zap'], [1, 'tidewave'], [1, 'stormfang'], [1, 'roar']], desc: '雷雨夜踏浪而來的獸王。閃電角每閃一次，海面就會落下一道雷。' },
  { id: 'chubby1', name: '小肥源', family: 'chubby', stage: 1, rarity: 'SSR', category: '巨獸', elems: ['water', 'rock'], sprite: 'chubby1', pal: 'capy',
    base: { hp: 95, atk: 80, def: 90, spd: 30 }, ability: 'thickfat', extra: ['waterveil'], no: 301, height: 0.4, weight: 6.5,
    learn: [[1, 'microquake'], [1, 'wobble'], [1, 'rollout'], [1, 'tackle'], [4, 'microtoxin']], evolve: [{ to: 'chubby2', level: 12 }],
    desc: '雖然體型很小，卻擁有驚人的破壞力。一個抖動就能讓地面顫動。' },
  { id: 'chubby2', name: '巨肥源', family: 'chubby', stage: 3, rarity: 'SSR', category: '巨獸', elems: ['water', 'rock'], sprite: 'chubby2', pal: 'capy',
    base: { hp: 140, atk: 115, def: 120, spd: 35 }, ability: 'thickfat', extra: ['poisonbody'], no: 302,
    learn: [[12, 'bodyslam'], [12, 'deepsleep'], [14, 'bigquake'], [16, 'stunslam'], [18, 'megatoxin']],
    desc: '體型變得異常巨大，只要一跺腳就能引發地震，是整片海灘的霸主。' },
  // ── 冰封峽灣 ──
  { id: 'iceshrimp', name: '冰晶蝦', family: 'iceshrimp', stage: 1, rarity: 'N', category: '甲殼', elems: ['ice'], sprite: 'iceshrimp', pal: 'ice',
    base: { hp: 46, atk: 52, def: 56, spd: 50 }, ability: 'hardshell',
    learn: [[1, 'icepebble'], [1, 'hail'], [14, 'frostfang']], evolve: [{ to: 'iceshrimp2', level: 18 }], desc: '殼像冰晶一樣透明，在冰縫裡成群生活。' },
  { id: 'iceshrimp2', name: '冰甲蝦', family: 'iceshrimp', stage: 2, rarity: 'N', category: '甲殼', elems: ['ice', 'rock'], sprite: 'iceshrimp2', pal: 'ice',
    base: { hp: 64, atk: 74, def: 82, spd: 56 }, ability: 'hardshell', learn: [[18, 'rockslide'], [20, 'icebeam']], desc: '冰晶殼長成了厚重的鎧甲，雙鉗能夾碎冰山。' },
  { id: 'snowgull', name: '雪羽鷗', family: 'snowgull', stage: 2, rarity: 'B', category: '水鳥', elems: ['ice', 'fly'], sprite: 'snowgull', pal: 'snow',
    base: { hp: 60, atk: 70, def: 54, spd: 86 }, ability: 'firststrike',
    learn: [[1, 'peck'], [1, 'icepebble'], [12, 'gust'], [16, 'divebomb'], [20, 'frostfang']], desc: '羽毛像新雪一樣白，暴風雪中也能精準捕魚。' },
  { id: 'icegolem', name: '冰核石偶', family: 'icegolem', stage: 2, rarity: 'A', category: '礦物', elems: ['ice', 'rock'], sprite: 'icegolem', pal: 'glacier',
    base: { hp: 72, atk: 78, def: 96, spd: 30 }, ability: 'sturdy',
    learn: [[1, 'pebble'], [1, 'icepebble'], [12, 'harden'], [16, 'rockslide'], [20, 'icebeam']], desc: '萬年冰核外包著岩石的生命。不會進化，但聽說會在某天「覺醒」。' },
  { id: 'walrus', name: '霜牙海象', family: 'walrus', stage: 3, rarity: 'S', category: '巨獸', elems: ['ice', 'water'], sprite: 'walrus', pal: 'walrus',
    base: { hp: 96, atk: 98, def: 84, spd: 48 }, ability: 'thickfat',
    learn: [[1, 'frostfang'], [1, 'tidewave'], [1, 'roar'], [16, 'icebeam']], desc: '冰海的戰士，一對冰牙能鑿穿冰層。' },
  { id: 'aurorawhale', name: '極光鯨', family: 'aurorawhale', stage: 3, rarity: 'SSR', category: '神獸', elems: ['ice', 'fly'], sprite: 'aurorawhale', pal: 'aurora',
    base: { hp: 110, atk: 92, def: 88, spd: 82 }, ability: 'waterbarrier', extra: ['dragonpresence'],
    learn: [[1, 'aurorabeam'], [1, 'icebeam'], [1, 'gust'], [1, 'surge']], desc: '只在極光之夜浮出海面的神鯨，身上流動著七彩的光。' },
  { id: 'frostking', name: '冰冠海獅王', family: 'frostking', stage: 3, rarity: 'A', category: '巨獸', elems: ['ice', 'water'], sprite: 'frostking', pal: 'glacier',
    base: { hp: 115, atk: 92, def: 90, spd: 60 }, ability: 'colossal',
    learn: [[1, 'icebeam'], [1, 'frostfang'], [1, 'tidewave'], [1, 'hail']], desc: '冰封峽灣的霸主，頭頂萬年不化的冰冠。' },
  // ── 熔岩裂谷 ──
  { id: 'lavasnail', name: '火山蝸', family: 'lavasnail', stage: 1, rarity: 'N', category: '礦物', elems: ['fire', 'rock'], sprite: 'lavasnail', pal: 'magma',
    base: { hp: 52, atk: 46, def: 66, spd: 30 }, ability: 'sturdy',
    learn: [[1, 'ember'], [1, 'pebble'], [14, 'lavaflow']], evolve: [{ to: 'lavasnail2', level: 18 }], desc: '背著一座小火山慢慢爬，殼裡的岩漿永遠不會冷卻。' },
  { id: 'lavasnail2', name: '熔岩蝸', family: 'lavasnail', stage: 2, rarity: 'N', category: '礦物', elems: ['fire', 'rock'], sprite: 'lavasnail2', pal: 'magma',
    base: { hp: 72, atk: 70, def: 92, spd: 34 }, ability: 'sturdy', learn: [[18, 'rockslide'], [21, 'eruption']], desc: '殼上的火山會定時噴發，附近的海水都在沸騰。' },
  { id: 'magmaeel', name: '熔岩鰻', family: 'magmaeel', stage: 2, rarity: 'B', category: '魚類', elems: ['fire'], sprite: 'magmaeel', pal: 'fire',
    base: { hp: 60, atk: 80, def: 54, spd: 82 }, ability: 'blazing',
    learn: [[1, 'ember'], [1, 'flamebite'], [14, 'lavaflow'], [18, 'heatup']], desc: '在岩漿縫隙間穿梭的鰻魚，身上的紋路像流動的熔岩。' },
  { id: 'obsidiancrab', name: '黑曜石蟹', family: 'obsidiancrab', stage: 2, rarity: 'A', category: '甲殼', elems: ['rock', 'fire'], sprite: 'obsidiancrab', pal: 'obsidian',
    base: { hp: 66, atk: 92, def: 98, spd: 44 }, ability: 'hardshell',
    learn: [[1, 'pebble'], [1, 'ember'], [12, 'obsidianedge'], [16, 'harden'], [20, 'lavaflow']], desc: '冷卻的岩漿凝成了黑曜石外殼，鉗子鋒利得像玻璃刀。' },
  { id: 'cinderbone', name: '焦骨鰻', family: 'cinderbone', stage: 3, rarity: 'S', category: '骷髏', elems: ['fire', 'dark'], sprite: 'cinderbone', pal: 'cinder',
    base: { hp: 80, atk: 102, def: 70, spd: 76 }, ability: 'undying',
    learn: [[1, 'flamebite'], [1, 'soulsip'], [1, 'bonecurse'], [16, 'eruption']], desc: '被熔岩燒成骨頭也不肯死去的鰻魚，眼窩裡燃著鬼火。' },
  { id: 'magmacore', name: '熔核巨獸', family: 'magmacore', stage: 3, rarity: 'SSR', category: '巨獸', elems: ['fire', 'rock'], sprite: 'magmacore', pal: 'magma',
    base: { hp: 112, atk: 112, def: 104, spd: 50 }, ability: 'colossal', extra: ['blazing'],
    learn: [[1, 'eruption'], [1, 'obsidianedge'], [1, 'lavaflow'], [1, 'roar']], desc: '心臟是一顆熔岩核心的巨獸，傳說裂谷就是牠翻身時撕開的。' },
  { id: 'lavadragon', name: '熔岩海龍王', family: 'lavadragon', stage: 3, rarity: 'A', category: '龍', elems: ['fire', 'water'], sprite: 'lavadragon', pal: 'magma',
    base: { hp: 112, atk: 98, def: 84, spd: 66 }, ability: 'colossal',
    learn: [[1, 'eruption'], [1, 'lavaflow'], [1, 'tidewave'], [1, 'heatup']], desc: '熔岩裂谷的霸主，在岩漿與海水的交界處沉睡。' },
  // ── 霸主 ──
  { id: 'whale', name: '鯨嘯', family: 'whale', stage: 3, rarity: 'A', category: '巨獸', elems: ['water'], sprite: 'whale', pal: 'whale',
    base: { hp: 110, atk: 74, def: 70, spd: 46 }, ability: 'colossal',
    learn: [[1, 'tidewave'], [1, 'bubblebarrage'], [1, 'whalecry'], [1, 'surge']], desc: '淺灘的霸主。一聲長嘯就能掀起巨浪。' },
];

export const FORMS: Record<string, Form> = Object.fromEntries(F.map((f) => [f.id, f]));
export const STARTERS = ['water1', 'fire1', 'grass1'];

// 淺灘出現的野生生物（以家族的第一個形態表示）
export const ICE_POOL = ['iceshrimp', 'snowgull', 'icegolem', 'walrus', 'aurorawhale', 'jelly1', 'zaploach', 'starsand', 'thunderfang', 'chubby1'];
export const LAVA_POOL = ['lavasnail', 'magmaeel', 'obsidiancrab', 'cinderbone', 'magmacore', 'bonebream', 'starsand', 'bubcrab', 'dragon', 'chubby1'];
export const ZONE1_POOL = ['bubcrab', 'starsand', 'zaploach', 'jelly1', 'gull1', 'coral', 'bonebream', 'angler', 'dragon', 'thunderfang', 'chubby1'];
export const ZONE1_BOSS = 'whale';
