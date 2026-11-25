// 開發用：找出場景中間 256 寬和兩側延伸區交界處的接縫（亮度突然跳）
import '../src/data/sprites';
import * as S from '../src/render/scene';
import { drawEventArt, EVENT_ART, type EventArt } from '../src/render/eventArt';
import { artReady } from '../src/render/art';
const B = 60, R = 2, W = 256, H = 144;
const themes: S.ThemeId[] = ['day', 'ice', 'lava', 'forest', 'void', 'core', 'cyber', 'abyss'];
const out: string[] = [];
function test(name: string, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas'); cv.width = (W + B * 2) * R; cv.height = H * R;
  const c = cv.getContext('2d')!; c.imageSmoothingEnabled = false;
  S.view.bleed = B; S.view.wide = false;
  c.setTransform(R, 0, 0, R, B * R, 0);
  draw(c);
  if (!S.view.wide) return; // 不鋪寬的場景用鏡射補邊，不會有接縫
  const d = c.getImageData(0, 0, cv.width, cv.height).data, Wd = cv.width;
  const lum = (x: number, y: number) => { const i = (y * Wd + x) * 4; return d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; };
  const seam = (x: number) => { let s = 0; for (let y = 0; y < cv.height; y++) s += lum(x, y) - lum(x - 1, y); return s / cv.height; };
  const ref = (x: number) => { let s = 0; for (let y = 0; y < cv.height; y++) s += Math.abs(lum(x, y) - lum(x - 1, y)); return s / cv.height; };
  const L = seam(B * R), Rt = seam((B + W) * R), base = (ref(B * R - 20) + ref(B * R + 20)) / 2;
  if (Math.abs(L) > 6 || Math.abs(Rt) > 6) out.push(`${name}: left ${L.toFixed(1)} right ${Rt.toFixed(1)} (noise ${base.toFixed(1)})`);
}
artReady.then(() => {
  for (const tod of ['day', 'dusk', 'night'] as const) {
    S.setTimeOfDay(tod, 'cute');
    for (const th of themes) {
      test(`sea ${th} ${tod}`, (c) => S.drawSea(c, 1.3, th));
      test(`battleBg ${th} ${tod}`, (c) => S.drawBattleBg(c, 1.3, th));
      for (const spot of ['shallow', 'reef', 'wreck', 'deep'])
        for (const phase of ['choose', 'wait', 'bite', 'hooked'] as S.FishPhase[])
          test(`fish ${th} ${tod} ${spot} ${phase}`, (c) => S.drawFishing(c, 1.3, 0.016, { phase, power: 0.5, castT: 0.5, bobX: 200, shadows: [{ x: 150, size: 2 }], sel: 0, spot, theme: th, ripple: 180 }));
    }
    for (const f of ['tide', 'lava', 'fog', 'storm', 'aurora', 'grid', 'grove', 'abyss'])
      test(`battle field ${f} ${tod}`, (c) => S.drawBattle(c, 1.3, 0.016, [], [], [], 'day', { field: f, flash: 0.3 }));
    test(`title ${tod}`, (c) => S.drawTitle(c, 1.3));
    test(`starter ${tod}`, (c) => S.drawStarterScene(c, 1.3, ['water1', 'fire1', 'grass1'], 1));
    for (const art of [...new Set(Object.values(EVENT_ART))] as EventArt[]) test(`event ${art} ${tod}`, (c) => { S.drawSea(c, 1.3, 'day'); drawEventArt(c, 1.3, art); });
  }
  (window as unknown as Record<string, unknown>).__seams = out;
  document.getElementById('s')!.textContent = 'done ' + out.length;
});
