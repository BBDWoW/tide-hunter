// 回合制戰鬥引擎（純邏輯，不碰畫面）。
// 兩邊都是「Side」，由誰操作（玩家、AI、之後的連線玩家）由外部決定。
// 所有隨機都走 state.rng，所以同樣的初始狀態＋同樣的行動序列一定得到同樣結果。
import { DOMAINS, type DomainId } from '../data/domains';
import { FIELDS, SKILLS, type FieldId, type Skill, type StatKey, type StatusId } from '../data/skills';
import { effectiveness, ELEM } from '../data/types';
import { blockRate, dodgeRate, formOf, maxHp, statsOf, type Mon } from './creature';
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
  counter?: number; // 本回合的反擊比例
  pearlUsed?: boolean; // 不屈珍珠已經用掉
}

export interface SideMods { atk: number; def: number; energy: number; crit: number; reso?: Partial<Record<Elem, number>> }
const NO_MODS: SideMods = { atk: 1, def: 1, energy: 0, crit: 0 };

export interface Side {
  mods?: SideMods; // 能力卡等外部加成（純資料，可序列化）
  team: Mon[];
  active: number;
  vol: Record<string, Volatile>; // 依 uid
  name: string;
  boss?: boolean; // 霸主：HP 掉到一半時會狂暴一次
  enraged?: boolean;
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
}

export type Action =
  | { type: 'skill'; slot: number } // slot = -1 → 掙扎
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

export type BEvent =
  | { t: 'msg'; text: string }
  | { t: 'use'; side: SideId; skill: string }
  | { t: 'miss'; side: SideId }
  | { t: 'dmg'; side: SideId; amount: number; hp: number; eff: number; crit: boolean; shield: number }
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
  | { t: 'end'; winner: SideId };

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
export function createBattle(rng: Rng, a: SideInit, b: SideInit, wild: boolean, domain?: DomainId): BattleState {
  const mk = (x: SideInit): Side => {
    const vol: Record<string, Volatile> = {};
    x.team.forEach((m) => { vol[m.uid] = freshVol(); vol[m.uid].energy += (x.mods?.energy ?? 0) + (held(m, 'sparkcell') ? 1 : 0); });
    return { team: x.team, active: Math.max(0, x.team.findIndex((m) => m.hp > 0)), vol, name: x.name, mods: x.mods, boss: x.boss };
  };
  const st: BattleState = { rng, turn: 1, sides: [mk(a), mk(b)], wild, over: null, needSwitch: [false, false], field: null, traps: [0, 0], domain };
  for (const side of [0, 1] as SideId[]) bubble(st, side);
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
const nameOf = (s: BattleState, side: SideId) => (side === 1 && s.wild ? '野生的 ' : side === 1 ? '對手的 ' : '') + formOf(active(s, side)).name;

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
  return slot < 0 ? STRUGGLE : SKILLS[m.skills[slot]] ?? STRUGGLE;
}

export function canAfford(s: BattleState, side: SideId, slot: number): boolean {
  if (slot < 0) return true;
  return volOf(s, side).energy >= skillFor(active(s, side), slot).cost;
}

// ── 主流程：雙方各一個行動，結算一回合 ──
export function resolveTurn(s: BattleState, actions: [Action, Action]): BEvent[] {
  const ev: BEvent[] = [];
  if (s.over) return ev;
  const prio = (side: SideId): number => {
    const a = actions[side];
    if (a.type === 'switch' || a.type === 'item' || a.type === 'run') return 10;
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
  useSkill(s, side, a.slot, ev);
}

export function switchIn(s: BattleState, side: SideId, to: number, ev: BEvent[]) {
  const sd = s.sides[side], out = active(s, side);
  if (out.hp > 0) {
    if (hasAb(formOf(out), 'regen')) {
      const amt = Math.min(maxHp(out) - out.hp, Math.floor(maxHp(out) / 4));
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
  const amt = item === 'potion' ? Math.min(mx - m.hp, Math.floor(mx / 2)) : mx - m.hp;
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
    const alt = SKILLS[me.skills[int(s.rng, 0, me.skills.length - 1)]];
    if (alt.cost <= v.energy) { sk = alt; ev.push({ t: 'msg', text: `資料錯亂！技能變成了 ${alt.name}！` }); }
  }
  v.energy -= sk.cost;
  ev.push({ t: 'energy', side, value: v.energy });
  if (sk !== STRUGGLE) { me.style ??= { atk: 0, guard: 0 }; if (sk.power > 0) me.style.atk++; else me.style.guard++; }
  ev.push({ t: 'use', side, skill: sk.id });
  ev.push({ t: 'msg', text: `${myName} 使用了 ${sk.name}！` });

  const fx = sk.fx ?? {};
  if (fx.energy) { v.energy = Math.min(MAX_ENERGY, v.energy + fx.energy); ev.push({ t: 'energy', side, value: v.energy }); }

  // 變化技
  if (sk.power === 0) {
    if (fx.cleanse && me.status) {
      me.status = null; ev.push({ t: 'status', side, status: null });
      ev.push({ t: 'msg', text: `${myName} 的異常狀態治好了！` });
    }
    if (fx.heal) {
      // 每次都回復固定比例（拖延戰鬥由第 20 回合起的漩渦處理）
      const mx = maxHp(me), amt = Math.min(mx - me.hp, Math.floor(mx * fx.heal));
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
    const mx = maxHp(tgt), amt = Math.min(mx - tgt.hp, Math.floor(mx / 4));
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
  if (v.charged) ev.push({ t: 'msg', text: '釋放蓄積的力量！' });
  const hits = fx.multi ? int(s.rng, fx.multi[0], fx.multi[1]) : 1;
  let total = 0, landed = 0;
  for (let h = 0; h < hits; h++) {
    const target = active(s, foe);
    if (target.hp <= 0 || me.hp <= 0) break;
    const r = calcDamage(s, side, foe, sk);
    landed++;
    // 格擋：這一下傷害減少 40%
    if (target.status !== 'freeze' && target.status !== 'sleep' && chance(s.rng, blockRate(formOf(target)))) {
      r.dmg = Math.max(1, Math.floor(r.dmg * 0.6));
      ev.push({ t: 'block', side: foe }); ev.push({ t: 'msg', text: `${nameOf(s, foe)} 擋下了一部分傷害！` });
    }
    const real = dealDamage(s, foe, r.dmg, r.eff, r.crit, ev);
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
  v.charged = false; v.lockOn = false;
  if (hits > 1) ev.push({ t: 'msg', text: `擊中了 ${landed} 次！` });
  const drain = (fx.drain ?? 0) + (held(me, 'leechcoral') ? 0.15 : 0);
  if (drain && total > 0 && me.hp > 0) {
    const amt = Math.min(maxHp(me) - me.hp, Math.floor(total * drain));
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

export function calcDamage(s: BattleState, side: SideId, foe: SideId, sk: Skill) {
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
  const base = (((2 * me.lv) / 5 + 2) * effPower(s, side, foe, sk) * A) / D / 50 + 2;
  const eff = effectiveness(sk.elem, ft.elems);
  const forced = vm.lockOn || (!!sk.fx?.chain?.crit && tg.status === sk.fx.chain.id);
  const crit = forced || chance(s.rng, 0.0625 + ma.crit + (held(me, 'scope') ? 0.12 : 0));
  let mod = eff * (crit ? 1.5 : 1) * range(s.rng, 0.85, 1);
  if (sk.elem && fm.elems.includes(sk.elem)) mod *= 1.3;
  if (sk.elem && ma.reso?.[sk.elem]) mod *= 1 + ma.reso[sk.elem]!;
  if (held(tg, 'shellplate')) mod *= 0.85;
  if (hasAb(fm, 'blazing') && sk.elem === 'fire' && me.hp < maxHp(me) / 3) mod *= 1.5;
  if ((hasAb(fm, 'tidegod') || hasAb(fm, 'oceanpower')) && sk.elem === 'water') mod *= 1.3;
  if (hasAb(ft, 'hardshell')) mod *= 0.85;
  if (hasAb(ft, 'thickfat') && (sk.elem === 'fire' || sk.elem === 'ice')) mod *= 0.5;
  return { dmg: Math.max(1, Math.floor(base * mod)), eff, crit };
}

function dealDamage(s: BattleState, side: SideId, dmg: number, eff: number, crit: boolean, ev: BEvent[]): number {
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
  ev.push({ t: 'dmg', side, amount: real, hp: m.hp, eff, crit, shield: v.shield });
  if (absorbed) ev.push({ t: 'msg', text: `護盾擋下了 ${absorbed} 點傷害！` });
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
    const m = active(s, side);
    if (m.hp > 0 || s.needSwitch[side]) continue;
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

export const VORTEX_TURN = 20;

function endOfTurn(s: BattleState, ev: BEvent[]) {
  if (s.turn === VORTEX_TURN) ev.push({ t: 'msg', text: '海面開始捲起漩渦！每回合雙方都會受到傷害。' });
  for (const side of [0, 1] as SideId[]) {
    if (s.over) return;
    const m = active(s, side), v = volOf(s, side), f = formOf(m);
    if (m.hp <= 0) continue;
    const mx = maxHp(m);
    v.counter = 0;
    if (m.status === 'burn' || m.status === 'poison' || m.status === 'bleed') {
      const d = Math.max(1, Math.floor(mx / (m.status === 'burn' ? 16 : m.status === 'bleed' ? 12 : 10)));
      const what = { burn: '灼傷', poison: '毒', bleed: '流血' }[m.status];
      m.hp = Math.max(0, m.hp - d);
      ev.push({ t: 'dmg', side, amount: d, hp: m.hp, eff: 1, crit: false, shield: v.shield });
      ev.push({ t: 'msg', text: `${nameOf(s, side)} 受到${what}的傷害！` });
      checkFaints(s, ev);
      if (m.hp <= 0) continue;
    }
    // 異常狀態倒數，時間到就解除
    if (m.status && STATUS_TURNS[m.status] && m.hp > 0) {
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
      if (m.hp <= 0 || s.over) continue;
    }
    if (s.turn >= VORTEX_TURN) {
      const d = Math.max(1, Math.floor((mx * (s.turn - VORTEX_TURN + 1)) / 12));
      m.hp = Math.max(0, m.hp - d);
      ev.push({ t: 'dmg', side, amount: d, hp: m.hp, eff: 1, crit: false, shield: v.shield });
      checkFaints(s, ev);
      if (m.hp <= 0 || s.over) continue;
    }
    if ((hasAb(f, 'moist') || hasAb(f, 'photosyn') || hasAb(f, 'waterveil')) && m.hp < mx && s.turn < VORTEX_TURN) {
      const amt = Math.min(mx - m.hp, Math.max(1, Math.floor(mx / 16)));
      m.hp += amt; ev.push({ t: 'heal', side, amount: amt, hp: m.hp });
    }
    if (s.field?.id === 'grove' && m.hp < mx && s.turn < VORTEX_TURN) {
      const amt = Math.min(mx - m.hp, Math.max(1, Math.floor(mx / (fe.includes('grass') ? 8 : 16))));
      m.hp += amt; ev.push({ t: 'heal', side, amount: amt, hp: m.hp });
    }
    if (s.domain === 'forest' && side === 0 && m.hp < mx && s.turn < VORTEX_TURN) {
      const amt = Math.min(mx - m.hp, Math.max(1, Math.floor(mx / (fe.includes('grass') ? 10 : 16))));
      m.hp += amt; ev.push({ t: 'heal', side, amount: amt, hp: m.hp });
    }
    v.turnsIn++;
    v.energy = Math.min(MAX_ENERGY, v.energy + 1 + (s.domain === 'core' && side === 0 ? 1 : 0) + (hasAb(f, 'tidegod') || hasAb(f, 'dragonpresence') ? 1 : 0));
    ev.push({ t: 'energy', side, value: v.energy });
  }
  if (s.over) return;
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
export function aiChoose(s: BattleState, side: SideId): Action {
  const me = active(s, side), foe: SideId = side === 0 ? 1 : 0, tg = active(s, foe);
  const v = volOf(s, side), hpRatio = me.hp / maxHp(me), myElems = formOf(me).elems;
  let best: { slot: number; score: number } = { slot: -1, score: 1 };
  me.skills.forEach((id, slot) => {
    const sk = SKILLS[id];
    if (!sk || sk.cost > v.energy) return;
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
