// 美術匯出：把所有角色與場景圖層輸出成 PNG（給 playwright 收集）
import '../src/data/sprites';
import { FORMS } from '../src/data/creatures';
import { drawSprite, PAL, spriteSize } from '../src/render/pixel';
import { sceneLayers } from '../src/render/scene';

const out: { path: string; data: string }[] = [];
const seen = new Set<string>();
for (const f of Object.values(FORMS)) {
  if (seen.has(f.sprite)) continue;
  seen.add(f.sprite);
  const n = spriteSize(f.sprite);
  const one = document.createElement('canvas'); one.width = n; one.height = n;
  drawSprite(one.getContext('2d')!, f.sprite, PAL[f.pal], 0, 0, { f: 0 });
  out.push({ path: `sprites/${f.sprite}.png`, data: one.toDataURL('image/png') });
  const strip = document.createElement('canvas'); strip.width = n * 2; strip.height = n;
  const sx = strip.getContext('2d')!;
  drawSprite(sx, f.sprite, PAL[f.pal], 0, 0, { f: 0 });
  drawSprite(sx, f.sprite, PAL[f.pal], n, 0, { f: 1 });
  out.push({ path: `sprites_2frames/${f.sprite}.png`, data: strip.toDataURL('image/png') });
}
for (const id of ['day', 'sunset', 'ice', 'lava'] as const) out.push({ path: `scenes/bg-${id}.png`, data: sceneLayers.backdrop(id).toDataURL('image/png') });
for (const th of ['day', 'ice', 'lava']) {
  out.push({ path: `scenes/shoal-${th}.png`, data: sceneLayers.shoal(th).toDataURL('image/png') });
  out.push({ path: `scenes/reef-${th}.png`, data: sceneLayers.reef(th).toDataURL('image/png') });
}
const list = Object.values(FORMS).map((f) => ({ id: f.sprite, form: f.id, name: f.name, size: spriteSize(f.sprite), rarity: f.rarity, pal: f.pal }));
(window as unknown as Record<string, unknown>).__export = { files: out, list, palettes: PAL };
document.getElementById('s')!.textContent = `done: ${out.length} files`;
