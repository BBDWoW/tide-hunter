// 水槍：水柱沿嘴部與命中點之間的直線發射，撞擊後水花再向外散開。
export const WATERGUN_FX = { frames: 12, frameMs: 64, hitFrame: 5 };
const INK = '#174675', BLUE = '#2580bf', WATER = '#43c6ef', RIM = '#a0f1ff', FOAM = '#f4ffff';

type Point = { x: number; y: number };
const JET_HEAD = [0.07, 0.24, 0.45, 0.66, 0.85, 1, 1, 1, 1, 1];
const JET_TAIL = [0, 0, 0, 0, 0, 0, 0, 0, 0.28, 0.68];
const SPRAY = [
  [-1.3, -3.2, 3], [-2.6, -1.9, 2], [1.15, -3.55, 3], [2.35, -2.9, 3],
  [3.4, -1.45, 3], [3.65, 0.1, 2], [2.15, 1.1, 2], [-1.7, 0.45, 2],
  [-0.65, -2.85, 1], [0.35, -4.1, 1], [3.25, -2.25, 1], [3.95, -0.8, 1],
  [3.6, 0.95, 1], [-2.9, -0.8, 1], [-2.5, -2.45, 1], [0.9, -2.2, 1],
] as const;

function pixel(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, width = 1, height = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), width, height);
}

function drawJet(ctx: CanvasRenderingContext2D, frame: number, source: Point, target: Point, dir: number) {
  const distance = Math.max(1, Math.abs(target.x - source.x));
  const start = Math.round(JET_TAIL[frame] * distance);
  const end = Math.round(JET_HEAD[frame] * distance);
  ctx.save();
  if (frame >= 8) ctx.globalAlpha *= frame === 8 ? 0.76 : 0.48;
  for (let column = start; column <= end; column++) {
    const p = column / distance;
    const x = source.x + dir * column;
    const y = source.y + (target.y - source.y) * p;
    const wave = (column + frame * 6) % 19;
    const radius = (frame < 2 ? 2 : 3) + (frame >= 2 && frame <= 7 && wave < 6 ? 1 : 0);
    pixel(ctx, INK, x, y - radius, 1, radius * 2 + 1);
    pixel(ctx, BLUE, x, y - radius + 1, 1, radius * 2 - 1);
    pixel(ctx, WATER, x, y - radius + 1, 1, radius + 1);
    pixel(ctx, RIM, x, y - 1);
    if (wave < 8) pixel(ctx, FOAM, x, y - 1);
    if (radius >= 3 && wave >= 11 && wave < 16) pixel(ctx, WATER, x, y + 1);
  }
  ctx.restore();
}

export function drawWatergun(ctx: CanvasRenderingContext2D, layer: 'back' | 'front' | 'particles', frame: number, source: Point, target: Point, missed = false) {
  const dir = target.x >= source.x ? 1 : -1;
  const hit = frame - WATERGUN_FX.hitFrame;
  ctx.save();
  if (layer === 'front') {
    if (frame < JET_HEAD.length) drawJet(ctx, frame, source, target, dir);
    // 命中的水冠先向前翻開，之後只留下幾道較細的水絲。
    if (!missed && hit >= 0 && hit < 5) {
      ctx.globalAlpha *= [1, 1, 0.92, 0.74, 0.5][hit];
      const spread = 1 + hit * 0.55;
      for (let i = 0; i < 8; i++) {
        const [vx, vy] = SPRAY[i];
        const reach = 4 + hit * 2.4;
        for (let p = 1; p <= reach; p++) {
          const x = target.x + dir * vx * p * 0.68;
          const y = target.y + vy * p * 0.76 + p * p * hit * 0.017;
          const thick = Math.max(1, Math.round(4 - p / spread - hit * 0.35));
          pixel(ctx, BLUE, x - thick / 2, y, thick + 1, thick);
          pixel(ctx, p >= reach - 1 ? FOAM : WATER, x, y - 1, thick, 1);
        }
      }
      if (hit < 2) {
        pixel(ctx, INK, target.x - 5, target.y - 2, 11, 6);
        pixel(ctx, WATER, target.x - 6, target.y - 1, 13, 4);
        pixel(ctx, FOAM, target.x - 3, target.y - 2, 7, 3);
      }
    }
  } else if (layer === 'back' && hit >= 0 && !missed) {
    // 透明的水環落在角色後方，留出水冠和前景水珠的層次。
    ctx.globalAlpha *= (1 - hit / 7) * 0.74;
    const radius = 8 + hit * 4;
    for (let i = 0; i < 30; i++) {
      if (i % 7 === 0) continue;
      const angle = i * Math.PI / 15;
      const x = target.x + Math.cos(angle) * radius;
      const y = target.y + 6 + Math.sin(angle) * radius * 0.42;
      pixel(ctx, BLUE, x, y + 1, 3);
      pixel(ctx, i < 15 ? RIM : WATER, x, y, 3);
    }
  } else if (layer === 'particles') {
    if (hit < 0) {
      if (frame >= 2) {
        const p = JET_HEAD[frame] * 0.67;
        const x = source.x + (target.x - source.x) * p;
        const y = source.y + (target.y - source.y) * p;
        pixel(ctx, INK, x, y + 5, 4, 2);
        pixel(ctx, WATER, x + 1, y + 5, 2, 1);
        pixel(ctx, RIM, x - 5 * dir, y - 6, 2, 1);
        pixel(ctx, BLUE, x - 10 * dir, y + 3, 2, 1);
        pixel(ctx, WATER, x - 14 * dir, y + 7);
      }
    } else if (!missed) {
      const travel = 2.5 + hit * 1.65;
      ctx.globalAlpha *= 1 - hit / 8;
      for (const [i, [vx, vy, size]] of SPRAY.entries()) {
        if (hit > 4 && i % 3 === 0) continue;
        const x = target.x + dir * vx * travel;
        const y = target.y + vy * travel + hit * hit * 0.6;
        pixel(ctx, INK, x, y, size + 1, size + 1);
        pixel(ctx, WATER, x + 1, y, size, size);
        if (size > 1) pixel(ctx, RIM, x + 1, y);
      }
    }
  }
  ctx.restore();
}
