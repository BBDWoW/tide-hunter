// 初始夥伴進階水技。波紋、浪峰與回復水流各有自己的輪廓。
import { direction, pixel, pixelArc, tile, travel, type AnimatedFx, type FxLayer, type FxPoint } from './skill-fx-helpers';

const SEA = { deep: '#214d84', blue: '#367db8', tide: '#4bc5df', light: '#a6eee9', foam: '#f1fff3' };
const DROPS = [[-.9, -.8], [-.42, -1.12], [.2, -1.3], [.72, -.98], [1.14, -.6], [.95, .3], [-.78, .27]] as const;

const crest = tile([
  '....................dddddd............',
  '.................dddbttttbdd..........',
  '..............dddbttllllltbdd.........',
  '............dbttlllfffflllttbdd.......',
  '...........dbtllfffffllllftttbd.......',
  '.........ddbtllfflllttttbtdfttd.......',
  '........dbtllffltttbbddd..dfltd.......',
  '.......dbtllflttbbdd......dfltd.......',
  '......dbtllflttbdd.......dbllbd.......',
  '.....dbtllllttbd.........dtflbd.......',
  '....dbbtlltltbdd........dtflbd........',
  '....dbtttllttbdd......ddtflbdd........',
  '...dbtttltlttbdd..d..dbtftbd..........',
  '...dbttbtlllttbddbd.dbtltbd...ddddd...',
  '..dbttbbttltttttbbddbtltbdd.ddtlttdd..',
  '..dbtbbdttttlllltbdbtltbddddtlffltbd..',
  '.ddbtbddbttttlllltttttbbddtlffllttbdd.',
  '.dbbtbbdbbtttttllllttbbbttllltbbtlltbd',
  '.dbttbbbbbbbttttttllllllllltttbbbtbd..',
  'ddbbbtbbbbbbbtttttttttttttbbbbbbdd....',
  '.ddddddbbbbbbbbbbbbbbbbbbbbdddddd.....',
], { d: SEA.deep, b: SEA.blue, t: SEA.tide, l: SEA.light, f: SEA.foam });

const ripple = tile([
  '....dddddd......',
  '..ddbttttbdd....',
  '.dbtllllttbdd...',
  'dbtlffffllttbdd.',
  '.dbtllffffllttbd',
  '..ddbbbbttttbdd.',
  '.....ddddddd....',
], { d: SEA.deep, b: SEA.blue, t: SEA.tide, l: SEA.light, f: SEA.foam });
const droplet = tile([
  '..dd.',
  '.dltd',
  'dtftd',
  'dtlbd',
  '.dbd.',
], { d: SEA.deep, b: SEA.blue, t: SEA.tide, l: SEA.light, f: SEA.foam });

const upwelling = tile([
  '.............dd..........',
  '............dftd.........',
  '...........dfltd....d....',
  '..........dtfltd...dftd..',
  '.........dttfld...dtfbd..',
  '........dbttfld..dtfbd...',
  '....d..dbttlftd.dbtlbd...',
  '...dtd.dbttltltdbtldd...',
  '...dftdtbtltlltttldd....',
  '....dftdbtlltftlldd.....',
  '.....dfltttltlftld......',
  '....dttfllltttlfld......',
  '...dbtlttfllttltfld.....',
  '..dbtllttltflltttld.....',
  '..dbttltltttflltttd.....',
  '.dbttttttttttfllttbd....',
  '.dbbttlllttttttttttbd...',
  'dbttllfffflllttttttbbddd',
  'ddbtllttllllllttttbbbdd.',
  '..dddddbbbbbbbbbdddd....',
], { d: SEA.deep, b: SEA.blue, t: SEA.tide, l: SEA.light, f: SEA.foam });

const PULSE_HIT = 6;
function drawWaterpulse(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const hit = frame - PULSE_HIT, dir = direction(source, target);
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    const lead = [0, .09, .21, .39, .58, .8, 1, 1.12][frame];
    const count = Math.min(3, 1 + Math.floor(frame / 2));
    for (let i = count - 1; i >= 0; i--) {
      const point = travel(source, target, Math.max(0, lead - i * .14), 3);
      const radius = 5 + frame * 1.12 - i * .85;
      pixelArc(ctx, point, radius * .61, radius, 0, 2 * Math.PI, SEA.deep, 2);
      pixelArc(ctx, point, radius * .61, radius, -2.72, 4.1, SEA.tide, 2);
      pixelArc(ctx, point, radius * .57, radius - 1, 3.69, 1.42, SEA.foam, 1);
      ripple(ctx, point.x + dir * radius * .25, point.y + radius * .18, dir, .32 + .026 * frame);
    }
  } else if (!missed && hit >= 0) {
    if (layer === 'front' && hit < 4) {
      ctx.globalAlpha *= [1, .88, .62, .38][hit];
      const center = { x: target.x + dir * hit * 2, y: target.y };
      pixelArc(ctx, center, 10 + hit * 3, 14 - hit * 1.5, -2.9, 5.8, SEA.deep, 3);
      pixelArc(ctx, center, 10 + hit * 3, 14 - hit * 1.5, -2.55, 4.6, SEA.light, 2);
      ripple(ctx, center.x, center.y, dir, [.92, 1.08, 1.2, 1][hit]);
      if (hit === 0) pixel(ctx, SEA.foam, target.x - 3, target.y - 1, 7, 3);
    } else if (layer === 'back' && hit < 5) {
      ctx.globalAlpha *= .52 - hit * .085;
      pixelArc(ctx, target, 13 + hit * 4, 8 + hit * 2, 0, 2 * Math.PI, SEA.blue, 2);
    } else if (layer === 'particles') {
      ctx.globalAlpha *= 1 - hit / 7;
      for (const [i, [x, y]] of DROPS.entries()) {
        droplet(ctx, target.x + dir * x * (9 + hit * 4), target.y + y * (6 + hit * 2) + hit * hit * .48, dir, i % 2 ? .5 : .65);
      }
    }
  }
}

const WAVE_HIT = 7;
function drawTidewave(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const hit = frame - WAVE_HIT, dir = direction(source, target);
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    const p = [0, .04, .15, .28, .44, .62, .81, 1, 1.13][frame];
    const point = travel(source, target, p, -6);
    if (hit >= 0) ctx.globalAlpha *= hit ? .35 : .68;
    const scale = [.27, .38, .59, .78, .98, 1.12, 1.28, 1.13, .8][frame];
    crest(ctx, point.x, point.y + 11 - scale * 9, dir, scale);
    if (frame >= 2) ripple(ctx, point.x - dir * (8 + frame), point.y + 12, dir, .53 + frame * .055);
  } else if (!missed && hit >= 0) {
    if (layer === 'back' && hit <= 4) {
      ctx.globalAlpha *= [.63, .57, .46, .32, .2][hit];
      crest(ctx, target.x - dir * 6, target.y - 2, dir, 1.65 - hit * .135);
    } else if (layer === 'front' && hit <= 4) {
      ctx.globalAlpha *= [1, .94, .78, .6, .37][hit];
      if (hit < 2) crest(ctx, target.x + dir * (hit * 6 - 2), target.y - hit * 6, dir, 1.4 - hit * .12);
      ripple(ctx, target.x + dir * (2 + hit * 3), target.y + 7 + hit, dir, 1.5 + hit * .28);
      ripple(ctx, target.x - dir * (11 + hit * 2), target.y + 12 + hit, dir, 1 + hit * .11);
    } else if (layer === 'particles') {
      ctx.globalAlpha *= 1 - hit / 8;
      for (const [i, [x, y]] of DROPS.entries()) {
        droplet(ctx, target.x + dir * x * (13 + hit * 3), target.y + y * (17 + hit * 3) + hit * hit * .72, dir, i % 2 ? .65 : .8);
      }
    }
  }
}

const SURGE_HIT = 6;
function drawSurge(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, center: FxPoint, _target: FxPoint, _miss: boolean, dir: number) {
  const hit = frame - SURGE_HIT;
  const lift = [0, 3, 9, 15, 23, 33, 39, 38, 33, 26, 19, 13, 8, 4][frame];
  if (hit >= 2) ctx.globalAlpha *= [1, .91, .77, .61, .47, .29][hit - 2];
  if (layer === 'back') {
    const base = { x: center.x, y: center.y + 15 };
    pixelArc(ctx, base, 11 + lift / 2.5, 6 + lift / 8, -Math.PI, Math.PI, SEA.blue, 2);
    if (frame >= 2) {
      const scale = .46 + lift * .023;
      ctx.globalAlpha *= .68;
      upwelling(ctx, center.x - dir * (11 + lift * .12), center.y + 11 - scale * 9, -dir, scale);
    }
  } else if (layer === 'front') {
    ripple(ctx, center.x - dir * (8 + lift * .2), center.y + 14, dir, .9 + lift * .011);
    ripple(ctx, center.x + dir * (7 + lift * .2), center.y + 16, -dir, 1.03 + lift * .01);
    if (frame >= 2) {
      const scale = .51 + lift * .025;
      upwelling(ctx, center.x + dir * (12 + lift * .13), center.y + 10 - scale * 10, dir, scale);
      if (lift >= 16) {
        droplet(ctx, center.x + dir * (12 + lift * .24), center.y + 10 - scale * 22, dir, .58);
        droplet(ctx, center.x - dir * 18, center.y + 7 - scale * 19, -dir, .48);
      }
    }
    if (hit >= 0 && hit <= 2) {
      pixel(ctx, SEA.foam, center.x - 4, center.y - 15, 9, 2);
      pixel(ctx, SEA.foam, center.x, center.y - 19, 2, 10);
    }
  } else if (lift > 8) {
    for (const [i, [x, y]] of DROPS.entries()) {
      droplet(ctx, center.x + x * (16 + lift * .31), center.y + 12 - lift * .47 + y * 14, dir, i % 2 ? .5 : .64);
    }
  }
}

export const ADVANCED_WATER_FX: Partial<Record<string, AnimatedFx>> = {
  waterpulse: { frames: 13, frameMs: 54, hitFrame: PULSE_HIT, socket: 'mouth', draw: drawWaterpulse },
  tidewave: { frames: 15, frameMs: 57, hitFrame: WAVE_HIT, socket: 'body', draw: drawTidewave },
  surge: { frames: 14, frameMs: 57, hitFrame: SURGE_HIT, socket: 'body', draw: drawSurge, self: true },
};
