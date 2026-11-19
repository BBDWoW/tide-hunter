// 技能資料。cost = 能量消耗（每回合 +1，上限 5，戰鬥開始時有 2 點）
import type { Elem } from './types';

export type StatusId = 'burn' | 'para' | 'poison' | 'freeze' | 'glitch' | 'sleep';
export type StatKey = 'atk' | 'def' | 'spd';

export interface SkillEffect {
  status?: { id: StatusId; chance: number; self?: boolean };
  stat?: { key: StatKey; delta: number; self: boolean; chance?: number };
  heal?: number; // 回復自身最大 HP 的比例
  drain?: number; // 造成傷害的比例轉為回復
  shield?: number; // 護盾：自身最大 HP 的比例
  priority?: number;
  multi?: [number, number]; // 連擊次數範圍
  energy?: number; // 額外獲得能量
  selfSleep?: number; // 使用後自己睡著幾回合（睡著時防禦 +1）
}

export interface Skill {
  id: string;
  name: string;
  elem: Elem | null; // null = 無屬性
  power: number; // 0 = 變化技
  cost: number;
  acc: number; // 命中 0–100
  desc: string;
  fx?: SkillEffect;
  anim?: 'hit' | 'beam' | 'splash' | 'buff' | 'heal';
}

const S: Skill[] = [
  // 無屬性
  { id: 'tackle', name: '撞擊', elem: null, power: 40, cost: 0, acc: 100, desc: '用身體撞向對手。', anim: 'hit' },
  { id: 'harden', name: '硬化', elem: null, power: 0, cost: 1, acc: 100, desc: '提高自己的防禦。', fx: { stat: { key: 'def', delta: 1, self: true } }, anim: 'buff' },
  { id: 'roar', name: '咆哮', elem: null, power: 0, cost: 1, acc: 100, desc: '提高自己的攻擊。', fx: { stat: { key: 'atk', delta: 1, self: true } }, anim: 'buff' },
  { id: 'focus', name: '凝神', elem: null, power: 0, cost: 0, acc: 100, desc: '額外獲得 2 點能量。', fx: { energy: 2 }, anim: 'buff' },
  { id: 'bubbleguard', name: '泡沫護盾', elem: null, power: 0, cost: 1, acc: 100, desc: '產生最大 HP 25% 的護盾。', fx: { shield: 0.25 }, anim: 'buff' },
  // 水
  { id: 'watergun', name: '水槍', elem: 'water', power: 40, cost: 0, acc: 100, desc: '射出水彈攻擊。', anim: 'splash' },
  { id: 'bubble', name: '泡沫', elem: 'water', power: 40, cost: 1, acc: 100, desc: '吐出大量泡沫，30% 降低對手速度。', fx: { stat: { key: 'spd', delta: -1, self: false, chance: 0.3 } }, anim: 'splash' },
  { id: 'waterpulse', name: '水之波動', elem: 'water', power: 60, cost: 2, acc: 100, desc: '用水的波動攻擊，20% 降低對手攻擊。', fx: { stat: { key: 'atk', delta: -1, self: false, chance: 0.2 } }, anim: 'beam' },
  { id: 'tidewave', name: '浪擊', elem: 'water', power: 75, cost: 2, acc: 95, desc: '掀起海浪衝擊對手。', anim: 'splash' },
  { id: 'surge', name: '潮湧', elem: 'water', power: 0, cost: 2, acc: 100, desc: '回復最大 HP 的 35%。', fx: { heal: 0.35 }, anim: 'heal' },
  { id: 'bubblebarrage', name: '泡泡連射', elem: 'water', power: 22, cost: 1, acc: 95, desc: '連續攻擊 2–4 次。', fx: { multi: [2, 4] }, anim: 'splash' },
  { id: 'whalecry', name: '鯨嘯', elem: 'water', power: 95, cost: 3, acc: 90, desc: '巨大的聲波，30% 使對手麻痺。', fx: { status: { id: 'para', chance: 0.3 } }, anim: 'beam' },
  // 火
  { id: 'ember', name: '火花', elem: 'fire', power: 40, cost: 0, acc: 100, desc: '10% 使對手灼傷。', fx: { status: { id: 'burn', chance: 0.1 } }, anim: 'hit' },
  { id: 'flamebite', name: '灼熱咬', elem: 'fire', power: 70, cost: 2, acc: 95, desc: '30% 使對手灼傷。', fx: { status: { id: 'burn', chance: 0.3 } }, anim: 'hit' },
  { id: 'blaze', name: '爆炎', elem: 'fire', power: 100, cost: 3, acc: 85, desc: '猛烈的爆炸火焰。', anim: 'beam' },
  { id: 'heatup', name: '升溫', elem: 'fire', power: 0, cost: 1, acc: 100, desc: '攻擊大幅提高。', fx: { stat: { key: 'atk', delta: 2, self: true } }, anim: 'buff' },
  // 草
  { id: 'leafblade', name: '葉刃', elem: 'grass', power: 40, cost: 0, acc: 100, desc: '用葉片切割對手。', anim: 'hit' },
  { id: 'vinebind', name: '纏藤', elem: 'grass', power: 35, cost: 1, acc: 100, desc: '降低對手速度。', fx: { stat: { key: 'spd', delta: -1, self: false } }, anim: 'hit' },
  { id: 'photosynth', name: '光合作用', elem: 'grass', power: 0, cost: 2, acc: 100, desc: '回復最大 HP 的 40%。', fx: { heal: 0.4 }, anim: 'heal' },
  { id: 'thornburst', name: '棘刺爆', elem: 'grass', power: 85, cost: 3, acc: 95, desc: '20% 使對手中毒。', fx: { status: { id: 'poison', chance: 0.2 } }, anim: 'beam' },
  { id: 'sporecloud', name: '孢子雲', elem: 'grass', power: 0, cost: 1, acc: 85, desc: '使對手中毒。', fx: { status: { id: 'poison', chance: 1 } }, anim: 'splash' },
  // 電
  { id: 'zap', name: '電擊', elem: 'elec', power: 40, cost: 0, acc: 100, desc: '10% 使對手麻痺。', fx: { status: { id: 'para', chance: 0.1 } }, anim: 'beam' },
  { id: 'paralywave', name: '麻痺波', elem: 'elec', power: 0, cost: 1, acc: 90, desc: '使對手麻痺。', fx: { status: { id: 'para', chance: 1 } }, anim: 'beam' },
  { id: 'thunder', name: '雷霆', elem: 'elec', power: 95, cost: 3, acc: 85, desc: '20% 使對手麻痺。', fx: { status: { id: 'para', chance: 0.2 } }, anim: 'beam' },
  { id: 'luresnap', name: '誘光咬', elem: 'elec', power: 70, cost: 2, acc: 100, desc: '用發光誘餌引誘後咬擊，必定命中。', anim: 'hit' },
  // 飛
  { id: 'peck', name: '啄擊', elem: 'fly', power: 40, cost: 0, acc: 100, desc: '用嘴啄擊對手。', anim: 'hit' },
  { id: 'gust', name: '疾風', elem: 'fly', power: 50, cost: 1, acc: 100, desc: '先制攻擊。', fx: { priority: 1 }, anim: 'splash' },
  { id: 'divebomb', name: '俯衝', elem: 'fly', power: 85, cost: 2, acc: 90, desc: '從高空俯衝撞擊。', anim: 'hit' },
  // 岩
  { id: 'pebble', name: '碎石', elem: 'rock', power: 40, cost: 0, acc: 100, desc: '丟出碎石。', anim: 'hit' },
  { id: 'rockslide', name: '岩崩', elem: 'rock', power: 80, cost: 2, acc: 90, desc: '降下大量岩石。', anim: 'hit' },
  { id: 'starshard', name: '星砂彈', elem: 'rock', power: 30, cost: 1, acc: 100, desc: '30% 降低對手速度。', fx: { stat: { key: 'spd', delta: -1, self: false, chance: 0.3 } }, anim: 'splash' },
  // 冰
  { id: 'icepebble', name: '冰礫', elem: 'ice', power: 40, cost: 0, acc: 100, desc: '10% 使對手冰凍。', fx: { status: { id: 'freeze', chance: 0.1 } }, anim: 'hit' },
  // 暗
  { id: 'darkbite', name: '暗咬', elem: 'dark', power: 45, cost: 0, acc: 100, desc: '從陰影中咬擊。', anim: 'hit' },
  { id: 'bonecurse', name: '骨咒', elem: 'dark', power: 0, cost: 1, acc: 90, desc: '使對手中毒並降低攻擊。', fx: { status: { id: 'poison', chance: 1 }, stat: { key: 'atk', delta: -1, self: false } }, anim: 'beam' },
  { id: 'soulsip', name: '吸魂', elem: 'dark', power: 60, cost: 2, acc: 100, desc: '回復造成傷害的 50%。', fx: { drain: 0.5 }, anim: 'beam' },
  { id: 'abyssmaw', name: '深淵巨口', elem: 'dark', power: 90, cost: 3, acc: 90, desc: '吞噬一切的大口。', anim: 'hit' },
  // 專屬
  { id: 'azuretide', name: '蒼龍潮嘯', elem: 'water', power: 110, cost: 3, acc: 95, desc: '傳說之龍的潮嘯，回復造成傷害的 30%。', fx: { drain: 0.3 }, anim: 'beam' },
  { id: 'seagodbreath', name: '海神之息', elem: 'water', power: 90, cost: 2, acc: 100, desc: '吐出海神的氣息，回復造成傷害的 30%。', fx: { drain: 0.3 }, anim: 'beam' },
  { id: 'waterspout', name: '水龍捲', elem: 'water', power: 30, cost: 2, acc: 95, desc: '捲起水龍捲連續攻擊 2–4 次。', fx: { multi: [2, 4] }, anim: 'splash' },
  { id: 'dragonpulse', name: '龍之波動', elem: null, power: 90, cost: 2, acc: 95, desc: '龍的威壓化為衝擊波，20% 降低對手防禦。', fx: { stat: { key: 'def', delta: -1, self: false, chance: 0.2 } }, anim: 'beam' },
  { id: 'aurorawing', name: '極光之翼', elem: null, power: 0, cost: 2, acc: 100, desc: '展開極光羽翼：獲得 20% 護盾並提高速度。', fx: { shield: 0.2, stat: { key: 'spd', delta: 1, self: true } }, anim: 'buff' },
  { id: 'microquake', name: '微型地震', elem: 'rock', power: 45, cost: 1, acc: 100, desc: '小小的身體引發地面顫動。', anim: 'hit' },
  { id: 'wobble', name: '抖動', elem: 'water', power: 35, cost: 0, acc: 100, desc: '全身抖動甩出水花，20% 降低對手速度。', fx: { stat: { key: 'spd', delta: -1, self: false, chance: 0.2 } }, anim: 'splash' },
  { id: 'rollout', name: '翻滾', elem: 'rock', power: 25, cost: 1, acc: 90, desc: '縮成球滾過去，連續攻擊 2–3 次。', fx: { multi: [2, 3] }, anim: 'hit' },
  { id: 'microtoxin', name: '微型毒素', elem: null, power: 0, cost: 1, acc: 90, desc: '使對手中毒。', fx: { status: { id: 'poison', chance: 1 } }, anim: 'splash' },
  { id: 'bodyslam', name: '泰山壓頂', elem: null, power: 85, cost: 2, acc: 100, desc: '用巨大的身體壓上去，30% 使對手麻痺。', fx: { status: { id: 'para', chance: 0.3 } }, anim: 'hit' },
  { id: 'deepsleep', name: '超睡死', elem: null, power: 0, cost: 2, acc: 100, desc: '回復全部 HP 並治癒異常狀態，然後睡兩回合。睡著時防禦 +1。', fx: { heal: 1, selfSleep: 2 }, anim: 'heal' },
  { id: 'bigquake', name: '大地震', elem: 'rock', power: 100, cost: 3, acc: 100, desc: '一跺腳引發大地震。', anim: 'hit' },
  { id: 'stunslam', name: '猛烈擊暈', elem: 'rock', power: 70, cost: 2, acc: 95, desc: '狠狠一撞，30% 使對手麻痺。', fx: { status: { id: 'para', chance: 0.3 } }, anim: 'hit' },
  { id: 'megatoxin', name: '巨量毒素', elem: null, power: 0, cost: 2, acc: 95, desc: '使對手中毒並降低攻擊。', fx: { status: { id: 'poison', chance: 1 }, stat: { key: 'atk', delta: -1, self: false } }, anim: 'splash' },
  { id: 'hail', name: '冰雹', elem: 'ice', power: 25, cost: 1, acc: 95, desc: '降下冰雹，連續攻擊 2–3 次。', fx: { multi: [2, 3] }, anim: 'splash' },
  { id: 'frostfang', name: '霜牙', elem: 'ice', power: 65, cost: 2, acc: 95, desc: '用冰牙咬住，20% 使對手冰凍。', fx: { status: { id: 'freeze', chance: 0.2 } }, anim: 'hit' },
  { id: 'icebeam', name: '冰凍光線', elem: 'ice', power: 90, cost: 3, acc: 100, desc: '射出極寒光線，10% 使對手冰凍。', fx: { status: { id: 'freeze', chance: 0.1 } }, anim: 'beam' },
  { id: 'aurorabeam', name: '極光彈', elem: 'ice', power: 80, cost: 2, acc: 100, desc: '七彩極光的衝擊，30% 降低對手攻擊。', fx: { stat: { key: 'atk', delta: -1, self: false, chance: 0.3 } }, anim: 'beam' },
  { id: 'lavaflow', name: '熔岩流', elem: 'fire', power: 80, cost: 2, acc: 95, desc: '傾瀉熔岩，30% 使對手灼傷。', fx: { status: { id: 'burn', chance: 0.3 } }, anim: 'splash' },
  { id: 'eruption', name: '噴發', elem: 'fire', power: 110, cost: 3, acc: 90, desc: '火山般的猛烈噴發。', anim: 'beam' },
  { id: 'obsidianedge', name: '黑曜刃', elem: 'rock', power: 75, cost: 2, acc: 95, desc: '用黑曜石刃斬擊，30% 降低對手防禦。', fx: { stat: { key: 'def', delta: -1, self: false, chance: 0.3 } }, anim: 'hit' },
  { id: 'stormfang', name: '霆牙爆', elem: 'elec', power: 110, cost: 3, acc: 90, desc: '帶著落雷的撕咬，30% 使對手麻痺。', fx: { status: { id: 'para', chance: 0.3 } }, anim: 'beam' },
  { id: 'crabcannon', name: '鉗砲', elem: 'water', power: 90, cost: 2, acc: 85, desc: '從巨鉗發射高壓水砲。', anim: 'beam' },
];

export const SKILLS: Record<string, Skill> = Object.fromEntries(S.map((s) => [s.id, s]));
