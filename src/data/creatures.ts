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
  evolve?: { to: string; level: number; style?: 'atk' | 'guard' }[]; // style：分支進化的條件
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
    learn: [[9, 'tidewave'], [11, 'aquajet'], [13, 'surge'], [15, 'counterflow']], evolve: [{ to: 'water3a', level: 18, style: 'atk' }, { to: 'water3b', level: 18, style: 'guard' }],
    desc: '背鰭能感應浪潮的方向，游得又快又穩。' },
  { id: 'water3a', name: '怒濤鯊', family: 'water', stage: 3, rarity: 'N', category: '魚類', elems: ['water'], sprite: 'water3a', pal: 'tide',
    base: { hp: 78, atk: 96, def: 70, spd: 90 }, ability: 'moist', learn: [[18, 'sharkrend'], [20, 'tidecharge'], [21, 'roar'], [24, 'whalecry']], desc: '攻擊型完全體。追著浪頭獵食的猛鯊。' },
  { id: 'water3b', name: '盾殼鯨', family: 'water', stage: 3, rarity: 'N', category: '魚類', elems: ['water'], sprite: 'water3b', pal: 'tide',
    base: { hp: 105, atk: 70, def: 100, spd: 55 }, ability: 'hardshell', learn: [[18, 'counterscale'], [20, 'harden'], [22, 'whalecry'], [24, 'bubbleguard']], desc: '守護型完全體。背殼能擋下暴風浪。' },
  // ── 初始夥伴：火 ──
  { id: 'fire1', name: '火鬚', family: 'fire', stage: 1, rarity: 'N', category: '魚類', elems: ['fire'], sprite: 'fire1', pal: 'ember',
    base: { hp: 44, atk: 54, def: 42, spd: 52 }, ability: 'blazing',
    learn: [[1, 'ember'], [1, 'tackle'], [6, 'heatup'], [9, 'flamebite']], evolve: [{ to: 'fire2', level: 9 }],
    desc: '鬍鬚末端燃著小火苗，在水裡也不會熄滅。' },
  { id: 'fire2', name: '焰鯰', family: 'fire', stage: 2, rarity: 'N', category: '魚類', elems: ['fire'], sprite: 'fire2', pal: 'ember',
    base: { hp: 58, atk: 72, def: 54, spd: 62 }, ability: 'blazing',
    learn: [[9, 'flamebite'], [11, 'scorch'], [13, 'roar'], [16, 'blaze']], evolve: [{ to: 'fire3a', level: 18, style: 'atk' }, { to: 'fire3b', level: 18, style: 'guard' }],
    desc: '背上的火焰越旺，代表心情越好。' },
  { id: 'fire3a', name: '爆炎龍鯰', family: 'fire', stage: 3, rarity: 'N', category: '魚類', elems: ['fire'], sprite: 'fire3a', pal: 'magma',
    base: { hp: 74, atk: 105, def: 66, spd: 85 }, ability: 'blazing', learn: [[18, 'flareblitz'], [22, 'lavafloor']], desc: '攻擊型完全體。頭上的角能噴出爆炎。' },
  { id: 'fire3b', name: '熔甲鯰', family: 'fire', stage: 3, rarity: 'N', category: '魚類', elems: ['fire', 'rock'], sprite: 'fire3b', pal: 'magma',
    base: { hp: 95, atk: 80, def: 100, spd: 50 }, ability: 'sturdy', learn: [[18, 'rockslide'], [20, 'reefspikes'], [22, 'harden']], desc: '守護型完全體。身披冷卻的熔岩鎧甲。' },
  // ── 初始夥伴：草 ──
  { id: 'grass1', name: '芽鰭', family: 'grass', stage: 1, rarity: 'N', category: '魚類', elems: ['grass'], sprite: 'grass1', pal: 'grass',
    base: { hp: 52, atk: 44, def: 52, spd: 46 }, ability: 'photosyn',
    learn: [[1, 'leafblade'], [1, 'tackle'], [6, 'vinebind'], [9, 'photosynth']], evolve: [{ to: 'grass2', level: 9 }],
    desc: '頭上的嫩芽會朝著陽光的方向轉動。' },
  { id: 'grass2', name: '藻鬣魚', family: 'grass', stage: 2, rarity: 'N', category: '魚類', elems: ['grass'], sprite: 'grass2', pal: 'kelp',
    base: { hp: 68, atk: 58, def: 66, spd: 56 }, ability: 'photosyn',
    learn: [[9, 'photosynth'], [11, 'sporecloud'], [13, 'seedleech'], [16, 'venomstrike']], evolve: [{ to: 'grass3a', level: 18, style: 'atk' }, { to: 'grass3b', level: 18, style: 'guard' }],
    desc: '海藻般的鬃毛能躲藏小魚。' },
  { id: 'grass3a', name: '棘藤魚龍', family: 'grass', stage: 3, rarity: 'N', category: '龍', elems: ['grass'], sprite: 'grass3a', pal: 'thornvine',
    base: { hp: 80, atk: 95, def: 75, spd: 80 }, ability: 'photosyn', learn: [[18, 'thornburst'], [22, 'sacredgrove']], desc: '攻擊型完全體。全身長滿荊棘。' },
  { id: 'grass3b', name: '森苔龜魚', family: 'grass', stage: 3, rarity: 'N', category: '魚類', elems: ['grass'], sprite: 'grass3b', pal: 'grass',
    base: { hp: 110, atk: 65, def: 105, spd: 45 }, ability: 'regen', learn: [[18, 'harden'], [20, 'sacredgrove'], [22, 'purify']], desc: '守護型完全體。背上長著一棵小樹。' },

  // ── 淺灘野生 ──
  { id: 'bubcrab', name: '泡泡蟹', family: 'bubcrab', stage: 1, rarity: 'N', category: '甲殼', elems: ['water'], sprite: 'bubcrab', pal: 'crab',
    base: { hp: 46, atk: 50, def: 62, spd: 34 }, ability: 'hardshell',
    learn: [[1, 'bubblebarrage'], [4, 'harden'], [7, 'bubbleguard']], evolve: [{ to: 'cannoncrab', level: 12 }],
    desc: '會吐泡泡的小螃蟹。牠沒有成長體，某天會突然變成巨鉗砲台。' },
  { id: 'cannoncrab', name: '鉗砲蟹', family: 'bubcrab', stage: 3, rarity: 'N', category: '甲殼', elems: ['water', 'rock'], sprite: 'cannoncrab', pal: 'crab',
    base: { hp: 72, atk: 92, def: 96, spd: 40 }, ability: 'hardshell', learn: [[12, 'crabcannon'], [13, 'tidecharge'], [14, 'rockslide'], [16, 'counterscale']],
    desc: '跳階進化的完全體。右鉗是一座高壓水砲。' },
  { id: 'starsand', name: '星砂仔', family: 'starsand', stage: 1, rarity: 'N', category: '礦物', elems: ['rock'], sprite: 'starsand', pal: 'star',
    base: { hp: 44, atk: 42, def: 60, spd: 40 }, ability: 'sturdy',
    learn: [[1, 'pebble'], [3, 'starshard'], [7, 'sandtoss']], evolve: [{ to: 'starrock', level: 10 }],
    desc: '星砂聚集而成的礦物生命，晚上會微微發光。' },
  { id: 'starrock', name: '星岩獸', family: 'starsand', stage: 2, rarity: 'N', category: '礦物', elems: ['rock'], sprite: 'starrock', pal: 'crystal',
    base: { hp: 62, atk: 70, def: 85, spd: 42 }, ability: 'sturdy', learn: [[10, 'rockslide'], [13, 'reefspikes'], [16, 'harden'], [18, 'recklessram']], desc: '核心的晶石越亮，力量越強。' },
  { id: 'zaploach', name: '微電鰍', family: 'zaploach', stage: 1, rarity: 'N', category: '魚類', elems: ['elec'], sprite: 'zaploach', pal: 'volteel',
    base: { hp: 40, atk: 48, def: 38, spd: 66 }, ability: 'static',
    learn: [[1, 'zap'], [4, 'paralywave']], evolve: [{ to: 'zapeel', level: 9 }], desc: '摸起來會刺刺麻麻的小泥鰍。' },
  { id: 'zapeel', name: '雷紋鰻', family: 'zaploach', stage: 2, rarity: 'N', category: '魚類', elems: ['elec'], sprite: 'zapeel', pal: 'volteel',
    base: { hp: 56, atk: 68, def: 50, spd: 82 }, ability: 'static', learn: [[9, 'conduct'], [12, 'thunder'], [15, 'energydrain']], desc: '身上的閃電紋路會隨情緒閃爍。' },
  { id: 'jelly1', name: '漂流水母', family: 'jelly', stage: 1, rarity: 'N', category: '水母', elems: ['water'], sprite: 'jelly1', pal: 'jellyblue',
    base: { hp: 50, atk: 38, def: 46, spd: 44 }, ability: 'stinger',
    learn: [[1, 'watergun'], [3, 'sporecloud']], evolve: [{ to: 'jelly2', level: 10 }], desc: '隨著洋流漂浮，觸手帶有微毒。' },
  { id: 'jelly2', name: '霓光水母', family: 'jelly', stage: 2, rarity: 'N', category: '水母', elems: ['water', 'elec'], sprite: 'jelly2', pal: 'jelly',
    base: { hp: 70, atk: 58, def: 62, spd: 56 }, ability: 'stinger', learn: [[10, 'paralywave'], [12, 'energydrain'], [14, 'waterpulse'], [16, 'bubbleguard']], desc: '夜裡會發出霓虹色的光。' },
  { id: 'gull1', name: '鷗哨兵', family: 'gull', stage: 1, rarity: 'B', category: '水鳥', elems: ['fly'], sprite: 'gull1', pal: 'gull',
    base: { hp: 46, atk: 54, def: 40, spd: 70 }, ability: 'firststrike',
    learn: [[1, 'peck'], [3, 'gust'], [8, 'divebomb']], evolve: [{ to: 'gull2', level: 11 }], desc: '戴著小帽巡邏海岸的海鷗。' },
  { id: 'gull2', name: '鷗隊長', family: 'gull', stage: 2, rarity: 'B', category: '水鳥', elems: ['fly', 'water'], sprite: 'gull2', pal: 'gull',
    base: { hp: 62, atk: 74, def: 54, spd: 88 }, ability: 'firststrike', learn: [[11, 'tailwind'], [13, 'featherblade'], [15, 'waterpulse'], [18, 'hurricane']], desc: '率領整片海岸的鷗群。' },
  { id: 'coral', name: '珊瑚精', family: 'coral', stage: 2, rarity: 'B', category: '抽象', elems: ['grass', 'water'], sprite: 'coral', pal: 'coral',
    base: { hp: 66, atk: 50, def: 64, spd: 40 }, ability: 'regen',
    learn: [[1, 'leafblade'], [5, 'seedleech'], [8, 'purify'], [10, 'sporecloud'], [12, 'photosynth']], desc: '珊瑚礁的意識凝聚成形。沒有人見過它的幼體。' },
  { id: 'bonebream', name: '白骨鯛', family: 'bonebream', stage: 2, rarity: 'A', category: '骷髏', elems: ['dark', 'water'], sprite: 'bonebream', pal: 'bone',
    base: { hp: 58, atk: 72, def: 58, spd: 64 }, ability: 'undying',
    learn: [[1, 'darkbite'], [1, 'bonecurse'], [6, 'soulsip'], [10, 'bonerend'], [14, 'opportunist']], desc: '沉船旁游蕩的骨頭魚。據說是被遺忘的漁獲。' },
  { id: 'angler', name: '觸鬚燈怪', family: 'angler', stage: 3, rarity: 'S', category: '海怪', elems: ['elec', 'dark'], sprite: 'angler', pal: 'abyss',
    base: { hp: 82, atk: 88, def: 70, spd: 58 }, ability: 'lure',
    learn: [[1, 'darkbite'], [1, 'luresnap'], [1, 'paralywave'], [8, 'abyssmaw'], [12, 'energydrain'], [16, 'conduct'], [20, 'flash']], desc: '從深海浮上來的海怪，頭上的燈會引誘獵物。' },
  { id: 'dragon', name: '蒼鱗龍', family: 'dragon', stage: 3, rarity: 'SSR', category: '龍', elems: ['water'], sprite: 'dragon', pal: 'dragon',
    base: { hp: 92, atk: 100, def: 82, spd: 95 }, ability: 'oceanpower', extra: ['dragonpresence', 'waterbarrier'], no: 1001, height: 12.5, weight: 860,
    learn: [[1, 'seagodbreath'], [1, 'waterspout'], [1, 'dragonpulse'], [1, 'aurorawing'], [22, 'hightide'], [26, 'azuretide']], desc: '傳說中守護淺灘的龍。一生只會現身一次。' },
  { id: 'thunderfang', name: '霆牙', family: 'thunderfang', stage: 3, rarity: 'SSR', category: '巨獸', elems: ['elec', 'water'], sprite: 'thunderfang', pal: 'thunder',
    base: { hp: 90, atk: 108, def: 78, spd: 104 }, ability: 'stormking',
    learn: [[1, 'zap'], [1, 'tidewave'], [1, 'stormfang'], [1, 'roar'], [22, 'thunderstorm'], [25, 'conduct']], desc: '雷雨夜踏浪而來的獸王。閃電角每閃一次，海面就會落下一道雷。' },
  { id: 'chubby1', name: '小肥源', family: 'chubby', stage: 1, rarity: 'SSR', category: '巨獸', elems: ['water', 'rock'], sprite: 'chubby1', pal: 'capy',
    base: { hp: 95, atk: 80, def: 90, spd: 30 }, ability: 'thickfat', extra: ['waterveil'], no: 301, height: 0.4, weight: 6.5,
    learn: [[1, 'microquake'], [1, 'wobble'], [1, 'rollout'], [1, 'tackle'], [4, 'microtoxin']], evolve: [{ to: 'chubby2', level: 12 }],
    desc: '雖然體型很小，卻擁有驚人的破壞力。一個抖動就能讓地面顫動。' },
  { id: 'chubby2', name: '巨肥源', family: 'chubby', stage: 3, rarity: 'SSR', category: '巨獸', elems: ['water', 'rock'], sprite: 'chubby2', pal: 'capy',
    base: { hp: 140, atk: 115, def: 120, spd: 35 }, ability: 'thickfat', extra: ['poisonbody'], no: 302,
    learn: [[12, 'bodyslam'], [12, 'deepsleep'], [14, 'bigquake'], [16, 'stunslam'], [18, 'megatoxin'], [20, 'reefspikes']],
    desc: '體型變得異常巨大，只要一跺腳就能引發地震，是整片海灘的霸主。' },
  // ── 冰封峽灣 ──
  { id: 'iceshrimp', name: '冰晶蝦', family: 'iceshrimp', stage: 1, rarity: 'N', category: '甲殼', elems: ['ice'], sprite: 'iceshrimp', pal: 'ice',
    base: { hp: 46, atk: 52, def: 56, spd: 50 }, ability: 'hardshell',
    learn: [[1, 'icepebble'], [1, 'hail'], [10, 'iceshard'], [14, 'frostfang']], evolve: [{ to: 'iceshrimp2', level: 18 }], desc: '殼像冰晶一樣透明，在冰縫裡成群生活。' },
  { id: 'iceshrimp2', name: '冰甲蝦', family: 'iceshrimp', stage: 2, rarity: 'N', category: '甲殼', elems: ['ice', 'rock'], sprite: 'iceshrimp2', pal: 'ice',
    base: { hp: 64, atk: 74, def: 82, spd: 56 }, ability: 'hardshell', learn: [[18, 'rockslide'], [20, 'icebeam'], [22, 'frostcrack']], desc: '冰晶殼長成了厚重的鎧甲，雙鉗能夾碎冰山。' },
  { id: 'snowgull', name: '雪羽鷗', family: 'snowgull', stage: 2, rarity: 'B', category: '水鳥', elems: ['ice', 'fly'], sprite: 'snowgull', pal: 'snow',
    base: { hp: 60, atk: 70, def: 54, spd: 86 }, ability: 'firststrike',
    learn: [[1, 'peck'], [1, 'icepebble'], [12, 'gust'], [14, 'tailwind'], [16, 'featherblade'], [20, 'frostfang']], desc: '羽毛像新雪一樣白，暴風雪中也能精準捕魚。' },
  { id: 'icegolem', name: '冰核石偶', family: 'icegolem', stage: 2, rarity: 'A', category: '礦物', elems: ['ice', 'rock'], sprite: 'icegolem', pal: 'glacier',
    base: { hp: 72, atk: 78, def: 96, spd: 30 }, ability: 'sturdy',
    learn: [[1, 'pebble'], [1, 'icepebble'], [12, 'harden'], [14, 'reefspikes'], [16, 'rockslide'], [20, 'icebeam']], desc: '萬年冰核外包著岩石的生命。不會進化，但聽說會在某天「覺醒」。' },
  { id: 'walrus', name: '霜牙海象', family: 'walrus', stage: 3, rarity: 'S', category: '巨獸', elems: ['ice', 'water'], sprite: 'walrus', pal: 'walrus',
    base: { hp: 96, atk: 98, def: 84, spd: 48 }, ability: 'thickfat',
    learn: [[1, 'frostfang'], [1, 'tidewave'], [1, 'roar'], [16, 'icebeam'], [19, 'frostcrack'], [22, 'recklessram']], desc: '冰海的戰士，一對冰牙能鑿穿冰層。' },
  { id: 'aurorawhale', name: '極光鯨', family: 'aurorawhale', stage: 3, rarity: 'SSR', category: '神獸', elems: ['ice', 'fly'], sprite: 'aurorawhale', pal: 'aurora',
    base: { hp: 110, atk: 92, def: 88, spd: 82 }, ability: 'waterbarrier', extra: ['dragonpresence'],
    learn: [[1, 'aurorabeam'], [1, 'icebeam'], [1, 'gust'], [1, 'surge'], [22, 'auroraveil']], desc: '只在極光之夜浮出海面的神鯨，身上流動著七彩的光。' },
  { id: 'frostking', name: '冰冠海豹王', family: 'frostking', stage: 3, rarity: 'A', category: '巨獸', elems: ['ice', 'water'], sprite: 'frostking', pal: 'seal',
    base: { hp: 112, atk: 90, def: 86, spd: 58 }, ability: 'colossal',
    learn: [[1, 'frostfang'], [1, 'frostcrack'], [1, 'hail'], [1, 'tidewave'], [1, 'icebeam'], [1, 'auroraveil']], desc: '冰封峽灣的霸主，頭戴萬年不化的冰冠的巨型海豹。' },
  // ── 熔岩裂谷 ──
  { id: 'lavasnail', name: '火山蝸', family: 'lavasnail', stage: 1, rarity: 'N', category: '礦物', elems: ['fire', 'rock'], sprite: 'lavasnail', pal: 'magma',
    base: { hp: 52, atk: 46, def: 66, spd: 30 }, ability: 'sturdy',
    learn: [[1, 'ember'], [1, 'pebble'], [14, 'lavaflow']], evolve: [{ to: 'lavasnail2', level: 18 }], desc: '背著一座小火山慢慢爬，殼裡的岩漿永遠不會冷卻。' },
  { id: 'lavasnail2', name: '熔岩蝸', family: 'lavasnail', stage: 2, rarity: 'N', category: '礦物', elems: ['fire', 'rock'], sprite: 'lavasnail2', pal: 'magma',
    base: { hp: 72, atk: 70, def: 92, spd: 34 }, ability: 'sturdy', learn: [[18, 'rockslide'], [20, 'reefspikes'], [21, 'eruption']], desc: '殼上的火山會定時噴發，附近的海水都在沸騰。' },
  { id: 'magmaeel', name: '熔岩鰻', family: 'magmaeel', stage: 2, rarity: 'B', category: '魚類', elems: ['fire'], sprite: 'magmaeel', pal: 'lavaeel',
    base: { hp: 60, atk: 80, def: 54, spd: 82 }, ability: 'blazing',
    learn: [[1, 'ember'], [1, 'flamebite'], [14, 'lavaflow'], [16, 'scorch'], [18, 'heatup']], desc: '在岩漿縫隙間穿梭的鰻魚，身上的紋路像流動的熔岩。' },
  { id: 'obsidiancrab', name: '黑曜石蟹', family: 'obsidiancrab', stage: 2, rarity: 'A', category: '甲殼', elems: ['rock', 'fire'], sprite: 'obsidiancrab', pal: 'obsidian',
    base: { hp: 66, atk: 92, def: 98, spd: 44 }, ability: 'hardshell',
    learn: [[1, 'pebble'], [1, 'ember'], [12, 'obsidianedge'], [14, 'counterscale'], [16, 'harden'], [20, 'lavaflow']], desc: '冷卻的岩漿凝成了黑曜石外殼，鉗子鋒利得像玻璃刀。' },
  { id: 'cinderbone', name: '焦骨鰻', family: 'cinderbone', stage: 3, rarity: 'S', category: '骷髏', elems: ['fire', 'dark'], sprite: 'cinderbone', pal: 'cinder',
    base: { hp: 80, atk: 102, def: 70, spd: 76 }, ability: 'undying',
    learn: [[1, 'flamebite'], [1, 'soulsip'], [1, 'bonecurse'], [14, 'bonerend'], [16, 'eruption'], [18, 'bloodtide']], desc: '被熔岩燒成骨頭也不肯死去的鰻魚，眼窩裡燃著鬼火。' },
  { id: 'magmacore', name: '熔核巨獸', family: 'magmacore', stage: 3, rarity: 'SSR', category: '巨獸', elems: ['fire', 'rock'], sprite: 'magmacore', pal: 'magma',
    base: { hp: 112, atk: 112, def: 104, spd: 50 }, ability: 'colossal', extra: ['blazing'],
    learn: [[1, 'roar'], [1, 'lavaflow'], [1, 'obsidianedge'], [1, 'eruption'], [20, 'lavafloor'], [26, 'coreburst']], desc: '心臟是一顆熔岩核心的巨獸，傳說裂谷就是牠翻身時撕開的。' },
  { id: 'lavadragon', name: '熔岩海龍王', family: 'lavadragon', stage: 3, rarity: 'A', category: '龍', elems: ['fire', 'water'], sprite: 'lavadragon', pal: 'lavaeel',
    base: { hp: 100, atk: 82, def: 78, spd: 58 }, ability: 'colossal',
    learn: [[1, 'heatup'], [1, 'tidewave'], [1, 'lavaflow'], [1, 'eruption'], [1, 'lavafloor']], desc: '熔岩裂谷的霸主，在岩漿與海水的交界處沉睡。' },
  // ── 美術包新增角色（31 隻） ──
  { id: 'thunder_wyrmling', name: '雷靈幼龍', family: 'thunderline', stage: 1, rarity: 'S', category: '龍', elems: ['elec', 'fly'], sprite: 'thunder_wyrmling', pal: 'water',
    base: { hp: 62, atk: 70, def: 56, spd: 76 }, ability: 'static',
    learn: [[1, 'zap'], [1, 'gust'], [12, 'thunder']], evolve: [{ to: 'sky_thunder_dragon', level: 16 }], desc: '在雷雨中誕生的小龍，打噴嚏的時候會冒出電火花。' },
  { id: 'sky_thunder_dragon', name: '天雷蒼龍', family: 'thunderline', stage: 3, rarity: 'S', category: '龍', elems: ['elec', 'fly'], sprite: 'sky_thunder_dragon', pal: 'water',
    base: { hp: 88, atk: 108, def: 78, spd: 100 }, ability: 'stormking',
    learn: [[16, 'divebomb'], [17, 'roar'], [18, 'stormfang'], [20, 'thunderstorm'], [23, 'conduct'], [25, 'hurricane']], desc: '駕著雷雲巡視海面的蒼龍，翅膀一拍就是一道落雷。' },
  { id: 'tide_cell', name: '潮汐胞體', family: 'tideline', stage: 1, rarity: 'A', category: '抽象', elems: ['water', 'dark'], sprite: 'tide_cell', pal: 'water',
    base: { hp: 56, atk: 52, def: 58, spd: 54 }, ability: 'moist',
    learn: [[1, 'watergun'], [1, 'darkbite'], [10, 'surge'], [13, 'inkshot']], evolve: [{ to: 'deepsea_star_vortex', level: 16 }], desc: '隨著潮汐脈動的神秘胞體，裡面好像藏著一小片星空。' },
  { id: 'deepsea_star_vortex', name: '深海星渦', family: 'tideline', stage: 3, rarity: 'A', category: '抽象', elems: ['water', 'dark'], sprite: 'deepsea_star_vortex', pal: 'water',
    base: { hp: 90, atk: 92, def: 84, spd: 80 }, ability: 'oceanpower',
    learn: [[16, 'counterflow'], [16, 'soulsip'], [18, 'hightide'], [20, 'abyssmaw'], [22, 'whalecry']], desc: '在深海捲起星光漩渦的存在，據說漩渦的盡頭連著夜空。' },
  { id: 'snow_crystal_spirit', name: '雪晶靈', family: 'snowspirit', stage: 1, rarity: 'N', category: '抽象', elems: ['ice'], sprite: 'snow_crystal_spirit', pal: 'water',
    base: { hp: 48, atk: 44, def: 52, spd: 52 }, ability: 'regen',
    learn: [[1, 'icepebble'], [1, 'hail'], [12, 'iceshard'], [15, 'frostfang']], desc: '雪花聚在一起變成的小精靈，摸起來涼涼軟軟的。' },
  { id: 'frost_wing_core', name: '霜翼核', family: 'frostwing', stage: 2, rarity: 'B', category: '抽象', elems: ['ice', 'fly'], sprite: 'frost_wing_core', pal: 'water',
    base: { hp: 58, atk: 70, def: 56, spd: 84 }, ability: 'firststrike',
    learn: [[1, 'icepebble'], [1, 'gust'], [14, 'frostfang'], [16, 'tailwind'], [18, 'aurorabeam']], desc: '冰核長出了霜之翼，在冰峽之間飛得飛快。' },
  { id: 'ice_ink_beast', name: '冰墨獸', family: 'iceink', stage: 2, rarity: 'B', category: '巨獸', elems: ['ice', 'dark'], sprite: 'ice_ink_beast', pal: 'water',
    base: { hp: 66, atk: 76, def: 60, spd: 66 }, ability: 'thickfat',
    learn: [[1, 'darkbite'], [1, 'icepebble'], [12, 'inkshot'], [14, 'soulsip'], [16, 'rendclaw'], [18, 'icebeam']], desc: '會噴出冰冷墨汁的野獸，墨汁一碰到空氣就結成冰。' },
  { id: 'frost_crystal_fawn', name: '霜晶幼鹿', family: 'frostdeer', stage: 1, rarity: 'SSR', category: '神獸', elems: ['ice', 'grass'], sprite: 'frost_crystal_fawn', pal: 'water',
    base: { hp: 70, atk: 68, def: 68, spd: 72 }, ability: 'waterbarrier',
    learn: [[1, 'icepebble'], [1, 'leafblade'], [12, 'iceshard'], [16, 'frostfang']], evolve: [{ to: 'frost_qilin', level: 20 }], desc: '鹿角是透明冰晶的小鹿，走過的地方會開出霜花。' },
  { id: 'frost_qilin', name: '極霜麒麟', family: 'frostdeer', stage: 3, rarity: 'SSR', category: '神獸', elems: ['ice', 'grass'], sprite: 'frost_qilin', pal: 'water',
    base: { hp: 96, atk: 104, def: 92, spd: 96 }, ability: 'waterbarrier', extra: ['dragonpresence'],
    learn: [[20, 'aurorabeam'], [20, 'icebeam'], [22, 'frostcrack'], [24, 'thornburst'], [26, 'purify']], desc: '守護冰封峽灣的聖獸，祥雲般的寒氣讓萬物沉睡。' },
  { id: 'lava_bubble', name: '熔岩泡', family: 'lavabubble', stage: 1, rarity: 'N', category: '抽象', elems: ['fire'], sprite: 'lava_bubble', pal: 'water',
    base: { hp: 46, atk: 50, def: 44, spd: 56 }, ability: 'blazing',
    learn: [[1, 'ember'], [10, 'scorch'], [13, 'flamebite']], desc: '從岩漿裡冒出來的泡泡，有了意識之後就到處亂跳。' },
  { id: 'fire_rock_bug', name: '火岩蟲', family: 'firebug', stage: 1, rarity: 'N', category: '甲殼', elems: ['fire', 'rock'], sprite: 'fire_rock_bug', pal: 'water',
    base: { hp: 48, atk: 54, def: 60, spd: 42 }, ability: 'hardshell',
    learn: [[1, 'ember'], [1, 'pebble'], [10, 'sandtoss'], [14, 'lavaflow']], desc: '背著燒紅岩塊的小蟲，喜歡躲在熔岩縫裡取暖。' },
  { id: 'magma_core_rock', name: '熔核巨石', family: 'magmarock', stage: 2, rarity: 'B', category: '礦物', elems: ['rock', 'fire'], sprite: 'magma_core_rock', pal: 'water',
    base: { hp: 72, atk: 74, def: 90, spd: 34 }, ability: 'sturdy',
    learn: [[1, 'pebble'], [1, 'ember'], [14, 'rockslide'], [18, 'eruption'], [22, 'coreburst']], desc: '裡面裹著熔岩核心的巨石，平常一動也不動。' },
  { id: 'ember_chick', name: '炎羽雛鳳', family: 'phoenix', stage: 1, rarity: 'SSR', category: '神獸', elems: ['fire', 'fly'], sprite: 'ember_chick', pal: 'water',
    base: { hp: 66, atk: 74, def: 58, spd: 80 }, ability: 'blazing',
    learn: [[1, 'ember'], [1, 'peck'], [16, 'flamebite']], evolve: [{ to: 'cinder_phoenix', level: 20 }], desc: '羽毛是火焰做的雛鳥，生氣時全身會燒得更旺。' },
  { id: 'cinder_phoenix', name: '燼天凰', family: 'phoenix', stage: 3, rarity: 'SSR', category: '神獸', elems: ['fire', 'fly'], sprite: 'cinder_phoenix', pal: 'water',
    base: { hp: 92, atk: 110, def: 80, spd: 104 }, ability: 'blazing', extra: ['undying'],
    learn: [[20, 'featherblade'], [20, 'lavaflow'], [22, 'eruption'], [24, 'tailwind'], [26, 'flareblitz']], desc: '浴火重生的神鳥，傳說牠倒下的地方會長出新的火山。' },
  { id: 'sprout_orb', name: '芽靈球', family: 'sproutorb', stage: 1, rarity: 'N', category: '抽象', elems: ['grass'], sprite: 'sprout_orb', pal: 'water',
    base: { hp: 52, atk: 44, def: 54, spd: 48 }, ability: 'photosyn',
    learn: [[1, 'leafblade'], [1, 'vinebind'], [10, 'seedleech'], [12, 'photosynth']], desc: '聖林裡滾來滾去的嫩芽球，曬到太陽就會長出新葉。' },
  { id: 'mushroom_sprite', name: '傘菇妖', family: 'mushroom', stage: 2, rarity: 'B', category: '抽象', elems: ['grass', 'dark'], sprite: 'mushroom_sprite', pal: 'water',
    base: { hp: 62, atk: 66, def: 62, spd: 52 }, ability: 'stinger',
    learn: [[1, 'leafblade'], [1, 'sporecloud'], [12, 'venomstrike'], [15, 'opportunist'], [18, 'thornburst']], desc: '頂著毒傘的妖精，會在聖林的陰影裡惡作劇。' },
  { id: 'vine_antler_deer', name: '藤角鹿', family: 'vinedeer', stage: 3, rarity: 'A', category: '巨獸', elems: ['grass'], sprite: 'vine_antler_deer', pal: 'water',
    base: { hp: 84, atk: 90, def: 80, spd: 78 }, ability: 'regen',
    learn: [[1, 'leafblade'], [1, 'vinebind'], [1, 'photosynth'], [14, 'thornburst'], [16, 'sacredgrove']], desc: '聖林域的守護者，鹿角上纏繞的藤蔓會開出花。' },
  { id: 'shadow_soul_flame', name: '影魂火', family: 'soulflame', stage: 1, rarity: 'N', category: '抽象', elems: ['dark', 'fire'], sprite: 'shadow_soul_flame', pal: 'water',
    base: { hp: 46, atk: 56, def: 40, spd: 60 }, ability: 'undying',
    learn: [[1, 'darkbite'], [1, 'ember'], [9, 'scorch'], [12, 'bonecurse']], desc: '在無稽區飄蕩的鬼火，偶爾會模仿聽到的聲音。' },
  { id: 'rune_wraith', name: '纏符靈', family: 'runewraith', stage: 2, rarity: 'B', category: '抽象', elems: ['dark', 'data'], sprite: 'rune_wraith', pal: 'water',
    base: { hp: 60, atk: 72, def: 52, spd: 70 }, ability: 'static',
    learn: [[1, 'darkbite'], [1, 'glitchwave'], [12, 'crash'], [14, 'soulsip'], [18, 'datastorm']], desc: '身上纏滿看不懂的符文，符文一亮就會讓周圍的東西出錯。' },
  { id: 'vine_trace_spirit', name: '藤痕靈', family: 'vinetrace', stage: 2, rarity: 'B', category: '抽象', elems: ['dark', 'grass'], sprite: 'vine_trace_spirit', pal: 'water',
    base: { hp: 62, atk: 66, def: 60, spd: 64 }, ability: 'regen',
    learn: [[1, 'darkbite'], [1, 'vinebind'], [12, 'sporecloud'], [15, 'venomstrike'], [18, 'soulsip']], desc: '只剩下藤蔓痕跡的影子生物，摸不到也抓不住。' },
  { id: 'phantom_cub', name: '虛影幼獸', family: 'voidline', stage: 1, rarity: 'S', category: '巨獸', elems: ['dark'], sprite: 'phantom_cub', pal: 'water',
    base: { hp: 60, atk: 70, def: 56, spd: 74 }, ability: 'firststrike',
    learn: [[1, 'darkbite'], [8, 'shadowsneak'], [10, 'bonecurse']], evolve: [{ to: 'void_star_dragon', level: 16 }], desc: '半透明的小獸，眨眼間就會從視線裡消失。' },
  { id: 'void_star_dragon', name: '虛無星龍', family: 'voidline', stage: 3, rarity: 'S', category: '龍', elems: ['dark', 'fly'], sprite: 'void_star_dragon', pal: 'water',
    base: { hp: 90, atk: 106, def: 78, spd: 96 }, ability: 'lure', extra: ['dragonpresence'],
    learn: [[16, 'gust'], [16, 'abyssmaw'], [17, 'seafog'], [18, 'opportunist'], [20, 'datastorm']], desc: '無稽區的主宰，鱗片上倒映著不存在的星空。' },
  { id: 'cubelet', name: '立方子', family: 'cubelet', stage: 1, rarity: 'N', category: '機械', elems: ['data'], sprite: 'cubelet', pal: 'water',
    base: { hp: 46, atk: 48, def: 58, spd: 50 }, ability: 'sturdy',
    learn: [[1, 'bitshot'], [8, 'virus'], [12, 'firewall']], desc: '由小方塊組成的生命，會把自己拆開再重新拼起來。' },
  { id: 'orbit_construct', name: '環構機', family: 'orbit', stage: 2, rarity: 'B', category: '機械', elems: ['data', 'elec'], sprite: 'orbit_construct', pal: 'water',
    base: { hp: 60, atk: 68, def: 64, spd: 70 }, ability: 'static',
    learn: [[1, 'bitshot'], [1, 'zap'], [12, 'scanlock'], [14, 'glitchwave'], [18, 'thunder']], desc: '核心周圍有圓環不停旋轉的構造體，轉得越快力量越強。' },
  { id: 'polyhedral_sentinel', name: '多面傀', family: 'polyhedral', stage: 2, rarity: 'A', category: '機械', elems: ['data', 'rock'], sprite: 'polyhedral_sentinel', pal: 'water',
    base: { hp: 70, atk: 80, def: 88, spd: 52 }, ability: 'hardshell',
    learn: [[1, 'bitshot'], [1, 'pebble'], [12, 'reefspikes'], [14, 'firewall'], [18, 'rockslide'], [22, 'selfdestruct']], desc: '由多面體組成的守衛，會擋在域核的入口不讓人通過。' },
  { id: 'domain_coreling', name: '域核幼體', family: 'domaincore', stage: 1, rarity: 'S', category: '抽象', elems: ['data'], sprite: 'domain_coreling', pal: 'water',
    base: { hp: 58, atk: 66, def: 62, spd: 70 }, ability: 'static',
    learn: [[1, 'bitshot'], [1, 'glitchwave'], [6, 'focus'], [10, 'scanlock'], [14, 'datastorm']], evolve: [{ to: 'domain_realm_core', level: 16 }], desc: '剛剛誕生的域核，發出閃爍的光芒。' },
  { id: 'domain_realm_core', name: '域界核心', family: 'domaincore', stage: 3, rarity: 'S', category: '抽象', elems: ['data'], sprite: 'domain_realm_core', pal: 'water',
    base: { hp: 92, atk: 100, def: 90, spd: 86 }, ability: 'waterbarrier',
    learn: [[16, 'datagrid'], [16, 'datastorm'], [18, 'crash'], [20, 'firewall'], [22, 'focus']], desc: '支撐整個域核區域的核心，環繞著它的光帶就是區域的邊界。' },
  { id: 'cube_coreling', name: '方核幼體', family: 'cubecore', stage: 1, rarity: 'A', category: '機械', elems: ['data', 'water'], sprite: 'cube_coreling', pal: 'water',
    base: { hp: 56, atk: 60, def: 66, spd: 58 }, ability: 'hardshell',
    learn: [[1, 'bitshot'], [1, 'watergun'], [12, 'firewall']], evolve: [{ to: 'matrix_domain_core', level: 16 }], desc: '被水晶環包住的小方核，會把海水轉換成資料。' },
  { id: 'matrix_domain_core', name: '矩陣域核', family: 'cubecore', stage: 3, rarity: 'A', category: '機械', elems: ['data', 'water'], sprite: 'matrix_domain_core', pal: 'water',
    base: { hp: 86, atk: 94, def: 96, spd: 72 }, ability: 'hardshell',
    learn: [[16, 'tidewave'], [16, 'datastorm'], [18, 'scanlock'], [20, 'crabcannon']], desc: '無數方核排成矩陣的巨大存在，運算著海流的方向。' },
  { id: 'chaos_zygote', name: '混沌胚核', family: 'chaosline', stage: 1, rarity: 'SSR', category: '抽象', elems: ['data', 'dark'], sprite: 'chaos_zygote', pal: 'water',
    base: { hp: 68, atk: 76, def: 62, spd: 74 }, ability: 'lure',
    learn: [[1, 'bitshot'], [1, 'darkbite'], [10, 'virus'], [14, 'glitchwave']], evolve: [{ to: 'chaos_eye_realm', level: 18 }], desc: '混沌之中凝聚成形的胚核，裡面的眼睛一直在看著你。' },
  { id: 'chaos_eye_realm', name: '渾沌瞳域', family: 'chaosline', stage: 3, rarity: 'SSR', category: '抽象', elems: ['data', 'dark'], sprite: 'chaos_eye_realm', pal: 'water',
    base: { hp: 98, atk: 112, def: 86, spd: 96 }, ability: 'lure', extra: ['dragonpresence'],
    learn: [[18, 'abyssmaw'], [18, 'datastorm'], [20, 'crash'], [22, 'datagrid'], [24, 'opportunist']], desc: '被這隻眼睛注視的地方，現實就會開始崩解。' },
  // ── 霸主 ──
  { id: 'whale', name: '鯨嘯', family: 'whale', stage: 3, rarity: 'A', category: '巨獸', elems: ['water'], sprite: 'whale', pal: 'whale',
    base: { hp: 110, atk: 74, def: 70, spd: 46 }, ability: 'colossal',
    learn: [[1, 'surge'], [1, 'hightide'], [1, 'bubblebarrage'], [1, 'tidewave'], [1, 'whalecry']], desc: '淺灘的霸主。一聲長嘯就能掀起巨浪。' },
];

export const FORMS: Record<string, Form> = Object.fromEntries(F.map((f) => [f.id, f]));
export const STARTERS = ['water1', 'fire1', 'grass1'];

// 淺灘出現的野生生物（以家族的第一個形態表示）
export const ICE_POOL = ['snow_crystal_spirit', 'frost_wing_core', 'ice_ink_beast', 'frost_crystal_fawn', 'iceshrimp', 'snowgull', 'icegolem', 'walrus', 'aurorawhale', 'jelly1', 'zaploach', 'starsand', 'thunderfang', 'chubby1'];
export const LAVA_POOL = ['lava_bubble', 'fire_rock_bug', 'magma_core_rock', 'ember_chick', 'lavasnail', 'magmaeel', 'obsidiancrab', 'cinderbone', 'magmacore', 'bonebream', 'starsand', 'bubcrab', 'dragon', 'chubby1'];
export const FOREST_POOL = ['sprout_orb', 'mushroom_sprite', 'vine_antler_deer', 'coral', 'grass1', 'frost_crystal_fawn'];
export const VOID_POOL = ['shadow_soul_flame', 'rune_wraith', 'vine_trace_spirit', 'phantom_cub', 'bonebream', 'cinderbone', 'chaos_zygote'];
export const CORE_POOL = ['cubelet', 'orbit_construct', 'polyhedral_sentinel', 'domain_coreling', 'cube_coreling', 'chaos_zygote', 'zaploach'];
export const ZONE1_POOL = ['bubcrab', 'starsand', 'zaploach', 'jelly1', 'gull1', 'coral', 'bonebream', 'angler', 'dragon', 'thunderfang', 'chubby1', 'thunder_wyrmling', 'tide_cell'];
export const ZONE1_BOSS = 'whale';
