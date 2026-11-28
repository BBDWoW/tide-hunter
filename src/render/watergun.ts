// 水槍：以場景像素畫出聚水、射流、命中水冠與落水，施術與命中點跟隨角色。
export const WATERGUN_FX = { frames: 12, frameMs: 64, hitFrame: 5 };
const INK = '#174675', BLUE = '#2580bf', WATER = '#43c6ef', RIM = '#a0f1ff', FOAM = '#f4ffff';

type Point = { x: number; y: number };
const JET_HEAD = [0.16, 0.44, 0.74, 1, 1];
const JET_LENGTH = [13, 24, 31, 34, 19];
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
  const head = JET_HEAD[frame - 2];
  const length = Math.min(Math.ceil(head * distance), JET_LENGTH[frame - 2]);
  for (let i = length; i >= 0; i--) {
    const p = Math.max(0, head - i / distance);
    const x = source.x + dir * p * distance;
    const tail = i / Math.max(1, length);
    const y = source.y + (target.y - source.y) * p - Math.sin(p * Math.PI) * 8
      + Math.sin(i * 0.34 + frame) * tail * 2.5;
    const nose = Math.sqrt(Math.min(1, (i + 1) / 6));
    const width = Math.max(1, Math.round(nose * (1 - tail) ** 0.7 * (frame === 6 ? 4 : 6)));
    pixel(ctx, INK, x, y - width, 1, 2 * width + 1);
    if (width < 2) continue;
    pixel(ctx, BLUE, x, y - width + 1, 1, 2 * width - 1);
    const crest = Math.round(Math.sin(i * 0.38 - frame * 1.1) * 1.3);
    pixel(ctx, WATER, x, y - width + 1, 1, Math.max(1, width + crest));
    if ((i + frame * 3) % 13 < 9) pixel(ctx, RIM, x, y - width + 1);
    if (width >= 4) {
      if ((i + frame * 2) % 17 < 8) pixel(ctx, FOAM, x, y - 2 + crest);
      if ((i + frame) % 11 < 4) pixel(ctx, WATER, x, y + 2);
    }
  }
}

export function drawWatergun(ctx: CanvasRenderingContext2D, layer: 'back' | 'front' | 'particles', frame: number, source: Point, target: Point) {
  const dir = target.x >= source.x ? 1 : -1;
  const hit = frame - WATERGUN_FX.hitFrame;
  ctx.save();
  if (layer === 'front') {
    if (frame < 2) {
      const x = source.x + (3 + frame * 2) * dir, y = source.y;
      pixel(ctx, INK, x - 3, y - 1, 7, 4);
      pixel(ctx, INK, x - 2, y - 3, 5, 8);
      pixel(ctx, BLUE, x - 2, y - 2, 5, 6);
      pixel(ctx, WATER, x - 2, y - 2, 5, 4);
      pixel(ctx, RIM, x - 1, y - 2, 3);
      pixel(ctx, FOAM, x + dir, y - 1);
      if (frame === 1) {
        pixel(ctx, RIM, x + 6 * dir, y - 4, 2);
        pixel(ctx, WATER, x - 7 * dir, y + 4, 2);
      }
    } else if (frame <= 6) {
      drawJet(ctx, frame, source, target, dir);
    }
    // 命中的水冠先向前翻開，之後只留下幾道較細的水絲。
    if (hit >= 0 && hit < 5) {
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
  } else if (layer === 'back' && hit >= 0) {
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
        const p = JET_HEAD[frame - 2] * 0.67;
        const x = source.x + (target.x - source.x) * p;
        const y = source.y + (target.y - source.y) * p - Math.sin(p * Math.PI) * 8;
        pixel(ctx, INK, x, y + 5, 4, 2);
        pixel(ctx, WATER, x + 1, y + 5, 2, 1);
        pixel(ctx, RIM, x - 5 * dir, y - 6, 2, 1);
        pixel(ctx, BLUE, x - 10 * dir, y + 3, 2, 1);
        pixel(ctx, WATER, x - 14 * dir, y + 7);
      }
    } else {
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
