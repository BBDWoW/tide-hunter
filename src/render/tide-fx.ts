// 深淺兩層的浪峰與水沫，分別表現衝刺、聚水、聲波和漲潮。
import { dashProgress, direction, pixel, tile, travel, type AnimatedFx, type FxLayer, type FxPoint } from './skill-fx-helpers';

const WATER = { d: '#214d78', b: '#397fb0', t: '#55c5d9', h: '#a6e9e8', w: '#f2fff1' };
const W = WATER.w;
const FOAM = [[-1, -.63], [-.51, -1.1], [.23, -1.3], [.83, -.91], [1.14, -.38], [.9, .33], [-.8, .43]] as const;

const wake = tile([
  '...............ddd............',
  '..............dbhd............',
  '...........dddbtwhd....dd.....',
  '.....dd..ddtbbthwwd..ddhtd....',
  '....dbtddtbbtthwhdd.dhwhd.....',
  '..ddthwhtbbtthwhd..dtwhtd.....',
  'ddtttthhtbtthwwdd.ddwhbd......',
  'dhttttttttthwwtd.ddwhtd...dd..',
  '.ddbbtttthhwwbddbwhbdd..dthd..',
  '...ddbbtttttttdhwtbd..ddwhtd..',
  '.....ddbbtthttthtbbdddhwhbbd..',
  '.......ddbbttttttbbtthhbtbd...',
  '.........ddbbbbbbbbbbttbdd....',
  '...........dddddddddddd.......',
], WATER);
const tideCrest = tile([
  '.................ddd.............',
  '..............dddhhtddd..........',
  '...........dddbhwwwwhtdd.........',
  '.........ddbthwwwhtthwwtd........',
  '.......ddbtthwhtbbbddhwhtd.......',
  '.....ddbtthhwwtbbd...dwhtbd......',
  '....dbttthhwwtbbdd...dwwhbd......',
  '...dbbtthhwtbddd.....dhhtbd......',
  '..dbbtttwwtbdd......dhwhtd.......',
  '.dbbttthwtbdd......dtwhbd....dd..',
  'dbbttthhwtbddd....dthwbd...ddhdd.',
  'dbbtttthtttbbdd.ddhhwtbdd.dhwwtd.',
  'dbtttttttthhttttttthhhtbbdttwhbd.',
  'ddbbbbtttthhttthhhhhhttttttbbtbd.',
  '.ddbbbbttttttttttttttttbbbbbbdd..',
  '...ddddbbbbbbbbbbbbbbbbdddddd....',
], WATER);
const shard = tile([
  '...dd..',
  '..dhtd.',
  '.dhwhtd',
  'dhwwhtd',
  'dtwhtbd',
  '.dttbd.',
  '..ddd..',
], WATER);
const acoustic = tile([
  '.........dddd...',
  '.......ddthhtd..',
  '.....ddthwwhtbd.',
  '....dthwwhhhttd.',
  '...dthwht..dttbd',
  '..dthhtd....dtbd',
  '.dthhtd.....dtbd',
  'dthhtd......dhbd',
  '.dthhtd....dtwbd',
  '..dtwhtd..dhwtd.',
  '...dthwhddhwhtd.',
  '....dthwwwwhtd..',
  '.....ddthhtdd...',
  '.......dddd.....',
], WATER);
const pool = tile([
  '.....dddddddddd......',
  '..dddbbtttthhhbdd....',
  '.dbttthhhwwhhhtbbd...',
  'dbtthhhwwhhttttthbdd.',
  '.dbtttttttthhhwhtbbd.',
  '..dbbbbbtttttthtbbdd.',
  '....ddddbbbbbbbddd...',
], WATER);

const AQUAJET_HIT = 4;
const JET_DASH = [0, -.06, .18, .63, 1, .9, .63, .38, .15, 0];
function drawAquajet(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean, dir: number) {
  const hit = frame - AQUAJET_HIT;
  if (layer === 'back' && frame <= 7) {
    const size = [.44, .66, .96, 1.21, 1.25, .96, .76, .47][frame];
    ctx.globalAlpha *= [1, 1, 1, 1, .89, .71, .52, .3][frame];
    wake(ctx, source.x - dir * (12 + size * 9), source.y + 7, dir, size);
    if (frame >= 2) pool(ctx, source.x - dir * 25, source.y + 11, -dir, size * .88);
  } else if (layer === 'front') {
    if (hit < 0) {
      wake(ctx, source.x - dir * 7, source.y + 11, dir, .48 + frame * .086);
    } else if (!missed && hit < 4) {
      ctx.globalAlpha *= [1, .9, .62, .35][hit];
      wake(ctx, target.x + dir * hit * 3, target.y + 4, -dir, 1.05 - hit * .1);
      pool(ctx, target.x + dir * (4 + 4 * hit), target.y + 12, dir, .85 + hit * .16);
      if (hit === 0) pixel(ctx, W, target.x - 3, target.y, 8, 3);
    }
  } else if (layer === 'particles' && hit >= 0 && !missed) {
    ctx.globalAlpha *= 1 - hit / 8;
    for (const [i, [x, y]] of FOAM.entries()) {
      shard(ctx, target.x + dir * x * (10 + hit * 4), target.y + y * (9 + hit * 2) + hit * hit * .58, dir, i % 2 ? .43 : .59);
    }
  }
}

const CHARGE_HIT = 6;
function drawTidecharge(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, center: FxPoint, _target: FxPoint, _miss: boolean, dir: number) {
  const hit = frame - CHARGE_HIT;
  if (hit > 1) ctx.globalAlpha *= [1, .89, .68, .53, .35, .21][hit - 2];
  if (layer === 'back') {
    const closeness = [0, 0, 2, 4, 7, 12, 19, 20, 20, 19, 19, 19, 19, 19][frame];
    ctx.globalAlpha *= .61;
    wake(ctx, center.x - dir * (27 - closeness), center.y + 11 - closeness * .23, dir, .64 + closeness * .012);
    wake(ctx, center.x + dir * (26 - closeness), center.y + 13 - closeness * .26, -dir, .56 + closeness * .013);
  } else if (layer === 'front') {
    if (hit < 1) {
      const radius = [28, 27, 25, 21, 17, 12, 7][frame];
      for (const [i, [x, y]] of FOAM.entries()) {
        const size = .64 + (i % 3) * .14;
        shard(ctx, center.x + x * radius, center.y + y * radius * .79, i % 2 ? dir : -dir, size);
      }
    }
    if (hit >= 0) {
      shard(ctx, center.x + dir * 2, center.y - 1, dir, [1.55, 1.83, 1.64, 1.42, 1.27, 1.06, .83, .69][hit]);
      pool(ctx, center.x, center.y + 11, dir, 1.11 + hit * .038);
      if (hit === 0) pixel(ctx, W, center.x - 2, center.y - 3, 5, 5);
    }
  } else if (hit >= 0) {
    for (const [i, [x, y]] of FOAM.entries()) {
      if (i % 2 === 0) shard(ctx, center.x + x * (12 + hit), center.y + y * (10 + hit) - hit, dir, .42);
    }
  }
}

const CRY_HIT = 7;
function drawWhalecry(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const hit = frame - CRY_HIT, dir = direction(source, target);
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    const lead = [0, .05, .15, .3, .47, .65, .83, 1, 1.16][frame];
    for (let i = Math.min(2, Math.floor(frame / 2)); i >= 0; i--) {
      const p = travel(source, target, Math.max(0, lead - i * .14));
      ctx.save();
      ctx.globalAlpha *= (1 - i * .22) * (hit === 1 ? .48 : 1);
      acoustic(ctx, p.x, p.y, dir, .65 + frame * .155 - i * .11);
      ctx.restore();
    }
  } else if (hit >= 0 && !missed) {
    if (layer === 'back' && hit <= 4) {
      ctx.globalAlpha *= [.49, .43, .34, .24, .16][hit];
      acoustic(ctx, target.x + dir * (6 + hit * 2), target.y - 2, dir, 2.27 + hit * .18);
    } else if (layer === 'front' && hit <= 4) {
      ctx.globalAlpha *= [1, .93, .76, .54, .32][hit];
      acoustic(ctx, target.x + dir * (hit * 6), target.y, dir, 1.64 + hit * .23);
      pool(ctx, target.x + dir * (3 + hit * 4), target.y + 13, -dir, 1 + hit * .16);
      if (hit === 0) pixel(ctx, W, target.x - 4, target.y - 1, 9, 3);
    } else if (layer === 'particles') {
      ctx.globalAlpha *= 1 - hit / 8;
      for (const [i, [x, y]] of FOAM.entries()) {
        shard(ctx, target.x + dir * x * (15 + hit * 4), target.y + y * (13 + hit * 3), dir, i % 2 ? .47 : .6);
      }
    }
  }
}

const TIDE_HIT = 7;
function drawHightide(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, _miss: boolean, dir: number) {
  const hit = frame - TIDE_HIT;
  const lead = [.03, .12, .24, .38, .54, .7, .86, 1, 1.13, 1.22, 1.3, 1.38, 1.43, 1.46, 1.48, 1.5][frame];
  const a = travel(source, target, lead), b = travel(source, target, lead - .23);
  const height = [0, 1, 4, 7, 10, 13, 15, 17, 18, 18, 17, 14, 10, 8, 6, 4][frame];
  if (hit >= 1) ctx.globalAlpha *= [1, .96, .85, .71, .56, .4, .27, .18][hit - 1];
  if (layer === 'back') {
    const middle = travel(source, target, .5);
    const spread = Math.abs(target.x - source.x) * (.16 + height * .012);
    // 淺水先鋪過場中央，再由兩道白浪帶往兩側。
    ctx.save();
    ctx.translate(middle.x, middle.y + 11);
    ctx.scale(1, .5);
    ctx.globalAlpha *= .67;
    for (let i = -1; i <= 1; i++) {
      pool(ctx, i * spread, i * dir * -9, i ? -dir : dir, 1.56 + height * .098);
    }
    ctx.restore();
  } else if (layer === 'front') {
    tideCrest(ctx, a.x, a.y + 8 - height * .63, dir, .77 + height * .055);
    if (frame >= 2) tideCrest(ctx, b.x, b.y + 9 - height * .53, dir, .59 + height * .035);
    if (hit >= 0) {
      pool(ctx, target.x - dir * (15 + hit * 3), target.y + 9, dir, 1.8 + hit * .08);
      pool(ctx, target.x + dir * (19 + hit * 4), target.y + 11, -dir, 1.52 + hit * .06);
    }
    if (hit === 0) pixel(ctx, W, a.x - 6, a.y - 6, 13, 3);
  } else if (frame >= 4) {
    for (const [i, [x, y]] of FOAM.entries()) {
      shard(ctx, a.x + x * (13 + height), a.y + y * 8 - height, dir, i % 2 ? .46 : .55);
    }
  }
}

export const TIDE_FX: Partial<Record<string, AnimatedFx>> = {
  aquajet: { frames: 11, frameMs: 48, hitFrame: AQUAJET_HIT, socket: 'body', draw: drawAquajet, dash: (frame, miss) => dashProgress(JET_DASH, frame, miss) },
  tidecharge: { frames: 14, frameMs: 55, hitFrame: CHARGE_HIT, socket: 'body', draw: drawTidecharge, self: true },
  whalecry: { frames: 15, frameMs: 58, hitFrame: CRY_HIT, socket: 'mouth', draw: drawWhalecry },
  hightide: { frames: 16, frameMs: 55, hitFrame: TIDE_HIT, socket: 'ground', targetSocket: 'ground', draw: drawHightide },
};
