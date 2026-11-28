// 羽毛的硬邊、雲霧的柔邊和落地碎屑分開描繪，讓飛行動勢清楚。
import { dashProgress, direction, pixel, tile, travel, type AnimatedFx, type FxLayer, type FxPoint } from './skill-fx-helpers';

const PLUME = { d: '#465f7c', b: '#7298b9', t: '#a3c8db', h: '#d3eff0', w: '#fcfff0' };
const DUST = [[-1, -.5], [-.56, -1], [.12, -1.18], [.77, -.78], [1.1, -.28], [.77, .36], [-.62, .48]] as const;
const pinion = tile([
  '..............ddddd.',
  '...........dddwhhhd.',
  '........dddwwhhttbd.',
  '......ddwhhhttbdtd..',
  '....ddhwhhttbddd...',
  '..ddhwhhttbdtd.....',
  '.dhwhttbddd........',
  '.dhttbdtd..........',
  'dttbddd............',
  '.ddd...............',
], PLUME);
const fan = tile([
  '..............ddd......',
  '............ddhwd......',
  '.........dddwhhwd...ddd',
  '......dddwhhhtwd..ddhwd',
  '....ddwhhhtttwdddhhwdd.',
  '..ddwhhttbtwwdhwhttwd..',
  '.dhhhttbtwwdhhhttwdd...',
  'dhhtbbtwwdhhttwwdd.....',
  'dttbbtwwdhhtwwdd.......',
  'dtbbtwwdhhwwdd.........',
  '.dbtwwdhwwdd...........',
  '.dtwwdwdd..............',
  '..dddddd...............',
], PLUME);
const cloud = tile([
  '.......ddd........',
  '.....ddthhdd......',
  '...ddthwwhhtddd...',
  '..dthwwwhhhtthtdd.',
  '.dthwwhhhhwhhhhtd.',
  'dthhhttthhhttttbd.',
  'ddttttttttttbbbdd.',
  '..ddddddddddd.....',
], PLUME);
const airburst = tile([
  '.........ddd..............',
  '........dhwd..............',
  '...d...dhwtd.........ddd..',
  '...ddddhwwd......ddddhwd..',
  '....dthwwdd..ddddhhwwddd..',
  '..dddthwwddddhhhwwddd.....',
  'ddttthwwwttthhwwddd.......',
  'dthhhwwwwwwwddddd.........',
  '.dddddhwwddddd............',
  '.....dhwwddd...dddd.......',
  '....dhwdd.........dd......',
  '....ddd...................',
], PLUME);

const DIVE_HIT = 6;
const DIVE_DASH = [0, -.035, .02, .22, .46, .73, 1, .89, .63, .4, .18, 0];
const DIVE_LIFT = [0, -8, -20, -32, -35, -22, 0, -3, -6, -4, -2, 0];
function drawDivebomb(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean, dir: number) {
  const hit = frame - DIVE_HIT;
  if (layer === 'back' && frame >= 1 && hit < 1) {
    ctx.globalAlpha *= .66;
    cloud(ctx, source.x - dir * 13, source.y + (frame < 4 ? 11 : -9), -dir, .72 + frame * .075);
    if (frame >= 3) cloud(ctx, source.x - dir * 24, source.y + (frame < 4 ? 6 : -12), dir, .54);
  } else if (layer === 'front') {
    if (frame >= 2 && hit < 0) {
      pinion(ctx, source.x - dir * 12, source.y + (frame < 4 ? 11 : -9), -dir, .64 + frame * .095);
      if (frame >= 4) pinion(ctx, source.x - dir * 19, source.y - 17, -dir, .64);
    } else if (!missed && hit >= 0 && hit <= 4) {
      ctx.globalAlpha *= [1, .94, .71, .53, .29][hit];
      airburst(ctx, target.x + dir * hit * 2, target.y, dir, [1.32, 1.39, 1.27, 1.11, .94][hit]);
      cloud(ctx, target.x + dir * (7 + hit * 4), target.y + 11, dir, .94 + hit * .12);
      if (hit === 0) pixel(ctx, PLUME.w, target.x - 4, target.y - 1, 9, 4);
    }
  } else if (layer === 'particles' && !missed && hit >= 0) {
    ctx.globalAlpha *= 1 - hit / 8;
    for (const [i, [x, y]] of DUST.entries()) {
      pinion(ctx, target.x + dir * x * (12 + hit * 4), target.y + y * (8 + hit * 3) + hit * hit * .5, i % 2 ? dir : -dir, i % 2 ? .43 : .5);
    }
  }
}

const VEIL_HIT = 5;
function drawFeatherveil(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, center: FxPoint, _target: FxPoint, _miss: boolean, dir: number) {
  const hit = frame - VEIL_HIT;
  if (hit >= 2) ctx.globalAlpha *= [1, .9, .74, .55, .38, .19][hit - 2];
  const spread = [12, 15, 18, 20, 21, 17, 16, 16, 17, 17, 17, 17, 18][frame];
  const size = [.55, .7, .84, 1.05, 1.21, 1.38, 1.36, 1.34, 1.32, 1.3, 1.28, 1.22, 1.09][frame];
  if (layer === 'back') {
    ctx.globalAlpha *= .72;
    fan(ctx, center.x - dir * spread, center.y - 3, dir, size);
    cloud(ctx, center.x - dir * 12, center.y + 10, dir, .63 + size * .36);
  } else if (layer === 'front') {
    fan(ctx, center.x + dir * spread, center.y + 4, -dir, size);
    if (frame >= 3) pinion(ctx, center.x + dir * (spread - 4), center.y + 10, -dir, .52 + size * .32);
    if (hit >= 0 && hit <= 2) pixel(ctx, PLUME.w, center.x + dir * 8, center.y - 7, 5, 5);
  } else if (hit >= 0) {
    for (const [i, [x, y]] of DUST.entries()) {
      if (i % 2 === 0) pinion(ctx, center.x + x * (18 + hit * 2), center.y + y * (13 + hit * 2) + hit * hit * .35, i % 3 ? dir : -dir, .49);
    }
  }
}

const CUT_HIT = 5;
function drawAircutter(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const hit = frame - CUT_HIT, dir = direction(source, target);
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    const p = [0, .14, .32, .53, .76, 1, 1.14][frame];
    const q = travel(source, target, p, 8);
    if (hit >= 0) ctx.globalAlpha *= hit ? .41 : .7;
    pinion(ctx, q.x, q.y, dir, .66 + Math.min(frame, 4) * .15);
    if (frame > 1) pinion(ctx, q.x - dir * 10, q.y + 6, dir, .51);
  } else if (!missed && hit >= 0) {
    if (layer === 'front' && hit <= 3) {
      ctx.globalAlpha *= [1, .94, .65, .36][hit];
      airburst(ctx, target.x + dir * 3 * hit, target.y - 2 * hit, dir, 1.08 + .09 * hit);
      pinion(ctx, target.x + dir * (6 + hit), target.y + 4 - hit * 2, dir, .73);
      if (hit === 0) pixel(ctx, PLUME.w, target.x - 2, target.y - 1, 6, 3);
    } else if (layer === 'particles') {
      ctx.globalAlpha *= 1 - hit / 7;
      for (const [i, [x, y]] of DUST.entries()) {
        if (i % 2 === 0) pinion(ctx, target.x + dir * x * (10 + hit * 3), target.y + y * (8 + hit * 2), dir, .35);
      }
    }
  }
}

export const FLIGHT_FX: Partial<Record<string, AnimatedFx>> = {
  divebomb: {
    frames: 14, frameMs: 54, hitFrame: DIVE_HIT, socket: 'body', draw: drawDivebomb,
    dash: (frame, miss) => dashProgress(DIVE_DASH, frame, miss),
    dashLift: (frame) => dashProgress(DIVE_LIFT, frame, false),
  },
  featherveil: { frames: 13, frameMs: 60, hitFrame: VEIL_HIT, socket: 'body', draw: drawFeatherveil, self: true },
  aircutter: { frames: 12, frameMs: 47, hitFrame: CUT_HIT, socket: 'wing', draw: drawAircutter, repeat: true },
};
