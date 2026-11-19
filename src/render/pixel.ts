// 48×48 像素生物繪製器：用幾何圖元畫出色塊，再自動加上明暗與外框。

export const SIZE = 48;

export type PalKey = 'o' | 'd' | 'm' | 'l' | 'b' | 'a' | 'a2' | 'w' | 'k' | 'h' | 'k2' | 'tr';
export type Palette = Record<PalKey, string>;

export const PAL = {
  water: { o: '#0b1a3a', d: '#1f5fa8', m: '#3d9be9', l: '#8fd0ff', b: '#d6f1ff', a: '#5ff1e0', a2: '#1aa8a0', w: '#ffffff', k: '#0b1a3a', h: '#ff9bb8', k2: '#2a4466', tr: '#7a4a24' },
  fire: { o: '#2a0c0c', d: '#b8331e', m: '#f0602f', l: '#ffa66b', b: '#ffe0bd', a: '#ffd23f', a2: '#ff8a1f', w: '#ffffff', k: '#2a0c0c', h: '#ff9bb8', k2: '#4a2a2a', tr: '#7a4a24' },
  grass: { o: '#0d2614', d: '#2e7d3a', m: '#56b85a', l: '#a3e58a', b: '#e8f7c8', a: '#2fd17a', a2: '#c9f06b', w: '#ffffff', k: '#0d2614', h: '#ff9bb8', k2: '#2e4a2a', tr: '#7a4a24' },
  ice: { o: '#0e2238', d: '#4f8fb8', m: '#9bd8f0', l: '#e4f8ff', b: '#ffffff', a: '#c8f4ff', a2: '#6fb8e8', w: '#ffffff', k: '#0e2238', h: '#ffb6d0', k2: '#36506a', tr: '#6a5a7a' },
  dark: { o: '#07050f', d: '#2a1a4f', m: '#5a3a9a', l: '#9a7ae0', b: '#c7b8f0', a: '#ff4fd8', a2: '#7a5cff', w: '#ffffff', k: '#07050f', h: '#ff4fd8', k2: '#1b1230', tr: '#3a2a2a' },
  data: { o: '#06231f', d: '#0f6b5c', m: '#1fc2a3', l: '#8affea', b: '#e0fff8', a: '#ffe95a', a2: '#2a9dff', w: '#ffffff', k: '#06231f', h: '#ffe95a', k2: '#0b3a40', tr: '#2a9dff' },
  elec: { o: '#2a2208', d: '#b88a14', m: '#f5c932', l: '#fff08a', b: '#fffbe0', a: '#5ff1e0', a2: '#ff8a1f', w: '#ffffff', k: '#2a2208', h: '#ff9bb8', k2: '#4a3a14', tr: '#7a4a24' },
  bone: { o: '#1a1420', d: '#8a8296', m: '#d8d2e0', l: '#ffffff', b: '#f4f0f8', a: '#7a5cff', a2: '#3a2a5a', w: '#ff4f6a', k: '#1a1420', h: '#ff4fd8', k2: '#2a2234', tr: '#5a4a3a' },
  gull: { o: '#14182a', d: '#8a96b8', m: '#e8ecf6', l: '#ffffff', b: '#ffffff', a: '#ffb13d', a2: '#4a5a8a', w: '#ffffff', k: '#14182a', h: '#ff9bb8', k2: '#5a6a96', tr: '#ffb13d' },
  coral: { o: '#2a0c1e', d: '#c23a6a', m: '#ff6b9a', l: '#ffb0c8', b: '#ffe4ee', a: '#ffcf4a', a2: '#7ee3c8', w: '#ffffff', k: '#2a0c1e', h: '#ffcf4a', k2: '#6a1a3a', tr: '#7a4a24' },
  star: { o: '#2a1a08', d: '#b06a2a', m: '#e8a050', l: '#ffd28a', b: '#fff0d0', a: '#ff6b5a', a2: '#ffe0a0', w: '#ffffff', k: '#2a1a08', h: '#ff9bb8', k2: '#6a4a2a', tr: '#7a4a24' },
  jelly: { o: '#1a0e30', d: '#7a5ad0', m: '#b8a0ff', l: '#e8deff', b: '#ffffff', a: '#ff8ad8', a2: '#5ff1e0', w: '#ffffff', k: '#1a0e30', h: '#ff8ad8', k2: '#4a3a8a', tr: '#7a4a24' },
  dragon: { o: '#0a1638', d: '#1d4fa8', m: '#3a82dc', l: '#b4e0ff', b: '#f2f8ff', a: '#f0c868', a2: '#7fe8ff', w: '#ffffff', k: '#0a1638', h: '#ff9bb8', k2: '#163d86', tr: '#f0c868' },
  thunder: { o: '#120e2a', d: '#25358a', m: '#4762d0', l: '#a8c0ff', b: '#f4f6ff', a: '#ffe14a', a2: '#5ff1ff', w: '#ffffff', k: '#120e2a', h: '#ffe14a', k2: '#252a4a', tr: '#ffe14a' },
  whale: { o: '#060e22', d: '#1a2f6a', m: '#2f5aa8', l: '#6f9ee0', b: '#cfe2ff', a: '#5ff1e0', a2: '#ffcf4a', w: '#ffffff', k: '#060e22', h: '#ff9bb8', k2: '#14244a', tr: '#7a4a24' },
} satisfies Record<string, Palette>;
export type PalName = keyof typeof PAL;

type Cell = PalKey | null;
export interface Painter {
  g: Cell[];
  p(x: number, y: number, c: PalKey): void;
  e(cx: number, cy: number, rx: number, ry: number, c: PalKey): void;
  r(x: number, y: number, w: number, h: number, c: PalKey): void;
  clr(x: number, y: number, w: number, h: number): void;
  poly(pts: number[], c: PalKey): void;
  chain(path: [number, number][], r0: number, r1: number, c: PalKey): void;
  t(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: PalKey): void;
  l(x0: number, y0: number, x1: number, y1: number, c: PalKey, w?: number): void;
  eye(x: number, y: number, look?: 'cute' | 'fierce' | 'calm' | 'glow'): void;
}

export function painter(N = SIZE): Painter {
  const g: Cell[] = new Array(N * N).fill(null);
  const set = (x: number, y: number, c: PalKey) => {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < N && y < N) g[y * N + x] = c;
  };
  const api: Painter = {
    g,
    p: set,
    e(cx, cy, rx, ry, c) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) g[y * N + x] = c;
      }
    },
    r(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); },
    // 任意多邊形（以像素中心判斷是否在內）
    poly(pts, c) {
      const n = pts.length / 2;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const px = x + 0.5, py = y + 0.5;
        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1];
          if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) g[y * N + x] = c;
      }
    },
    // 沿著路徑排列圓形，半徑由 r0 漸變到 r1（用來畫蛇形身體）
    chain(path, r0, r1, c) {
      const steps = 40;
      for (let k = 0; k <= steps; k++) {
        const t = k / steps, fi = t * (path.length - 1), i = Math.min(path.length - 2, Math.floor(fi)), u = fi - i;
        const x = path[i][0] + (path[i + 1][0] - path[i][0]) * u, y = path[i][1] + (path[i + 1][1] - path[i][1]) * u;
        const r = r0 + (r1 - r0) * t;
        api.e(x, y, r, r, c);
      }
    },
    clr(x, y, w, h) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < N && j < N) g[j * N + i] = null; },
    t(ax, ay, bx, by, cx, cy, c) {
      const ed = (x0: number, y0: number, x1: number, y1: number, x: number, y: number) => (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ed(bx, by, cx, cy, px, py), w1 = ed(cx, cy, ax, ay, px, py), w2 = ed(ax, ay, bx, by, px, py);
        if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) g[y * N + x] = c;
      }
    },
    l(x0, y0, x1, y1, c, w = 1) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
        for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) set(x + a, y + b, c);
      }
    },
    // 3×3 大眼：白底、瞳孔、高光
    eye(x, y, look = 'cute') {
      if (look === 'glow') { api.r(x, y, 3, 2, 'a'); api.p(x + 1, y, 'w'); return; }
      if (look === 'fierce') {
        api.r(x, y + 1, 3, 2, 'w'); api.p(x + 2, y + 1, 'k'); api.p(x + 2, y + 2, 'k');
        api.l(x - 1, y - 1, x + 3, y, 'o');
        return;
      }
      if (look === 'calm') { api.r(x, y, 3, 2, 'w'); api.r(x + 1, y + 1, 2, 1, 'k'); return; }
      api.r(x, y, 3, 4, 'w'); api.r(x + 1, y + 1, 2, 3, 'k'); api.p(x + 1, y + 1, 'w');
    },
  };
  return api;
}

// ── 烘焙：把色塊轉成有光影的圖 ──
// 光源在左上：上緣高光、下緣深影並以棋盤格過渡；朝光的一側外框帶顏色、背光側用深色外框；
// 背光側邊緣加一點冷色的邊緣光，讓生物從背景中跳出來。
const hexRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixRgb = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as [number, number, number];
const WHITE = [255, 255, 255], RIM = [190, 246, 255];
const SHADE: PalKey[] = ['m', 'a', 'a2', 'b', 'k2', 'd', 'l', 'tr'];

function bake(cells: Cell[], pal: Palette, N: number): ImageData {
  const img = new ImageData(N, N);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= N || y >= N) ? null : cells[y * N + x];
  const empty = (x: number, y: number) => at(x, y) === null;
  const put = (x: number, y: number, c: number[]) => { const i = (y * N + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255; };
  const P = Object.fromEntries(Object.entries(pal).map(([k, v]) => [k, hexRgb(v)])) as Record<PalKey, [number, number, number]>;
  const deep = mixRgb(P.d, P.o, 0.45), spec = mixRgb(P.l, WHITE, 0.55);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = cells[y * N + x];
    if (k === null) {
      // 外框
      const below = at(x, y + 1), right = at(x + 1, y), above = at(x, y - 1), left = at(x - 1, y);
      if (!below && !right && !above && !left) continue;
      const lit = (below || right) && !above && !left;
      const src = below ?? right ?? above ?? left!;
      put(x, y, lit && src !== 'o' && src !== 'k' ? mixRgb(P[src === 'm' ? 'd' : src], P.o, 0.55) : P.o);
      continue;
    }
    let c = P[k];
    if (SHADE.includes(k)) {
      const up1 = empty(x, y - 1), up2 = empty(x, y - 2), ul = empty(x - 1, y - 1), l1 = empty(x - 1, y);
      const dn1 = empty(x, y + 1), dn2 = empty(x, y + 2), dn3 = empty(x, y + 3), dn4 = empty(x, y + 4), r1 = empty(x + 1, y), dr = empty(x + 1, y + 1);
      const chk = (x + y) % 2 === 0;
      if (k === 'm') {
        if (up1 && ul && !l1) c = spec;
        else if (up1 || (ul && l1)) c = P.l;
        else if (up2 && chk) c = P.l;
        else if (dn1) c = deep;
        else if (dn2 || (dr && r1)) c = P.d;
        else if (dn3 || (dn4 && chk) || (r1 && chk)) c = P.d;
      } else {
        if (up1 || (ul && l1)) c = mixRgb(c, WHITE, 0.32);
        else if (dn1) c = mixRgb(c, P.o, 0.38);
        else if (dn2 && chk) c = mixRgb(c, P.o, 0.2);
      }
      // 背光側邊緣光
      if (r1 && !up1 && (dn1 || dn2 || dr)) c = mixRgb(c, RIM, 0.45);
    }
    put(x, y, c);
  }
  return img;
}

export type SpriteDef = (s: Painter, f: number) => void;
const DEFS: Record<string, SpriteDef> = {};
// 讓 48 格的畫法放大到別的尺寸（座標與粗細都乘上 k）
export function scaledPainter(s: Painter, k: number): Painter {
  const q: Painter = {
    g: s.g,
    p: (x, y, c) => s.r(Math.round(x * k), Math.round(y * k), Math.ceil(k), Math.ceil(k), c),
    e: (cx, cy, rx, ry, c) => s.e(cx * k, cy * k, rx * k, ry * k, c),
    r: (x, y, w, h, c) => s.r(Math.round(x * k), Math.round(y * k), Math.round(w * k), Math.round(h * k), c),
    clr: (x, y, w, h) => s.clr(Math.round(x * k), Math.round(y * k), Math.round(w * k), Math.round(h * k)),
    t: (ax, ay, bx, by, cx, cy, c) => s.t(ax * k, ay * k, bx * k, by * k, cx * k, cy * k, c),
    l: (x0, y0, x1, y1, c, w = 1) => s.l(x0 * k, y0 * k, x1 * k, y1 * k, c, Math.max(1, Math.round(w * k))),
    poly: (pts, c) => s.poly(pts.map((v) => v * k), c),
    chain: (path, r0, r1, c) => s.chain(path.map(([x, y]) => [x * k, y * k] as [number, number]), r0 * k, r1 * k, c),
    eye: (x, y, look) => s.eye(Math.round(x * k), Math.round(y * k), look),
  };
  return q;
}

const SIZES: Record<string, number> = {};
// size：畫布邊長（一般 48，傳說級 64）
export function registerSprites(defs: Record<string, SpriteDef>, size = SIZE) { Object.assign(DEFS, defs); for (const k of Object.keys(defs)) SIZES[k] = size; }
export const spriteSize = (id: string) => SIZES[id] ?? SIZE;

const cellCache = new Map<string, Cell[]>();
export function spriteCells(id: string, f = 0): Cell[] {
  const k = id + ':' + f;
  let c = cellCache.get(k);
  if (!c) {
    const s = painter(spriteSize(id));
    (DEFS[id] ?? DEFS.unknown)(s, f);
    c = s.g;
    cellCache.set(k, c);
  }
  return c;
}

const bakedCache = new WeakMap<Palette, Map<string, HTMLCanvasElement>>();
function baked(id: string, f: number, pal: Palette, tint?: string): HTMLCanvasElement {
  let m = bakedCache.get(pal);
  if (!m) { m = new Map(); bakedCache.set(pal, m); }
  const key = `${id}:${f}:${tint ?? ''}`;
  let cv = m.get(key);
  if (!cv) {
    const n = spriteSize(id);
    cv = document.createElement('canvas'); cv.width = n; cv.height = n;
    const x = cv.getContext('2d')!;
    x.putImageData(bake(spriteCells(id, f), pal, n), 0, 0);
    if (tint) { x.globalCompositeOperation = 'source-in'; x.fillStyle = tint; x.fillRect(0, 0, n, n); }
    m.set(key, cv);
  }
  return cv;
}

export function drawSprite(
  ctx: CanvasRenderingContext2D, id: string, pal: Palette, x: number, y: number,
  opt: { f?: number; flip?: boolean; alpha?: number; scale?: number; tint?: string } = {},
) {
  const { f = 0, flip = false, alpha = 1, scale = 1, tint } = opt;
  const cv = baked(id, f, pal, tint);
  const w = Math.round(cv.width * scale);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= alpha;
  if (flip) { ctx.translate(Math.round(x) + w, Math.round(y)); ctx.scale(-1, 1); ctx.drawImage(cv, 0, 0, w, w); }
  else ctx.drawImage(cv, Math.round(x), Math.round(y), w, w);
  ctx.restore();
}

export function spritePixels(id: string, pal: Palette) {
  const n = spriteSize(id);
  const d = baked(id, 0, pal).getContext('2d')!.getImageData(0, 0, n, n).data;
  const arr: { x: number; y: number; c: string }[] = [];
  for (let i = 0; i < n * n; i++) {
    if (d[i * 4 + 3] < 128) continue;
    arr.push({ x: i % n, y: Math.floor(i / n), c: `rgb(${d[i * 4]},${d[i * 4 + 1]},${d[i * 4 + 2]})` });
  }
  return arr;
}
