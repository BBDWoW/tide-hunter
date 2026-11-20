// 進化演出：閃爍 → 光柱 → 像素碎裂 → 重組 → 光環。華麗但元素不多。
import { FORMS, recolorOf } from '../data/creatures';
import { drawSprite, PAL, spritePixels, spriteSize } from './pixel';

export const EVO_W = 96;
const off = (id: string) => { const n = spriteSize(id); return { x: (EVO_W - n) / 2, y: EVO_W - n - 18 }; };
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function playEvolution(canvas: HTMLCanvasElement, from: string, to: string, onDone: () => void, onPhase?: (p: 'start' | 'reveal') => void, mutant?: boolean) {
  const ctx = canvas.getContext('2d')!;
  const ff = FORMS[from], ft = FORMS[to];
  const oa = off(ff.sprite), ob = off(ft.sprite);
  const A = spritePixels(ff.sprite, PAL[ff.pal]), B = spritePixels(ft.sprite, PAL[ft.pal]);
  const scat = A.map((p) => {
    const ang = Math.random() * Math.PI * 2, sp = 14 + Math.random() * 30;
    return { x: p.x + oa.x, y: p.y + oa.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 14 };
  });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = reduce ? { fl: 0.4, sc: 0.8, as: 1.2, end: 1.6 } : { fl: 1.2, sc: 2.0, as: 3.1, end: 3.8 };
  let raf = 0, done = false, revealed = false;
  const t0 = performance.now();
  onPhase?.('start');

  const bg = () => {
    ctx.fillStyle = '#05081a'; ctx.fillRect(0, 0, EVO_W, EVO_W);
    ctx.fillStyle = '#0f1a3c';
    for (let i = 0; i < EVO_W; i += 8) { ctx.fillRect(i, 0, 1, EVO_W); ctx.fillRect(0, i, EVO_W, 1); }
  };
  const pillar = (a: number, w: number) => {
    if (a <= 0) return;
    ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#5ff1e0'; ctx.fillRect(EVO_W / 2 - w, 0, w * 2, EVO_W);
    ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#e8fffb'; ctx.fillRect(EVO_W / 2 - Math.max(1, w / 3), 0, Math.max(2, (w / 3) * 2), EVO_W);
    ctx.globalAlpha = 1;
  };
  const stream = (k: number) => {
    ctx.fillStyle = '#5ff1e0';
    for (let i = 0; i < 6; i++) {
      const x = 10 + i * 15 + (i % 2) * 4, y = EVO_W - ((k * 70 + i * 23) % (EVO_W + 10));
      ctx.globalAlpha = 0.35; ctx.fillRect(x, Math.round(y), 1, 5); ctx.fillRect(x, Math.round(y) + 7, 1, 2);
    }
    ctx.globalAlpha = 1;
  };

  const frame = (now: number) => {
    if (done) return;
    const t = (now - t0) / 1000;
    bg();
    if (t < T.fl) {
      const k = t / T.fl;
      pillar(k, 2 + k * 10);
      const white = Math.floor(t * (5 + t * 12)) % 2 === 0;
      drawSprite(ctx, ff.sprite, PAL[ff.pal], oa.x, oa.y, { tint: white ? '#ffffff' : undefined, recolor: recolorOf(from, mutant) });
    } else if (t < T.sc) {
      const k = t - T.fl;
      pillar(1, 12); stream(k);
      for (const [i, p] of scat.entries()) {
        ctx.fillStyle = i % 3 ? '#5ff1e0' : '#ffffff';
        ctx.fillRect(Math.round(p.x + p.vx * k), Math.round(p.y + p.vy * k), 1, 1);
      }
    } else if (t < T.as) {
      const k = ease((t - T.sc) / (T.as - T.sc)), kk = T.sc - T.fl;
      pillar(1, 12 - k * 4); stream(kk + (t - T.sc));
      for (const [i, q] of B.entries()) {
        const p = scat[i % scat.length], sx = p.x + p.vx * kk, sy = p.y + p.vy * kk;
        ctx.fillStyle = k > 0.88 ? q.c : i % 3 ? '#5ff1e0' : '#ffffff';
        ctx.fillRect(Math.round(sx + (q.x + ob.x - sx) * k), Math.round(sy + (q.y + ob.y - sy) * k), 1, 1);
      }
    } else if (t < T.end) {
      if (!revealed) { revealed = true; onPhase?.('reveal'); }
      const k = (t - T.as) / (T.end - T.as);
      pillar(1 - k, 8 * (1 - k));
      drawSprite(ctx, ft.sprite, PAL[ft.pal], ob.x, ob.y, { recolor: recolorOf(to, mutant) });
      ctx.globalAlpha = Math.max(0, 0.9 - k * 1.3); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, EVO_W, EVO_W); ctx.globalAlpha = 1;
      const r = Math.round(8 + k * 44);
      ctx.fillStyle = '#ffcf4a';
      for (let a = 0; a < 90; a++) { const an = (a / 90) * Math.PI * 2; ctx.fillRect(Math.round(EVO_W / 2 + Math.cos(an) * r), Math.round(ob.y + 26 + Math.sin(an) * r * 0.75), 1, 1); }
    } else {
      done = true;
      drawSprite(ctx, ft.sprite, PAL[ft.pal], ob.x, ob.y, { recolor: recolorOf(to, mutant) });
      if (!revealed) onPhase?.('reveal');
      onDone();
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { done = true; cancelAnimationFrame(raf); };
}
