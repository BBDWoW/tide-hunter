// 碧藍淺灘常見技能的像素特效。
import { dashProgress, direction, pixel, pixelStroke, tile, travel, type AnimatedFx, type FxLayer, type FxPoint } from './skill-fx-helpers';

const ROCK_COLORS = { d: '#424050', s: '#68616a', m: '#918786', l: '#b5a392', h: '#e3cfab' };
const stone = tile([
  '.....dddd.....',
  '...ddhllmdd...',
  '..dhhllmmssd..',
  '.dhllmmmsmmsd.',
  '.dlmmmllmmsd..',
  'dmmssdsmmmsd..',
  'dmssddsmmssd..',
  '.dssddsmmssd..',
  '..dddsssssdd..',
  '.....ddddd....',
], ROCK_COLORS);
const stoneEdge = tile([
  '......ddd...',
  '....ddhlmd..',
  '...dhhmlmsd.',
  '..dlmmmsmsd.',
  '.dlmdsmmsd..',
  '.dmdddmssd..',
  'dmsmmmsd....',
  'dsmsssd.....',
  '.ddddd......',
], ROCK_COLORS);
const chip = tile([
  '..dd..',
  '.dhmd.',
  'dlmsd.',
  'dmsd..',
  '.dd...',
], ROCK_COLORS);
const grit = tile([
  '.......dddd.....',
  '....dsddsssd....',
  '..dmsmssllmsdd..',
  '.dmllmllhhmlssd.',
  'dslllllmmmlmmssd',
  'dssssmssssssmssd',
  '.d.ddd.ddd.dddd.',
], ROCK_COLORS);

const crystal = tile([
  '.......dd........',
  '.......dh........',
  '......dwhd.......',
  '..ddd.dhhdddd....',
  '.ddmmddhgdhhgdd..',
  '...dhghhwhhgd....',
  '.....dwwhhhd.....',
  '....ddwhgghd.....',
  '...dwhdggddhd....',
  '...ddd.dd..dd....',
  '......dd.........',
], { d: '#58436e', m: '#8c6eb4', h: '#ffd387', g: '#edab65', w: '#fff7c7' });
const STAR_COLOR = { d: '#745478', a: '#efae6b', y: '#ffdc8a', w: '#fff8d4' };
const glint = tile([
  '....d....',
  '....d....',
  '...dyd...',
  '..dywyd..',
  'ddywwwydd',
  '..dywyd..',
  '...dyd...',
  '....d....',
  '....d....',
], STAR_COLOR);

const feather = tile([
  '.....ddd.',
  '....dwhd.',
  '...dwhad.',
  '..dwhad..',
  '.dwhad...',
  '.daadd...',
  'd.dd.....',
], { d: '#536684', w: '#f6fcff', h: '#c8e5ef', a: '#92b0cb' });
const jab = tile([
  '.................ddd.',
  '..............dddywd.',
  '....dd.....dddywwd...',
  '.....ddddddyywwddd...',
  '.....dywwwwwwwddd....',
  '..dddywwwwwwwywdd....',
  'ddyyywwwwwwyyyddd....',
  '..dddywyydddd........',
  '....ddddd...dywd.....',
  '.............ddd.....',
], { d: '#81616a', w: '#fff8d0', y: '#ffc471' });

const WIND = { d: '#397181', t: '#77b7bf', a: '#a6e1db', w: '#e9fff2' };
const windCurl = tile([
  '............dddddd........',
  '.........dddttaaaaadd.....',
  '......dddtawwwwwaaawad....',
  '...dddttwwwad.....dwwad...',
  'ddtttaawad.........dwwad..',
  '...................dwwad..',
  '..............da..dwwad...',
  '............dawwwwwad.....',
  '.........ddtaaawadd.......',
  '.......dddttadd...........',
], WIND);
const windWake = tile([
  '.......dddddddddd...',
  '....dddttaaaaaaawdd.',
  '.dddttaaadddddttawwd',
  'ddttaad.........dwad',
  '..............dawad.',
  '..........ddtaawd...',
  '.......dddttadd.....',
  '....dddttadd........',
  '...ddddd............',
], WIND);

const SPARK_COLORS = { d: '#59499a', p: '#a28ce0', g: '#f1c95d', w: '#fffac7' };
const spark = tile([
  '.....d.......',
  '.....pd......',
  '.....gpd.....',
  '......gpd..d.',
  '...d..wwp.dp.',
  '...dp.wwdpd..',
  '....dgpwwgddd',
  'dddgpwwwwgp..',
  '..ddpwgwd....',
  '....dpdpd....',
  '...dpd.dpd...',
  '...d......d..',
], SPARK_COLORS);

const PEBBLE_HIT = 6;
const ROCK_CHIPS = [[-.7, -.9], [.25, -1.15], [1, -.6], [-1, .1], [.8, .3], [1.2, .05]];
function drawPebble(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const hit = frame - PEBBLE_HIT, dir = direction(source, target);
  if (layer === 'front' && (hit < 0 || (missed && hit < 3))) {
    const p = [0, .07, .22, .4, .59, .78, 1, 1.12, 1.22][frame];
    const q = travel(source, target, p, 17);
    const rock = frame % 2 ? stoneEdge : stone;
    if (hit >= 0) ctx.globalAlpha *= [1, .67, .32][hit];
    rock(ctx, q.x, q.y, frame % 4 < 2 ? dir : -dir, frame ? 1 : .68);
    if (frame > 2) chip(ctx, q.x - dir * 9, q.y + (frame % 3 - 1) * 3, dir, .62);
  } else if (hit >= 0 && !missed) {
    if (layer === 'front' && hit < 4) {
      ctx.globalAlpha *= [1, .9, .64, .34][hit];
      grit(ctx, target.x, target.y + 3 + hit, dir, 1.25 + hit * .26);
      for (const [i, [x, y]] of ROCK_CHIPS.slice(0, 3).entries()) {
        chip(ctx, target.x + dir * x * (8 + hit * 4), target.y + y * (8 + hit * 3) + hit * hit * .7, i % 2 ? -dir : dir, .95 - hit * .14);
      }
    } else if (layer === 'particles') {
      ctx.globalAlpha *= 1 - hit / 7;
      for (const [i, [x, y]] of ROCK_CHIPS.entries()) {
        chip(ctx, target.x + dir * x * (14 + hit * 5), target.y + y * (12 + hit * 3) + hit * hit * .8, dir, i % 2 ? .44 : .55);
      }
    }
  }
}

const STAR_HIT = 6;
function drawStarshard(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const dir = direction(source, target), hit = frame - STAR_HIT;
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    const p = [0, .06, .19, .36, .55, .77, 1, 1.12][frame];
    const q = travel(source, target, p, 6);
    if (hit >= 0) ctx.globalAlpha *= hit ? .45 : .8;
    crystal(ctx, q.x, q.y, dir, frame > 1 ? 1 : .67);
    for (let i = 1; i <= Math.min(frame, 4); i++) {
      const tail = travel(source, target, Math.max(0, p - i * .073), 6);
      glint(ctx, tail.x, tail.y + (i % 2 ? -i : i) * 1.7, dir, .6 - i * .1);
    }
  } else if (hit >= 0 && !missed) {
    if (layer === 'front' && hit <= 4) {
      ctx.globalAlpha *= [1, .93, .72, .51, .3][hit];
      glint(ctx, target.x, target.y, dir, [2.2, 2.5, 2, 1.35, .85][hit]);
      glint(ctx, target.x + dir * (8 + hit * 3), target.y - 6 - hit * 2, dir, .63);
      glint(ctx, target.x - dir * (5 + hit), target.y + 5 + hit * 3, dir, .47);
    } else if (layer === 'particles') {
      ctx.globalAlpha *= 1 - hit / 8;
      for (const [i, [x, y]] of ROCK_CHIPS.entries()) {
        const px = target.x + dir * x * (8 + hit * 5);
        const py = target.y + y * (7 + hit * 3) + hit * hit * .65;
        if (i % 2) glint(ctx, px, py, dir, .4);
        else pixel(ctx, STAR_COLOR.y, px, py, 2);
      }
    }
  }
}

const PECK_HIT = 4;
const PECK_STEPS = [0, -.03, .12, .57, 1, .65, .31, .08, 0];
function drawPeck(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean, dir = direction(source, target)) {
  const hit = frame - PECK_HIT;
  if (layer === 'back' && frame >= 2 && frame <= 5) {
    const length = frame === 3 ? 15 : 9;
    ctx.globalAlpha *= frame === 3 ? .9 : .6;
    for (const [offset, y] of [[28, -3], [39, 4]]) {
      const x = source.x - dir * offset - (dir > 0 ? length : 0);
      pixel(ctx, '#84a3bf', x, source.y + y, length, 2);
      pixel(ctx, '#e4f5f4', x + 2, source.y + y, length - 2);
    }
  }
  if (hit < 0 || missed) return;
  if (layer === 'front' && hit <= 3) {
    ctx.globalAlpha *= [1, .94, .62, .32][hit];
    jab(ctx, target.x + dir * hit * 3, target.y, dir, [1.02, 1.2, 1.12, .87][hit]);
  } else if (layer === 'particles') {
    ctx.globalAlpha *= 1 - hit / 6.5;
    feather(ctx, target.x - dir * (7 + hit * 4), target.y - 7 - hit * 2 + hit * hit * .62, dir, .8);
    feather(ctx, target.x + dir * (9 + hit * 4), target.y + 1 + hit * hit * .8, -dir, .62);
    pixel(ctx, '#ffda86', target.x + dir * (11 + hit * 3), target.y - 3 - hit * 2, 2);
  }
}

const GUST_HIT = 5;
function drawGust(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const dir = direction(source, target), hit = frame - GUST_HIT;
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    const p = [0, .11, .29, .5, .74, 1, 1.14][frame];
    const q = travel(source, target, p, 3);
    if (hit >= 0) ctx.globalAlpha *= hit ? .43 : .8;
    windCurl(ctx, q.x, q.y - 2, dir, 1 + Math.min(frame, 4) * .12);
    if (frame >= 2) {
      const wake = travel(source, target, p - .16, 3);
      windWake(ctx, wake.x, wake.y + 8, dir, 1.03);
    }
  } else if (hit >= 0 && hit < 6 && !missed) {
    if (layer === 'back' && hit <= 3) {
      ctx.globalAlpha *= [.55, .48, .35, .22][hit];
      windCurl(ctx, target.x + dir * (6 + hit * 3), target.y + 10, dir, 2.1);
    } else if (layer === 'front' && hit < 5) {
      ctx.globalAlpha *= [1, .89, .68, .48, .27][hit];
      windCurl(ctx, target.x + dir * (hit * 6), target.y - 5 - hit, dir, 1.65 + hit * .11);
      windWake(ctx, target.x + dir * (2 + hit * 6), target.y + 10 + hit * 2, dir, 1.42);
    } else if (layer === 'particles') {
      ctx.globalAlpha *= 1 - hit / 6;
      feather(ctx, target.x + dir * (9 + hit * 5), target.y - 12 - hit * 2, dir, .68);
      feather(ctx, target.x + dir * (15 + hit * 5), target.y + 4 + hit * 2, -dir, .56);
      pixel(ctx, WIND.w, target.x + dir * (19 + hit * 6), target.y - hit * 1.7, 4);
    }
  }
}

function bolt(ctx: CanvasRenderingContext2D, points: FxPoint[], primary = false) {
  pixelStroke(ctx, points, SPARK_COLORS.d, primary ? 4 : 3);
  pixelStroke(ctx, points, primary ? SPARK_COLORS.w : SPARK_COLORS.g, primary ? 2 : 1);
}

const ZAP_HIT = 5;
const BENDS = [0, -.4, 1, -.85, .6, -.72, .54, 0];
function drawZap(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const hit = frame - ZAP_HIT, dir = direction(source, target);
  if (layer === 'front' && frame <= 2) {
    spark(ctx, source.x + dir * 2, source.y, dir, .66 + frame * .22);
  } else if (layer === 'front' && hit <= 2) {
    const leading = [.4, .73, 1, 1, .98][frame - 3];
    const tail = hit === 2 ? .32 : 0;
    const bends = hit === 1 ? -1 : 1;
    const points = BENDS.map((y, i) => {
      const q = travel(source, target, tail + (leading - tail) * i / (BENDS.length - 1));
      return { x: q.x, y: q.y + y * bends * (8 + (i % 3) * 2) * (.5 + leading / 2) };
    });
    const fork = points[4];
    ctx.save();
    ctx.globalAlpha *= hit === 2 ? .38 : hit === 1 ? .73 : .9;
    bolt(ctx, [fork,
      { x: fork.x + dir * 10 * leading, y: fork.y - 13 },
      { x: fork.x + dir * 21 * leading, y: fork.y - 8 },
      { x: fork.x + dir * 30 * leading, y: fork.y - 16 },
    ]);
    bolt(ctx, points, true);
    ctx.restore();
    if (hit >= 0 && !missed) spark(ctx, target.x, target.y, dir, [1.75, 1.36, 1.1][hit]);
  } else if (layer === 'front' && !missed && hit <= 4) {
    ctx.globalAlpha *= hit === 3 ? .58 : .31;
    spark(ctx, target.x + dir * 6, target.y + 2, -dir, .92);
    spark(ctx, target.x - dir * 7, target.y - 7, dir, .62);
  } else if (layer === 'particles' && hit >= 0 && !missed) {
    ctx.globalAlpha *= 1 - hit / 7;
    for (const [x, y, size] of [[-1, -1, .6], [1, -.8, .55], [.35, 1, .4], [1, .6, .48]]) {
      spark(ctx, target.x + dir * x * (11 + hit * 3), target.y + y * (9 + hit * 2), dir, size);
    }
  }
}

export const SHORE_FX: Partial<Record<string, AnimatedFx>> = {
  pebble: { frames: 13, frameMs: 56, hitFrame: PEBBLE_HIT, socket: 'core', draw: drawPebble },
  starshard: { frames: 13, frameMs: 54, hitFrame: STAR_HIT, socket: 'crown', draw: drawStarshard },
  peck: { frames: 10, frameMs: 52, hitFrame: PECK_HIT, socket: 'mouth', draw: drawPeck, dash: (frame, missed) => dashProgress(PECK_STEPS, frame, missed) },
  gust: { frames: 11, frameMs: 52, hitFrame: GUST_HIT, socket: 'wing', draw: drawGust },
  zap: { frames: 12, frameMs: 54, hitFrame: ZAP_HIT, socket: 'core', draw: drawZap },
};
