// 超特殊事件：神之手。打倒霸主後極低機率出現。
// 犧牲兩隻指定稀有度的夥伴 → 神之手把霸主抓給你；拒絕 → 可以選擇陪它玩 20 回合。
import { useEffect, useRef, useState } from 'preact/hooks';
import { fx } from '../render/fx';
import { sfx } from '../audio/engine';
import { FORMS } from '../data/creatures';
import { RARITY } from '../data/types';
import { formOf, makeMon, maxHp, type Mon } from '../game/creature';
import { loadMeta, newBayMon, saveMeta, claimAchievement } from '../game/meta';
import { godHandMatch, markCaught, PARTY_MAX, saveRun, type RunState } from '../game/run';
import { PAL, animFrame, drawSprite } from '../render/pixel';
import { drawSea } from '../render/scene';
import { Bar, Sprite } from './components';
import { Icon } from './Icon';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';
import { MenuItem } from './Screens';

/** 神之手：天上照下來的光柱 + 雲上的手（hand = false 時只畫光，給戰鬥畫面用） */
export function drawGodHand(c: CanvasRenderingContext2D, t: number, x: number, handY: number, scale = 1, open = 0, hand = true) {
  const size = 96 * scale;
  const beamH = handY + size * 0.6;
  const g = c.createLinearGradient(0, 0, 0, beamH);
  g.addColorStop(0, 'rgba(255,240,190,0.32)'); g.addColorStop(1, 'rgba(255,240,190,0)');
  c.fillStyle = g; c.fillRect(x - size * 0.45, 0, size * 0.9, beamH);
  // 飄落的金色光點
  for (let i = 0; i < 12; i++) { const p = (t * 0.25 + i / 12) % 1; c.fillStyle = `rgba(255,230,150,${1 - p})`; c.fillRect(Math.round(x - size / 2 + ((i * 41) % size)), Math.round(p * (handY + size * 0.5)), 1, 1); }
  if (hand) drawSprite(c, 'godhand', PAL.water, x - size / 2, handY + Math.sin(t * 1.4) * 2 - open * 2, { scale });
}

// ── 專屬登場動畫 ──
const IW = 192, IH = 108;
const rnd = (i: number) => { const v = Math.sin(i * 91.7 + 13.3) * 43758.5453; return v - Math.floor(v); };
const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));
const ease = (x: number) => 1 - Math.pow(1 - x, 3);
function cloud(c: CanvasRenderingContext2D, x: number, y: number, w: number, a: number) {
  c.fillStyle = `rgba(236,232,252,${a})`;
  for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(x + (k - 2.5) * w * 0.16, y - Math.sin(k * 1.7) * w * 0.06, w * (0.14 + 0.04 * (k % 3)), 0, 7); c.fill(); }
  c.fillStyle = `rgba(186,176,226,${a})`; c.fillRect(x - w * 0.45, y + w * 0.06, w * 0.9, 2);
}
function drawIntro(c: CanvasRenderingContext2D, t: number, D: number) {
  const p = t / D;
  // 1) 世界凝結、變暗
  const dark = ease(seg(p, 0, 0.12));
  const g = c.createLinearGradient(0, 0, 0, IH);
  g.addColorStop(0, `rgb(${Math.round(20 - dark * 12)},${Math.round(30 - dark * 20)},${Math.round(70 - dark * 50)})`); g.addColorStop(1, '#03030c');
  c.fillStyle = g; c.fillRect(0, 0, IW, IH);
  for (let i = 0; i < 50; i++) { const tw = Math.sin(t * 2 + i) > 0.3 ? 1 : 0.4; c.fillStyle = `rgba(255,250,230,${0.6 * tw * dark})`; c.fillRect(Math.round(rnd(i) * IW), Math.round(rnd(i + 7) * IH * 0.6), 1, 1); }
  // 2) 天空裂開一道金縫，光倒下來
  const crack = ease(seg(p, 0.12, 0.32)), open = ease(seg(p, 0.3, 0.5));
  if (crack > 0) {
    c.save(); c.translate(IW / 2, 0);
    const w = 1 + open * 40;
    const lg = c.createLinearGradient(0, 0, 0, IH);
    lg.addColorStop(0, `rgba(255,236,170,${0.9 * crack})`); lg.addColorStop(1, 'rgba(255,236,170,0)');
    c.fillStyle = lg; c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(w / 2, 0); c.lineTo(w * 1.6, IH); c.lineTo(-w * 1.6, IH); c.fill();
    c.fillStyle = `rgba(255,255,240,${crack})`; c.fillRect(-1, 0, 2, 40 * crack + open * 70);
    for (let k = 0; k < 6; k++) { const yy = 6 + k * 7; if (yy < 40 * crack) { c.fillRect(-3 - (k % 2) * 2, yy, 2, 1); c.fillRect(2 + (k % 2), yy + 3, 2, 1); } }
    c.restore();
  }
  // 3) 金色光環降下、雲從兩邊湧進來
  const halo = ease(seg(p, 0.38, 0.62)), clouds = ease(seg(p, 0.4, 0.66));
  if (halo > 0) {
    const hy = -10 + halo * 16;
    c.strokeStyle = `rgba(255,214,110,${halo})`; c.lineWidth = 2; c.beginPath(); c.ellipse(IW / 2, hy, 30, 6, 0, 0, 7); c.stroke();
    c.strokeStyle = `rgba(255,250,220,${halo})`; c.lineWidth = 1; c.beginPath(); c.ellipse(IW / 2, hy, 30, 6, 0, 0, 7); c.stroke();
    c.fillStyle = `rgba(255,255,240,${halo})`; c.fillRect(IW / 2 - 1, hy - 10, 2, 20); c.fillRect(IW / 2 - 8, hy - 1, 16, 2);
  }
  if (clouds > 0) {
    cloud(c, -40 + clouds * 90, 82, 70, clouds); cloud(c, IW + 40 - clouds * 90, 86, 70, clouds);
    cloud(c, -30 + clouds * 70, 96, 60, clouds * 0.9); cloud(c, IW + 30 - clouds * 70, 98, 60, clouds * 0.9);
  }
  // 4) 神之手從雲裡升起，石柱圍著轉
  const rise = ease(seg(p, 0.58, 0.82));
  if (rise > 0) {
    const sz = 96 * 0.9, hy = IH - rise * (IH + 4) + Math.sin(t * 1.5) * 1.5;
    c.save(); c.globalAlpha = rise; drawSprite(c, 'godhand', PAL.water, IW / 2 - sz / 2, hy, { scale: 0.9 }); c.restore();
    for (let i = 0; i < 18; i++) { const a = t * 0.8 + i; c.fillStyle = `rgba(255,230,150,${rise * (0.5 + 0.5 * Math.sin(t * 4 + i))})`; c.fillRect(Math.round(IW / 2 + Math.cos(a) * (40 + (i % 4) * 6)), Math.round(hy + 40 + Math.sin(a * 1.3) * 26), 1, 1); }
  }
  // 5) 一道白光
  const fl = seg(p, 0.8, 0.84) - seg(p, 0.84, 0.95);
  if (fl > 0) { c.fillStyle = `rgba(255,255,255,${fl})`; c.fillRect(0, 0, IW, IH); }
}

/** 神之手登場：天空凝結 → 裂縫 → 光環 → 雲 → 手 → 字卡 */
export function GodHandIntro({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [card, setCard] = useState(false);
  const done = useRef(false), t0 = useRef(performance.now());
  const finish = () => { if (performance.now() - t0.current < 700 || done.current) return; done.current = true; onDone(); };
  useEffect(() => {
    const c = ref.current!.getContext('2d')!; c.imageSmoothingEnabled = false;
    const D = fx.reduce ? 2.5 : 6.2; let raf = 0;
    const timers = [
      window.setTimeout(() => sfx('reveal'), 900),
      window.setTimeout(() => sfx('energy'), 2400),
      window.setTimeout(() => sfx('fanfare'), D * 830),
      window.setTimeout(() => setCard(true), D * 840),
    ];
    const loop = (now: number) => { drawIntro(c, Math.min((now - t0.current) / 1000, D * 1.5), D); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, []);
  return (
    <div class="zone-cut gh-intro" onClick={finish} role="dialog" aria-label="神之手登場">
      <canvas ref={ref} width={IW} height={IH} />
      {card && (
        <div class="zc-card">
          <span class="zc-eyebrow">超特殊事件</span>
          <span class="gh-inf">∞</span>
          <b class="zc-name">神之手</b>
          <span class="zc-line">從天上伸下來的一隻手，擁有壓垮世界的力量。<br />但其實，它只是想有人陪。</span>
        </div>
      )}
      <span class="zc-skip">點一下{card ? '繼續' : '跳過'}</span>
    </div>
  );
}

const RAR_ORDER = ['SSR', 'S', 'A', 'B', 'N'];

export function GodHandScreen({ vp, run, onFight, onDone }: { vp: Viewport; run: RunState; onFight: () => void; onDone: () => void }) {
  const gh = run.godHand!;
  const [, force] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const setNote = (t: string) => { gh.text = t; };
  const note = gh.text;
  const bossName = FORMS[gh.boss].name;
  const picked = run.party.filter((m) => sel.includes(m.uid));
  const ok = godHandMatch(gh.need, picked);
  const canEver = (() => {
    // 隊伍裡有沒有符合的組合
    const rs = run.party.map((m) => FORMS[m.form].rarity);
    const [a, b] = gh.need; const i = rs.indexOf(a); if (i < 0) return false;
    return rs.some((r, j) => j !== i && r === b);
  })();
  const setStage = (st: typeof gh.stage) => { gh.stage = st; saveRun(run); force((n) => n + 1); };

  /** 把霸主交給玩家：隊伍有空位就加入，滿了就送回棲息灣 */
  const giveBoss = (): string => {
    const mon = makeMon(gh.boss, gh.lv);
    markCaught(gh.boss); run.caught++;
    if (run.party.length < PARTY_MAX) { run.party.push(mon); return `${bossName}（Lv${mon.lv}）加入了隊伍！`; }
    const meta = loadMeta(); meta.bay.push(newBayMon(gh.boss)); saveMeta(meta);
    return `隊伍已經滿了，${bossName} 先被送回棲息灣。`;
  };
  const sacrifice = () => {
    const meta = loadMeta();
    for (const m of picked) { if (m.bayId) meta.bay = meta.bay.filter((b) => b.id !== m.bayId); }
    saveMeta(meta);
    run.party = run.party.filter((m) => !sel.includes(m.uid));
    sfx('bossdown');
    const got = giveBoss();
    setNote(`${picked.map((m) => formOf(m).name).join(' 和 ')} 被神之手輕輕地帶走了。神之手一把抓住了 ${bossName}，放到你的船上。${got}`);
    setStage('took');
  };

  const scene = (c: CanvasRenderingContext2D, t: number) => {
    drawSea(c, t, 'abyss');
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(-200, 0, 700, 144);
    const X = 198, f = FORMS[gh.boss], took = gh.stage === 'took' || gh.stage === 'won';
    const intro = Math.min(1, t / 1.6);
    // 霸主在海面上；被抓走時往上升
    const lift = took ? Math.min(1, t / 2) * 26 : 0;
    drawSprite(c, f.sprite, PAL[f.pal], X - 32, 72 - lift + Math.sin(t * 2) * 1, { f: animFrame(f.sprite, t) });
    const hy = -100 + intro * ((took ? -8 - lift : -2) + 100);
    drawGodHand(c, t, X, hy, 0.85, took ? 1 : 0);
  };
  let body;
  if (gh.stage === 'offer') body = (
    <>
      <p class="small">天空裂開了一道縫，一隻白色的巨手伸了下來，停在 {bossName} 的上方。</p>
      <p class="gh-say">「……好無聊。給我兩個小傢伙陪我，我就把這隻大的抓給你。」</p>
      <div class="gh-need"><span>需要犧牲：</span>{gh.need.map((r, i) => <span key={i} class="rar-chip" style={{ '--rar': RARITY[r].color }}>{RARITY[r].name}（{r}）</span>)}<span class="small warn-text">被帶走的會<b>永遠離開</b>（棲息灣裡的也是）</span></div>
      <div class="gh-party">
        {[...run.party].sort((a, b) => RAR_ORDER.indexOf(FORMS[a.form].rarity) - RAR_ORDER.indexOf(FORMS[b.form].rarity)).map((m) => {
          const on = sel.includes(m.uid), r = FORMS[m.form].rarity;
          return (
            <button key={m.uid} class={`gh-mon ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setSel(on ? sel.filter((u) => u !== m.uid) : sel.length >= 2 ? [sel[1], m.uid] : [...sel, m.uid])}>
              <Sprite form={m.form} size={32} mutant={m.mutant} still />
              <span class="small">{formOf(m).name}</span>
              <span class="rar-chip small" style={{ '--rar': RARITY[r].color }}>{r}</span>
            </button>
          );
        })}
      </div>
      {!canEver && <p class="small dim">你的隊伍裡沒有符合的組合。</p>}
      <div class="cmd-grid gh-btns">
        <MenuItem onClick={sacrifice} disabled={!ok} hot={ok}>{ok ? `犧牲，換得${bossName}` : '選兩隻符合的'}</MenuItem>
        <MenuItem onClick={() => { sfx('back'); setStage('ask'); }} hot={!canEver}>拒絕</MenuItem>
      </div>
    </>
  );
  else if (gh.stage === 'ask') body = (
    <>
      <p>神之手的手指動了動，好像有點失落。</p>
      <p class="gh-say">「……那，陪我玩一下好不好？只要 20 回合就好。」</p>
      <p class="small dim">神之手的 HP 是你夥伴的 1000 倍，打不倒的。只要撐過 20 回合，就能得到 {bossName}、稱號「神之手認可者」和 ◆ 2000 珍珠。全隊倒下也不會結束冒險。</p>
      <MenuItem onClick={() => { sfx('confirm'); setStage('fight'); onFight(); }} hot><Icon name="attack" /> 陪它玩（戰鬥）</MenuItem>
      <MenuItem onClick={() => { setNote('你搖了搖頭。神之手停了一下，慢慢縮回了雲裡。'); setStage('left'); }}>離開</MenuItem>
    </>
  );
  else body = (
    <>
      <p class="accent">{note}</p>
      <div class="party-strip">{run.party.map((m: Mon) => <div class={`slot ${m.hp <= 0 ? 'ko' : ''}`} key={m.uid}><Sprite form={m.form} size={48} mutant={m.mutant} /><Bar value={Math.max(0, m.hp)} max={maxHp(m)} /><span class="slot-lv">Lv{m.lv}</span></div>)}</div>
      <MenuItem onClick={() => { run.godHand = undefined; saveRun(run); onDone(); }} hot>繼續</MenuItem>
    </>
  );
  const intro = !gh.introSeen;
  return (
    <>
      <GameScreen vp={vp} scene={<SceneCanvas draw={scene} label="從天上伸下來的白色巨手" />}
        panel={!intro && <Win class="big-panel godhand-panel" title="？？？　神之手">{body}</Win>} />
      {intro && <GodHandIntro onDone={() => { gh.introSeen = true; saveRun(run); force((n) => n + 1); }} />}
    </>
  );
}

/** 戰鬥結束後處理結果（撐過 → 霸主＋稱號＋2000 珍珠；倒下 → 什麼都沒有，但冒險繼續） */
export function settleGodHand(run: RunState, won: boolean): string {
  const gh = run.godHand!;
  if (won) {
    const name = FORMS[gh.boss].name;
    const mon = makeMon(gh.boss, gh.lv); markCaught(gh.boss); run.caught++;
    let got: string;
    if (run.party.length < PARTY_MAX) { run.party.push(mon); got = `${name}（Lv${mon.lv}）加入了隊伍！`; }
    else { const meta = loadMeta(); meta.bay.push(newBayMon(gh.boss)); saveMeta(meta); got = `隊伍已經滿了，${name} 先被送回棲息灣。`; }
    const meta = loadMeta(); meta.godHand = true; saveMeta(meta);
    claimAchievement(meta, 'godhand');
    const m2 = loadMeta(); m2.title = 'godhand'; saveMeta(m2);
    gh.stage = 'won';
    return gh.text = `「謝謝你陪我。」神之手把 ${name} 輕輕放到你的船上。${got} 獲得稱號「神之手認可者」和 ◆ 2000 珍珠！`;
  }
  for (const m of run.party) if (m.hp <= 0) m.hp = 1;
  gh.stage = 'lost';
  return gh.text = '神之手玩夠了，把你們輕輕放回船上，慢慢縮回了雲裡。';
}
