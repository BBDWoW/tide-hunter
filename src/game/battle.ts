// 回合制戰鬥引擎（純邏輯，不碰畫面）。
// 兩邊都是「Side」，由誰操作（玩家、AI、之後的連線玩家）由外部決定。
// 所有隨機都走 state.rng，所以同樣的初始狀態＋同樣的行動序列一定得到同樣結果。
import { MOXU_ASCENDED, MOXU_ASCENDED_BOOST, MOXU_ASCENDED_SKILLS, MOXU_ASCENDED_ULT } from '../data/moxu';
import { nextOracleMark } from '../data/oracle';
import { DOMAINS, type DomainId } from '../data/domains';
import { FIELDS, SKILLS, type FieldId, type Skill, type StatKey, type StatusId } from '../data/skills';
import { effectiveness, ELEM } from '../data/types';
import { blockRate, dodgeRate, formOf, isBasicAttack, makeMon, maxHp, statsOf, type Mon } from './creature';
import { hasAb } from '../data/creatures';
import type { HeldId } from '../data/held';
import type { Elem } from '../data/types';
import { chance, int, next, range, type Rng } from './rng';

export type SideId = 0 | 1;

export interface Volatile {
  energy: number;
  shield: number;
  stages: Record<StatKey, number>;
  turnsIn: number;
  freezeTurns: number;
  sleepTurns: number;
  undyingUsed: boolean;
  charged?: boolean; // 蓄力中：下一次攻擊威力 ×2
  lockOn?: boolean; // 鎖定中：下一次攻擊必定命中且暴擊
  omenMarks?: number[];
  omenTurn?: number;
  counter?: number; // 本回合的反擊比例
  pearlUsed?: boolean; // 不屈珍珠已經用掉
  relay?: number; // 接力：下一招的威力倍率
}

export interface SideMods { atk: number; def: number; energy: number; crit: number; reso?: Partial<Record<Elem, number>>; bn?: Record<string, number> }
/** 這一方擁有的能力卡層數 */
const bn = (s: BattleState, side: SideId, id: string) => s.sides[side].mods?.bn?.[id] ?? 0;
const NO_MODS: SideMods = { atk: 1, def: 1, energy: 0, crit: 0 };

export interface Side {
  mods?: SideMods; // 能力卡等外部加成（純資料，可序列化）
  team: Mon[];
  active: number;
  vol: Record<string, Volatile>; // 依 uid
  name: string;
  boss?: boolean; // 霸主：HP 掉到一半時會狂暴一次
  enraged?: boolean;
  spreadBurn?: boolean; // 燎原：下一隻上場的會被灼傷
  phoenixUsed?: boolean; // 不死鳥之羽已經用掉
}

export interface BattleState {
  rng: Rng;
  turn: number;
  sides: [Side, Side];
  wild: boolean;
  over: null | { winner: SideId; fled?: boolean };
  needSwitch: [boolean, boolean];
  field?: { id: FieldId; turns: number } | null; // 場地／天候
  traps?: [number, number]; // 各自場地上的暗礁剩餘回合
  domain?: DomainId; // 特殊區域的領域效果（整場戰鬥都在）
  godhand?: GodHandState; // 神之手之戰：撐過 survive 回合就贏
  final?: FinalState; // 最終決戰：統領者・潮汐默旭
}
/** 最終決戰：兩條血、第二條血召喚霸主，第三條血變身，每 5 回合放一次大絕招 */
export interface FinalState { phase: 1 | 2 | 3; ally: number | null; ultIn: number; rodCd: number; rodUses: number; summoned?: string; allyPlan?: Action }
export interface GodHandState { survive: number; rewinds: number; loveTurn: number; passion: string[]; pulled: Record<string, string[]>; saved: Record<string, string[]> }
export const isGodHand = (m: Mon) => m.form === 'godhand';

export type Action =
  | { type: 'skill'; slot: number; target?: number } // slot = -1 → 掙扎、-2 → 統領者的大絕招；target：1 對 2 時要打哪一隻（對手隊伍的位置）
  | { type: 'rod' } // 最終決戰：漁夫的釣竿
  | { type: 'switch'; to: number }
  | { type: 'item'; item: ItemId; target: number }
  | { type: 'run' }
  | { type: 'pass'; reason?: string };

export type ItemId = 'potion' | 'superpotion' | 'revive' | 'ether';
export const ITEMS: Record<ItemId, { name: string; desc: string; revive?: boolean }> = {
  potion: { name: '海藻藥膏', desc: '回復 50% HP。' },
  superpotion: { name: '珍珠精華', desc: '回復全部 HP 並治癒異常狀態。' },
  revive: { name: '復甦貝', desc: '使倒下的夥伴以 50% HP 復活。', revive: true },
  ether: { name: '能量海膽', desc: '出場中的夥伴獲得 3 點能量。' },
};

/** slot：最終決戰 1 對 2 時，這個事件是對手的哪一隻（對手隊伍的位置） */
export type BEvent = BEventBase & { slot?: number };
type BEventBase =
  | { t: 'msg'; text: string }
  | { t: 'use'; side: SideId; skill: string }
  | { t: 'omen'; side: SideId; marks: number[] }
  | { t: 'miss'; side: SideId }
  | { t: 'dmg'; side: SideId; elem?: Elem | null; amount: number; hp: number; eff: number; crit: boolean; shield: number }
  | { t: 'heal'; side: SideId; amount: number; hp: number }
  | { t: 'shield'; side: SideId; amount: number }
  | { t: 'status'; side: SideId; status: StatusId | null }
  | { t: 'stat'; side: SideId; key: StatKey; delta: number }
  | { t: 'energy'; side: SideId; value: number }
  | { t: 'faint'; side: SideId }
  | { t: 'switch'; side: SideId; index: number; form: string; hp: number; energy: number; status: StatusId | null }
  | { t: 'dodge'; side: SideId }
  | { t: 'block'; side: SideId }
  | { t: 'field'; id: FieldId | null; turns: number }
  | { t: 'trap'; side: SideId; turns: number }
  | { t: 'enrage'; side: SideId }
  | { t: 'item'; side: SideId; target: number; text: string; from: number; hp: number; max: number }
  | { t: 'pull'; side: SideId; skills: string[] }
  | { t: 'rewind'; turn: number }
  | { t: 'toss'; side: SideId; hits: number }
  | { t: 'phase3'; side: 1; hp: number; max: number; energy: number }
  | { t: 'phase2'; side: SideId; hp: number; max: number }
  | { t: 'summon'; side: SideId; slot: number; form: string; lv: number; hp: number; max: number }
  | { t: 'rod'; side: SideId }
  | { t: 'ultwarn' }
  | { t: 'end'; winner: SideId };

/** 統領者的大絕招（不在技能表裡，每 4 回合自動施放） */
export const MOXU_ULT: Skill = { id: 'moxu_daybreak', name: '五海歸一・默海破曉', elem: 'water', power: 55, cost: 0, acc: 100, desc: '把五片海域的潮水全部召喚過來，一口氣砸下去。打中後，你隊伍裡每一隻夥伴都會各中一種不同的異常狀態。', anim: 'beam' };
export const ULT_EVERY = 5, ROD_CD = 3, ROD_DMG = 0.1, ROD_WEAKEN = 0.9;
/** 平衡用：每條血是原本 HP 的幾倍、召喚的霸主比統領者低幾級 */
export const FINAL_TUNE = { barHp: 0.7, summonDrop: 3 };
/** 第二條血時會被召喚出來的霸主 */
export const FINAL_SUMMONS = ['whale', 'frostking', 'lavadragon', 'mainframe_leviathan', 'nether_whale'];
export const STRUGGLE: Skill = { id: 'struggle', name: '掙扎', elem: null, power: 35, cost: 0, acc: 100, desc: '能量不足時使用。', anim: 'hit' };
export const MAX_ENERGY = 5;
const STATUS_NAME: Record<StatusId, string> = { burn: '灼傷', para: '麻痺', poison: '中毒', freeze: '冰凍', glitch: '資料錯亂', sleep: '睡眠', blind: '致盲', bleed: '流血' };

/** 異常狀態持續的回合數（冰凍、睡眠另外計算） */
export const STATUS_TURNS: Partial<Record<StatusId, number>> = { burn: 4, poison: 5, bleed: 4, para: 3, blind: 3, glitch: 3 };

export const active = (s: BattleState, side: SideId) => s.sides[side].team[s.sides[side].active];
export const volOf = (s: BattleState, side: SideId) => s.sides[side].vol[active(s, side).uid];
const held = (m: Mon, id: HeldId) => m.held === id;

function freshVol(): Volatile {
  return { energy: 2, shield: 0, stages: { atk: 0, def: 0, spd: 0 }, turnsIn: 0, freezeTurns: 0, sleepTurns: 0, undyingUsed: false };
}

type SideInit = { team: Mon[]; name: string; mods?: SideMods; boss?: boolean };
export function createBattle(rng: Rng, a: SideInit, b: SideInit, wild: boolean, domain?: DomainId, godhand = false): BattleState {
  const mk = (x: SideInit): Side => {
    const vol: Record<string, Volatile> = {};
    x.team.forEach((m) => { vol[m.uid] = freshVol(); vol[m.uid].energy += (x.mods?.energy ?? 0) + (held(m, 'sparkcell') ? 1 : 0); });
    return { team: x.team, active: Math.max(0, x.team.findIndex((m) => m.hp > 0)), vol, name: x.name, mods: x.mods, boss: x.boss };
  };
  const st: BattleState = { rng, turn: 1, sides: [mk(a), mk(b)], wild, over: null, needSwitch: [false, false], field: null, traps: [0, 0], domain, godhand: godhand ? { survive: 20, rewinds: 0, loveTurn: 0, passion: [], pulled: {}, saved: {} } : undefined };
  for (const side of [0, 1] as SideId[]) bubble(st, side);
  // 潮汐護甲：先發夥伴開場就有護盾
  for (const side of [0, 1] as SideId[]) {
    const n = bn(st, side, 'x_tidearmor'); if (!n) continue;
    const m = active(st, side), v = volOf(st, side); v.shield = Math.max(v.shield, Math.floor(maxHp(m) * (0.1 + 0.1 * n)));
  }
  return st;
}

/** 泡泡護符：上場時獲得護盾 */
function bubble(s: BattleState, side: SideId, ev?: BEvent[]) {
  const m = active(s, side);
  if (!held(m, 'bubblecharm') || m.hp <= 0) return;
  const v = volOf(s, side); v.shield = Math.max(v.shield, Math.floor(maxHp(m) * 0.15));
  ev?.push({ t: 'shield', side, amount: v.shield });
}

const stageMult = (s: number) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
const nameOf = (s: BattleState, side: SideId) => isGodHand(active(s, side)) ? '神之手' : (side === 1 && s.final ? '' : side === 1 && s.wild ? '野生的 ' : side === 1 ? '對手的 ' : '') + formOf(active(s, side)).name;

function effSpeed(s: BattleState, side: SideId): number {
  const m = active(s, side), v = volOf(s, side), f = formOf(m);
  let spd = statsOf(m).spd * stageMult(v.stages.spd);
  if (m.status === 'para') spd *= 0.5;
  if (hasAb(f, 'firststrike') && v.turnsIn === 0) spd *= 2;
  if (hasAb(f, 'stormking')) spd *= 1.2;
  if (hasAb(f, 'swiftswim')) spd *= 1.15;
  if (held(m, 'swiftfin')) spd *= 1.2;
  return spd;
}

export function skillFor(m: Mon, slot: number): Skill {
  return slot === -2 ? (m.form === MOXU_ASCENDED ? SKILLS[MOXU_ASCENDED_ULT] : MOXU_ULT) : slot < 0 ? STRUGGLE : SKILLS[m.skills[slot]] ?? STRUGGLE;
}

export function canAfford(s: BattleState, side: SideId, slot: number): boolean {
  if (slot < 0) return true;
  const skill = skillFor(active(s, side), slot), v = volOf(s, side);
  return v.energy >= skill.cost && (skill.id !== 'oracle_tide' || v.omenMarks?.length === 3);
}

// ── 主流程：雙方各一個行動，結算一回合 ──
export function resolveTurn(s: BattleState, actions: [Action, Action]): BEvent[] {
  if (s.final) return resolveFinal(s, actions);
  const ev: BEvent[] = [];
  if (s.over) return ev;
  // 無法忽視的愛：這回合玩家只能用技能
  if (s.godhand && s.godhand.loveTurn === s.turn && actions[0].type !== 'skill') {
    const me = active(s, 0), slot = me.skills.findIndex((_, i) => canAfford(s, 0, i));
    actions = [{ type: 'skill', slot }, actions[1]];
    ev.push({ t: 'msg', text: '神之手的愛讓你無法移開視線……只能攻擊！' });
  }
  const prio = (side: SideId): number => {
    const a = actions[side];
    if (a.type === 'switch' || a.type === 'item' || a.type === 'run' || a.type === 'rod') return 10;
    if (a.type === 'pass') return 9;
    return skillFor(active(s, side), a.slot).fx?.priority ?? 0;
  };
  const order: SideId[] = [0, 1];
  order.sort((x, y) => {
    const d = prio(y) - prio(x);
    if (d) return d;
    // 顛倒法則：速度慢的先動
    const sp = (effSpeed(s, y) - effSpeed(s, x)) * (s.domain === 'void' ? -1 : 1);
    return sp || (next(s.rng) < 0.5 ? -1 : 1);
  });

  const startActive = [active(s, 0).uid, active(s, 1).uid];
  for (const side of order) {
    if (s.over) break;
    const me = active(s, side);
    const foeSide: SideId = side === 0 ? 1 : 0;
    if (me.hp <= 0) continue;
    if (actions[side].type === 'skill' && (me.uid !== startActive[side] || active(s, foeSide).hp <= 0)) continue;
    doAction(s, side, actions[side], ev);
    checkFaints(s, ev);
    checkEnrage(s, ev);
  }
  if (!s.over) { endOfTurn(s, ev); checkEnrage(s, ev); }
  s.turn++;
  if (s.godhand && !s.over && s.turn > s.godhand.survive) {
    ev.push({ t: 'msg', text: `撐過了 ${s.godhand.survive} 回合！神之手停了下來，輕輕摸了摸你的頭。` });
    s.over = { winner: 0 }; ev.push({ t: 'end', winner: 0 });
  }
  return ev;
}

function doAction(s: BattleState, side: SideId, a: Action, ev: BEvent[]) {
  if (a.type === 'pass') return;
  if (a.type === 'run') {
    const foe: SideId = side === 0 ? 1 : 0;
    const p = Math.min(0.95, 0.55 + 0.3 * (effSpeed(s, side) / Math.max(1, effSpeed(s, foe))));
    if (chance(s.rng, p)) {
      ev.push({ t: 'msg', text: '剪斷釣線，順利逃走了！' });
      s.over = { winner: side, fled: true };
      ev.push({ t: 'end', winner: side });
    } else ev.push({ t: 'msg', text: '沒能逃走！' });
    return;
  }
  if (a.type === 'switch') { switchIn(s, side, a.to, ev); return; }
  if (a.type === 'item') { useItem(s, side, a.item, a.target, ev); return; }
  if (a.type === 'rod') { if (s.final) doRod(s, ev); return; }
  useSkill(s, side, a.slot, ev);
}

export function switchIn(s: BattleState, side: SideId, to: number, ev: BEvent[]) {
  const sd = s.sides[side], out = active(s, side);
  if (out.hp > 0) {
    if (hasAb(formOf(out), 'regen')) {
      const amt = healingAmount(s, side, out, Math.floor(maxHp(out) / 4));
      out.hp += amt;
    }
    ev.push({ t: 'msg', text: `${formOf(out).name}，回來吧！` });
  }
  const v = sd.vol[out.uid];
  v.stages = { atk: 0, def: 0, spd: 0 }; v.shield = 0; v.turnsIn = 0;
  if (out.status === 'sleep') { out.status = null; v.sleepTurns = 0; }
  if (out.status === 'blind') out.status = null;
  v.charged = false; v.lockOn = false; v.counter = 0;
  sd.active = to;
  s.needSwitch[side] = false;
  const inc = sd.team[to];
  ev.push({ t: 'switch', side, index: to, form: inc.form, hp: inc.hp, energy: sd.vol[inc.uid].energy, status: inc.status });
  ev.push({ t: 'msg', text: side === 0 ? `上吧，${formOf(sd.team[to]).name}！` : `${sd.name}派出了 ${formOf(sd.team[to]).name}！` });
  bubble(s, side, ev);
  const nv = sd.vol[inc.uid];
  if (bn(s, side, 'x_surge') && inc.hp > 0) { nv.shield = Math.max(nv.shield, Math.floor(maxHp(inc) * 0.12 * bn(s, side, 'x_surge'))); ev.push({ t: 'shield', side, amount: nv.shield }); }
  if (bn(s, side, 'x_relay')) nv.relay = 1 + 0.3 * bn(s, side, 'x_relay');
  if (sd.spreadBurn && inc.hp > 0) { sd.spreadBurn = false; ev.push({ t: 'msg', text: '燎原之火延燒了過來！' }); applyStatus(s, side, 'burn', ev); }
  if ((s.traps?.[side] ?? 0) > 0 && inc.hp > 0) {
    const d = Math.max(1, Math.floor(maxHp(inc) / 8));
    inc.hp = Math.max(0, inc.hp - d);
    ev.push({ t: 'dmg', side, amount: d, hp: inc.hp, eff: 1, crit: false, shield: 0 });
    ev.push({ t: 'msg', text: `${formOf(inc).name} 撞上了暗礁！` });
    checkFaints(s, ev);
  }
}

function useItem(s: BattleState, side: SideId, item: ItemId, target: number, ev: BEvent[]) {
  const m = s.sides[side].team[target], name = formOf(m).name, mx = maxHp(m);
  ev.push({ t: 'msg', text: `使用了 ${ITEMS[item].name}！` });
  const isActive = target === s.sides[side].active;
  const from = Math.max(0, m.hp);
  if (item === 'revive') {
    m.hp = Math.floor(mx / 2); m.status = null;
    ev.push({ t: 'item', side, target, text: `${name} 復活了！`, from, hp: m.hp, max: mx });
    ev.push({ t: 'msg', text: `${name} 復活了！` });
    return;
  }
  if (item === 'ether') {
    const v = volOf(s, side); v.energy = Math.min(MAX_ENERGY, v.energy + 3);
    ev.push({ t: 'energy', side, value: v.energy });
    ev.push({ t: 'msg', text: `${formOf(active(s, side)).name} 充滿了能量！` });
    return;
  }
  const amt = healingAmount(s, side, m, item === 'potion' ? Math.floor(mx / 2) : mx);
  m.hp += amt;
  if (item === 'superpotion') m.status = null;
  if (isActive) {
    ev.push({ t: 'heal', side, amount: amt, hp: m.hp });
    if (item === 'superpotion') ev.push({ t: 'status', side, status: null });
  }
  ev.push({ t: 'item', side, target, text: `${name} 回復了 ${amt} HP${item === 'superpotion' ? '，異常也治好了' : ''}`, from, hp: m.hp, max: mx });
  ev.push({ t: 'msg', text: `${name} 回復了 ${amt} HP。` });
}

function applyStatus(s: BattleState, side: SideId, st: StatusId, ev: BEvent[]): boolean {
  const m = active(s, side);
  if (m.status || m.hp <= 0) return false;
  if (isGodHand(m)) { ev.push({ t: 'msg', text: '神之手不受任何異常狀態影響。' }); return false; }
  if (hasAb(formOf(m), 'waterbarrier')) { ev.push({ t: 'msg', text: `${nameOf(s, side)} 的水之結界擋下了異常狀態！` }); return false; }
  if (st === 'freeze' && (hasAb(formOf(m), 'colossal') || formOf(m).elems.includes('ice'))) return false;
  if (st === 'burn' && (formOf(m).elems.includes('fire') || hasAb(formOf(m), 'waterveil'))) return false;
  if (st === 'para' && formOf(m).elems.includes('elec')) return false;
  if (st === 'bleed' && (formOf(m).elems.some((e) => e === 'rock' || e === 'data') || hasAb(formOf(m), 'undying'))) return false;
  m.status = st;
  m.statusTurns = STATUS_TURNS[st] ?? 0;
  if (held(m, 'cleansebell')) m.statusTurns = Math.max(1, Math.ceil(m.statusTurns / 2));
  if (st === 'freeze') volOf(s, side).freezeTurns = 0;
  ev.push({ t: 'status', side, status: st });
  ev.push({ t: 'msg', text: `${nameOf(s, side)} ${STATUS_NAME[st]}了！` });
  return true;
}

function changeStat(s: BattleState, side: SideId, key: StatKey, delta: number, ev: BEvent[]) {
  const v = volOf(s, side), before = v.stages[key];
  v.stages[key] = Math.max(-4, Math.min(4, before + delta));
  const real = v.stages[key] - before;
  const label = { atk: '攻擊', def: '防禦', spd: '速度' }[key];
  if (!real) { ev.push({ t: 'msg', text: `${nameOf(s, side)} 的${label}已經無法再改變了。` }); return; }
  ev.push({ t: 'stat', side, key, delta: real });
  ev.push({ t: 'msg', text: `${nameOf(s, side)} 的${label}${real > 0 ? (real > 1 ? '大幅提高' : '提高') : '下降'}了！` });
}

function useSkill(s: BattleState, side: SideId, slot: number, ev: BEvent[]) {
  const me = active(s, side), foe: SideId = side === 0 ? 1 : 0, v = volOf(s, side);
  const myName = nameOf(s, side);

  // 行動前的異常狀態判定
  if (me.status === 'sleep') {
    if (v.sleepTurns > 0) {
      v.sleepTurns--;
      ev.push({ t: 'msg', text: `${myName} 正在呼呼大睡……` });
      return;
    }
    me.status = null; ev.push({ t: 'status', side, status: null });
    ev.push({ t: 'msg', text: `${myName} 醒過來了！` });
    if (v.stages.def > 0) { v.stages.def--; ev.push({ t: 'stat', side, key: 'def', delta: -1 }); }
  }
  if (me.status === 'freeze') {
    v.freezeTurns++;
    if (v.freezeTurns >= 3 || chance(s.rng, 0.3)) {
      me.status = null; ev.push({ t: 'status', side, status: null }); ev.push({ t: 'msg', text: `${myName} 的冰融化了！` });
    } else { ev.push({ t: 'msg', text: `${myName} 被凍住了，無法行動！` }); return; }
  }
  if (me.status === 'para' && chance(s.rng, 0.25)) { ev.push({ t: 'msg', text: `${myName} 全身麻痺，無法行動！` }); return; }

  let sk = skillFor(me, slot);
  if (!canAfford(s, side, slot)) sk = STRUGGLE;
  if (me.status === 'glitch' && me.skills.length > 1 && chance(s.rng, 0.3)) {
    const altSlot = int(s.rng, 0, me.skills.length - 1), alt = SKILLS[me.skills[altSlot]];
    if (canAfford(s, side, altSlot)) { sk = alt; ev.push({ t: 'msg', text: `資料錯亂！技能變成了 ${alt.name}！` }); }
  }
  if (sk.id === 'oracle_tide') {
    v.omenMarks = [];
    ev.push({ t: 'omen', side, marks: [] });
  }
  v.energy -= sk.cost;
  ev.push({ t: 'energy', side, value: v.energy });
  if (sk !== STRUGGLE) { me.style ??= { atk: 0, guard: 0 }; if (sk.power > 0) me.style.atk++; else me.style.guard++; }
  ev.push({ t: 'use', side, skill: sk.id });
  if (sk.id !== 'oracle_tide' && !MOXU_ASCENDED_SKILLS.includes(sk.id)) ev.push({ t: 'msg', text: `${myName} 使用了 ${sk.name}！` });

  if (sk.id.startsWith('gh_')) { godHandSkill(s, side, sk.id, ev); return; }
  const fx = sk.fx ?? {};
  if (fx.energy) { v.energy = Math.min(MAX_ENERGY, v.energy + fx.energy); ev.push({ t: 'energy', side, value: v.energy }); }

  // 變化技
  if (sk.power === 0) {
    if (fx.cleanse && me.status) {
      me.status = null; ev.push({ t: 'status', side, status: null });
      ev.push({ t: 'msg', text: `${myName} 的異常狀態治好了！` });
    }
    if (fx.heal) {
      const mx = maxHp(me), amt = healingAmount(s, side, me, Math.floor(mx * fx.heal));
      me.hp += amt; ev.push({ t: 'heal', side, amount: amt, hp: me.hp });
      ev.push({ t: 'msg', text: amt > 0 ? `${myName} 回復了 ${amt} HP！` : `${myName} 的 HP 已經是滿的。` });
    }
    if (fx.selfSleep) {
      me.status = 'sleep'; v.sleepTurns = fx.selfSleep;
      ev.push({ t: 'status', side, status: 'sleep' });
      ev.push({ t: 'msg', text: `${myName} 睡著了！（${fx.selfSleep} 回合）` });
      changeStat(s, side, 'def', 1, ev);
    }
    if (fx.shield) {
      v.shield = Math.floor(maxHp(me) * fx.shield); ev.push({ t: 'shield', side, amount: v.shield });
      ev.push({ t: 'msg', text: `${myName} 被護盾包圍了！` });
    }
    if (fx.charge) { v.charged = true; ev.push({ t: 'msg', text: `${myName} 正在蓄力！下一次攻擊威力加倍！` }); }
    if (fx.lockOn) { v.lockOn = true; ev.push({ t: 'msg', text: `${myName} 鎖定了目標！下一次攻擊必定命中要害！` }); }
    if (fx.counter) { v.counter = fx.counter; ev.push({ t: 'msg', text: `${myName} 擺出了反擊的架勢！` }); }
    if (fx.field) {
      const turns = fx.field.turns + (held(me, 'tidecrest') ? 2 : 0);
      s.field = { id: fx.field.id, turns };
      ev.push({ t: 'field', id: fx.field.id, turns });
      ev.push({ t: 'msg', text: `場地變成了「${FIELDS[fx.field.id].name}」！（${turns} 回合）` });
    }
    if (fx.trap) {
      s.traps ??= [0, 0];
      s.traps[foe] = fx.trap;
      ev.push({ t: 'trap', side: foe, turns: fx.trap });
      ev.push({ t: 'msg', text: `對手的場地布滿了暗礁！（${fx.trap} 回合）` });
    }
    if (fx.stat?.self) changeStat(s, side, fx.stat.key, fx.stat.delta, ev);
    if (fx.status || (fx.stat && !fx.stat.self)) {
      if (!chance(s.rng, hitChance(s, side, sk))) { ev.push({ t: 'miss', side }); ev.push({ t: 'msg', text: '但是沒有命中！' }); return; }
      let any = false;
      if (fx.status) any = applyStatus(s, foe, fx.status.id, ev) || any;
      if (fx.stat && !fx.stat.self) { changeStat(s, foe, fx.stat.key, fx.stat.delta, ev); any = true; }
      if (!any) ev.push({ t: 'msg', text: '但是沒有效果……' });
    }
    return;
  }

  // 攻擊技
  const sure = sk.id === 'luresnap' || v.lockOn;
  if (!sure && !chance(s.rng, hitChance(s, side, sk))) {
    ev.push({ t: 'miss', side }); ev.push({ t: 'msg', text: `${myName} 的攻擊沒有命中！` });
    v.charged = false;
    if (fx.selfKO) selfKO(s, side, ev);
    return;
  }
  // 蓄水：水屬性攻擊改為回復
  const tgt = active(s, foe);
  if (sk.elem === 'water' && hasAb(formOf(tgt), 'waterabsorb')) {
    const mx = maxHp(tgt), amt = healingAmount(s, foe, tgt, Math.floor(mx / 4));
    tgt.hp += amt;
    ev.push({ t: 'heal', side: foe, amount: amt, hp: tgt.hp });
    ev.push({ t: 'msg', text: `${nameOf(s, foe)} 的蓄水吸收了攻擊${amt > 0 ? `，回復 ${amt} HP！` : '！'}` });
    v.charged = false; v.lockOn = false;
    return;
  }
  // 閃避：被麻痺、冰凍、睡著時沒辦法閃
  if (!sure && !['para', 'freeze', 'sleep'].includes(tgt.status ?? '') && chance(s.rng, dodgeRate(formOf(tgt)) + (held(tgt, 'ripplecloak') ? 0.08 : 0))) {
    ev.push({ t: 'dodge', side: foe }); ev.push({ t: 'msg', text: `${nameOf(s, foe)} 靈巧地閃開了！` });
    v.charged = false; v.lockOn = false;
    if (fx.selfKO) selfKO(s, side, ev);
    return;
  }
  const chained = !!fx.chain && tgt.status === fx.chain.id;
  if (chained) ev.push({ t: 'msg', text: `趁對手${STATUS_NAME[fx.chain!.id]}，威力提升了！` });
  else if (fx.vsStatus && tgt.status) ev.push({ t: 'msg', text: '趁虛而入，威力提升了！' });
  if (v.charged && sk.id !== 'oracle_tide' && !MOXU_ASCENDED_SKILLS.includes(sk.id)) ev.push({ t: 'msg', text: '釋放蓄積的力量！' });
  let hits = fx.multi ? int(s.rng, fx.multi[0], fx.multi[1]) + bn(s, side, 'x_chain') : 1;
  if (!fx.multi && isBasicAttack(sk.id) && bn(s, side, 'x_echo') && chance(s.rng, 0.4)) { hits = 2; ev.push({ t: 'msg', text: '回音！普攻再打了一次！' }); }
  let total = 0, landed = 0;
  for (let h = 0; h < hits; h++) {
    const target = active(s, foe);
    if (target.hp <= 0 || me.hp <= 0) break;
    const r = calcDamage(s, side, foe, sk, h);
    landed++;
    // 格擋：這一下傷害減少 40%
    if (target.status !== 'freeze' && target.status !== 'sleep' && chance(s.rng, blockRate(formOf(target)))) {
      r.dmg = Math.max(1, Math.floor(r.dmg * 0.6));
      ev.push({ t: 'block', side: foe });
      if (sk.id !== 'oracle_tide' && !MOXU_ASCENDED_SKILLS.includes(sk.id)) ev.push({ t: 'msg', text: `${nameOf(s, foe)} 擋下了一部分傷害！` });
    }
    const real = dealDamage(s, foe, r.dmg, r.eff, r.crit, sk.elem, ev);
    recordOracleHit(s, foe, sk.id, ev);
    total += real;
    afterHitAbilities(s, side, foe, ev);
    // 反擊架勢：把傷害反彈回去
    const fv = volOf(s, foe);
    if (fv.counter && real > 0 && me.hp > 0) {
      const back = Math.max(1, Math.floor(real * fv.counter));
      me.hp = Math.max(0, me.hp - back);
      ev.push({ t: 'dmg', side, amount: back, hp: me.hp, eff: 1, crit: false, shield: v.shield });
      ev.push({ t: 'msg', text: `${nameOf(s, foe)} 反彈了 ${back} 點傷害！` });
    }
  }
  v.charged = false; v.lockOn = false; v.relay = undefined;
  if (hits > 1) ev.push({ t: 'msg', text: `擊中了 ${landed} 次！` });
  const drain = (fx.drain ?? 0) + (held(me, 'leechcoral') ? 0.15 : 0);
  if (drain && total > 0 && me.hp > 0) {
    const amt = healingAmount(s, side, me, Math.floor(total * drain));
    if (amt > 0) { me.hp += amt; ev.push({ t: 'heal', side, amount: amt, hp: me.hp }); ev.push({ t: 'msg', text: `${myName} 吸取了 ${amt} HP！` }); }
  }
  if (fx.recoil && total > 0 && me.hp > 0) {
    const d = Math.max(1, Math.floor(total * fx.recoil));
    me.hp = Math.max(0, me.hp - d);
    ev.push({ t: 'dmg', side, amount: d, hp: me.hp, eff: 1, crit: false, shield: v.shield });
    ev.push({ t: 'msg', text: `${myName} 也受到了反作用力的傷害！` });
  }
  if (fx.steal && total > 0) {
    const fv = volOf(s, foe), n = Math.min(fx.steal, fv.energy);
    if (n > 0) {
      fv.energy -= n; v.energy = Math.min(MAX_ENERGY, v.energy + n);
      ev.push({ t: 'energy', side: foe, value: fv.energy }); ev.push({ t: 'energy', side, value: v.energy });
      ev.push({ t: 'msg', text: `${myName} 偷走了 ${n} 點能量！` });
    }
  }
  if (active(s, foe).hp > 0) {
    if (held(me, 'venomspine') && total > 0 && chance(s.rng, 0.2)) applyStatus(s, foe, 'poison', ev);
    if (bn(s, side, 'x_ignite') && total > 0 && chance(s.rng, 0.15 * bn(s, side, 'x_ignite'))) applyStatus(s, foe, 'burn', ev);
    if (fx.status && chance(s.rng, statusChance(s, fx.status.id, fx.status.chance))) applyStatus(s, foe, fx.status.id, ev);
    if (fx.stat && !fx.stat.self && chance(s.rng, fx.stat.chance ?? 1)) changeStat(s, foe, fx.stat.key, fx.stat.delta, ev);
  }
  if (fx.stat?.self && me.hp > 0) changeStat(s, side, fx.stat.key, fx.stat.delta, ev);
  if (fx.selfKO && me.hp > 0) selfKO(s, side, ev);
}

function selfKO(s: BattleState, side: SideId, ev: BEvent[]) {
  const me = active(s, side);
  const d = me.hp; me.hp = 0;
  ev.push({ t: 'dmg', side, amount: d, hp: 0, eff: 1, crit: false, shield: 0 });
  ev.push({ t: 'msg', text: `${nameOf(s, side)} 耗盡了所有力量！` });
}

/** 命中率：致盲 ×0.6、濃霧 ×0.8（暗屬性不受濃霧影響） */
export function hitChance(s: BattleState, side: SideId, sk: Skill): number {
  let acc = sk.acc / 100;
  if (active(s, side).status === 'blind') acc *= 0.6;
  if (s.field?.id === 'fog' && sk.elem !== 'dark') acc *= 0.8;
  if (s.field?.id === 'abyss' && sk.elem !== 'dark' && sk.power > 0) acc *= 0.85;
  return acc;
}

/** 場地會讓某些異常更容易發生 */
function statusChance(s: BattleState, id: StatusId, p: number): number {
  if (s.field?.id === 'aurora' && id === 'freeze') return Math.min(1, p * 2);
  if (s.field?.id === 'grid' && id === 'glitch') return Math.min(1, p * 2);
  return p;
}

/** 技能在目前狀況下的實際威力（條件加成、蓄力、場地） */
export function effPower(s: BattleState, side: SideId, foe: SideId, sk: Skill): number {
  const me = active(s, side), tg = active(s, foe), fx = sk.fx ?? {};
  let p = sk.power;
  if (fx.lowHp) p *= 1 + fx.lowHp * Math.max(0, Math.min(1, 1 - me.hp / maxHp(me)));
  if (fx.vsStatus && tg.status) p *= fx.vsStatus;
  if (fx.chain && tg.status === fx.chain.id && fx.chain.mult) p *= fx.chain.mult;
  if (volOf(s, side).charged) p *= 2;
  const f = s.field?.id;
  if (f === 'tide') { if (sk.elem === 'water') p *= 1.5; if (sk.elem === 'fire') p *= 0.5; }
  if (f === 'lava' && sk.elem === 'fire') p *= 1.2;
  if (f === 'storm' && sk.elem === 'elec') p *= 1.5;
  if (f === 'aurora' && (sk.elem === 'ice' || sk.elem === 'fly')) p *= 1.3;
  if (f === 'grid' && sk.elem === 'data') p *= 1.5;
  if (f === 'grove' && sk.elem === 'grass') p *= 1.5;
  if (f === 'abyss' && sk.elem === 'dark') p *= 1.5;
  if (s.domain && sk.elem === DOMAINS[s.domain].elem) p *= 1.25;
  return p;
}

export function calcDamage(s: BattleState, side: SideId, foe: SideId, sk: Skill, hit = 0) {
  const me = active(s, side), tg = active(s, foe);
  const fm = formOf(me), ft = formOf(tg);
  const vm = volOf(s, side), vt = volOf(s, foe);
  const ma = s.sides[side].mods ?? NO_MODS, md = s.sides[foe].mods ?? NO_MODS;
  let A = statsOf(me).atk * stageMult(vm.stages.atk) * ma.atk;
  if (held(me, 'sharpfang')) A *= 1.2;
  if (held(me, 'berserkscale')) A *= 1.35;
  if (me.status === 'burn') A *= 0.75;
  let D = statsOf(tg).def * stageMult(vt.stages.def) * md.def;
  if (hasAb(ft, 'sturdy')) D *= 1.2;
  if (held(tg, 'berserkscale')) D *= 0.8;
  D *= 1 + (vt.omenMarks?.length ?? 0) * 0.05;
  if (sk.id === 'oracle_tide') A = statsOf(me).def * stageMult(vm.stages.def) * ma.def * 1.15 * (held(me, 'berserkscale') ? 0.8 : 1);
  const base = (((2 * me.lv) / 5 + 2) * effPower(s, side, foe, sk) * A) / D / 50 + 2;
  const eff = effectiveness(sk.elem, ft.elems);
  const forced = vm.lockOn || (!!sk.fx?.chain?.crit && tg.status === sk.fx.chain.id);
  const exe = bn(s, side, 'L_execute');
  const crit = forced || chance(s.rng, 0.0625 + ma.crit + (held(me, 'scope') ? 0.12 : 0) + (exe ? 0.1 : 0));
  let mod = eff * (crit ? (exe ? 2.5 : 1.5) : 1) * range(s.rng, 0.85, 1);
  if (tg.status === 'burn' && bn(s, side, 'x_fuel')) mod *= 1 + 0.25 * bn(s, side, 'x_fuel');
  if (hit > 0 && bn(s, side, 'x_ramp')) mod *= 1 + 0.25 * bn(s, side, 'x_ramp') * hit;
  if (vm.relay) mod *= vm.relay;
  if (sk.elem && fm.elems.includes(sk.elem)) mod *= 1.3;
  if (sk.elem && ma.reso?.[sk.elem]) mod *= 1 + ma.reso[sk.elem]!;
  if (held(tg, 'shellplate')) mod *= 0.85;
  if (hasAb(fm, 'blazing') && sk.elem === 'fire' && me.hp < maxHp(me) / 3) mod *= 1.5;
  if ((hasAb(fm, 'tidegod') || hasAb(fm, 'oceanpower')) && sk.elem === 'water') mod *= 1.3;
  if (hasAb(ft, 'hardshell')) mod *= 0.85;
  if (hasAb(ft, 'thickfat') && (sk.elem === 'fire' || sk.elem === 'ice')) mod *= 0.5;
  return { dmg: Math.max(1, Math.floor(base * mod)), eff, crit };
}

function dealDamage(s: BattleState, side: SideId, dmg: number, eff: number, crit: boolean, elem: Elem | null, ev: BEvent[]): number {
  const m = active(s, side), v = volOf(s, side);
  let absorbed = 0;
  if (v.shield > 0) { absorbed = Math.min(v.shield, dmg); v.shield -= absorbed; dmg -= absorbed; }
  let real = Math.min(m.hp, dmg);
  if (m.hp - dmg <= 0 && hasAb(formOf(m), 'undying') && !v.undyingUsed) {
    v.undyingUsed = true; real = m.hp - 1;
  } else if (m.hp - dmg <= 0 && m.hp > 1 && held(m, 'lastpearl') && !v.pearlUsed) {
    v.pearlUsed = true; real = m.hp - 1;
    ev.push({ t: 'msg', text: `${nameOf(s, side)} 握緊了不屈珍珠，撐住了！` });
  }
  m.hp -= real;
  ev.push({ t: 'dmg', side, elem, amount: real, hp: m.hp, eff, crit, shield: v.shield });
  if (absorbed) ev.push({ t: 'msg', text: `護盾擋下了 ${absorbed} 點傷害！` });
  const att: SideId = side === 0 ? 1 : 0, am = active(s, att);
  if (absorbed && bn(s, side, 'x_thorns') && am.hp > 0) {
    const back = Math.max(1, Math.floor(absorbed * 0.5));
    am.hp = Math.max(0, am.hp - back);
    ev.push({ t: 'dmg', side: att, amount: back, hp: am.hp, eff: 1, crit: false, shield: volOf(s, att).shield });
    ev.push({ t: 'msg', text: `珊瑚刺反彈了 ${back} 點傷害！` });
  }
  if (crit) ev.push({ t: 'msg', text: '擊中要害！' });
  if (eff >= 2) ev.push({ t: 'msg', text: '效果絕佳！' });
  else if (eff > 0 && eff < 1) ev.push({ t: 'msg', text: '效果不太好……' });
  if (m.hp === 1 && real < dmg && hasAb(formOf(m), 'undying')) ev.push({ t: 'msg', text: `${nameOf(s, side)} 的不死骨撐住了！` });
  return real;
}

function afterHitAbilities(s: BattleState, att: SideId, def: SideId, ev: BEvent[]) {
  const fa = formOf(active(s, att)), fd = formOf(active(s, def));
  if (active(s, att).hp <= 0) return;
  if (hasAb(fd, 'static') && chance(s.rng, 0.3)) applyStatus(s, att, 'para', ev);
  if ((hasAb(fd, 'stinger') || hasAb(fd, 'poisonbody')) && chance(s.rng, 0.3)) applyStatus(s, att, 'poison', ev);
  if (hasAb(fa, 'lure') && active(s, def).hp > 0 && chance(s.rng, 0.2)) applyStatus(s, def, 'para', ev);
  if (hasAb(fa, 'stormking') && active(s, def).hp > 0 && chance(s.rng, 0.3)) applyStatus(s, def, 'para', ev);
}

function checkFaints(s: BattleState, ev: BEvent[]) {
  for (const side of [0, 1] as SideId[]) {
    if (side === 1 && s.final) { finalFaint(s, ev); continue; }
    const m = active(s, side);
    if (m.hp > 0 || s.needSwitch[side]) continue;
    const sd0 = s.sides[side];
    if (bn(s, side, 'L_phoenix') && !sd0.phoenixUsed) {
      sd0.phoenixUsed = true; m.hp = Math.ceil(maxHp(m) * 0.5); m.status = null;
      ev.push({ t: 'status', side, status: null });
      ev.push({ t: 'heal', side, amount: m.hp, hp: m.hp });
      ev.push({ t: 'msg', text: `不死鳥之羽燃起火焰——${nameOf(s, side)} 復活了！` });
      continue;
    }
    if (m.status === 'burn' && bn(s, side === 0 ? 1 : 0, 'x_wildfire')) sd0.spreadBurn = true;
    m.status = null;
    ev.push({ t: 'faint', side });
    ev.push({ t: 'msg', text: `${nameOf(s, side)} 倒下了！` });
    const alive = s.sides[side].team.some((x) => x.hp > 0);
    if (!alive) {
      const winner: SideId = side === 0 ? 1 : 0;
      s.over = { winner };
      ev.push({ t: 'end', winner });
      return;
    }
    s.needSwitch[side] = true;
  }
}

/** 霸主狂暴：HP 掉到一半以下時，攻擊提高、防禦下降、能量 +1（每場一次） */
function checkEnrage(s: BattleState, ev: BEvent[]) {
  if (s.over) return;
  for (const side of [0, 1] as SideId[]) {
    const sd = s.sides[side], m = active(s, side);
    if (side === 1 && s.final && (sd.active !== 0 || s.final.phase === 3)) continue;
    if (!sd.boss || sd.enraged || m.hp <= 0 || m.hp > maxHp(m) / 2) continue;
    sd.enraged = true;
    const v = volOf(s, side);
    ev.push({ t: 'enrage', side });
    ev.push({ t: 'msg', text: `${formOf(m).name} 發出震耳的怒吼——進入狂暴狀態！` });
    v.energy = Math.min(MAX_ENERGY, v.energy + 1); ev.push({ t: 'energy', side, value: v.energy });
    changeStat(s, side, 'atk', 1, ev);
    changeStat(s, side, 'def', -1, ev); // 狂暴的代價：防禦露出破綻
  }
}

export const REDUCED_HEALING_TURN = 20;

function healingAmount(s: BattleState, side: SideId, m: Mon, amount: number) {
  const reduced = side === 0 && !s.godhand && s.turn >= REDUCED_HEALING_TURN;
  const effective = reduced && amount > 0 ? Math.max(1, Math.floor(amount / 2)) : amount;
  return Math.min(maxHp(m) - m.hp, effective);
}

function endOfTurn(s: BattleState, ev: BEvent[], only?: SideId) {
  for (const side of (only === undefined ? [0, 1] : [only]) as SideId[]) {
    if (s.over) return;
    const m = active(s, side), v = volOf(s, side), f = formOf(m);
    if (m.hp <= 0) continue;
    const mx = maxHp(m);
    v.counter = 0;
    if (m.status === 'burn' || m.status === 'poison' || m.status === 'bleed') {
      const passion = m.status === 'burn' && !!s.godhand?.passion.includes(m.uid);
      const d = passion ? 2 : Math.max(1, Math.floor(mx / (m.status === 'burn' ? 16 : m.status === 'bleed' ? 12 : 10))) * (m.status === 'burn' && bn(s, side === 0 ? 1 : 0, 'x_wildfire') ? 2 : 1);
      const what = passion ? '熱情的火焰' : { burn: '灼傷', poison: '毒', bleed: '流血' }[m.status];
      m.hp = Math.max(0, m.hp - d);
      ev.push({ t: 'dmg', side, amount: d, hp: m.hp, eff: 1, crit: false, shield: v.shield });
      ev.push({ t: 'msg', text: `${nameOf(s, side)} 受到${what}的傷害！` });
      checkFaints(s, ev);
      if (m.form !== f.id) return;
      if (m.hp <= 0) continue;
    }
    // 異常狀態倒數，時間到就解除
    if (m.status && STATUS_TURNS[m.status] && m.hp > 0 && !(m.status === 'burn' && s.godhand?.passion.includes(m.uid))) {
      m.statusTurns = (m.statusTurns ?? STATUS_TURNS[m.status]!) - 1;
      if (m.statusTurns <= 0) {
        ev.push({ t: 'msg', text: `${nameOf(s, side)} 的${STATUS_NAME[m.status]}好了！` });
        m.status = null; m.statusTurns = 0; ev.push({ t: 'status', side, status: null });
      }
    }
    // 場地傷害：熔岩地面、暗礁
    const fe = f.elems;
    const lavaHurt = s.field?.id === 'lava' && !fe.includes('fire') && !fe.includes('rock');
    const reef = (s.traps?.[side] ?? 0) > 0;
    if (lavaHurt || reef) {
      const d = Math.max(1, Math.floor(mx / 16));
      m.hp = Math.max(0, m.hp - d);
      ev.push({ t: 'dmg', side, amount: d, hp: m.hp, eff: 1, crit: false, shield: v.shield });
      ev.push({ t: 'msg', text: lavaHurt ? `${nameOf(s, side)} 被熔岩燙傷了！` : `${nameOf(s, side)} 被暗礁割傷了！` });
      checkFaints(s, ev);
      if (m.form !== f.id) return;
      if (m.hp <= 0 || s.over) continue;
    }
    if ((hasAb(f, 'moist') || hasAb(f, 'photosyn') || hasAb(f, 'waterveil')) && m.hp < mx) {
      const amt = healingAmount(s, side, m, Math.max(1, Math.floor(mx / 16)));
      m.hp += amt; ev.push({ t: 'heal', side, amount: amt, hp: m.hp });
    }
    if (s.field?.id === 'grove' && m.hp < mx) {
      const amt = healingAmount(s, side, m, Math.max(1, Math.floor(mx / (fe.includes('grass') ? 8 : 16))));
      m.hp += amt; ev.push({ t: 'heal', side, amount: amt, hp: m.hp });
    }
    if (s.domain === 'forest' && m.hp < mx) { // 領域效果：敵我雙方都有
      // 敵人也會回復，但量比較少（霸主、守護者 HP 很多，回復太多會打不完）
      const amt = healingAmount(s, side, m, Math.max(1, Math.floor(mx / (side === 1 ? 24 : fe.includes('grass') ? 10 : 16))));
      m.hp += amt; ev.push({ t: 'heal', side, amount: amt, hp: m.hp });
    }
    v.turnsIn++;
    v.energy = Math.min(MAX_ENERGY, v.energy + 1 + (s.domain === 'core' && (side === 0 || s.turn % 2 === 0) ? 1 : 0) + (bn(s, side, 'L_tideking') ? 1 : 0) + (hasAb(f, 'tidegod') || hasAb(f, 'dragonpresence') ? 1 : 0));
    ev.push({ t: 'energy', side, value: v.energy });
  }
  if (s.over || only !== undefined) return;
  if (s.field) {
    s.field.turns--;
    if (s.field.turns <= 0) { ev.push({ t: 'msg', text: `「${FIELDS[s.field.id].name}」消失了。` }); s.field = null; ev.push({ t: 'field', id: null, turns: 0 }); }
    else ev.push({ t: 'field', id: s.field.id, turns: s.field.turns });
  }
  for (const side of [0, 1] as SideId[]) {
    if (!s.traps?.[side]) continue;
    s.traps[side]--;
    ev.push({ t: 'trap', side, turns: s.traps[side] });
    if (!s.traps[side]) ev.push({ t: 'msg', text: '暗礁沉入了海底。' });
  }
}

// 倒下後的強制換人（不算一回合）
/** 生命石：全隊以 50% HP 復活，出場中的夥伴原地站起來，戰鬥繼續 */
export function lifeStoneRevive(s: BattleState, side: SideId) {
  const sd = s.sides[side];
  for (const m of sd.team) {
    if (m.hp > 0) continue;
    m.hp = Math.max(1, Math.floor(maxHp(m) / 2)); m.status = null;
    sd.vol[m.uid] = freshVol(); sd.vol[m.uid].energy += sd.mods?.energy ?? 0;
  }
  s.over = null;
  s.needSwitch[side] = false;
}

export function forcedSwitch(s: BattleState, side: SideId, to: number): BEvent[] {
  const ev: BEvent[] = [];
  switchIn(s, side, to, ev);
  return ev;
}

// ── AI ──
/** 神之手的技能 */
function recordOracleHit(s: BattleState, side: SideId, skill: string, ev: BEvent[]) {
  const m = active(s, side), v = volOf(s, side);
  if (!hasAb(formOf(m), 'omen') || m.hp <= 0 || v.omenTurn === s.turn) return;
  v.omenTurn = s.turn;
  const lit = v.omenMarks ?? [];
  if (lit.length >= 3) return;
  v.omenMarks = [...lit, nextOracleMark(lit, skill)];
  ev.push({ t: 'omen', side, marks: v.omenMarks });
}

function godHandSkill(s: BattleState, side: SideId, id: string, ev: BEvent[]) {
  const g = s.godhand, foe: SideId = side === 0 ? 1 : 0, tg = active(s, foe), tname = nameOf(s, foe);
  if (!g) return;
  if (id === 'gh_toss') {
    const n = int(s.rng, 1, 20), hits = Math.min(n, tg.hp);
    ev.push({ t: 'toss', side: foe, hits });
    for (let i = 0; i < hits; i++) { tg.hp = Math.max(0, tg.hp - 1); ev.push({ t: 'dmg', side: foe, amount: 1, hp: tg.hp, eff: 1, crit: false, shield: 0 }); if (i === 0) recordOracleHit(s, foe, id, ev); }
    ev.push({ t: 'msg', text: `神之手抓起 ${tname} 拋來拋去！拋接了 ${n} 次！` });
  } else if (id === 'gh_love') {
    g.loveTurn = s.turn + 1;
    ev.push({ t: 'msg', text: `神之手緊緊盯著 ${tname}……下一回合只能攻擊，不能做別的事！` });
  } else if (id === 'gh_fire') {
    tg.status = 'burn'; tg.statusTurns = 99; if (!g.passion.includes(tg.uid)) g.passion.push(tg.uid);
    ev.push({ t: 'status', side: foe, status: 'burn' });
    ev.push({ t: 'msg', text: `神之手的熱情燒了起來！${tname} 陷入了不會熄滅的灼傷！（每回合 −2 HP）` });
  } else if (id === 'gh_stay') {
    if (g.rewinds >= 3) { ev.push({ t: 'msg', text: '神之手想留住時間，但什麼也沒發生。' }); return; }
    g.rewinds++; s.turn--;
    ev.push({ t: 'rewind', turn: s.turn });
    ev.push({ t: 'msg', text: `「不要走……」時間倒退了一回合！（${g.rewinds}/3）` });
  } else if (id === 'gh_pull') {
    const cand = tg.skills.map((sk, i) => ({ sk, i })).filter((x) => x.i > 0 && !isBasicAttack(x.sk));
    if (!cand.length) { ev.push({ t: 'msg', text: `神之手想拔走 ${tname} 的技能，但已經沒有可以拔的了。` }); return; }
    g.saved[tg.uid] ??= [...tg.skills];
    const take: string[] = [];
    for (let k = 0; k < 2 && cand.length; k++) take.push(cand.splice(int(s.rng, 0, cand.length - 1), 1)[0].sk);
    tg.skills = tg.skills.filter((sk) => !take.includes(sk));
    g.pulled[tg.uid] = [...(g.pulled[tg.uid] ?? []), ...take];
    ev.push({ t: 'pull', side: foe, skills: take.map((x) => SKILLS[x]?.name ?? x) });
    ev.push({ t: 'msg', text: `「不讓你走！」神之手硬生生拔走了 ${tname} 的 ${take.map((x) => SKILLS[x]?.name ?? x).join('、')}！` });
  }
}
/** 戰鬥結束後把被拔走的技能還回去 */
export function restorePulled(s: BattleState) {
  const g = s.godhand; if (!g) return;
  for (const side of s.sides) for (const m of side.team) if (g.saved[m.uid]) m.skills = g.saved[m.uid];
}
function godHandAi(s: BattleState, side: SideId): Action {
  const g = s.godhand!, me = active(s, side), tg = active(s, side === 0 ? 1 : 0);
  const slot = (id: string) => Math.max(0, me.skills.indexOf(id));
  const left = g.survive - s.turn; // 剩幾回合
  const pullable = tg.skills.filter((sk, i) => i > 0 && !isBasicAttack(sk)).length;
  if (left < 5 && pullable > 0 && !g.pulled[tg.uid] && next(s.rng) < 0.7) return { type: 'skill', slot: slot('gh_pull') };
  if (g.rewinds < 3 && s.turn >= 6 && next(s.rng) < 0.13) return { type: 'skill', slot: slot('gh_stay') };
  const opts: [string, number][] = [['gh_toss', 50], ['gh_love', g.loveTurn >= s.turn ? 0 : 18], ['gh_fire', tg.status === 'burn' && g.passion.includes(tg.uid) ? 0 : 26]];
  let x = next(s.rng) * opts.reduce((a, o) => a + o[1], 0);
  for (const [id, w] of opts) { x -= w; if (x <= 0) return { type: 'skill', slot: slot(id) }; }
  return { type: 'skill', slot: slot('gh_toss') };
}

export function aiChoose(s: BattleState, side: SideId): Action {
  // 統領者：大絕招倒數到 0 就施放
  if (s.final && side === 1 && s.sides[1].active === 0 && s.final.ultIn <= 0) return { type: 'skill', slot: -2 };
  if (s.godhand && isGodHand(active(s, side))) return godHandAi(s, side);
  const me = active(s, side), foe: SideId = side === 0 ? 1 : 0, tg = active(s, foe);
  if (s.final?.phase === 3 && side === 1 && me.form === MOXU_ASCENDED) {
    const slot = (s.turn - 1) % (MOXU_ASCENDED_SKILLS.length - 1);
    if (canAfford(s, side, slot)) return { type: 'skill', slot };
  }
  const v = volOf(s, side), hpRatio = me.hp / maxHp(me), myElems = formOf(me).elems;
  let best: { slot: number; score: number } = { slot: -1, score: 1 };
  me.skills.forEach((id, slot) => {
    const sk = SKILLS[id];
    if (!sk || id === MOXU_ASCENDED_ULT || !canAfford(s, side, slot)) return;
    const fx = sk.fx ?? {};
    let score = 0;
    if (sk.power > 0) {
      const eff = effectiveness(sk.elem, formOf(tg).elems);
      const stab = sk.elem && myElems.includes(sk.elem) ? 1.3 : 1;
      const hits = fx.multi ? (fx.multi[0] + fx.multi[1]) / 2 : 1;
      score = effPower(s, side, foe, sk) * hits * eff * stab * Math.min(1, hitChance(s, side, sk));
      if (fx.drain && hpRatio < 0.6) score *= 1.3;
      if (fx.recoil) score *= hpRatio < 0.3 ? 0.5 : 0.85;
      if (fx.selfKO) score *= hpRatio < 0.25 ? 1.3 : 0.25;
      if (fx.chain?.crit && tg.status === fx.chain.id) score *= 1.5;
      if (v.lockOn) score *= 1.5;
    } else {
      if (fx.heal) score = hpRatio < 0.35 ? 140 : hpRatio < 0.6 ? 50 : 0;
      if (fx.status) score = tg.status ? 0 : 55;
      if (fx.shield) score = v.shield > 0 ? 0 : 35;
      if (fx.stat?.self) score = v.stages[fx.stat.key] >= 2 ? 0 : 38;
      if (fx.energy) score = v.energy <= 1 ? 30 : 5;
      if (fx.charge) score = v.charged || v.energy < 3 ? 0 : 34;
      if (fx.lockOn) score = v.lockOn ? 0 : 30;
      if (fx.counter) score = hpRatio > 0.4 ? 24 : 10;
      if (fx.trap) score = (s.traps?.[foe] ?? 0) > 0 ? 0 : 30;
      if (fx.field) score = s.field?.id === fx.field.id ? 0 : 42;
      if (fx.cleanse && me.status) score = Math.max(score, 60);
    }
    score *= 0.8 + next(s.rng) * 0.4;
    if (score > best.score) best = { slot, score };
  });
  return { type: 'skill', slot: best.slot };
}

export function aiForcedSwitch(s: BattleState, side: SideId): number {
  return s.sides[side].team.findIndex((m) => m.hp > 0);
}

export const statusLabel = (st: StatusId | null) => (st ? STATUS_NAME[st] : '');
export const elemColor = (e: keyof typeof ELEM) => ELEM[e].color;

// ── 最終決戰：統領者・潮汐默旭 ──
export function startFinal(s: BattleState) {
  s.final = { phase: 1, ally: null, ultIn: ULT_EVERY - 1, rodCd: 0, rodUses: 0 };
  const main = s.sides[1].team[0];
  main.hpFixed = Math.round(maxHp(main) * FINAL_TUNE.barHp); main.hp = main.hpFixed;
}
/** 對手場上的位置：0 = 統領者，ally = 被召喚的霸主 */
export const finalSlots = (s: BattleState) => [0, ...(s.final?.ally != null ? [s.final.ally] : [])].filter((i) => s.sides[1].team[i]?.hp > 0);
export const canRod = (s: BattleState) => !!s.final && s.final.phase >= 2 && s.final.rodCd <= 0 && !s.over;

/** 暫時把某一隻設成出場中，執行完再換回統領者（引擎裡大部分邏輯都只看「出場中」的那一隻） */
function withSlot<T>(s: BattleState, idx: number, fn: () => T): T {
  s.sides[1].active = idx;
  try { return fn(); } finally { s.sides[1].active = 0; }
}
/** 幫對手方的事件標上是哪一隻 */
function tagSlot(ev: BEvent[], from: number, idx: number) {
  for (let i = from; i < ev.length; i++) { const e = ev[i] as { side?: number; slot?: number }; if (e.side === 1 && e.slot === undefined) e.slot = idx; }
}

function finalFaint(s: BattleState, ev: BEvent[]) {
  const F = s.final!, S1 = s.sides[1], main = S1.team[0];
  if (F.ally != null) {
    const al = S1.team[F.ally];
    if (al.hp <= 0) {
      al.status = null;
      ev.push({ t: 'faint', side: 1, slot: F.ally });
      ev.push({ t: 'msg', text: `${formOf(al).name} 倒下了，沉回了海裡！` });
      F.ally = null;
    }
  }
  if (main.hp > 0 || s.over) return;
  if (F.phase === 1) {
    // 第一條血沒了：第二條血補滿，召喚一隻霸主
    F.phase = 2; main.hp = maxHp(main); main.status = null; S1.enraged = false;
    const v = S1.vol[main.uid]; v.stages = { atk: 0, def: 0, spd: 0 }; v.shield = 0; v.charged = false;
    ev.push({ t: 'msg', text: '潮汐・默旭：「……不錯。那就讓你們見識，萬潮真正的力量。」' });
    ev.push({ t: 'phase2', side: 1, slot: 0, hp: main.hp, max: main.hp });
    const id = FINAL_SUMMONS[Math.floor(next(s.rng) * FINAL_SUMMONS.length)];
    const al = makeMon(id, Math.max(1, main.lv - FINAL_TUNE.summonDrop), true, true);
    S1.team.push(al); S1.vol[al.uid] = freshVol(); F.ally = S1.team.length - 1; F.summoned = id;
    ev.push({ t: 'summon', side: 1, slot: F.ally, form: id, lv: al.lv, hp: al.hp, max: maxHp(al) });
    ev.push({ t: 'msg', text: `${formOf(al).name} 回應了統領者的潮聲，加入了戰鬥！` });
    ev.push({ t: 'msg', text: '漁夫握緊了釣竿……現在可以使用「漁夫的釣竿」了！' });
    return;
  }
  if (F.phase === 2) {
    const hp = Math.round(maxHp(main) * MOXU_ASCENDED_BOOST);
    F.phase = 3; F.ultIn = ULT_EVERY - 1;
    if (F.ally != null) { S1.team[F.ally].hp = 0; F.ally = null; }
    main.form = MOXU_ASCENDED; main.skills = [...MOXU_ASCENDED_SKILLS];
    main.hpFixed = hp; main.hp = hp; main.status = null; main.statusTurns = 0;
    s.field = null; s.traps = [0, 0];
    S1.vol[main.uid] = freshVol();
    ev.push({ t: 'phase3', side: 1, slot: 0, hp, max: hp, energy: S1.vol[main.uid].energy });
    return;
  }
  main.status = null;
  ev.push({ t: 'faint', side: 1, slot: 0 });
  ev.push({ t: 'msg', text: '潮汐・默旭 的最後一條潮，平息了。' });
  s.over = { winner: 0 }; ev.push({ t: 'end', winner: 0 });
}

/** 漁夫的釣竿：魚線和魚鉤橫掃全場，對手每一隻都受到最大 HP 10% 的傷害，攻擊、防禦各降低 10% */
function doRod(s: BattleState, ev: BEvent[]) {
  const F = s.final!, S1 = s.sides[1];
  if (!canRod(s)) { ev.push({ t: 'msg', text: '釣竿還沒準備好……' }); return; }
  F.rodCd = ROD_CD; F.rodUses++;
  ev.push({ t: 'rod', side: 0 });
  ev.push({ t: 'msg', text: '漁夫跳了出來，甩起釣竿——魚線和魚鉤橫掃整片海面！' });
  const targets = finalSlots(s);
  for (const i of targets) {
    const m = S1.team[i], d = Math.max(1, Math.floor(maxHp(m) * ROD_DMG));
    m.hp = Math.max(0, m.hp - d);
    ev.push({ t: 'dmg', side: 1, slot: i, amount: d, hp: m.hp, eff: 1, crit: false, shield: S1.vol[m.uid].shield });
  }
  const mods = (S1.mods = { ...(S1.mods ?? NO_MODS) });
  mods.atk *= ROD_WEAKEN; mods.def *= ROD_WEAKEN;
  for (const i of targets) if (S1.team[i].hp > 0) ev.push({ t: 'stat', side: 1, slot: i, key: 'atk', delta: -1 });
  ev.push({ t: 'msg', text: '對手的攻擊和防禦都降低了 10%！' });
  finalFaint(s, ev);
}

function resolveFinal(s: BattleState, actions: [Action, Action]): BEvent[] {
  const ev: BEvent[] = [];
  if (s.over) return ev;
  const F = s.final!, S1 = s.sides[1];
  S1.active = 0;
  type Act = { side: SideId; idx: number; a: Action };
  const acts: Act[] = [{ side: 0, idx: 0, a: actions[0] }, { side: 1, idx: 0, a: actions[1] }];
  if (F.ally != null && S1.team[F.ally].hp > 0) {
    // 被召喚的霸主：照畫面上預告的行動（能量不夠的話重新決定）
    const ai = F.ally, plan = F.allyPlan;
    const ok = plan && (plan.type !== 'skill' || withSlot(s, ai, () => canAfford(s, 1, plan.slot)));
    acts.push({ side: 1, idx: ai, a: ok ? plan : withSlot(s, ai, () => aiChoose(s, 1)) });
  }
  F.allyPlan = undefined;
  const prio = (x: Act): number => {
    const a = x.a;
    if (a.type === 'switch' || a.type === 'item' || a.type === 'run' || a.type === 'rod') return 10;
    if (a.type === 'pass') return 9;
    return x.side === 0 ? skillFor(active(s, 0), a.slot).fx?.priority ?? 0 : withSlot(s, x.idx, () => skillFor(active(s, 1), a.slot).fx?.priority ?? 0);
  };
  const speed = (x: Act) => (x.side === 0 ? effSpeed(s, 0) : withSlot(s, x.idx, () => effSpeed(s, 1)));
  const key = acts.map((x) => ({ x, p: prio(x), sp: speed(x) * (s.domain === 'void' ? -1 : 1), r: next(s.rng) }));
  key.sort((a, b) => b.p - a.p || b.sp - a.sp || a.r - b.r);
  const start0 = active(s, 0).uid;
  const startedAscended = F.phase === 3;
  let usedUlt = false;
  for (const { x } of key) {
    if (s.over) break;
    const from = ev.length;
    if (x.side === 0) {
      const me = active(s, 0);
      if (me.hp <= 0) continue;
      if (x.a.type === 'skill' && me.uid !== start0) continue;
      if (x.a.type === 'rod') doRod(s, ev);
      else if (x.a.type === 'skill') {
        let tgt = x.a.target ?? 0;
        if (!finalSlots(s).includes(tgt)) tgt = 0;
        const a = x.a;
        withSlot(s, tgt, () => {
          doAction(s, 0, a, ev); tagSlot(ev, from, tgt);
          for (let i = from; i < ev.length; i++) { const e = ev[i]; if (e.t === 'use' && e.side === 0) e.slot = tgt; } // 讓畫面知道打的是哪一隻
        });
      } else doAction(s, 0, x.a, ev);
    } else {
      if (!finalSlots(s).includes(x.idx)) continue;
      if (x.a.type === 'skill' && active(s, 0).hp <= 0) continue;
      const a = x.a;
      withSlot(s, x.idx, () => { doAction(s, 1, a, ev); tagSlot(ev, from, x.idx); });
      if (x.idx === 0 && a.type === 'skill' && a.slot === -2) {
        usedUlt = true;
        if (!s.over && F.phase < 3) ultStatuses(s, ev);
      }
    }
    tagSlot(ev, from, 0);
    checkFaints(s, ev);
    checkEnrage(s, ev);
    if (!startedAscended && F.phase === 3) break;
  }
  if (!s.over && (startedAscended || F.phase < 3)) {
    let from = ev.length;
    endOfTurn(s, ev); tagSlot(ev, from, 0);
    const ai = F.ally;
    if (ai != null && S1.team[ai].hp > 0 && !s.over) withSlot(s, ai, () => { from = ev.length; endOfTurn(s, ev, 1); tagSlot(ev, from, ai); });
    checkEnrage(s, ev);
  }
  if (!s.over) {
    if (startedAscended || F.phase < 3) {
      F.ultIn = usedUlt ? ULT_EVERY - 1 : F.ultIn - 1;
      if (F.ultIn === 0) {
        ev.push({ t: 'ultwarn' });
        const ult = skillFor(S1.team[0], -2);
        ev.push({ t: 'msg', text: `海水開始往統領者身邊倒捲……下一回合是大絕招「${ult.name}」！` });
      }
    }
    if (F.rodCd > 0) F.rodCd--;
  }
  s.turn++;
  return ev;
}

/** 大絕招的附加效果：玩家隊伍裡每一隻還站著、沒有異常的夥伴，各中一種不同的異常（遇到免疫就換下一種） */
const ALL_STATUS: StatusId[] = ['burn', 'para', 'poison', 'freeze', 'glitch', 'sleep', 'blind', 'bleed'];
function ultStatuses(s: BattleState, ev: BEvent[]) {
  const S0 = s.sides[0], act = S0.active;
  const pool = [...ALL_STATUS];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(next(s.rng) * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  ev.push({ t: 'msg', text: '五片海域的潮水滲進了整支隊伍……每一隻夥伴都陷入了不同的異常！' });
  S0.team.forEach((m, idx) => {
    if (m.hp <= 0 || m.status) return;
    S0.active = idx;
    for (const st of [...pool]) {
      const from = ev.length;
      if (!applyStatus(s, 0, st, ev)) { ev.splice(from); continue; } // 免疫：換下一種，不顯示擋下的訊息
      pool.splice(pool.indexOf(st), 1);
      if (st === 'sleep') volOf(s, 0).sleepTurns = 2;
      // 沒有上場的夥伴：只留文字，不要改到場上那隻的狀態顯示
      if (idx !== act) for (let i = ev.length - 1; i >= from; i--) if (ev[i].t === 'status') ev.splice(i, 1);
      break;
    }
  });
  S0.active = act;
}

/** 先決定好被召喚的霸主這回合要做什麼（畫面上的「下一步」預告會用到） */
export function planAlly(s: BattleState): Action | null {
  const F = s.final;
  if (!F || F.ally == null || !(s.sides[1].team[F.ally]?.hp > 0)) return null;
  const ai = F.ally;
  F.allyPlan ??= withSlot(s, ai, () => aiChoose(s, 1));
  return F.allyPlan;
}
