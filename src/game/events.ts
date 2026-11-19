// 隨機事件：航線上的「神秘事件」節點
import { BOONS } from '../data/boons';
import { FORMS } from '../data/creatures';
import type { Elem } from '../data/types';
import { formOf, gainXp, makeMon, maxHp, xpToNext } from './creature';
import { next } from './rng';
import { applyBoon, boon, healParty, markCaught, PARTY_MAX, rollBoons, rollTreasure, zoneOf, type RunState } from './run';

export interface EventOption {
  label: string;
  hint?: string; // 選項旁的小字（代價或條件）
  can?: (r: RunState) => boolean;
  act: (r: RunState) => string; // 回傳結果文字
}
export interface GameEvent { id: string; title: string; text: string; options: EventOption[] }

const roll = (r: RunState) => next(r.rng);
const hasElem = (r: RunState, e: Elem) => r.party.some((m) => m.hp > 0 && formOf(m).elems.includes(e));
const alive = (r: RunState) => r.party.filter((m) => m.hp > 0);
const hurtAll = (r: RunState, ratio: number) => { for (const m of alive(r)) m.hp = Math.max(1, m.hp - Math.floor(maxHp(m) * ratio)); };
const leave: EventOption = { label: '離開', act: () => '你決定不多管閒事，繼續航行。' };

// 從這片海域的出現名單裡挑一隻指定稀有度的幼體
function zoneMon(r: RunState, rarities: string[]) {
  const pool = zoneOf(r).pool.filter((id) => rarities.includes(FORMS[id].rarity));
  const id = pool[Math.floor(roll(r) * pool.length)] ?? zoneOf(r).pool[0];
  return makeMon(id, Math.max(3, zoneOf(r).lvBase + r.station));
}
function addMon(r: RunState, rarities: string[]): string {
  if (r.party.length >= PARTY_MAX) { r.shells += 50; return '隊伍已經滿了，牠依依不捨地游走了，留下 50 枚貝殼幣當謝禮。'; }
  const m = zoneMon(r, rarities);
  r.party.push(m); markCaught(m.form); r.caught++;
  return `${formOf(m).name}（Lv${m.lv}）加入了隊伍！`;
}

export const EVENTS: GameEvent[] = [
  {
    id: 'bottle', title: '漂流瓶', text: '一個綁著繩子的玻璃瓶在船邊漂著，裡面好像塞了什麼東西。',
    options: [
      { label: '撈起來打開', act: (r) => {
        if (roll(r) < 0.5) { const n = 30 + Math.floor(roll(r) * 25); r.shells += n; return `裡面是一張藏寶圖和 ${n} 枚貝殼幣！`; }
        r.catchBait++; return '裡面塞著一個捕捉餌，還有一張紙條：「祝你好運。」';
      } },
      leave,
    ],
  },
  {
    id: 'wreckboat', title: '遇難的漁船', text: '一艘漁船的桅杆斷了，船上的漁夫正拚命揮手求救。',
    options: [
      { label: '幫忙修船', hint: '全隊損失 15% HP', act: (r) => { hurtAll(r, 0.15); r.lures.star++; r.shells += 30; return '修好了！漁夫送你一個星光餌和 30 枚貝殼幣當謝禮。夥伴們累壞了。'; } },
      { label: '分一些藥膏給他們', hint: '消耗海藻藥膏 ×1', can: (r) => r.items.potion > 0, act: (r) => { r.items.potion--; r.catchBait += 2; return '漁夫感激地收下藥膏，回贈你兩個捕捉餌。'; } },
      leave,
    ],
  },
  {
    id: 'egg', title: '神秘的蛋', text: '海面上漂著一顆溫溫的蛋，表面有奇特的花紋，好像快孵化了。',
    options: [
      { label: '帶走它', act: (r) => `蛋在船上裂開了……${addMon(r, ['N', 'B'])}` },
      { label: '放回海裡', act: () => '你把蛋輕輕放回水裡，希望牠能平安長大。' },
    ],
  },
  {
    id: 'whirlpool', title: '巨大漩渦', text: '前方海面捲起一個巨大的漩渦，漩渦中心隱約有光。',
    options: [
      { label: '衝進去', hint: '有好處也有風險', act: (r) => {
        const a = alive(r); if (!a.length) return '什麼也沒發生。';
        const lucky = a[Math.floor(roll(r) * a.length)];
        for (let i = 0; i < 2; i++) gainXp(lucky, xpToNext(lucky.lv) - lucky.xp);
        const others = a.filter((m) => m !== lucky);
        let t = `${formOf(lucky).name} 在漩渦中心吸收了力量，升到 Lv${lucky.lv}！`;
        if (others.length) { const v = others[Math.floor(roll(r) * others.length)]; v.hp = 1; t += `但 ${formOf(v).name} 被捲得頭昏眼花，HP 只剩 1。`; }
        return t;
      } },
      { label: '繞過去', act: () => '你小心地繞開漩渦。' },
    ],
  },
  {
    id: 'oldfisher', title: '老漁夫', text: '一位白鬍子老漁夫坐在小舟上抽著菸斗：「年輕人，要不要跟我做筆交易？」',
    options: [
      { label: '買他的星光餌', hint: '60 枚貝殼幣換 2 個', can: (r) => r.shells >= 60, act: (r) => { r.shells -= 60; r.lures.star += 2; return '「這可是我珍藏的好東西。」你得到了星光餌 ×2。'; } },
      { label: '聽他講故事', act: (r) => {
        if (boon(r, 'steady') < (BOONS.steady.max ?? 99)) { applyBoon(r, 'steady'); return '老漁夫教了你他的拋竿秘訣。獲得能力「穩定手腕」！'; }
        r.shells += 30; return '老漁夫講得很開心，塞了 30 枚貝殼幣給你。';
      } },
      leave,
    ],
  },
  {
    id: 'altar', title: '海神祭壇', text: '海面上浮著一座長滿貝殼的古老祭壇，祭壇上刻著：「獻上供品，必有回報。」',
    options: [
      { label: '獻上一個捕捉餌', hint: '換一張好的能力卡', can: (r) => r.catchBait > 0, act: (r) => { r.catchBait--; const id = rollBoons(r, true)[0]; return `祭壇發出光芒……${applyBoon(r, id)}`; } },
      { label: '獻上夥伴的體力', hint: '全隊損失 30% HP，換經驗值', act: (r) => {
        hurtAll(r, 0.3);
        for (const m of alive(r)) gainXp(m, Math.floor(xpToNext(m.lv) * 0.6));
        return '夥伴們感到一陣虛弱，但身體裡湧出了新的力量。全隊獲得大量經驗值！';
      } },
      leave,
    ],
  },
  {
    id: 'scout', title: '海鳥群', text: '一大群海鳥在遠方的海面上盤旋，好像發現了什麼。',
    options: [
      { label: '讓飛屬性夥伴去偵察', hint: '需要飛屬性夥伴', can: (r) => hasElem(r, 'fly'), act: (r) => { r.shells += 40; const l = rollTreasure(r, 'treasure'); return `夥伴帶回了 40 枚貝殼幣，還找到一個寶箱！${l.text}`; } },
      { label: '跟過去看看', act: (r) => { if (roll(r) < 0.5) { r.shells += 20; return '海鳥們在搶一堆小魚，你撿到了 20 枚貝殼幣。'; } return '等你到的時候，海鳥已經飛走了。'; } },
      leave,
    ],
  },
  {
    id: 'hotspring', title: '溫泉礁', text: '一塊冒著熱氣的礁石，海水在這裡變得暖暖的。',
    options: [
      { label: '讓大家泡一泡', act: (r) => { healParty(r, 0.5, true); return '夥伴們舒服得瞇起了眼睛。全隊回復 50% HP，倒下的夥伴也醒了！'; } },
      leave,
    ],
  },
  {
    id: 'trapped', title: '被困的潮靈', text: '一隻潮靈被廢棄的漁網纏住了，正在水裡掙扎。',
    options: [
      { label: '割開漁網救牠', act: (r) => `你小心地割開漁網。牠在船邊繞了幾圈……${addMon(r, ['B', 'A'])}` },
      { label: '不管牠', act: () => '你轉過頭去，繼續航行。' },
    ],
  },
  {
    id: 'storm', title: '暴風雨', text: '天空突然暗下來，前方是一片狂風暴雨。',
    options: [
      { label: '硬闖過去', hint: '全隊損失 20% HP', act: (r) => { hurtAll(r, 0.2); const id = rollBoons(r)[0]; return `船身劇烈搖晃，總算闖過去了！在風暴中領悟到了什麼……${applyBoon(r, id)}`; } },
      { label: '找地方避風', act: () => '你在小島後面躲了一陣，風雨過去後繼續航行。' },
    ],
  },
  {
    id: 'gamble', title: '海上賭局', text: '一艘花俏的小船靠了過來：「來玩一把吧！押 30，贏了拿 90！」',
    options: [
      { label: '押 30 枚貝殼幣', hint: '一半機率贏', can: (r) => r.shells >= 30, act: (r) => { r.shells -= 30; if (roll(r) < 0.5) { r.shells += 90; return '你贏了！拿回 90 枚貝殼幣。'; } return '輸了……船家笑嘻嘻地收走了你的貝殼幣。'; } },
      { label: '不賭', act: () => '「下次再來啊～」' },
    ],
  },
  {
    id: 'jellies', title: '電流水母群', text: '一大群發光的水母在海面下漂浮，海水裡劈啪作響。',
    options: [
      { label: '讓電屬性夥伴吸收電力', hint: '需要電屬性夥伴', can: (r) => hasElem(r, 'elec'), act: (r) => {
        if (boon(r, 'energy') < (BOONS.energy.max ?? 99)) return `夥伴充滿了電力！${applyBoon(r, 'energy')}`;
        r.catchBait += 2; return '夥伴吸飽了電力，還順便撈到兩個捕捉餌。';
      } },
      { label: '小心繞開', act: () => '你屏住呼吸，慢慢繞過了水母群。' },
    ],
  },
];

export const pickEvent = (r: RunState): GameEvent => EVENTS[Math.floor(next(r.rng) * EVENTS.length)];
