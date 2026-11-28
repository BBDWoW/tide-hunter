// 熔岩裂谷的技能用冷卻外殼、灼熱裂面和翻飛碎屑來區別形狀。
import { dashProgress, direction, pixel, tile, travel, type AnimatedFx, type FxLayer, type FxPoint } from './skill-fx-helpers';

const MAGMA = { d: '#55374d', b: '#894153', r: '#cb5439', o: '#f38443', h: '#ffc476', w: '#fff2b4' };
const GLASS = { d: '#362943', b: '#584568', t: '#805c84', h: '#b389a9', w: '#f9dcb8' };
const DEBRIS = [[-1.08, -.49], [-.77, -1.04], [-.22, -1.23], [.42, -1.27], [.84, -.86], [1.14, -.32], [.9, .33], [-.67, .42]] as const;

const coals = tile([
  '...ddd....',
  '..dbhrd...',
  '.dbhrord..',
  'dbhrwhord.',
  'dbrrhordd.',
  '.ddrrrdd..',
  '..dddd....',
], MAGMA);
const basalt = tile([
  '....dddddddd.......',
  '..ddbrrrbbddddd....',
  '.dbrrhhrbbrrrrbddd.',
  'dbrroworbbrohrbbbd.',
  'dbrrhhrbbbrwhordbd.',
  'ddbbrrrrbdrrorrdbd.',
  '.ddbbbbbddddbbdddd.',
  '....ddddddd........',
], MAGMA);

const lava = tile([
  '.............dddddddd...................',
  '.....dddd...ddbrroorrdddd.....dddd......',
  '...ddbrbdddbrroohhorrroorrddddbrbbdd....',
  '..dbrroorrrrohhwohhorrooohororrbrbbdd..',
  'ddbrroohorrrrohwwhoorroohwwoororrrrbbd.',
  'dbrrohwwhorrrrohhorroohhwhroohhhorrrbbd',
  'dbrrohwwhorrrrorrrroohhhorooohwwhorbbd.',
  'dbrroorrroorrroorrroorrroohhwhhorrbbd..',
  '.dbrroorrrrohhhhorrrrrroohwwhorrrbbd...',
  '..ddbrroorrohwwhorrrrroohhhhorrrbbd....',
  '...ddbbbrrrrroorrbbrrroorrroorrbbd.....',
  '.....ddbbrrrrrrrrbbbrbbbbrrrrbbdd......',
  '.......ddbbbbbbbbdbbbbbbbbdddd..........',
  '..........ddddddd..ddddddd..............',
], MAGMA);
const flame = tile([
  '..............d.......',
  '.............drd......',
  '.........d..drood.....',
  '........drd.drood.....',
  '.......drooddrooyd....',
  '...d...droodroohod..d.',
  '..drd.drooydroohoddrod',
  '..droddroyydroywhdrood',
  '.droyrdrooyoroowhooyod',
  '.drooyroohorohwhooyhord',
  'droowhroywoyohwhoohword',
  'droohwyyhwhohwwhoohyyod',
  '.droohwyywwyhwwyohworrd',
  '.drrooyyyywwhyyyhyorrrd',
  '..ddbrooooohrorroorbbdd',
  '....ddddbbbbbrrrrbddd..',
], { ...MAGMA, y: '#f5a85e' });
const magmaColumn = tile([
  '................dd.............',
  '...............drhd............',
  '...............drohd...........',
  '...............drowhd......d...',
  '..............drowhod.....dhd..',
  '.....dd......drowwhod....dhrd..',
  '....drhd....drowwhord..ddhord..',
  '....drohd..drowhhord..drhhord..',
  '.....drohddrowhwoord.ddhwhrd...',
  '......drowhrowhwoorddrhwword...',
  '.......drowwwhhwoordrrhwword...',
  '.....dddrhwwhwoorddrhwwhord....',
  '....drooohwhhwwordrhwwhord.....',
  '..ddrrohwhhhhwwoorrhwhrood.dd..',
  '.drrooohwwhwwhwoorhwwhoordrhd..',
  'drroohwwhwwhwhooohwwhoordrhod..',
  'dbrroohwwwwhwohohwwhoorrrwhord.',
  'dbrrohhwwhhwoooohhwhororhwhord.',
  'ddbrroohooorrrrroohoorrrrohord.',
  '.ddbbrrroorrbbrrrorrrrrooorrbd.',
  '...ddbbbrrrrbbbbrrrrrrrbbbddd..',
  '.....ddddbbbbbbbbbbbbbd.dd.....',
], MAGMA);
const cleaver = tile([
  '..................ddddddd....',
  '...............dddhwwwttd....',
  '............dddhwhtthwtd.....',
  '.........dddhhwhtthwtd.......',
  '......dddhtthwhhtwtd....d....',
  '...dddhttbthhwhtwtd....dhd...',
  '.ddhtttbtthhwhtwtd..ddhwtd...',
  'dhtttbttthwhtwtd..ddhwhtd....',
  'dttbttthwhtwtd..ddhwhtd......',
  '.dddddhhhtwtd..dhwhtd........',
  '.....dhtwtd...dhwtd..........',
  '....dhwtd....ddddd...........',
  '....dddd.....................',
], GLASS);
const glassChip = tile([
  '....dd..',
  '...dhwd.',
  '..dhwtd.',
  '.dhwttd.',
  'dhttbd..',
  '.ddddd..',
], GLASS);

const FADE = [1, .93, .77, .56, .36, .22] as const;
function sparks(ctx: CanvasRenderingContext2D, p: FxPoint, hit: number, dir: number, scatter: number) {
  ctx.globalAlpha *= 1 - hit / 9;
  for (const [i, [x, y]] of DEBRIS.entries()) {
    if (i % 3 === 0) {
      coals(ctx, p.x + dir * x * (scatter + hit * 4), p.y + y * (scatter + hit * 2) + hit * hit * .5, dir, .46);
    } else {
      const a = p.x + dir * x * (scatter + hit * 4), b = p.y + y * (scatter + hit * 3) + hit * hit * .36;
      pixel(ctx, MAGMA.r, a - 1, b + 1, 3, 2);
      pixel(ctx, i % 2 ? MAGMA.h : MAGMA.w, a, b, 2);
    }
  }
}

const FLOW_HIT = 7;
function drawLavaflow(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, ground: FxPoint, missed: boolean, dir: number) {
  const hit = frame - FLOW_HIT;
  if (layer === 'back' && hit < 1) {
    const lead = [.03, .08, .16, .23, .33, .45, .58, .67][frame];
    const point = travel(source, ground, lead);
    ctx.globalAlpha *= .54;
    lava(ctx, point.x, point.y + 4, dir, .55 + frame * .096);
    if (frame >= 3) {
      const pool = travel(source, ground, Math.max(0, lead - .18));
      lava(ctx, pool.x, pool.y + 2, dir, .48 + frame * .08);
    }
  }
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    const lead = [0, .08, .20, .34, .5, .66, .83, 1, 1.14][frame];
    const front = travel(source, ground, lead, -.8), tail = travel(source, ground, lead - .14, -.7);
    if (hit >= 0) ctx.globalAlpha *= hit ? .33 : .63;
    lava(ctx, front.x, front.y - 5, dir, .55 + frame * .12);
    if (frame >= 2) basalt(ctx, tail.x, tail.y + 2, -dir, .75 + frame * .06);
  } else if (hit >= 0 && !missed) {
    if (layer === 'back' && hit < 6) {
      ctx.globalAlpha *= FADE[hit] * .71;
      flame(ctx, ground.x + dir * (8 + hit * 3), ground.y - 12, dir, 1.17 + hit * .15);
    } else if (layer === 'front' && hit < 6) {
      ctx.globalAlpha *= FADE[hit];
      lava(ctx, ground.x + dir * (9 + hit * 3), ground.y - 4, dir, 1.63 + hit * .11);
      basalt(ctx, ground.x - dir * (10 + hit * 4), ground.y + 1, -dir, .94 + hit * .13);
      if (hit === 0) pixel(ctx, MAGMA.w, ground.x - 4, ground.y - 7, 10, 3);
    } else if (layer === 'particles') sparks(ctx, { x: ground.x, y: ground.y - 9 }, hit, dir, 15);
  }
}

const EDGE_HIT = 5;
const EDGE_STEPS = [0, -.05, -.06, .21, .67, 1, .86, .58, .32, .12, 0];
function drawObsidianedge(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean, dir: number) {
  const hit = frame - EDGE_HIT;
  if (layer === 'back' && frame >= 2 && hit <= 0) {
    ctx.globalAlpha *= .56;
    glassChip(ctx, source.x - dir * (17 + frame), source.y + 4, -dir, .6 + frame * .085);
  }
  if (layer === 'front' && hit < 0) {
    const edge = { x: source.x + dir * (3 + frame), y: source.y - 2 };
    if (frame < 3) glassChip(ctx, edge.x, edge.y, dir, .5 + frame * .2);
    else cleaver(ctx, edge.x, edge.y, dir, .79 + frame * .088);
  } else if (hit >= 0 && !missed) {
    if (layer === 'front' && hit < 5) {
      ctx.globalAlpha *= FADE[hit];
      cleaver(ctx, target.x + dir * (hit * 5), target.y - 3 - hit, dir, 1.38 + hit * .045);
      cleaver(ctx, target.x - dir * (6 + hit), target.y + 7, -dir, .83 + hit * .065);
      if (hit === 0) pixel(ctx, GLASS.w, target.x - 3, target.y - 2, 8, 3);
    } else if (layer === 'particles') {
      ctx.globalAlpha *= 1 - hit / 8;
      for (const [i, [x, y]] of DEBRIS.entries()) {
        glassChip(ctx, target.x + dir * x * (12 + hit * 4), target.y + y * (11 + hit * 3) + hit * hit * .4, i % 2 ? dir : -dir, i % 2 ? .52 : .7);
      }
    }
  }
}

const SCORCH_HIT = 5;
function drawScorch(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const hit = frame - SCORCH_HIT, dir = direction(source, target);
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    const lead = [0, .12, .28, .5, .78, 1, 1.15][frame];
    const q = travel(source, target, lead, 8);
    if (hit >= 0) ctx.globalAlpha *= hit ? .31 : .68;
    coals(ctx, q.x, q.y, dir, .75 + frame * .09);
    if (frame >= 2) coals(ctx, q.x - dir * 11, q.y + 4, -dir, .56);
  } else if (hit >= 0 && !missed) {
    if (layer === 'back' && hit < 6) {
      ctx.globalAlpha *= FADE[hit] * .57;
      basalt(ctx, target.x + dir * (8 + hit * 3), target.y + 11, dir, 1.46 + hit * .14);
    } else if (layer === 'front' && hit < 6) {
      ctx.globalAlpha *= FADE[hit];
      const flames = [1, 1.38, 1.62, 1.67, 1.45, 1.08][hit];
      flame(ctx, target.x + dir * 9, target.y + 7 - flames * 10, dir, flames);
      flame(ctx, target.x - dir * (8 + hit), target.y + 6 - hit * 2, -dir, .73 + hit * .085);
      if (hit === 0) pixel(ctx, MAGMA.w, target.x - 3, target.y - 1, 7, 4);
    } else if (layer === 'particles') sparks(ctx, target, hit, dir, 10);
  }
}

const RUPTURE_HIT = 7;
function drawEruption(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, ground: FxPoint, missed: boolean, dir: number) {
  const hit = frame - RUPTURE_HIT;
  if (hit < 0) {
    if (layer === 'back' && frame <= 3) {
      ctx.globalAlpha *= .71;
      basalt(ctx, source.x + dir * 4, source.y + 2, dir, .81 + frame * .23);
    } else if (layer === 'front' && frame >= 2) {
      const point = frame <= 3 ? travel(source, ground, frame === 2 ? .16 : .49) : ground;
      const open = [.56, .71, .99, 1.29, 1.61][frame - 2];
      basalt(ctx, point.x, point.y - 2, dir, open);
      if (frame >= 4) coals(ctx, point.x + dir * 9, point.y - 7 - frame, -dir, open * .56);
    }
    return;
  }
  if (missed) return;
  if (layer === 'back' && hit < 6) {
    ctx.globalAlpha *= FADE[hit] * .62;
    magmaColumn(ctx, ground.x - dir * (9 + hit), ground.y - 11 - hit * 4, -dir, 1.54 + hit * .16);
  } else if (layer === 'front' && hit < 6) {
    ctx.globalAlpha *= FADE[hit];
    const rise = [1.59, 2.11, 2.18, 1.95, 1.57, 1.08][hit];
    lava(ctx, ground.x, ground.y + 1, dir, 1.62 + hit * .13);
    magmaColumn(ctx, ground.x + dir * (4 + hit * 2), ground.y - 1 - rise * 10, dir, rise);
    if (hit === 0) pixel(ctx, MAGMA.w, ground.x - 3, ground.y - 13, 9, 6);
  } else if (layer === 'particles') sparks(ctx, { x: ground.x, y: ground.y - 16 }, hit, dir, 21);
}

export const FISSURE_FX: Partial<Record<string, AnimatedFx>> = {
  lavaflow: { frames: 16, frameMs: 58, hitFrame: FLOW_HIT, socket: 'ground', targetSocket: 'ground', draw: drawLavaflow },
  obsidianedge: { frames: 13, frameMs: 54, hitFrame: EDGE_HIT, socket: 'claw', draw: drawObsidianedge, dash: (frame, miss) => dashProgress(EDGE_STEPS, frame, miss) },
  scorch: { frames: 14, frameMs: 55, hitFrame: SCORCH_HIT, socket: 'mouth', draw: drawScorch },
  eruption: { frames: 16, frameMs: 59, hitFrame: RUPTURE_HIT, socket: 'ground', targetSocket: 'ground', draw: drawEruption },
};
