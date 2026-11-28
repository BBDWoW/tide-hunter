// 砂霧、裸岩和暗礁用不同的顆粒、碎面與顏色表現。
import { direction, pixel, tile, travel, type AnimatedFx, type FxLayer, type FxPoint } from './skill-fx-helpers';

const SAND = { d: '#77615c', b: '#a1826a', t: '#c5a477', h: '#e3cf9e', w: '#fff2c7' };
const REEF = { d: '#344753', b: '#546371', g: '#688d87', h: '#99b4a2', w: '#dce5b9' };
const ROCK = { d: '#454250', b: '#6d6570', g: '#958578', h: '#c5ad93', w: '#ebd6af' };
const FRAGMENTS = [[-1.14, -.62], [-.73, -1.1], [-.23, -.99], [.47, -1.3], [.82, -.79], [1.1, -.33], [.79, .38], [-.65, .41]] as const;

const grains = tile([
  '.......t..............',
  '....b..h...bb.ht......',
  '.......thbbhthwthb....',
  '...b.bthhtthwhtthhtb..',
  '.b..thhtthhtthhwthhtb.',
  '.bhtthhttwhtthtwhtthtb',
  '...bhthththhtthwthttb.',
  'b..bttttwhttbtthhthtb.',
  '.b....bttttbtttbttbb..',
  '...t.b.bttbttbbtbb....',
  '.....b..bb.bb.........',
  '.........b.......t....',
], SAND);
const dust = tile([
  '......bb..........',
  '...bbbhhbbb.......',
  '..bhtwhhttbb...b..',
  '.bhtthhwtthb.bhhb.',
  'bhhttwhttttbbhhtbb',
  'bttthhhttbhhttthtb',
  '.bbbtttbtbtttbbtb.',
  '...bbbbbbbbbb.....',
], SAND);
const reef = tile([
  '...............dd.........',
  '..............dhwd........',
  '..............dhwgd.......',
  '............ddghwgbd......',
  '...........dghwgggbd......',
  '.......ddd.dghhggbd....dd.',
  '......dghwddggwggbd...dhwd',
  '.....dghwggddgwggbd..dhwgd',
  '....dghwggbgdgggbd.ddwggbd',
  '....dghgggggdgggbddbggggbd',
  '...dghggbgggdggbgggggggbd.',
  '..dghgggdbgghggbggggggbd..',
  '.dgggggbddghggbggggbbbd...',
  'dgggbbbggggbggggbbbbd.....',
  'dggggbbbbbgbgbbbbbbddd....',
  '.ddddbbbbbbbbbbbddd.......',
  '.....dddddddddddd.........',
], REEF);
const slab = tile([
  '.........dddddd.......',
  '.......ddhhhhwddd.....',
  '.....ddhhhgghwggdd....',
  '...ddhwhhggggggggbd...',
  '..dhwwwhgggbbggggbbd..',
  '..dhhwhgggbdbggbggbbd.',
  '.dhwhhggbbdgggbgggbbd.',
  'dhhhggdbbdggghgggggbbd',
  'dhhgggbbdggghhgggbbbbd',
  'dgggbbdggggggggbbbbbdd',
  'dgbbdgdbgghgggbbbbbbdd',
  '.dbdgddggggggbbbbbbdd.',
  '..dddgggbbbbbbbbbddd..',
  '....ddbbbbbbbbddd.....',
  '......ddddddddd.......',
], ROCK);
const gravel = tile([
  '..ddd.',
  '.dhgd.',
  'dgwgbd',
  'dggbd.',
  '.ddd..',
], ROCK);

const SAND_HIT = 5;
function drawSandtoss(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const hit = frame - SAND_HIT, dir = direction(source, target);
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    const lead = [0, .08, .29, .52, .76, 1, 1.14][frame];
    const front = travel(source, target, lead, 4);
    if (hit >= 0) ctx.globalAlpha *= hit ? .36 : .7;
    grains(ctx, front.x, front.y, dir, .65 + Math.min(5, frame) * .15);
    if (frame >= 2) {
      const tail = travel(source, target, Math.max(0, lead - .17), 4);
      grains(ctx, tail.x, tail.y + 4, -dir, .59 + frame * .055);
    }
  } else if (hit >= 0 && !missed) {
    if (layer === 'back' && hit <= 4) {
      ctx.globalAlpha *= [.52, .46, .38, .28, .18][hit];
      dust(ctx, target.x + dir * (5 + hit * 3), target.y - 7, -dir, 1.46 + hit * .21);
    } else if (layer === 'front' && hit <= 4) {
      ctx.globalAlpha *= [1, .88, .71, .5, .28][hit];
      grains(ctx, target.x + dir * (4 + hit * 4), target.y - 2, dir, 1.48 + hit * .19);
      dust(ctx, target.x - dir * (6 + hit), target.y + 9, -dir, 1 + hit * .15);
      if (hit === 0) pixel(ctx, SAND.w, target.x - 2, target.y - 3, 6, 2);
    } else if (layer === 'particles') {
      ctx.globalAlpha *= 1 - hit / 8;
      for (const [i, [x, y]] of FRAGMENTS.entries()) {
        pixel(ctx, i % 3 ? SAND.t : SAND.w, target.x + dir * x * (10 + hit * 4), target.y + y * (8 + hit * 3) + hit * hit * .64, 2);
      }
    }
  }
}

const REEF_HIT = 6;
function drawReefspikes(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, _source: FxPoint, ground: FxPoint, _missed: boolean, dir: number) {
  const hit = frame - REEF_HIT;
  const growth = [.12, .23, .32, .49, .68, .86, 1.12, 1.15, 1.14, 1.12, 1.06, .99, .93, .9][frame];
  if (hit >= 2) ctx.globalAlpha *= [1, .85, .66, .49, .35, .22][hit - 2];
  if (layer === 'back') {
    const scale = growth * .89;
    ctx.globalAlpha *= .72;
    reef(ctx, ground.x + dir * (10 + frame * .64), ground.y - 6 - scale * 7, -dir, scale);
    if (frame >= 4) reef(ctx, ground.x - dir * 15, ground.y - 4 - scale * 7, dir, scale * .74);
  } else if (layer === 'front') {
    if (frame <= 6) dust(ctx, ground.x + dir * 4, ground.y, dir, .81 + frame * .06);
    reef(ctx, ground.x - dir * 7, ground.y + 4 - growth * 8, dir, growth);
    reef(ctx, ground.x + dir * 16, ground.y + 3 - growth * 7, -dir, growth * .66);
    if (hit === 0) pixel(ctx, REEF.w, ground.x - 2, ground.y - 11, 5, 3);
  } else if (frame >= 3) {
    const spread = 7 + frame * 1.8;
    for (const [i, [x, y]] of FRAGMENTS.entries()) {
      gravel(ctx, ground.x + dir * x * spread, ground.y + y * (7 + frame) + Math.max(0, hit) ** 2 * .64, dir, i % 2 ? .38 : .46);
    }
  }
}

const ROCK_HIT = 7;
const ROCKS = [
  { x: -10, start: 1, size: 1.25, depth: 0 },
  { x: 13, start: 2, size: .9, depth: -6 },
  { x: -29, start: 2, size: .77, depth: 2 },
  { x: 30, start: 3, size: .68, depth: 1 },
] as const;
function drawRockslide(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, _source: FxPoint, target: FxPoint, missed: boolean, dir: number) {
  const hit = frame - ROCK_HIT;
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    if (hit > 0) ctx.globalAlpha *= .69;
    for (const [i, rock] of ROCKS.entries()) {
      if (frame < rock.start) continue;
      const p = Math.min(1.15, (frame - rock.start) / (ROCK_HIT - rock.start));
      slab(ctx, target.x + dir * (rock.x + (p - 1) * 12), target.y + rock.depth - 58 * (1 - p * p), i % 2 ? -dir : dir, rock.size);
    }
  } else if (hit >= 0 && !missed) {
    if (layer === 'back' && hit <= 4) {
      ctx.globalAlpha *= [.62, .56, .44, .31, .18][hit];
      dust(ctx, target.x + dir * (10 + hit * 5), target.y - 3, dir, 1.75 + hit * .25);
    } else if (layer === 'front' && hit <= 4) {
      ctx.globalAlpha *= [1, .95, .77, .53, .32][hit];
      dust(ctx, target.x - dir * (4 + hit * 4), target.y + 12, -dir, 1.65 + hit * .22);
      for (const [i, rock] of ROCKS.entries()) {
        slab(ctx, target.x + dir * (rock.x + Math.sign(rock.x) * hit * 3), target.y + rock.depth + Math.min(12, hit * 3) - (i % 3) * 4, i % 2 ? -dir : dir, rock.size * (1 - hit * .14));
      }
      if (hit === 0) pixel(ctx, ROCK.w, target.x - 3, target.y + 2, 7, 4);
    } else if (layer === 'particles') {
      ctx.globalAlpha *= 1 - hit / 9;
      for (const [i, [x, y]] of FRAGMENTS.entries()) {
        gravel(ctx, target.x + dir * x * (12 + hit * 4), target.y + y * (11 + hit * 2) + hit * hit * .69, dir, i % 2 ? .55 : .67);
      }
    }
  }
}

export const REEF_FX: Partial<Record<string, AnimatedFx>> = {
  sandtoss: { frames: 13, frameMs: 54, hitFrame: SAND_HIT, socket: 'body', draw: drawSandtoss },
  reefspikes: { frames: 14, frameMs: 58, hitFrame: REEF_HIT, socket: 'body', targetSocket: 'ground', draw: drawReefspikes },
  rockslide: { frames: 15, frameMs: 58, hitFrame: ROCK_HIT, socket: 'body', draw: drawRockslide },
};
