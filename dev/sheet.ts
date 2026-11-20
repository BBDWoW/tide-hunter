import '../src/data/sprites';
import { FORMS, recolorOf } from '../src/data/creatures';
import { drawSprite, PAL, spriteSize } from '../src/render/pixel';
import { artReady } from '../src/render/art';
// 用法：/dev/sheet.html?only=id1,id2　加上 &mutant=1 會在旁邊顯示異變配色
const g = document.getElementById('g')!;
const q = new URLSearchParams(location.search);
const only = q.get('only')?.split(','), withMutant = !!q.get('mutant');
artReady.then(() => {
  for (const f of Object.values(FORMS)) {
    if (only && !only.includes(f.id)) continue;
    for (const mutant of withMutant ? [false, true] : [false]) {
      const d = document.createElement('div'); d.className = 'c';
      const n = spriteSize(f.sprite); const c = document.createElement('canvas'); c.width = n; c.height = n; c.style.width = c.style.height = n * 3 + 'px';
      drawSprite(c.getContext('2d')!, f.sprite, PAL[f.pal], 0, 0, { recolor: recolorOf(f.id, mutant) });
      d.append(c, f.name + (mutant ? ' ✦' : '')); g.append(d);
    }
  }
});
