// 開發用：把每一招技能特效在幾個關鍵格畫出來，檢查定位
import '../src/data/sprites';
import { FORMS } from '../src/data/creatures';
import { drawSprite, PAL, spriteSize } from '../src/render/pixel';
import { artReady } from '../src/render/art';
import { drawFx, loadFx } from '../src/render/vfx';
import SK from '../src/art/vfx_skills.json';

const q = new URLSearchParams(location.search), only = q.get('only');
const codes = Object.keys(SK).sort().filter((c) => !only || only.split(',').includes(c));
const REAL = q.has('real');
const FR = [1, 4, 6, 8, 10];
const W = REAL ? 256 : 200, H = REAL ? 144 : 90, R = 2;
const A = (id: string, x: number, y: number, flip: boolean) => { const sp = FORMS[id].sprite, n = spriteSize(sp); return { id, sp, rect: { x, y: y - n, w: n }, flip }; };
artReady.then(async () => {
  codes.forEach(loadFx);
  await new Promise((r) => setTimeout(r, 2500));
  const p = new URLSearchParams(location.search), from = +(p.get('from') ?? 0), to = +(p.get('to') ?? codes.length);
  const g = document.getElementById('g')!;
  for (const code of codes.slice(from, to)) {
    const c = document.createElement('canvas'); c.width = W * FR.length * R; c.height = (H + 10) * R; g.appendChild(c);
    const x = c.getContext('2d')!; x.imageSmoothingEnabled = false; x.setTransform(R, 0, 0, R, 0, 0);
    x.fillStyle = '#3a78b0'; x.fillRect(0, 0, W * FR.length, H + 10);
    FR.forEach((fr, k) => {
      x.save(); x.translate(k * W, 10); x.beginPath(); x.rect(0, 0, W, H); x.clip();
      const me = REAL ? A('water1', 66 - 24, 103, false) : A('water1', 30, 82, false), foe = REAL ? A('bonecrab', 190 - 24, 69, true) : A('bonecrab', 130, 62, true);
      const ar = REAL ? { x: 20, y: 2, w: 216, h: 117 } : { x: 0, y: 0, w: W, h: H };
      if (REAL) { x.fillStyle = 'rgba(10,20,60,0.85)'; x.fillRect(0, 96, W, 48); }
      const act = (a: typeof me) => ({ rect: a.rect, sprite: a.sp, facesLeft: a.flip, logical: spriteSize(a.sp) });
      drawFx(x, code, 'back', fr, act(me), act(foe), ar);
      for (const a of [me, foe]) drawSprite(x, a.sp, PAL[FORMS[a.id].pal], a.rect.x, a.rect.y, { f: 0, flip: a.flip });
      drawFx(x, code, 'front', fr, act(me), act(foe), ar);
      drawFx(x, code, 'particles', fr, act(me), act(foe), ar);
      x.restore();
      x.fillStyle = '#fff'; x.font = '8px sans-serif'; x.fillText(`${code} f${fr}`, k * W + 2, 8);
    });
  }
  document.getElementById('s')!.textContent = 'done';
});
