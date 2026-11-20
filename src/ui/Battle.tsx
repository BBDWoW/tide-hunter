// 戰鬥畫面：把引擎吐出的事件依序播放成動畫，並提供玩家的選單
import { useEffect, useRef, useState } from 'preact/hooks';
import { FORMS } from '../data/creatures';
import { FIELDS, SKILLS, type FieldId, type StatusId } from '../data/skills';
import { effectiveness, RARITY } from '../data/types';
import {
  active, aiChoose, aiForcedSwitch, canAfford, createBattle, effPower, forcedSwitch, hitChance, ITEMS, lifeStoneRevive, MAX_ENERGY, resolveTurn, statusLabel, volOf,
  type Action, type BattleState, type BEvent, type ItemId, type SideId,
} from '../game/battle';
import { formOf, maxHp, type Mon } from '../game/creature';
import { makeRng, next } from '../game/rng';
import { catchChance, rollShakes } from '../game/capture';
import { battleMods, boon, zoneOf } from '../game/run';
import type { Encounter, RunState } from '../game/run';
import { auraColor, burst, drawBattle, drawNet, H, monSlot, W, type Beam, type MonView, type Particle } from '../render/scene';
import { Bar, ElemChip, Elems, Energy, RarityTag, Sprite } from './components';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';
import { MenuItem } from './Screens';
import { Reel } from './Reel';

export interface BattleResult { outcome: 'win' | 'lose' | 'caught' | 'fled'; enemy: Mon; participants: string[] }

type Mode = 'busy' | 'main' | 'skills' | 'switch' | 'force' | 'items' | 'itemTarget' | 'reel' | 'lifestone';
interface Disp { form: string; lv: number; hp: number; max: number; energy: number; status: StatusId | null; shield: number; trap?: number; mutant?: boolean }
interface Popup { id: number; side: SideId; text: string; cls: string }

const SPEED_KEY = 'tidehunter.speed';
const readSpeed = () => { try { return localStorage.getItem(SPEED_KEY) === 'fast'; } catch { return false; } };

export function Battle({ vp, run, enc, boss, onEnd }: { vp: Viewport; run: RunState; enc: Encounter; boss: boolean; onEnd: (r: BattleResult) => void }) {
  const bsRef = useRef<BattleState | null>(null);
  if (!bsRef.current) {
    bsRef.current = createBattle(makeRng((next(run.rng) * 2 ** 32) >>> 0), { team: run.party, name: '你', mods: battleMods(run) }, { team: [enc.mon], name: boss ? '霸主' : '野生' }, true);
  }
  const bs = bsRef.current;
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
  const net = useRef<{ wob: number; glow: number } | null>(null);

  const mkView = (side: SideId, form: string): MonView => {
    const p = monSlot(side, form);
    return { form, x: p.x, y: p.y, flip: side === 1, flash: 0, shake: 0, lunge: 0, alpha: 0, scale: p.scale, aura: auraColor(form, side === 1 && boss), mutant: active(bs, side).mutant };
  };
  const anim = useRef({
    mons: [mkView(0, disp.current[0].form), mkView(1, disp.current[1].form)] as MonView[],
    lungeT: [0, 0], shakeT: [0, 0], fade: [1, 1] as number[], enter: [0, 0] as number[],
    parts: [] as Particle[], beams: [] as Beam[],
  });

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, fastRef.current ? ms * 0.45 : ms));
  const say = (text: string) => setLog((l) => [...l.slice(-30), text]);
  const pop = (side: SideId, text: string, cls: string) => {
    const id = Math.random();
    setPopups((p) => [...p, { id, side, text, cls }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1000);
  };

  // 每一格畫面：更新動畫狀態後繪製
  const draw = (ctx: CanvasRenderingContext2D, t: number, dt: number) => {
    const a = anim.current;
    for (const side of [0, 1] as SideId[]) {
      const v = a.mons[side];
      a.enter[side] = Math.min(1, a.enter[side] + dt * 2.2);
      const p = monSlot(side, v.form), e = 1 - Math.pow(1 - a.enter[side], 3);
      v.x = p.x + (1 - e) * (side === 0 ? -90 : 90);
      a.lungeT[side] = Math.max(0, a.lungeT[side] - dt);
      v.lunge = Math.sin((a.lungeT[side] / 0.25) * Math.PI) * 12 * (a.lungeT[side] > 0 ? 1 : 0);
      v.flash = Math.max(0, v.flash - dt);
      a.shakeT[side] = Math.max(0, a.shakeT[side] - dt);
      v.shake = a.shakeT[side] > 0 ? 1 : 0;
      v.alpha = e * a.fade[side];
    }
    drawBattle(ctx, t, dt, a.mons, a.parts, a.beams, zoneOf(run).theme);
    if (net.current) { const c = monSlot(1, a.mons[1].form); const n = net.current; n.glow = Math.max(0, n.glow - dt); drawNet(ctx, c.cx, c.cy + 6, n.wob, n.glow); }
  };

  // 開場
  useEffect(() => {
    (async () => {
      const ef = FORMS[enc.mon.form];
      await wait(500);
      say(boss ? `霸主「${ef.name}」擋住了去路！` : `野生的 ${ef.name} 出現了！`);
      if (enc.rarity === 'SSR') say('★ 傳說級的氣息！這可能是唯一的機會！');
      else if (enc.rarity === 'S') say('☆ 史詩級的稀有生物！');
      if (enc.mon.mutant) say('✦ 是異變個體！牠的顏色跟一般的不一樣！');
      await wait(700);
      say(`上吧，${formOf(active(bs, 0)).name}！`);
      await wait(500);
      setMode('main');
    })();
  }, []);

  const center = (side: SideId) => { const v = anim.current.mons[side]; const p = monSlot(side, v.form); return { x: p.cx, y: p.cy }; };

  async function apply(e: BEvent) {
    const a = anim.current, d = disp.current;
    switch (e.t) {
      case 'msg': say(e.text); await wait(560); break;
      case 'use': {
        const sk = SKILLS[e.skill] ?? { anim: 'hit', elem: null };
        const foe: SideId = e.side === 0 ? 1 : 0, c = center(foe), me = center(e.side);
        const kind = sk.anim ?? 'hit';
        if (kind === 'buff' || kind === 'heal') { burst(a.parts, me.x, me.y, kind, sk.elem); }
        else {
          a.lungeT[e.side] = 0.25;
          if (kind === 'beam') a.beams.push({ x0: me.x, y0: me.y - 6, x1: c.x, y1: c.y - 6, life: 0.35, color: sk.elem ? '#ffffff' : '#ffffff' });
          setTimeout(() => burst(a.parts, c.x, c.y - 4, kind === 'splash' ? 'splash' : 'hit', sk.elem), 150);
        }
        await wait(260); break;
      }
      case 'miss': break;
      case 'dmg': {
        d[e.side].hp = e.hp; d[e.side].shield = e.shield;
        a.mons[e.side].flash = 0.35; a.shakeT[e.side] = 0.3;
        pop(e.side, `-${e.amount}`, e.crit ? 'crit' : e.eff >= 2 ? 'super' : e.eff < 1 ? 'weak' : '');
        rerender(); await wait(420); break;
      }
      case 'heal': {
        d[e.side].hp = e.hp; const c = center(e.side);
        if (e.amount > 0) { burst(a.parts, c.x, c.y, 'heal', null); pop(e.side, `+${e.amount}`, 'heal'); }
        rerender(); await wait(300); break;
      }
      case 'shield': d[e.side].shield = e.amount; rerender(); break;
      case 'status': d[e.side].status = e.status; rerender(); break;
      case 'stat': { const c = center(e.side); if (e.delta > 0) burst(a.parts, c.x, c.y, 'buff', null); else a.shakeT[e.side] = 0.2; pop(e.side, e.delta > 0 ? '▲' : '▼', e.delta > 0 ? 'heal' : 'weak'); break; }
      case 'energy': d[e.side].energy = e.value; rerender(); break;
      case 'faint': {
        const c = center(e.side); burst(a.parts, c.x, c.y, 'faint', null);
        for (let i = 0; i < 10; i++) { a.fade[e.side] = 1 - (i + 1) / 10; await wait(40); }
        break;
      }
      case 'switch': {
        if (e.side === 0) participants.current.add(bs.sides[0].team[e.index].uid);
        a.fade[e.side] = 1; a.enter[e.side] = 0;
        a.mons[e.side] = { ...a.mons[e.side], form: e.form, scale: monSlot(e.side, e.form).scale, y: monSlot(e.side, e.form).y, aura: auraColor(e.form), mutant: bs.sides[e.side].team[e.index].mutant };
        const m = bs.sides[e.side].team[e.index];
        d[e.side] = { form: e.form, lv: m.lv, hp: e.hp, max: maxHp(m), energy: e.energy, status: e.status, shield: 0, mutant: m.mutant };
        rerender(); await wait(350); break;
      }
      case 'field': setField(e.id ? { id: e.id, turns: e.turns } : null); break;
      case 'trap': d[e.side].trap = e.turns; rerender(); break;
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
    let outcome: BattleResult['outcome'] = caught ? 'caught' : over?.fled ? 'fled' : over?.winner === 0 ? 'win' : 'lose';
    if (outcome === 'win') { say('戰鬥勝利！'); }
    if (outcome === 'lose') {
      say('你的隊伍全部倒下了……');
      if ((run.lifeStones ?? 0) > 0) { await wait(500); say(`要使用生命石讓全隊復活嗎？（剩 ${run.lifeStones} 顆）`); setMode('lifestone'); return; }
    }
    await wait(1100);
    onEnd({ outcome, enemy: enc.mon, participants: [...participants.current] });
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

  async function submit(a: Action) {
    setMode('busy');
    if (a.type === 'item') run.items[a.item]--;
    const evs = resolveTurn(bs, [a, aiChoose(bs, 1)]);
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
    const chanceAll = catchChance(foe, quality, boon(run, 'shake'));
    const shakes = rollShakes(bs.rng, chanceAll);
    const a = anim.current, c = center(1);
    for (let i = 0; i < 10; i++) { a.fade[1] = 1 - (i + 1) / 10; await wait(30); }
    net.current = { wob: 0, glow: 0 };
    say(`收線成功！${name} 被網住了……`);
    await wait(700);
    for (let i = 0; i < shakes.length; i++) {
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
      say(`可惡！${name} 掙脫了網子！`);
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
      if (mode === 'main' && n >= 1 && n <= 5) [() => setMode('skills'), () => !boss && setMode('reel'), () => setMode('switch'), () => setMode('items'), () => !boss && submit({ type: 'run' })][n - 1]();
      else if (mode === 'skills' && n >= 1 && n <= 4) { const m = active(bs, 0); if (m.skills[n - 1] && canAfford(bs, 0, n - 1)) submit({ type: 'skill', slot: n - 1 }); }
      else if (e.key === 'Escape' && ['skills', 'switch', 'items', 'itemTarget'].includes(mode)) setMode('main');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const me = active(bs, 0), foe = active(bs, 1), [dp, de] = disp.current;
  const meAffordAny = me.skills.some((_, i) => canAfford(bs, 0, i));
  const toggleFast = () => { const v = !fast; setFast(v); try { localStorage.setItem(SPEED_KEY, v ? 'fast' : 'normal'); } catch { /* 略過 */ } };

  const reel = <Reel rarity={FORMS[foe.form].rarity} hpRatio={foe.hp / maxHp(foe)} hasStatus={!!foe.status} name={FORMS[foe.form].name} zoneBonus={boon(run, 'reelzone') * 0.15 + (run.perks?.reel ?? 0)} onDone={onReel} />;
  const startReel = () => { if (run.catchBait <= 0) return; run.catchBait--; setMode('reel'); };
  const picking = mode === 'switch' || mode === 'force' || mode === 'itemTarget';
  const hs = mode === 'skills' ? SKILLS[me.skills[hover]] : null;
  const hi = mode === 'items' ? (Object.keys(ITEMS) as ItemId[])[hover] : null;

  return (
    <GameScreen vp={vp}
      scene={<SceneCanvas draw={draw} label="戰鬥畫面" />}
      overlay={<>
        <HudBox side={1} d={de} rarity={FORMS[de.form].rarity} boss={boss} charged={volOf(bs, 1).charged} locked={volOf(bs, 1).lockOn} />
        <HudBox side={0} d={dp} charged={volOf(bs, 0).charged} locked={volOf(bs, 0).lockOn} />
        {popups.map((p) => {
          const c = monSlot(p.side, disp.current[p.side].form);
          return <span key={p.id} class={`pop ${p.cls}`} style={{ left: `${(c.cx / W) * 100}%`, top: `${((c.cy - 30) / H) * 100}%` }}>{p.text}</span>;
        })}
        {field && <div class="field-chip" style={{ borderColor: FIELDS[field.id].color }} title={FIELDS[field.id].desc}><i style={{ background: FIELDS[field.id].color }} />{FIELDS[field.id].name}<span>剩 {field.turns} 回合</span></div>}
        <button class="speed" onClick={toggleFast} aria-pressed={fast}>{fast ? '▶▶ 快速' : '▶ 一般'}</button>
        {mode === 'reel' && !vp.portrait && reel}
      </>}
      panel={picking && (
        <Win class="big-panel" title={mode === 'force' ? '要派誰上場？' : mode === 'itemTarget' ? `對誰使用 ${ITEMS[itemPick!].name}？` : '換人'}>
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
          {mode !== 'force' && <MenuItem onClick={() => setMode(mode === 'itemTarget' ? 'items' : 'main')}>返回</MenuItem>}
        </Win>
      )}
      dock={mode === 'reel' && vp.portrait ? reel : (
        <div class="dock-split battle-dock">
          <Win class="msg">
            {hs ? (
              <div class="skill-info">
                <div class="row-gap"><b class="big-name">{hs.name}</b>{hs.elem ? <ElemChip e={hs.elem} /> : <span class="chip neutral">無</span>}</div>
                <p class="small">{hs.power ? (() => { const p = Math.round(effPower(bs, 0, 1, hs)); return p !== hs.power ? `威力 ${hs.power} → ${p}` : `威力 ${hs.power}`; })() : '變化技'} · 能量 {hs.cost} · 命中 {Math.round(Math.min(1, hitChance(bs, 0, hs)) * 100)}{hs.power > 0 && (() => { const e = effectiveness(hs.elem, formOf(foe).elems); return e >= 2 ? ' · 效果絕佳！' : e < 1 ? ' · 效果不好' : ''; })()}</p>
                <p class="small dim">{hs.desc}</p>
              </div>
            ) : hi ? (
              <div class="skill-info"><b class="big-name">{ITEMS[hi].name}</b><p class="small dim">{ITEMS[hi].desc}</p></div>
            ) : (
              <div class="log" aria-live="polite">
                {log.slice(-2).map((l, i, arr) => <p key={log.length - arr.length + i} class={i === arr.length - 1 ? 'last' : 'prev'}>{l}</p>)}
                {mode === 'main' && <p class="prev">要怎麼做？</p>}
              </div>
            )}
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
              <div class="cmd-grid">
                <MenuItem onClick={() => { setHover(0); setMode('skills'); }} hot>技能</MenuItem>
                <MenuItem onClick={startReel} disabled={boss || run.catchBait <= 0} sub={boss ? '' : `餌×${run.catchBait}`}>收線捕捉</MenuItem>
                <MenuItem onClick={() => setMode('switch')}>換人</MenuItem>
                <MenuItem onClick={() => { setHover(0); setMode('items'); }}>道具</MenuItem>
                {!boss && <MenuItem onClick={() => submit({ type: 'run' })}>剪線逃跑</MenuItem>}
              </div>
            )}
            {mode === 'skills' && (
              <div class="cmd-grid">
                {me.skills.map((id, i) => {
                  const sk = SKILLS[id], ok = canAfford(bs, 0, i);
                  return (
                    <MenuItem key={id} disabled={!ok} onHover={() => setHover(i)} onClick={() => submit({ type: 'skill', slot: i })}
                      sub={<span class="cost">{'◆'.repeat(sk.cost) || '—'}</span>}>
                      <i class="dot" style={{ background: sk.elem ? `var(--el-${sk.elem})` : '#c8d2e8' }} />{sk.name}
                    </MenuItem>
                  );
                })}
                {!meAffordAny && <MenuItem onClick={() => submit({ type: 'skill', slot: -1 })}>掙扎</MenuItem>}
                <MenuItem onClick={() => setMode('main')}>返回</MenuItem>
              </div>
            )}
            {mode === 'items' && (
              <div class="cmd-grid">
                {(Object.keys(ITEMS) as ItemId[]).map((id, i) => (
                  <MenuItem key={id} disabled={!run.items[id]} onHover={() => setHover(i)} sub={`×${run.items[id] ?? 0}`}
                    onClick={() => { if (id === 'ether') submit({ type: 'item', item: id, target: bs.sides[0].active }); else { setItemPick(id); setMode('itemTarget'); } }}>
                    {ITEMS[id].name}
                  </MenuItem>
                ))}
                <MenuItem onClick={() => setMode('main')}>返回</MenuItem>
              </div>
            )}
          </Win>
        </div>
      )} />
  );
}

function HudBox({ side, d, rarity, boss, charged, locked }: { side: SideId; d: Disp; rarity?: keyof typeof RARITY; boss?: boolean; charged?: boolean; locked?: boolean }) {
  const f = FORMS[d.form];
  return (
    <div class={`hud hud-${side}`}>
      <div class="hud-top">
        <b class="hud-name">{f.name}</b>{d.mutant && <span class="mutant-tag">✦</span>}
        {rarity && <RarityTag r={rarity} />}
        {boss && <span class="boss-tag">霸主</span>}
        <span class="lv">Lv{d.lv}</span>
      </div>
      <div class="hud-sub"><Elems list={f.elems} />{d.status && <span class={`st st-${d.status}`}>{statusLabel(d.status)}</span>}{d.shield > 0 && <span class="st st-shield">護盾 {d.shield}</span>}{(d.trap ?? 0) > 0 && <span class="st st-trap">暗礁 {d.trap}</span>}{charged && <span class="st st-charge">蓄力</span>}{locked && <span class="st st-lock">鎖定</span>}</div>
      <Bar value={d.hp} max={d.max} />
      <div class="hud-foot">
        <Energy value={d.energy} max={MAX_ENERGY} />
        {side === 0 && <span class="hpnum">{d.hp}/{d.max}</span>}
      </div>
    </div>
  );
}

