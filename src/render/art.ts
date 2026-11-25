// 外部美術：把 PNG 放進 src/art/sprites 或 src/art/scenes，就會取代程式畫的版本。
// - 角色：src/art/sprites/<角色代號>.png，高度就是尺寸（48 或 64），寬度可以是 1 格或 2 格動畫並排
// - 場景：src/art/scenes/<名稱>.png（名稱見 美術包/README）
const spriteUrls = import.meta.glob('../art/sprites/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const sceneUrls = import.meta.glob('../art/scenes/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
// 色違：src/art/shiny/<角色代號>.png（專屬的色違圖，沒有的話就用程式換色）
const shinyUrls = import.meta.glob('../art/shiny/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

import MANIFEST from '../art/sprite_manifest.json';
// size：圖檔裡每一格的邊長（高解析版是 2 倍）；logical：在遊戲世界裡的大小（48 或 64）
export interface SpriteArt { img: HTMLImageElement; size: number; frames: number; logical: number }
const M = MANIFEST as unknown as Record<string, { logical: number; frame: number; sockets: Record<string, [number, number]>; idle?: number[] }>;
export const spriteSockets = (id: string) => M[id]?.sockets;
/** 霸主專屬版：每一格整隻身體上下浮動幾個貼圖像素（美術附的 king-idle） */
export const spriteIdle = (id: string) => M[id]?.idle;
export const spriteTexel = (id: string) => (M[id] ? M[id].logical / M[id].frame : 1);
const sprites = new Map<string, SpriteArt>();
const shinies = new Map<string, SpriteArt>();
const scenes = new Map<string, HTMLImageElement>();

const nameOf = (path: string) => path.split('/').pop()!.replace(/\.png$/i, '');
const load = (url: string) => new Promise<HTMLImageElement | null>((res) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = () => res(null);
  img.src = url;
});

// 載入進度（給啟動畫面的進度條）
const total = Object.keys(spriteUrls).length + Object.keys(sceneUrls).length + Object.keys(shinyUrls).length;
let loaded = 0;
const tick = () => { loaded++; (window as unknown as { __splash?: (p: number) => void }).__splash?.(loaded / Math.max(1, total)); };

export const artReady: Promise<void> = Promise.all([
  ...Object.entries(spriteUrls).map(async ([p, url]) => {
    const img = await load(url);
    tick();
    if (!img) return;
    const size = img.height;
    const id = nameOf(p);
    sprites.set(id, { img, size, frames: Math.max(1, Math.round(img.width / size)), logical: M[id]?.logical ?? size });
  }),
  ...Object.entries(shinyUrls).map(async ([p, url]) => {
    const img = await load(url);
    tick();
    if (!img) return;
    const id = nameOf(p);
    shinies.set(id, { img, size: img.height, frames: Math.max(1, Math.round(img.width / img.height)), logical: M[id]?.logical ?? img.height });
  }),
  ...Object.entries(sceneUrls).map(async ([p, url]) => {
    const img = await load(url);
    tick();
    if (img) scenes.set(nameOf(p), img);
  }),
]).then(() => undefined);

export const spriteArt = (id: string) => sprites.get(id);
export const shinyArt = (id: string) => shinies.get(id);
export const sceneArt = (name: string) => scenes.get(name);
export const artCount = () => ({ sprites: sprites.size, scenes: scenes.size });
