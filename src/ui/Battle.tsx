import { fx as visualEffects } from '../render/fx';
import { MOXU_ASCENDED, MOXU_ASCENDED_SKILLS } from '../data/moxu';
import { ensureSprite } from '../render/art';
import { drawOracleTide, loadOracleArt } from '../render/oracle';
import { drawGodHand } from './GodHand';
import { DOMAINS, isDomain } from '../data/domains';
import { Icon } from './Icon';
// 戰鬥畫面：把引擎吐出的事件依序播放成動畫，並提供玩家的選單
import { HELD } from '../data/held';
import { useEffect, useRef, useState } from 'preact/hooks';
import { FORMS } from '../data/creatures';
import { FIELDS, SKILLS, type FieldId, type StatusId } from '../data/skills';
import { effectiveness, ELEM, RARITY, type Elem } from '../data/types';
import {
  active, aiChoose, battleEffectiveness, aiForcedSwitch, canAfford, canRod, createBattle, battleStats, battleMaxHp, clearConvergence, finalSlots, skillFor, planAlly, startFinal, effPower, forcedSwitch, hitChance, ITEMS, lifeStoneRevive, MAX_ENERGY, REDUCED_HEALING_TURN, resolveTurn, restorePulled, statusLabel, volOf,
  type Action, type BattleState, type BEvent, type ItemId, type SideId,
} from '../game/battle';
import { blockRate, dodgeRate, formOf, maxHp, type Mon } from '../game/creature';
import { makeRng, next } from '../game/rng';
import { catchChance, rollShakes } from '../game/capture';
import { foeMods, battleMods, boon, LANDING_BONUS, zoneOf } from '../game/run';
import type { Encounter, RunState } from '../game/run';
import { spriteSize } from '../render/pixel';
import { animatedFx, drawFx, FX_MS, fxFrames, fxOffset, fxSkill, hasFx, loadFx, moxuFx } from '../render/vfx';
import { auraColor, burst, elemBurst, drawBattle, drawNet, fisherCanvas, H, monSlot, view, W, type Beam, type MonView, type Particle } from '../render/scene';
import { Tip, AbilityLines, Bar, ElemChip, Elems, Energy, IvStars, RarityTag, SkillLine, Sprite, StageTag } from './components';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';
import { MenuItem } from './Screens';
import { Reel } from './Reel';
import { sfx } from '../audio/engine';

export interface BattleResult { outcome: 'win' | 'lose' | 'caught' | 'fled'; enemy: Mon; participants: string[]; team?: Mon[] }
/** 對手下一步的預告 */
interface Intent { key: string; act: Action; icon: string; name: string; elem: Elem | null; atk: boolean }

type Mode = 'busy' | 'main' | 'skills' | 'switch' | 'force' | 'items' | 'itemTarget' | 'reel' | 'lifestone';
interface Disp { form: string; lv: number; hp: number; max: number; energy: number; status: StatusId | null; shield: number; summonShield?: number; trap?: number; convergenceLoss?: number; mutant?: boolean }
interface Popup { id: number; side: number; text: string; cls: string; label?: string; dx: number } // side：畫面上的角色（0 我方、1 對手、2 被召喚的霸主）

const SPEED_KEY = 'tidehunter.speed';
/** 場地類特效鋪滿的範圍（場景座標，避開下方操作列） */
const FX_ARENA = { x: 20, y: 2, w: 216, h: 117 };
const DASH = 0.5; // 近戰衝刺的時間（秒）
const ROD_T = 1.7; // 漁夫的釣竿動畫的長度（秒）
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const waitForFxFrame = (animation: { e: number }, frame: number) => new Promise<void>(done => {
  const tick = () => animation.e >= frame ? done() : requestAnimationFrame(tick);
  requestAnimationFrame(tick);
});
/** 漁夫的釣竿：漁夫從左下跳出來 → 甩竿，魚線帶著魚鉤橫掃過每一隻對手 → 落回去 */
function drawRod(c: CanvasRenderingContext2D, t: number, foes: ({ cx: number; cy: number } | null)[]) {
  const img = fisherCanvas(false), fw = img.width * 2, fh = img.height * 2; // 放大兩倍，看得清楚
  const jump = clamp01(t / 0.35), fall = clamp01((t - 1.35) / 0.3);
  const fx = 24 + jump * 14, fy = 160 - Math.sin(jump * Math.PI * 0.5) * 84 + fall * 110;
  // 跳出來時的水花
  if (t < 0.45) { c.fillStyle = 'rgba(220,245,255,0.8)'; for (let i = 0; i < 8; i++) c.fillRect(Math.round(fx + 6 + Math.cos(i) * (6 + t * 30)), Math.round(120 - Math.abs(Math.sin(i * 2)) * t * 40), 2, 2); }
  c.imageSmoothingEnabled = false; c.drawImage(img, Math.round(fx), Math.round(fy - fh), fw, fh);
  // 甩竿：0.35～1.35 秒，魚鉤從漁夫身邊沿著弧線甩過整片海面
  const sw = clamp01((t - 0.35) / 1.0);
  if (sw > 0 && fall < 1) {
    const hx0 = fx + fw, hy0 = fy - fh + 2; // 竿尖
    const ease = sw < 0.5 ? 2 * sw * sw : 1 - Math.pow(-2 * sw + 2, 2) / 2;
    const hookX = hx0 + ease * 210, hookY = 70 + Math.sin(ease * Math.PI * 2) * 18 - Math.sin(ease * Math.PI) * 20;
    // 魚線（二次曲線）
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx0, hy0);
    c.quadraticCurveTo((hx0 + hookX) / 2, Math.min(hy0, hookY) - 40, hookX, hookY); c.stroke();
    // 甩過的軌跡
    for (let k = 1; k < 10; k++) {
      const e2 = Math.max(0, ease - k * 0.025), x = hx0 + e2 * 210, y = 70 + Math.sin(e2 * Math.PI * 2) * 18 - Math.sin(e2 * Math.PI) * 20;
      c.fillStyle = `rgba(255,231,160,${0.5 - k * 0.05})`; c.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
    // 魚鉤
    c.fillStyle = '#ffe7a0'; c.fillRect(Math.round(hookX), Math.round(hookY), 2, 5); c.fillRect(Math.round(hookX) - 2, Math.round(hookY) + 4, 3, 2); c.fillRect(Math.round(hookX) - 3, Math.round(hookY) + 2, 1, 2);
    // 掃過對手時閃一下
    for (const f of foes) if (f && Math.abs(f.cx - hookX) < 14) { c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(f.cx, f.cy, 14, 0, 7); c.fill(); }
  }
}
// 觸控裝置（沒有滑鼠移過去）：第一下看說明，再點一次才使用
const TOUCH = typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches;
// 動畫是「hit」但其實是丟出去／從遠處打的招式，不衝過去
const RANGED_HIT = new Set(['ember', 'pebble', 'icepebble', 'rockslide', 'microquake', 'bigquake']);
// 霸主登場台詞（依霸主）
const BOSS_INTRO: Record<string, string[]> = {
  whale: ['海面隆起成一座小山……', '鯨嘯張開巨口，整片淺灘的海水都在往牠嘴裡流！'],
  vine_antler_deer: ['樹林裡的藤蔓開始往同一個方向生長……', '藤角鹿踏著花瓣走來，森林在牠身後合攏。'],
  void_star_dragon: ['星光被一點一點吸走。', '虛無星龍盤旋在破碎的星空裡，低聲咆哮。'],
  domain_realm_core: ['空間像玻璃一樣出現裂痕。', '域界核心開始轉動，周圍的一切都被它改寫！'],
  // 第二、三片海域的霸主會提到「統領者」（最終大Boss的伏筆）
  frostking: ['冰層發出劈啪的碎裂聲。', '冰冠海豹王緩緩抬頭：「……又一個想往深處去的獵手。統領者會看著你的。」'],
  lavadragon: ['海水沸騰，蒸氣遮住了天空。', '熔岩海龍王從裂谷中升起：「區區獵手，也想走到統領者面前？」'],
  mainframe_leviathan: ['所有的螢幕同時閃爍：「偵測到入侵者。」', '主機海皇：「通報統領者——第三片海域，有獵手抵達。」'],
  nether_whale: ['燈光一盞一盞熄滅，只剩下深淵的黑。', '冥海巨鯨的聲音在水裡迴盪：「再往下……就是統領者的潮聲了。」'],
  tide_moxu: ['所有的浪，同時停了下來。', '潮汐・默旭：「我是統領萬潮之人。讓我看看，你們配不配得上『潮汐獵手』這個名字。」'],
};
// 霸主的稱號（登場字卡）
const BOSS_TITLE: Record<string, string> = {
  whale: '吞潮的巨口', frostking: '萬年冰冠之王', lavadragon: '裂谷的熔岩君主', mainframe_leviathan: '資料深海的主宰',
  nether_whale: '無光之海的沉默者', tide_moxu: '統領萬潮之人', vine_antler_deer: '森林的守望者', void_star_dragon: '吞噬星光的虛無', domain_realm_core: '改寫世界的核心',
};
const readSpeed = () => { try { return localStorage.getItem(SPEED_KEY) !== 'normal'; } catch { return true; } }; // 預設快速

export function Battle({ vp, run, enc, boss, onEnd }: { vp: Viewport; run: RunState; enc: Encounter; boss: boolean; onEnd: (r: BattleResult) => void }) {
  const bsRef = useRef<BattleState | null>(null);
  if (!bsRef.current) {
    bsRef.current = createBattle(makeRng((next(run.rng) * 2 ** 32) >>> 0), { team: run.party, name: '你', mods: battleMods(run) }, { team: enc.team ?? [enc.mon], name: boss ? '霸主' : enc.crew ?? '野生', boss, mods: foeMods(run) }, !enc.team && !enc.oracle, isDomain(run.zone) ? run.zone : undefined, !!enc.godhand);
    if (enc.final) {
      startFinal(bsRef.current);
      // 開發用：網址加 ?finalhp=1 讓統領者開場只剩 1 HP，方便測第二條血
      const fh = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('finalhp')) : 0;
      if (fh > 0) bsRef.current.sides[1].team[0].hp = fh;
    }
  }
  const bs = bsRef.current;
  useEffect(() => {
    if (bs.sides.some(side => side.team.some(m => m.form === 'oracle'))) void loadOracleArt().catch(() => {});
  }, [bs]);
  const [shownTurn, setShownTurn] = useState(bs.turn);
  const [shownPhase, setShownPhase] = useState(1);
  const changeAt = useRef(0);
  const crew = !!enc.team; // 對手船隊：多隻敵人、不能收服
  const gh = !!enc.godhand; // 神之手之戰：撐過 20 回合
  const final = !!enc.final; // 最終決戰：統領者・潮汐默旭
  const tossLeft = useRef(0), tossTotal = useRef(0);
  const [pulls, setPulls] = useState<{ id: number; names: string[] } | null>(null);
  const [rewind, setRewind] = useState(0);
  const snap = (side: SideId): Disp => {
    const m = active(bs, side);
    return { form: m.form, lv: m.lv, hp: m.hp, max: battleMaxHp(bs, side), energy: volOf(bs, side).energy, status: m.status, shield: volOf(bs, side).shield, convergenceLoss: volOf(bs, side).convergenceLoss, mutant: m.mutant };
  };
  const disp = useRef<Disp[]>([snap(0), snap(1)]); // [我方, 對手, 被召喚的霸主]
  // 最終決戰 1 對 2：被召喚的霸主在對手隊伍的哪個位置、玩家要打哪一隻
  const allySlot = useRef<number | null>(null);
  const [target, setTarget] = useState(0);
  const [cut, setCut] = useState<{ title: string; lines: string[]; tone?: string } | null>(null);
  /** 事件對應到畫面上的哪一隻 */
  const vi = (e: { side: number; slot?: number }) => (e.side === 0 ? 0 : e.slot != null && e.slot === allySlot.current ? 2 : 1);
  /** 畫面上第 v 隻的站位 */
  const posOf = (v: number, form: string) => (v === 0 ? monSlot(0, form) : monSlot(1, form, allySlot.current != null ? (v === 2 ? 'ally' : 'back') : undefined));
  const [, setTick] = useState(0);
  const rerender = () => setTick((x) => x + 1);
  const [mode, setMode] = useState<Mode>('busy');
  const [log, setLog] = useState<string[]>([]);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [field, setField] = useState<{ id: FieldId; turns: number } | null>(null);
  const [itemPick, setItemPick] = useState<ItemId | null>(null);
  const [fast, setFast] = useState(readSpeed);
  const fastRef = useRef(fast); fastRef.current = fast;
  const participants = useRef(new Set<string>([active(bs, 0).uid]));
  const [hover, setHover] = useState(0);
  const [peek, setPeek] = useState(-1); // 正在看說明的技能（滑鼠移過去／觸控點一下）
  const [armed, setArmed] = useState(-1); // 觸控：已經點過一下、等第二下確認的選項
  const [info, setInfo] = useState<SideId | null>(null); // 查看雙方資料
  const [infoIdx, setInfoIdx] = useState<number | undefined>(undefined); // 1 對 2 時看的是對手的哪一隻
  const [allyIntent, setAllyIntent] = useState<Intent | null>(null);
  const net = useRef<{ wob: number; glow: number } | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [intro, setIntro] = useState<null | 'dark' | 'card' | 'out'>(null); // 霸主登場畫面
  const [bossDown, setBossDown] = useState(false); // 打倒霸主的勝利畫面
  const introSkip = useRef(false);
  const [toast, setToast] = useState<{ id: number; text: string; form: string; from: number; hp: number; max: number } | null>(null);
  const intentRef = useRef<Intent | null>(null);
  /** 輪到玩家時，先決定好對手這回合要做什麼並顯示出來 */
  const planEnemy = () => {
    if (bs.over || active(bs, 1).hp <= 0) { intentRef.current = null; setIntent(null); return; }
    const key = `${bs.turn}-${active(bs, 1).uid}`;
    if (intentRef.current?.key === key) return;
    const act = aiChoose(bs, 1);
    const foeM = active(bs, 1);
    const sk = act.type === 'skill' ? (act.slot === -1 ? null : skillFor(foeM, act.slot)) : null;
    const it: Intent = sk
      ? { key, act, icon: sk.power > 0 ? 'attack' : sk.fx?.heal ? 'heal' : sk.fx?.status || (sk.fx?.stat && !sk.fx.stat.self) ? 'hinder' : 'buff', name: sk.name, elem: sk.elem, atk: sk.power > 0 }
      : { key, act, icon: 'attack', name: '掙扎', elem: null, atk: true };
    intentRef.current = it; setIntent(it);
    // 被召喚的霸主也預告下一步
    const ap = planAlly(bs), ai = bs.final?.ally;
    if (ap && ai != null) {
      const am = bs.sides[1].team[ai], ask = ap.type === 'skill' ? (ap.slot < 0 ? null : SKILLS[am.skills[ap.slot]]) : null;
      setAllyIntent(ask ? { key: `${key}-ally`, act: ap, icon: ask.power > 0 ? 'attack' : ask.fx?.heal ? 'heal' : ask.fx?.status || (ask.fx?.stat && !ask.fx.stat.self) ? 'hinder' : 'buff', name: ask.name, elem: ask.elem, atk: ask.power > 0 } : { key: `${key}-ally`, act: ap, icon: 'attack', name: '掙扎', elem: null, atk: true });
    } else setAllyIntent(null);
  };

  const mkView = (side: SideId, form: string): MonView => {
    const p = monSlot(side, form);
    return { form, omenMarks: volOf(bs, side).omenMarks, x: p.x, y: p.y, flip: side === 1, flash: 0, shake: 0, lunge: 0, alpha: 0, scale: p.scale, aura: auraColor(form, side === 1 && boss), mutant: active(bs, side).mutant };
  };
  const anim = useRef({
    mons: [mkView(0, disp.current[0].form), mkView(1, disp.current[1].form)] as MonView[],
    lungeT: [0, 0, 0], dashT: [0, 0, 0], shakeT: [0, 0, 0], recoil: [0, 0, 0], fade: [1, 1, 0] as number[], enter: [0, 0, 0] as number[],
    dashTo: [1, 0, 0] as number[], // 衝刺的目標（畫面上的第幾隻）
    parts: [] as Particle[], beams: [] as Beam[],
    fx: [] as { code: string; from: number; to: number; e: number; big?: boolean; missed?: boolean }[], // 播放中的技能特效（e = 已播放幾格；big：統領者的招式放大）
    rod: -1, // 漁夫的釣竿動畫進度（秒，-1 = 沒有在播）
    quake: 0, flash: 0, flashColor: '#ffffff',
  });
  // 開發用：網址加 ?field=storm 可以直接看場地特效
  const fieldRef = useRef<string | null>(import.meta.env.DEV ? new URLSearchParams(location.search).get('field') : null);

  const hurry = useRef(false); // 點訊息框：這一輪的演出加速
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, hurry.current ? ms * 0.15 : fastRef.current ? ms * 0.45 : ms));
  const say = (text: string) => setLog((l) => [...l.slice(-30), text]);
  const pop = (side: number, text: string, cls: string, label?: string) => {
    const id = Math.random();
    setPopups((p) => [...p, { id, side, text, cls, label, dx: (Math.random() - 0.5) * 8 }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), cls === 'crit' || cls === 'super' ? 1300 : 1000);
  };
  const shieldBreak = (side: number) => {
    sfx('shieldbreak');
    pop(side, '破盾！', 'shield-break');
  };
  /** 畫面震動、全畫面閃光 */
  const jolt = (quake: number, flash = 0, color = '#ffffff') => { const a = anim.current; a.quake = Math.max(a.quake, quake); if (flash) { a.flash = flash; a.flashColor = color; } };

  // 每一格畫面：更新動畫狀態後繪製
  const draw = (ctx: CanvasRenderingContext2D, t: number, dt: number) => {
    const a = anim.current;
    const reduce = visualEffects.reduce;
    const spd = hurry.current ? 4 : fastRef.current ? 2 : 1;
    for (const f of a.fx) {
      const skillFx = animatedFx(f.code);
      const frameMs = skillFx?.frameMs ?? (f.code === 'oracle_tide' ? 90 : moxuFx(f.code)?.frameDurationMs ?? FX_MS);
      const next = f.e + (dt * 1000 * spd) / frameMs;
      // 即使加速播放，也讓第一次碰撞的畫格真的出現在畫面上。
      f.e = skillFx && f.e < skillFx.hitFrame ? Math.min(next, skillFx.hitFrame) : next;
    }
    a.fx = a.fx.filter(f => f.e < fxFrames(f.code));
    for (let side = 0; side < a.mons.length; side++) {
      const v = a.mons[side];
      a.enter[side] = Math.min(1, a.enter[side] + dt * 2.2);
      const p = posOf(side, v.form), e = 1 - Math.pow(1 - a.enter[side], 3);
      v.x = p.x + (1 - e) * (side === 0 ? -90 : 90);
      if (side === 1 && intro) {
        const close = intro === 'out' ? 1 : 1.08;
        v.scale = p.scale * close;
        v.x = p.cx + (v.x - p.cx) * close;
        v.y = p.by + (p.y - p.by) * close;
      } else { v.scale = p.scale; v.y = p.y; }
      v.base = { x: p.bx, y: p.by };
      if (side === 2) v.y = p.y + (1 - e) * 40; // 被召喚的霸主從海裡升上來
      // 近戰：衝到對手面前再退回來
      a.dashT[side] = Math.max(0, a.dashT[side] - dt);
      const dashFx = a.fx.find(f => f.from === side && animatedFx(f.code)?.dash);
      const motion = dashFx && animatedFx(dashFx.code);
      const dash = motion && motion.dash;
      if (dashFx && dash) {
        const tg = posOf(dashFx.to, a.mons[dashFx.to].form);
        const k = dash(dashFx.e, !!dashFx.missed);
        const gap = Math.max(24, (p.cy - p.y + tg.cy - tg.y) / 2);
        const dx = (tg.cx - p.cx - Math.sign(tg.cx - p.cx) * gap) * k;
        v.x += dx;
        v.y += (tg.cy - p.cy) * k + (motion.dashLift?.(dashFx.e) ?? 0);
        v.base.x += dx;
        v.base.y += (tg.by - p.by) * k;
      } else if (a.dashT[side] > 0) {
        const other = a.dashTo[side], tg = posOf(other, a.mons[other]?.form ?? v.form);
        const k = Math.sin((1 - a.dashT[side] / DASH) * Math.PI);
        v.x += (tg.cx - p.cx - (side === 0 ? 28 : -28)) * k;
        v.y += (tg.cy - p.cy) * k;
      }
      a.lungeT[side] = Math.max(0, a.lungeT[side] - dt);
      v.lunge = Math.sin((a.lungeT[side] / 0.25) * Math.PI) * 12 * (a.lungeT[side] > 0 ? 1 : 0);
      a.recoil[side] = Math.max(0, a.recoil[side] - dt * 12);
      v.x += Math.round(a.recoil[side]) * (side === 0 ? -1 : 1);
      v.flash = Math.max(0, v.flash - dt);
      a.shakeT[side] = Math.max(0, a.shakeT[side] - dt);
      v.shake = a.shakeT[side] > 0 ? 1 : 0;
      v.alpha = e * a.fade[side];
      v.enter = a.enter[side] < 1 ? a.enter[side] : undefined;
      const dd = disp.current[side]; v.low = dd.hp > 0 && dd.hp / dd.max < 0.25;
    }
    // 套用圖集裡施術者／目標的抖動
    for (const v of a.mons) { v.ox = 0; v.oy = 0; v.castingOracle = false; }
    for (const f of a.fx) {
      if (f.code === 'oracle_tide') {
        const caster = a.mons[f.from]; caster.castingOracle = true;
        caster.oy = !reduce && f.e >= 2 && f.e < 7 ? 1 : 0;
        continue;
      }
      if (reduce) continue;
      const fr = Math.floor(f.e);
      for (const [sd, who] of [[f.from, 'caster'], [f.to, 'target']] as const) {
        const v = a.mons[sd]; if (!v) continue;
        const [ox, oy] = fxOffset(f.code, fr, who, v.flip);
        v.ox = (v.ox ?? 0) + ox * (f.big ? 2 : 1); v.oy = (v.oy ?? 0) + oy * (f.big ? 2 : 1);
      }
    }
    const fxLayer = (c: CanvasRenderingContext2D, which: 'back' | 'front', rects: ({ x: number; y: number; w: number } | null)[]) => {
      for (const f of a.fx) {
        const r0 = rects[f.from], r1 = rects[f.to];
        if (!r0 || !r1) continue;
        if (f.code === 'oracle_tide') {
          drawOracleTide(c, Math.floor(f.e), r0, a.mons[f.from].flip, r1, which === 'front');
          continue;
        }
        // 統領者的招式：特效放大成 1.8 倍
        const actor = (sd: number, r: { x: number; y: number; w: number }, big?: boolean) => { const sp = FORMS[a.mons[sd].form].sprite; return { rect: r, sprite: sp, facesLeft: a.mons[sd].flip, logical: spriteSize(sp) / (big ? 1.8 : 1) }; };
        const A = actor(f.from, r0, f.big), B = actor(f.to, r1), fr = Math.floor(f.e);
        // 統領者的日蝕特效：舞台背景鋪滿整個畫面（含左右延伸），維持比例、往下對齊
        const ar = moxuFx(f.code) ? { x: -view.bleed, y: 0, w: W + 2 * view.bleed, h: H * .72 } : f.code.startsWith('moxu_') ? (() => { const b = view.bleed, w = W + b * 2, k = Math.max(w / 192, H / 104), aw = 192 * k, ah = 104 * k; return { x: -b - (aw - w) / 2, y: (H - ah) * 0.65, w: aw, h: ah }; })() : FX_ARENA;
        if (which === 'back') {
          if (!reduce || !f.code.startsWith('moxu_')) drawFx(c, f.code, 'back', fr, A, B, ar, f.missed);
        } else {
          drawFx(c, f.code, 'front', fr, A, B, ar, f.missed);
          if (!reduce) drawFx(c, f.code, 'particles', fr, A, B, ar, f.missed);
        }
      }
    };
    // 震動、閃光慢慢消退
    const q = a.quake, fl = a.flash;
    a.quake = Math.max(0, a.quake - dt * 14); a.flash = Math.max(0, a.flash - dt * 2.2);
    drawBattle(ctx, t, dt, a.mons, a.parts, a.beams, zoneOf(run).theme, { sunAndMoon: a.mons[1].form === MOXU_ASCENDED, field: fieldRef.current, quake: q, flash: fl, flashColor: a.flashColor, fxLayer });
    if (!reduce && changeAt.current) {
      const progress = Math.min(1, (performance.now() - changeAt.current) / 1300);
      ctx.save();
      const radius = 12 + progress * 36;
      for (const [x, color] of [[W * (.25 + progress * .25), '#ffc869'], [W * (.75 - progress * .25), '#8cdaff']] as const) {
        ctx.globalAlpha = .65 * Math.sin(progress * Math.PI);
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, H * .43, radius, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    if (a.mons[1].form === 'godhand' && a.fade[1] > 0) { const c = monSlot(1, 'godhand'); drawGodHand(ctx, t, c.cx, a.mons[1].y ?? c.y, c.scale, 0, false); }
    if (net.current) { const c = monSlot(1, a.mons[1].form); const n = net.current; n.glow = Math.max(0, n.glow - dt); drawNet(ctx, c.cx, c.cy + 6, n.wob, n.glow); }
    // 1 對 2：目前選的攻擊目標腳邊有一對亮色標記
    if (allySlot.current != null && (mode === 'main' || mode === 'skills') && finalSlots(bs).length > 1) {
      const tv = target === allySlot.current ? 2 : 1, m = a.mons[tv];
      if (m) {
        const p = posOf(tv, m.form);
        for (const side of [-1, 1]) {
          const x = p.bx + side * 11;
          ctx.fillStyle = '#302442'; ctx.fillRect(x - 3, p.by, 7, 4);
          ctx.fillStyle = '#ffcf4a'; ctx.fillRect(x - 2, p.by + 1, 5, 2);
        }
      }
    }
    if (a.rod >= 0) { a.rod += dt * (hurry.current ? 3 : fastRef.current ? 1.5 : 1); drawRod(ctx, a.rod, a.mons.map((m, i) => (i === 0 || !m || a.fade[i] <= 0 ? null : posOf(i, m.form)))); if (a.rod > ROD_T) a.rod = -1; }
  };

  // 先把雙方隊伍會用到的技能特效圖載進來
  useEffect(() => { for (const sd of bs.sides) for (const m of sd.team) for (const k of m.skills) loadFx(k); if (final) {
    loadFx('moxu_daybreak');
    void ensureSprite(MOXU_ASCENDED);
    for (const id of MOXU_ASCENDED_SKILLS) loadFx(id);
  } }, []);

  // 開場
  useEffect(() => {
    (async () => {
      const ef = FORMS[enc.mon.form];
      if (boss) await bossIntro();
      else { sfx('enter'); await wait(500); }
      if (crew) { say(`「${enc.crew}」的船隊攔住了去路！（${enc.team!.length} 隻）`); await wait(500); say(`${enc.crew}派出了 ${ef.name}！`); }
      else if (boss) { for (const line of BOSS_INTRO[enc.mon.form] ?? []) { say(line); await wait(900); } say(final ? `統領者「${ef.name}」降臨了！這是最後的決戰！` : `霸主「${ef.name}」擋住了去路！`); }
      else if (gh) { say('一隻巨大的白色手，從雲裡伸了下來。'); await wait(900); say('神之手：「陪我玩 20 回合……好不好？」'); }
      else say(`野生的 ${ef.name} 出現了！`);
      if (enc.oracle) say('龜甲上的濁潮退去。卜潮靈龜正等你出招。');
      else if (gh) { /* 神之手：沒有稀有度 */ }
      else if (final) { /* 統領者：不顯示稀有度提示 */ }
      else if (enc.rarity === 'SSR') say('★ 傳說級的氣息！這可能是唯一的機會！');
      else if (enc.rarity === 'S') say('☆ 史詩級的稀有生物！');
      if (enc.mon.mutant) say('✦ 是異變個體！牠的顏色跟一般的不一樣！');
      if (enc.landing === 'perfect' || enc.landing === 'good') { await wait(500); say(`${LANDING_BONUS[enc.landing].label}！${ef.name} 受了傷${boss || crew ? '' : '，比較好捕捉'}！`); }
      if (bs.domain) { await wait(400); say(`領域效果「${DOMAINS[bs.domain].name}」：${DOMAINS[bs.domain].desc}`); await wait(900); }
      await wait(700);
      if (boss) { const a = anim.current; a.fade[0] = 1; a.enter[0] = 0; sfx('enter'); }
      say(`上吧，${formOf(active(bs, 0)).name}！`);
      await wait(500);
      setMode('main');
    })();
  }, []);

  /** 霸主登場：黑邊收進來 → 黑色剪影 → 閃光怒吼現身 → 名字字卡。點一下可以跳過 */
  async function bossIntro() {
    const a = anim.current, m = a.mons[1];
    const pause = (ms: number) => new Promise<void>((r) => { const end = Date.now() + ms; const id = setInterval(() => { if (introSkip.current || Date.now() >= end) { clearInterval(id); r(); } }, 30); });
    a.fade[0] = 0; a.enter[1] = 1; m.tint = '#05050c';
    setIntro('dark'); sfx('debuff');
    await pause(1000);
    m.tint = undefined; jolt(5, 0.55); sfx('enrage');
    const c = center(1); burst(a.parts, c.x, c.y, 'faint', null);
    setIntro('card');
    await pause(2300);
    setIntro('out');
    await pause(350);
    setIntro(null);
  }
  const center = (v: number) => { const m = anim.current.mons[v] ?? anim.current.mons[1]; const p = posOf(v, m.form); return { x: p.cx, y: p.cy }; };

  async function apply(e: BEvent, missed = false) {
    const a = anim.current, d = disp.current;
    switch (e.t) {
      case 'msg': say(e.text); await wait(560); break;
      case 'strike':
      case 'use': {
        const customFx = animatedFx(e.skill);
        if (e.t === 'strike' && !customFx?.repeat) break;
        // 施術者、目標在畫面上是第幾隻（1 對 2 時看 slot）
        const from = vi(e), to = customFx?.self ? from : e.side === 0 ? (e.slot != null && e.slot === allySlot.current ? 2 : 1) : 0;
        const moxu = from !== 0 && a.mons[from]?.form === 'tide_moxu';
        if (e.skill === 'oracle_tide') {
          await loadOracleArt().catch(() => {});
          say('卜潮靈龜使用了三卜鎮潮！'); sfx('skill:water');
          const fx = {code: e.skill, from, to, e: 0}; a.fx.push(fx);
          await waitForFxFrame(fx, 9);
          break;
        }
        const ascendedFx = moxuFx(e.skill);
        if (ascendedFx) {
          await loadFx(e.skill);
          say(`默旭使用了「${SKILLS[e.skill].name}」！`);
          sfx('enrage');
          const animation = { code: e.skill, from, to, e: 0 };
          a.fx.push(animation);
          await waitForFxFrame(animation, ascendedFx.impactFrameIndex);
          jolt(3, .18, '#badffb');
          break;
        }
        if (e.skill === 'moxu_daybreak') { await playUlt(from, to); break; }
        const sk = SKILLS[e.skill] ?? { anim: 'hit', elem: null };
        const c = center(to), me = center(from);
        const kind = sk.anim ?? 'hit';
        a.dashTo[from] = to;
        sfx(kind === 'buff' ? 'buff' : kind === 'heal' ? 'item' : `skill:${sk.elem ?? 'none'}`);
        // 統領者的招式：畫面先暗一下、閃光、震動、四周冒出光點
        if (moxu && e.t === 'use') { jolt(3.5, 0.45, '#7fd8ff'); sfx('enrage'); for (let k = 0; k < 3; k++) burst(a.parts, me.x + (Math.random() - 0.5) * 40, me.y + (Math.random() - 0.5) * 30, 'buff', 'water'); await wait(260); }
        if (customFx) {
          const animation = { code: e.skill, from, to, e: 0, missed };
          a.fx.push(animation);
          await waitForFxFrame(animation, customFx.hitFrame);
          break;
        }
        if (hasFx(e.skill)) {
          // 有專屬特效的招式：播特效，角色只做衝刺／前傾的動作
          loadFx(e.skill); a.fx.push({ code: e.skill, from, to, e: 0, big: moxu && !e.skill.startsWith('moxu_') });
          if (moxu) setTimeout(() => jolt(4, 0.3, '#ffffff'), 420);
          const st = fxSkill(e.skill).style;
          if (st === 'dash' || (kind === 'hit' && (sk as { power?: number }).power && !RANGED_HIT.has(e.skill) && st !== 'self')) { a.dashT[from] = DASH; await wait(DASH * 900); break; }
          if (st !== 'self' && st !== 'field') a.lungeT[from] = 0.25;
          await wait(moxu ? 650 : 450); break;
        }
        if (kind === 'buff' || kind === 'heal') { burst(a.parts, me.x, me.y, kind, sk.elem); }
        else if (kind === 'hit' && (sk as { power?: number }).power && !RANGED_HIT.has(e.skill)) {
          // 近戰招式：衝過去打
          a.dashT[from] = DASH;
          setTimeout(() => burst(a.parts, c.x, c.y - 4, 'hit', sk.elem), DASH * 500);
          await wait(DASH * 700); break;
        } else {
          a.lungeT[from] = 0.25;
          if (kind === 'beam') a.beams.push({ x0: me.x, y0: me.y - 6, x1: c.x, y1: c.y - 6, life: 0.35, color: '#ffffff' });
          setTimeout(() => burst(a.parts, c.x, c.y - 4, kind === 'splash' ? 'splash' : 'hit', sk.elem), 150);
        }
        await wait(260); break;
      }
      case 'convergence': {
        const slot = vi(e);
        d[slot].convergenceLoss = e.loss;
        d[slot].hp = e.hp; d[slot].max = e.max;
        sfx('debuff'); rerender();
        break;
      }
      case 'omen': {
        const m = a.mons[vi(e)]; m.omenMarks = e.marks; m.omenElapsed = 0;
        break;
      }
      case 'miss': break;
      case 'dodge': { const v = vi(e); sfx('dodge'); a.shakeT[v] = 0.15; a.lungeT[v] = 0.25; pop(v, '閃避！', 'miss'); await wait(200); break; }
      case 'block': { sfx('block'); pop(vi(e), '格擋', 'block'); break; }
      case 'toss': {
        tossLeft.current = e.hits; tossTotal.current = e.hits; sfx('cast'); await wait(200); break;
      }
      case 'pull': {
        sfx('enrage'); jolt(4, 0.4, '#ffffff'); a.shakeT[e.side] = 0.8;
        setPulls({ id: Math.random(), names: e.skills }); await wait(1600); setPulls(null); rerender(); break;
      }
      case 'rewind': {
        sfx('reveal'); jolt(2, 0.5, '#7ab8ff'); setRewind(Math.random()); await wait(900); setRewind(0); rerender(); break;
      }
      case 'dmg': {
        const v = vi(e);
        if (tossLeft.current > 0) {
          // 拋接：每次 1 點，快速彈跳
          tossLeft.current--;
          d[v].hp = e.hp; const m = a.mons[v], base = posOf(v, m.form).y;
          m.y = base - 16 - Math.random() * 10; sfx('hit');
          rerender(); await wait(90); m.y = base; await wait(50);
          if (tossLeft.current === 0) { pop(v, `-${tossTotal.current}`, 'big', `拋接 ×${tossTotal.current}`); rerender(); await wait(400); }
          break;
        }
        d[v].hp = e.hp; d[v].shield = e.shield;
        if (e.shieldBroken) shieldBreak(v);
        const big = e.amount >= d[v].max * 0.25;
        const customHit = a.fx.find(f => {
          const skill = SKILLS[f.code], effect = animatedFx(f.code);
          return !f.missed && f.to === v && skill?.power > 0 && skill.elem === e.elem && effect && f.e >= effect.hitFrame;
        });
        a.mons[v].flash = customHit ? 0 : e.crit ? 0.24 : 0.12;
        a.recoil[v] = e.crit || big ? 4 : 2;
        if (e.eff >= 2 && e.elem) {
          const c = center(v);
          elemBurst(a.parts, c.x, c.y, e.elem);
        }
        if (e.crit) { sfx('crit'); jolt(2, 0.12); }
        else if (e.eff >= 2) sfx('super');
        else if (e.eff > 0 && e.eff < 1) sfx('weak');
        else sfx('hit');
        pop(v, `-${e.amount}`, e.crit ? 'crit' : e.eff >= 2 ? 'super' : e.eff < 1 ? 'weak' : big ? 'big' : '', e.crit ? '暴擊！' : e.eff >= 2 ? '效果絕佳' : e.eff > 0 && e.eff < 1 ? '效果不好' : undefined);
        rerender();
        if (e.crit || big) await new Promise((r) => setTimeout(r, 110)); // 停頓不受快速模式影響
        await wait(customHit && animatedFx(customHit.code)?.repeat ? 175 : 420); break;
      }
      case 'heal': {
        const v = vi(e); d[v].hp = e.hp; const c = center(v);
        if (e.amount > 0) { sfx('heal'); burst(a.parts, c.x, c.y, 'heal', null); pop(v, `+${e.amount}`, 'heal'); }
        rerender(); await wait(300); break;
      }
      case 'summonShield': {
        d[1].summonShield = e.amount;
        if (e.broken) shieldBreak(1);
        rerender(); break;
      }
      case 'shield': d[vi(e)].shield = e.amount; rerender(); break;
      case 'status': if (e.status) sfx('status'); d[vi(e)].status = e.status; rerender(); break;
      case 'stat': { const v = vi(e); sfx(e.delta > 0 ? 'buff' : 'debuff'); const c = center(v); if (e.delta > 0) burst(a.parts, c.x, c.y, 'buff', null); else a.shakeT[v] = 0.2; pop(v, e.delta > 0 ? '▲' : '▼', e.delta > 0 ? 'heal' : 'weak'); break; }
      case 'energy': d[vi(e)].energy = e.value; rerender(); break;
      case 'faint': {
        const v = vi(e);
        if (final && v === 1 && a.mons[1].form === MOXU_ASCENDED) {
          const c = center(1);
          sfx('bossdown');
          for (let frame = 0; frame < 22; frame++) {
            a.fade[1] = 1 - (frame + 1) / 22;
            if (frame % 4 === 0) burst(a.parts, c.x, c.y, 'faint', frame % 8 === 0 ? 'fire' : 'ice');
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          break;
        }
        if (boss && v === 1) {
          // 霸主倒下：閃爍、連續爆開、畫面劇烈震動，慢慢消失
          sfx('bossdown'); a.shakeT[1] = 1.6;
          const c = center(1);
          for (let k = 0; k < 6; k++) {
            setTimeout(() => { burst(a.parts, c.x + (Math.random() - 0.5) * 30, c.y + (Math.random() - 0.5) * 24, 'hit', 'fire'); jolt(4, k % 2 ? 0.35 : 0); a.mons[1].flash = 0.2; }, k * 180);
          }
          await new Promise((r) => setTimeout(r, 1100));
          burst(a.parts, c.x, c.y, 'faint', null); burst(a.parts, c.x, c.y, 'faint', null); jolt(6, 0.7);
          for (let i = 0; i < 20; i++) { a.fade[1] = 1 - (i + 1) / 20; await new Promise((r) => setTimeout(r, 45)); }
          break;
        }
        sfx(v === 2 ? 'bossdown' : 'faint'); const c = center(v); burst(a.parts, c.x, c.y, 'faint', null);
        if (v === 2) { jolt(4, 0.4); burst(a.parts, c.x, c.y + 10, 'splash', 'water'); if (target === allySlot.current) setTarget(0); }
        for (let i = 0; i < 10; i++) { a.fade[v] = 1 - (i + 1) / 10; await wait(40); }
        rerender();
        break;
      }
      case 'switch': {
        const v = vi(e);
        if (e.side === 0) participants.current.add(bs.sides[0].team[e.index].uid);
        a.fade[v] = 1; a.enter[v] = 0;
        a.mons[v] = { ...a.mons[v], omenMarks: bs.sides[e.side].vol[bs.sides[e.side].team[e.index].uid].omenMarks, omenElapsed: 1, form: e.form, scale: posOf(v, e.form).scale, y: posOf(v, e.form).y, aura: auraColor(e.form), mutant: bs.sides[e.side].team[e.index].mutant };
        const m = bs.sides[e.side].team[e.index];
        d[v] = { form: e.form, lv: m.lv, hp: e.hp, max: e.max, energy: e.energy, status: e.status, shield: 0, convergenceLoss: e.convergenceLoss, mutant: m.mutant };
        sfx('enter');
        // 落地時濺起水花
        setTimeout(() => { const c = center(v); burst(a.parts, c.x, c.y + 14, 'splash', 'water'); }, 380);
        rerender(); await wait(350); break;
      }
      case 'field': if (e.id && e.id !== fieldRef.current) { sfx('buff'); jolt(1, 0.2, '#ffffff'); } fieldRef.current = e.id; setField(e.id ? { id: e.id, turns: e.turns } : null); break;
      case 'trap': d[e.side === 0 ? 0 : 1].trap = e.turns; rerender(); break;
      case 'item': {
        // 用道具的結果：固定顯示 2.5 秒（不受快速、加速影響），看得清楚回了多少
        if (e.side !== 0) break;
        sfx('heal');
        const m = bs.sides[0].team[e.target], id = Math.random();
        setToast({ id, text: e.text, form: m.form, from: e.from, hp: e.hp, max: e.max });
        setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2500);
        await wait(700); break;
      }
      case 'enrage': {
        const v = vi(e), c = center(v), m = a.mons[v];
        m.aura = '#ff3040'; m.flash = 0.6; a.shakeT[v] = 0.8; sfx('enrage'); jolt(5, 0.4, '#ff2030');
        burst(a.parts, c.x, c.y, 'faint', 'fire'); burst(a.parts, c.x, c.y, 'buff', 'fire');
        pop(v, '狂暴！', 'crit'); await wait(700); break;
      }
      case 'phase2': {
        // 第一條血沒了：劇情字卡 → 第二條血補滿
        const m = a.mons[1], c = center(1);
        sfx('bossdown'); a.shakeT[1] = 1.2;
        for (let k = 0; k < 4; k++) setTimeout(() => { burst(a.parts, c.x + (Math.random() - 0.5) * 30, c.y + (Math.random() - 0.5) * 24, 'hit', 'water'); jolt(4, 0.3, '#7fd8ff'); m.flash = 0.2; }, k * 200);
        await new Promise((r) => setTimeout(r, 900));
        await cutscene({ title: '第二條潮', lines: ['潮汐・默旭倒下的瞬間，四周的海水全部倒捲回祂身上……', '「……不錯。那就讓你們見識，萬潮真正的力量。」'], tone: 'blue' }, 3200);
        sfx('heal'); jolt(5, 0.7, '#ffffff'); burst(a.parts, c.x, c.y, 'heal', 'water'); burst(a.parts, c.x, c.y, 'buff', 'water');
        setShownPhase(2);
        d[1].hp = e.hp; d[1].max = e.max; d[1].status = null; m.aura = auraColor('tide_moxu', true);
        pop(1, 'HP 全滿！', 'heal'); rerender(); await wait(700);
        break;
      }
      case 'phase3': {
        await ensureSprite(MOXU_ASCENDED);
        changeAt.current = performance.now();
        sfx('enrage');
        await cutscene({ title: '日月御潮', lines: ['第二條潮斷裂，日與月同時升起。', '默旭踏入倒懸潮壁，顯現第二型態。'], tone: 'gold' }, 2500);
        changeAt.current = 0;
        allySlot.current = null; a.fade[2] = 0; setTarget(0);
        fieldRef.current = null; setField(null);
        d[0].trap = 0;
        d[1] = { ...d[1], form: MOXU_ASCENDED, hp: e.hp, max: e.max, energy: e.energy, status: null, shield: 0, summonShield: 0, trap: 0 };
        a.mons[1] = { ...a.mons[1], form: MOXU_ASCENDED, aura: '#b6d5ff', flash: .45 };
        setShownPhase(3);
        jolt(4, .25, '#f9e1a8');
        say('日月御潮・默旭的生命翻倍，有屬性攻擊剋制所有屬性！');
        rerender(); await wait(660);
        break;
      }
      case 'summon': {
        // 召喚霸主：劇情字卡 → 統領者退到後面 → 霸主從海裡升上來
        const f = FORMS[e.form];
        await cutscene({ title: '萬潮的召喚', lines: ['統領者舉起了手，所有海域的潮聲同時響起——', `「回應我吧，${f.name}！」`], tone: 'gold' }, 3000);
        allySlot.current = e.slot;
        const p = posOf(2, e.form);
        a.mons[2] = { form: e.form, x: p.x, y: p.y + 40, flip: true, flash: 0.5, shake: 0, lunge: 0, alpha: 0, scale: p.scale, aura: auraColor(e.form, true), mutant: false, base: { x: p.bx, y: p.by } };
        a.fade[2] = 1; a.enter[2] = 0;
        const m = bs.sides[1].team[e.slot];
        d[2] = { form: e.form, lv: e.lv, hp: e.hp, max: e.max, energy: bs.sides[1].vol[m.uid].energy, status: null, shield: 0 };
        for (const k of m.skills) loadFx(k);
        sfx('enrage'); jolt(6, 0.6, '#ffe7a0');
        burst(a.parts, p.cx, p.by, 'splash', 'water'); burst(a.parts, p.cx, p.by - 6, 'splash', 'water');
        rerender(); await wait(900);
        pop(2, '登場！', 'crit');
        break;
      }
      case 'rod': {
        // 漁夫的釣竿：漁夫跳出來、甩竿橫掃全場
        sfx('cast'); a.rod = 0; jolt(2, 0.2, '#ffe7a0');
        setTimeout(() => { sfx('splash'); jolt(5, 0.4, '#ffffff'); }, 900);
        await new Promise((r) => setTimeout(r, (ROD_T * 1000) / (hurry.current ? 3 : fastRef.current ? 1.5 : 1) - 250));
        break;
      }
      case 'ultwarn': {
        const m = a.mons[1]; m.aura = '#ff3040'; m.flash = 0.4; sfx('enrage'); jolt(2, 0.25, '#ff4060');
        pop(1, '大絕招預告！', 'crit'); await wait(500); break;
      }
      case 'end': break;
    }
  }

  /** 劇情字卡：畫面變暗、上下黑邊，字一行一行出現。點一下可以跳過 */
  async function cutscene(c: { title: string; lines: string[]; tone?: string }, ms: number) {
    introSkip.current = false; setCut(c);
    const end = Date.now() + (hurry.current ? ms * 0.4 : ms);
    while (Date.now() < end && !introSkip.current) await new Promise((r) => setTimeout(r, 40));
    setCut(null); await new Promise((r) => setTimeout(r, 200));
  }
  /** 大絕招「五海歸一・默海破曉」：24 格的專屬特效，第 17 格（索引 16）是命中的瞬間 */
  async function playUlt(from: number, to: number) {
    const a = anim.current, spd = hurry.current ? 4 : fastRef.current ? 2 : 1, at = (fr: number) => (fr * FX_MS) / spd;
    say('潮汐・默旭 使出了大絕招——「五海歸一・默海破曉」！');
    a.mons[from].aura = auraColor('tide_moxu', true);
    sfx('enrage'); jolt(3, 0.5, '#0a1430');
    loadFx('moxu_daybreak'); a.fx.push({ code: 'moxu_daybreak', from, to, e: 0 });
    setTimeout(() => sfx('skill:water'), at(8));
    setTimeout(() => { sfx('crit'); jolt(8, 0.8, '#fff3c0'); }, at(16));
    await new Promise((r) => setTimeout(r, at(17)));
  }


  async function play(evs: BEvent[]) {
    let lastStrike = -1;
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i], announcement = evs[i + 1];
      if (e.t === 'msg' && i < lastStrike) {
        say(e.text);
        continue;
      }
      const customFx = e.t === 'use' || e.t === 'strike' ? animatedFx(e.skill) : undefined;
      const announce = e.t === 'use' && announcement?.t === 'msg' ? announcement.text : undefined;
      if (!customFx || (!announce && !(e.t === 'strike' && customFx.repeat))) {
        await apply(e);
        continue;
      }
      // 招式名稱在出招時顯示，格擋等文字隨命中處理，避免傷害晚一拍。
      if (announce) {
        say(announce);
        i++;
      }
      if (e.t === 'use' && customFx.repeat) {
        // 連擊中的傷害敘述照樣進戰鬥紀錄，但不打斷下一發。
        for (let next = i + 1; next < evs.length; next++) {
          const event = evs[next];
          if (event.t === 'use' || event.t === 'energy') break;
          if (event.t === 'strike' && event.skill === e.skill && event.side === e.side) lastStrike = next;
        }
      }
      let contact = i + 1;
      while (evs[contact]?.t === 'msg' || evs[contact]?.t === 'block') contact++;
      const result = evs[contact]?.t;
      await apply(e, result === 'miss' || result === 'dodge');
      while (i + 1 < contact) {
        const notice = evs[++i];
        if (notice.t === 'msg') say(notice.text);
        else await apply(notice);
      }
    }
  }

  async function afterTurn() {
    if (bs.over) return finish();
    setShownTurn(bs.turn);
    if (bs.needSwitch[1]) { await play(forcedSwitch(bs, 1, aiForcedSwitch(bs, 1))); }
    if (bs.needSwitch[0]) { say('要派誰上場？'); setMode('force'); return; }
    setMode('main');
  }

  async function finish(caught = false) {
    const over = bs.over;
    restorePulled(bs);
    let outcome: BattleResult['outcome'] = caught ? 'caught' : over?.fled ? 'fled' : over?.winner === 0 ? 'win' : 'lose';
    if (outcome === 'win' && boss) {
      // 霸主討伐：勝利字卡（點一下可以跳過）
      introSkip.current = false;
      sfx('fanfare'); setBossDown(true); say(final ? '日月御潮的默旭被擊敗了！' : `霸主「${FORMS[enc.mon.form].name}」被擊敗了！`);
      const end = Date.now() + 3400;
      while (Date.now() < end && !introSkip.current) await new Promise((r) => setTimeout(r, 40));
      clearConvergence(bs, 0);
      onEnd({ outcome, enemy: enc.mon, participants: [...participants.current] });
      return;
    }
    if (outcome === 'win') { sfx('win'); say('戰鬥勝利！'); }
    if (outcome === 'caught') sfx('catch');
    if (outcome === 'lose') {
      sfx('lose'); say('你的隊伍全部倒下了……');
      if ((run.lifeStones ?? 0) > 0) { await wait(500); say(`要使用生命石讓全隊復活嗎？（剩 ${run.lifeStones} 顆）`); setMode('lifestone'); return; }
    }
    await wait(1100);
    clearConvergence(bs, 0);
    onEnd({ outcome, enemy: caught || crew ? active(bs, 1) : enc.mon, participants: [...participants.current], team: enc.team });
  }

  async function useLifeStone() {
    setMode('busy');
    run.lifeStones = (run.lifeStones ?? 0) - 1;
    lifeStoneRevive(bs, 0);
    setShownTurn(bs.turn);
    const a = anim.current, c = center(0);
    a.fade[0] = 1; a.enter[0] = 0;
    disp.current[0] = snap(0);
    burst(a.parts, c.x, c.y, 'heal', null);
    say('生命石發出耀眼的光芒……全隊復活了！');
    rerender();
    await wait(900);
    say(boss ? '再戰一次吧！' : '要繼續戰鬥，還是剪線逃跑？');
    setMode('main');
  }
  const giveUp = async () => { setMode('busy'); await wait(300); clearConvergence(bs, 0); onEnd({ outcome: 'lose', enemy: enc.mon, participants: [...participants.current] }); };

  /** 觸控：第一下選取並顯示說明，第二下才執行；有滑鼠時直接執行 */
  const confirmTap = (i: number, act: () => void) => {
    if (TOUCH && armed !== i) { setHover(i); setPeek(i); setArmed(i); return; }
    setArmed(-1); act();
  };
  useEffect(() => { setArmed(-1); setPeek(-1); if (mode === 'main') { hurry.current = false; planEnemy(); } }, [mode]);

  async function submit(a: Action) {
    setMode('busy');
    if (a.type === 'skill' && duo) a = { ...a, target: finalSlots(bs).includes(target) ? target : 0 };
    if (a.type === 'item') run.items[a.item]--;
    const it = intentRef.current, key = `${bs.turn}-${active(bs, 1).uid}`;
    const foeAct = it && it.key === key && (it.act.type !== 'skill' || canAfford(bs, 1, it.act.slot)) ? it.act : aiChoose(bs, 1);
    intentRef.current = null; setIntent(null);
    const evs = resolveTurn(bs, [a, foeAct]);
    await play(evs);
    await afterTurn();
  }

  async function onReel(ok: boolean, quality: number) {
    setMode('busy');
    const name = FORMS[enc.mon.form].name;
    if (!ok) {
      say(`線斷了！${name} 逃回了水裡。`);
      await wait(400);
      await submit({ type: 'pass' });
      return;
    }
    // 收線成功 → 被網住，晃動三次
    const chanceAll = Math.min(0.97, catchChance(foe, quality, boon(run, 'shake') + (run.dailyRule?.id === 'harvest' ? 2 : 0)) * (1 + LANDING_BONUS[enc.landing ?? 'miss'].catch) * (boon(run, 'x_tranq') && foe.hp < maxHp(foe) / 3 ? 1.3 : 1));
    const shakes = rollShakes(bs.rng, chanceAll);
    const a = anim.current, c = center(1);
    for (let i = 0; i < 10; i++) { a.fade[1] = 1 - (i + 1) / 10; await wait(30); }
    net.current = { wob: 0, glow: 0 };
    sfx('splash'); say(`收線成功！${name} 被網住了……`);
    await wait(700);
    for (let i = 0; i < shakes.length; i++) {
      sfx('shake');
      for (const w of [-1, 1, -0.6, 0.6, 0]) { net.current.wob = w; await wait(110); }
      if (!shakes[i]) break;
      say(['晃動了一下……', '又晃了一下……', '再一下……！'][i]);
      await wait(520);
    }
    if (shakes.length === 3 && shakes[2]) {
      net.current.glow = 1; burst(a.parts, c.x, c.y + 6, 'buff', null);
      say(`★ 收服了 ${name}！`);
      await wait(600);
      net.current = null;
      await finish(true);
    } else {
      net.current = null; burst(a.parts, c.x, c.y + 6, 'splash', 'water');
      a.fade[1] = 1;
      sfx('escape'); say(`可惡！${name} 掙脫了網子！`);
      await wait(500);
      await submit({ type: 'pass' });
    }
  }

  async function chooseSwitch(i: number) {
    if (mode === 'force') {
      setMode('busy');
      await play(forcedSwitch(bs, 0, i));
      setMode('main');
    } else submit({ type: 'switch', to: i });
  }

  // 鍵盤快捷鍵
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (mode === 'main' && n >= 1 && n <= 4) { const m = active(bs, 0); if (m.skills[n - 1] && canAfford(bs, 0, n - 1)) submit({ type: 'skill', slot: n - 1 }); }
      else if (mode === 'main' && n >= 5 && n <= 8) [() => !boss && startReel(), () => setMode('switch'), () => setMode('items'), () => !boss && submit({ type: 'run' })][n - 5]();
      else if (e.key === 'Escape' && ['skills', 'switch', 'items', 'itemTarget'].includes(mode)) setMode('main');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const me = active(bs, 0), foe = active(bs, 1), [dp, de] = disp.current;
  const duo = !!bs.final && finalSlots(bs).length > 1; // 1 對 2：可以選攻擊目標
  const pickTarget = (i: number) => { sfx('select'); setTarget(i); };
  const openInfo = (side: SideId, idx?: number) => { setInfoIdx(idx); setInfo(side); };
  const finalNote = bs.final ? `第 ${shownPhase}/3 條血・大絕招${bs.final.ultIn <= 0 ? '：下回合！' : ` ${bs.final.ultIn} 回合後`}` : undefined;
  const meAffordAny = me.skills.some((_, i) => canAfford(bs, 0, i));
  const loveLock = !!bs.godhand && bs.godhand.loveTurn === bs.turn; // 無法忽視的愛：只能攻擊
  const toggleFast = () => { const v = !fast; setFast(v); try { localStorage.setItem(SPEED_KEY, v ? 'fast' : 'normal'); } catch { /* 略過 */ } };

  const targetRow = duo && (
    <div class="target-row" role="radiogroup" aria-label="攻擊目標">
      <span class="small dim">攻擊目標</span>
      {finalSlots(bs).map(i => (
        <button key={i} class={`chip-btn ${target === i ? 'hot' : ''}`} role="radio"
          aria-checked={target === i} onClick={() => pickTarget(i)}>
          {FORMS[bs.sides[1].team[i].form].name}
        </button>
      ))}
    </div>
  );
  const reelSeed = useRef<number>();
  const reel = <Reel seed={reelSeed.current} rarity={FORMS[foe.form].rarity} hpRatio={foe.hp / maxHp(foe)} hasStatus={!!foe.status} name={FORMS[foe.form].name} zoneBonus={boon(run, 'reelzone') * 0.15 + (run.perks?.reel ?? 0)} onDone={onReel} />;
  const startReel = () => {
    if (enc.oracle || run.catchBait <= 0) return;
    reelSeed.current = run.daily ? (next(bs.rng) * 2 ** 32) >>> 0 : undefined;
    sfx('cast'); run.catchBait--; setMode('reel');
  };
  const picking = mode === 'switch' || mode === 'force' || mode === 'itemTarget';
  const hs = (mode === 'main' || mode === 'skills') && peek >= 0 ? SKILLS[me.skills[peek]] : null;
  const hi = mode === 'items' ? (Object.keys(ITEMS) as ItemId[])[hover] : null;

  const portraitEnemies = vp.portrait && allySlot.current != null && anim.current.fade[2] > 0;
  const enemyCards = (<>
        <HudBox onOpen={() => (duo && target !== 0 ? pickTarget(0) : openInfo(1, 0))} sel={duo && target === 0} note={finalNote} side={1} d={de} rarity={crew ? undefined : FORMS[de.form].rarity} boss={boss} intent={mode === 'main' || mode === 'skills' ? intent : null} warn={!!intent?.atk && battleEffectiveness(de.form, intent.elem, formOf(active(bs, 0)).elems) >= 2} crewLeft={crew ? bs.sides[1].team.filter((m) => m.hp > 0).length : 0} charged={volOf(bs, 1).charged} locked={volOf(bs, 1).lockOn} turns={active(bs, 1).statusTurns} />
        {allySlot.current != null && disp.current[2] && anim.current.fade[2] > 0 && <HudBox cls="hud-ally" onOpen={() => (duo && target !== allySlot.current ? pickTarget(allySlot.current!) : openInfo(1, allySlot.current!))} sel={duo && target === allySlot.current} side={1} d={disp.current[2]} rarity={FORMS[disp.current[2].form].rarity} boss intent={mode === 'main' || mode === 'skills' ? allyIntent : null} warn={!!allyIntent?.atk && effectiveness(allyIntent.elem, formOf(active(bs, 0)).elems) >= 2} />}
  </>);
  return (
    <GameScreen vp={vp}
      scene={<SceneCanvas draw={draw} label="戰鬥畫面" />}
      overlay={<>
        {bossDown && <BossDown form={final ? MOXU_ASCENDED : enc.mon.form} zone={final ? '萬潮的統領者' : zoneOf(run).special ? `${zoneOf(run).name}的守護者` : `${zoneOf(run).name}的霸主`} onSkip={() => { introSkip.current = true; }} />}
        {intro && <BossIntro phase={intro} form={enc.mon.form} lv={enc.mon.lv} zone={final ? '萬潮的統領者' : zoneOf(run).special ? `${zoneOf(run).name}的守護者` : `${zoneOf(run).name}的霸主`} onSkip={() => { introSkip.current = true; }} />}
        {!intro && <>
          {!portraitEnemies && enemyCards}
        {anim.current.fade[0] > 0 && <HudBox onOpen={() => openInfo(0)} side={0} d={dp} charged={volOf(bs, 0).charged} locked={volOf(bs, 0).lockOn} turns={active(bs, 0).statusTurns} />}
        </>}
        {popups.map((p) => {
          const c = posOf(p.side, (disp.current[p.side] ?? disp.current[1]).form);
          const block = p.cls === 'block', shatter = p.cls === 'shield-break';
          const top = Math.max(p.side === 1 ? 15 : 49, c.cy - 30) + (block || shatter ? 12 : 0);
          const x = c.cx + (block ? -12 : shatter ? 12 : p.dx);
          return <span key={p.id} class={`pop ${p.cls}`} style={{ left: `${(x / W) * 100}%`, top: `${(top / H) * 100}%` }}>{p.label && <small>{p.label}</small>}{p.text}</span>;
        })}
        {bs.godhand && (bs.godhand.rewinds > 0 || loveLock) && <div class="gh-counter"><Icon name="heart" />{bs.godhand.rewinds > 0 && <span>（被倒退 {bs.godhand.rewinds} 次）</span>}{loveLock && <em>只能攻擊！</em>}</div>}
        {cut && <div class={`final-cut ${cut.tone ?? ''}`} onClick={() => { introSkip.current = true; }} role="button" aria-label="跳過劇情"><i class="bi-bar top" /><i class="bi-bar bottom" /><div class="fc-card"><b class="fc-title">{cut.title}</b>{cut.lines.map((l, i) => <p key={i} style={{ animationDelay: `${0.3 + i * 0.9}s` }}>{l}</p>)}</div><span class="bi-skip">點一下跳過</span></div>}
        {pulls && <div class="gh-pulls" key={pulls.id}>{pulls.names.map((n, i) => <span key={i} style={{ animationDelay: `${i * 0.18}s` }}>{n}</span>)}</div>}
        {rewind !== 0 && <div class="gh-rewind" key={rewind}>⟲ 時間倒退了</div>}
        {(field || bs.domain) && <div class="battle-conditions">
          {bs.domain && <div class="domain-chip" style={{ borderColor: DOMAINS[bs.domain].color, color: DOMAINS[bs.domain].color }} title={DOMAINS[bs.domain].desc}><Icon name="sparkle" /> 領域・{DOMAINS[bs.domain].name}<span>{DOMAINS[bs.domain].short}</span></div>}
          {field && <div class="field-chip" style={{ borderColor: FIELDS[field.id].color }} title={FIELDS[field.id].desc}><i style={{ background: FIELDS[field.id].color }} />{FIELDS[field.id].name}<span>剩 {field.turns} 回合</span></div>}
        </div>}
        <div class="battle-clock">
          <div class="turn-count">第 {shownTurn}{bs.godhand && ` / ${bs.godhand.survive}`} 回合
            {!gh && shownTurn >= REDUCED_HEALING_TURN && <small>我方回復減半</small>}
          </div>
          <button class="speed" onClick={toggleFast} aria-pressed={fast}>{fast ? '▶▶ 快速' : '▶ 一般'}</button>
        </div>
        {mode === 'reel' && !vp.portrait && reel}
        {toast && <div class="item-toast" key={toast.id}><Sprite form={toast.form} size={48} /><span class="grow"><b><Icon name="heal" /> {toast.text}</b><Bar value={toast.hp} max={toast.max} /><span class="num small">HP {toast.from} → {toast.hp}/{toast.max}</span></span></div>}

      </>}
      onPanelClose={info !== null ? () => setInfo(null) : mode === 'switch' || mode === 'itemTarget' ? () => setMode(mode === 'itemTarget' ? 'items' : 'main') : undefined}
      panel={info !== null ? <InfoPanel bs={bs} side={info} idx={infoIdx} boss={boss} onClose={() => setInfo(null)} /> : picking && (
        <Win class="big-panel" title={mode === 'force' ? '要派誰上場？' : mode === 'itemTarget' ? `對誰使用 ${ITEMS[itemPick!].name}？` : '換人'} onClose={mode !== 'force' ? () => setMode(mode === 'itemTarget' ? 'items' : 'main') : undefined} closeLabel="返回">
          <div class="pick-grid">
            {run.party.map((m, i) => {
              const isActive = i === bs.sides[0].active;
              const max = battleMaxHp(bs, 0, m);
              const disabled = mode === 'itemTarget'
                ? (itemPick === 'revive' ? m.hp > 0 : m.hp <= 0 || m.hp >= max)
                : m.hp <= 0 || isActive;
              return (
                <button class="pick" disabled={disabled} key={m.uid}
                  onClick={() => (mode === 'itemTarget' ? submit({ type: 'item', item: itemPick!, target: i }) : chooseSwitch(i))}>
                  <Sprite form={m.form} size={48} mutant={m.mutant} />
                  <span class="grow">
                    <span class="row-gap"><b>{FORMS[m.form].name}</b><span class="num">Lv{m.lv}</span>{isActive && <span class="small dim">出場中</span>}</span>
                    <Bar value={m.hp} max={max} />
                    <span class="small dim">{Math.max(0, m.hp)}/{max}{m.status ? ` · ${statusLabel(m.status)}` : ''}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Win>
      )}
      dock={mode === 'reel' && vp.portrait ? reel : (<>
        {portraitEnemies && !intro && <div class="enemy-readouts">{enemyCards}</div>}
        <div class="dock-split battle-dock">
          <Win class="msg">
            {!vp.portrait && mode === 'main' && targetRow}
            <div class="tap-hurry" onClick={() => { if (mode === 'busy') hurry.current = true; }}>
            {hs ? (
              <div class="skill-info">
                <div class="row-gap"><b class="big-name">{hs.name}</b>{hs.elem ? <ElemChip e={hs.elem} /> : <span class="chip neutral">無</span>}</div>
                <p class="small">{hs.power ? (() => { const p = Math.round(effPower(bs, 0, 1, hs)); return p !== hs.power ? `威力 ${hs.power} → ${p}` : `威力 ${hs.power}`; })() : '變化技'} · 能量 {hs.cost} · 命中 {Math.round(Math.min(1, hitChance(bs, 0, hs)) * 100)}{hs.power > 0 && (() => { const e = effectiveness(hs.elem, formOf(duo ? bs.sides[1].team[target] ?? foe : foe).elems); return e >= 2 ? ' · 效果絕佳！' : e < 1 ? ' · 效果不好' : ''; })()}</p>
                <p class="small dim">{hs.desc}</p>
                {TOUCH && armed === peek && <p class="small accent">再點一次使用</p>}
              </div>
            ) : hi ? (
              <div class="skill-info"><b class="big-name">{ITEMS[hi].name}</b><p class="small dim">{ITEMS[hi].desc}</p></div>
            ) : (
              <div class="log" aria-live="polite">
                {mode === 'main' && <Tip inline id={final ? 'final' : boss ? 'boss' : 'battle'}>{final ? (duo ? '點名字切換目標。' : '留意大絕倒數，提前換上能承受攻擊的夥伴。') : boss ? '霸主半血會狂暴，攻擊變強、防禦下降。' : '先看「下一步」再選招。標示「剋你」時，可換夥伴避開弱點。'}</Tip>}
                {log.slice(-2).map((l, i, arr) => <p key={log.length - arr.length + i} class={i === arr.length - 1 ? 'last' : 'prev'}>{l}</p>)}
              </div>
            )}
            </div>
          </Win>
          <Win class="cmd">
            {(mode === 'busy' || picking || mode === 'reel') && <p class="dim center">……</p>}
            {mode === 'lifestone' && (
              <div class="cmd-grid">
                <MenuItem onClick={useLifeStone} hot sub={`×${run.lifeStones ?? 0}`}>使用生命石</MenuItem>
                <MenuItem onClick={giveUp}>放棄</MenuItem>
              </div>
            )}
            {mode === 'main' && (
              <div class="battle-main" onMouseLeave={() => { if (!TOUCH) setPeek(-1); }}>
                {vp.portrait && targetRow}
                <div class="cmd-grid">
                  {me.skills.map((id, i) => {
                    const sk = SKILLS[id], ok = canAfford(bs, 0, i);
                    return (
                      <MenuItem key={id} disabled={!ok} sel={TOUCH && armed === i} onHover={() => { setHover(i); if (!TOUCH) setPeek(i); }} onClick={() => confirmTap(i, () => submit({ type: 'skill', slot: i }))}
                        sub={<span class="cost">{id === 'oracle_tide' ? `卦 ${volOf(bs, 0).omenMarks?.length ?? 0}/3` : '◆'.repeat(sk.cost) || '—'}</span>}>
                        <i class="dot" style={{ background: sk.elem ? `var(--el-${sk.elem})` : '#c8d2e8' }} />{sk.name}
                      </MenuItem>
                    );
                  })}
                  {!meAffordAny && <MenuItem onClick={() => submit({ type: 'skill', slot: -1 })}>掙扎</MenuItem>}
                </div>
                <div class="act-row">
                  {!boss && !crew && !gh && !enc.oracle && <button class="act-btn" onClick={startReel} disabled={run.catchBait <= 0}><Icon name="rod" /> 捕捉<small>×{run.catchBait}</small></button>}
                  <button class="act-btn" disabled={loveLock} onClick={() => setMode('switch')}><Icon name="swap" /> 換人</button>
                  <button class="act-btn" disabled={loveLock} onClick={() => { setHover(0); setMode('items'); }}><Icon name="bag" /> 道具</button>
                  {!boss && !gh && <button class="act-btn" onClick={() => submit({ type: 'run' })}><Icon name="flee" /> 逃跑</button>}
                  {final && <button class={`act-btn rod-btn ${canRod(bs) ? 'ready' : ''}`} disabled={!canRod(bs)} onClick={() => submit({ type: 'rod' })} title="漁夫跳出來甩竿橫掃全場：造成最大 HP 10% 的傷害，攻擊、防禦各降低 10%（可削減召喚護盾）"><Icon name="rod" /> 漁夫的釣竿<small>{bs.final!.phase < 2 ? '第二條血時解鎖' : bs.final!.rodCd > 0 ? `${bs.final!.rodCd} 回合後` : '可以用！'}</small></button>}
                </div>
              </div>
            )}
            {(mode === 'skills' || mode === 'items') && <button class="win-close cmd-back" onClick={() => { sfx('back'); setMode('main'); }}>✕ 返回</button>}
            {mode === 'skills' && (
              <div class="cmd-grid">
                {me.skills.map((id, i) => {
                  const sk = SKILLS[id], ok = canAfford(bs, 0, i);
                  return (
                    <MenuItem key={id} disabled={!ok} sel={TOUCH && armed === i} onHover={() => setHover(i)} onClick={() => confirmTap(i, () => submit({ type: 'skill', slot: i }))}
                      sub={<span class="cost">{id === 'oracle_tide' ? `卦 ${volOf(bs, 0).omenMarks?.length ?? 0}/3` : '◆'.repeat(sk.cost) || '—'}</span>}>
                      <i class="dot" style={{ background: sk.elem ? `var(--el-${sk.elem})` : '#c8d2e8' }} />{sk.name}
                    </MenuItem>
                  );
                })}
                {!meAffordAny && <MenuItem onClick={() => submit({ type: 'skill', slot: -1 })}>掙扎</MenuItem>}
              </div>
            )}
            {mode === 'items' && (
              <div class="cmd-grid">
                {(Object.keys(ITEMS) as ItemId[]).map((id, i) => (
                  <MenuItem key={id} disabled={!run.items[id]} sel={TOUCH && armed === i} onHover={() => setHover(i)} sub={`×${run.items[id] ?? 0}`}
                    onClick={() => confirmTap(i, () => { if (id === 'ether') submit({ type: 'item', item: id, target: bs.sides[0].active }); else { setItemPick(id); setMode('itemTarget'); } })}>
                    {ITEMS[id].name}
                  </MenuItem>
                ))}
              </div>
            )}
          </Win>
        </div>
      </>
      )} />
  );
}

function BossDown({ form, zone, onSkip }: { form: string; zone: string; onSkip: () => void }) {
  return (
    <div class="boss-intro win" onClick={onSkip} role="button" aria-label="繼續">
      <i class="bi-bar top" /><i class="bi-bar bottom" />
      <div class="bi-card">
        <span class="bi-zone">{zone}</span>
        <b class="bi-name">討伐成功！</b>
        <span class="bi-title">— {form === MOXU_ASCENDED ? '日月分離，八域的潮聲各自歸海' : `${FORMS[form].name} 被擊敗了，海面恢復了平靜`} —</span>
      </div>
      <span class="bi-skip">點一下繼續</span>
    </div>
  );
}

function BossIntro({ phase, form, lv, zone, onSkip }: { phase: 'dark' | 'card' | 'out'; form: string; lv: number; zone: string; onSkip: () => void }) {
  const f = FORMS[form];
  return (
    <div class={`boss-intro ${phase}`} onClick={onSkip} role="button" aria-label="跳過登場畫面">
      <i class="bi-bar top" /><i class="bi-bar bottom" />
      {phase !== 'dark' && (
        <div class="bi-card">
          <span class="bi-zone">{zone}</span>
          <b class="bi-name">{f.name}</b>
          <span class="bi-title">— {BOSS_TITLE[form] ?? '這片海域的支配者'} —</span>
          <span class="bi-meta">{form === 'tide_moxu' && <URTag />}<Elems list={f.elems} /><span class="lv">Lv{lv}</span></span>
        </div>
      )}
      <span class="bi-skip">點一下跳過</span>
    </div>
  );
}

/** 神之手的稀有度：發光的無限符號 */
const InfTag = () => <span class="rar rar-inf" title="無法衡量" aria-label="稀有度：無限">∞</span>;
/** 統領者的稀有度：閃著彩虹光的 UR */
const URTag = () => <span class="rar rar-ur" title="超越傳說" aria-label="稀有度：UR">UR</span>;
/** 依角色顯示稀有度標籤（神之手 ∞、統領者 UR） */
const RarTag = ({ form, r }: { form: string; r?: keyof typeof RARITY }) => (form === 'godhand' ? <InfTag /> : (form === 'tide_moxu' || form === MOXU_ASCENDED) ? <URTag /> : r ? <RarityTag r={r} /> : null);

function HudBox({ side, d, rarity, boss, charged, locked, turns, onOpen, intent, crewLeft, warn, cls = '', note, sel }: { side: SideId; d: Disp; rarity?: keyof typeof RARITY; boss?: boolean; charged?: boolean; locked?: boolean; turns?: number; onOpen?: () => void; intent?: Intent | null; crewLeft?: number; warn?: boolean; cls?: string; note?: string; sel?: boolean }) {
  const f = FORMS[d.form];
  return (
    <div class={`hud hud-${side} ${cls} ${sel ? 'targeted' : ''} clickable`} onClick={onOpen} role="button" aria-label={`查看 ${f.name} 的資料`}>
      <div class="hud-top">
        <b class="hud-name">{f.name}</b>{d.mutant && <span class="mutant-tag">✦</span>}
        <RarTag form={d.form} r={rarity} />
        {boss && <span class="boss-tag">{(d.form === 'tide_moxu' || d.form === MOXU_ASCENDED) ? '統領者' : '霸主'}</span>}
        {!!crewLeft && <span class="crew-left" title="船隊剩下的夥伴">{'●'.repeat(crewLeft)}</span>}
        {d.form !== 'godhand' && <span class="lv">Lv{d.lv}</span>}
      </div>
      <div class="hud-sub"><Elems list={f.elems} />{f.id === 'godhand' && <span class="st st-shield">無屬性・異常無效</span>}{d.status && <span class={`st st-${d.status}`}>{statusLabel(d.status)}{turns ? ` ${turns >= 90 ? '∞' : turns}` : ''}</span>}{!!d.summonShield && <span class="st st-shield">召喚護盾 {d.summonShield}</span>}{d.shield > 0 && <span class="st st-shield">護盾 {d.shield}</span>}{(d.trap ?? 0) > 0 && <span class="st st-trap">暗礁 {d.trap}</span>}{charged && <span class="st st-charge">蓄力</span>}{locked && <span class="st st-lock">鎖定</span>}</div>
      <Bar value={d.hp} max={d.max} />
      <div class="hud-foot">
        <Energy value={d.energy} max={MAX_ENERGY} />
        {side === 0 && <span class="hpnum">{d.hp}/{d.max}</span>}
      </div>
      {!!d.convergenceLoss && <div class="hud-note convergence-loss">全能力 −{d.convergenceLoss}%</div>}
      {note && <div class="hud-note">{note}</div>}
      {intent && <div class={`hud-intent ${warn ? 'warn' : ''}`} title={warn ? '對你的夥伴效果絕佳！' : undefined}><span class="intent-label">下一步</span><strong><Icon name={intent.icon} /> {intent.name}</strong>{warn && <b class="intent-threat">剋你</b>}</div>}
    </div>
  );
}


// 戰鬥中查看資料：自己看得到技能，對手只看得到狀態與被動特性
const STAGE_LABEL = { atk: '攻擊', def: '防禦', spd: '速度' } as const;
function InfoPanel({ bs, side, idx, boss, onClose }: { bs: BattleState; side: SideId; idx?: number; boss: boolean; onClose: () => void }) {
  const m = idx != null ? bs.sides[side].team[idx] : active(bs, side), f = formOf(m), v = bs.sides[side].vol[m.uid], st = battleStats(bs, side, m), mx = st.hp;
  const stages = (Object.keys(STAGE_LABEL) as (keyof typeof STAGE_LABEL)[]).filter((k) => v.stages[k]);
  const mine = side === 0;
  return (
    <Win class="big-panel battle-info" title={mine ? '我方資料' : boss ? '霸主資料' : '對手資料'} onClose={onClose}>
      <div class="pick">
        <Sprite form={m.form} size={96} mutant={m.mutant} />
        <span class="grow">
          <span class="row-gap"><b class="big-name">{m.mutant ? '✦ ' : ''}{f.name}</b>{m.form === 'godhand' || m.form === 'tide_moxu' || m.form === MOXU_ASCENDED ? <RarTag form={m.form} /> : <RarityTag r={f.rarity} />}{m.form !== 'godhand' && <><StageTag form={m.form} /><span class="num">Lv{m.lv}</span></>}</span>
          <span class="row-gap"><Elems list={f.elems} /><span class="small dim">{f.category}</span>{mine && <IvStars iv={m.iv} />}</span>
          <Bar value={m.hp} max={mx} />
          <span class="row-gap">{mine && <span class="small">{Math.max(0, m.hp)}/{mx}</span>}<Energy value={v.energy} max={MAX_ENERGY} /></span>
        </span>
      </div>
      <div class="row-gap">
        {m.status && <span class={`st st-${m.status}`}>{statusLabel(m.status)}{m.statusTurns ? ` ${m.statusTurns}` : ''}</span>}
        {!!v.convergenceLoss && <span class="st st-down">全能力 −{v.convergenceLoss}%</span>}
        {stages.map((k) => <span key={k} class={`st ${v.stages[k] > 0 ? 'st-up' : 'st-down'}`}>{STAGE_LABEL[k]} {v.stages[k] > 0 ? '+' : ''}{v.stages[k]}</span>)}
        {v.shield > 0 && <span class="st st-shield">護盾 {v.shield}</span>}
        {v.charged && <span class="st st-charge">蓄力</span>}
        {v.lockOn && <span class="st st-lock">鎖定</span>}
      </div>
      {mine && <p class="small">攻擊 {st.atk}・防禦 {st.def}・速度 {st.spd}</p>}
      <p class="small dim">閃避 {Math.round(dodgeRate(f) * 100)}%・格擋 {Math.round(blockRate(f) * 100)}%</p>
      {m.held && <p class="small">攜帶 <b><Icon name={HELD[m.held].icon} /> {HELD[m.held].name}</b>：{HELD[m.held].desc}</p>}
      {mine && Object.entries(bs.sides[0].mods?.reso ?? {}).map(([e, b]) => <p class="small accent" key={e}>屬性共鳴：{ELEM[e as Elem].name}技能 +{Math.round((b ?? 0) * 100)}%</p>)}
      <AbilityLines form={f.id} />
      {mine && <div class="skills-col">{m.skills.map((id) => <SkillLine id={id} key={id} />)}</div>}
    </Win>
  );
}
