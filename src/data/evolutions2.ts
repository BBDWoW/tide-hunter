// 第二波進化：原本不會進化的幼體、成長體，補上下一個形態。
// 美術還沒畫好之前，先沿用前一階的圖，放大一點、顏色更深更飽和（placeholder: true 的都需要新圖）。
import type { Elem } from './types';

export interface Evo2 {
  from: string; id: string; name: string; level: number; stage: 2 | 3; mult: number;
  elems?: Elem[]; learn: [number, string][]; desc: string;
  look: { h: number; s: number; l: number }; scale: number;
}

export const EVO2: Evo2[] = [
  // ── 碧藍淺灘／聖林域 ──
  { from: 'coral', id: 'coral_queen', name: '珊瑚女王', level: 14, stage: 3, mult: 1.2, learn: [[14, 'thornburst'], [16, 'tidewave'], [18, 'sacredgrove']], desc: '整片珊瑚礁的意識都聚集到她身上，頭頂的珊瑚冠會隨著潮汐開花。', look: { h: -12, s: 1.3, l: -0.04 }, scale: 1.15 },
  // ── 冰封峽灣 ──
  { from: 'snowgull', id: 'frost_hawk', name: '霜翼鷹', level: 19, stage: 3, mult: 1.18, learn: [[19, 'divebomb'], [21, 'icebeam'], [24, 'hurricane']], desc: '在暴風雪裡也能看清獵物的猛禽，俯衝時翅膀會甩出一串冰晶。', look: { h: 14, s: 1.25, l: -0.06 }, scale: 1.15 },
  { from: 'icegolem', id: 'glacier_colossus', name: '冰核巨像', level: 19, stage: 3, mult: 1.18, learn: [[19, 'frostcrack'], [21, 'bigquake'], [24, 'auroraveil']], desc: '傳說中「覺醒」的冰核石偶。萬年冰核終於甦醒，一步就能讓整片冰原裂開。', look: { h: 18, s: 1.35, l: -0.05 }, scale: 1.2 },
  { from: 'snow_crystal_spirit', id: 'ice_crystal_fairy', name: '冰晶仙靈', level: 15, stage: 3, mult: 1.4, learn: [[15, 'frostcrack'], [17, 'aurorabeam'], [20, 'auroraveil']], desc: '雪晶靈在極光下長大的樣子，身上的冰晶會折射出七種顏色。', look: { h: 20, s: 1.4, l: -0.04 }, scale: 1.2 },
  { from: 'frost_wing_core', id: 'aurora_wing_core', name: '極光翼核', level: 19, stage: 3, mult: 1.18, learn: [[19, 'featherblade'], [21, 'icebeam'], [24, 'hurricane']], desc: '核心吸飽了極光，翅膀展開時整片天空都會亮起來。', look: { h: 40, s: 1.3, l: -0.03 }, scale: 1.15 },
  { from: 'ice_ink_beast', id: 'ink_frost_fiend', name: '墨冰魔獸', level: 19, stage: 3, mult: 1.18, learn: [[19, 'frostcrack'], [21, 'bloodtide'], [24, 'abyssmaw']], desc: '吐出的墨會在空中結冰，變成黑色的冰刺雨。', look: { h: -20, s: 1.3, l: -0.08 }, scale: 1.15 },
  // ── 熔岩裂谷 ──
  { from: 'magmaeel', id: 'magma_serpent', name: '熔獄海蛟', level: 19, stage: 3, mult: 1.18, learn: [[19, 'blaze'], [21, 'eruption'], [24, 'flareblitz']], desc: '熔岩鰻在火山口裡游了一百年，長出了角和鬃毛。', look: { h: -10, s: 1.3, l: -0.06 }, scale: 1.2 },
  { from: 'obsidiancrab', id: 'obsidian_fortress', name: '黑曜要塞蟹', level: 19, stage: 3, mult: 1.18, learn: [[19, 'rockslide'], [21, 'blaze'], [24, 'bigquake']], desc: '殼長成了一座小城堡，裂縫裡流著岩漿。', look: { h: -8, s: 1.3, l: -0.06 }, scale: 1.2 },
  { from: 'lava_bubble', id: 'lava_blob', name: '熔漿巨泡', level: 15, stage: 3, mult: 1.4, learn: [[15, 'lavaflow'], [17, 'heatup'], [20, 'blaze']], desc: '熔岩泡吞了太多岩漿，變成一顆會滾動的小火山。', look: { h: -14, s: 1.3, l: -0.06 }, scale: 1.25 },
  { from: 'fire_rock_bug', id: 'magma_beetle', name: '熔岩甲蟲', level: 15, stage: 3, mult: 1.4, learn: [[15, 'obsidianedge'], [17, 'rockslide'], [20, 'flamebite']], desc: '背上的岩塊熔成了發亮的甲殼，飛起來像一顆流星。', look: { h: -10, s: 1.3, l: -0.05 }, scale: 1.25 },
  { from: 'magma_core_rock', id: 'magma_mountain', name: '熔核山岳', level: 20, stage: 3, mult: 1.18, learn: [[20, 'bigquake'], [22, 'blaze'], [25, 'lavafloor']], desc: '熔核巨石長成了一座會走路的火山。', look: { h: -12, s: 1.3, l: -0.06 }, scale: 1.2 },
  // ── 聖林域 ──
  { from: 'sprout_orb', id: 'forest_orb', name: '森靈球', level: 14, stage: 3, mult: 1.4, learn: [[14, 'venomstrike'], [16, 'thornburst'], [19, 'sacredgrove']], desc: '芽靈球長出了一整片小森林，所到之處都會冒出新芽。', look: { h: -14, s: 1.3, l: -0.05 }, scale: 1.25 },
  { from: 'mushroom_sprite', id: 'mushroom_king', name: '傘菇王', level: 18, stage: 3, mult: 1.18, learn: [[18, 'soulsip'], [20, 'thornburst'], [23, 'megatoxin']], desc: '森林深處的菇類都聽牠指揮，一揮傘就是滿天孢子。', look: { h: 16, s: 1.3, l: -0.06 }, scale: 1.2 },
  // ── 無稽區 ──
  { from: 'shadow_soul_flame', id: 'nether_soul_flame', name: '冥魂焰', level: 14, stage: 3, mult: 1.4, learn: [[14, 'flamebite'], [16, 'soulsip'], [19, 'bloodtide']], desc: '影魂火燒盡了迷途的靈魂，火焰變成了深紫色。', look: { h: 22, s: 1.35, l: -0.05 }, scale: 1.25 },
  { from: 'rune_wraith', id: 'rune_lord', name: '符咒冥王', level: 18, stage: 3, mult: 1.18, learn: [[18, 'bloodtide'], [21, 'reboot'], [24, 'abyssmaw']], desc: '纏在身上的符咒變成了冠冕，一開口就會改寫周圍的規則。', look: { h: 18, s: 1.3, l: -0.07 }, scale: 1.2 },
  { from: 'vine_trace_spirit', id: 'thorn_wraith', name: '荊冥樹靈', level: 18, stage: 3, mult: 1.18, learn: [[18, 'thornburst'], [20, 'bloodtide'], [23, 'engulf']], desc: '藤蔓的痕跡長成了一棵會移動的黑色荊棘樹。', look: { h: -16, s: 1.3, l: -0.07 }, scale: 1.2 },
  // ── 域核區域／電子海域 ──
  { from: 'cubelet', id: 'cube_array', name: '方陣核體', level: 14, stage: 3, mult: 1.4, learn: [[14, 'crash'], [16, 'datagrid'], [19, 'datastorm']], desc: '無數個立方子拼成的方陣，會自己重新排列成最強的形狀。', look: { h: 24, s: 1.3, l: -0.05 }, scale: 1.25 },
  { from: 'orbit_construct', id: 'orbit_titan', name: '星環機神', level: 19, stage: 3, mult: 1.18, learn: [[19, 'conduct'], [21, 'datastorm'], [24, 'stormfang']], desc: '外環增加到三圈，轉起來會發出低沉的嗡嗡聲。', look: { h: 20, s: 1.3, l: -0.05 }, scale: 1.2 },
  { from: 'polyhedral_sentinel', id: 'polyhedral_fortress', name: '多面堡壘', level: 20, stage: 3, mult: 1.18, learn: [[20, 'bigquake'], [22, 'reboot'], [25, 'datastorm']], desc: '每一面都是一道防火牆，連資料風暴都穿不透。', look: { h: -18, s: 1.3, l: -0.06 }, scale: 1.2 },
  { from: 'cablesnake', id: 'cable_wyrm', name: '高壓纜龍', level: 24, stage: 3, mult: 1.18, learn: [[24, 'stormfang'], [26, 'datastorm'], [28, 'thunderstorm']], desc: '海底電纜的主幹化成的巨龍，全身流著上萬伏特的電。', look: { h: 16, s: 1.3, l: -0.06 }, scale: 1.2 },
  { from: 'dronegull', id: 'battle_dronegull', name: '戰鬥鷗機', level: 24, stage: 3, mult: 1.18, learn: [[24, 'featherblade'], [26, 'crash'], [28, 'datastorm']], desc: '巡檢鷗機加裝了武裝模組，翅膀變成了兩片刀翼。', look: { h: -20, s: 1.3, l: -0.06 }, scale: 1.2 },
  { from: 'virus_jelly', id: 'virus_mother', name: '病毒母體', level: 24, stage: 3, mult: 1.18, learn: [[24, 'datastorm'], [26, 'megatoxin'], [28, 'engulf']], desc: '所有病毒水母的源頭，觸手一碰就能讓整台主機癱瘓。', look: { h: 20, s: 1.3, l: -0.07 }, scale: 1.2 },
  // ── 深淵 ──
  { from: 'abyss_wisp', id: 'abyss_frost_spirit', name: '淵冰靈王', level: 21, stage: 3, mult: 1.4, learn: [[21, 'soulsip'], [23, 'icebeam'], [26, 'abyssveil']], desc: '淵火靈沉到最深處，火焰結成了不會融化的黑冰。', look: { h: -18, s: 1.3, l: -0.06 }, scale: 1.25 },
  { from: 'bonecrab', id: 'bone_castle_crab', name: '骸骨城蟹', level: 24, stage: 3, mult: 1.18, learn: [[24, 'bigquake'], [26, 'engulf'], [28, 'counterscale']], desc: '背著一整座巨獸的頭骨當殼，裡面住著好幾隻小魚。', look: { h: -10, s: 1.3, l: -0.07 }, scale: 1.2 },
  { from: 'ghost_squid', id: 'ghost_kraken', name: '幽光巨魷', level: 24, stage: 3, mult: 1.18, learn: [[24, 'thunder'], [26, 'abyssmaw'], [28, 'stormfang']], desc: '深淵裡最大的烏賊，發光的觸手可以照亮整條海溝。', look: { h: 18, s: 1.3, l: -0.07 }, scale: 1.25 },
  { from: 'drowned_bell', id: 'drowned_bell_lord', name: '沉鐘冥主', level: 25, stage: 3, mult: 1.15, learn: [[25, 'icebeam'], [27, 'engulf'], [29, 'abyssveil']], desc: '沉鐘響起第一百聲時甦醒的冥主，鐘聲能讓海水結凍。', look: { h: -16, s: 1.3, l: -0.07 }, scale: 1.2 },
];
