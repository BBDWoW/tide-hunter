// 冰晶的高光、陰面、破冰粉塵分層，讓冰封峽灣裡的特效仍清楚。
import { dashProgress, direction, drawJawPair, pixel, tile, travel, type AnimatedFx, type FxLayer, type FxPoint } from './skill-fx-helpers';

const ICE = { d: '#314771', b: '#638db4', t: '#91bfd8', h: '#b9e2ef', w: '#f2fffb' };
const SHARDS = [[-1.1, -.42], [-.73, -.85], [-.28, -1.15], [.33, -1.28], [.78, -.8], [1.1, -.34], [.86, .34], [-.73, .42]] as const;

const hailstone = tile([
  '.....ddddd....',
  '...ddhwhwtd...',
  '..dhwwhttbdd..',
  '.dhwhhtbbtthd.',
  'dhwhhttbthhhbd',
  'dthhttbbhhhtbd',
  'dtttbddtwhtbbd',
  '.dbbdbbthtbbd.',
  '..dbbbbbbbdd..',
  '...dddddddd...',
], ICE);
const needle = tile([
  '............dddd.....',
  '........ddddhwwddd...',
  '....ddddbthwhwhhhddd.',
  'ddddthhwwwwwhhhtttbbd',
  '.ddddbbbthhhhttbbbdd.',
  '...ddtbbbbbbbdddd....',
  '.....dddddddd........',
], ICE);
const iceChip = tile([
  '...dd..',
  '..dhwd.',
  '.dhwtd.',
  'dhwtd..',
  'dttbd..',
  '.ddd...',
], ICE);
const frostDust = tile([
  '.......h..w..........',
  '...t...w.hth...h.....',
  '.t..w.thhtwht.wth.t..',
  '...hthhwttthhthwhht..',
  '.hthwhhthhtthhhthtb..',
  'bthhhhttwhtthhhtttbb.',
  '.bbthhtttttttttbbbd..',
  '...ddddbbbbbbddddd...',
], ICE);
const iceWall = tile([
  '.........dddd.........',
  '........dhhwwd........',
  '.......dhtwhtbd.......',
  '......dhtwhtttbd......',
  '......dhwwhtthbd......',
  '.....dhttwhtthtbd.....',
  '.....dhtwhtthhtbd.....',
  '....dhttwhtttwtbd.....',
  '....dhtwhtthhtbbd.....',
  '...dhttwhtthhtbbd...dd',
  '...dhtwhtthhtbbd..dhwd',
  '..dhttwhtthhttbd.dhwtd',
  '..dhtwhtthhtbbddhtwtd.',
  '.dhttwhtthhtbbdhtwtd..',
  '.dhtwhtthhtbbdhtwtd...',
  'dhttwhtthhttbdtwtd....',
  'dhtwhtthhtbbdtwtd.....',
  'dhtwhtthtbbdtwtd......',
  'dtttttttbbbdtbd.......',
  '.dbbbbbbbbbbbd........',
  '..ddddddddddd.........',
], ICE);
const jaw = tile([
  '.......ddddddddddd.........',
  '....dddthhhhhhhttdddd......',
  '..ddthwhtwwtwhtwhhttbdd...',
  'ddthwwhhtwwhtwwhtwwhtbbd..',
  'dthhwwhddwwhddwwhddwwhtbd.',
  '.dthwwd.dwwd.dwwd.dwwtbd..',
  '..dwwd..dhd..dhd..dwtbd...',
  '...dd....d....d....dbd....',
  '....................d......',
], ICE);
const fracture = tile([
  '....dddddd.........ddd.....',
  '...dbthhtbdd.....ddhtbdd...',
  '..dthwwthhtbd..ddthwwttbd..',
  '.dthwwhhtttbdddbthhwtthbbd.',
  '.dthwhhttbbdddbthwttthtbbd.',
  'dbthhttttbd..dthwtttbthbbbd',
  'dbtbbtbbdd..dbtthhhtthtbbdd',
  '.dddddddd...dbbbtttbbbbdd..',
  '.............dddddddddd....',
], ICE);
const splitIce = tile([
  '....dddddddd........dddddddddd......',
  '...dbtthhhttdddd...dbtthhhhttbdd....',
  '..dbtthwhhhttbddd.dbthwwhhhttbbdd..',
  '.dbthwwhhhtttbdddddbthhhwwhhttbbdd.',
  'dbthhhttddddddddbbdtttthhhttbbbdbd.',
  'dbtttddddbtttttbbddddddddddbdbbdddd',
  'dbbbdbttthhttttbbbd..ddbtthttttbd..',
  '.ddddbthhtttttbbd.....dbttttbbd....',
  '...ddbbbbbbbbddd.......dbbbbbdd....',
  '.....ddddddddd..........dddddd.....',
], ICE);

const SPRAY_FRAMES = [1, .91, .74, .53, .32] as const;
function iceSpray(ctx: CanvasRenderingContext2D, point: FxPoint, hit: number, dir: number, reach: number) {
  ctx.globalAlpha *= 1 - hit / 9;
  for (const [i, [x, y]] of SHARDS.entries()) {
    iceChip(ctx, point.x + dir * x * (reach + hit * 3.4), point.y + y * (reach - 2 + hit * 2.5) + hit * hit * .56, i % 2 ? dir : -dir, i % 3 ? .5 : .7);
  }
}

const PEBBLE_HIT = 6;
function drawIcepebble(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const hit = frame - PEBBLE_HIT, dir = direction(source, target);
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    const p = [0, .08, .23, .42, .59, .81, 1, 1.14][frame];
    const q = travel(source, target, p, 16);
    if (hit >= 0) ctx.globalAlpha *= hit ? .37 : .69;
    hailstone(ctx, q.x, q.y, frame % 3 === 1 ? -dir : dir, frame % 3 === 0 ? .84 : 1.03);
    if (frame >= 2) iceChip(ctx, q.x - dir * 10, q.y + 3, -dir, .44);
  } else if (hit >= 0 && !missed) {
    if (layer === 'front' && hit < 5) {
      ctx.globalAlpha *= SPRAY_FRAMES[hit];
      frostDust(ctx, target.x + dir * hit * 2, target.y + 5, dir, .82 + hit * .16);
      iceChip(ctx, target.x - dir * 4, target.y - 6 - hit * 2, -dir, .97 - hit * .12);
      iceChip(ctx, target.x + dir * (7 + hit * 3), target.y - hit * 2, dir, .9 - hit * .11);
      if (hit === 0) pixel(ctx, ICE.w, target.x - 3, target.y, 7, 3);
    } else if (layer === 'particles') iceSpray(ctx, target, hit, dir, 10);
  }
}

const SHARD_HIT = 4;
function drawIceshard(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const hit = frame - SHARD_HIT, dir = direction(source, target);
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    const q = travel(source, target, [0, .15, .42, .73, 1, 1.14][frame]);
    if (hit >= 0) ctx.globalAlpha *= hit ? .36 : .68;
    needle(ctx, q.x, q.y, dir, .69 + Math.min(frame, 4) * .13);
    if (frame >= 2) iceChip(ctx, q.x - dir * 16, q.y + 4, -dir, .42);
  } else if (hit >= 0 && !missed) {
    if (layer === 'front' && hit <= 3) {
      ctx.globalAlpha *= SPRAY_FRAMES[hit];
      needle(ctx, target.x + dir * (3 + hit * 6), target.y - 1 - hit * 2, dir, 1.18 - hit * .16);
      frostDust(ctx, target.x + dir * (5 + hit * 3), target.y + 7, dir, .69 + hit * .11);
      if (hit === 0) pixel(ctx, ICE.w, target.x - 2, target.y, 6, 3);
    } else if (layer === 'particles') iceSpray(ctx, target, hit, dir, 11);
  }
}

const FANG_HIT = 5;
const FANG_STEPS = [0, -.05, -.04, .18, .61, 1, .94, .69, .41, .18, 0];
function drawFrostfang(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean, dir: number) {
  const hit = frame - FANG_HIT;
  if (layer === 'front' && hit < 0) {
    if (frame < 3) iceChip(ctx, source.x + dir * 4, source.y, dir, .68 + frame * .14);
    else drawJawPair(ctx, jaw, { x: source.x + dir * 7, y: source.y }, dir, 6 + frame, .71 + frame * .035);
  } else if (hit >= 0 && !missed) {
    if (layer === 'back' && hit <= 3) {
      ctx.globalAlpha *= .56 - hit * .09;
      frostDust(ctx, target.x + dir * 6, target.y - 6, -dir, 1.43 + hit * .17);
    } else if (layer === 'front' && hit < 5) {
      ctx.globalAlpha *= SPRAY_FRAMES[hit];
      drawJawPair(ctx, jaw, target, dir, [4, 3, 4, 6, 8][hit], [1.05, 1.16, 1.08, .97, .88][hit]);
      if (hit === 0) pixel(ctx, ICE.w, target.x - 3, target.y - 1, 8, 4);
    } else if (layer === 'particles') iceSpray(ctx, target, hit, dir, 12);
  }
}

const WALL_HIT = 6;
function drawIcewall(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, center: FxPoint, _target: FxPoint, _miss: boolean, dir: number) {
  const hit = frame - WALL_HIT;
  const rise = [.2, .28, .41, .58, .78, 1, 1.2, 1.23, 1.23, 1.22, 1.2, 1.17, 1.13, 1.08][frame];
  if (hit >= 3) ctx.globalAlpha *= [1, .79, .63, .43, .22][hit - 3];
  if (layer === 'back') {
    ctx.globalAlpha *= .59;
    iceWall(ctx, center.x + dir * 8, center.y + 14 - rise * 11, dir, rise * 1.2);
    frostDust(ctx, center.x + dir * 11, center.y + 16, -dir, .9 + rise * .44);
  } else if (layer === 'front') {
    iceWall(ctx, center.x + dir * 21, center.y + 13 - rise * 14, dir, rise * 1.28);
    if (frame >= 4) iceWall(ctx, center.x + dir * 28, center.y + 15 - rise * 7, -dir, rise * .63);
    if (hit >= 0 && hit <= 2) pixel(ctx, ICE.w, center.x + dir * 19, center.y - 7, 4, 7);
  } else if (frame >= 3) iceSpray(ctx, { x: center.x + dir * 18, y: center.y + 7 }, Math.max(0, hit), dir, 11);
}

const HAIL_HIT = 6;
function drawHail(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, _source: FxPoint, target: FxPoint, missed: boolean, dir: number) {
  const hit = frame - HAIL_HIT;
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    const drop = [49, 44, 37, 28, 18, 8, 0, -2][frame];
    if (hit >= 0) ctx.globalAlpha *= hit ? .34 : .62;
    hailstone(ctx, target.x - dir * (drop * .24), target.y - drop, frame % 2 ? dir : -dir, .94 + frame * .03);
    if (frame >= 2) iceChip(ctx, target.x - dir * (4 + drop * .24), target.y - drop - 10, dir, .44);
  } else if (hit >= 0 && !missed) {
    if (layer === 'front' && hit < 5) {
      ctx.globalAlpha *= SPRAY_FRAMES[hit];
      frostDust(ctx, target.x, target.y + 7, dir, 1.19 + hit * .21);
      iceChip(ctx, target.x - dir * (6 + hit * 4), target.y - 5 - hit * 2.5, -dir, 1.03 - hit * .13);
      iceChip(ctx, target.x + dir * (5 + hit * 4), target.y - 4 - hit * 2, dir, .92 - hit * .1);
      if (hit === 0) pixel(ctx, ICE.w, target.x - 3, target.y - 2, 8, 3);
    } else if (layer === 'particles') iceSpray(ctx, target, hit, dir, 13);
  }
}

const CRACK_HIT = 6;
const CRACK_STEPS = [0, -.04, 0, .12, .34, .68, 1, .92, .71, .5, .25, .08, 0];
function drawFrostcrack(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, ground: FxPoint, missed: boolean, dir: number) {
  const hit = frame - CRACK_HIT;
  if (layer === 'back' && frame >= 2 && hit < 1) {
    ctx.globalAlpha *= .66;
    frostDust(ctx, source.x - dir * 13, source.y + 11, -dir, .62 + frame * .11);
  }
  if (layer === 'front' && hit < 0) {
    const leading = [.02, .1, .23, .39, .59, .8][frame];
    const near = travel({ x: source.x, y: source.y + 12 }, ground, leading);
    fracture(ctx, near.x, near.y + 1, dir, .62 + frame * .085);
  } else if (hit >= 0 && !missed) {
    if (layer === 'back' && hit <= 4) {
      ctx.globalAlpha *= .58 - hit * .1;
      splitIce(ctx, ground.x + dir * (4 + hit * 3), ground.y + 1, dir, 1.55 + hit * .13);
      frostDust(ctx, ground.x + dir * 8, ground.y - 5, -dir, 1.44 + hit * .2);
    } else if (layer === 'front' && hit < 5) {
      ctx.globalAlpha *= SPRAY_FRAMES[hit];
      fracture(ctx, ground.x + dir * (7 + hit * 4), ground.y - 3, dir, 1.45 + hit * .11);
      fracture(ctx, ground.x - dir * (13 + hit * 3), ground.y - 1, -dir, .88 + hit * .09);
      if (hit === 0) pixel(ctx, ICE.w, ground.x - 4, ground.y - 5, 11, 3);
    } else if (layer === 'particles') iceSpray(ctx, ground, hit, dir, 16);
  }
}

export const FROST_FX: Partial<Record<string, AnimatedFx>> = {
  icepebble: { frames: 14, frameMs: 54, hitFrame: PEBBLE_HIT, socket: 'body', draw: drawIcepebble },
  iceshard: { frames: 11, frameMs: 50, hitFrame: SHARD_HIT, socket: 'body', draw: drawIceshard },
  frostfang: { frames: 13, frameMs: 55, hitFrame: FANG_HIT, socket: 'mouth', draw: drawFrostfang, dash: (frame, miss) => dashProgress(FANG_STEPS, frame, miss) },
  icewall: { frames: 14, frameMs: 57, hitFrame: WALL_HIT, socket: 'body', draw: drawIcewall, self: true },
  hail: { frames: 13, frameMs: 45, hitFrame: HAIL_HIT, socket: 'crown', draw: drawHail, repeat: true },
  frostcrack: {
    frames: 14, frameMs: 55, hitFrame: CRACK_HIT, socket: 'body', targetSocket: 'ground', draw: drawFrostcrack,
    dash: (frame, miss) => dashProgress(CRACK_STEPS, frame, miss),
  },
};
