// 場景繪製（256×144 像素）：海景全景、戰鬥地形、釣魚、標題、海圖、海底
import { FORMS } from '../data/creatures';
import { ELEM, type Elem } from '../data/types';
import { drawSprite, PAL, spriteSize } from './pixel';

export const W = 256, H = 144;

// ── 小工具 ──
type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;
const css = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
// 多段漸層＋有序抖動，色階數 steps
function ditherGrad(stops: string[], t: number, x: number, y: number, steps = 10): RGB {
  const c = stops.map(hex), seg = Math.min(c.length - 2, Math.floor(t * (c.length - 1))), lt = t * (c.length - 1) - seg;
  const v = lt * steps, b = Math.floor(v), fr = v - b;
  const q = Math.min(steps, b + (fr > (BAYER[y % 4][x % 4] + 0.5) / 16 ? 1 : 0)) / steps;
  return mix(c[seg], c[seg + 1], q);
}
function offscreen(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export function pxCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, maxY = 9999) {
  ctx.fillStyle = col;
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.8 && cy + y < maxY) ctx.fillRect(cx + x, cy + y, 1, 1);
}
export function pxLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string) {
  ctx.fillStyle = col; x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let i = 0; i < 2000; i++) { ctx.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
function pxEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, col: (x: number, y: number, nx: number, ny: number) => string | null) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    if (nx * nx + ny * ny > 1) continue;
    const c = col(x, y, nx, ny);
    if (c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
  }
}

// ── 海景主題 ──
export type ThemeId = 'day' | 'sunset';
interface Theme { sky: string[]; sea: string[]; far: string; near: string; sun: string; glow: string; cloud: [string, string]; foam: string; glint: string; horizon: number; sunX: number; sunY: number; sunR: number }
const THEMES: Record<ThemeId, Theme> = {
  day: { sky: ['#2f7fd8', '#5fb0f0', '#c8f0ff'], sea: ['#7fd8f0', '#2fa4d6', '#0d5f9e', '#073a6e'], far: '#8cc4dc', near: '#5f9fc0', sun: '#fffbe0', glow: '#fff1a8', cloud: ['#ffffff', '#cfe4fa'], foam: '#f2fdff', glint: '#ffffff', horizon: 46, sunX: 206, sunY: 14, sunR: 7 },
  sunset: { sky: ['#1d1d5c', '#6a2f7a', '#e0607a', '#ffb070'], sea: ['#f0a07a', '#a84e78', '#3a2a6a', '#141640'], far: '#8a4a7a', near: '#5a2f62', sun: '#fff0b0', glow: '#ffb070', cloud: ['#ffc4a8', '#c8708a'], foam: '#ffe0c8', glint: '#fff6c8', horizon: 74, sunX: 128, sunY: 70, sunR: 14 },
};

const cache = new Map<string, HTMLCanvasElement>();
function cached(key: string, w: number, h: number, paint: (x: CanvasRenderingContext2D) => void) {
  let c = cache.get(key);
  if (!c) { c = offscreen(w, h); paint(c.getContext('2d')!); cache.set(key, c); }
  return c;
}

function islands(x: CanvasRenderingContext2D, hz: number, col: string, seed: number, amp: number, from: number, to: number) {
  const r = seeded(seed);
  const p1 = r() * 6, p2 = r() * 6;
  x.fillStyle = col;
  for (let i = from; i < to; i++) {
    const env = Math.sin(((i - from) / (to - from)) * Math.PI);
    const h = Math.max(0, Math.round(env * amp * (0.7 + 0.3 * Math.sin(i * 0.09 + p1)) + Math.sin(i * 0.37 + p2) * 1.2));
    if (h > 0) x.fillRect(i, hz - h, 1, h);
  }
}

function backdrop(id: ThemeId) {
  const th = THEMES[id];
  return cached('bg-' + id, W, H, (x) => {
    const img = x.createImageData(W, H), hz = th.horizon;
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const c = y < hz ? ditherGrad(th.sky, y / hz, xx, y, 12) : ditherGrad(th.sea, Math.pow((y - hz) / (H - hz), 0.8), xx, y, 12);
      const i = (y * W + xx) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // 太陽光暈（抖動同心圓）
    const g = hex(th.glow);
    for (let r = th.sunR * 3; r > th.sunR; r -= 1) {
      const a = 0.25 * (1 - (r - th.sunR) / (th.sunR * 2));
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
        const d = xx * xx + yy * yy;
        if (d > r * r || d < (r - 1) * (r - 1)) continue;
        const py = th.sunY + yy, px = th.sunX + xx;
        if (py >= hz || BAYER[py & 3][px & 3] / 16 > a * 2.2) continue;
        x.fillStyle = css(g); x.fillRect(px, py, 1, 1);
      }
    }
    pxCircle(x, th.sunX, th.sunY, th.sunR, th.glow, hz);
    pxCircle(x, th.sunX, th.sunY, th.sunR - 2, th.sun, hz);
    islands(x, hz, th.far, 3, 7, 0, 90);
    islands(x, hz, th.far, 9, 5, 150, 256);
    islands(x, hz, th.near, 4, 11, 168, 246);
    islands(x, hz, th.near, 7, 6, 18, 70);
    // 地平線亮線
    x.fillStyle = th.foam; x.globalAlpha = 0.6; x.fillRect(0, hz, W, 1); x.globalAlpha = 1;
  });
}

function cloudSprite(id: ThemeId, k: number) {
  const th = THEMES[id];
  return cached(`cloud-${id}-${k}`, 64, 24, (x) => {
    const r = seeded(100 + k), w = 30 + Math.floor(r() * 26);
    const puffs: [number, number, number][] = [];
    for (let i = 0; i < 6; i++) puffs.push([6 + r() * (w - 12), 14 - r() * 6, 4 + r() * 6]);
    const inside = (px: number, py: number) => py < 20 && puffs.some(([cx, cy, rr]) => (px - cx) ** 2 + (py - cy) ** 2 <= rr * rr);
    for (let y = 0; y < 24; y++) for (let xx = 0; xx < 64; xx++) {
      if (!inside(xx, y)) continue;
      x.fillStyle = !inside(xx, y + 2) || (!inside(xx, y + 3) && (xx + y) % 2) ? th.cloud[1] : th.cloud[0];
      x.fillRect(xx, y, 1, 1);
    }
  });
}

// 全景海面：背景、雲、波浪、太陽倒影
export function drawSea(ctx: CanvasRenderingContext2D, t: number, id: ThemeId = 'day') {
  const th = THEMES[id], hz = th.horizon;
  ctx.drawImage(backdrop(id), 0, 0);
  for (let k = 0; k < 5; k++) {
    const sp = 2 + k * 0.7, cx = ((k * 71 + t * sp) % (W + 70)) - 64, cy = 4 + ((k * 13) % (hz - 26));
    ctx.drawImage(cloudSprite(id, k), Math.round(cx), cy);
  }
  // 波浪：越近越粗、越快
  const foam = hex(th.foam);
  const rows = 16;
  for (let k = 0; k < rows; k++) {
    const p = k / rows, y = Math.round(hz + 2 + Math.pow(p, 1.6) * (H - hz - 2));
    const len = 2 + Math.round(p * 7), gap = 14 + Math.round(p * 18), speed = 4 + p * 14;
    ctx.fillStyle = css(foam, 0.18 + p * 0.45);
    const off = (t * speed + k * 37) % gap;
    for (let x = -gap + off; x < W; x += gap) {
      const wob = Math.round(Math.sin(x * 0.07 + t * 1.5 + k) * 1);
      ctx.fillRect(Math.round(x), y + wob, len, 1);
      if (p > 0.55) ctx.fillRect(Math.round(x) + 1, y + wob - 1, Math.max(1, len - 3), 1);
    }
  }
  // 太陽倒影閃光
  ctx.fillStyle = th.glint;
  for (let i = 0; i < 18; i++) {
    const y = hz + 2 + i * 2.6, spread = 3 + i * 1.2;
    if (Math.sin(t * 4 + i * 2.1) < -0.1) continue;
    const x = th.sunX + Math.sin(t * 1.3 + i * 1.7) * spread;
    ctx.globalAlpha = 0.85 - i * 0.035;
    ctx.fillRect(Math.round(x - 1 - i * 0.15), Math.round(y), 2 + Math.round(i * 0.25), 1);
  }
  ctx.globalAlpha = 1;
  // 遠方海鳥
  const bx = ((t * 9) % (W + 40)) - 20, by = 18 + Math.sin(t * 0.7) * 3;
  ctx.fillStyle = id === 'sunset' ? '#2a1a40' : '#33506e';
  for (const [dx, dy] of [[0, 0], [9, 4], [-7, 5]]) {
    const wing = Math.floor(t * 4 + dx) % 2;
    ctx.fillRect(Math.round(bx + dx - 2), Math.round(by + dy - wing), 2, 1); ctx.fillRect(Math.round(bx + dx + 1), Math.round(by + dy - wing), 2, 1); ctx.fillRect(Math.round(bx + dx), Math.round(by + dy), 1, 1);
  }
}

// ── 戰鬥地形 ──
export const BATTLE = { player: { x: 66, y: 100 }, enemy: { x: 190, y: 66 } };

function shoal() {
  return cached('shoal', 120, 30, (x) => {
    pxEllipse(x, 60, 15, 58, 13, (px, py, nx, ny) => {
      const d = nx * nx + ny * ny;
      if (d > 0.82) return (px + py) % 2 ? '#8fd8e8' : '#bfeff6';
      if (ny < -0.45) return BAYER[py & 3][px & 3] > 9 ? '#fff4d0' : '#f6e2a8';
      if (d > 0.6 && ny > 0) return BAYER[py & 3][px & 3] > 6 ? '#b8915a' : '#c9a468';
      return BAYER[py & 3][px & 3] > 12 ? '#e0c080' : '#ecd394';
    });
    const r = seeded(21);
    for (let i = 0; i < 9; i++) { const sx = 18 + r() * 84, sy = 8 + r() * 10; x.fillStyle = i % 3 ? '#fffaf0' : '#ff9a8a'; x.fillRect(Math.round(sx), Math.round(sy), 1, 1); }
    for (const gx of [16, 22, 96, 101]) { x.fillStyle = '#5fae5a'; x.fillRect(gx, 6, 1, 4); x.fillRect(gx + 1, 4, 1, 6); x.fillRect(gx + 2, 7, 1, 3); }
  });
}
function reef() {
  return cached('reef', 80, 26, (x) => {
    pxEllipse(x, 40, 14, 36, 10, (px, py, nx, ny) => {
      const d = nx * nx + ny * ny, b = BAYER[py & 3][px & 3];
      if (d > 0.8) return (px + py) % 2 ? '#a8e8f4' : '#e0faff';
      if (ny < -0.15) return d > 0.55 ? (b > 8 ? '#7ab86a' : '#5fa25a') : b > 10 ? '#a6d48a' : '#8cc474';
      if (ny > 0.4) return b > 7 ? '#5a6878' : '#6a7888';
      return b > 11 ? '#a8b0b8' : '#8c96a2';
    });
    const r = seeded(33);
    for (let i = 0; i < 7; i++) { const cx = 12 + r() * 56; x.fillStyle = ['#ff6b8a', '#ffb05a', '#c87ae0', '#fffbe8'][i % 4]; x.fillRect(Math.round(cx), 8 + Math.round(r() * 4), 2, 1); x.fillRect(Math.round(cx), 7, 1, 1); }
  });
}
function foamRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, t: number, col: string) {
  ctx.fillStyle = col;
  const r = rx + Math.sin(t * 2) * 1.5;
  for (let a = 0; a < 70; a++) {
    if ((a + Math.floor(t * 8)) % 4 === 0) continue;
    const an = (a / 70) * Math.PI * 2;
    if (Math.sin(an) < -0.2) continue;
    ctx.fillRect(Math.round(cx + Math.cos(an) * r), Math.round(cy + Math.sin(an) * (ry + Math.sin(t * 2) * 0.6)), 1, 1);
  }
}

export interface MonView { form: string; x: number; y: number; flip: boolean; flash: number; shake: number; lunge: number; alpha: number; scale: number; tint?: string; aura?: string }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; g?: number }
export interface Beam { x0: number; y0: number; x1: number; y1: number; life: number; color: string }

export function monSlot(side: 0 | 1, form: string) {
  const f = FORMS[form], sc = f?.scale ?? 1, base = side === 0 ? BATTLE.player : BATTLE.enemy;
  const size = spriteSize(f?.sprite ?? '') * sc;
  return { x: base.x - size / 2, y: base.y - size + 3, scale: sc, cx: base.x, cy: base.y - size / 2 + 2 };
}

export function drawBattleBg(ctx: CanvasRenderingContext2D, t: number) {
  drawSea(ctx, t, 'day');
  const e = BATTLE.enemy, p = BATTLE.player;
  foamRing(ctx, e.x, e.y + 1, 38, 9, t, '#f2fdff');
  ctx.drawImage(reef(), e.x - 40, e.y - 13);
  foamRing(ctx, p.x, p.y + 2, 60, 13, t + 1, '#f2fdff');
  ctx.drawImage(shoal(), p.x - 60, p.y - 13);
}

function shadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number) {
  ctx.fillStyle = 'rgba(20,30,50,0.32)';
  for (let y = -2; y <= 2; y++) { const hw = Math.round(w * Math.sqrt(1 - (y * y) / 6.5)); ctx.fillRect(cx - hw, cy + y, hw * 2, 1); }
}

export function drawBattle(ctx: CanvasRenderingContext2D, t: number, dt: number, mons: (MonView | null)[], parts: Particle[], beams: Beam[]) {
  drawBattleBg(ctx, t);
  for (const [i, m] of mons.entries()) {
    if (!m || m.alpha <= 0) continue;
    const base = i === 0 ? BATTLE.player : BATTLE.enemy;
    const w = Math.round((spriteSize(FORMS[m.form].sprite) / 48) * 15 * m.scale);
    ctx.globalAlpha = m.alpha; shadow(ctx, base.x, base.y, w); ctx.globalAlpha = 1;
  }
  for (const [i, m] of mons.entries()) {
    if (!m || m.alpha <= 0) continue;
    const f = FORMS[m.form];
    const fr = Math.floor(t * 3 + i) % 2;
    const sx = m.x + m.lunge * (m.flip ? -1 : 1) + (m.shake ? Math.round(Math.sin(t * 60) * 2) : 0);
    const sy = m.y + Math.round(Math.sin(t * 2.4 + i) * 1.2);
    const white = m.flash > 0 && Math.floor(m.flash * 20) % 2 === 0;
    if (m.aura) {
      // 光環：脈動的發光外框＋上升的能量粒子
      const n = spriteSize(f.sprite) * m.scale, pulse = 0.6 + 0.3 * Math.sin(t * 4 + i);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1]]) {
        drawSprite(ctx, f.sprite, PAL[f.pal], Math.round(sx) + ox, Math.round(sy) + oy, { f: fr, flip: m.flip, alpha: m.alpha * pulse, scale: m.scale, tint: m.aura });
      }
      if (Math.random() < dt * 14) parts.push({ x: sx + n * (0.15 + Math.random() * 0.7), y: sy + n * (0.5 + Math.random() * 0.4), vx: (Math.random() - 0.5) * 6, vy: -18 - Math.random() * 16, life: 0.9, max: 0.9, color: Math.random() < 0.5 ? m.aura : '#ffffff', size: Math.random() < 0.3 ? 2 : 1 });
    }
    drawSprite(ctx, f.sprite, PAL[f.pal], Math.round(sx), Math.round(sy), { f: fr, flip: m.flip, alpha: m.alpha, scale: m.scale, tint: white ? '#ffffff' : m.tint });
  }
  for (const b of beams) {
    ctx.globalAlpha = Math.min(1, b.life * 4);
    for (let o = -1; o <= 1; o++) pxLine(ctx, b.x0, b.y0 + o, b.x1, b.y1 + o, o ? b.color : '#ffffff');
    b.life -= dt;
  }
  ctx.globalAlpha = 1;
  for (let i = beams.length - 1; i >= 0; i--) if (beams[i].life <= 0) beams.splice(i, 1);
  for (const p of parts) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ?? 0) * dt; p.life -= dt;
    ctx.globalAlpha = Math.max(0, Math.min(1, (p.life / p.max) * 1.5));
    ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
}

export function burst(parts: Particle[], x: number, y: number, kind: 'hit' | 'splash' | 'buff' | 'heal' | 'beam' | 'faint', elem: Elem | null) {
  const col = elem ? ELEM[elem].color : '#ffffff';
  const n = kind === 'faint' ? 34 : 18;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 24 + Math.random() * 56;
    if (kind === 'buff') parts.push({ x: x - 14 + Math.random() * 28, y: y + 12, vx: 0, vy: -26 - Math.random() * 20, life: 0.8, max: 0.8, color: i % 2 ? '#ffcf4a' : '#ffffff', size: 2 });
    else if (kind === 'heal') parts.push({ x: x - 14 + Math.random() * 28, y: y + 12, vx: 0, vy: -18 - Math.random() * 18, life: 0.9, max: 0.9, color: i % 2 ? '#7ee36a' : '#d6ffd0', size: i % 3 ? 1 : 2 });
    else if (kind === 'splash') parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, g: 140, life: 0.6, max: 0.6, color: i % 3 ? col : '#ffffff', size: 2 });
    else if (kind === 'faint') parts.push({ x: x - 16 + Math.random() * 32, y: y - 16 + Math.random() * 32, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 30, life: 1, max: 1, color: i % 2 ? '#5ff1e0' : '#ffffff', size: 1 + (i % 2) });
    else parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4, max: 0.4, color: i % 2 ? col : '#ffffff', size: i % 4 ? 1 : 2 });
  }
}

// ── 釣魚 ──
export type FishPhase = 'choose' | 'cast' | 'flying' | 'wait' | 'nibble' | 'bite' | 'hooked';
export interface ShadowView { x: number; size: 1 | 2 | 3 }
export interface FishView { phase: FishPhase; power: number; castT: number; bobX: number; shadows: ShadowView[]; sel: number; spot: string }
const BOAT = { x: 46, y: 92 };
function boat(ctx: CanvasRenderingContext2D, bob: number) {
  const x = BOAT.x, y = BOAT.y + bob;
  // 船身
  ctx.fillStyle = '#5a321c'; ctx.fillRect(x - 30, y, 64, 3); ctx.fillRect(x - 27, y + 3, 58, 3); ctx.fillRect(x - 22, y + 6, 48, 2);
  ctx.fillStyle = '#8a5530'; ctx.fillRect(x - 31, y - 3, 66, 3);
  ctx.fillStyle = '#c47a3e'; ctx.fillRect(x - 32, y - 4, 68, 1);
  ctx.fillStyle = '#e8e0c8'; ctx.fillRect(x - 24, y + 1, 50, 1);
  // 釣客
  const fx = x + 4;
  ctx.fillStyle = '#2a3a6a'; ctx.fillRect(fx, y - 9, 9, 6);
  ctx.fillStyle = '#ffcf4a'; ctx.fillRect(fx, y - 21, 9, 12); ctx.fillStyle = '#e0a82a'; ctx.fillRect(fx, y - 12, 9, 2);
  ctx.fillStyle = '#ffd9b8'; ctx.fillRect(fx + 1, y - 28, 7, 7);
  ctx.fillStyle = '#1a1a2a'; ctx.fillRect(fx + 6, y - 26, 1, 2);
  ctx.fillStyle = '#d23a5a'; ctx.fillRect(fx - 1, y - 30, 10, 3); ctx.fillRect(fx + 6, y - 28, 5, 1);
  ctx.fillStyle = '#ffd9b8'; ctx.fillRect(fx + 9, y - 18, 3, 3);
}
const SH_W = { 1: 12, 2: 20, 3: 32 } as const;
function fishShadow(ctx: CanvasRenderingContext2D, x: number, y: number, size: 1 | 2 | 3, t: number, alpha = 0.45) {
  const w = SH_W[size], h = Math.round(w * 0.35), dir = Math.sin(t * 0.7 + x) > 0 ? 1 : -1;
  ctx.fillStyle = `rgba(6,30,70,${alpha})`;
  ctx.fillRect(Math.round(x - w / 2), Math.round(y - h / 2) + 1, w, Math.max(2, h - 2));
  ctx.fillRect(Math.round(x - w / 2 + 2), Math.round(y - h / 2), w - 4, h);
  const tx = Math.round(x - (w / 2 + 4) * dir);
  ctx.fillRect(Math.min(tx, tx + 4 * dir), Math.round(y - h / 2), 4, h);
}
function spotDecor(ctx: CanvasRenderingContext2D, spot: string, t: number) {
  if (spot === 'deep') { ctx.fillStyle = 'rgba(4,16,48,0.28)'; ctx.fillRect(0, 47, W, H - 47); }
  if (spot === 'reef') {
    for (const [x, w] of [[150, 14], [232, 18]] as const) { ctx.fillStyle = '#6c5f50'; ctx.fillRect(x, 58, w, 4); ctx.fillStyle = '#8cc474'; ctx.fillRect(x + 2, 57, w - 4, 2); ctx.fillStyle = '#ff6b8a'; ctx.fillRect(x + 4, 55, 2, 2); ctx.fillStyle = '#ffb05a'; ctx.fillRect(x + w - 6, 55, 2, 2); }
  }
  if (spot === 'wreck') {
    const x = 236, sway = Math.round(Math.sin(t * 0.8));
    ctx.fillStyle = '#4a3020'; ctx.fillRect(x + sway, 30, 3, 32); ctx.fillRect(x - 8 + sway, 36, 18, 2);
    ctx.fillStyle = '#c8b898'; ctx.fillRect(x + 3 + sway, 32, 8, 6);
    ctx.fillStyle = '#3a2418'; ctx.fillRect(x - 14, 60, 30, 3);
  }
  if (spot === 'shallow') { ctx.fillStyle = 'rgba(246,226,168,0.55)'; ctx.fillRect(170, 128, 86, 16); ctx.fillRect(180, 124, 60, 4); }
}

export function drawFishing(ctx: CanvasRenderingContext2D, t: number, _dt: number, v: FishView) {
  drawSea(ctx, t, 'day');
  spotDecor(ctx, v.spot, t);
  const bob = Math.round(Math.sin(t * 1.5));
  // 魚影
  v.shadows.forEach((sh, i) => {
    const y = 86 + i * 7 + Math.sin(t * 1.6 + i) * 2;
    if (v.phase === 'choose' || v.phase === 'cast') {
      fishShadow(ctx, sh.x + Math.sin(t * 0.7 + i * 2) * 6, y, sh.size, t);
      if (i === v.sel) {
        const ax = Math.round(sh.x + Math.sin(t * 0.7 + i * 2) * 6), ay = Math.round(y - 14 - Math.abs(Math.sin(t * 4)) * 3);
        ctx.fillStyle = '#ffcf4a'; ctx.fillRect(ax - 3, ay, 7, 2); ctx.fillRect(ax - 2, ay + 2, 5, 1); ctx.fillRect(ax - 1, ay + 3, 3, 1); ctx.fillRect(ax, ay + 4, 1, 1);
      }
    } else if (i === v.sel && v.phase !== 'hooked') {
      fishShadow(ctx, v.bobX + Math.sin(t * 2) * 3, 72 + Math.sin(t * 2) * 1, sh.size, t, 0.5);
    } else if (i !== v.sel) {
      fishShadow(ctx, sh.x + (sh.x > v.bobX ? 1 : -1) * Math.min(60, t * 0), y, sh.size, t, 0.18);
    }
  });
  boat(ctx, bob);
  const hx = BOAT.x + 14, hy = BOAT.y - 16 + bob;
  let tipX = hx + 42, tipY = hy - 34;
  if (v.phase === 'cast') { const k = v.power; tipX = hx + 40 - k * 50; tipY = hy - 34 - k * 4; }
  pxLine(ctx, hx, hy, tipX, tipY, '#3a2a1a'); pxLine(ctx, hx + 1, hy, tipX + 1, tipY, '#e8d8a8');
  if (v.phase !== 'cast' && v.phase !== 'choose') {
    const wy = 62;
    let bx = v.bobX, by = wy;
    if (v.phase === 'flying') { const k = Math.min(1, v.castT / 0.6); bx = tipX + (v.bobX - tipX) * k; by = tipY + (wy - tipY) * k - Math.sin(k * Math.PI) * 30; }
    const dip = v.phase === 'bite' ? (Math.floor(t * 12) % 2 ? 3 : 1) : v.phase === 'nibble' ? (Math.floor(t * 8) % 2) : 0;
    by += dip + (v.phase === 'wait' ? Math.round(Math.sin(t * 2.2) * 0.6) : 0);
    ctx.globalAlpha = 0.8; pxLine(ctx, tipX, tipY, bx + 1, by, '#ffffff'); ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff3a4a'; ctx.fillRect(bx, by, 3, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by + 2, 3, 1);
    if (v.phase !== 'flying') { ctx.fillStyle = 'rgba(255,255,255,0.7)'; const r = 4 + ((t * 6) % 6); ctx.fillRect(Math.round(bx + 1 - r), wy + 3, 2, 1); ctx.fillRect(Math.round(bx + r), wy + 3, 2, 1); }
    if (v.phase === 'nibble') {
      ctx.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) ctx.fillRect(bx - 3 + i * 3, by - 8, 2, 2);
    }
    if (v.phase === 'bite') {
      const qx = bx - 5, qy = by - 22;
      ctx.fillStyle = '#141a33'; ctx.fillRect(qx - 1, qy - 1, 15, 16);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(qx, qy, 13, 14);
      ctx.fillStyle = '#e8304a'; ctx.fillRect(qx + 5, qy + 2, 3, 6); ctx.fillRect(qx + 5, qy + 10, 3, 2);
    }
  }
}

// 收服用的泡泡網：wob 為晃動角度（-1～1）
export function drawNet(ctx: CanvasRenderingContext2D, cx: number, cy: number, wob: number, glow = 0) {
  const r = 11, ox = Math.round(wob * 4);
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = x * x + y * y;
    if (d > r * r) continue;
    const px = cx + x + Math.round((wob * (y + r)) / 6), py = cy + y;
    let c = 'rgba(150,225,255,0.55)';
    if (d > (r - 1.2) * (r - 1.2)) c = '#ffffff';
    else if ((x + y + 40) % 5 === 0 || (x - y + 40) % 5 === 0) c = 'rgba(232,251,255,0.9)';
    if (x < -3 && y < -3 && d < 30 && d > 12) c = '#ffffff';
    ctx.fillStyle = c; ctx.fillRect(px, py, 1, 1);
  }
  ctx.fillStyle = '#ffcf4a'; ctx.fillRect(cx - 2 + ox, cy - r - 2, 5, 3);
  if (glow > 0) {
    ctx.fillStyle = `rgba(255,236,150,${glow})`;
    for (let a = 0; a < 12; a++) { const an = (a / 12) * Math.PI * 2, rr = r + 4 + glow * 6; ctx.fillRect(Math.round(cx + Math.cos(an) * rr), Math.round(cy + Math.sin(an) * rr), 2, 2); }
  }
}

// ── 標題：安靜的夕陽海面與一艘小船 ──
export function drawTitle(ctx: CanvasRenderingContext2D, t: number) {
  drawSea(ctx, t, 'sunset');
  const x = 186, y = 100 + Math.round(Math.sin(t * 1.2));
  ctx.fillStyle = '#2a1430'; ctx.fillRect(x - 16, y, 34, 3); ctx.fillRect(x - 13, y + 3, 28, 2);
  ctx.fillRect(x, y - 22, 2, 22); ctx.fillStyle = '#ffe0c8'; ctx.fillRect(x + 2, y - 20, 10, 14); ctx.fillStyle = '#f0b0a0'; ctx.fillRect(x + 2, y - 8, 10, 2);
  ctx.fillStyle = 'rgba(42,20,48,0.4)'; ctx.fillRect(x - 14, y + 6, 30, 1); ctx.fillRect(x - 10, y + 8, 22, 1);
}

// ── 選初始夥伴：三座礁石台 ──
export const PEDESTALS = [{ x: 56, y: 104 }, { x: 128, y: 98 }, { x: 200, y: 104 }];
export function drawStarterScene(ctx: CanvasRenderingContext2D, t: number, forms: (string | null)[], sel: number) {
  drawSea(ctx, t, 'day');
  PEDESTALS.forEach((p, i) => {
    foamRing(ctx, p.x, p.y + 1, 38, 9, t + i, '#f2fdff');
    ctx.drawImage(reef(), p.x - 40, p.y - 13);
    const id = forms[i];
    if (!id) return;
    if (i === sel) {
      ctx.fillStyle = '#ffcf4a';
      const r = 26 + Math.sin(t * 4) * 1.5;
      for (let a = 0; a < 60; a++) { if (a % 3 === 0) continue; const an = (a / 60) * Math.PI * 2; ctx.fillRect(Math.round(p.x + Math.cos(an) * r), Math.round(p.y + Math.sin(an) * 6), 1, 1); }
    }
    const f = FORMS[id], n = spriteSize(f.sprite);
    const jump = i === sel ? Math.round(Math.abs(Math.sin(t * 3)) * -4) : 0;
    shadow(ctx, p.x, p.y, 13);
    drawSprite(ctx, f.sprite, PAL[f.pal], p.x - n / 2, p.y - n + 3 + jump, { f: Math.floor(t * 3 + i) % 2, alpha: i === sel ? 1 : 0.85 });
  });
}

// ── 港口：棧橋、燈塔、棲息灣裡游動的夥伴 ──
export function drawPort(ctx: CanvasRenderingContext2D, t: number, bay: string[]) {
  drawSea(ctx, t, 'day');
  // 燈塔
  const lx = 30;
  ctx.fillStyle = '#5a6a7a'; ctx.fillRect(lx - 9, 52, 18, 8);
  for (let y = 14; y < 52; y++) { const w = Math.round(5 + (y - 14) * 0.12); ctx.fillStyle = Math.floor(y / 6) % 2 ? '#e8304a' : '#f4f8ff'; ctx.fillRect(lx - w, y, w * 2, 1); }
  ctx.fillStyle = '#2a3a4a'; ctx.fillRect(lx - 6, 8, 12, 6); ctx.fillStyle = '#ffe48a'; ctx.fillRect(lx - 4, 9, 8, 4);
  if (Math.sin(t * 2) > 0) { ctx.fillStyle = 'rgba(255,240,170,0.35)'; for (let i = 0; i < 26; i++) ctx.fillRect(lx + 6 + i, 10 - Math.round(i * 0.15), 1, 3 + Math.round(i * 0.3)); }
  // 棧橋
  ctx.fillStyle = '#6a4024'; ctx.fillRect(0, 118, 140, 4);
  for (let x = 4; x < 140; x += 12) { ctx.fillStyle = '#4a2a14'; ctx.fillRect(x, 122, 3, 22); }
  ctx.fillStyle = '#8a5530'; for (let x = 0; x < 140; x += 6) ctx.fillRect(x, 116, 5, 2);
  // 倉庫
  ctx.fillStyle = '#8a5a3a'; ctx.fillRect(4, 96, 40, 20); ctx.fillStyle = '#c84a3a'; for (let i = 0; i < 9; i++) ctx.fillRect(0 + i * 2, 96 - i, 48 - i * 4, 1);
  ctx.fillStyle = '#3a2418'; ctx.fillRect(19, 104, 9, 12); ctx.fillStyle = '#ffe48a'; ctx.fillRect(8, 102, 6, 5); ctx.fillRect(33, 102, 6, 5);
  // 棲息灣的夥伴
  bay.forEach((id, i) => {
    const f = FORMS[id]; if (!f) return;
    const n = spriteSize(f.sprite), sp = 0, x = 40 + i * 34 + Math.sin(t * 0.5 + i * 1.7) * 8, y = 62 + (i % 2) * 18 + Math.sin(t * 1.3 + i) * 2;
    const flip = Math.cos(t * 0.5 + i * 1.7) < 0;
    drawSprite(ctx, f.sprite, PAL[f.pal], Math.round(x - n / 2), Math.round(y - n / 2 + sp * 0), { f: Math.floor(t * 3 + i) % 2, flip });
  });
}

// ── 海圖：俯視的航線 ──
export type NodeKind = 'fish' | 'elite' | 'treasure' | 'camp' | 'shop' | 'boss';
export interface ChartNode { kind: NodeKind }
export function chartPos(step: number, idx: number, n: number): [number, number] {
  const x = 16 + step * 25, ys = n === 1 ? [60] : n === 2 ? [42, 80] : [30, 60, 90];
  return [x, ys[idx] + (step % 2 ? 4 : -2)];
}
function chartBase(route: ChartNode[][], seed: number) {
  return cached('chart-' + seed, W, H, (x) => {
    const img = x.createImageData(W, H), r = seeded(seed % 9973);
    const isl: { cx: number; cy: number; rr: number }[] = [];
    route.forEach((opts, i) => opts.forEach((_, j) => { const [cx, cy] = chartPos(i, j, opts.length); isl.push({ cx, cy, rr: i === route.length - 1 ? 11 : 6 + r() * 2 }); }));
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      let dmin = 99;
      for (const s2 of isl) dmin = Math.min(dmin, Math.hypot(xx - s2.cx, (y - s2.cy) * 1.3) - s2.rr);
      const shallow = Math.max(0, Math.min(1, 1 - dmin / 22));
      const deep = 0.5 + 0.5 * Math.sin(xx * 0.03 + y * 0.05) * Math.cos(y * 0.04 - xx * 0.01);
      let c = ditherGrad(['#0a3f7a', '#1676b8', '#3fb6d8', '#8fe4ee'], Math.min(1, shallow * 0.85 + deep * 0.2), xx, y, 10);
      if (dmin < 0) c = dmin < -3 ? (BAYER[y & 3][xx & 3] > 7 ? hex('#5fae5a') : hex('#4c9a4c')) : hex('#f2dc9c');
      else if (dmin < 1.2) c = hex('#e8fbff');
      const i = (y * W + xx) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const cx = 240, cy = 126;
    x.fillStyle = 'rgba(232,251,255,0.6)';
    for (let a2 = 0; a2 < 40; a2++) { const an = (a2 / 40) * Math.PI * 2; x.fillRect(Math.round(cx + Math.cos(an) * 8), Math.round(cy + Math.sin(an) * 8), 1, 1); }
    x.fillStyle = '#ff5a6e'; for (let i = 0; i < 6; i++) x.fillRect(cx, cy - 7 + i, 1, 1);
  });
}
const NODE_COL: Record<NodeKind, string> = { fish: '#f4f8ff', elite: '#c58cff', treasure: '#ffcf4a', camp: '#ff9a3a', shop: '#7ee3c8', boss: '#e8304a' };
function nodeIcon(ctx: CanvasRenderingContext2D, k: NodeKind, x: number, y: number) {
  ctx.fillStyle = '#141a33'; ctx.fillRect(x - 6, y - 14, 13, 11);
  ctx.fillStyle = NODE_COL[k]; ctx.fillRect(x - 5, y - 13, 11, 9);
  ctx.fillStyle = k === 'boss' || k === 'elite' ? '#ffffff' : '#141a33';
  if (k === 'fish' || k === 'elite') { ctx.fillRect(x - 3, y - 9, 5, 2); ctx.fillRect(x - 2, y - 10, 3, 4); ctx.fillRect(x + 2, y - 10, 2, 1); ctx.fillRect(x + 2, y - 7, 2, 1); }
  if (k === 'elite') { ctx.fillStyle = '#ffcf4a'; ctx.fillRect(x - 4, y - 12, 1, 1); ctx.fillRect(x + 4, y - 12, 1, 1); }
  if (k === 'camp') { ctx.fillRect(x, y - 12, 1, 1); ctx.fillRect(x - 1, y - 11, 3, 1); ctx.fillRect(x - 2, y - 10, 5, 1); ctx.fillRect(x - 3, y - 9, 7, 2); }
  if (k === 'treasure') { ctx.fillRect(x - 3, y - 11, 7, 6); ctx.fillStyle = '#ffcf4a'; ctx.fillRect(x - 2, y - 10, 5, 2); ctx.fillRect(x, y - 8, 1, 2); }
  if (k === 'shop') { ctx.fillRect(x - 3, y - 11, 7, 1); ctx.fillRect(x - 2, y - 10, 1, 4); ctx.fillRect(x + 2, y - 10, 1, 4); ctx.fillRect(x - 3, y - 7, 7, 1); }
  if (k === 'boss') { ctx.fillRect(x - 3, y - 11, 7, 4); ctx.fillStyle = '#e8304a'; ctx.fillRect(x - 2, y - 10, 2, 2); ctx.fillRect(x + 1, y - 10, 2, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 7, 1, 2); ctx.fillRect(x, y - 7, 1, 2); ctx.fillRect(x + 2, y - 7, 1, 2); }
}
function drawFog(ctx: CanvasRenderingContext2D, t: number, fx: number) {
  const fog = hex('#e4edf8'), fog2 = hex('#c6d4e8');
  for (let y = 0; y < H; y++) {
    const wave = Math.sin(y * 0.18 + t * 0.6) * 3 + Math.sin(y * 0.05 - t * 0.3) * 4;
    const x0 = Math.round(fx + wave);
    for (let x = Math.max(0, x0 - 10); x < W; x++) {
      const d = x - x0;
      if (d < 0 && BAYER[y & 3][x & 3] > (d + 10) * 1.6) continue;
      const n = Math.sin(x * 0.07 + t * 0.35) * Math.sin(y * 0.09 - t * 0.2) + Math.sin((x - y) * 0.035 + t * 0.25) * 0.6;
      const c = n > 0.55 + (BAYER[y & 3][x & 3] / 16) * 0.3 ? fog2 : fog;
      ctx.fillStyle = css(c, d < 0 ? 0.8 : 1); ctx.fillRect(x, y, 1, 1);
    }
  }
  // 霧上的雲團
  for (let k = 0; k < 6; k++) {
    const cx = fx + 14 + ((k * 37 + t * 3) % Math.max(20, W - fx)), cy = 14 + k * 22;
    ctx.drawImage(cloudSprite('day', k % 5), Math.round(cx - 30), cy);
  }
}

export function drawChart(ctx: CanvasRenderingContext2D, t: number, route: ChartNode[][], station: number, picked: number | null, path: number[], seed: number) {
  ctx.drawImage(chartBase(route, seed), 0, 0);
  ctx.fillStyle = 'rgba(232,251,255,0.35)';
  for (let i = 0; i < 26; i++) { const x = ((i * 53 + t * 5) % (W + 10)) - 5, y = (i * 29) % H; ctx.fillRect(Math.round(x), y, 3, 1); ctx.fillRect(Math.round(x) + 3, y - 1, 2, 1); }
  // 已走過的航線（金色）
  const chosen = [...path, ...(picked !== null ? [picked] : [])];
  for (let i = 0; i < chosen.length - 1; i++) {
    const [x0, y0] = chartPos(i, chosen[i], route[i].length), [x1, y1] = chartPos(i + 1, chosen[i + 1], route[i + 1].length);
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3);
    ctx.fillStyle = '#ffcf4a';
    for (let k = 1; k < n; k++) ctx.fillRect(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 - 6 + ((y1 - y0) * k) / n), 2, 2);
  }
  // 從目前位置到下一站各岔路的虛線
  const from = chosen.length ? chartPos(chosen.length - 1, chosen[chosen.length - 1], route[chosen.length - 1].length) : null;
  if (from && picked === null && station < route.length) {
    route[station].forEach((_, j) => {
      const [x1, y1] = chartPos(station, j, route[station].length), n = Math.ceil(Math.hypot(x1 - from[0], y1 - from[1]) / 4);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let k = 1; k < n; k++) if ((k + Math.floor(t * 6)) % 2) ctx.fillRect(Math.round(from[0] + ((x1 - from[0]) * k) / n), Math.round(from[1] - 6 + ((y1 - from[1]) * k) / n), 1, 1);
    });
  }
  route.forEach((opts, i) => opts.forEach((o, j) => {
    if (i > station) return; // 還沒探索的海域看不見
    const [x, y] = chartPos(i, j, opts.length);
    const past = i < station || (i === station && picked !== null && picked !== j);
    const onPath = chosen[i] === j;
    ctx.globalAlpha = i < station ? (onPath ? 0.75 : 0.25) : past ? 0.35 : 1;
    nodeIcon(ctx, o.kind, x, y);
    ctx.globalAlpha = 1;
    if (i === station && (picked === null || picked === j)) {
      ctx.fillStyle = '#ffcf4a';
      const r = 10 + Math.sin(t * 5) * 1.5;
      for (let a2 = 0; a2 < 32; a2++) { if (a2 % 2) continue; const an = (a2 / 32) * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(an) * r), Math.round(y - 8 + Math.sin(an) * r * 0.8), 1, 1); }
    }
  }));
  // 迷霧：下一站之後的海域都被雲霧遮住
  if (station < route.length - 1) drawFog(ctx, t, chartPos(station + 1, 0, 1)[0] - 13);
  // 小船：在目前所在的位置
  const at = picked !== null ? chartPos(station, picked, route[station].length) : from ?? chartPos(0, 0, 1);
  const [bx, by] = at, bob = Math.round(Math.sin(t * 3));
  ctx.fillStyle = '#5a321c'; ctx.fillRect(bx - 5, by + 3 + bob, 11, 2); ctx.fillStyle = '#8a5530'; ctx.fillRect(bx - 6, by + 2 + bob, 13, 1);
  ctx.fillStyle = '#f4f8ff'; ctx.fillRect(bx, by - 5 + bob, 1, 7); ctx.fillRect(bx + 1, by - 4 + bob, 3, 4);
}

// ── 海底：圖鑑、說明、結算 ──
export function drawDeep(ctx: CanvasRenderingContext2D, t: number) {
  const bg = cached('deep', W, H, (x) => {
    const img = x.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const c = ditherGrad(['#2fb0d0', '#13709e', '#0a3f72', '#061f48'], y / H, xx, y, 12);
      const i = (y * W + xx) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const r = seeded(5);
    for (let i = 0; i < 70; i++) { const xx = Math.floor(r() * W), h = 4 + Math.floor(r() * 10); x.fillStyle = r() > 0.5 ? '#0a2c50' : '#0f3a60'; x.fillRect(xx, H - h, 3 + Math.floor(r() * 5), h); }
  });
  ctx.drawImage(bg, 0, 0);
  // 光束
  ctx.fillStyle = 'rgba(200,250,255,0.07)';
  for (let k = 0; k < 5; k++) {
    const x0 = ((k * 61 + t * 3) % (W + 60)) - 30;
    for (let y = 0; y < H; y += 2) ctx.fillRect(Math.round(x0 + y * 0.35), y, 8 + (k % 3) * 4, 2);
  }
  // 海草
  for (let k = 0; k < 9; k++) {
    const bx = 10 + k * 29;
    ctx.fillStyle = k % 2 ? '#1f6a4a' : '#2a8a5a';
    for (let y = 0; y < 26 + (k % 3) * 8; y++) ctx.fillRect(Math.round(bx + Math.sin(y * 0.25 + t * 1.6 + k) * 2), H - y, 2, 1);
  }
  // 氣泡
  ctx.fillStyle = 'rgba(232,251,255,0.7)';
  for (let i = 0; i < 24; i++) { const y = H - ((t * (8 + (i % 5) * 3) + i * 23) % (H + 10)); const x = (i * 41) % W + Math.sin(t * 2 + i) * 2; ctx.fillRect(Math.round(x), Math.round(y), i % 3 ? 1 : 2, i % 3 ? 1 : 2); }
  // 遠方魚群剪影
  ctx.fillStyle = 'rgba(6,31,72,0.6)';
  for (let i = 0; i < 7; i++) { const x = ((t * 7 + i * 19) % (W + 40)) - 20, y = 40 + (i % 4) * 7 + Math.sin(t + i) * 2; ctx.fillRect(Math.round(x), Math.round(y), 5, 2); ctx.fillRect(Math.round(x) - 2, Math.round(y) - 1, 2, 4); }
}

export function auraColor(form: string, boss = false): string | undefined {
  const r = FORMS[form]?.rarity;
  if (boss) return '#ff5a6e';
  return r === 'SSR' ? '#ffd84a' : r === 'S' ? '#c58cff' : undefined;
}
