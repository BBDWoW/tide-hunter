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
  active, aiChoose, aiForcedSwitch, canAfford, createBattle, effPower, forcedSwitch, hitChance, ITEMS, lifeStoneRevive, MAX_ENERGY, resolveTurn, restorePulled, statusLabel, volOf,
  type Action, type BattleState, type BEvent, type ItemId, type SideId,
} from '../game/battle';
import { blockRate, dodgeRate, formOf, maxHp, statsOf, type Mon } from '../game/creature';
import { makeRng, next } from '../game/rng';
import { catchChance, rollShakes } from '../game/capture';
import { foeMods, battleMods, boon, LANDING_BONUS, zoneOf } from '../game/run';
import type { Encounter, RunState } from '../game/run';
import { spriteSize } from '../render/pixel';
import { drawFx, FX_FRAMES, FX_MS, fxOffset, fxSkill, hasFx, loadFx } from '../render/vfx';
import { auraColor, burst, drawBattle, drawNet, H, monSlot, W, type Beam, type MonView, type Particle } from '../render/scene';
import { Tip, AbilityLines, Bar, ElemChip, Elems, Energy, IvStars, RarityTag, SkillLine, Sprite, StageTag } from './components';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';
import { MenuItem } from './Screens';
import { Reel } from './Reel';
import { sfx } from '../audio/engine';

export interface BattleResult { outcome: 'win' | 'lose' | 'caught' | 'fled'; enemy: Mon; participants: string[]; team?: Mon[] }
/** 對手下一步的預告 */
interface Intent { key: string; act: Action; icon: string; name: string; elem: Elem | null; atk: boolean }

type Mode = 'busy' | 'main' | 'skills' | 'switch' | 'force' | 'items' | 'itemTarget' | 'reel' | 'lifestone';
interface Disp { form: string; lv: number; hp: number; max: number; energy: number; status: StatusId | null; shield: number; trap?: number; mutant?: boolean }
interface Popup { id: number; side: SideId; text: string; cls: string; label?: string; dx: number }

const SPEED_KEY = 'tidehunter.speed';
/** 場地類特效鋪滿的範圍（場景座標，避開下方操作列） */
const FX_ARENA = { x: 20, y: 2, w: 216, h: 117 };
const DASH = 0.5; // 近戰衝刺的時間（秒）
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
    bsRef.current = createBattle(makeRng((next(run.rng) * 2 ** 32) >>> 0), { team: run.party, name: '你', mods: battleMods(run) }, { team: enc.team ?? [enc.mon], name: boss ? '霸主' : enc.crew ?? '野生', boss, mods: foeMods(run) }, !enc.team, isDomain(run.zone) ? run.zone : undefined, !!enc.godhand);
  }
  const bs = bsRef.current;
  const crew = !!enc.team; // 對手船隊：多隻敵人、不能收服
  const gh = !!enc.godhand; // 神之手之戰：撐過 20 回合
  const final = !!enc.final; // 最終決戰：統領者・潮汐默旭
  const tossLeft = useRef(0), tossTotal = useRef(0);
  const [pulls, setPulls] = useState<{ id: number; names: string[] } | null>(null);
  const [rewind, setRewind] = useState(0);
  const snap = (side: SideId): Disp => {
    const m = active(bs, side);
    return { form: m.form, lv: m.lv, hp: m.hp, max: maxHp(m), energy: volOf(bs, side).energy, status: m.status, shield: volOf(bs, side).shield, mutant: m.mutant };
  };
  const disp = useRef<[Disp, Disp]>([snap(0), snap(1)]);
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
    const sk = act.type === 'skill' ? (act.slot < 0 ? null : SKILLS[foeM.skills[act.slot]]) : null;
    const it: Intent = sk
      ? { key, act, icon: sk.power > 0 ? 'attack' : sk.fx?.heal ? 'heal' : sk.fx?.status || (sk.fx?.stat && !sk.fx.stat.self) ? 'hinder' : 'buff', name: sk.name, elem: sk.elem, atk: sk.power > 0 }
      : { key, act, icon: 'attack', name: '掙扎', elem: null, atk: true };
    intentRef.current = it; setIntent(it);
  };

  const mkView = (side: SideId, form: string): MonView => {
    const p = monSlot(side, form);
    return { form, x: p.x, y: p.y, flip: side === 1, flash: 0, shake: 0, lunge: 0, alpha: 0, scale: p.scale, aura: auraColor(form, side === 1 && boss), mutant: active(bs, side).mutant };
  };
  const anim = useRef({
    mons: [mkView(0, disp.current[0].form), mkView(1, disp.current[1].form)] as MonView[],
    lungeT: [0, 0], dashT: [0, 0], shakeT: [0, 0], fade: [1, 1] as number[], enter: [0, 0] as number[],
    parts: [] as Particle[], beams: [] as Beam[],
    fx: [] as { code: string; side: SideId; e: number }[], // 播放中的技能特效（e = 已播放幾格）
    quake: 0, flash: 0, flashColor: '#ffffff',
  });
  // 開發用：網址加 ?field=storm 可以直接看場地特效
  const fieldRef = useRef<string | null>(import.meta.env.DEV ? new URLSearchParams(location.search).get('field') : null);

  const hurry = useRef(false); // 點訊息框：這一輪的演出加速
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, hurry.current ? ms * 0.15 : fastRef.current ? ms * 0.45 : ms));
  const say = (text: string) => setLog((l) => [...l.slice(-30), text]);
  const pop = (side: SideId, text: string, cls: string, label?: string) => {
    const id = Math.random();
    setPopups((p) => [...p, { id, side, text, cls, label, dx: (Math.random() - 0.5) * 8 }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), cls === 'crit' || cls === 'super' ? 1300 : 1000);
  };
  /** 畫面震動、全畫面閃光 */
  const jolt = (quake: number, flash = 0, color = '#ffffff') => { const a = anim.current; a.quake = Math.max(a.quake, quake); if (flash) { a.flash = flash; a.flashColor = color; } };

  // 每一格畫面：更新動畫狀態後繪製
  const draw = (ctx: CanvasRenderingContext2D, t: number, dt: number) => {
    const a = anim.current;
    for (const side of [0, 1] as SideId[]) {
      const v = a.mons[side];
      a.enter[side] = Math.min(1, a.enter[side] + dt * 2.2);
      const p = monSlot(side, v.form), e = 1 - Math.pow(1 - a.enter[side], 3);
      v.x = p.x + (1 - e) * (side === 0 ? -90 : 90);
      v.y = p.y;
      // 近戰：衝到對手面前再退回來
      a.dashT[side] = Math.max(0, a.dashT[side] - dt);
      if (a.dashT[side] > 0) {
        const other: SideId = side === 0 ? 1 : 0, tg = monSlot(other, a.mons[other].form);
        const k = Math.sin((1 - a.dashT[side] / DASH) * Math.PI);
        v.x += (tg.cx - p.cx - (side === 0 ? 28 : -28)) * k;
        v.y += (tg.cy - p.cy) * k;
      }
      a.lungeT[side] = Math.max(0, a.lungeT[side] - dt);
      v.lunge = Math.sin((a.lungeT[side] / 0.25) * Math.PI) * 12 * (a.lungeT[side] > 0 ? 1 : 0);
      v.flash = Math.max(0, v.flash - dt);
      a.shakeT[side] = Math.max(0, a.shakeT[side] - dt);
      v.shake = a.shakeT[side] > 0 ? 1 : 0;
      v.alpha = e * a.fade[side];
      v.enter = a.enter[side] < 1 ? a.enter[side] : undefined;
      const dd = disp.current[side]; v.low = dd.hp > 0 && dd.hp / dd.max < 0.25;
    }
    // 技能特效：往前播，並套用素材裡施術者／目標的抖動
    const spd = hurry.current ? 4 : fastRef.current ? 2 : 1;
    for (const f of a.fx) f.e += (dt * 1000 * spd) / FX_MS;
    a.fx = a.fx.filter((f) => f.e < FX_FRAMES);
    for (const side of [0, 1] as SideId[]) { a.mons[side].ox = 0; a.mons[side].oy = 0; }
    for (const f of a.fx) {
      const fr = Math.floor(f.e), foe: SideId = f.side === 0 ? 1 : 0;
      for (const [sd, who] of [[f.side, 'caster'], [foe, 'target']] as const) {
        const v = a.mons[sd], [ox, oy] = fxOffset(f.code, fr, who, v.flip);
        v.ox = (v.ox ?? 0) + ox; v.oy = (v.oy ?? 0) + oy;
      }
    }
    const fxLayer = (c: CanvasRenderingContext2D, which: 'back' | 'front', rects: ({ x: number; y: number; w: number } | null)[]) => {
      for (const f of a.fx) {
        const foe: SideId = f.side === 0 ? 1 : 0, r0 = rects[f.side], r1 = rects[foe];
        if (!r0 || !r1) continue;
        const actor = (sd: SideId, r: { x: number; y: number; w: number }) => { const sp = FORMS[a.mons[sd].form].sprite; return { rect: r, sprite: sp, facesLeft: a.mons[sd].flip, logical: spriteSize(sp) }; };
        const A = actor(f.side, r0), B = actor(foe, r1), fr = Math.floor(f.e);
        if (which === 'back') drawFx(c, f.code, 'back', fr, A, B, FX_ARENA);
        else { drawFx(c, f.code, 'front', fr, A, B, FX_ARENA); drawFx(c, f.code, 'particles', fr, A, B, FX_ARENA); }
      }
    };
    // 震動、閃光慢慢消退
    const q = a.quake, fl = a.flash;
    a.quake = Math.max(0, a.quake - dt * 14); a.flash = Math.max(0, a.flash - dt * 2.2);
    drawBattle(ctx, t, dt, a.mons, a.parts, a.beams, zoneOf(run).theme, { field: fieldRef.current, quake: q, flash: fl, flashColor: a.flashColor, fxLayer });
    if (a.mons[1].form === 'godhand' && a.fade[1] > 0) { const c = monSlot(1, 'godhand'); drawGodHand(ctx, t, c.cx, a.mons[1].y ?? c.y, c.scale, 0, false); }
    if (net.current) { const c = monSlot(1, a.mons[1].form); const n = net.current; n.glow = Math.max(0, n.glow - dt); drawNet(ctx, c.cx, c.cy + 6, n.wob, n.glow); }
  };

  // 先把雙方隊伍會用到的技能特效圖載進來
  useEffect(() => { for (const sd of bs.sides) for (const m of sd.team) for (const k of m.skills) loadFx(k); }, []);

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
      if (gh) { /* 神之手：沒有稀有度 */ }
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
  const center = (side: SideId) => { const v = anim.current.mons[side]; const p = monSlot(side, v.form); return { x: p.cx, y: p.cy }; };

  async function apply(e: BEvent) {
    const a = anim.current, d = disp.current;
    switch (e.t) {
      case 'msg': say(e.text); await wait(560); break;
      case 'use': {
        const sk = SKILLS[e.skill] ?? { anim: 'hit', elem: null };
        const foe: SideId = e.side === 0 ? 1 : 0, c = center(foe), me = center(e.side);
        const kind = sk.anim ?? 'hit';
        sfx(kind === 'buff' ? 'buff' : kind === 'heal' ? 'item' : `skill:${sk.elem ?? 'none'}`);
        if (hasFx(e.skill)) {
          // 有專屬特效的招式：播特效，角色只做衝刺／前傾的動作
          loadFx(e.skill); a.fx.push({ code: e.skill, side: e.side, e: 0 });
          const st = fxSkill(e.skill).style;
          if (st === 'dash' || (kind === 'hit' && (sk as { power?: number }).power && !RANGED_HIT.has(e.skill) && st !== 'self')) { a.dashT[e.side] = DASH; await wait(DASH * 900); break; }
          if (st !== 'self' && st !== 'field') a.lungeT[e.side] = 0.25;
          await wait(450); break;
        }
        if (kind === 'buff' || kind === 'heal') { burst(a.parts, me.x, me.y, kind, sk.elem); }
        else if (kind === 'hit' && (sk as { power?: number }).power && !RANGED_HIT.has(e.skill)) {
          // 近戰招式：衝過去打
          a.dashT[e.side] = DASH;
          setTimeout(() => burst(a.parts, c.x, c.y - 4, 'hit', sk.elem), DASH * 500);
          await wait(DASH * 700); break;
        } else {
          a.lungeT[e.side] = 0.25;
          if (kind === 'beam') a.beams.push({ x0: me.x, y0: me.y - 6, x1: c.x, y1: c.y - 6, life: 0.35, color: sk.elem ? '#ffffff' : '#ffffff' });
          setTimeout(() => burst(a.parts, c.x, c.y - 4, kind === 'splash' ? 'splash' : 'hit', sk.elem), 150);
        }
        await wait(260); break;
      }
      case 'miss': break;
      case 'dodge': { sfx('dodge'); a.shakeT[e.side] = 0.15; a.lungeT[e.side] = 0.25; pop(e.side, '閃避！', 'miss'); await wait(200); break; }
      case 'block': { sfx('block'); pop(e.side, '格擋', 'block'); break; }
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
        if (tossLeft.current > 0) {
          // 拋接：每次 1 點，快速彈跳
          tossLeft.current--;
          d[e.side].hp = e.hp; const v = a.mons[e.side], base = monSlot(e.side, v.form).y;
          v.y = base - 16 - Math.random() * 10; sfx('hit');
          rerender(); await wait(90); v.y = base; await wait(50);
          if (tossLeft.current === 0) { pop(e.side, `-${tossTotal.current}`, 'big', `拋接 ×${tossTotal.current}`); rerender(); await wait(400); }
          break;
        }
        d[e.side].hp = e.hp; d[e.side].shield = e.shield;
        a.mons[e.side].flash = 0.35; a.shakeT[e.side] = 0.3;
        // 打擊感：暴擊與效果絕佳會震動畫面、閃光，並停頓一下（hit-stop）
        const big = e.amount >= d[e.side].max * 0.25;
        if (e.crit) { sfx('crit'); jolt(3.5, 0.35); }
        else if (e.eff >= 2) { sfx('super'); jolt(2.5, 0.22, '#ffe08a'); }
        else if (e.eff > 0 && e.eff < 1) sfx('weak');
        else { sfx('hit'); if (big) jolt(1.5); }
        pop(e.side, `-${e.amount}`, e.crit ? 'crit' : e.eff >= 2 ? 'super' : e.eff < 1 ? 'weak' : big ? 'big' : '', e.crit ? '暴擊！' : e.eff >= 2 ? '效果絕佳' : e.eff > 0 && e.eff < 1 ? '效果不好' : undefined);
        rerender();
        if (e.crit || e.eff >= 2) await new Promise((r) => setTimeout(r, 110)); // 停頓不受快速模式影響
        await wait(420); break;
      }
      case 'heal': {
        d[e.side].hp = e.hp; const c = center(e.side);
        if (e.amount > 0) { sfx('heal'); burst(a.parts, c.x, c.y, 'heal', null); pop(e.side, `+${e.amount}`, 'heal'); }
        rerender(); await wait(300); break;
      }
      case 'shield': d[e.side].shield = e.amount; rerender(); break;
      case 'status': if (e.status) sfx('status'); d[e.side].status = e.status; rerender(); break;
      case 'stat': { sfx(e.delta > 0 ? 'buff' : 'debuff'); const c = center(e.side); if (e.delta > 0) burst(a.parts, c.x, c.y, 'buff', null); else a.shakeT[e.side] = 0.2; pop(e.side, e.delta > 0 ? '▲' : '▼', e.delta > 0 ? 'heal' : 'weak'); break; }
      case 'energy': d[e.side].energy = e.value; rerender(); break;
      case 'faint': {
        if (boss && e.side === 1) {
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
        sfx('faint'); const c = center(e.side); burst(a.parts, c.x, c.y, 'faint', null);
        for (let i = 0; i < 10; i++) { a.fade[e.side] = 1 - (i + 1) / 10; await wait(40); }
        break;
      }
      case 'switch': {
        if (e.side === 0) participants.current.add(bs.sides[0].team[e.index].uid);
        a.fade[e.side] = 1; a.enter[e.side] = 0;
        a.mons[e.side] = { ...a.mons[e.side], form: e.form, scale: monSlot(e.side, e.form).scale, y: monSlot(e.side, e.form).y, aura: auraColor(e.form), mutant: bs.sides[e.side].team[e.index].mutant };
        const m = bs.sides[e.side].team[e.index];
        d[e.side] = { form: e.form, lv: m.lv, hp: e.hp, max: maxHp(m), energy: e.energy, status: e.status, shield: 0, mutant: m.mutant };
        sfx('enter');
        // 落地時濺起水花
        setTimeout(() => { const c = center(e.side); burst(a.parts, c.x, c.y + 14, 'splash', 'water'); }, 380);
        rerender(); await wait(350); break;
      }
      case 'field': if (e.id && e.id !== fieldRef.current) { sfx('buff'); jolt(1, 0.2, '#ffffff'); } fieldRef.current = e.id; setField(e.id ? { id: e.id, turns: e.turns } : null); break;
      case 'trap': d[e.side].trap = e.turns; rerender(); break;
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
        const c = center(e.side), v = a.mons[e.side];
        v.aura = '#ff3040'; v.flash = 0.6; a.shakeT[e.side] = 0.8; sfx('enrage'); jolt(5, 0.4, '#ff2030');
        burst(a.parts, c.x, c.y, 'faint', 'fire'); burst(a.parts, c.x, c.y, 'buff', 'fire');
        pop(e.side, '狂暴！', 'crit'); await wait(700); break;
      }
      case 'end': break;
    }
  }

  async function play(evs: BEvent[]) { for (const e of evs) await apply(e); }

  async function afterTurn() {
    if (bs.over) return finish();
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
      sfx('fanfare'); setBossDown(true); say(`霸主「${FORMS[enc.mon.form].name}」被擊敗了！`);
      const end = Date.now() + 3400;
      while (Date.now() < end && !introSkip.current) await new Promise((r) => setTimeout(r, 40));
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
    onEnd({ outcome, enemy: crew ? active(bs, 1) : enc.mon, participants: [...participants.current], team: enc.team });
  }

  async function useLifeStone() {
    setMode('busy');
    run.lifeStones = (run.lifeStones ?? 0) - 1;
    lifeStoneRevive(bs, 0);
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
  const giveUp = async () => { setMode('busy'); await wait(300); onEnd({ outcome: 'lose', enemy: enc.mon, participants: [...participants.current] }); };

  /** 觸控：第一下選取並顯示說明，第二下才執行；有滑鼠時直接執行 */
  const confirmTap = (i: number, act: () => void) => {
    if (TOUCH && armed !== i) { setHover(i); setPeek(i); setArmed(i); return; }
    setArmed(-1); act();
  };
  useEffect(() => { setArmed(-1); setPeek(-1); if (mode === 'main') { hurry.current = false; planEnemy(); } }, [mode]);

  async function submit(a: Action) {
    setMode('busy');
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
  const meAffordAny = me.skills.some((_, i) => canAfford(bs, 0, i));
  const loveLock = !!bs.godhand && bs.godhand.loveTurn === bs.turn; // 無法忽視的愛：只能攻擊
  const toggleFast = () => { const v = !fast; setFast(v); try { localStorage.setItem(SPEED_KEY, v ? 'fast' : 'normal'); } catch { /* 略過 */ } };

  const reel = <Reel rarity={FORMS[foe.form].rarity} hpRatio={foe.hp / maxHp(foe)} hasStatus={!!foe.status} name={FORMS[foe.form].name} zoneBonus={boon(run, 'reelzone') * 0.15 + (run.perks?.reel ?? 0)} onDone={onReel} />;
  const startReel = () => { if (run.catchBait <= 0) return; sfx('cast'); run.catchBait--; setMode('reel'); };
  const picking = mode === 'switch' || mode === 'force' || mode === 'itemTarget';
  const hs = (mode === 'main' || mode === 'skills') && peek >= 0 ? SKILLS[me.skills[peek]] : null;
  const hi = mode === 'items' ? (Object.keys(ITEMS) as ItemId[])[hover] : null;

  return (
    <GameScreen vp={vp}
      scene={<SceneCanvas draw={draw} label="戰鬥畫面" />}
      overlay={<>
        {bossDown && <BossDown form={enc.mon.form} zone={final ? '萬潮的統領者' : zoneOf(run).special ? `${zoneOf(run).name}的守護者` : `${zoneOf(run).name}的霸主`} onSkip={() => { introSkip.current = true; }} />}
        {intro && <BossIntro phase={intro} form={enc.mon.form} lv={enc.mon.lv} zone={final ? '萬潮的統領者' : zoneOf(run).special ? `${zoneOf(run).name}的守護者` : `${zoneOf(run).name}的霸主`} onSkip={() => { introSkip.current = true; }} />}
        {!intro && <>
        <HudBox onOpen={() => setInfo(1)} side={1} d={de} rarity={crew ? undefined : FORMS[de.form].rarity} boss={boss} intent={mode === 'main' || mode === 'skills' ? intent : null} warn={!!intent?.atk && effectiveness(intent.elem, formOf(active(bs, 0)).elems) >= 2} crewLeft={crew ? bs.sides[1].team.filter((m) => m.hp > 0).length : 0} charged={volOf(bs, 1).charged} locked={volOf(bs, 1).lockOn} turns={active(bs, 1).statusTurns} />
        {anim.current.fade[0] > 0 && <HudBox onOpen={() => setInfo(0)} side={0} d={dp} charged={volOf(bs, 0).charged} locked={volOf(bs, 0).lockOn} turns={active(bs, 0).statusTurns} />}
        </>}
        {popups.map((p) => {
          const c = monSlot(p.side, disp.current[p.side].form);
          return <span key={p.id} class={`pop ${p.cls}`} style={{ left: `${((c.cx + p.dx) / W) * 100}%`, top: `${((c.cy - 30) / H) * 100}%` }}>{p.label && <small>{p.label}</small>}{p.text}</span>;
        })}
        {bs.godhand && <div class="gh-counter"><Icon name="heart" /> 陪神之手玩：第 <b>{Math.min(bs.turn, bs.godhand.survive)}</b> / {bs.godhand.survive} 回合{bs.godhand.rewinds > 0 && <span>（被倒退 {bs.godhand.rewinds} 次）</span>}{loveLock && <em>只能攻擊！</em>}</div>}
        {pulls && <div class="gh-pulls" key={pulls.id}>{pulls.names.map((n, i) => <span key={i} style={{ animationDelay: `${i * 0.18}s` }}>{n}</span>)}</div>}
        {rewind !== 0 && <div class="gh-rewind" key={rewind}>⟲ 時間倒退了</div>}
        {bs.domain && <div class="domain-chip" style={{ borderColor: DOMAINS[bs.domain].color, color: DOMAINS[bs.domain].color }} title={DOMAINS[bs.domain].desc}><Icon name="sparkle" /> 領域・{DOMAINS[bs.domain].name}<span>{DOMAINS[bs.domain].short}</span></div>}
        {field && <div class={`field-chip ${bs.domain ? 'below' : ''}`} style={{ borderColor: FIELDS[field.id].color }} title={FIELDS[field.id].desc}><i style={{ background: FIELDS[field.id].color }} />{FIELDS[field.id].name}<span>剩 {field.turns} 回合</span></div>}
        <button class="speed" onClick={toggleFast} aria-pressed={fast}>{fast ? '▶▶ 快速' : '▶ 一般'}</button>
        {mode === 'reel' && !vp.portrait && reel}
        {toast && <div class="item-toast" key={toast.id}><Sprite form={toast.form} size={48} /><span class="grow"><b><Icon name="heal" /> {toast.text}</b><Bar value={toast.hp} max={toast.max} /><span class="num small">HP {toast.from} → {toast.hp}/{toast.max}</span></span></div>}
        {mode === 'main' && !boss && <Tip id="battle">直接點技能出招（◆ 是能量消耗）。對手 HP 條下面的「下一步」是牠這回合要做的事。把對手打虛弱再按「捕捉」，比較容易收服。點 HP 框可以看詳細資料。</Tip>}
        {mode === 'main' && boss && <Tip id="boss">霸主的 HP 掉到一半時會狂暴：攻擊提高，但防禦會露出破綻。霸主不能捕捉，也不能逃跑。</Tip>}
      </>}
      onPanelClose={info !== null ? () => setInfo(null) : mode === 'switch' || mode === 'itemTarget' ? () => setMode(mode === 'itemTarget' ? 'items' : 'main') : undefined}
      panel={info !== null ? <InfoPanel bs={bs} side={info} boss={boss} onClose={() => setInfo(null)} /> : picking && (
        <Win class="big-panel" title={mode === 'force' ? '要派誰上場？' : mode === 'itemTarget' ? `對誰使用 ${ITEMS[itemPick!].name}？` : '換人'} onClose={mode !== 'force' ? () => setMode(mode === 'itemTarget' ? 'items' : 'main') : undefined} closeLabel="返回">
          <div class="pick-grid">
            {run.party.map((m, i) => {
              const isActive = i === bs.sides[0].active;
              const disabled = mode === 'itemTarget'
                ? (itemPick === 'revive' ? m.hp > 0 : m.hp <= 0 || m.hp >= maxHp(m))
                : m.hp <= 0 || isActive;
              return (
                <button class="pick" disabled={disabled} key={m.uid}
                  onClick={() => (mode === 'itemTarget' ? submit({ type: 'item', item: itemPick!, target: i }) : chooseSwitch(i))}>
                  <Sprite form={m.form} size={48} mutant={m.mutant} />
                  <span class="grow">
                    <span class="row-gap"><b>{FORMS[m.form].name}</b><span class="num">Lv{m.lv}</span>{isActive && <span class="small dim">出場中</span>}</span>
                    <Bar value={m.hp} max={maxHp(m)} />
                    <span class="small dim">{Math.max(0, m.hp)}/{maxHp(m)}{m.status ? ` · ${statusLabel(m.status)}` : ''}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Win>
      )}
      dock={mode === 'reel' && vp.portrait ? reel : (
        <div class="dock-split battle-dock">
          <Win class="msg">
            <div class="tap-hurry" onClick={() => { if (mode === 'busy') hurry.current = true; }}>
            {hs ? (
              <div class="skill-info">
                <div class="row-gap"><b class="big-name">{hs.name}</b>{hs.elem ? <ElemChip e={hs.elem} /> : <span class="chip neutral">無</span>}</div>
                <p class="small">{hs.power ? (() => { const p = Math.round(effPower(bs, 0, 1, hs)); return p !== hs.power ? `威力 ${hs.power} → ${p}` : `威力 ${hs.power}`; })() : '變化技'} · 能量 {hs.cost} · 命中 {Math.round(Math.min(1, hitChance(bs, 0, hs)) * 100)}{hs.power > 0 && (() => { const e = effectiveness(hs.elem, formOf(foe).elems); return e >= 2 ? ' · 效果絕佳！' : e < 1 ? ' · 效果不好' : ''; })()}</p>
                <p class="small dim">{hs.desc}</p>
                {TOUCH && armed === peek && <p class="small accent">再點一次使用</p>}
              </div>
            ) : hi ? (
              <div class="skill-info"><b class="big-name">{ITEMS[hi].name}</b><p class="small dim">{ITEMS[hi].desc}</p></div>
            ) : (
              <div class="log" aria-live="polite">
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
                <div class="cmd-grid">
                  {me.skills.map((id, i) => {
                    const sk = SKILLS[id], ok = canAfford(bs, 0, i);
                    return (
                      <MenuItem key={id} disabled={!ok} sel={TOUCH && armed === i} onHover={() => { setHover(i); if (!TOUCH) setPeek(i); }} onClick={() => confirmTap(i, () => submit({ type: 'skill', slot: i }))}
                        sub={<span class="cost">{'◆'.repeat(sk.cost) || '—'}</span>}>
                        <i class="dot" style={{ background: sk.elem ? `var(--el-${sk.elem})` : '#c8d2e8' }} />{sk.name}
                      </MenuItem>
                    );
                  })}
                  {!meAffordAny && <MenuItem onClick={() => submit({ type: 'skill', slot: -1 })}>掙扎</MenuItem>}
                </div>
                <div class="act-row">
                  {!boss && !crew && !gh && <button class="act-btn" onClick={startReel} disabled={run.catchBait <= 0}><Icon name="rod" /> 捕捉<small>×{run.catchBait}</small></button>}
                  <button class="act-btn" disabled={loveLock} onClick={() => setMode('switch')}><Icon name="swap" /> 換人</button>
                  <button class="act-btn" disabled={loveLock} onClick={() => { setHover(0); setMode('items'); }}><Icon name="bag" /> 道具</button>
                  {!boss && !gh && <button class="act-btn" onClick={() => submit({ type: 'run' })}><Icon name="flee" /> 逃跑</button>}
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
                      sub={<span class="cost">{'◆'.repeat(sk.cost) || '—'}</span>}>
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
        <span class="bi-title">— {form === 'tide_moxu' ? '萬潮的聲音，安靜了下來' : `${FORMS[form].name} 被擊敗了，海面恢復了平靜`} —</span>
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
const RarTag = ({ form, r }: { form: string; r?: keyof typeof RARITY }) => (form === 'godhand' ? <InfTag /> : form === 'tide_moxu' ? <URTag /> : r ? <RarityTag r={r} /> : null);

function HudBox({ side, d, rarity, boss, charged, locked, turns, onOpen, intent, crewLeft, warn }: { side: SideId; d: Disp; rarity?: keyof typeof RARITY; boss?: boolean; charged?: boolean; locked?: boolean; turns?: number; onOpen?: () => void; intent?: Intent | null; crewLeft?: number; warn?: boolean }) {
  const f = FORMS[d.form];
  return (
    <div class={`hud hud-${side} clickable`} onClick={onOpen} role="button" aria-label={`查看 ${f.name} 的資料`}>
      <div class="hud-top">
        <b class="hud-name">{f.name}</b>{d.mutant && <span class="mutant-tag">✦</span>}
        <RarTag form={d.form} r={rarity} />
        {boss && <span class="boss-tag">{d.form === 'tide_moxu' ? '統領者' : '霸主'}</span>}
        {!!crewLeft && <span class="crew-left" title="船隊剩下的夥伴">{'●'.repeat(crewLeft)}</span>}
        {d.form !== 'godhand' && <span class="lv">Lv{d.lv}</span>}
      </div>
      <div class="hud-sub"><Elems list={f.elems} />{f.id === 'godhand' && <span class="st st-shield">無屬性・異常無效</span>}{d.status && <span class={`st st-${d.status}`}>{statusLabel(d.status)}{turns ? ` ${turns >= 90 ? '∞' : turns}` : ''}</span>}{d.shield > 0 && <span class="st st-shield">護盾 {d.shield}</span>}{(d.trap ?? 0) > 0 && <span class="st st-trap">暗礁 {d.trap}</span>}{charged && <span class="st st-charge">蓄力</span>}{locked && <span class="st st-lock">鎖定</span>}</div>
      <Bar value={d.hp} max={d.max} />
      <div class="hud-foot">
        <Energy value={d.energy} max={MAX_ENERGY} />
        {side === 0 && <span class="hpnum">{d.hp}/{d.max}</span>}
      </div>
      {intent && <div class={`hud-intent ${warn ? 'warn' : ''}`} title={warn ? '對你的夥伴效果絕佳！' : undefined}><span class="dim">下一步</span> <Icon name={intent.icon} /> {intent.name}{warn && ' ‼'}</div>}
    </div>
  );
}


// 戰鬥中查看資料：自己看得到技能，對手只看得到狀態與被動特性
const STAGE_LABEL = { atk: '攻擊', def: '防禦', spd: '速度' } as const;
function InfoPanel({ bs, side, boss, onClose }: { bs: BattleState; side: SideId; boss: boolean; onClose: () => void }) {
  const m = active(bs, side), f = formOf(m), v = volOf(bs, side), mx = maxHp(m), st = statsOf(m);
  const stages = (Object.keys(STAGE_LABEL) as (keyof typeof STAGE_LABEL)[]).filter((k) => v.stages[k]);
  const mine = side === 0;
  return (
    <Win class="big-panel battle-info" title={mine ? '我方資料' : boss ? '霸主資料' : '對手資料'} onClose={onClose}>
      <div class="pick">
        <Sprite form={m.form} size={96} mutant={m.mutant} />
        <span class="grow">
          <span class="row-gap"><b class="big-name">{m.mutant ? '✦ ' : ''}{f.name}</b>{m.form === 'godhand' || m.form === 'tide_moxu' ? <RarTag form={m.form} /> : <RarityTag r={f.rarity} />}{m.form !== 'godhand' && <><StageTag form={m.form} /><span class="num">Lv{m.lv}</span></>}</span>
          <span class="row-gap"><Elems list={f.elems} /><span class="small dim">{f.category}</span>{mine && <IvStars iv={m.iv} />}</span>
          <Bar value={m.hp} max={mx} />
          <span class="row-gap">{mine && <span class="small">{Math.max(0, m.hp)}/{mx}</span>}<Energy value={v.energy} max={MAX_ENERGY} /></span>
        </span>
      </div>
      <div class="row-gap">
        {m.status && <span class={`st st-${m.status}`}>{statusLabel(m.status)}{m.statusTurns ? ` ${m.statusTurns}` : ''}</span>}
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
