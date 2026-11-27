// 靈龜素材為橫向圖集。龜殼與施術光使用相同的角色座標。
const urls = import.meta.glob('../art/oracle/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const sheets = new Map<string, HTMLImageElement>();
let loading: Promise<void> | undefined;
export function loadOracleArt() {
  return loading ??= Promise.all(Object.entries(urls).map(async ([path,url]) => {
    const img = new Image(); img.src = url;
    await img.decode();
    sheets.set(path.split('/').pop()!.slice(0,-4), img);
  })).then(() => {});
}

type Rect = { x: number; y: number; w: number };
function layer(c: CanvasRenderingContext2D, name: string, frame: number, width: number, r: Rect, flip = false) {
  const image = sheets.get(name);
  if (!image) return;
  c.save(); c.imageSmoothingEnabled = false;
  c.translate(Math.round(r.x + (flip ? r.w : 0)), Math.round(r.y));
  if (flip) c.scale(-1,1);
  c.drawImage(image, frame * width, 0, width, 128, 0, 0, r.w, r.w * 128 / width);
  c.restore();
}
export function drawOmen(c: CanvasRenderingContext2D, marks: number[], elapsed: number, idle: number, r: Rect, flip: boolean) {
  const w = r.w / 128;
  c.save();
  c.translate(Math.round(r.x + (flip ? r.w : 0)), Math.round(r.y));
  c.scale(flip ? -w : w, w);
  c.translate(0, idle >= 2 && idle <= 4 ? -1 : 0);
  marks.forEach((id, index) => {
    const x = [0, 44, 72, 128];
    const frame = index === marks.length - 1 ? Math.min(5, Math.floor(elapsed / .09)) : 5;
    c.save(); c.beginPath(); c.rect(x[id], 0, x[id+1] - x[id], 128); c.clip();
    layer(c, 'omen_' + (id+1), frame, 128, {x:0,y:0,w:128});
    c.restore();
  });
  // 龜魂的瞳光從細縫逐層張開。
  c.fillStyle = '#88deff';
  c.fillRect(64, 84 - marks.length / 2, 2, marks.length);
  c.restore();
}
export function drawOracleTide(c: CanvasRenderingContext2D, frame: number, caster: Rect, flip: boolean, target: Rect, front: boolean) {
  const width = caster.w * 1.5;
  const ring = {x: target.x + target.w / 2 - width / 2, y: target.y + target.w - width * 88 / 192, w: width};
  if (front) {
    layer(c, 'tide_caster', frame, 128, caster, flip);
    layer(c, 'tide_particles', frame, 192, ring);
  } else layer(c, 'tide_target', frame, 192, ring);
}
