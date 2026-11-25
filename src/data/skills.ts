// 技能資料。cost = 能量消耗（每回合 +1，上限 5，戰鬥開始時有 2 點）
import type { Elem } from './types';

export type StatusId = 'burn' | 'para' | 'poison' | 'freeze' | 'glitch' | 'sleep' | 'blind' | 'bleed';
export type StatKey = 'atk' | 'def' | 'spd';

// 場地／天候：同一時間只會有一種，持續數回合，對雙方都有效
export type FieldId = 'tide' | 'lava' | 'fog' | 'storm' | 'aurora' | 'grid' | 'grove' | 'abyss';
export const FIELDS: Record<FieldId, { name: string; desc: string; color: string }> = {
  tide: { name: '漲潮', desc: '水屬性技能威力 ×1.5，火屬性技能威力 ×0.5。', color: '#3a9be0' },
  lava: { name: '熔岩地面', desc: '火屬性技能威力 ×1.2；非火、非岩屬性每回合受到 1/16 傷害。', color: '#e2512a' },
  fog: { name: '濃霧', desc: '除了暗屬性之外，所有攻擊的命中率 ×0.8。', color: '#8a93a8' },
  storm: { name: '雷暴雲', desc: '電屬性技能威力 ×1.5。', color: '#d8b21a' },
  aurora: { name: '極光', desc: '冰、飛屬性技能威力 ×1.3，冰凍機率加倍。', color: '#7fd8e8' },
  grid: { name: '資料網格', desc: '數碼屬性技能威力 ×1.5，資料錯亂機率加倍。', color: '#1fae9a' },
  grove: { name: '聖林', desc: '草屬性技能威力 ×1.5；每回合雙方回復 1/16 HP（草屬性 1/8）。', color: '#4caf50' },
  abyss: { name: '深淵', desc: '暗屬性技能威力 ×1.5；暗屬性以外的攻擊命中率 ×0.85。', color: '#5b3a9a' },
};

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
  // ── M3 新機制 ──
  vsStatus?: number; // 對手有任何異常狀態時，威力倍率
  chain?: { id: StatusId; mult?: number; crit?: boolean }; // 異常連鎖：對手是這個狀態時威力提升／必定暴擊
  lowHp?: number; // HP 越低威力越高：威力 ×(1 + lowHp × 已損失 HP 比例)
  steal?: number; // 命中後偷走對手的能量
  charge?: boolean; // 蓄力：下一次攻擊威力 ×2
  lockOn?: boolean; // 鎖定：下一次攻擊必定命中且暴擊
  field?: { id: FieldId; turns: number }; // 展開場地
  counter?: number; // 本回合受到攻擊時，把傷害的這個比例反彈回去
  trap?: number; // 在對手場地布下暗礁，持續回合數
  recoil?: number; // 自己受到造成傷害的這個比例
  selfKO?: boolean; // 使用後自己倒下
  cleanse?: boolean; // 治癒自己的異常狀態
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
  { id: 'photosynth', name: '光合作用', elem: 'grass', power: 0, cost: 2, acc: 100, desc: '回復最大 HP 的 30%。', fx: { heal: 0.3 }, anim: 'heal' },
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
  // ── 補強飛、草、冰屬性的技能 ──
  { id: 'featherveil', name: '羽翼護壁', elem: 'fly', power: 0, cost: 1, acc: 100, desc: '張開羽翼擋在身前，產生最大 HP 25% 的護盾。', fx: { shield: 0.25 }, anim: 'buff' },
  { id: 'aircutter', name: '風刃連斬', elem: 'fly', power: 30, cost: 1, acc: 95, desc: '甩出一串風刃，連續攻擊 2–3 次。', fx: { multi: [2, 3] }, anim: 'splash' },
  { id: 'skyfall', name: '流星墜', elem: 'fly', power: 115, cost: 3, acc: 90, desc: '從雲層上方全速墜落，自己也會受到傷害的 1/4。', fx: { recoil: 0.25 }, anim: 'hit' },
  { id: 'thornarmor', name: '荊棘鎧', elem: 'grass', power: 0, cost: 1, acc: 100, desc: '先制。全身長出尖刺，本回合受到攻擊時，把 50% 的傷害反彈回去。', fx: { priority: 2, counter: 0.5 }, anim: 'buff' },
  { id: 'drainvine', name: '吸藤', elem: 'grass', power: 70, cost: 2, acc: 100, desc: '藤蔓纏住對手吸取養分，回復造成傷害的 30%。', fx: { drain: 0.3 }, anim: 'beam' },
  { id: 'petalstorm', name: '花瓣風暴', elem: 'grass', power: 100, cost: 3, acc: 95, desc: '捲起漫天花瓣的暴風，20% 使對手致盲。', fx: { status: { id: 'blind', chance: 0.2 } }, anim: 'splash' },
  { id: 'icewall', name: '冰牆', elem: 'ice', power: 0, cost: 1, acc: 100, desc: '在身前立起一道冰牆，產生最大 HP 30% 的護盾。', fx: { shield: 0.3 }, anim: 'buff' },
  { id: 'blizzard', name: '暴風雪', elem: 'ice', power: 105, cost: 3, acc: 85, desc: '颳起遮天蔽日的暴風雪，20% 使對手冰凍。', fx: { status: { id: 'freeze', chance: 0.2 } }, anim: 'splash' },
  // ── 統領者・潮汐默旭的專屬技能（只有祂會用） ──
  { id: 'moxu_choir', name: '萬潮鳴鐘', elem: 'water', power: 70, cost: 1, acc: 95, desc: '冠冕敲響三重潮鐘，低頻潮環直推目標。30% 使對手麻痺。', fx: { status: { id: 'para', chance: 0.3 } }, anim: 'beam' },
  { id: 'moxu_palace', name: '深宮潮葬', elem: 'dark', power: 80, cost: 2, acc: 95, desc: '深淵在敵人腳下張開，五座水晶碑向內合攏。50% 降低對手防禦。', fx: { stat: { key: 'def', delta: -1, self: false, chance: 0.5 } }, anim: 'hit' },
  { id: 'moxu_lens', name: '日輪裁潮', elem: 'water', power: 95, cost: 3, acc: 90, desc: '胸前日輪聚焦金光，雙股水流纏繞光束。', anim: 'beam' },
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
  { id: 'bitshot', name: '位元射擊', elem: 'data', power: 40, cost: 0, acc: 100, desc: '射出一串位元攻擊。', anim: 'beam' },
  { id: 'glitchwave', name: '錯亂波', elem: 'data', power: 0, cost: 1, acc: 90, desc: '使對手資料錯亂（技能可能變成別招）。', fx: { status: { id: 'glitch', chance: 1 } }, anim: 'beam' },
  { id: 'datastorm', name: '資料風暴', elem: 'data', power: 95, cost: 3, acc: 90, desc: '狂暴的資料流，20% 使對手資料錯亂。', fx: { status: { id: 'glitch', chance: 0.2 } }, anim: 'beam' },
  { id: 'firewall', name: '防火牆', elem: null, power: 0, cost: 1, acc: 100, desc: '產生最大 HP 30% 的護盾。', fx: { shield: 0.3 }, anim: 'buff' },
  { id: 'stormfang', name: '霆牙爆', elem: 'elec', power: 110, cost: 3, acc: 90, desc: '帶著落雷的撕咬，30% 使對手麻痺。', fx: { status: { id: 'para', chance: 0.3 } }, anim: 'beam' },
  { id: 'crabcannon', name: '鉗砲', elem: 'water', power: 90, cost: 2, acc: 85, desc: '從巨鉗發射高壓水砲。', anim: 'beam' },
  // ── M3 新技能 ──
  // 無屬性
  { id: 'recklessram', name: '捨身衝撞', elem: null, power: 120, cost: 2, acc: 100, desc: '不顧一切地撞上去，自己也會受到傷害的 1/3。', fx: { recoil: 0.33 }, anim: 'hit' },
  { id: 'counterscale', name: '鏡面鱗', elem: null, power: 0, cost: 1, acc: 100, desc: '先制。本回合受到攻擊時，把 60% 的傷害反彈回去。', fx: { priority: 2, counter: 0.6 }, anim: 'buff' },
  { id: 'rendclaw', name: '裂爪', elem: null, power: 55, cost: 1, acc: 100, desc: '銳利的爪擊，30% 使對手流血。', fx: { status: { id: 'bleed', chance: 0.3 } }, anim: 'hit' },
  { id: 'purify', name: '淨化', elem: null, power: 0, cost: 1, acc: 100, desc: '治癒自己的異常狀態，並回復最大 HP 的 15%。', fx: { cleanse: true, heal: 0.15 }, anim: 'heal' },
  // 水
  { id: 'aquajet', name: '水流噴射', elem: 'water', power: 40, cost: 1, acc: 100, desc: '先制攻擊。', fx: { priority: 1 }, anim: 'splash' },
  { id: 'counterflow', name: '逆流', elem: 'water', power: 55, cost: 2, acc: 100, desc: 'HP 越低威力越高（最高 2.5 倍）。', fx: { lowHp: 1.5 }, anim: 'splash' },
  { id: 'tidecharge', name: '蓄潮', elem: 'water', power: 0, cost: 1, acc: 100, desc: '蓄積潮水的力量，下一次攻擊威力加倍。', fx: { charge: true }, anim: 'buff' },
  { id: 'hightide', name: '漲潮', elem: 'water', power: 0, cost: 2, acc: 100, desc: '場地變成「漲潮」5 回合：水屬性威力 ×1.5，火屬性威力 ×0.5。', fx: { field: { id: 'tide', turns: 5 } }, anim: 'splash' },
  { id: 'sharkrend', name: '鯊齒撕裂', elem: 'water', power: 80, cost: 2, acc: 95, desc: '用鋸齒撕咬，40% 使對手流血。', fx: { status: { id: 'bleed', chance: 0.4 } }, anim: 'hit' },
  // 火
  { id: 'flareblitz', name: '烈焰衝鋒', elem: 'fire', power: 120, cost: 3, acc: 100, desc: '全身著火衝撞，自己受到傷害的 1/3，10% 使對手灼傷。', fx: { recoil: 0.33, status: { id: 'burn', chance: 0.1 } }, anim: 'hit' },
  { id: 'lavafloor', name: '熔岩地面', elem: 'fire', power: 0, cost: 2, acc: 100, desc: '場地變成「熔岩地面」5 回合：火屬性威力 ×1.2，非火、非岩屬性每回合受傷。', fx: { field: { id: 'lava', turns: 5 } }, anim: 'splash' },
  { id: 'coreburst', name: '爆裂熔核', elem: 'fire', power: 200, cost: 3, acc: 100, desc: '引爆體內的熔核，造成巨大傷害，但自己會倒下。', fx: { selfKO: true }, anim: 'beam' },
  { id: 'scorch', name: '焦灼', elem: 'fire', power: 55, cost: 1, acc: 100, desc: '對灼傷中的對手威力 ×2。', fx: { chain: { id: 'burn', mult: 2 } }, anim: 'hit' },
  // 草
  { id: 'venomstrike', name: '毒棘刺擊', elem: 'grass', power: 60, cost: 2, acc: 100, desc: '對中毒的對手威力 ×2。', fx: { chain: { id: 'poison', mult: 2 } }, anim: 'hit' },
  { id: 'sacredgrove', name: '聖林', elem: 'grass', power: 0, cost: 2, acc: 100, desc: '場地變成「聖林」5 回合：草屬性威力 ×1.5，每回合雙方回復 HP（草屬性回復更多）。', fx: { field: { id: 'grove', turns: 5 } }, anim: 'heal' },
  { id: 'seedleech', name: '寄生種子', elem: 'grass', power: 45, cost: 1, acc: 100, desc: '回復造成傷害的 50%。', fx: { drain: 0.5 }, anim: 'hit' },
  // 電
  { id: 'energydrain', name: '吸能觸手', elem: 'elec', power: 45, cost: 1, acc: 100, desc: '命中後偷走對手 1 點能量。', fx: { steal: 1 }, anim: 'beam' },
  { id: 'conduct', name: '導電', elem: 'elec', power: 65, cost: 2, acc: 100, desc: '對麻痺的對手必定擊中要害。', fx: { chain: { id: 'para', crit: true } }, anim: 'beam' },
  { id: 'flash', name: '閃光', elem: 'elec', power: 0, cost: 1, acc: 90, desc: '刺眼的強光使對手致盲（命中率 ×0.6，換下場時解除）。', fx: { status: { id: 'blind', chance: 1 } }, anim: 'beam' },
  { id: 'thunderstorm', name: '雷暴雲', elem: 'elec', power: 0, cost: 2, acc: 100, desc: '場地變成「雷暴雲」5 回合：電屬性威力 ×1.5。', fx: { field: { id: 'storm', turns: 5 } }, anim: 'beam' },
  // 飛
  { id: 'featherblade', name: '羽刃', elem: 'fly', power: 65, cost: 2, acc: 100, desc: '鋒利的羽毛斬擊，30% 使對手流血。', fx: { status: { id: 'bleed', chance: 0.3 } }, anim: 'hit' },
  { id: 'tailwind', name: '順風', elem: 'fly', power: 0, cost: 1, acc: 100, desc: '乘著順風，速度大幅提高。', fx: { stat: { key: 'spd', delta: 2, self: true } }, anim: 'buff' },
  { id: 'hurricane', name: '暴風', elem: 'fly', power: 110, cost: 3, acc: 80, desc: '狂暴的颶風，20% 使對手致盲。', fx: { status: { id: 'blind', chance: 0.2 } }, anim: 'splash' },
  // 岩
  { id: 'reefspikes', name: '暗礁', elem: 'rock', power: 0, cost: 1, acc: 100, desc: '在對手場地布下暗礁 4 回合：每回合受到傷害，換人上場時受到更多傷害。', fx: { trap: 4 }, anim: 'hit' },
  { id: 'sandtoss', name: '擲沙', elem: 'rock', power: 30, cost: 1, acc: 100, desc: '朝對手眼睛撒沙，50% 使對手致盲。', fx: { status: { id: 'blind', chance: 0.5 } }, anim: 'splash' },
  // 冰
  { id: 'iceshard', name: '冰刺', elem: 'ice', power: 40, cost: 1, acc: 100, desc: '先制攻擊。', fx: { priority: 1 }, anim: 'hit' },
  { id: 'frostcrack', name: '凍裂', elem: 'ice', power: 70, cost: 2, acc: 100, desc: '敲碎冰層，對冰凍中的對手威力 ×1.5。', fx: { chain: { id: 'freeze', mult: 1.5 } }, anim: 'hit' },
  { id: 'auroraveil', name: '極光', elem: 'ice', power: 0, cost: 2, acc: 100, desc: '場地變成「極光」5 回合：冰、飛屬性威力 ×1.3，冰凍機率加倍。', fx: { field: { id: 'aurora', turns: 5 } }, anim: 'beam' },
  // 暗
  { id: 'opportunist', name: '趁火打劫', elem: 'dark', power: 55, cost: 1, acc: 100, desc: '對有異常狀態的對手威力 ×2。', fx: { vsStatus: 2 }, anim: 'hit' },
  { id: 'shadowsneak', name: '影襲', elem: 'dark', power: 40, cost: 1, acc: 100, desc: '先制攻擊。', fx: { priority: 1 }, anim: 'hit' },
  { id: 'inkshot', name: '墨霧彈', elem: 'dark', power: 45, cost: 1, acc: 100, desc: '噴出墨汁，50% 使對手致盲。', fx: { status: { id: 'blind', chance: 0.5 } }, anim: 'splash' },
  { id: 'bloodtide', name: '血潮', elem: 'dark', power: 70, cost: 2, acc: 100, desc: '對流血的對手威力 ×1.5，並回復造成傷害的 30%。', fx: { chain: { id: 'bleed', mult: 1.5 }, drain: 0.3 }, anim: 'beam' },
  { id: 'seafog', name: '濃霧', elem: 'dark', power: 0, cost: 1, acc: 100, desc: '場地變成「濃霧」5 回合：除了暗屬性之外，攻擊命中率 ×0.8。', fx: { field: { id: 'fog', turns: 5 } }, anim: 'splash' },
  { id: 'bonerend', name: '骨刃', elem: 'dark', power: 65, cost: 2, acc: 100, desc: '用尖銳的骨頭劃開，40% 使對手流血。', fx: { status: { id: 'bleed', chance: 0.4 } }, anim: 'hit' },
  // 數碼
  { id: 'scanlock', name: '掃描鎖定', elem: 'data', power: 0, cost: 1, acc: 100, desc: '鎖定目標，下一次攻擊必定命中且擊中要害。', fx: { lockOn: true }, anim: 'buff' },
  { id: 'datagrid', name: '資料網格', elem: 'data', power: 0, cost: 2, acc: 100, desc: '場地變成「資料網格」5 回合：數碼屬性威力 ×1.5，資料錯亂機率加倍。', fx: { field: { id: 'grid', turns: 5 } }, anim: 'beam' },
  { id: 'crash', name: '程式崩潰', elem: 'data', power: 65, cost: 2, acc: 100, desc: '對資料錯亂的對手威力 ×1.6。', fx: { chain: { id: 'glitch', mult: 1.6 } }, anim: 'beam' },
  { id: 'virus', name: '病毒注入', elem: 'data', power: 50, cost: 1, acc: 100, desc: '注入病毒程式，30% 使對手中毒。', fx: { status: { id: 'poison', chance: 0.3 } }, anim: 'beam' },
  { id: 'selfdestruct', name: '自毀程序', elem: 'data', power: 170, cost: 3, acc: 100, desc: '啟動自毀程序，造成巨大傷害，但自己會倒下。', fx: { selfKO: true }, anim: 'beam' },
  // ── 第三片海域 ──
  { id: 'reboot', name: '系統重啟', elem: 'data', power: 0, cost: 2, acc: 100, desc: '重新啟動：治癒自己的異常狀態，並回復最大 HP 的 30%。', fx: { cleanse: true, heal: 0.3 }, anim: 'heal' },
  { id: 'engulf', name: '吞沒', elem: 'dark', power: 100, cost: 3, acc: 95, desc: '張開巨口吞沒一切，回復造成傷害的 30%。', fx: { drain: 0.3 }, anim: 'hit' },
  { id: 'abyssveil', name: '深淵', elem: 'dark', power: 0, cost: 2, acc: 100, desc: '場地變成「深淵」5 回合：暗屬性威力 ×1.5，暗屬性以外的攻擊命中率 ×0.85。', fx: { field: { id: 'abyss', turns: 5 } }, anim: 'splash' },
  // ── 神之手（只有神之手會用） ──
  { id: 'gh_toss', name: '拎北好無聊', elem: null, power: 0, cost: 0, acc: 100, desc: '抓起對手拋來拋去，造成 1～20 次、每次 1 點的傷害。', anim: 'hit' },
  { id: 'gh_love', name: '無法忽視的愛', elem: null, power: 0, cost: 0, acc: 100, desc: '下一回合，對手只能使用技能，不能換人、用道具。', anim: 'buff' },
  { id: 'gh_fire', name: '熱情如火', elem: null, power: 0, cost: 0, acc: 100, desc: '讓對手陷入不會結束的灼傷，每回合固定扣 2 HP。', anim: 'beam' },
  { id: 'gh_stay', name: '不要走', elem: null, power: 0, cost: 0, acc: 100, desc: '回合數倒退一回合（每場最多 3 次）。', anim: 'buff' },
  { id: 'gh_pull', name: '不讓你走', elem: null, power: 0, cost: 0, acc: 100, desc: '大招：直接拔走對手的兩個技能（只在最後五回合使用）。', anim: 'beam' },
];


export const SKILLS: Record<string, Skill> = Object.fromEntries(S.map((s) => [s.id, s]));
