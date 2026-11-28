// 初始夥伴的技能特效。像素圖塊只繪製一次，戰鬥時貼到角色目前的定位點。
export type FxLayer = 'back' | 'front' | 'particles';
export interface FxPoint { x: number; y: number }

type DrawSkill = (ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) => void;
export interface AnimatedFx {
  frames: number;
  frameMs: number;
  hitFrame: number;
  socket: string;
  draw: DrawSkill;
  dash?: (frame: number, missed: boolean) => number;
}

function pixel(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function tile(rows: string[], colors: Record<string, string>) {
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

const bubble = tile([
  '....dddd.....',
  '..ddaaaadd...',
  '.daaawwaabd..',
  '.dawwaaaaibd.',
  'dawbiiiiibibd',
  'daibiii.iaibd',
  'daibi...ibibd',
  'dabii..iaibcd',
  '.dbiiiiabbcd.',
  '.dbbaabbcccd.',
  '..dcccccdd...',
  '....dddd.....',
], {
  d: '#294c77', a: '#87e6eb', w: '#efffff', b: '#4aafd4', c: '#aca2ef', i: '#93cee65c',
});
const ember = tile([
  '............d......',
  '.....d.....drrd....',
  '......dd.ddroord...',
  '...dd...droooorrd..',
  '.....dddrooyyyorrd.',
  '..dddrrrooyywwyorrd',
  'drrrrooooyywwwyorrd',
  '...dddrrrooyyyorrd.',
  '.......ddrroorrd...',
  '.........ddddd.....',
], { d: '#572d3c', r: '#bd492d', o: '#f67a38', y: '#ffc15b', w: '#fff2a0' });
const flame = tile([
  '.........d.......',
  '........drd......',
  '.......drod......',
  '....d..drood..d..',
  '...drd.drooyddrd.',
  '..drooddroooyord.',
  '..drooordroyyord.',
  '.drooyoodoyyworod',
  '.drooyyyyoywwyorod',
  'drooywwyywwwyyorod',
  '.drooyyywyyyorrd.',
  '..ddrroooorrdd...',
  '....dddddddd.....',
], { d: '#572d3c', r: '#bc482d', o: '#f67a38', y: '#ffc15b', w: '#fff2a0' });
const leaf = tile([
  '.............ddddd.',
  '.........ddddggydd',
  '......dddgggyyyd.',
  '....ddgggyyyyld..',
  '..ddggyyywllld...',
  '.dyyywwlllldd....',
  'dwwyllllddd......',
  '.ddmllld.........',
  '...dddd..........',
], { d: '#1c5148', m: '#368e60', g: '#66ba68', l: '#9cde7d', y: '#c3e98a', w: '#f3ffd0' });
const slash = tile([
  '...................ddd..',
  '...............ddddgwd..',
  '............dddgggwwd...',
  '..........ddgggywwdd....',
  '........ddggywwwdd......',
  '......ddggywwwdd........',
  '.....dggywwydd..........',
  '...ddgywwydd............',
  '..dgywwydd..............',
  '.dgywydd................',
  '.dwdd...................',
  '.dd.....................',
], { d: '#236454', g: '#61ae63', y: '#a8ec7c', w: '#f4ffe0' });
const collision = tile([
  '.........d.............',
  '........dwd............',
  'd.......dwd.......dd...',
  '.dd....dywd....dddwd...',
  '..dyd..dywd.dddywdd....',
  '...dyd.dywwdywwdd......',
  '....dyddwwwwydd........',
  '..dddywwwwwwwdddddddd..',
  'ddyyywwwwwwwwwwwwyyydd.',
  '..dddywwwwwwwdddddddd..',
  '....dyddwwwwydd........',
  '...dyd.dywwdywwdd......',
  '..dyd..dywd.dddywdd....',
  '.dd....dywd....dddwd...',
  'd.......dwd.......dd...',
  '........dwd............',
  '.........d.............',
], { d: '#634752', y: '#e6ab75', w: '#fff1cb' });

const direction = (source: FxPoint, target: FxPoint) => target.x >= source.x ? 1 : -1;
function travel(source: FxPoint, target: FxPoint, t: number, rise = 0): FxPoint {
  return {
    x: source.x + (target.x - source.x) * t,
    y: source.y + (target.y - source.y) * t - 4 * rise * t * (1 - t),
  };
}

const BUBBLE_HIT = 7;
const BUBBLES = [
  { start: 0, lift: 7, size: 1, x: -4, y: -6 },
  { start: 1, lift: -5, size: .75, x: -10, y: 7 },
  { start: 2, lift: 16, size: .83, x: 4, y: -12 },
  { start: 2, lift: 0, size: .55, x: 8, y: 2 },
  { start: 3, lift: 10, size: .54, x: -4, y: -17 },
];
const POP_SHARDS = [[-1, -1], [0, -1.2], [1.1, -.65], [1, .45], [.15, .95], [-.85, .6]];

function drawBubble(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const dir = direction(source, target), hit = frame - BUBBLE_HIT;
  if (layer === 'front' && hit < 0) {
    for (const b of BUBBLES) {
      if (frame < b.start) continue;
      const p = (frame - b.start) / (BUBBLE_HIT - b.start);
      const end = { x: target.x + dir * b.x, y: target.y + b.y };
      const q = travel(source, end, p, b.lift);
      bubble(ctx, q.x, q.y, 1, b.size * Math.min(1, .48 + p * 2));
    }
  } else if (layer === 'front' && !missed && hit >= 0 && hit <= 4) {
    // 泡膜從每顆泡泡的位置破開，外圈留下短水弧。
    ctx.globalAlpha *= [1, .95, .78, .58, .33][hit];
    for (const b of BUBBLES.slice(0, 3)) {
      const radius = 4 * b.size + hit * 2;
      for (const [i, [vx, vy]] of POP_SHARDS.entries()) {
        const x = target.x + dir * b.x + vx * radius;
        const y = target.y + b.y + vy * radius + hit * .65;
        pixel(ctx, '#4373aa', x - 1, y + 1, 3);
        pixel(ctx, i < 2 ? '#efffff' : '#a3eaf4', x, y, i % 2 ? 2 : 1);
      }
    }
  } else if (layer === 'particles' && hit >= 0 && !missed) {
    ctx.globalAlpha *= 1 - hit / 7;
    for (const [i, [x, y]] of POP_SHARDS.entries()) {
      pixel(ctx, i % 2 ? '#acdafa' : '#b6a0ef', target.x + dir * x * (9 + 3 * hit), target.y + y * (10 + 2 * hit) + hit * hit * .55, i % 2 + 1);
    }
  }
}

const EMBER_HIT = 5;
const CINDERS = [[-1.5, -.8], [-.7, -1.6], [.1, -2], [.9, -1.8], [1.3, -.9], [1.5, .15], [-1.25, .1], [.35, -.95]];
function drawEmber(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const dir = direction(source, target), hit = frame - EMBER_HIT;
  if (layer === 'front' && hit < 0) {
    const p = [0, .08, .25, .49, .76][frame];
    const q = travel(source, target, p, 5);
    ember(ctx, q.x, q.y, dir, frame ? .95 : .55);
    if (frame >= 2) ember(ctx, q.x - dir * 13, q.y + 4, dir, .46);
  } else if (hit >= 0 && !missed) {
    if (layer === 'front' && hit <= 4) {
      ctx.globalAlpha *= [1, 1, .9, .68, .44][hit];
      const height = [0, 4, 8, 10, 11][hit];
      flame(ctx, target.x, target.y - height, dir, [1.15, 1.45, 1.36, 1, .64][hit]);
      flame(ctx, target.x + dir * (9 + hit), target.y + 3 - height, -dir, .65);
    } else if (layer === 'back' && hit < 4) {
      ctx.globalAlpha *= .44 - hit * .1;
      flame(ctx, target.x + dir * 4, target.y - 7 - hit * 3, -dir, 1.7);
    } else if (layer === 'particles') {
      ctx.globalAlpha *= 1 - hit / 7;
      for (const [i, [vx, vy]] of CINDERS.entries()) {
        const x = target.x + dir * vx * (5 + hit * 3);
        const y = target.y + vy * (5 + hit * 2) - hit;
        pixel(ctx, '#bd492d', x - 1, y + 1, 3);
        pixel(ctx, i % 3 ? '#ffc15b' : '#fff2a0', x, y, 2);
      }
    }
  }
}

const LEAF_HIT = 5;
const LEAVES = [[-9, 10, .95], [1, -13, .67], [-14, 0, .6]];
function drawLeafblade(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const dir = direction(source, target), hit = frame - LEAF_HIT;
  if (layer === 'front' && hit <= 0) {
    const p = [0, .12, .3, .54, .79, 1][frame];
    for (const [i, [x, arc, size]] of LEAVES.entries()) {
      if (i > frame) continue;
      const q = travel(source, target, p, arc);
      leaf(ctx, q.x + x * p * dir, q.y + Math.sign(arc) * p * 5, dir, size * (frame ? 1 : .55));
    }
  }
  if (hit < 0 || missed) return;
  if (layer === 'front' && hit <= 4) {
    ctx.globalAlpha *= [1, .95, .74, .48, .26][hit];
    slash(ctx, target.x + dir * hit * 3, target.y - hit * 1.5, dir, [1, 1.45, 1.55, 1.5, 1.42][hit]);
    if (hit <= 2) slash(ctx, target.x - dir * 8, target.y + 6, dir, .56);
  } else if (layer === 'particles') {
    ctx.globalAlpha *= 1 - hit / 7;
    for (const [i, [vx, vy]] of POP_SHARDS.entries()) {
      const x = target.x + dir * vx * (9 + hit * 3), y = target.y + vy * (6 + hit * 2) + hit * hit * .45;
      if (i % 2 === 0) leaf(ctx, x, y, dir * Math.sign(vx || 1), .24);
      else pixel(ctx, '#c3e98a', x, y, 2);
    }
  }
}

const TACKLE_HIT = 5;
const DASH_STEPS = [0, -.04, -.07, .13, .57, 1, .8, .51, .22, .05, 0];
function tackleDash(frame: number, missed: boolean) {
  const at = Math.floor(frame), from = DASH_STEPS[at] ?? 0, to = DASH_STEPS[at + 1] ?? 0;
  return (from + (to - from) * (frame - at)) * (missed ? .72 : 1);
}
function drawTackle(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const dir = direction(source, target), hit = frame - TACKLE_HIT;
  if (layer === 'back' && frame >= 2 && frame <= 6) {
    const length = [5, 11, 21, 24, 10][frame - 2];
    ctx.globalAlpha *= [.44, .58, .88, .76, .4][frame - 2];
    for (const [shift, y, w] of [[14, -5, length], [20, 0, length + 4], [11, 6, length - 2]]) {
      const left = source.x - dir * shift - (dir > 0 ? w : 0);
      pixel(ctx, '#635f78', left, source.y + y + 1, w);
      pixel(ctx, '#e4e1d7', left + 2, source.y + y, w - 2);
    }
  }
  if (hit < 0 || missed) return;
  if (layer === 'front' && hit <= 3) {
    ctx.globalAlpha *= [1, .9, .6, .34][hit];
    collision(ctx, target.x + dir * hit * 2, target.y, dir, [1.12, 1.26, 1.38, 1.38][hit]);
  } else if (layer === 'particles') {
    ctx.globalAlpha *= 1 - hit / 6;
    for (const [i, [vx, vy]] of POP_SHARDS.entries()) {
      const x = target.x + dir * vx * (11 + hit * 3);
      const y = target.y + vy * (7 + hit * 2) + hit * hit * .6;
      pixel(ctx, '#93747a', x - 1, y + 1, 3);
      pixel(ctx, i < 3 ? '#fff1cb' : '#e6ab75', x, y, 2);
    }
  }
}

export const STARTER_FX: Partial<Record<string, AnimatedFx>> = {
  bubble: { frames: 14, frameMs: 56, hitFrame: BUBBLE_HIT, socket: 'mouth', draw: drawBubble },
  tackle: { frames: 11, frameMs: 52, hitFrame: TACKLE_HIT, socket: 'body', draw: drawTackle, dash: tackleDash },
  ember: { frames: 12, frameMs: 58, hitFrame: EMBER_HIT, socket: 'mouth', draw: drawEmber },
  leafblade: { frames: 12, frameMs: 54, hitFrame: LEAF_HIT, socket: 'crown', draw: drawLeafblade },
};
