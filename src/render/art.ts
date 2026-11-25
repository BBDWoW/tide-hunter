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
/** 角色在世界裡的大小（直接看 manifest，不用等圖下載） */
export const spriteLogical = (id: string) => M[id]?.logical;
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


// 色違圖（100 多張）不擋開場：主圖和場景載完就能開始玩，色違在背景慢慢下載
const shinyIds = new Set(Object.keys(shinyUrls).map(nameOf));
export const hasShinyArt = (id: string) => shinyIds.has(id);
const shinyUrlOf = new Map(Object.entries(shinyUrls).map(([p, u]) => [nameOf(p), u]));
const shinyPending = new Map<string, Promise<void>>();
function loadShiny(id: string): Promise<void> {
  const url = shinyUrlOf.get(id); if (!url) return Promise.resolve();
  let pr = shinyPending.get(id);
  if (!pr) {
    pr = load(url).then((img) => { if (img) shinies.set(id, { img, size: img.height, frames: Math.max(1, Math.round(img.width / img.height)), logical: M[id]?.logical ?? img.height }); });
    shinyPending.set(id, pr);
  }
  return pr;
}
const loadShinies = async () => {
  const ids = [...shinyIds]; let k = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (k < ids.length) await loadShiny(ids[k++]); }));
};

// 角色主圖：不再全部下載完才開場（約 7MB，網路慢時要等很久）。
// 開場只等「一定會看到的」：初始夥伴、棲息灣的夥伴、存檔中的隊伍；其他在背景依序下載，畫面用到時插隊優先抓
const spriteIds = new Set(Object.keys(spriteUrls).map(nameOf));
const urlOf = new Map(Object.entries(spriteUrls).map(([p, u]) => [nameOf(p), u]));
const pending = new Map<string, Promise<void>>();
function loadSprite(id: string): Promise<void> {
  const url = urlOf.get(id); if (!url) return Promise.resolve();
  let pr = pending.get(id);
  if (!pr) {
    pr = load(url).then((img) => {
      if (!img) return;
      const size = img.height;
      sprites.set(id, { img, size, frames: Math.max(1, Math.round(img.width / size)), logical: M[id]?.logical ?? size });
    });
    pending.set(id, pr);
  }
  return pr;
}
export const hasSpriteArt = (id: string) => spriteIds.has(id);
/** 存檔裡出現的角色（棲息灣、冒險中的隊伍）：開場前先載好 */
function savedIds(): string[] {
  const out: string[] = ['water1', 'fire1', 'grass1'];
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith('tidehunter.')) continue;
      const v = localStorage.getItem(k) ?? '';
      for (const m of v.matchAll(/"(?:form|root)":"([a-z0-9_]+)"/g)) out.push(m[1]);
    }
  } catch { /* 略過 */ }
  return [...new Set(out)].filter((id) => spriteIds.has(id));
}
const first = savedIds();
let loaded = 0;
const need = first.length + Object.keys(sceneUrls).length;
const tick = () => { loaded++; (window as unknown as { __splash?: (p: number) => void }).__splash?.(loaded / Math.max(1, need)); };

export const artReady: Promise<void> = Promise.all([
  ...first.map((id) => loadSprite(id).then(tick)),
  ...Object.entries(sceneUrls).map(async ([p, url]) => {
    const img = await load(url);
    tick();
    if (img) scenes.set(nameOf(p), img);
  }),
]).then(() => undefined);
/** 開場後：其他角色主圖一次 6 張在背景下載，全部載完再下載色違 */
export const allSpritesReady: Promise<void> = artReady.then(async () => {
  const rest = [...spriteIds].filter((id) => !sprites.has(id));
  let k = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (k < rest.length) await loadSprite(rest[k++]); }));
});
/** 主圖載完之後才開始下載色違，不跟主圖搶頻寬 */
export const shinyReady: Promise<void> = allSpritesReady.then(loadShinies).then(() => undefined);

/** 畫面要用到但還沒下載的角色：插隊先抓 */
export const wantSprite = (id: string) => { if (!sprites.has(id) && spriteIds.has(id)) void loadSprite(id); };
/** 等這隻角色的圖下載好（mutant：連色違一起） */
export const ensureSprite = (id: string, mutant = false) => Promise.all([loadSprite(id), mutant ? loadShiny(id) : Promise.resolve()]).then(() => undefined);
export const spriteLoaded = (id: string, mutant = false) => (!spriteIds.has(id) || sprites.has(id)) && (!mutant || !shinyIds.has(id) || shinies.has(id));
export const spriteArt = (id: string) => { const a = sprites.get(id); if (!a) wantSprite(id); return a; };
export const shinyArt = (id: string) => { const a = shinies.get(id); if (!a && shinyIds.has(id)) void loadShiny(id); return a; };
export const sceneArt = (name: string) => scenes.get(name);
export const artCount = () => ({ sprites: sprites.size, scenes: scenes.size });
