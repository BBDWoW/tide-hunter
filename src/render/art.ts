// 外部美術：把 PNG 放進 src/art/sprites 或 src/art/scenes，就會取代程式畫的版本。
// - 角色：src/art/sprites/<角色代號>.png，高度就是尺寸（48 或 64），寬度可以是 1 格或 2 格動畫並排
// - 場景：src/art/scenes/<名稱>.png（名稱見 美術包/README）
const spriteUrls = import.meta.glob('../art/sprites/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const sceneUrls = import.meta.glob('../art/scenes/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export interface SpriteArt { img: HTMLImageElement; size: number; frames: number }
const sprites = new Map<string, SpriteArt>();
const scenes = new Map<string, HTMLImageElement>();

const nameOf = (path: string) => path.split('/').pop()!.replace(/\.png$/i, '');
const load = (url: string) => new Promise<HTMLImageElement | null>((res) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = () => res(null);
  img.src = url;
});

// 載入進度（給啟動畫面的進度條）
const total = Object.keys(spriteUrls).length + Object.keys(sceneUrls).length;
let loaded = 0;
const tick = () => { loaded++; (window as unknown as { __splash?: (p: number) => void }).__splash?.(loaded / Math.max(1, total)); };

export const artReady: Promise<void> = Promise.all([
  ...Object.entries(spriteUrls).map(async ([p, url]) => {
    const img = await load(url);
    tick();
    if (!img) return;
    const size = img.height;
    sprites.set(nameOf(p), { img, size, frames: Math.max(1, Math.round(img.width / size)) });
  }),
  ...Object.entries(sceneUrls).map(async ([p, url]) => {
    const img = await load(url);
    tick();
    if (img) scenes.set(nameOf(p), img);
  }),
]).then(() => undefined);

export const spriteArt = (id: string) => sprites.get(id);
export const sceneArt = (name: string) => scenes.get(name);
export const artCount = () => ({ sprites: sprites.size, scenes: scenes.size });
