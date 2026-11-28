// 隨機事件：航線上的「神秘事件」節點
import { BOONS } from '../data/boons';
import { HELD } from '../data/held';
import { FORMS } from '../data/creatures';
import type { Elem } from '../data/types';
import { formOf, gainXp, makeMon, maxHp, xpToNext } from './creature';
import { next } from './rng';
import { giveHeld, applyBoon, boon, healParty, PARTY_MAX, rollBoons, rollTreasure, zoneOf, type RunState, type ZoneId } from './run';

export interface EventOption {
  label: string;
  hint?: string; // 選項旁的小字（代價或條件）
  can?: (r: RunState) => boolean;
  act: (r: RunState) => string; // 回傳結果文字
}
export interface GameEvent { id: string; title: string; text: string; options: EventOption[]; zones?: ZoneId[] } // zones：只在這些區域出現

const roll = (r: RunState) => next(r.rng);
const hasElem = (r: RunState, e: Elem) => r.party.some((m) => m.hp > 0 && formOf(m).elems.includes(e));
const alive = (r: RunState) => r.party.filter((m) => m.hp > 0);
const hurtAll = (r: RunState, ratio: number) => { for (const m of alive(r)) m.hp = Math.max(1, m.hp - Math.floor(maxHp(m) * ratio)); };
const leave: EventOption = { label: '離開', act: () => '你決定不多管閒事，繼續航行。' };

// 從這片海域的出現名單裡挑一隻指定稀有度的幼體
function zoneMon(r: RunState, rarities: string[]) {
  const pool = zoneOf(r).pool.filter((id) => rarities.includes(FORMS[id].rarity));
  const id = pool[Math.floor(roll(r) * pool.length)] ?? zoneOf(r).pool[0];
  return makeMon(id, Math.max(3, zoneOf(r).lvBase + r.station), false, false, r.daily ? () => next(r.rng) : undefined);
}
/** 事件引發戰鬥：從這片海域挑一隻，打完會回到航線 */
function fight(r: RunState, rarities: string[], lvBonus = 0, form?: string): void {
  const pool = zoneOf(r).pool.filter((id) => rarities.includes(FORMS[id].rarity));
  const id = form ?? pool[Math.floor(roll(r) * pool.length)] ?? zoneOf(r).pool[0];
  r.eventFight = { form: id, lv: Math.max(3, Math.round(zoneOf(r).lvBase + r.station * 0.8) + lvBonus) };
}
const expAll = (r: RunState, ratio: number) => { for (const m of alive(r)) gainXp(m, Math.floor(xpToNext(m.lv) * ratio)); };
const cureAll = (r: RunState) => { for (const m of r.party) m.status = null; };
function addMon(r: RunState, rarities: string[]): string {
  if (r.party.length >= PARTY_MAX) { r.shells += 50; return '隊伍已經滿了，牠依依不捨地游走了，留下 50 枚貝殼幣當謝禮。'; }
  const m = zoneMon(r, rarities);
  r.party.push(m); r.caught++;
  return `${formOf(m).name}（Lv${m.lv}）加入了隊伍！`;
}

export const EVENTS: GameEvent[] = [
  {
    id: 'peddler', title: '小船上的工匠', text: '一位老工匠在小船上磨著貝殼：「我做的護符，戴在夥伴身上可是很有用的喔。」',
    options: [
      { label: '買一個護符', hint: '50 貝殼幣', can: (r) => r.shells >= 50, act: (r) => { r.shells -= 50; const h = giveHeld(r); return `拿到了「${HELD[h].name}」！${HELD[h].desc}`; } },
      { label: '幫忙搬材料', hint: '全隊損失 20% HP', act: (r) => { hurtAll(r, 0.2); const h = giveHeld(r); return `工匠把做壞的「${HELD[h].name}」送給你——其實根本沒壞。`; } },
      leave,
    ],
  },
  {
    id: 'sunkcrate', title: '沉沒的貨箱', text: '海底卡著一個生鏽的貨箱，看起來需要有夥伴潛下去撬開。',
    options: [
      { label: '派夥伴潛下去', hint: '先發夥伴損失 30% HP', can: (r) => alive(r).length > 0, act: (r) => { const m = alive(r)[0]; m.hp = Math.max(1, m.hp - Math.floor(maxHp(m) * 0.3)); const h = giveHeld(r); return `${formOf(m).name} 帶回了「${HELD[h].name}」！`; } },
      leave,
    ],
  },
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
  // ── M4：通用事件 ──
  {
    id: 'lostchild', title: '迷路的小潮靈', text: '一隻小小的潮靈繞著船打轉，好像跟家人走散了。',
    options: [
      { label: '幫牠找家人', hint: '全隊獲得經驗值', act: (r) => { expAll(r, 0.35); r.shells += 25; return '在一片礁石旁找到了牠的家人！牠們送你 25 枚貝殼幣，夥伴們也學到了不少。'; } },
      { label: '收留牠', act: (r) => `小潮靈開心地跳上了船。${addMon(r, ['N'])}` },
      leave,
    ],
  },
  {
    id: 'sunkenchest', title: '沉沒的寶箱', text: '透過清澈的海水，可以看到海底躺著一個生鏽的寶箱。',
    options: [
      { label: '讓水屬性夥伴潛下去', hint: '需要水屬性夥伴', can: (r) => hasElem(r, 'water'), act: (r) => { const a = rollTreasure(r, 'treasure'), b = rollTreasure(r, 'treasure'); return `夥伴把寶箱整個拖了上來！${a.text}${b.text}`; } },
      { label: '用釣竿勾勾看', act: (r) => { if (roll(r) < 0.55) { const l = rollTreasure(r, 'treasure'); return `勾到了！${l.text}`; } return '釣線斷了，寶箱沉回了海底的泥沙裡。'; } },
      leave,
    ],
  },
  {
    id: 'pirates', title: '海盜船', text: '一艘掛著骷髏旗的小船攔住去路：「留下買路錢，或是跟我們的看門潮靈打一場！」',
    options: [
      { label: '迎戰', hint: '和強敵戰鬥', act: (r) => { fight(r, ['A', 'B'], 2); return '海盜放出了牠們的看門潮靈！'; } },
      { label: '交出 40 枚貝殼幣', can: (r) => r.shells >= 40, act: (r) => { r.shells -= 40; return '海盜收下貝殼幣，大笑著揚長而去。'; } },
      { label: '全速逃跑', hint: '全隊損失 10% HP', act: (r) => { hurtAll(r, 0.1); return '船身被砲彈擦過，總算甩掉了海盜。'; } },
    ],
  },
  {
    id: 'fogbank', title: '濃霧', text: '前方湧起一大片濃霧，什麼都看不清楚。',
    options: [
      { label: '穿過去', hint: '可能有收穫，也可能受傷', act: (r) => { if (roll(r) < 0.5) { r.lures.star++; return '霧裡有東西閃了一下……你撈到了一個星光餌！'; } hurtAll(r, 0.15); return '船撞上了暗礁，夥伴們被晃得東倒西歪。'; } },
      { label: '等霧散去', act: () => '你耐心地等了一陣，霧散了，海面恢復平靜。' },
    ],
  },
  {
    id: 'seasong', title: '海之歌', text: '遠方傳來一陣悠揚的歌聲，聽了讓人心情平靜。',
    options: [
      { label: '靜靜地聽', act: (r) => { healParty(r, 0.3); cureAll(r); return '夥伴們閉上眼睛。全隊回復 30% HP，異常狀態也消失了。'; } },
      { label: '跟著一起唱', act: (r) => { expAll(r, 0.25); return '夥伴們跟著哼了起來，好像領悟了什麼。全隊獲得經驗值！'; } },
    ],
  },
  {
    id: 'contest', title: '釣魚大賽', text: '一群漁夫正在舉辦釣魚大賽：「報名費 20 枚貝殼幣，獎品很豐富喔！」',
    options: [
      { label: '報名參加', hint: '20 枚貝殼幣', can: (r) => r.shells >= 20, act: (r) => {
        r.shells -= 20; const x = roll(r);
        if (x < 0.1) { r.lures.legend++; return '你釣到了全場最大的魚！冠軍獎品是傳說餌！'; }
        if (x < 0.4) { r.lures.star++; return '你拿到第二名！獎品是星光餌。'; }
        r.shells += 45; return '你拿到參加獎，45 枚貝殼幣。';
      } },
      leave,
    ],
  },
  {
    id: 'shipwright', title: '流浪船匠', text: '一位船匠划著工具船靠近：「我可以幫你的船改裝一下，要 70 枚貝殼幣。」',
    options: [
      { label: '請他改裝', hint: '70 枚貝殼幣換一張好的能力卡', can: (r) => r.shells >= 70, act: (r) => { r.shells -= 70; const id = rollBoons(r, true)[0]; return `船匠叮叮噹噹地忙了一陣……${applyBoon(r, id)}`; } },
      leave,
    ],
  },
  {
    id: 'barter', title: '以物易物的商人', text: '一位商人搖著鈴鐺：「不收錢，只交換東西！」',
    options: [
      { label: '海藻藥膏換捕捉餌', hint: '藥膏 ×1 → 捕捉餌 ×1', can: (r) => r.items.potion > 0, act: (r) => { r.items.potion--; r.catchBait++; return '交換成功！'; } },
      { label: '2 個捕捉餌換星光餌', hint: '捕捉餌 ×2 → 星光餌 ×1', can: (r) => r.catchBait >= 2, act: (r) => { r.catchBait -= 2; r.lures.star++; return '交換成功！'; } },
      { label: '捕捉餌換生命石', hint: '捕捉餌 ×3 → 生命石 ×1', can: (r) => r.catchBait >= 3, act: (r) => { r.catchBait -= 3; r.lifeStones = (r.lifeStones ?? 0) + 1; return '商人從箱底拿出一顆發光的石頭。你得到了生命石！'; } },
      leave,
    ],
  },
  {
    id: 'meteor', title: '流星雨', text: '夜空中劃過一道又一道流星。據說對著流星許願，願望就會實現。',
    options: [
      { label: '希望發大財', act: (r) => { r.shells += 50; return '一顆流星落進海裡，海面浮起了 50 枚貝殼幣！'; } },
      { label: '希望收服更多夥伴', act: (r) => { r.catchBait++; return '船上突然多了一個捕捉餌。'; } },
      { label: '希望大家平安', act: (r) => { healParty(r, 0.4, true); return '溫暖的光灑在船上，全隊回復 40% HP。'; } },
    ],
  },
  {
    id: 'giantshadow', title: '巨大魚影', text: '船底下游過一道巨大的影子，大得嚇人。',
    options: [
      { label: '下竿挑戰', hint: '稀有的強敵', act: (r) => { fight(r, ['S', 'A'], 3); return '影子咬住了釣餌，猛力往下拉！'; } },
      { label: '靜靜等牠游走', act: () => '影子慢慢沉入深處，消失不見了。' },
    ],
  },
  {
    id: 'island', title: '無人島', text: '一座地圖上沒有的小島，島上長滿了椰子樹。',
    options: [
      { label: '上岸休息', act: (r) => { healParty(r, 0.4, true); return '夥伴們在沙灘上睡了個午覺。全隊回復 40% HP。'; } },
      { label: '深入探險', hint: '可能找到寶物，也可能遇到潮靈', act: (r) => { if (roll(r) < 0.5) { const l = rollTreasure(r, 'treasure'); return `在洞穴裡找到了寶箱！${l.text}`; } fight(r, ['N', 'B']); return '樹叢裡跳出了一隻潮靈！'; } },
      leave,
    ],
  },
  {
    id: 'postbird', title: '信天翁郵差', text: '一隻背著郵袋的信天翁停在船桅上，好像累壞了。',
    options: [
      { label: '分牠一點食物', act: (r) => { r.catchBait++; r.shells += 20; return '信天翁吃飽後，留下一個包裹就飛走了。裡面有捕捉餌和 20 枚貝殼幣。'; } },
      { label: '幫牠送信', hint: '多航行一段路，全隊損失 10% HP', act: (r) => { hurtAll(r, 0.1); r.lures.star++; r.shells += 40; return '收信的老奶奶非常高興，送了你星光餌和 40 枚貝殼幣。'; } },
      leave,
    ],
  },
  // ── M4：海域專屬事件 ──
  {
    id: 'coralgarden', title: '珊瑚花園', zones: ['shallows', 'forest'], text: '一片色彩繽紛的珊瑚花園，小魚在其中穿梭。',
    options: [
      { label: '讓草屬性夥伴吸收養分', hint: '需要草屬性夥伴', can: (r) => hasElem(r, 'grass'), act: (r) => { expAll(r, 0.5); return '珊瑚的養分讓夥伴們精神百倍。全隊獲得大量經驗值！'; } },
      { label: '欣賞一下', act: (r) => { healParty(r, 0.2); return '美麗的景色讓大家放鬆下來，全隊回復 20% HP。'; } },
    ],
  },
  {
    id: 'lighthouse', title: '燈塔守護者', zones: ['shallows'], text: '一座孤零零的燈塔，守塔人向你招手。',
    options: [
      { label: '上去拜訪', act: (r) => { r.items.potion += 2; return '守塔人請你喝了熱茶，還送你兩個海藻藥膏。「前面的海域，霸主很喜歡用水屬性的招式喔。」'; } },
      leave,
    ],
  },
  {
    id: 'frozenmon', title: '冰封的潮靈', zones: ['ice'], text: '一塊浮冰裡凍著一隻潮靈，牠的眼睛好像還在動。',
    options: [
      { label: '讓火屬性夥伴融冰', hint: '需要火屬性夥伴', can: (r) => hasElem(r, 'fire'), act: (r) => `冰慢慢融化了，潮靈感激地看著你……${addMon(r, ['A', 'B'])}` },
      { label: '用力敲開', hint: '全隊損失 10% HP', act: (r) => { hurtAll(r, 0.1); if (roll(r) < 0.5) return `冰塊裂開了！${addMon(r, ['B', 'N'])}`; return '冰塊碎了，但裡面的潮靈一溜煙游走了。'; } },
      leave,
    ],
  },
  {
    id: 'aurora', title: '極光之夜', zones: ['ice'], text: '天空中舞動著綠色與紫色的極光，海面映得一片夢幻。',
    options: [
      { label: '整夜看著極光', act: (r) => { healParty(r, 0.35, true); expAll(r, 0.2); return '夥伴們看得入迷。全隊回復 35% HP，也獲得了一些經驗值。'; } },
    ],
  },
  {
    id: 'eruption', title: '海底火山噴發', zones: ['lava'], text: '前方海面突然噴出滾燙的岩漿，海水在沸騰！',
    options: [
      { label: '趁亂撈寶', hint: '全隊損失 25% HP', act: (r) => { hurtAll(r, 0.25); r.shells += 80; return '你在噴發的縫隙間撈到了被沖上來的寶石，換得 80 枚貝殼幣！'; } },
      { label: '讓水屬性夥伴降溫', hint: '需要水屬性夥伴', can: (r) => hasElem(r, 'water'), act: (r) => { const l = rollTreasure(r, 'treasure'); return `夥伴噴出水柱，冷卻的岩漿裡露出一個寶箱！${l.text}`; } },
      { label: '快點離開', act: () => '你掉頭就跑，背後傳來轟隆巨響。' },
    ],
  },
  {
    id: 'forge', title: '熔岩鍛爐', zones: ['lava'], text: '一座建在火山口邊緣的古老鍛爐，爐火至今沒有熄滅。',
    options: [
      { label: '投入 40 枚貝殼幣', hint: '鍛造一張能力卡', can: (r) => r.shells >= 40, act: (r) => { r.shells -= 40; const id = rollBoons(r)[0]; return `爐火猛地竄高……${applyBoon(r, id)}`; } },
      { label: '讓火屬性夥伴淬鍊', hint: '需要火屬性夥伴', can: (r) => hasElem(r, 'fire'), act: (r) => { for (const m of alive(r)) if (formOf(m).elems.includes('fire')) gainXp(m, xpToNext(m.lv) - m.xp); return '火屬性的夥伴在爐火中鍛鍊，各升了 1 級！'; } },
      leave,
    ],
  },
  {
    id: 'datacache', title: '加密資料庫', zones: ['cyber', 'core'], text: '海面浮著一個發光的方塊，上面寫著「存取受限」。',
    options: [
      { label: '讓數碼屬性夥伴解密', hint: '需要數碼屬性夥伴', can: (r) => hasElem(r, 'data'), act: (r) => { if (roll(r) < 0.3) { r.lures.legend++; return '解密成功！資料庫裡藏著一個傳說餌！'; } r.lures.star++; r.shells += 40; return '解密成功！得到星光餌和 40 枚貝殼幣。'; } },
      { label: '硬闖', hint: '可能觸發防衛程式', act: (r) => { if (roll(r) < 0.5) { r.shells += 60; return '方塊打開了，裡面有 60 枚貝殼幣。'; } fight(r, ['A', 'B'], 1); return '警報響起！防衛程式啟動了！'; } },
      leave,
    ],
  },
  {
    id: 'vending', title: '故障販賣機', zones: ['cyber'], text: '一台浮在海上的販賣機，螢幕閃爍著亂碼。',
    options: [
      { label: '投 30 枚貝殼幣', can: (r) => r.shells >= 30, act: (r) => {
        r.shells -= 30; const x = roll(r);
        if (x < 0.3) { r.items.superpotion++; return '掉出了一瓶珍珠精華！'; }
        if (x < 0.55) { r.catchBait += 2; return '掉出了兩個捕捉餌！'; }
        if (x < 0.7) { r.lifeStones = (r.lifeStones ?? 0) + 1; return '機器發出怪聲，掉出了一顆生命石！'; }
        return '螢幕顯示「ERROR」，什麼都沒掉出來……';
      } },
      { label: '拍兩下', act: (r) => { if (roll(r) < 0.3) { r.items.potion++; return '哐啷一聲，掉出一個海藻藥膏。'; } return '販賣機發出嗶嗶聲，沒有反應。'; } },
    ],
  },
  {
    id: 'abysslight', title: '深淵之光', zones: ['abyss'], text: '黑暗深處有一道光在閃爍，好像在引誘你靠近。',
    options: [
      { label: '跟著光前進', hint: '可能是陷阱', act: (r) => { if (roll(r) < 0.45) { r.shells += 100; return '光源是一顆巨大的黑珍珠！賣了 100 枚貝殼幣。'; } fight(r, ['N', 'B'], 2, 'abyss_lantern'); return '光的後面是一張滿是尖牙的大嘴！'; } },
      leave,
    ],
  },
  {
    id: 'whalesong', title: '古鯨之歌', zones: ['abyss', 'void'], text: '深海中迴盪著低沉的鯨歌，海水都跟著震動。',
    options: [
      { label: '閉上眼睛聆聽', act: (r) => { healParty(r, 0.5, true); cureAll(r); return '鯨歌撫平了所有的傷痛。全隊回復 50% HP，異常狀態也消失了。'; } },
    ],
  },
  {
    id: 'spiritfont', title: '聖泉', zones: ['forest'], text: '森林深處湧出一道清泉，泉水閃著淡淡的綠光。',
    options: [
      { label: '讓夥伴喝泉水', act: (r) => { healParty(r, 1, true); cureAll(r); return '清涼的泉水流遍全身，全隊完全回復！'; } },
    ],
  },
  {
    id: 'mirror', title: '虛像之鏡', zones: ['void'], text: '一面浮在空中的鏡子，鏡子裡的你在對你微笑。',
    options: [
      { label: '觸碰鏡子', hint: '結果難以預料', act: (r) => {
        const a = alive(r); if (!a.length) return '什麼也沒發生。';
        const m = a[Math.floor(roll(r) * a.length)];
        if (roll(r) < 0.6) { for (let i = 0; i < 2; i++) gainXp(m, xpToNext(m.lv) - m.xp); return `鏡中的 ${formOf(m).name} 走了出來，和本體合而為一！升到了 Lv${m.lv}！`; }
        m.hp = 1; return `鏡子吸走了 ${formOf(m).name} 的力量，HP 只剩 1……`;
      } },
      leave,
    ],
  },
];

/** 挑一個事件：只挑這片海域會出現的、這一局還沒遇過的；海域專屬事件比較容易出現 */
export function pickEvent(r: RunState): GameEvent {
  const seen = new Set(r.seenEvents ?? []);
  let cands = EVENTS.filter((e) => (!e.zones || e.zones.includes(r.zone)) && !seen.has(e.id));
  if (!cands.length) cands = EVENTS.filter((e) => !e.zones || e.zones.includes(r.zone));
  const weights = cands.map((e) => (e.zones ? 3 : 1));
  let x = next(r.rng) * weights.reduce((a, b) => a + b, 0), pick = cands[0];
  for (let i = 0; i < cands.length; i++) { x -= weights[i]; if (x <= 0) { pick = cands[i]; break; } }
  r.seenEvents = [...(r.seenEvents ?? []), pick.id];
  return pick;
}
