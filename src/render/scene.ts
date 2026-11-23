// 場景繪製（256×144 像素）：海景全景、戰鬥地形、釣魚、標題、海圖、海底
import { FORMS, recolorOf } from '../data/creatures';
import { ELEM, type Elem } from '../data/types';
import { drawSprite, drawSpriteMini, PAL, spriteSize } from './pixel';
import { sceneArt } from './art';
import { fx, partMul } from './fx';

export const W = 256, H = 144;
/** 橫向延伸：bleed = 左右各多畫幾個像素；wide = 這一格已經畫了延伸的背景 */
export const view = { bleed: 0, wide: false };

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
export type ThemeId = 'day' | 'sunset' | 'ice' | 'lava' | 'forest' | 'void' | 'core' | 'cyber' | 'abyss';
interface Theme { sky: string[]; sea: string[]; far: string; near: string; sun: string; glow: string; cloud: [string, string]; foam: string; glint: string; horizon: number; sunX: number; sunY: number; sunR: number }
const THEMES: Record<ThemeId, Theme> = {
  day: { sky: ['#2f7fd8', '#5fb0f0', '#c8f0ff'], sea: ['#7fd8f0', '#2fa4d6', '#0d5f9e', '#073a6e'], far: '#8cc4dc', near: '#5f9fc0', sun: '#fffbe0', glow: '#fff1a8', cloud: ['#ffffff', '#cfe4fa'], foam: '#f2fdff', glint: '#ffffff', horizon: 46, sunX: 206, sunY: 14, sunR: 7 },
  ice: { sky: ['#7aa8d8', '#b8daf4', '#eef8ff'], sea: ['#c8eef8', '#7ac0e0', '#2a72a8', '#103e6a'], far: '#e4f2fc', near: '#c4dcf0', sun: '#ffffff', glow: '#eaf6ff', cloud: ['#ffffff', '#d4e6f6'], foam: '#ffffff', glint: '#ffffff', horizon: 48, sunX: 62, sunY: 16, sunR: 6 },
  lava: { sky: ['#160606', '#4a1410', '#a8341a', '#ff8a3a'], sea: ['#b8502a', '#5e2016', '#2a0e10', '#120608'], far: '#3a1612', near: '#1e0a0a', sun: '#ffd08a', glow: '#ff6a2a', cloud: ['#5a2a24', '#341612'], foam: '#ffb070', glint: '#ffd08a', horizon: 54, sunX: 204, sunY: 30, sunR: 9 },
  forest: { sky: ['#2a6a4a', '#5aa86a', '#c8ecb0'], sea: ['#7ad8b0', '#2a9a7a', '#0e5a4a', '#063028'], far: '#3a7a4a', near: '#245a34', sun: '#fffbd0', glow: '#e8ffb0', cloud: ['#f4fff0', '#c8e8c0'], foam: '#e8fff0', glint: '#fffbd0', horizon: 50, sunX: 70, sunY: 18, sunR: 7 },
  void: { sky: ['#06020e', '#1e0a34', '#4a1a6a', '#8a4ab0'], sea: ['#6a3a9a', '#2a1050', '#12062a', '#06020e'], far: '#1a0a2a', near: '#0e0418', sun: '#e8d8ff', glow: '#a86aff', cloud: ['#4a2a6a', '#2a1440'], foam: '#c89aff', glint: '#e8d8ff', horizon: 52, sunX: 200, sunY: 22, sunR: 8 },
  core: { sky: ['#020a1a', '#062a4a', '#0a5a7a', '#2ab0c8'], sea: ['#2ac8d8', '#0a6a8a', '#04304a', '#020e1e'], far: '#0a3a5a', near: '#062440', sun: '#e8ffff', glow: '#5ff1ff', cloud: ['#1a4a6a', '#0e2a44'], foam: '#8affff', glint: '#e8ffff', horizon: 50, sunX: 128, sunY: 20, sunR: 7 },
  cyber: { sky: ['#050318', '#14104a', '#3a1a7a', '#e040a0'], sea: ['#ff4ac8', '#3a1a8a', '#120a3a', '#04021a'], far: '#1a1050', near: '#0e0830', sun: '#ffe0ff', glow: '#ff4ac8', cloud: ['#3a2a7a', '#1e1450'], foam: '#5ff1ff', glint: '#ffb0f0', horizon: 54, sunX: 128, sunY: 40, sunR: 12 },
  abyss: { sky: ['#000003', '#02040c', '#060a1c', '#0c1430'], sea: ['#1a2a5a', '#0a1230', '#04081a', '#010208'], far: '#060a18', near: '#03060e', sun: '#d8f4ff', glow: '#4a8aff', cloud: ['#0e1430', '#080c20'], foam: '#3a5a9a', glint: '#9ad8ff', horizon: 46, sunX: 64, sunY: 8, sunR: 4 },
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

function fromArt(name: string, w: number, h: number) {
  const img = sceneArt(name);
  if (!img) return null;
  return cached('art-' + name, w, h, (x) => { x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, w, h); });
}
function backdrop(id: ThemeId) {
  const art = fromArt('bg-' + id, W, H);
  if (art) return art;
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
    if (id === 'ice') {
      // 冰山
      for (const [cx, w, h] of [[30, 16, 18], [120, 22, 26], [176, 12, 12], [236, 18, 20]] as const) {
        for (let yy = 0; yy < h; yy++) { const hw = Math.round((w * (yy + 1)) / h / 2); x.fillStyle = yy < h * 0.3 ? '#ffffff' : '#d8ecf8'; x.fillRect(cx - hw, hz - h + yy, hw * 2, 1); x.fillStyle = '#a8c8e4'; x.fillRect(cx, hz - h + yy, hw, 1); }
      }
    }
    if (id === 'lava') {
      // 火山與熔岩
      const vx = 128;
      for (let yy = 0; yy < 30; yy++) { const hw = 6 + yy * 1.6; x.fillStyle = '#2a0e0c'; x.fillRect(Math.round(vx - hw), hz - 30 + yy, Math.round(hw * 2), 1); }
      x.fillStyle = '#ff6a1a'; x.fillRect(vx - 6, hz - 30, 12, 2); x.fillStyle = '#ffd04a'; x.fillRect(vx - 3, hz - 31, 6, 1);
      for (let yy = 0; yy < 24; yy++) { x.fillStyle = yy % 3 ? '#ff6a1a' : '#ffb04a'; x.fillRect(vx - 2 + Math.round(Math.sin(yy * 0.6) * 2), hz - 28 + yy, 2, 1); }
      x.fillStyle = 'rgba(255,120,40,0.25)'; for (let r = 4; r < 22; r += 3) pxCircle(x, vx, hz - 32, r, 'rgba(255,120,40,0.06)', hz - 28);
    }
    if (id === 'forest') {
      // 巨樹剪影
      for (const [cx, h, w] of [[40, 38, 16], [96, 30, 12], [160, 44, 20], [224, 34, 14]] as const) {
        x.fillStyle = '#1e4a2a'; x.fillRect(cx - 2, hz - h + 10, 4, h - 10);
        pxCircle(x, cx, hz - h + 8, w / 2 + 2, '#1e4a2a', hz); pxCircle(x, cx - 6, hz - h + 14, w / 2 - 1, '#245a34', hz); pxCircle(x, cx + 6, hz - h + 13, w / 2 - 1, '#2a6a3a', hz);
      }
    }
    if (id === 'void') {
      // 浮空碎石
      const r = seeded(91);
      for (let i = 0; i < 9; i++) { const cx = Math.floor(r() * W), cy = 8 + Math.floor(r() * (hz - 18)), w = 3 + Math.floor(r() * 7); x.fillStyle = '#2a1440'; x.fillRect(cx, cy, w, 3); x.fillRect(cx + 1, cy + 3, w - 2, 2); x.fillStyle = '#6a3a9a'; x.fillRect(cx, cy, w, 1); }
    }
    if (id === 'core') {
      // 海面網格
      x.fillStyle = 'rgba(95,241,255,0.18)';
      for (let k = 0; k < 8; k++) { const y = Math.round(hz + 2 + Math.pow(k / 8, 1.6) * (H - hz)); x.fillRect(0, y, W, 1); }
      for (let k = -12; k <= 12; k++) for (let y = hz; y < H; y += 2) x.fillRect(Math.round(W / 2 + k * 6 * (1 + (y - hz) / 12)), y, 1, 1);
    }
    if (id === 'cyber') {
      // 夕陽般的電子太陽：橫向切開的條紋
      for (let k = 0; k < 5; k++) { x.fillStyle = th.sky[0]; x.fillRect(th.sunX - 14, th.sunY + 2 + k * 2 + Math.floor(k / 2), 28, 1); }
      // 資料高塔的剪影，窗戶亮著燈
      const r = seeded(57);
      for (let i = 0; i < 16; i++) {
        const w = 6 + Math.floor(r() * 10), h = 8 + Math.floor(r() * 22), cx = Math.floor(r() * W);
        if (Math.abs(cx - th.sunX) < 20 && h > 14) continue;
        x.fillStyle = '#0a0628'; x.fillRect(cx, hz - h, w, h);
        x.fillStyle = '#5ff1ff'; x.fillRect(cx, hz - h, w, 1);
        for (let yy = hz - h + 3; yy < hz - 2; yy += 3) for (let xx = cx + 1; xx < cx + w - 1; xx += 2) if (r() < 0.35) { x.fillStyle = r() < 0.5 ? '#ff4ac8' : '#5ff1ff'; x.fillRect(xx, yy, 1, 1); }
      }
      // 霓虹網格海面
      for (let k = 0; k < 10; k++) { const y = Math.round(hz + 1 + Math.pow(k / 10, 1.7) * (H - hz)); x.fillStyle = k % 2 ? 'rgba(255,74,200,0.45)' : 'rgba(95,241,255,0.35)'; x.fillRect(0, y, W, 1); }
      x.fillStyle = 'rgba(95,241,255,0.35)';
      for (let k = -16; k <= 16; k++) for (let y = hz + 1; y < H; y++) x.fillRect(Math.round(W / 2 + k * 4 * (1 + (y - hz) / 6)), y, 1, 1);
    }
    if (id === 'abyss') {
      // 從上方照下來的微弱光束
      for (let k = 0; k < 4; k++) {
        const bx = 40 + k * 58;
        for (let y = 0; y < H; y++) { const w = 3 + y * 0.12, a = 0.07 * (1 - y / H); x.fillStyle = `rgba(120,170,255,${a})`; x.fillRect(Math.round(bx + y * 0.25 - w / 2), y, Math.round(w), 1); }
      }
      // 海底岩柱
      const r = seeded(77);
      for (let i = 0; i < 7; i++) { const cx = Math.floor(r() * W), w = 4 + Math.floor(r() * 8), h = 10 + Math.floor(r() * 24); for (let yy = 0; yy < h; yy++) { const hw = Math.max(1, Math.round(w * (0.4 + yy / h * 0.6) / 2)); x.fillStyle = '#04070f'; x.fillRect(cx - hw, hz - h + yy, hw * 2, 1); } }
      // 遠方巨大的鯨魚影子
      for (let i = 0; i < 70; i++) { const yy = Math.round(Math.sin((i / 70) * Math.PI) * 7); x.fillStyle = '#05091a'; x.fillRect(150 + i, 26 - yy, 1, yy * 2 + 2); }
      x.fillStyle = '#05091a'; x.fillRect(146, 22, 5, 4); x.fillRect(142, 18, 4, 4); x.fillRect(142, 28, 4, 4);
      x.fillStyle = '#9ad8ff'; x.fillRect(208, 25, 1, 1);
    }
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
/** 畫背景圖，並往左右鏡射延伸（只有背景，前景的船和角色不會重複） */
function drawWideBg(ctx: CanvasRenderingContext2D, bg: CanvasImageSource) {
  ctx.drawImage(bg, 0, 0);
  const b = view.bleed;
  view.wide = true;
  if (b <= 0) return;
  const w = Math.min(b, W);
  ctx.save(); ctx.scale(-1, 1); ctx.drawImage(bg, 0, 0, w, H, 0, 0, w, H); ctx.restore();
  ctx.save(); ctx.translate(W * 2, 0); ctx.scale(-1, 1); ctx.drawImage(bg, W - w, 0, w, H, W - w, 0, w, H); ctx.restore();
}

export function drawSea(ctx: CanvasRenderingContext2D, t: number, id: ThemeId = 'day') {
  const th = THEMES[id], hz = th.horizon;
  const b = view.bleed, WW = W + b * 2;
  drawWideBg(ctx, backdrop(id));
  for (let k = 0; k < (id === 'abyss' ? 0 : 5); k++) {
    const sp = 2 + k * 0.7, cx = ((k * 71 + t * sp) % (WW + 70)) - 64 - b, cy = 4 + ((k * 13) % (hz - 26));
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
    for (let x = -gap + off - b; x < W + b; x += gap) {
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
  if (id === 'ice') {
    // 雪花
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 40; i++) { const x = ((i * 47 + Math.sin(t + i) * 6 + t * 6) % WW) - b, y = (i * 29 + t * (10 + (i % 4) * 3)) % H; ctx.fillRect(Math.round(x), Math.round(y), i % 5 ? 1 : 2, i % 5 ? 1 : 2); }
    return;
  }
  if (id === 'forest') {
    // 螢火光點
    for (let i = 0; i < 26; i++) { const x = ((i * 41 + Math.sin(t * 0.8 + i) * 8) % WW) - b, y = (i * 23 + Math.cos(t * 0.6 + i) * 5) % (H - 10); if (Math.sin(t * 3 + i) < 0) continue; ctx.fillStyle = i % 3 ? 'rgba(230,255,150,0.9)' : 'rgba(255,255,220,0.9)'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
    return;
  }
  if (id === 'void') {
    // 錯亂方塊
    for (let i = 0; i < 14; i++) { if ((Math.floor(t * 6) + i * 7) % 5) continue; const x = ((i * 67 + Math.floor(t * 3) * 13) % WW) - b, y = (i * 37) % H; ctx.fillStyle = i % 2 ? 'rgba(200,154,255,0.7)' : 'rgba(95,241,255,0.5)'; ctx.fillRect(x, y, 2 + (i % 3) * 2, 1 + (i % 2)); }
    return;
  }
  if (id === 'core') {
    // 往上流動的資料光點
    for (let i = 0; i < 32; i++) { const x = ((i * 29) % WW) - b, y = H - ((i * 17 + t * (12 + (i % 4) * 4)) % H); ctx.fillStyle = i % 4 ? 'rgba(95,241,255,0.75)' : 'rgba(255,255,255,0.9)'; ctx.fillRect(x, Math.round(y), 1, i % 3 ? 2 : 1); }
    return;
  }
  if (id === 'cyber') {
    // 掃描線與往上飄的位元
    const sy = Math.floor((t * 30) % H); ctx.fillStyle = 'rgba(95,241,255,0.12)'; ctx.fillRect(-b, sy, WW, 2);
    for (let i = 0; i < 28; i++) { const x = ((i * 37) % WW) - b, y = H - ((i * 19 + t * (10 + (i % 4) * 5)) % H); if ((Math.floor(t * 4) + i) % 6 === 0) continue; ctx.fillStyle = i % 3 ? 'rgba(95,241,255,0.8)' : 'rgba(255,74,200,0.85)'; ctx.fillRect(x, Math.round(y), i % 4 ? 1 : 2, 1); }
    return;
  }
  if (id === 'abyss') {
    // 海雪往下飄、生物光一閃一閃
    for (let i = 0; i < 40; i++) { const x = ((i * 43 + Math.sin(t * 0.5 + i) * 5) % WW) - b, y = (i * 23 + t * (3 + (i % 4))) % H; ctx.fillStyle = 'rgba(200,220,255,0.35)'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
    for (let i = 0; i < 12; i++) { const a = Math.sin(t * 1.5 + i * 2.3); if (a < 0.3) continue; const x = ((i * 71) % WW) - b, y = 50 + ((i * 29) % (H - 60)); ctx.fillStyle = i % 2 ? `rgba(95,241,255,${a})` : `rgba(160,120,255,${a})`; ctx.fillRect(x, y, 1, 1); }
    return;
  }
  if (id === 'lava') {
    // 往上飄的火星
    for (let i = 0; i < 30; i++) { const x = ((i * 53 + Math.sin(t * 1.5 + i) * 4) % WW) - b, y = H - ((i * 31 + t * (8 + (i % 5) * 3)) % H); ctx.fillStyle = i % 3 ? 'rgba(255,140,40,0.8)' : 'rgba(255,220,120,0.9)'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
    return;
  }
  // 遠方海鳥
  const bx = ((t * 9) % (WW + 40)) - 20 - b, by = 18 + Math.sin(t * 0.7) * 3;
  ctx.fillStyle = id === 'sunset' ? '#2a1a40' : '#33506e';
  for (const [dx, dy] of [[0, 0], [9, 4], [-7, 5]]) {
    const wing = Math.floor(t * 4 + dx) % 2;
    ctx.fillRect(Math.round(bx + dx - 2), Math.round(by + dy - wing), 2, 1); ctx.fillRect(Math.round(bx + dx + 1), Math.round(by + dy - wing), 2, 1); ctx.fillRect(Math.round(bx + dx), Math.round(by + dy), 1, 1);
  }
}

// ── 戰鬥地形 ──
export const BATTLE = { player: { x: 66, y: 100 }, enemy: { x: 190, y: 66 } };

const PLAT: Record<string, { rim: [string, string]; top: [string, string]; side: [string, string]; mid: [string, string]; deco: string[]; grass: string | null; rtop: [string, string]; rtop2: [string, string]; rbot: [string, string]; rmid: [string, string] }> = {
  day: { rim: ['#8fd8e8', '#bfeff6'], top: ['#fff4d0', '#f6e2a8'], side: ['#b8915a', '#c9a468'], mid: ['#e0c080', '#ecd394'], deco: ['#fffaf0', '#ff9a8a'], grass: '#5fae5a', rtop: ['#7ab86a', '#5fa25a'], rtop2: ['#a6d48a', '#8cc474'], rbot: ['#5a6878', '#6a7888'], rmid: ['#a8b0b8', '#8c96a2'] },
  ice: { rim: ['#ffffff', '#c8f0fa'], top: ['#ffffff', '#eef8ff'], side: ['#8ac0e0', '#a8d4ee'], mid: ['#d8eefa', '#e8f6ff'], deco: ['#ffffff', '#9ad8ff'], grass: null, rtop: ['#ffffff', '#e4f2fc'], rtop2: ['#ffffff', '#eef8ff'], rbot: ['#4a6a8a', '#5a7a9a'], rmid: ['#8aa8c4', '#7a98b4'] },
  forest: { rim: ['#c8f4d8', '#9ae4b8'], top: ['#7ac85a', '#6ab84a'], side: ['#5a3a20', '#6a4a28'], mid: ['#5aa84a', '#4c9a40'], deco: ['#ffe08a', '#ff9ab0'], grass: '#2a7a3a', rtop: ['#4c9a40', '#3a8a34'], rtop2: ['#7ac85a', '#6ab84a'], rbot: ['#3a2a1a', '#4a3420'], rmid: ['#6a5a3a', '#5a4a30'] },
  void: { rim: ['#c89aff', '#8a5ad0'], top: ['#3a2a5a', '#2e2048'], side: ['#140a24', '#1c0e30'], mid: ['#24163c', '#2a1a44'], deco: ['#c89aff', '#5ff1ff'], grass: null, rtop: ['#4a2a7a', '#3a1a6a'], rtop2: ['#2a1a44', '#24163c'], rbot: ['#0a0414', '#120820'], rmid: ['#1e1034', '#18102c'] },
  core: { rim: ['#8affff', '#5ff1ff'], top: ['#1a4a6a', '#164060'], side: ['#062440', '#0a2a48'], mid: ['#0e3a5a', '#103e60'], deco: ['#5ff1ff', '#ffffff'], grass: null, rtop: ['#2ab0c8', '#1a90b0'], rtop2: ['#164060', '#1a4a6a'], rbot: ['#041828', '#062030'], rmid: ['#0a2a48', '#0e3050'] },
  cyber: { rim: ['#5ff1ff', '#ff4ac8'], top: ['#2a1a5a', '#24164e'], side: ['#0a0628', '#120a36'], mid: ['#1a1044', '#1e1250'], deco: ['#5ff1ff', '#ff4ac8'], grass: null, rtop: ['#3a2a7a', '#2e2068'], rtop2: ['#1a1044', '#24164e'], rbot: ['#06041a', '#0a0628'], rmid: ['#120a36', '#160c40'] },
  abyss: { rim: ['#3a5a9a', '#5f8ad0'], top: ['#1a2440', '#162036'], side: ['#05080f', '#0a0e1a'], mid: ['#0e1426', '#121a30'], deco: ['#5ff1ff', '#a87aff'], grass: null, rtop: ['#2a3456', '#222c4a'], rtop2: ['#121a30', '#162036'], rbot: ['#030509', '#05080f'], rmid: ['#0e1426', '#0a101e'] },
  lava: { rim: ['#ff8a3a', '#ffb070'], top: ['#5a4a4a', '#4a3a3a'], side: ['#2a1a1a', '#1a1010'], mid: ['#3a2a2a', '#443232'], deco: ['#ff7a1a', '#ffd04a'], grass: null, rtop: ['#ff6a1a', '#c84a1a'], rtop2: ['#3a2a2a', '#4a3434'], rbot: ['#1a0e0e', '#24140e'], rmid: ['#3a2a2a', '#2e2020'] },
};
function shoal(th = 'day') {
  const art = fromArt('shoal-' + th, 120, 30);
  if (art) return art;
  const P = PLAT[th] ?? PLAT.day;
  return cached('shoal-' + th, 120, 30, (x) => {
    pxEllipse(x, 60, 15, 58, 13, (px, py, nx, ny) => {
      const d = nx * nx + ny * ny, b = BAYER[py & 3][px & 3];
      if (d > 0.82) return (px + py) % 2 ? P.rim[0] : P.rim[1];
      if (ny < -0.45) return b > 9 ? P.top[0] : P.top[1];
      if (d > 0.6 && ny > 0) return b > 6 ? P.side[0] : P.side[1];
      return b > 12 ? P.mid[0] : P.mid[1];
    });
    const r = seeded(21);
    for (let i = 0; i < 9; i++) { const sx = 18 + r() * 84, sy = 8 + r() * 10; x.fillStyle = i % 3 ? P.deco[0] : P.deco[1]; x.fillRect(Math.round(sx), Math.round(sy), th === 'lava' ? 2 : 1, 1); }
    if (P.grass) for (const gx of [16, 22, 96, 101]) { x.fillStyle = P.grass; x.fillRect(gx, 6, 1, 4); x.fillRect(gx + 1, 4, 1, 6); x.fillRect(gx + 2, 7, 1, 3); }
  });
}
function reef(th = 'day') {
  const art = fromArt('reef-' + th, 80, 26);
  if (art) return art;
  const P = PLAT[th] ?? PLAT.day;
  return cached('reef-' + th, 80, 26, (x) => {
    pxEllipse(x, 40, 14, 36, 10, (px, py, nx, ny) => {
      const d = nx * nx + ny * ny, b = BAYER[py & 3][px & 3];
      if (d > 0.8) return (px + py) % 2 ? P.rim[0] : P.rim[1];
      if (ny < -0.15) return d > 0.55 ? (b > 8 ? P.rtop[0] : P.rtop[1]) : b > 10 ? P.rtop2[0] : P.rtop2[1];
      if (ny > 0.4) return b > 7 ? P.rbot[0] : P.rbot[1];
      return b > 11 ? P.rmid[0] : P.rmid[1];
    });
    const r = seeded(33);
    const deco = th === 'day' ? ['#ff6b8a', '#ffb05a', '#c87ae0', '#fffbe8'] : th === 'ice' ? ['#ffffff', '#9ad8ff', '#c8f4ff', '#ffffff'] : th === 'cyber' ? ['#5ff1ff', '#ff4ac8', '#ffffff', '#5ff1ff'] : th === 'abyss' ? ['#5ff1ff', '#a87aff', '#3a5a9a', '#9ad8ff'] : ['#ff7a1a', '#ffd04a', '#ff4a1a', '#ffb04a'];
    for (let i = 0; i < 7; i++) { const cx = 12 + r() * 56; x.fillStyle = deco[i % 4]; x.fillRect(Math.round(cx), 8 + Math.round(r() * 4), 2, 1); x.fillRect(Math.round(cx), 7, 1, 1); }
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

export interface MonView { form: string; x: number; y: number; flip: boolean; flash: number; shake: number; lunge: number; alpha: number; scale: number; tint?: string; aura?: string; mutant?: boolean; enter?: number; low?: boolean }
/** 戰鬥畫面的額外演出：場地、畫面震動、全畫面閃光 */
export interface BattleFx { field?: string | null; quake?: number; flash?: number; flashColor?: string }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; g?: number }
export interface Beam { x0: number; y0: number; x1: number; y1: number; life: number; color: string }

export function monSlot(side: 0 | 1, form: string) {
  const f = FORMS[form], sc = f?.scale ?? 1, base = side === 0 ? BATTLE.player : BATTLE.enemy;
  const size = spriteSize(f?.sprite ?? '') * sc;
  return { x: base.x - size / 2, y: base.y - size + 3, scale: sc, cx: base.x, cy: base.y - size / 2 + 2 };
}

export function drawBattleBg(ctx: CanvasRenderingContext2D, t: number, theme: ThemeId = 'day') {
  drawSea(ctx, t, theme);
  const e = BATTLE.enemy, p = BATTLE.player;
  foamRing(ctx, e.x, e.y + 1, 38, 9, t, '#f2fdff');
  ctx.drawImage(reef(theme), e.x - 40, e.y - 13);
  foamRing(ctx, p.x, p.y + 2, 60, 13, t + 1, '#f2fdff');
  ctx.drawImage(shoal(theme), p.x - 60, p.y - 13);
}

function shadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number) {
  ctx.fillStyle = 'rgba(20,30,50,0.32)';
  for (let y = -2; y <= 2; y++) { const hw = Math.round(w * Math.sqrt(1 - (y * y) / 6.5)); ctx.fillRect(cx - hw, cy + y, hw * 2, 1); }
}

export function drawBattle(ctx: CanvasRenderingContext2D, t: number, dt: number, mons: (MonView | null)[], parts: Particle[], beams: Beam[], theme: ThemeId = 'day', bfx: BattleFx = {}) {
  // 畫面震動（減少特效時關掉）
  const q = fx.reduce ? 0 : bfx.quake ?? 0;
  ctx.save();
  if (q > 0) ctx.translate(Math.round((Math.random() - 0.5) * q * 2), Math.round((Math.random() - 0.5) * q * 2));
  drawBattleBg(ctx, t, theme);
  if (bfx.field) drawFieldBack(ctx, t, bfx.field);
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
    // 待機：呼吸般上下浮動，偶爾小跳一下；HP 很低時動作變慢、會發抖
    const ph = (t + i * 1.7) % (m.low ? 5 : 3.4);
    const hop = !m.low && ph < 0.32 ? -Math.round(Math.sin((ph / 0.32) * Math.PI) * 2) : 0;
    const shiver = m.low && ph < 0.4 ? Math.round(Math.sin(t * 50)) : 0;
    const sy = m.y + Math.round(Math.sin(t * (m.low ? 1.4 : 2.4) + i) * 1.2) + hop;
    const sxx = sx + shiver;
    // 登場：前半段是白色剪影
    const white = (m.flash > 0 && Math.floor(m.flash * 20) % 2 === 0) || (m.enter !== undefined && m.enter < 0.55);
    const rc = recolorOf(m.form, m.mutant);
    if (m.aura) {
      // 光環：脈動的發光外框＋上升的能量粒子
      const n = spriteSize(f.sprite) * m.scale, pulse = 0.6 + 0.3 * Math.sin(t * 4 + i);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1]]) {
        drawSprite(ctx, f.sprite, PAL[f.pal], Math.round(sx) + ox, Math.round(sy) + oy, { f: fr, flip: m.flip, alpha: m.alpha * pulse, scale: m.scale, tint: m.aura });
      }
      if (Math.random() < dt * 14) parts.push({ x: sx + n * (0.15 + Math.random() * 0.7), y: sy + n * (0.5 + Math.random() * 0.4), vx: (Math.random() - 0.5) * 6, vy: -18 - Math.random() * 16, life: 0.9, max: 0.9, color: Math.random() < 0.5 ? m.aura : '#ffffff', size: Math.random() < 0.3 ? 2 : 1 });
    }
    drawSprite(ctx, f.sprite, PAL[f.pal], Math.round(sxx), Math.round(sy), { f: fr, flip: m.flip, alpha: m.alpha, scale: m.scale, tint: white ? '#ffffff' : m.tint, recolor: rc });
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
  if (bfx.field) drawFieldFront(ctx, t, dt, bfx.field, parts);
  ctx.restore();
  // 全畫面閃光（效果絕佳、暴擊、狂暴）
  if (!fx.reduce && (bfx.flash ?? 0) > 0) { ctx.globalAlpha = Math.min(0.55, bfx.flash!); ctx.fillStyle = bfx.flashColor ?? '#ffffff'; ctx.fillRect(-view.bleed, 0, W + view.bleed * 2, H); ctx.globalAlpha = 1; }
}

// ── 場地特效 ──
function drawFieldBack(ctx: CanvasRenderingContext2D, t: number, id: string) {
  const L = -view.bleed, WW = W + view.bleed * 2;
  ctx.save();
  if (id === 'storm') { ctx.globalAlpha = 0.28; ctx.fillStyle = '#141a3a'; ctx.fillRect(L, 0, WW, H); }
  if (id === 'abyss') { ctx.globalAlpha = 0.42; ctx.fillStyle = '#120a2a'; ctx.fillRect(L, 0, WW, H); ctx.globalAlpha = 0.35; ctx.fillStyle = '#05020f'; for (let y = 0; y < H; y++) { const e = Math.max(0, 40 - y) + Math.max(0, y - 110); if (e) ctx.fillRect(L, y, WW, 1); } }
  if (id === 'lava') { ctx.globalAlpha = 0.24 + Math.sin(t * 2) * 0.05; ctx.fillStyle = '#ff4a1a'; ctx.fillRect(L, 60, WW, H - 60); ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffb03a'; for (let x = L; x < W + view.bleed; x += 3) { if (Math.sin(x * 0.3 + t * 1.5) > 0.6) ctx.fillRect(x, 70 + ((x * 7) % 70), 2, 1); } }
  if (id === 'tide') { // 水位上漲：波浪線在畫面下半部起伏
    ctx.globalAlpha = 0.2; ctx.fillStyle = '#3a9be0'; ctx.fillRect(L, 98, WW, H - 98);
    for (const [yy, a] of [[98, 0.8], [112, 0.5], [126, 0.4]] as const) { ctx.globalAlpha = a; ctx.fillStyle = '#d8f4ff'; for (let x = L; x < W + view.bleed; x += 2) { const y = yy + Math.round(Math.sin(x * 0.09 + t * 2.2 + yy) * 2); ctx.fillRect(x, y, 2, 1); } }
  }
  if (id === 'aurora') { // 天空的極光帶
    for (let b = 0; b < 3; b++) {
      ctx.globalAlpha = 0.38 + Math.sin(t + b) * 0.08; ctx.fillStyle = ['#7fffd0', '#7fd8ff', '#c89aff'][b];
      for (let x = L; x < W + view.bleed; x += 2) { const y = 6 + b * 8 + Math.round(Math.sin(x * 0.04 + t * 0.8 + b) * 5); ctx.fillRect(x, y, 2, 5); }
    }
  }
  if (id === 'grid') { ctx.globalAlpha = 0.16; ctx.fillStyle = '#3affd0'; for (let x = (Math.floor(L / 16) * 16) + Math.round(t * 6) % 16; x < W + view.bleed; x += 16) ctx.fillRect(x, 50, 1, H - 50); for (let y = 54 + Math.round(t * 4) % 12; y < H; y += 12) ctx.fillRect(L, y, WW, 1); }
  if (id === 'grove') { ctx.globalAlpha = 0.16; ctx.fillStyle = '#7ee36a'; ctx.fillRect(L, 0, WW, H); ctx.globalAlpha = 0.3; ctx.fillStyle = '#fff6b0'; for (let i = 0; i < 4; i++) { const x = L + 30 + i * 70 + Math.round(Math.sin(t * 0.5 + i) * 6); for (let y = 0; y < 90; y += 2) ctx.fillRect(x + y * 0.3, y, 6, 2); } }
  ctx.restore();
}
function drawFieldFront(ctx: CanvasRenderingContext2D, t: number, dt: number, id: string, parts: Particle[]) {
  const L = -view.bleed, WW = W + view.bleed * 2, k = partMul();
  const spawn = (rate: number, mk: () => Particle) => { if (Math.random() < dt * rate * k) parts.push(mk()); };
  if (id === 'storm') {
    ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = '#c8d8ff';
    for (let i = 0; i < 40 * k; i++) { const x = (i * 37 + Math.floor(t * 220)) % (WW + 40) + L - 20, y = (i * 53 + Math.floor(t * 260)) % H; ctx.fillRect(x, y, 1, 4); }
    ctx.restore();
    if (!fx.reduce && (t % 4.3) < 0.08) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff8c0'; ctx.fillRect(L, 0, WW, H); ctx.globalAlpha = 1; }
  }
  if (id === 'fog') {
    ctx.save();
    for (let b = 0; b < 4; b++) { ctx.globalAlpha = 0.18; ctx.fillStyle = '#e4ecf6'; const y = 40 + b * 22, x = ((t * (6 + b * 3) + b * 70) % (WW + 120)) + L - 120; ctx.fillRect(Math.round(x), y, 120, 10); ctx.fillRect(Math.round(x) + 14, y - 3, 90, 16); }
    ctx.restore();
  }
  if (id === 'lava') spawn(26, () => ({ x: L + Math.random() * WW, y: H, vx: (Math.random() - 0.5) * 6, vy: -18 - Math.random() * 20, life: 2, max: 2, color: Math.random() < 0.5 ? '#ffb03a' : '#ff5a1a', size: 1 }));
  if (id === 'grove') spawn(10, () => ({ x: L + Math.random() * WW, y: -2, vx: 8 + Math.random() * 8, vy: 10 + Math.random() * 8, life: 6, max: 6, color: Math.random() < 0.5 ? '#7ee36a' : '#ffd0e8', size: 2 }));
  if (id === 'abyss') spawn(12, () => ({ x: L + Math.random() * WW, y: 60 + Math.random() * 80, vx: 0, vy: -4 - Math.random() * 4, life: 3, max: 3, color: Math.random() < 0.6 ? '#7a5ad0' : '#c89aff', size: 1 }));
  if (id === 'aurora') spawn(4, () => ({ x: L + Math.random() * WW, y: Math.random() * 40, vx: 0, vy: 3, life: 2.5, max: 2.5, color: '#ffffff', size: 1 }));
  if (id === 'grid') spawn(8, () => ({ x: L + Math.random() * WW, y: 50 + Math.random() * 90, vx: 0, vy: 0, life: 0.5, max: 0.5, color: Math.random() < 0.5 ? '#3affd0' : '#ffffff', size: 2 }));
  if (id === 'tide') spawn(5, () => ({ x: L + Math.random() * WW, y: 112 + Math.random() * 30, vx: 0, vy: -8, life: 1.2, max: 1.2, color: '#d8f4ff', size: 1 }));
}

export function burst(parts: Particle[], x: number, y: number, kind: 'hit' | 'splash' | 'buff' | 'heal' | 'beam' | 'faint', elem: Elem | null) {
  const col = elem ? ELEM[elem].color : '#ffffff';
  const n = Math.max(4, Math.round((kind === 'faint' ? 34 : 18) * partMul()));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 24 + Math.random() * 56;
    if (kind === 'buff') parts.push({ x: x - 14 + Math.random() * 28, y: y + 12, vx: 0, vy: -26 - Math.random() * 20, life: 0.8, max: 0.8, color: i % 2 ? '#ffcf4a' : '#ffffff', size: 2 });
    else if (kind === 'heal') parts.push({ x: x - 14 + Math.random() * 28, y: y + 12, vx: 0, vy: -18 - Math.random() * 18, life: 0.9, max: 0.9, color: i % 2 ? '#7ee36a' : '#d6ffd0', size: i % 3 ? 1 : 2 });
    else if (kind === 'splash') parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, g: 140, life: 0.6, max: 0.6, color: i % 3 ? col : '#ffffff', size: 2 });
    else if (kind === 'faint') parts.push({ x: x - 16 + Math.random() * 32, y: y - 16 + Math.random() * 32, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 30, life: 1, max: 1, color: i % 2 ? '#5ff1e0' : '#ffffff', size: 1 + (i % 2) });
    else parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4, max: 0.4, color: i % 2 ? col : '#ffffff', size: i % 4 ? 1 : 2 });
  }
  if ((kind === 'hit' || kind === 'splash' || kind === 'beam') && elem) elemBurst(parts, x, y, elem);
}
/** 屬性專屬的命中特效 */
function elemBurst(parts: Particle[], x: number, y: number, e: Elem) {
  const n = Math.max(3, Math.round(14 * partMul())), r = Math.random;
  for (let i = 0; i < n; i++) {
    switch (e) {
      case 'fire': parts.push({ x: x - 10 + r() * 20, y: y + 4 - r() * 8, vx: (r() - 0.5) * 20, vy: -30 - r() * 40, life: 0.7, max: 0.7, color: ['#ffef7a', '#ffb03a', '#ff5a1a'][i % 3], size: i % 3 ? 1 : 2 }); break;
      case 'water': parts.push({ x, y, vx: (r() - 0.5) * 90, vy: -40 - r() * 50, g: 220, life: 0.8, max: 0.8, color: i % 2 ? '#7fd0ff' : '#ffffff', size: 2 }); break;
      case 'elec': { const a = r() * Math.PI * 2; for (let k = 0; k < 4; k++) parts.push({ x: x + Math.cos(a) * k * 4 + (r() - 0.5) * 3, y: y + Math.sin(a) * k * 4 + (r() - 0.5) * 3, vx: 0, vy: 0, life: 0.18 + k * 0.03, max: 0.3, color: k % 2 ? '#fff6a0' : '#ffd21a', size: 1 }); break; }
      case 'ice': parts.push({ x: x - 14 + r() * 28, y: y - 14 + r() * 20, vx: (r() - 0.5) * 30, vy: 10 + r() * 20, life: 0.9, max: 0.9, color: i % 2 ? '#dff8ff' : '#7fd8e8', size: 2 }); break;
      case 'grass': parts.push({ x, y, vx: (r() - 0.5) * 80, vy: -20 - r() * 30, g: 40, life: 1, max: 1, color: i % 2 ? '#7ee36a' : '#3aa84a', size: 2 }); break;
      case 'rock': parts.push({ x, y, vx: (r() - 0.5) * 100, vy: -50 - r() * 40, g: 260, life: 0.8, max: 0.8, color: i % 2 ? '#a08060' : '#6c5f50', size: 2 + (i % 2) }); break;
      case 'dark': parts.push({ x: x - 12 + r() * 24, y: y - 8 + r() * 16, vx: (r() - 0.5) * 14, vy: -6 - r() * 10, life: 1, max: 1, color: i % 2 ? '#5b3a9a' : '#2a1a4a', size: 3 }); break;
      case 'data': parts.push({ x: x - 16 + r() * 32, y: y - 16 + r() * 32, vx: 0, vy: 0, life: 0.2 + r() * 0.4, max: 0.6, color: ['#3affd0', '#ffffff', '#1fae9a'][i % 3], size: 2 + (i % 2) }); break;
      case 'fly': parts.push({ x: x - 20 + r() * 10, y: y - 12 + r() * 24, vx: 90 + r() * 60, vy: 0, life: 0.3, max: 0.3, color: '#ffffff', size: 1 }); break;
    }
  }
}

// ── 釣魚 ──
export type FishPhase = 'choose' | 'cast' | 'flying' | 'wait' | 'nibble' | 'bite' | 'hooked';
export interface ShadowView { x: number; size: 1 | 2 | 3 }
export interface FishView { phase: FishPhase; power: number; castT: number; bobX: number; shadows: ShadowView[]; sel: number; spot: string; theme?: ThemeId; ripple?: number }
const BOAT = { x: 46, y: 92 };
// 釣客：像素畫模板（每個字元一格）。坐在船上、面向右邊、手握釣竿
const FISHER = [
  '....oooooo......',
  '...oHHHHHHo.....',
  '..oHHLHHHHHo....',
  '..oHHHHHHHHo....',
  'oooobbbbbbboooo.',
  'ohhhhhhhhhhhhhho',
  '.oooKSSSSSSoooo.',
  '...oKSSSSeSo....',
  '...oKSSSSSSSo...',
  '...oKsSScSSo....',
  '....osSSSSo.....',
  '....ooYYYoo.....',
  '...oYYLYYYYo....',
  '..oYYLYYYYYYoo..',
  '..oYLYYYyYYSSSo.',
  '..oYYYYyyoooSSo.',
  '..oYYYYYyo..oo..',
  '..oYYYYYyo......',
  '..oyYYYYyo......',
  '..oyyyyyyo......',
  '..oPPPPPPPPPo...',
  '..oPPPPPPPPPPo..',
  '..oppppppppBBo..',
  '...ooooooooBBo..',
];
const FISHER_COL: Record<string, string> = {
  o: '#1b1a2e', H: '#e8c26a', h: '#b8903e', L: '#fff3b0', b: '#d23a5a', K: '#5a3a24', S: '#ffd9b8', s: '#e8a98a', e: '#1b1a2e', c: '#ff9a9a',
  Y: '#ffcf4a', y: '#d9962a', P: '#2a3a6a', p: '#1e2a50', B: '#3a2a20',
};
const fisherCanvas = (blink: boolean) => cached(`fisher-${blink}`, 16, FISHER.length, (x) => {
  FISHER.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === '.') return;
    x.fillStyle = blink && ch === 'e' ? FISHER_COL.S : ch === 'L' && r >= 11 ? '#fff09a' : FISHER_COL[ch];
    x.fillRect(c, r, 1, 1);
  }));
  if (blink) { x.fillStyle = FISHER_COL.o; x.fillRect(9, 8, 1, 1); }
});
/** 釣竿握把的位置（相對於船） */
export const HAND = { dx: 14, dy: -14 };
function boat(ctx: CanvasRenderingContext2D, bob: number) {
  const x = BOAT.x, y = BOAT.y + bob;
  // 釣客（先畫，船身會蓋住腳）
  const blink = (performance.now() / 1000) % 4 < 0.14;
  ctx.drawImage(fisherCanvas(blink), x + 1, y - 28);
  // 船身：深色外框、木板、亮邊
  ctx.fillStyle = '#2a160c'; ctx.fillRect(x - 33, y - 5, 70, 1); ctx.fillRect(x - 33, y - 4, 1, 4); ctx.fillRect(x + 36, y - 4, 1, 4);
  ctx.fillRect(x - 31, y + 3, 1, 3); ctx.fillRect(x + 34, y + 3, 1, 3); ctx.fillRect(x - 28, y + 6, 1, 2); ctx.fillRect(x + 31, y + 6, 1, 2); ctx.fillRect(x - 24, y + 8, 52, 1);
  ctx.fillStyle = '#c47a3e'; ctx.fillRect(x - 32, y - 4, 68, 1);
  ctx.fillStyle = '#8a5530'; ctx.fillRect(x - 32, y - 3, 68, 3);
  ctx.fillStyle = '#6a3c20'; ctx.fillRect(x - 30, y, 64, 3); ctx.fillRect(x - 27, y + 3, 58, 3); ctx.fillRect(x - 23, y + 6, 50, 2);
  ctx.fillStyle = '#4a2814'; ctx.fillRect(x - 27, y + 5, 58, 1); ctx.fillRect(x - 23, y + 7, 50, 1);
  ctx.fillStyle = '#e8e0c8'; ctx.fillRect(x - 26, y + 1, 54, 1);
  ctx.fillStyle = '#d23a5a'; ctx.fillRect(x - 24, y + 2, 4, 1); ctx.fillRect(x + 24, y + 2, 4, 1);
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
  if (spot === 'none') return;
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
  drawSea(ctx, t, v.theme ?? 'day');
  spotDecor(ctx, v.spot, t);
  const bob = Math.round(Math.sin(t * 1.5));
  // 魚群的漣漪：拋竿的目標（看不出底下是大魚還小魚）
  if (v.ripple && (v.phase === 'choose' || v.phase === 'cast')) {
    const rx = Math.round(v.ripple), ry = 88;
    // 水面下有東西：一團固定大小的暗影（看不出大小）
    ctx.globalAlpha = 0.28; pxEllipse(ctx, rx, ry + 1, 12, 4, () => '#06204a'); ctx.globalAlpha = 1;
    for (let k = 0; k < 3; k++) {
      const r = ((t * 7 + k * 6) % 18) + 3, a = 1 - r / 21;
      ctx.globalAlpha = Math.min(1, a * 1.3);
      for (let i = 0; i < 48; i++) { const an = (i / 48) * Math.PI * 2; if (i % 4 === 0) continue; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(rx + Math.cos(an) * r), Math.round(ry + Math.sin(an) * r * 0.32), 2, 1); }
    }
    ctx.globalAlpha = 1;
    if (Math.floor(t * 3) % 2) { ctx.fillStyle = '#e8fbff'; ctx.fillRect(rx - 4, ry - 3, 1, 1); ctx.fillRect(rx + 3, ry - 5, 1, 1); }
  }
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
  const hx = BOAT.x + HAND.dx, hy = BOAT.y + HAND.dy + bob;
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
    drawSprite(ctx, f.sprite, PAL[f.pal], p.x - n / 2, p.y - n + 3 + jump, { f: Math.floor(t * 3 + i) % 2, alpha: i === sel ? 1 : 0.85, recolor: recolorOf(id) });
  });
}

// ── 港口：棧橋、燈塔、棲息灣裡游動的夥伴 ──
export function drawPort(ctx: CanvasRenderingContext2D, t: number, bay: { id: string; mutant?: boolean }[]) {
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
  // 小尺寸、分兩排在海面上漂（異變個體用異變的顏色）
  bay.slice(0, 10).forEach(({ id, mutant }, i) => {
    const f = FORMS[id]; if (!f) return;
    const n = Math.ceil(spriteSize(f.sprite) / 2);
    const x = 64 + (i % 5) * 38 + (i >= 5 ? 19 : 0) + Math.sin(t * 0.5 + i * 1.7) * 6, y = 70 + (i >= 5 ? 22 : 0) + Math.sin(t * 1.3 + i) * 1.5;
    const flip = Math.cos(t * 0.5 + i * 1.7) < 0;
    shadowMini(ctx, x, y + n / 2 - 1, n);
    drawSpriteMini(ctx, f.sprite, PAL[f.pal], Math.round(x - n / 2), Math.round(y - n / 2), { f: Math.floor(t * 3 + i) % 2, flip, recolor: recolorOf(id, mutant) });
  });
}
function shadowMini(ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number) {
  ctx.fillStyle = 'rgba(6,30,70,0.28)'; ctx.fillRect(Math.round(cx - n * 0.35), Math.round(cy), Math.round(n * 0.7), 1);
}

// ── 海圖：俯視的航線 ──
export type NodeKind = 'fish' | 'elite' | 'treasure' | 'camp' | 'shop' | 'event' | 'portal' | 'boss' | 'crew';
export interface ChartNode { kind: NodeKind }
export function chartPos(step: number, idx: number, n: number): [number, number] {
  const x = 16 + step * 25, ys = n === 1 ? [60] : n === 2 ? [42, 80] : [30, 60, 90];
  return [x, ys[idx] + (step % 2 ? 4 : -2)];
}
const CHART_COL: Record<string, { sea: string[]; land: [string, string]; sand: string; foam: string }> = {
  day: { sea: ['#0a3f7a', '#1676b8', '#3fb6d8', '#8fe4ee'], land: ['#5fae5a', '#4c9a4c'], sand: '#f2dc9c', foam: '#e8fbff' },
  ice: { sea: ['#1a4a7a', '#3a7ab0', '#8ac4e4', '#d8f0fa'], land: ['#ffffff', '#e4f0fa'], sand: '#a8d0ec', foam: '#ffffff' },
  lava: { sea: ['#140606', '#3a1210', '#7a2a18', '#c8501e'], land: ['#2a1a1a', '#3a2424'], sand: '#ff7a1a', foam: '#ffb070' },
  forest: { sea: ['#063028', '#0e5a4a', '#2a9a7a', '#7ad8b0'], land: ['#2a7a3a', '#1e6a30'], sand: '#a8d890', foam: '#e8fff0' },
  void: { sea: ['#06020e', '#12062a', '#2a1050', '#6a3a9a'], land: ['#2a1a44', '#1e1034'], sand: '#8a5ad0', foam: '#c89aff' },
  core: { sea: ['#020e1e', '#04304a', '#0a6a8a', '#2ac8d8'], land: ['#164060', '#1a4a6a'], sand: '#5ff1ff', foam: '#8affff' },
  cyber: { sea: ['#04021a', '#120a3a', '#3a1a8a', '#ff4ac8'], land: ['#1a1044', '#24164e'], sand: '#5ff1ff', foam: '#ffb0f0' },
  abyss: { sea: ['#010208', '#04081a', '#0a1230', '#1a2a5a'], land: ['#0e1426', '#121a30'], sand: '#3a5a9a', foam: '#5f8ad0' },
};
function chartBase(route: ChartNode[][], seed: number, theme = 'day') {
  const C = CHART_COL[theme] ?? CHART_COL.day;
  return cached('chart-' + seed + theme, W, H, (x) => {
    const img = x.createImageData(W, H), r = seeded(seed % 9973);
    const isl: { cx: number; cy: number; rr: number }[] = [];
    route.forEach((opts, i) => opts.forEach((_, j) => { const [cx, cy] = chartPos(i, j, opts.length); isl.push({ cx, cy, rr: i === route.length - 1 ? 11 : 6 + r() * 2 }); }));
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      let dmin = 99;
      for (const s2 of isl) dmin = Math.min(dmin, Math.hypot(xx - s2.cx, (y - s2.cy) * 1.3) - s2.rr);
      const shallow = Math.max(0, Math.min(1, 1 - dmin / 22));
      const deep = 0.5 + 0.5 * Math.sin(xx * 0.03 + y * 0.05) * Math.cos(y * 0.04 - xx * 0.01);
      let c = ditherGrad(C.sea, Math.min(1, shallow * 0.85 + deep * 0.2), xx, y, 10);
      if (dmin < 0) c = dmin < -3 ? (BAYER[y & 3][xx & 3] > 7 ? hex(C.land[0]) : hex(C.land[1])) : hex(C.sand);
      else if (dmin < 1.2) c = hex(C.foam);
      const i = (y * W + xx) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const cx = 240, cy = 126;
    x.fillStyle = 'rgba(232,251,255,0.6)';
    for (let a2 = 0; a2 < 40; a2++) { const an = (a2 / 40) * Math.PI * 2; x.fillRect(Math.round(cx + Math.cos(an) * 8), Math.round(cy + Math.sin(an) * 8), 1, 1); }
    x.fillStyle = '#ff5a6e'; for (let i = 0; i < 6; i++) x.fillRect(cx, cy - 7 + i, 1, 1);
  });
}
const NODE_COL: Record<NodeKind, string> = { fish: '#f4f8ff', elite: '#c58cff', treasure: '#ffcf4a', camp: '#ff9a3a', shop: '#7ee3c8', event: '#9ad8ff', portal: '#c89aff', boss: '#e8304a', crew: '#ff7a8a' };
function nodeIcon(ctx: CanvasRenderingContext2D, k: NodeKind, x: number, y: number) {
  ctx.fillStyle = '#141a33'; ctx.fillRect(x - 6, y - 14, 13, 11);
  ctx.fillStyle = NODE_COL[k]; ctx.fillRect(x - 5, y - 13, 11, 9);
  ctx.fillStyle = k === 'boss' || k === 'elite' ? '#ffffff' : '#141a33';
  if (k === 'fish' || k === 'elite') { ctx.fillRect(x - 3, y - 9, 5, 2); ctx.fillRect(x - 2, y - 10, 3, 4); ctx.fillRect(x + 2, y - 10, 2, 1); ctx.fillRect(x + 2, y - 7, 2, 1); }
  if (k === 'elite') { ctx.fillStyle = '#ffcf4a'; ctx.fillRect(x - 4, y - 12, 1, 1); ctx.fillRect(x + 4, y - 12, 1, 1); }
  if (k === 'camp') { ctx.fillRect(x, y - 12, 1, 1); ctx.fillRect(x - 1, y - 11, 3, 1); ctx.fillRect(x - 2, y - 10, 5, 1); ctx.fillRect(x - 3, y - 9, 7, 2); }
  if (k === 'treasure') { ctx.fillRect(x - 3, y - 11, 7, 6); ctx.fillStyle = '#ffcf4a'; ctx.fillRect(x - 2, y - 10, 5, 2); ctx.fillRect(x, y - 8, 1, 2); }
  if (k === 'portal') { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 12, 3, 7); ctx.fillStyle = '#5ff1ff'; ctx.fillRect(x, y - 11, 1, 5); ctx.fillStyle = '#141a33'; ctx.fillRect(x - 3, y - 9, 1, 1); ctx.fillRect(x + 3, y - 9, 1, 1); }
  if (k === 'event') { ctx.fillRect(x - 2, y - 12, 5, 1); ctx.fillRect(x + 2, y - 11, 1, 2); ctx.fillRect(x, y - 9, 2, 1); ctx.fillRect(x, y - 8, 1, 1); ctx.fillRect(x, y - 6, 1, 1); }
  if (k === 'shop') { ctx.fillRect(x - 3, y - 11, 7, 1); ctx.fillRect(x - 2, y - 10, 1, 4); ctx.fillRect(x + 2, y - 10, 1, 4); ctx.fillRect(x - 3, y - 7, 7, 1); }
  // 船隊：小旗子＋船身
  if (k === 'crew') { ctx.fillRect(x - 1, y - 12, 1, 5); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y - 12, 3, 2); ctx.fillStyle = '#141a33'; ctx.fillRect(x - 4, y - 7, 9, 1); ctx.fillRect(x - 3, y - 6, 7, 1); }
  if (k === 'boss') { ctx.fillRect(x - 3, y - 11, 7, 4); ctx.fillStyle = '#e8304a'; ctx.fillRect(x - 2, y - 10, 2, 2); ctx.fillRect(x + 1, y - 10, 2, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 7, 1, 2); ctx.fillRect(x, y - 7, 1, 2); ctx.fillRect(x + 2, y - 7, 1, 2); }
}
function drawFog(ctx: CanvasRenderingContext2D, t: number, fx: number, theme = 'day') {
  const dark = theme === 'lava' || theme === 'void' || theme === 'core' || theme === 'cyber' || theme === 'abyss';
  const FOG: Record<string, [string, string]> = { cyber: ['#1a1040', '#120a30'], abyss: ['#080c1a', '#04060e'], lava: ['#3a2622', '#2a1a18'], void: ['#1e1030', '#140a22'], core: ['#0a2a40', '#061c30'], forest: ['#e0f0e0', '#c4dcc4'] };
  const [f1, f2] = FOG[theme] ?? ['#e4edf8', '#c6d4e8'];
  const fog = hex(f1), fog2 = hex(f2);
  for (let y = 0; y < H; y++) {
    const wave = Math.sin(y * 0.18 + t * 0.6) * 3 + Math.sin(y * 0.05 - t * 0.3) * 4;
    const x0 = Math.round(fx + wave);
    for (let x = Math.max(0, x0 - 10); x < W + view.bleed; x++) {
      const d = x - x0;
      if (d < 0 && BAYER[y & 3][x & 3] > (d + 10) * 1.6) continue;
      const n = Math.sin(x * 0.07 + t * 0.35) * Math.sin(y * 0.09 - t * 0.2) + Math.sin((x - y) * 0.035 + t * 0.25) * 0.6;
      const c = n > 0.55 + (BAYER[y & 3][x & 3] / 16) * 0.3 ? fog2 : fog;
      ctx.fillStyle = css(c, d < 0 ? 0.8 : 1); ctx.fillRect(x, y, 1, 1);
    }
  }
  // 霧上的雲團
  for (let k = 0; k < 6; k++) {
    const cx = fx + 14 + ((k * 37 + t * 3) % Math.max(20, W + view.bleed - fx)), cy = 14 + k * 22;
    ctx.drawImage(cloudSprite(dark ? (theme as ThemeId) : 'day', k % 5), Math.round(cx - 30), cy);
  }
}

export function drawChart(ctx: CanvasRenderingContext2D, t: number, route: ChartNode[][], station: number, picked: number | null, path: number[], seed: number, theme = 'day') {
  drawWideBg(ctx, chartBase(route, seed, theme));
  const b = view.bleed;
  ctx.fillStyle = 'rgba(232,251,255,0.35)';
  for (let i = 0; i < 30; i++) { const x = ((i * 53 + t * 5) % (W + b * 2 + 10)) - 5 - b, y = (i * 29) % H; ctx.fillRect(Math.round(x), y, 3, 1); ctx.fillRect(Math.round(x) + 3, y - 1, 2, 1); }
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
  if (station < route.length - 1) drawFog(ctx, t, chartPos(station + 1, 0, 1)[0] - 13, theme);
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

// 給美術匯出工具用：取得各場景的靜態圖層
export const sceneLayers = {
  backdrop: (id: ThemeId) => backdrop(id),
  shoal: (th: string) => shoal(th),
  reef: (th: string) => reef(th),
};

// ── 招募抽卡：像釣魚一樣拋竿，釣竿顏色代表稀有度 ──
export type GachaTier = 'broken' | 'N' | 'B' | 'A' | 'S' | 'SSR';
export const TIER_COLOR: Record<GachaTier, string> = { broken: '#7a6a5a', N: '#e8d8a8', B: '#5fdc6a', A: '#4aa8ff', S: '#ff4a5a', SSR: '#ffcf4a' };
export type GachaPhase = 'idle' | 'cast' | 'wait' | 'turn' | 'bite' | 'reveal' | 'miss';
export interface GachaView { phase: GachaPhase; since: number; rod: GachaTier; pool: GachaTier | null; form: string | null; mutant: boolean; parts: Particle[] }

const POOL = { x: 176, y: 94 }; // 夕陽海面的海平線在 74，水池要在海面上
function stepParts(ctx: CanvasRenderingContext2D, parts: Particle[], dt: number) {
  for (const p of parts) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy += p.g * dt;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.4));
    ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
}

export function drawGacha(ctx: CanvasRenderingContext2D, t: number, dt: number, v: GachaView) {
  drawSea(ctx, t, 'sunset');
  const k = t - v.since, bob = Math.round(Math.sin(t * 1.5));
  // 變色的水池：光暈＋往上冒的粒子
  if (v.pool) {
    const col = TIER_COLOR[v.pool], pulse = 0.55 + Math.sin(t * 6) * 0.2;
    ctx.globalAlpha = pulse * 0.55;
    pxEllipse(ctx, POOL.x, POOL.y + 2, 26, 7, (x, y, nx, ny) => (nx * nx + ny * ny > 0.55 || (x + y) % 2 ? col : null));
    ctx.globalAlpha = 1;
    if (Math.random() < dt * 40) v.parts.push({ x: POOL.x - 22 + Math.random() * 44, y: POOL.y + 2, vx: (Math.random() - 0.5) * 6, vy: -16 - Math.random() * 22, life: 1, max: 1, color: Math.random() < 0.6 ? col : '#ffffff', size: Math.random() < 0.3 ? 2 : 1 });
  }
  boat(ctx, bob);
  // 釣竿：顏色＝稀有度
  const hx = BOAT.x + HAND.dx, hy = BOAT.y + HAND.dy + bob;
  const casting = v.phase === 'cast' ? Math.min(1, k / 0.5) : 1;
  const tipX = hx + 42 - (v.phase === 'cast' && k < 0.25 ? 40 : 0) * (1 - casting), tipY = hy - 34;
  const col = TIER_COLOR[v.rod];
  if (v.rod === 'SSR') { // 金色光芒
    ctx.globalAlpha = 0.35 + Math.sin(t * 5) * 0.15;
    for (const o of [-2, -1, 1, 2]) pxLine(ctx, hx + o, hy, tipX + o, tipY, '#fff2b0');
    ctx.globalAlpha = 1;
    if (Math.random() < dt * 30) { const q = Math.random(); v.parts.push({ x: hx + (tipX - hx) * q, y: hy + (tipY - hy) * q, vx: (Math.random() - 0.5) * 10, vy: -8 - Math.random() * 10, life: 0.8, max: 0.8, color: Math.random() < 0.5 ? '#ffcf4a' : '#ffffff', size: 1 }); }
  }
  if (v.rod === 'S' && Math.random() < dt * 26) { const q = Math.random(); v.parts.push({ x: hx + (tipX - hx) * q, y: hy + (tipY - hy) * q, vx: (Math.random() - 0.5) * 14, vy: -10 - Math.random() * 14, life: 0.7, max: 0.7, color: Math.random() < 0.6 ? '#ff4a5a' : '#ffb0a0', size: Math.random() < 0.3 ? 2 : 1 }); }
  pxLine(ctx, hx, hy, tipX, tipY, '#2a1a10');
  if (v.rod === 'broken') { // 破損：中間斷了一截，用膠帶纏著
    const mx = Math.round((hx + tipX) / 2), my = Math.round((hy + tipY) / 2);
    pxLine(ctx, hx + 1, hy, mx - 2, my + 2, col); pxLine(ctx, mx + 3, my - 3, tipX + 1, tipY, col);
    ctx.fillStyle = '#d8d0b8'; ctx.fillRect(mx - 1, my - 2, 4, 3);
  } else pxLine(ctx, hx + 1, hy, tipX + 1, tipY, col);
  ctx.fillStyle = col; ctx.fillRect(tipX - 1, tipY - 1, 3, 3);
  // 釣線與浮標
  if (v.phase !== 'idle') {
    let bx = POOL.x, by = POOL.y - 4;
    if (v.phase === 'cast') { const q = Math.min(1, k / 0.6); bx = tipX + (POOL.x - tipX) * q; by = tipY + (POOL.y - 4 - tipY) * q - Math.sin(q * Math.PI) * 30; }
    if (v.phase === 'bite') by += Math.floor(t * 12) % 2 ? 3 : 1;
    if (v.phase !== 'reveal' && v.phase !== 'miss') {
      ctx.globalAlpha = 0.8; pxLine(ctx, tipX, tipY, bx + 1, by, '#ffffff'); ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff3a4a'; ctx.fillRect(bx, by, 3, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by + 2, 3, 1);
    }
    if (v.phase === 'miss') { // 線斷了
      ctx.globalAlpha = Math.max(0, 1 - k); pxLine(ctx, tipX, tipY, tipX + 10, tipY + 20 + k * 20, '#ffffff'); ctx.globalAlpha = 1;
    }
  }
  // 釣上來的生物：從水裡躍出，背後有稀有度光環
  if (v.phase === 'reveal' && v.form) {
    const f = FORMS[v.form], n = spriteSize(f.sprite), q = Math.min(1, k / 0.7);
    const cx = POOL.x + (128 - POOL.x) * q, cy = POOL.y + (50 - POOL.y) * q - Math.sin(q * Math.PI) * 20;
    const glow = TIER_COLOR[v.pool ?? v.rod];
    ctx.globalAlpha = 0.25 + q * 0.3;
    for (let r = 30; r > 8; r -= 4) pxCircle(ctx, Math.round(cx), Math.round(cy), r, r % 8 ? glow : '#ffffff');
    ctx.globalAlpha = 1;
    drawSprite(ctx, f.sprite, PAL[f.pal], Math.round(cx - n / 2), Math.round(cy - n / 2), { f: Math.floor(t * 3) % 2, recolor: recolorOf(v.form, v.mutant) });
    if (k < 0.1) for (let i = 0; i < 24; i++) { const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 50; v.parts.push({ x: POOL.x, y: POOL.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, g: 120, life: 0.8, max: 0.8, color: i % 3 ? '#e8fbff' : glow, size: 2 }); }
  }
  stepParts(ctx, v.parts, dt);
}
