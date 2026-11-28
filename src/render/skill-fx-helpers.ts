// 技能特效共用的像素圖塊和座標運算。圖塊第一次使用時才建立畫布。
export type FxLayer = 'back' | 'front' | 'particles';
export interface FxPoint { x: number; y: number }

type DrawSkill = (ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean, face: number) => void;
export interface AnimatedFx {
  frames: number;
  frameMs: number;
  hitFrame: number;
  socket: string;
  draw: DrawSkill;
  dash?: (frame: number, missed: boolean) => number;
}

export function pixel(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

export function tile(rows: string[], colors: Record<string, string>) {
  const width = Math.max(...rows.map(row => row.length)), height = rows.length;
  let canvas: HTMLCanvasElement | undefined;
  return (ctx: CanvasRenderingContext2D, x: number, y: number, dir = 1, scale = 1) => {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const paint = canvas.getContext('2d')!;
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          if (row[x] !== '.') pixel(paint, colors[row[x]], x, y);
        }
      });
    }
    const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(dir, 1);
    ctx.drawImage(canvas, -Math.floor(w / 2), -Math.floor(h / 2), w, h);
    ctx.restore();
  };
}

export const direction = (source: FxPoint, target: FxPoint) => target.x >= source.x ? 1 : -1;
export function travel(source: FxPoint, target: FxPoint, t: number, rise = 0): FxPoint {
  return {
    x: source.x + (target.x - source.x) * t,
    y: source.y + (target.y - source.y) * t - 4 * rise * t * (1 - t),
  };
}

export function dashProgress(steps: number[], frame: number, missed: boolean) {
  const i = Math.floor(frame), from = steps[i] ?? 0, to = steps[i + 1] ?? 0;
  return (from + (to - from) * (frame - i)) * (missed ? .72 : 1);
}
