// 技能特效：每招三張圖集（back 畫在角色後面，front／particles 畫在角色前面），單格 192×104、4×3 共 12 格、每格 100ms。
// 位置每一格都從角色目前的繪製矩形重新計算（會跟著衝刺、浮動、鏡像一起動）。
import { oracleImpact } from '../data/oracle';
import MOXU_FX from '../art/moxu_vfx.json';
import SKILL_FX from '../art/vfx_skills.json';
import { spriteSockets } from './art';

/** fc：這招有幾格（預設 12）；r = 'eclipse'：統領者的日蝕特效，用另一套定位方式（back 是整片舞台背景） */
/** src／hue：借用別招的特效圖，再把顏色轉 hue 度（還沒有專屬美術的招式） */
export interface FxSkill { style: string; socket: string; co: [number, number][]; to: [number, number][]; fc?: number; r?: 'eclipse'; src?: string; hue?: number }
const FX = SKILL_FX as unknown as Record<string, FxSkill>;
export const FX_FRAMES = 12, FX_MS = 100;
type MoxuFx = (typeof MOXU_FX)[keyof typeof MOXU_FX];
export const moxuFx = (code: string): MoxuFx | undefined => (MOXU_FX as Record<string, MoxuFx>)[code];
const FW = 192, FH = 104;
type Layer = 'back' | 'front' | 'particles';
const LAYERS: Layer[] = ['back', 'front', 'particles'];

const URLS = import.meta.glob('../art/vfx/*/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
type Atlas = HTMLImageElement | HTMLCanvasElement;
const imgs = new Map<string, Partial<Record<Layer, Atlas>>>();

export const hasFx = (code: string) => !!FX[code] || !!moxuFx(code);
/** 這招的特效有幾格 */
export const fxFrames = (code: string) => moxuFx(code)?.frameCount ?? FX[code]?.fc ?? FX_FRAMES;
export const fxSkill = (code: string) => FX[code];
/** 先把招式的圖集載進來（用到時才載） */
const loading = new Map<string, Promise<void>>();
export function loadFx(code: string) {
  if (!hasFx(code)) return;
  if (loading.has(code)) return loading.get(code);
  const set: Partial<Record<Layer, Atlas>> = {};
  imgs.set(code, set);
  const src = FX[code]?.src ?? code, hue = FX[code]?.hue;
  const ready = Promise.all(LAYERS.map(async l => {
    const url = URLS[`../art/vfx/${src}/${l}.png`];
    if (!url) return;
    const im = new Image(); im.src = url;
    try { await im.decode(); set[l] = hue ? hueShift(im, hue) : im; } catch { /* 保留戰鬥流程 */ }
  })).then(() => {});
  loading.set(code, ready);
  return ready;
}

/** 把整張圖的色相轉 deg 度（亮度、飽和度不變，像素不會糊掉） */
function hueShift(im: HTMLImageElement, deg: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d')!; x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data, h0 = deg / 360;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) continue; // 灰階不用轉
    const dd = mx - mn, sat = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
    let h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
    h = (h / 6 + h0 + 1) % 1;
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, pp = 2 * l - q;
    const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; };
    p[i] = Math.round(f(h + 1 / 3) * 255); p[i + 1] = Math.round(f(h) * 255); p[i + 2] = Math.round(f(h - 1 / 3) * 255);
  }
  x.putImageData(d, 0, 0);
  return c;
}

export interface Rect { x: number; y: number; w: number }
export interface Actor { rect: Rect; sprite: string; facesLeft: boolean; logical: number }
interface Pt { x: number; y: number }

const sock = (a: Actor, name: string): [number, number] => spriteSockets(a.sprite)?.[name] ?? spriteSockets(a.sprite)?.body ?? [0.5, 0.6];
export function actorPoint(a: Actor, uv: [number, number]): Pt {
  const r = a.rect;
  return { x: Math.round(r.x + r.w * (a.facesLeft ? 1 - uv[0] : uv[0])), y: Math.round(r.y + r.w * uv[1]) };
}

/** 這一格施術者／目標要偏移多少（素材裡的施法抖動），面向左時左右顛倒 */
export function fxOffset(code: string, frame: number, who: 'caster' | 'target', facesLeft: boolean): [number, number] {
  const s = FX[code]; if (!s) return [0, 0];
  const o = (who === 'caster' ? s.co : s.to)[Math.max(0, Math.min(fxFrames(code) - 1, frame))] ?? [0, 0];
  return [facesLeft ? -o[0] : o[0], o[1]];
}

const RETURNING = new Set(['soulsip', 'bloodtide', 'engulf', 'energydrain', 'seedleech', 'seagodbreath', 'azuretide']);

/** 畫一層特效（照包內附的定位程式改寫） */
export function drawFx(ctx: CanvasRenderingContext2D, code: string, layer: Layer, frame: number, caster: Actor, target: Actor, arena: { x: number; y: number; w: number; h: number }) {
  const s = FX[code], image = imgs.get(code)?.[layer];
  if (!image || frame < 0 || frame >= fxFrames(code)) return;
  const ascended = moxuFx(code);
  if (ascended) {
    drawAscended(ctx, image, ascended, layer, frame, caster, target, arena);
    return;
  }
  if (!s) return;
  if (s.r === 'eclipse') { drawEclipse(ctx, image, s, layer, frame, caster, target, arena); return; }
  const source = actorPoint(caster, sock(caster, s.socket)), body = actorPoint(caster, sock(caster, 'body')), hit = actorPoint(target, target.sprite === 'oracle' ? oracleImpact(code).map(n => n / 128) as [number, number] : sock(target, 'body'));
  const scale = caster.rect.w / caster.logical;
  const sx = (frame % 4) * FW, sy = Math.floor(frame / 4) * FH;
  const face = hit.x >= source.x ? 1 : -1, style = s.style;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  const at = (p: Pt, x: number, y: number, mirror = face) => {
    ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y)); ctx.scale(mirror * scale, scale);
    ctx.drawImage(image, sx, sy, FW, FH, -x, -y, FW, FH); ctx.restore();
  };
  // 沿著兩點之間一欄一欄拉伸（光束、衝擊波之類）
  const path = (a: Pt, b: Pt, start = 69, end = 145, baseY = 55) => {
    const span = b.x - a.x, sign = span < 0 ? -1 : 1, dist = Math.abs(span);
    const left = Math.floor(Math.min(a.x, b.x) - 80 * scale), right = Math.ceil(Math.max(a.x, b.x) + 80 * scale);
    for (let x = left; x <= right; x++) {
      const along = (x - a.x) * sign;
      const u = along < 0 ? start + along / scale : along > dist ? end + (along - dist) / scale : start + ((end - start) * along) / Math.max(1, dist);
      if (u < 0 || u >= FW) continue;
      const t = Math.max(0, Math.min(1, (u - start) / (end - start)));
      const y = Math.round(a.y + (b.y - a.y) * t - baseY * scale);
      ctx.drawImage(image, sx + Math.floor(u), sy, 1, FH, x, y, 1, Math.round(FH * scale));
    }
  };
  const center = { x: (body.x + hit.x) / 2, y: (body.y + hit.y) / 2 };
  if (frame <= 3) at(source, 69, 55);
  else if (style === 'field' && code !== 'reefspikes') ctx.drawImage(image, sx, sy, FW, FH, Math.round(arena.x), Math.round(arena.y), Math.round(arena.w), Math.round(arena.h));
  else if (code === 'reefspikes') at(hit, 145, 64);
  else if (style === 'self') at(body, 43, 58);
  else if (code === 'gh_stay') at(center, 97, 54);
  else if (code === 'gh_pull' || (layer === 'particles' && RETURNING.has(code) && frame >= 7) || ['coreburst', 'selfdestruct'].includes(code)) path(body, hit, 43, 145);
  else if (['microquake', 'bigquake', 'frostcrack'].includes(code)) path(body, hit, 69, 145, 64);
  else if (['jaw', 'cut', 'status', 'hand', 'burst'].includes(style) || (style === 'bolt' && code === 'thunder')) at(hit, 145, 55);
  else if (layer === 'particles' && frame >= 6) at(hit, 145, 55);
  else path(source, hit);
  ctx.restore();
}

/**
 * 統領者的日蝕特效（照美術附的 eclipse-vfx.mjs 改寫）：
 * back 是整片舞台背景（鋪滿 arena，開頭結尾那一格淡入淡出）；front 從施術者的 socket 沿著兩點拉到命中點；particles 畫在命中點。
 */
function drawEclipse(ctx: CanvasRenderingContext2D, image: Atlas, s: FxSkill, layer: Layer, t: number, caster: Actor, target: Actor, arena: { x: number; y: number; w: number; h: number }) {
  const n = s.fc ?? FX_FRAMES, sx = (t % 4) * FW, sy = Math.floor(t / 4) * FH;
  const source = actorPoint(caster, sock(caster, s.socket)), hit = actorPoint(target, sock(target, 'body'));
  const scale = caster.rect.w / caster.logical;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  if (layer === 'back') {
    // 舞台背景：第 1 格和倒數第 2 格半透明，切換不會太突然
    ctx.globalAlpha = t <= 1 || t >= n - 2 ? 0.55 : 1;
    ctx.drawImage(image, sx, sy, FW, FH, Math.round(arena.x), Math.round(arena.y), Math.round(arena.w), Math.round(arena.h));
  } else if (layer === 'particles') {
    ctx.translate(Math.round(hit.x), Math.round(hit.y)); ctx.scale(scale * (hit.x >= source.x ? 1 : -1), scale);
    ctx.drawImage(image, sx, sy, FW, FH, -145, -55, FW, FH);
  } else {
    const dir = hit.x >= source.x ? 1 : -1, dist = Math.abs(hit.x - source.x);
    for (let dst = Math.floor(Math.min(source.x, hit.x) - 60 * scale); dst <= Math.ceil(Math.max(source.x, hit.x) + 60 * scale); dst++) {
      const pos = (dst - source.x) * dir;
      const src = pos < 0 ? 55 + pos / scale : pos > dist ? 145 + (pos - dist) / scale : 55 + (90 * pos) / Math.max(1, dist);
      if (src < 0 || src >= FW) continue;
      const u = Math.min(1, Math.max(0, (src - 55) / 90));
      const y = Math.round(source.y + (hit.y - source.y) * u - 55 * scale);
      ctx.drawImage(image, sx + Math.floor(src), sy, 1, FH, dst, y, 1, Math.round(FH * scale));
    }
  }
  ctx.restore();
}

// 日月御潮圖集的前景依施術點和命中點定位，背景可延伸至寬螢幕邊緣。
function drawAscended(ctx: CanvasRenderingContext2D, image: Atlas, skill: MoxuFx, layer: Layer, frame: number, caster: Actor, target: Actor, arena: Rect & { h: number }) {
  const { frameWidth: w, frameHeight: h, atlasColumns: cols, sourcePx, targetPx } = skill;
  const sx = (frame % cols) * w, sy = Math.floor(frame / cols) * h;
  const source = actorPoint(caster, sock(caster, 'weapon'));
  const hit = actorPoint(target, sock(target, 'body'));
  const direction = hit.x >= source.x ? 1 : -1;
  const scale = Math.min(arena.w / w, arena.h / h);
  const [sourceX, sourceY] = sourcePx, [targetX, targetY] = targetPx;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.beginPath(); ctx.rect(arena.x, arena.y, arena.w, arena.h); ctx.clip();
  if (layer === 'back') {
    ctx.translate(direction < 0 ? arena.x + arena.w : arena.x, arena.y);
    ctx.scale(direction, 1);
    ctx.drawImage(image, sx, sy, w, h, 0, 0, arena.w, arena.h);
  } else if (layer === 'particles') {
    ctx.translate(hit.x, hit.y); ctx.scale(direction * scale, scale);
    ctx.drawImage(image, sx, sy, w, h, -targetX, -targetY, w, h);
  } else {
    const distance = Math.max(1, Math.abs(hit.x - source.x));
    for (let x = Math.floor(arena.x); x < Math.ceil(arena.x + arena.w); x++) {
      const along = (x - source.x) * direction;
      const progress = Math.min(1, Math.max(0, along / distance));
      const refX = sourceX + (targetX - sourceX) * progress + (along - progress * distance) / scale;
      if (refX < 0 || refX >= w) continue;
      const y = source.y + progress * (hit.y - source.y) - scale * (sourceY + progress * (targetY - sourceY));
      ctx.drawImage(image, sx + Math.floor(refX), sy, 1, h, x, Math.round(y), 1, Math.round(h * scale));
    }
  }
  ctx.restore();
}
