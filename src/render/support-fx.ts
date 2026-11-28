// 淺灘的連擊、防禦與狀態技能。碰撞或成形的畫格由戰鬥事件同步。
import { direction, pixel, pixelArc, tile, travel, type AnimatedFx, type FxLayer, type FxPoint } from './skill-fx-helpers';
import { waterBubble } from './starter-fx';

const AQUA = {
  outline: '#31517d', shadow: '#4d97c9', light: '#a9f0ee', white: '#f0ffff', violet: '#b7a3ea',
};
const ORBIT = [[-1, -.6], [-.30, -1], [.55, -.86], [1, -.25], [.83, .55], [.26, .95], [-.62, .78], [-1, .18]] as const;

const BARRAGE_HIT = 5;
function drawBarrage(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const hit = frame - BARRAGE_HIT, dir = direction(source, target);
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    const p = [0, .09, .28, .51, .78, 1, 1.13][frame];
    const center = travel(source, target, p, 6);
    if (hit >= 0) ctx.globalAlpha *= hit ? .39 : .8;
    waterBubble(ctx, center.x, center.y, dir, [.62, .78, .88, .9, .85, .8, .72][frame]);
    if (frame >= 2) {
      pixel(ctx, AQUA.shadow, center.x - dir * 9, center.y + 3, 2);
      pixel(ctx, AQUA.light, center.x - dir * 13, center.y + 1, 3);
    }
  } else if (hit >= 0 && !missed) {
    if (layer === 'front' && hit <= 3) {
      ctx.globalAlpha *= [1, .94, .6, .33][hit];
      const radius = [6, 9, 12, 14][hit];
      for (const [i, [x, y]] of ORBIT.entries()) {
        const px = target.x + x * radius, py = target.y + y * radius * .85;
        pixel(ctx, AQUA.outline, px - 1, py + 1, 3, 2);
        pixel(ctx, i < 4 ? AQUA.white : AQUA.light, px, py, i % 2 + 2);
      }
      if (hit === 0) {
        pixel(ctx, AQUA.light, target.x - 4, target.y, 9, 2);
        pixel(ctx, AQUA.white, target.x - 1, target.y - 2, 3, 6);
      }
    } else if (layer === 'particles') {
      ctx.globalAlpha *= 1 - hit / 7;
      for (const [i, [x, y]] of ORBIT.entries()) {
        if (i % 2 === 0) pixel(ctx, AQUA.light, target.x + dir * x * (12 + hit * 3), target.y + y * (9 + hit * 3) + hit * hit * .6, 2);
      }
    }
  }
}

const GUARD_HIT = 5;
function drawBubbleguard(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, center: FxPoint, _target: FxPoint, _missed: boolean, dir: number) {
  const hit = frame - GUARD_HIT;
  const rx = [8, 12, 17, 22, 25, 27, 28, 27, 27, 27, 26, 25, 24, 24][frame];
  const ry = rx * .82;
  if (frame >= 9) ctx.globalAlpha *= [1, .83, .63, .41, .23][frame - 9];
  const c = { x: center.x, y: center.y - Math.max(0, frame - 1) * .45 };
  const face = dir === 1 ? 0 : Math.PI;
  if (layer === 'back') {
    ctx.fillStyle = '#7cdded30';
    ctx.beginPath(); ctx.ellipse(c.x + 1, c.y + 1, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    pixelArc(ctx, c, rx, ry, 0, Math.PI * 2, AQUA.outline, 2);
    pixelArc(ctx, c, rx - 1, ry - 1, Math.PI * 1.02, Math.PI * .95, AQUA.shadow, 2);
  } else if (layer === 'front') {
    if (hit < -1) {
      waterBubble(ctx, dir * rx * .65, 5 - frame * 3, dir, .74);
      waterBubble(ctx, -dir * rx * .72, 1 - frame, dir, .5);
    }
    pixelArc(ctx, c, rx, ry, face - 1.14, 2.28, AQUA.shadow, 3);
    pixelArc(ctx, c, rx - 1, ry - 1, face - 1, 1.83, AQUA.light, 2);
    pixelArc(ctx, c, rx - 3, ry - 4, Math.PI * 1.18, Math.PI * .42, AQUA.white, hit >= 0 && hit <= 2 ? 2 : 1);
    if (hit >= 0 && hit <= 4) {
      pixelArc(ctx, { x: c.x, y: c.y - 2 }, rx - 4, ry - 4, face - .55, 1.15, AQUA.violet, 1);
      pixel(ctx, AQUA.white, dir * (rx - 1), c.y - 1, 2, 4);
    }
  } else if (hit >= 0) {
    for (const [i, [x, y]] of ORBIT.entries()) {
      if (i % 2 === 0) waterBubble(ctx, x * (rx + hit * 1.5), c.y + y * (ry + 3) - hit, 1, .34);
    }
  }
}

const plate = tile([
  '......dddd.....',
  '....ddhhmmdd...',
  '..ddhhhmmsmdd..',
  '.dhhhmmmsmsmd..',
  'dhhmmsddmsmmmd.',
  'ddmmddsdmsmmsmd',
  'dsdssdsmsmmsssd',
  '.dssdsmmsssdssd',
  '..dssmsssssssdd',
  '...ddssssssdd..',
  '.....dddddd....',
], { d: '#494452', s: '#777384', m: '#a99c96', h: '#f0d2a3' });

const HARDEN_HIT = 5;
function drawHarden(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, center: FxPoint, _target: FxPoint, _missed: boolean, dir: number) {
  const hit = frame - HARDEN_HIT;
  if (hit > 3) ctx.globalAlpha *= [1, .76, .52, .34, .21][hit - 3];
  if (layer === 'back' && frame >= 1) {
    const width = frame < HARDEN_HIT ? 29 - frame : 24 + Math.max(0, hit - 2);
    pixelArc(ctx, { x: center.x, y: center.y + 13 }, width, 7, Math.PI, Math.PI * 2, '#726e81', 2);
  } else if (layer === 'front') {
    const radius = [39, 34, 30, 27, 24, 21, 20, 21, 21, 21, 22, 23, 24][frame];
    for (const [i, [x, y]] of [[-.96, .38], [-.61, -.78], [.25, -.91], [.91, -.36], [.86, .57]].entries()) {
      if (frame + 1 < i) continue;
      const scale = i === 0 || i === 4 ? 1.07 : .78;
      plate(ctx, center.x + dir * x * radius, center.y + y * radius * .92, x < 0 ? -dir : dir, scale);
    }
    if (hit >= 0 && hit <= 2) {
      const p = { x: center.x + dir * (21 + hit * 2), y: center.y - 4 };
      pixel(ctx, '#ffebcd', p.x, p.y - 4, 2, 8);
      pixel(ctx, '#ffebcd', p.x - 3, p.y - 1, 8, 2);
    }
  } else if (layer === 'particles' && hit >= 0) {
    for (const [i, [x, y]] of ORBIT.entries()) {
      pixel(ctx, i % 2 ? '#f0d2a3' : '#8f8596', center.x + x * (20 + hit * 2), center.y + y * (15 + hit) + hit * hit * .38, 2);
    }
  }
}

const spores = tile([
  '.....ss.........',
  '....sghs.sss....',
  '...sgghgsglgs...',
  '.ssgglgggglghs..',
  'sglghgghgghgggss',
  'sgghggvgglghgggs',
  '.sggglgghggvghs.',
  '.ssghggvggggss..',
  '...ssssgghgs....',
  '.......ssss.....',
], { s: '#3548639e', g: '#81894fc4', h: '#b7cb6da8', l: '#d2eda0', v: '#bcb1d7' });
const seed = tile([
  '..dd...',
  '.dgld..',
  'dgglhd.',
  'dglhdd.',
  '.dddd..',
], { d: '#635d7a', g: '#93a65b', l: '#dcf09a', h: '#e5d2ef' });
const SPORE_HIT = 6;
function drawSporecloud(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const dir = direction(source, target), hit = frame - SPORE_HIT;
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    const p = [0, .09, .22, .38, .57, .78, 1, 1.12][frame];
    if (hit >= 0) ctx.globalAlpha *= hit ? .28 : .61;
    for (let i = 0; i <= Math.min(3, frame); i++) {
      const center = travel(source, target, Math.max(0, p - i * .07), 9);
      const y = center.y + (i % 2 ? i * 3 : i * -2);
      spores(ctx, center.x, y, i % 2 ? -dir : dir, [.79, .72, .61, .48][i] + frame * .045);
    }
  } else if (hit >= 0 && !missed) {
    if (layer === 'back' && hit < 5) {
      ctx.globalAlpha *= [.7, .68, .52, .37, .22][hit];
      spores(ctx, target.x + dir * 7, target.y - 9 - hit, -dir, 2.7);
    } else if (layer === 'front' && hit <= 5) {
      ctx.globalAlpha *= [1, .92, .8, .6, .38, .19][hit];
      spores(ctx, target.x + dir * (7 + hit * 2), target.y + 6 - hit, dir, 1.38);
      spores(ctx, target.x - dir * (6 + hit * 2), target.y + 4, -dir, 1.13);
      seed(ctx, target.x, target.y - 8 - hit * 1.4, dir, .9);
      seed(ctx, target.x + dir * 11, target.y + 3 - hit * 2, -dir, .73);
    } else if (layer === 'particles') {
      ctx.globalAlpha *= 1 - hit / 8;
      for (const [i, [x, y]] of ORBIT.entries()) {
        seed(ctx, target.x + dir * x * (8 + hit * 2.5), target.y + y * (7 + hit * 2) - hit * .8, i % 2 ? dir : -dir, i % 2 ? .52 : .38);
      }
    }
  }
}

const PULSE = { outline: '#5b4e9d', glow: '#bdacef', gold: '#f8d595', light: '#fff0c2' };
const PULSE_HIT = 6;
function drawParalywave(ctx: CanvasRenderingContext2D, layer: FxLayer, frame: number, source: FxPoint, target: FxPoint, missed: boolean) {
  const dir = direction(source, target), face = dir === 1 ? 0 : Math.PI, hit = frame - PULSE_HIT;
  if (layer === 'front' && (hit < 0 || (missed && hit < 2))) {
    const leading = [0, .07, .21, .39, .58, .78, 1, 1.16][frame];
    const waves = Math.min(2, Math.floor(frame / 2));
    for (let i = waves; i >= 0; i--) {
      const p = Math.max(0, leading - i * .135);
      const center = travel(source, target, p);
      ctx.save();
      ctx.globalAlpha *= [.95, .78, .58][i] * (hit >= 0 ? .64 : 1);
      const height = Math.min(15, 6 + frame * 1.2) - i;
      pixelArc(ctx, center, 8 - i * 1.3, height, face - 1.32, 2.64, PULSE.outline, 3);
      pixelArc(ctx, center, 8 - i * 1.3, height, face - 1.15, 2.22, PULSE.gold, 2);
      pixelArc(ctx, center, 8 - i * 1.3, height, face - 1, .78, PULSE.light, 1);
      ctx.restore();
    }
  } else if (hit >= 0 && !missed) {
    if (layer === 'back' && hit <= 4) {
      ctx.globalAlpha *= [.61, .65, .53, .39, .24][hit];
      pixelArc(ctx, target, 14 + 3 * hit, 17 + 2 * hit, 0, Math.PI * 2, PULSE.outline, 2);
    } else if (layer === 'front' && hit <= 4) {
      ctx.globalAlpha *= [1, .89, .72, .5, .25][hit];
      const c = { x: target.x + dir * (2 + hit * 3), y: target.y };
      pixelArc(ctx, c, 14 + hit * 2, 17 + hit, face - 1.42, 2.84, PULSE.outline, 3);
      pixelArc(ctx, c, 14 + hit * 2, 17 + hit, face - 1.28, 2.52, PULSE.glow, 2);
      pixelArc(ctx, c, 14 + hit * 2, 17 + hit, face - 1, 1.83, PULSE.light, 1);
      if (hit < 2) {
        pixel(ctx, PULSE.glow, target.x + dir * 7, target.y - 4, 2, 9);
        pixel(ctx, PULSE.light, target.x + dir * 7 - 2, target.y, 6, 2);
      }
    } else if (layer === 'particles') {
      ctx.globalAlpha *= 1 - hit / 7;
      for (const [i, [x, y]] of ORBIT.entries()) {
        pixel(ctx, i % 2 ? PULSE.gold : PULSE.glow, target.x + dir * x * (13 + hit * 2), target.y + y * (13 + hit * 2), 2);
      }
    }
  }
}

export const SUPPORT_FX: Partial<Record<string, AnimatedFx>> = {
  bubblebarrage: { frames: 12, frameMs: 46, hitFrame: BARRAGE_HIT, socket: 'mouth', draw: drawBarrage, repeat: true },
  bubbleguard: { frames: 14, frameMs: 60, hitFrame: GUARD_HIT, socket: 'body', draw: drawBubbleguard, self: true },
  harden: { frames: 13, frameMs: 55, hitFrame: HARDEN_HIT, socket: 'body', draw: drawHarden, self: true },
  sporecloud: { frames: 14, frameMs: 57, hitFrame: SPORE_HIT, socket: 'crown', draw: drawSporecloud },
  paralywave: { frames: 13, frameMs: 54, hitFrame: PULSE_HIT, socket: 'core', draw: drawParalywave },
};
