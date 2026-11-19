import '../src/data/sprites';
import { FORMS } from '../src/data/creatures';
import { drawSprite, PAL, spriteSize } from '../src/render/pixel';
const g = document.getElementById('g')!;
const only = new URLSearchParams(location.search).get('only')?.split(',');
for (const f of Object.values(FORMS)) {
  if (only && !only.includes(f.id)) continue;
  const d = document.createElement('div'); d.className = 'c';
  const n = spriteSize(f.sprite); const c = document.createElement('canvas'); c.width = n; c.height = n; c.style.width = c.style.height = n * 3 + 'px';
  drawSprite(c.getContext('2d')!, f.sprite, PAL[f.pal], 0, 0);
  d.append(c, f.name); g.append(d);
}
