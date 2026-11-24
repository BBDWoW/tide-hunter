// 特殊區域：進入時的過場動畫、打倒守護者的勝利動畫，以及守護者的獎勵三選一
import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '../audio/engine';
import { DOMAINS, type DomainId } from '../data/domains';
import { GUARDIAN } from '../game/guardian';
import { EGG_DROP, EGG_INFO } from '../game/eggs';
import { leaveSpecial, saveRun, ZONES, type RunState } from '../game/run';
import { fx } from '../render/fx';
import { drawSea } from '../render/scene';
import { Icon } from './Icon';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';
import { MenuItem } from './Screens';

const W = 192, H = 108;
type Ctx = CanvasRenderingContext2D;
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));
// 固定的偽亂數（每一格動畫都一樣，畫面不會亂跳）
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function sky(c: Ctx, top: string, bot: string) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
function px(c: Ctx, x: number, y: number, s: number, col: string) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), s, s); }

// ── 聖林域 ──
function forestEnter(c: Ctx, p: number, t: number) {
  const g = seg(p, 0.45, 0.8);
  sky(c, mix('#0b1a3a', '#0d2a17', g), mix('#13305a', '#1c4a22', g));
  // 海面
  c.fillStyle = mix('#0f2d55', '#173d1c', g); c.fillRect(0, 70, W, 38);
  for (let i = 0; i < 24; i++) px(c, (rnd(i) * W + t * 6) % W, 74 + rnd(i + 9) * 30, 2, 'rgba(160,210,255,0.25)');
  // 綠色的光縫
  const a = ease(seg(p, 0, 0.3)), wide = ease(seg(p, 0.3, 0.6));
  const sw = 2 + wide * W * 0.9, sh = a * 80;
  c.fillStyle = `rgba(150,255,140,${0.35 + 0.4 * (1 - wide)})`; c.fillRect(W / 2 - sw / 2, 60 - sh / 2, sw, sh);
  c.fillStyle = 'rgba(230,255,210,0.9)'; c.fillRect(W / 2 - 1, 60 - sh / 2, 2, sh);
  // 從兩側長出的藤蔓
  const grow = ease(seg(p, 0.2, 0.75));
  for (let side = 0; side < 2; side++) for (let k = 0; k < 3; k++) {
    const x0 = side ? W - 6 - k * 14 : 6 + k * 14, len = grow * (60 + k * 12);
    for (let s = 0; s < len; s += 1.5) {
      const y = H - s, x = x0 + Math.sin(s / 9 + k + side * 2) * 6 * (side ? -1 : 1);
      px(c, x, y, 2, '#2f8f3a');
      if (Math.floor(s) % 11 === 0) px(c, x + (side ? -3 : 2), y, 3, '#6fdc6a');
    }
  }
  // 巨樹剪影
  const tr = ease(seg(p, 0.55, 0.95));
  if (tr > 0) {
    c.fillStyle = `rgba(8,30,12,${tr})`;
    c.fillRect(W / 2 - 8, 108 - tr * 70, 16, tr * 70);
    for (let i = 0; i < 9; i++) { const r = 10 + rnd(i) * 12; c.beginPath(); c.arc(W / 2 + (rnd(i + 3) - 0.5) * 70, 108 - tr * 76 + rnd(i + 7) * 20, r * tr, 0, 7); c.fill(); }
  }
  // 落葉
  for (let i = 0; i < 26; i++) {
    const tt = (t * (0.25 + rnd(i) * 0.2) + rnd(i + 40)) % 1;
    if (p < 0.25) continue;
    px(c, (rnd(i + 2) * W + Math.sin(t * 2 + i) * 8) % W, tt * H, 2, i % 3 ? '#8fe07a' : '#d8f59a');
  }
}
function forestWin(c: Ctx, p: number, t: number) {
  const b = ease(seg(p, 0, 0.5));
  sky(c, mix('#0d2a17', '#ffe6a8', b * 0.7), mix('#1c4a22', '#8ad07a', b));
  // 旋轉的光芒
  c.save(); c.translate(W / 2, 52); c.rotate(t * 0.25);
  for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); c.fillStyle = `rgba(255,248,200,${0.12 * b})`; c.beginPath(); c.moveTo(0, 0); c.lineTo(-8, -140); c.lineTo(8, -140); c.fill(); }
  c.restore();
  c.fillStyle = `rgba(255,255,230,${0.9 * (1 - seg(p, 0.1, 0.4))})`; c.beginPath(); c.arc(W / 2, 52, 6 + 60 * ease(seg(p, 0, 0.35)), 0, 7); c.fill();
  // 花一朵朵開
  for (let i = 0; i < 16; i++) {
    const bl = ease(seg(p, 0.3 + rnd(i) * 0.4, 0.55 + rnd(i) * 0.4)), x = 6 + i * 12 + rnd(i + 5) * 6, y = 96 + rnd(i + 8) * 8;
    c.fillStyle = '#2f8f3a'; c.fillRect(x, y, 1, 12);
    if (bl <= 0) continue;
    const col = ['#ffb6d9', '#ffffff', '#ffe07a', '#c8a6ff'][i % 4];
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; px(c, x + Math.cos(a) * 3 * bl - 1, y + Math.sin(a) * 3 * bl - 1, 2, col); }
    px(c, x - 1, y - 1, 2, '#fff3a0');
  }
  // 花瓣飛散
  for (let i = 0; i < 40; i++) {
    const s = seg(p, 0.08, 1), a = rnd(i) * Math.PI * 2, d = s * (40 + rnd(i + 1) * 90);
    px(c, W / 2 + Math.cos(a) * d, 52 + Math.sin(a) * d * 0.7 + s * s * 30, 2, i % 2 ? '#ffc4e0' : '#ffffff');
  }
}

// ── 無稽區 ──
function voidEnter(c: Ctx, p: number, t: number) {
  const inv = p > 0.12 && p < 0.2 && Math.floor(t * 20) % 2 === 0;
  sky(c, inv ? '#f0e8ff' : '#0b1430', inv ? '#d8c8ff' : '#1a2a50');
  const open = ease(seg(p, 0.45, 0.75));
  // 裂開後露出星空
  if (open > 0) {
    c.save(); c.beginPath(); c.arc(W / 2, H / 2, open * 140, 0, 7); c.clip();
    sky(c, '#05010f', '#1a0630');
    for (let i = 0; i < 70; i++) px(c, rnd(i) * W, rnd(i + 99) * H, rnd(i + 5) < 0.2 ? 2 : 1, rnd(i + 3) < 0.5 ? '#ffffff' : '#c7a0ff');
    c.restore();
  }
  // 裂痕
  const cr = ease(seg(p, 0.15, 0.5));
  c.strokeStyle = '#ffffff'; c.lineWidth = 1;
  for (let k = 0; k < 9; k++) {
    let x = W / 2, y = H / 2; const ang = (k / 9) * Math.PI * 2 + rnd(k);
    c.beginPath(); c.moveTo(x, y);
    const n = Math.floor(cr * 9);
    for (let s = 0; s < n; s++) { x += Math.cos(ang + (rnd(k * 10 + s) - 0.5) * 1.4) * 9; y += Math.sin(ang + (rnd(k * 10 + s) - 0.5) * 1.4) * 9; c.lineTo(x, y); }
    c.globalAlpha = 1 - open; c.stroke(); c.globalAlpha = 1;
  }
  // 碎片往外飛
  if (open > 0) for (let i = 0; i < 18; i++) {
    const a = rnd(i) * Math.PI * 2, d = open * (60 + rnd(i + 2) * 80), x = W / 2 + Math.cos(a) * d, y = H / 2 + Math.sin(a) * d;
    c.fillStyle = `rgba(40,60,110,${1 - open})`; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 8, y + 3); c.lineTo(x + 2, y + 9); c.fill();
  }
  // 漂浮的符文與巨大的眼睛
  const ey = ease(seg(p, 0.65, 0.95)), EY = 36;
  if (ey > 0) {
    for (let i = 0; i < 8; i++) {
      const a = t * 0.6 + (i / 8) * Math.PI * 2, x = W / 2 + Math.cos(a) * 62, y = EY + Math.sin(a) * 30;
      c.globalAlpha = ey; rune(c, x, y, i); c.globalAlpha = 1;
    }
    c.fillStyle = '#e8d6ff'; c.beginPath(); c.ellipse(W / 2, EY, 26, 12 * ey, 0, 0, 7); c.fill();
    c.fillStyle = '#7a3cff'; c.beginPath(); c.arc(W / 2 + Math.sin(t * 1.3) * 5, EY, 7 * ey, 0, 7); c.fill();
    c.fillStyle = '#0a0018'; c.fillRect(W / 2 - 1 + Math.sin(t * 1.3) * 5, EY - 5 * ey, 2, 10 * ey);
  }
}
function rune(c: Ctx, x: number, y: number, i: number) {
  c.fillStyle = '#c7a0ff';
  for (let k = 0; k < 9; k++) if (rnd(i * 17 + k) < 0.55) c.fillRect(Math.round(x - 3 + (k % 3) * 2), Math.round(y - 3 + Math.floor(k / 3) * 2), 2, 2);
}
function voidWin(c: Ctx, p: number, t: number) {
  const dawn = ease(seg(p, 0.55, 1));
  sky(c, mix('#05010f', '#7fb6ff', dawn), mix('#1a0630', '#ffd9a8', dawn));
  const pull = ease(seg(p, 0, 0.42));
  // 星星被吸向中心
  if (p < 0.45) for (let i = 0; i < 80; i++) {
    const x0 = rnd(i) * W, y0 = rnd(i + 99) * H;
    px(c, x0 + (W / 2 - x0) * pull, y0 + (H / 2 - y0) * pull, 1, rnd(i + 3) < 0.5 ? '#ffffff' : '#c7a0ff');
  }
  // 爆開的光環
  const boom = seg(p, 0.42, 0.85);
  if (boom > 0) {
    c.strokeStyle = `rgba(255,240,255,${1 - boom})`; c.lineWidth = 4 * (1 - boom) + 1;
    c.beginPath(); c.arc(W / 2, H / 2, boom * 150, 0, 7); c.stroke();
    c.strokeStyle = `rgba(190,140,255,${1 - boom})`; c.beginPath(); c.arc(W / 2, H / 2, boom * 110, 0, 7); c.stroke();
    c.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - boom * 3)})`; c.fillRect(0, 0, W, H);
  }
  // 星塵慢慢落下
  if (p > 0.5) for (let i = 0; i < 30; i++) px(c, rnd(i + 7) * W, ((rnd(i) + t * 0.08) % 1) * H, 1, `rgba(255,240,255,${1 - dawn * 0.6})`);
}

// ── 域核區域 ──
function coreEnter(c: Ctx, p: number, t: number) {
  sky(c, '#081428', '#0c2244');
  // 掃描線往下掃，畫面碎成像素方塊
  const scan = seg(p, 0, 0.35), sy = scan * H;
  for (let y = 0; y < sy; y += 6) for (let x = 0; x < W; x += 6) if (rnd(x * 7 + y) < 0.5 * scan) { c.fillStyle = rnd(x + y * 3) < 0.5 ? '#123a6a' : '#0d5a7a'; c.fillRect(x, y, 6, 6); }
  c.fillStyle = 'rgba(120,240,255,0.8)'; if (scan < 1) c.fillRect(0, sy, W, 1);
  // 透視網格地板
  const gr = ease(seg(p, 0.25, 0.6));
  if (gr > 0) {
    c.strokeStyle = `rgba(78,230,255,${0.6 * gr})`; c.lineWidth = 1;
    for (let i = -10; i <= 10; i++) { c.beginPath(); c.moveTo(W / 2, 54); c.lineTo(W / 2 + i * 24, H); c.stroke(); }
    for (let k = 0; k < 8; k++) { const z = ((k + t * 2) % 8) / 8, y = 54 + z * z * 54; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  }
  // 方塊從四周飛進來
  const asm = ease(seg(p, 0.4, 0.8));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + t * 0.4, r = 30 + (1 - asm) * 120;
    const x = W / 2 + Math.cos(a) * r, y = 42 + Math.sin(a) * r * 0.45;
    c.fillStyle = i % 2 ? '#4ee6ff' : '#2a8fd8'; c.fillRect(Math.round(x - 3), Math.round(y - 3), 6, 6);
    c.fillStyle = '#c8fbff'; c.fillRect(Math.round(x - 3), Math.round(y - 3), 6, 1);
  }
  // 核心與光環
  const core = ease(seg(p, 0.6, 0.95));
  if (core > 0) {
    c.fillStyle = `rgba(150,250,255,${core})`; c.beginPath(); c.arc(W / 2, 42, 8 * core, 0, 7); c.fill();
    c.strokeStyle = `rgba(78,230,255,${core})`; c.lineWidth = 1;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(W / 2, 42, 18 + k * 7, 6 + k * 2, t * (0.8 + k * 0.4) * (k % 2 ? -1 : 1), 0, 7); c.stroke(); }
  }
}
function coreWin(c: Ctx, p: number, t: number) {
  const ok = ease(seg(p, 0.5, 0.9));
  sky(c, mix('#081428', '#0a2a24', ok), mix('#0c2244', '#0e3a30', ok));
  // 資料流往上衝
  for (let i = 0; i < 32; i++) {
    const x = (i / 32) * W + 3, sp = 0.4 + rnd(i) * 0.6;
    for (let k = 0; k < 6; k++) { const y = H - (((t * sp * 60 + k * 18 + rnd(i + 3) * H) % (H + 20))); px(c, x, y, 2, ok > 0.5 ? `rgba(120,255,170,${0.8 - k * 0.1})` : `rgba(78,230,255,${0.8 - k * 0.1})`); }
  }
  // 光環慢慢停下來
  const spin = Math.max(0, 1 - seg(p, 0, 0.5));
  c.strokeStyle = ok > 0.5 ? '#9affc0' : '#4ee6ff'; c.lineWidth = 1;
  for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(W / 2, 50, 20 + k * 8, 7 + k * 2, (t * 2 * spin + k), 0, 7); c.stroke(); }
  c.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - seg(p, 0.45, 0.6) * 1.2) * (p > 0.45 ? 1 : 0)})`; c.fillRect(0, 0, W, H);
  // 打勾
  if (ok > 0) {
    c.strokeStyle = '#d8ffe6'; c.lineWidth = 3; c.lineCap = 'square';
    c.beginPath(); c.moveTo(W / 2 - 10, 50); c.lineTo(W / 2 - 3, 57 * Math.min(1, ok * 2) + 50 * (1 - Math.min(1, ok * 2))); if (ok > 0.5) c.lineTo(W / 2 - 3 + (ok - 0.5) * 2 * 14, 57 - (ok - 0.5) * 2 * 16); c.stroke();
  }
}

function mix(a: string, b: string, k: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.min(1, Math.max(0, k)))).join(',')})`;
}

const SCENES: Record<DomainId, { enter: typeof forestEnter; win: typeof forestEnter }> = {
  forest: { enter: forestEnter, win: forestWin },
  void: { enter: voidEnter, win: voidWin },
  core: { enter: coreEnter, win: coreWin },
};
const ENTER_LINE: Record<DomainId, string> = {
  forest: '海面裂開一道綠光，樹根從水裡竄了出來……',
  void: '世界碎成一片片，倒過來的星空張開了眼睛……',
  core: '畫面化成一格格資料，被吸進了發光的核心……',
};

/** 全螢幕的過場動畫：mode = enter（進入區域）或 win（打倒守護者） */
export function ZoneCutscene({ zone, mode, onDone }: { zone: DomainId; mode: 'enter' | 'win'; onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [card, setCard] = useState(false);
  const done = useRef(false);
  const finish = () => { if (done.current) return; done.current = true; onDone(); };
  useEffect(() => {
    const c = ref.current!.getContext('2d')!; c.imageSmoothingEnabled = false;
    const dur = fx.reduce ? 1.4 : mode === 'enter' ? 3.6 : 3.4;
    const t0 = performance.now(); let raf = 0;
    sfx(mode === 'enter' ? 'reveal' : 'bossdown');
    const cardAt = setTimeout(() => { setCard(true); sfx(mode === 'enter' ? 'enter' : 'fanfare'); }, dur * 550);
    const loop = (now: number) => {
      const t = (now - t0) / 1000, p = Math.min(1, t / dur);
      SCENES[zone][mode](c, p, t);
      if (t < dur + 1.6) raf = requestAnimationFrame(loop); else finish();
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); clearTimeout(cardAt); };
  }, []);
  const z = ZONES[zone], d = DOMAINS[zone], g = GUARDIAN[zone];
  return (
    <div class={`zone-cut zc-${zone} ${mode}`} onClick={finish} role="dialog" aria-label={mode === 'enter' ? `進入${z.name}` : g.title}>
      <canvas ref={ref} width={W} height={H} />
      {card && (
        <div class="zc-card">
          {mode === 'enter' ? <>
            <span class="zc-eyebrow">特殊區域</span>
            <b class="zc-name">{z.name}</b>
            <span class="zc-line">{ENTER_LINE[zone]}</span>
            <span class="zc-domain" style={{ color: d.color }}><Icon name="sparkle" /> 領域效果「{d.name}」：{d.desc}</span>
          </> : <>
            <span class="zc-eyebrow">守護者被打倒了</span>
            <b class="zc-name">{g.title}</b>
            <span class="zc-line">{g.line}</span>
          </>}
        </div>
      )}
      <span class="zc-skip">點一下{card ? '繼續' : '跳過'}</span>
    </div>
  );
}

/** 打倒守護者：先播勝利動畫，再三選一獎勵，最後回到原本的航線 */
export function GuardianReward({ vp, run, onDone }: { vp: Viewport; run: RunState; onDone: () => void }) {
  const [zone] = useState(() => run.guardianWin as DomainId); // 選完獎勵後 run 會清掉，所以先記住
  const g = GUARDIAN[zone];
  const [anim, setAnim] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const pick = (i: number) => {
    const rw = g.rewards[i];
    run.shells += g.bonus;
    let text = rw.apply(run);
    if (Math.random() < EGG_DROP.guardian) { (run.eggs ??= []).push(zone); text += `守護者還留下了一顆「${EGG_INFO[zone].name}」！`; }
    run.guardianWin = undefined;
    leaveSpecial(run);
    saveRun(run);
    sfx('levelup');
    setResult(`${rw.name}：${text}`);
  };
  return (
    <>
      <GameScreen vp={vp} scene={<SceneCanvas draw={(c, t) => drawSea(c, t, ZONES[zone].theme)} label={ZONES[zone].name} />}
        panel={!anim && (
          <Win class="big-panel guardian-panel" title={`${g.title}　守護者的謝禮`}>
            {result ? <>
              <p class="accent">{result}</p>
              <p class="small dim">另外拿到了 {g.bonus} 枚貝殼幣。帶著謝禮回到原本的航線吧。</p>
              <MenuItem onClick={onDone} hot>回到航線</MenuItem>
            </> : <>
              <p class="small dim">{g.line}選一樣帶走（另外固定給 {g.bonus} 枚貝殼幣）：</p>
              <div class="gr-row">
                {g.rewards.map((rw, i) => {
                  const ok = rw.can ? rw.can(run) : true;
                  return (
                    <button key={rw.id} class={`gr-card zc-${zone}`} disabled={!ok} onClick={() => pick(i)}>
                      <span class="gr-icon"><Icon name={rw.icon} size="2.2em" /></span>
                      <b>{rw.name}</b>
                      <span class="small">{ok ? rw.desc : '已經拿到最多層了'}</span>
                    </button>
                  );
                })}
              </div>
            </>}
          </Win>
        )} />
      {anim && <ZoneCutscene zone={zone} mode="win" onDone={() => setAnim(false)} />}
    </>
  );
}
