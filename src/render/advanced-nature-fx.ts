// 初始夥伴的火、草進階技能，以及淺灘常見的咬擊與咆哮。
import { dashProgress, direction, pixel, pixelArc, pixelStroke, tile, travel, type AnimatedFx, type FxLayer, type FxPoint } from './skill-fx-helpers';

const FIRE = { ink: '#654056', red: '#be5036', orange: '#f17b3e', gold: '#ffd073', white: '#fff1a4' };
const SHADOW = { ink: '#312341', purple: '#655282', violet: '#957ac0', pale: '#dbc7f2' };
const PETAL = { ink: '#245349', green: '#54965b', lime: '#a8d979', bright: '#e9ffd2' };
const MOTES = [[-.9, -.53], [-.4, -.92], [.22, -.97], [.81, -.62], [1, .1], [.5, .63], [-.65, .69]] as const;

const flare = tile([
  '.........d......',
  '........drd.....',
  '.......drood....',
  '...d..drooyd....',
  '..drddroyoyd.d..',
  '..droooywyyddrd.',
  '.drooyywwyyooord',
  'droyywwwyyooorrd',
  '.drooyyywwyoord.',
  '..dddrrroordd...',
  '.....dddddd.....',
], { d: FIRE.ink, r: FIRE.red, o: FIRE.orange, y: FIRE.gold, w: FIRE.white });

const fireJaw = tile([
  '..........dddddddddd.........',
  '......dddrroooooooooooddd....',
  '...ddrroooyyyyyyyyyyooorrdd..',
  '..drooyyywyywyywwywyyyoorrd..',
  'ddroyyywwyywyydywwywdyyyyordd',
  'droywwdywdywd..dwywd.dyyoord.',
  '.drwwd.dy.dwd..dywdd.dwyord..',
  '..dwd...d..d....dd....dyd....',
  '...d...................d.....',
], { d: FIRE.ink, r: FIRE.red, o: FIRE.orange, y: FIRE.gold, w: FIRE.white });
const shadeJaw = tile([
  '.........dddddddddddd........',
  '......dddppppppppppppdddd....',
  '...dddpppvvvpvvppvvppvvvpddd.',
  '..dppvvvppvvlvvvvlvvvvpvvpppd',
  'ddpvvvlvvlvlllvlvllllvvvlvppd',
  'dpvlllddlldllddvlllddllldppdd',
  '.dvlld..dd.dd..dldd..dllddd..',
  '..dld...........d.....dld....',
  '...d...................d.....',
], { d: SHADOW.ink, p: SHADOW.purple, v: SHADOW.violet, l: SHADOW.pale });

const leaflet = tile([
  '......ddd...',
  '....ddgldd..',
  '..ddggllld..',
  '.dggllwld...',
  'dglwllldd...',
  '.dlddd......',
  '..d.........',
], { d: PETAL.ink, g: PETAL.green, l: PETAL.lime, w: PETAL.bright });
const thorn = tile([
  '.....dd.....',
  '.....dld....',
  '....dcld....',
  '....dcggd...',
  '....dgggd...',
  '...dgllggd..',
  '..dgllggggd.',
  '.dgllgggggdd',
  '.dgccccggdd.',
  '..ddddddd...',
], { d: PETAL.ink, g: '#568b55', l: '#b9cf79', c: '#729a70' });

function jaws(ctx: CanvasRenderingContext2D, jaw: typeof fireJaw, point: FxPoint, dir: number, gap: number, scale: number) {
  jaw(ctx, point.x, point.y - gap, dir, scale);
  ctx.save();
  ctx.translate(point.x, point.y + gap);
  ctx.scale(1, -1);
  jaw(ctx, 0, 0, dir, scale);
  ctx.restore();
}

const FIREBITE_HIT = 5;
const FIREBITE_DASH = [0, -.07, -.05, .2, .66, 1, .89, .62, .35, .12, 0];
function drawFlamebite(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean, dir: number) {
  const hit = frame - FIREBITE_HIT;
  if (layer === 'back' && frame >= 2 && frame <= 6) {
    ctx.globalAlpha *= frame < 5 ? .57 : .37;
    flare(ctx, source.x - dir * (14 + frame), source.y + 5, -dir, .52 + frame * .065);
  }
  if (layer === 'front' && frame <= 4) {
    flare(ctx, source.x - dir * 3, source.y - 2, dir, .58 + frame * .11);
    if (frame === 4) jaws(ctx, fireJaw, { x: source.x + dir * 7, y: source.y }, dir, 9, .78);
  }
  if (hit < 0 || missed) return;
  if (layer === 'front' && hit <= 4) {
    ctx.globalAlpha *= [1, .98, .81, .58, .34][hit];
    jaws(ctx, fireJaw, target, dir, [5, 3, 4, 6, 8][hit], [1.09, 1.16, 1.1, .95, .83][hit]);
    flare(ctx, target.x + dir * (8 + hit * 3), target.y - 4 - hit * 4, dir, .86 + hit * .12);
    if (hit < 2) pixel(ctx, FIRE.white, target.x - 3, target.y - 1, 7, 3);
  } else if (layer === 'particles') {
    ctx.globalAlpha *= 1 - hit / 8;
    for (const [i, [x, y]] of MOTES.entries()) {
      const px = target.x + dir * x * (11 + hit * 4), py = target.y + y * (9 + hit * 3) - hit * 1.8;
      pixel(ctx, FIRE.red, px - 1, py + 1, 3);
      pixel(ctx, i % 2 ? FIRE.gold : FIRE.orange, px, py, 2);
    }
  }
}

const DARKBITE_HIT = 5;
const DARKBITE_DASH = [0, -.04, -.08, .23, .72, 1, .84, .48, .19, 0];
function drawDarkbite(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean, dir: number) {
  const hit = frame - DARKBITE_HIT;
  if (layer === 'back' && frame >= 2 && frame <= 8) {
    ctx.globalAlpha *= [.37, .53, .63, .58, .44, .32, .19][frame - 2];
    const contact = hit >= 0 && !missed;
    const point = contact ? target : source;
    const width = contact ? 23 + hit * 3 : 12 + frame;
    pixelArc(ctx, { x: point.x - dir * 5, y: point.y + 9 }, width, 6, 0, Math.PI * 2, SHADOW.ink, 3);
  }
  if (layer === 'front' && frame <= 4) {
    const mouth = { x: source.x + dir * (5 + frame), y: source.y };
    if (frame <= 2) pixelArc(ctx, mouth, 5 + frame, 3 + frame, -.5 * Math.PI, Math.PI, SHADOW.violet, 2);
    else jaws(ctx, shadeJaw, mouth, dir, frame === 3 ? 9 : 12, frame === 3 ? .64 : .82);
  }
  if (hit < 0 || missed) return;
  if (layer === 'front' && hit <= 4) {
    ctx.globalAlpha *= [1, .9, .7, .47, .25][hit];
    jaws(ctx, shadeJaw, target, dir, [5, 2, 3, 5, 7][hit], [1.14, 1.22, 1.1, .98, .87][hit]);
    if (hit <= 1) {
      pixel(ctx, SHADOW.ink, target.x - 6, target.y - 3, 13, 7);
      pixel(ctx, SHADOW.pale, target.x - 2, target.y - 1, 5, 3);
    }
  } else if (layer === 'particles') {
    ctx.globalAlpha *= 1 - hit / 7;
    for (const [i, [x, y]] of MOTES.entries()) {
      const p = { x: target.x + dir * x * (9 + hit * 4), y: target.y + y * (8 + hit * 2) + hit };
      pixel(ctx, SHADOW.ink, p.x - 1, p.y - 1, 4, 3);
      pixel(ctx, i % 3 ? SHADOW.violet : SHADOW.pale, p.x, p.y, 2);
    }
  }
}

const HEAT_HIT = 5;
function drawHeatup(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, center: FxPoint, _target: FxPoint, _miss: boolean, dir: number) {
  const hit = frame - HEAT_HIT, lift = [0, 2, 6, 9, 13, 18, 23, 26, 29, 31, 33, 35, 36][frame];
  if (hit >= 3) ctx.globalAlpha *= [1, .8, .63, .43, .24][hit - 3];
  if (layer === 'back') {
    ctx.globalAlpha *= .65;
    if (frame >= 2) {
      for (const side of [-1, 1]) {
        const rise = lift + (side === 1 ? 8 : 3);
        const x = center.x + side * (14 + frame * .55);
        const air = [
          { x, y: center.y + 13 },
          { x: x + side * 4, y: center.y + 10 - rise * .45 },
          { x: x + side * 2, y: center.y + 10 - rise * .74 },
          { x: x + side * 6, y: center.y + 10 - rise },
        ];
        pixelStroke(ctx, air, FIRE.red, 4);
        pixelStroke(ctx, air, FIRE.orange, 2);
      }
    }
    flare(ctx, center.x - dir * 9, center.y + 6 - lift * .55, -dir, .66 + lift * .038);
    flare(ctx, center.x + dir * 11, center.y + 6 - lift * .54, dir, .6 + lift * .027);
  } else if (layer === 'front') {
    flare(ctx, center.x - dir * (17 + Math.sin(frame) * 3), center.y + 13 - lift, -dir, .48 + lift * .025);
    flare(ctx, center.x + dir * (20 + Math.sin(frame) * 2), center.y + 16 - lift * .81, dir, .58 + lift * .026);
    const base = { x: center.x, y: center.y + 17 };
    pixelArc(ctx, base, 14 + lift * .32, 5 + lift * .08, .13, 2.87, FIRE.red, 2);
    pixelArc(ctx, base, 13 + lift * .31, 5 + lift * .08, .27, 2.43, FIRE.gold, 1);
    if (hit >= 0 && hit < 3) pixel(ctx, FIRE.white, center.x - 1, center.y - 21, 3, 7);
  } else if (frame >= 2) {
    for (const [i, [x, y]] of MOTES.entries()) {
      pixel(ctx, i % 2 ? FIRE.gold : FIRE.orange, center.x + x * (13 + lift * .40), center.y + y * 13 - lift, i % 2 + 1, 2);
    }
  }
}

const VINE_HIT = 6;
function drawVinebind(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const dir = direction(source, target), hit = frame - VINE_HIT;
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    const p = [0, .075, .22, .42, .61, .81, 1, 1.12][frame];
    const points = Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      const point = travel(source, target, p * t);
      const bend = Math.sin(t * Math.PI * 2.8 + frame * .32) * Math.sin(t * Math.PI);
      return { x: point.x, y: point.y + bend * (3 + frame * 1.6) };
    });
    ctx.globalAlpha *= hit >= 0 ? (hit ? .35 : .68) : 1;
    pixelStroke(ctx, points, PETAL.ink, 5);
    pixelStroke(ctx, points, PETAL.green, 3);
    pixelStroke(ctx, points, PETAL.lime, 1);
    leaflet(ctx, points[12].x + dir * 2, points[12].y, dir, .8);
    if (frame >= 3) {
      leaflet(ctx, points[5].x, points[5].y - 3, -dir, .62);
      leaflet(ctx, points[8].x, points[8].y + 3, dir, .55);
    }
  } else if (!missed && hit >= 0) {
    if ((layer === 'front' || layer === 'back') && hit <= 5) {
      ctx.globalAlpha *= [1, .98, .83, .67, .48, .29][hit];
      const start = layer === 'front' ? -.07 : Math.PI - .07;
      for (const [i, y] of [-9, 1, 11].entries()) {
        const center = { x: target.x + dir * (6 - i * 2), y: target.y + y + (hit > 3 ? hit - 3 : 0) };
        const width = 15 + i - Math.min(3, hit);
        pixelArc(ctx, center, width, 4.5 - i * .5, start, Math.PI, PETAL.ink, 4);
        pixelArc(ctx, center, width, 4 - i * .5, start, Math.PI, layer === 'front' ? PETAL.lime : PETAL.green, 2);
        if (layer === 'front') leaflet(ctx, center.x + dir * (width - 1), center.y, dir, .63 + i * .03);
      }
      if (layer === 'front' && hit === 0) pixel(ctx, PETAL.bright, target.x - 2, target.y, 5, 2);
    } else if (layer === 'particles') {
      ctx.globalAlpha *= 1 - hit / 8;
      for (const [i, [x, y]] of MOTES.entries()) {
        if (i % 2 === 0) leaflet(ctx, target.x + dir * x * (12 + hit * 3), target.y + y * (11 + hit * 2) + hit * hit * .47, dir, .42);
      }
    }
  }
}

const PHOTO_HIT = 6;
function drawPhotosynth(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, center: FxPoint, _target: FxPoint, _miss: boolean, dir: number) {
  const hit = frame - PHOTO_HIT;
  const strength = [.22, .36, .54, .66, .78, .89, 1, .95, .83, .67, .53, .37, .21, .12][frame];
  if (layer === 'back') {
    const ray = [{ x: center.x - dir * 24, y: center.y - 51 }, { x: center.x - dir * 4, y: center.y + 10 }];
    ctx.globalAlpha *= strength * .25;
    pixelStroke(ctx, ray, '#ecd98c', 14);
    pixelStroke(ctx, ray, '#fff3c0', 6);
    pixelArc(ctx, { x: center.x, y: center.y + 15 }, 15 + frame * .65, 7, 0, Math.PI * 2, PETAL.lime, 2);
  } else if (layer === 'front') {
    ctx.globalAlpha *= strength;
    for (let i = 0; i <= Math.min(frame, 4); i++) {
      const p = ((frame + i * 2) % 11) / 11;
      leaflet(ctx, center.x + dir * (7 + i * 5) * (i % 2 ? -1 : 1), center.y - 26 + p * 34, i % 2 ? dir : -dir, .51 + p * .28);
    }
    if (hit >= 0 && hit <= 2) {
      pixel(ctx, '#fff9cb', center.x - 4, center.y - 12, 9, 2);
      pixel(ctx, '#fff9cb', center.x, center.y - 16, 2, 10);
    }
  } else if (frame >= 2) {
    ctx.globalAlpha *= strength;
    for (const [i, [x, y]] of MOTES.entries()) {
      pixel(ctx, i % 2 ? '#f4e995' : PETAL.bright, center.x + x * (12 + frame), center.y + y * 16 - frame * .6, i % 2 + 1, 2);
    }
  }
}

const THORN_HIT = 5;
function drawThornarmor(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, center: FxPoint, _target: FxPoint, _miss: boolean, dir: number) {
  const hit = frame - THORN_HIT;
  const radius = [9, 12, 16, 20, 23, 25, 25, 25, 25, 26, 26, 26, 26][frame];
  if (hit >= 3) ctx.globalAlpha *= [.95, .79, .62, .42, .24][hit - 3];
  const base = { x: center.x, y: center.y + 9 };
  if (layer === 'back' || layer === 'front') {
    const back = layer === 'back';
    const start = back ? Math.PI : 0;
    pixelArc(ctx, base, radius, 10, start, Math.PI, PETAL.ink, 4);
    pixelArc(ctx, base, radius, 9, start, Math.PI, back ? PETAL.green : PETAL.lime, 2);
    for (const [i, [x, y]] of MOTES.entries()) {
      if ((y < 0) !== back || frame + 1 < i) continue;
      thorn(ctx, base.x + dir * x * (radius - 1), base.y + y * 12 - 5, dir, .47 + Math.min(frame, 5) * .14 + i * .018);
    }
    if (!back && hit >= 0 && hit < 3) pixel(ctx, PETAL.bright, center.x + dir * 17, center.y + 6, 4, 3);
  } else if (hit >= 0) {
    for (const [i, [x, y]] of MOTES.entries()) {
      if (i % 2) leaflet(ctx, center.x + dir * x * (23 + hit * 2), center.y + y * 12 - hit * 1.4, dir, .47);
    }
  }
}

const ROAR_HIT = 5;
const SOUND = { ink: '#795775', copper: '#d18b68', gold: '#ffd58a', white: '#fff4cb' };
function drawRoar(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, center: FxPoint, _target: FxPoint, _miss: boolean, dir: number) {
  const hit = frame - ROAR_HIT;
  const facing = dir > 0 ? 0 : Math.PI;
  if (layer === 'back' && frame >= 2) {
    ctx.globalAlpha *= (1 - frame / 12) * .61;
    pixelArc(ctx, { x: center.x - dir * 13, y: center.y + 12 }, 11 + frame * 3, 7 + frame, 0, Math.PI * 2, SOUND.copper, 2);
  } else if (layer === 'front') {
    const p = { x: center.x + dir * frame * 1.8, y: center.y };
    for (let i = 0; i <= Math.min(2, Math.floor(frame / 2)); i++) {
      const radius = Math.max(3, (frame - i * 2) * (2.4 + i * .11) + 3);
      ctx.save();
      ctx.globalAlpha *= (1 - frame / 13) * (1 - i * .18);
      pixelArc(ctx, p, radius, 4 + radius * .61, facing - 1.2, 2.4, SOUND.ink, 3);
      pixelArc(ctx, p, radius, 4 + radius * .61, facing - 1.05, 2.11, i ? SOUND.copper : SOUND.gold, 2);
      ctx.restore();
    }
    if (hit >= 0 && hit <= 1) pixel(ctx, SOUND.white, center.x - 1, center.y - 3, 5, 4);
  } else if (hit >= 0) {
    ctx.globalAlpha *= 1 - hit / 7;
    for (const [i, [x, y]] of MOTES.entries()) {
      if (i < 5) pixel(ctx, i % 2 ? SOUND.gold : SOUND.white, center.x + dir * (6 + i * 4 + hit * (2 + x)), center.y + y * (9 + hit * 2), i % 2 + 1);
    }
  }
}

export const ADVANCED_NATURE_FX: Partial<Record<string, AnimatedFx>> = {
  heatup: { frames: 13, frameMs: 56, hitFrame: HEAT_HIT, socket: 'body', draw: drawHeatup, self: true },
  flamebite: { frames: 13, frameMs: 55, hitFrame: FIREBITE_HIT, socket: 'mouth', draw: drawFlamebite, dash: (frame, miss) => dashProgress(FIREBITE_DASH, frame, miss) },
  vinebind: { frames: 14, frameMs: 57, hitFrame: VINE_HIT, socket: 'crown', draw: drawVinebind },
  photosynth: { frames: 14, frameMs: 58, hitFrame: PHOTO_HIT, socket: 'body', draw: drawPhotosynth, self: true },
  thornarmor: { frames: 13, frameMs: 56, hitFrame: THORN_HIT, socket: 'body', draw: drawThornarmor, self: true },
  darkbite: { frames: 12, frameMs: 54, hitFrame: DARKBITE_HIT, socket: 'mouth', draw: drawDarkbite, dash: (frame, miss) => dashProgress(DARKBITE_DASH, frame, miss) },
  roar: { frames: 12, frameMs: 54, hitFrame: ROAR_HIT, socket: 'mouth', draw: drawRoar, self: true },
};
