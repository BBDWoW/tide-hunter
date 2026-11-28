// 技能特效共用的像素圖塊和座標運算。圖塊第一次使用時才建立畫布。
export type FxLayer = 'back' | 'front' | 'particles';
export interface FxPoint { x: number; y: number }

type DrawSkill = (ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean, face: number) => void;
export interface AnimatedFx {
  frames: number;
  frameMs: number;
  hitFrame: number;
  socket: string;
  targetSocket?: string;
  draw: DrawSkill;
  self?: boolean;
  repeat?: boolean;
  dash?: (frame: number, missed: boolean) => number;
  dashLift?: (frame: number) => number;
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

export function drawJawPair(ctx: CanvasRenderingContext2D, jaw: ReturnType<typeof tile>, point: FxPoint, dir: number, gap: number, scale: number) {
  jaw(ctx, point.x, point.y - gap, dir, scale);
  ctx.save();
  ctx.translate(point.x, point.y + gap);
  ctx.scale(1, -1);
  jaw(ctx, 0, 0, dir, scale);
  ctx.restore();
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

export function pixelArc(ctx: CanvasRenderingContext2D, center: FxPoint, rx: number, ry: number, start: number, span: number, color: string, width: number) {
  const count = Math.ceil(Math.max(rx, ry) * Math.abs(span));
  ctx.beginPath();
  for (let i = 0; i <= count; i++) {
    const t = start + span * i / count;
    const x = Math.round(center.x + Math.cos(t) * rx), y = Math.round(center.y + Math.sin(t) * ry);
    ctx.rect(x, y, width, width);
  }
  ctx.fillStyle = color;
  ctx.fill();
}

// 沿折線的長軸逐階繪製，將同一列的像素合併，保持折角銳利。
export function pixelStroke(ctx: CanvasRenderingContext2D, points: FxPoint[], color: string, width: number) {
  const inset = Math.floor(width / 2);
  ctx.beginPath();
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], x = Math.round(a.x), y = Math.round(a.y);
    const dx = Math.round(b.x) - x, dy = Math.round(b.y) - y;
    const steep = Math.abs(dy) > Math.abs(dx);
    const major = steep ? dy : dx, minor = steep ? dx : dy;
    const length = Math.abs(major), sign = Math.sign(major);
    let start = 0, row = 0;
    for (let step = 1; step <= length + 1; step++) {
      const next = Math.round(step * minor / Math.max(1, length));
      if (step <= length && next === row) continue;
      const run = Math.min(start * sign, (step - 1) * sign) - inset;
      const span = step - start + width - 1;
      if (steep) ctx.rect(x + row - inset, y + run, width, span);
      else ctx.rect(x + run, y + row - inset, span, width);
      start = step;
      row = next;
    }
  }
  ctx.fillStyle = color;
  ctx.fill();
}
