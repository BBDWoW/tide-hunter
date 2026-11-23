// 神秘事件的插圖：畫在海面上的一小幕（像素風），每種事件都有自己的畫面
type C = CanvasRenderingContext2D;
export type EventArt =
  | 'boat' | 'wreck' | 'crate' | 'chest' | 'bottle' | 'egg' | 'whirlpool' | 'altar' | 'birds' | 'spring' | 'creature' | 'shadow'
  | 'storm' | 'gamble' | 'jellies' | 'pirates' | 'fog' | 'song' | 'contest' | 'meteor' | 'island' | 'coral' | 'lighthouse'
  | 'aurora' | 'volcano' | 'forge' | 'terminal' | 'orb' | 'mirror' | 'frozen';

export const EVENT_ART: Record<string, EventArt> = {
  peddler: 'boat', sunkcrate: 'crate', bottle: 'bottle', wreckboat: 'wreck', egg: 'egg', whirlpool: 'whirlpool', oldfisher: 'boat',
  altar: 'altar', scout: 'birds', hotspring: 'spring', trapped: 'creature', storm: 'storm', gamble: 'gamble', jellies: 'jellies',
  lostchild: 'creature', sunkenchest: 'chest', pirates: 'pirates', fogbank: 'fog', seasong: 'song', contest: 'contest',
  shipwright: 'boat', barter: 'boat', meteor: 'meteor', giantshadow: 'shadow', island: 'island', postbird: 'birds',
  coralgarden: 'coral', lighthouse: 'lighthouse', frozenmon: 'frozen', aurora: 'aurora', eruption: 'volcano', forge: 'forge',
  datacache: 'terminal', vending: 'terminal', abysslight: 'orb', whalesong: 'song', spiritfont: 'spring', mirror: 'mirror',
};

const X = 188, Y = 110; // 插圖中心（海面上）
const r = (c: C, x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
const rnd = (i: number) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

function ripple(c: C, x: number, y: number, w: number, t: number, col = 'rgba(255,255,255,0.55)') {
  for (let k = 0; k < 3; k++) { const p = (t * 0.6 + k / 3) % 1, ww = w * (0.6 + p * 0.8); r(c, x - ww / 2, y + k, ww, 1, col.replace(/[\d.]+\)$/, `${(1 - p) * 0.6})`)); }
}
function smallBoat(c: C, x: number, y: number, t: number, hull = '#7a4a26', sail?: string) {
  const b = Math.round(Math.sin(t * 2) * 1.2); y += b;
  if (sail) { r(c, x - 1, y - 30, 2, 28, '#3a2210'); c.fillStyle = sail; c.beginPath(); c.moveTo(x + 1, y - 29); c.lineTo(x + 17, y - 8); c.lineTo(x + 1, y - 8); c.fill(); }
  r(c, x - 20, y - 4, 40, 3, hull); r(c, x - 18, y - 1, 36, 3, '#4a2a14'); r(c, x - 14, y + 2, 28, 2, '#3a2010'); r(c, x - 20, y - 5, 40, 1, '#c88a52');
  ripple(c, x, y + 5, 46, t);
}
function person(c: C, x: number, y: number, coat = '#3a6ad0', hat = '#e0c070') {
  r(c, x - 2, y - 12, 5, 5, '#f0c8a0'); r(c, x - 3, y - 14, 7, 2, hat); r(c, x - 3, y - 7, 7, 7, coat); r(c, x - 1, y - 10, 1, 1, '#2a1a10');
}
function glow(c: C, x: number, y: number, rad: number, rgb: string, a = 0.5) {
  const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}
function chestShape(c: C, x: number, y: number, open: boolean) {
  r(c, x - 10, y - 8, 20, 9, '#8a5226'); r(c, x - 10, y - 8, 20, 1, '#c88a52'); r(c, x - 7, y - 8, 2, 9, '#d8c070'); r(c, x + 5, y - 8, 2, 9, '#d8c070');
  if (open) r(c, x - 10, y - 13, 20, 4, '#5e3414'); else r(c, x - 10, y - 13, 20, 5, '#a0622d');
  r(c, x - 1, y - 9, 3, 4, '#ffe27a');
}

const FULL = new Set<EventArt>(['storm', 'fog', 'aurora', 'meteor', 'birds']);
export function drawEventArt(c: C, t: number, art: EventArt) {
  c.save();
  // 插圖放大一點，比較有存在感（滿版的天氣類不放大）
  if (!FULL.has(art)) { c.translate(X, Y); c.scale(1.45, 1.45); c.translate(-X, -Y); }
  paint(c, t, art);
  c.restore();
}
function paint(c: C, t: number, art: EventArt) {
  switch (art) {
    case 'boat': { smallBoat(c, X, Y, t, '#7a4a26', '#f0e6d0'); person(c, X - 8, Y - 4 + Math.round(Math.sin(t * 2) * 1.2)); r(c, X - 16, Y - 10, 6, 5, '#b0603a'); r(c, X - 15, Y - 11, 4, 1, '#e8b080'); break; }
    case 'wreck': {
      const tilt = Math.sin(t) * 0.04; c.save(); c.translate(X, Y); c.rotate(-0.12 + tilt); c.translate(-X, -Y);
      smallBoat(c, X, Y, t, '#6a4022'); r(c, X - 1, Y - 18, 2, 14, '#3a2210'); r(c, X + 1, Y - 20, 10, 2, '#3a2210'); c.restore();
      person(c, X + 8, Y - 3, '#d05a3a'); const w = Math.sin(t * 8) > 0; r(c, X + 11, Y - 17 + (w ? 0 : 2), 2, 5, '#f0c8a0');
      break;
    }
    case 'crate': case 'chest': {
      const deep = art === 'crate';
      r(c, X - 40, Y + 2, 80, 30, 'rgba(10,40,80,0.35)');
      if (deep) { r(c, X - 11, Y + 6, 22, 14, '#6a5a4a'); r(c, X - 11, Y + 6, 22, 2, '#9a8a6a'); r(c, X - 11, Y + 12, 22, 1, '#3a2e22'); r(c, X - 2, Y + 6, 4, 14, '#8a3a22'); }
      else chestShape(c, X, Y + 20, false);
      for (let i = 0; i < 6; i++) { const p = (t * 0.5 + i / 6) % 1; r(c, X - 8 + i * 3, Y + 4 - p * 22, 2, 2, `rgba(200,240,255,${1 - p})`); }
      glow(c, X, Y + 14, 26, '255,230,140', 0.35 + Math.sin(t * 3) * 0.1);
      break;
    }
    case 'bottle': {
      const bob = Math.sin(t * 2) * 2, x = X + Math.sin(t * 0.7) * 8;
      c.save(); c.translate(x, Y + bob); c.rotate(-0.5 + Math.sin(t) * 0.1);
      r(c, -8, -3, 14, 7, 'rgba(120,220,170,0.8)'); r(c, 6, -2, 4, 5, 'rgba(120,220,170,0.8)'); r(c, 10, -2, 2, 5, '#8a5a2a'); r(c, -5, -1, 8, 3, '#f0e6c8'); r(c, -7, -3, 12, 1, 'rgba(255,255,255,0.7)');
      c.restore(); ripple(c, x, Y + 5, 26, t);
      break;
    }
    case 'egg': {
      glow(c, X, Y - 8, 30, '255,240,180', 0.4);
      const wob = Math.sin(t * 5) * (Math.sin(t * 0.9) > 0.6 ? 0.15 : 0.02);
      c.save(); c.translate(X, Y); c.rotate(wob); c.fillStyle = '#f6ecd6'; c.beginPath(); c.ellipse(0, -9, 9, 12, 0, 0, 7); c.fill();
      c.fillStyle = '#7ac0e0'; for (const [a, b] of [[-5, -14], [3, -10], [-2, -4], [5, -17]]) c.fillRect(a, b, 3, 2); c.restore();
      ripple(c, X, Y + 3, 30, t);
      break;
    }
    case 'whirlpool': {
      for (let k = 0; k < 7; k++) { c.strokeStyle = `rgba(220,245,255,${0.7 - k * 0.08})`; c.lineWidth = 1; c.beginPath(); c.ellipse(X, Y + 2, 46 - k * 6, 13 - k * 1.7, 0, t * (1 + k * 0.4) + k, t * (1 + k * 0.4) + k + 4.4); c.stroke(); }
      r(c, X - 4, Y, 8, 3, '#04213e');
      break;
    }
    case 'altar': {
      glow(c, X, Y - 26, 34, '170,230,255', 0.45 + Math.sin(t * 2) * 0.1);
      r(c, X - 22, Y - 2, 44, 6, '#8a96a8'); r(c, X - 18, Y - 6, 36, 4, '#a8b4c4'); r(c, X - 16, Y - 30, 4, 24, '#c8d0dc'); r(c, X + 12, Y - 30, 4, 24, '#c8d0dc'); r(c, X - 18, Y - 33, 36, 4, '#dfe6ee');
      const f = Math.sin(t * 2) * 2; r(c, X - 3, Y - 22 + f, 6, 6, '#9af0ff'); r(c, X - 1, Y - 24 + f, 2, 10, '#e8ffff');
      break;
    }
    case 'birds': {
      for (let i = 0; i < 7; i++) {
        const x = X - 50 + ((i * 23 + t * 18) % 100), y = Y - 50 + Math.sin(t * 2 + i) * 6 + (i % 3) * 8, w = Math.sin(t * 9 + i) > 0 ? -2 : 1;
        r(c, x - 4, y + w, 3, 1, '#f4f4f4'); r(c, x - 1, y, 3, 2, '#ffffff'); r(c, x + 2, y + w, 3, 1, '#f4f4f4');
        if (i === 3) r(c, x, y + 2, 3, 2, '#f0e0b0');
      }
      break;
    }
    case 'spring': {
      glow(c, X, Y - 4, 34, '255,250,200', 0.35);
      c.fillStyle = '#5a6a6a'; c.beginPath(); c.ellipse(X, Y + 2, 30, 8, 0, 0, 7); c.fill(); c.fillStyle = '#7ae0d0'; c.beginPath(); c.ellipse(X, Y, 24, 5, 0, 0, 7); c.fill();
      for (let i = 0; i < 8; i++) { const p = (t * 0.4 + i / 8) % 1, x = X - 18 + i * 5 + Math.sin(t + i) * 2; r(c, x, Y - 4 - p * 30, 2, 3, `rgba(255,255,255,${0.6 * (1 - p)})`); }
      break;
    }
    case 'creature': case 'frozen': {
      if (art === 'frozen') { c.fillStyle = 'rgba(190,235,255,0.85)'; c.beginPath(); c.moveTo(X - 20, Y + 2); c.lineTo(X - 14, Y - 30); c.lineTo(X + 6, Y - 36); c.lineTo(X + 20, Y - 20); c.lineTo(X + 18, Y + 2); c.fill(); r(c, X - 10, Y - 26, 3, 14, 'rgba(255,255,255,0.8)'); }
      const b = Math.sin(t * 3) * 1.5;
      c.fillStyle = art === 'frozen' ? 'rgba(40,80,120,0.7)' : '#4a8ad0'; c.beginPath(); c.ellipse(X, Y - 8 + b, 11, 9, 0, 0, 7); c.fill();
      r(c, X - 5, Y - 11 + b, 3, 3, '#ffffff'); r(c, X + 3, Y - 11 + b, 3, 3, '#ffffff'); r(c, X - 4, Y - 10 + b, 1, 2, '#102030'); r(c, X + 4, Y - 10 + b, 1, 2, '#102030');
      if (art === 'creature') { r(c, X + 10, Y - 26 + b, 6, 6, '#ffffff'); r(c, X + 12, Y - 25 + b, 2, 3, '#4a8ad0'); r(c, X + 9, Y - 20 + b, 2, 2, '#ffffff'); ripple(c, X, Y + 2, 30, t); }
      break;
    }
    case 'shadow': {
      const x = X + Math.sin(t * 0.5) * 16;
      c.fillStyle = 'rgba(2,10,30,0.55)'; c.beginPath(); c.ellipse(x, Y + 8, 52, 10, 0, 0, 7); c.fill();
      c.beginPath(); c.moveTo(x + 48, Y + 8); c.lineTo(x + 66, Y - 2); c.lineTo(x + 66, Y + 18); c.fill();
      r(c, x - 34, Y + 6, 3, 2, 'rgba(255,240,150,0.8)');
      break;
    }
    case 'storm': {
      c.fillStyle = 'rgba(20,24,40,0.45)'; c.fillRect(-200, 0, 700, 144);
      for (let i = 0; i < 60; i++) { const x = ((i * 37 + t * 140) % 340) - 40, y = ((i * 53 + t * 200) % 160) - 10; r(c, x, y, 1, 4, 'rgba(200,220,255,0.55)'); }
      if (Math.sin(t * 1.7) > 0.96) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(-200, 0, 700, 144); }
      c.strokeStyle = Math.sin(t * 1.7) > 0.9 ? '#ffffff' : 'rgba(0,0,0,0)'; c.lineWidth = 2; c.beginPath(); c.moveTo(X + 10, 0); c.lineTo(X, 30); c.lineTo(X + 8, 32); c.lineTo(X - 4, 70); c.stroke();
      break;
    }
    case 'gamble': {
      smallBoat(c, X, Y, t, '#5a2a4a', '#3a1a3a');
      for (let i = 0; i < 4; i++) { const on = Math.sin(t * 4 + i * 1.5) > 0; r(c, X - 16 + i * 10, Y - 18 + (i % 2) * 2, 3, 4, on ? '#ffcf4a' : '#a86a2a'); glow(c, X - 15 + i * 10, Y - 16, 8, '255,200,90', on ? 0.4 : 0.1); }
      const d = Math.floor(t * 3) % 6 + 1; r(c, X - 4, Y - 12, 8, 8, '#ffffff'); for (let k = 0; k < d; k++) r(c, X - 3 + (k % 3) * 2, Y - 11 + Math.floor(k / 3) * 3, 1, 1, '#d23a5a');
      break;
    }
    case 'jellies': {
      for (let i = 0; i < 6; i++) {
        const x = X - 50 + i * 20, y = Y - 6 + Math.sin(t * 2 + i) * 4, on = Math.sin(t * 6 + i * 2) > 0.6;
        glow(c, x, y, 12, '120,220,255', on ? 0.5 : 0.15);
        c.fillStyle = 'rgba(170,220,255,0.85)'; c.beginPath(); c.arc(x, y, 5, Math.PI, 0); c.fill();
        for (let k = 0; k < 3; k++) r(c, x - 3 + k * 3, y + Math.sin(t * 4 + k) * 1, 1, 6, 'rgba(170,220,255,0.7)');
        if (on) r(c, x - 1, y - 9, 2, 3, '#fff6a0');
      }
      break;
    }
    case 'pirates': {
      const x = X + 8, b = Math.round(Math.sin(t * 1.5) * 1.5);
      r(c, x - 34, Y - 6 + b, 68, 5, '#3a2416'); r(c, x - 30, Y - 1 + b, 60, 4, '#24160e'); r(c, x - 34, Y - 7 + b, 68, 1, '#7a5030');
      r(c, x - 2, Y - 46 + b, 2, 40, '#24160e'); r(c, x - 18, Y - 42 + b, 32, 18, '#1a1a22'); r(c, x - 18, Y - 42 + b, 32, 1, '#3a3a4a');
      r(c, x - 5, Y - 37 + b, 6, 6, '#e8e8e8'); r(c, x - 4, Y - 35 + b, 1, 1, '#1a1a22'); r(c, x - 1, Y - 35 + b, 1, 1, '#1a1a22'); r(c, x - 6, Y - 30 + b, 8, 1, '#e8e8e8');
      const w = Math.sin(t * 5) > 0 ? 1 : 0; r(c, x, Y - 50 + b, 8, 4 + w, '#d23a3a');
      ripple(c, x, Y + 4, 76, t);
      break;
    }
    case 'fog': {
      for (let i = 0; i < 10; i++) { const x = ((i * 41 + t * (6 + i)) % 320) - 40, y = 40 + (i * 11) % 70; c.fillStyle = 'rgba(230,236,244,0.35)'; c.beginPath(); c.ellipse(x, y, 40, 9, 0, 0, 7); c.fill(); }
      const on = Math.sin(t * 2) > 0; glow(c, X + 20, Y - 30, 14, '255,230,150', on ? 0.6 : 0.2);
      break;
    }
    case 'song': {
      const tail = Math.sin(t * 1.2) * 3;
      c.fillStyle = '#2a4a7a'; c.beginPath(); c.moveTo(X, Y + 2); c.lineTo(X - 3, Y - 16 + tail); c.lineTo(X - 18, Y - 24 + tail); c.lineTo(X - 8, Y - 14 + tail); c.lineTo(X + 8, Y - 14 + tail); c.lineTo(X + 18, Y - 24 + tail); c.lineTo(X + 3, Y - 16 + tail); c.closePath(); c.fill();
      ripple(c, X, Y + 3, 40, t);
      for (let i = 0; i < 5; i++) { const p = (t * 0.35 + i / 5) % 1, x = X - 30 + i * 15 + Math.sin(t * 2 + i) * 4, y = Y - 20 - p * 50; r(c, x, y, 3, 2, `rgba(255,240,200,${1 - p})`); r(c, x + 2, y - 6, 1, 7, `rgba(255,240,200,${1 - p})`); }
      break;
    }
    case 'contest': {
      for (let i = 0; i < 3; i++) { smallBoat(c, X - 40 + i * 40, Y - 4 + (i % 2) * 8, t + i, ['#7a4a26', '#3a6ad0', '#c04a3a'][i]); person(c, X - 44 + i * 40, Y - 8 + (i % 2) * 8, ['#e0a030', '#f0f0f0', '#4ac080'][i]); }
      for (let i = 0; i < 8; i++) r(c, X - 56 + i * 15, Y - 52 + Math.sin(t * 3 + i) * 1, 6, 4, ['#ff5a6a', '#ffcf4a', '#5fb4ff', '#6fdc6a'][i % 4]);
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.moveTo(X - 60, Y - 52); c.quadraticCurveTo(X, Y - 44, X + 64, Y - 52); c.stroke();
      break;
    }
    case 'meteor': {
      c.fillStyle = 'rgba(8,10,40,0.35)'; c.fillRect(-200, 0, 700, 144);
      for (let i = 0; i < 6; i++) { const p = (t * 0.45 + i / 6) % 1, x = 40 + i * 40 + p * 60, y = -10 + p * 70; for (let k = 0; k < 10; k++) r(c, x - k * 2, y - k, 2, 1, `rgba(255,${230 - k * 10},${180 - k * 12},${(1 - k / 10) * (1 - p)})`); }
      break;
    }
    case 'island': {
      c.fillStyle = '#e8d6a0'; c.beginPath(); c.ellipse(X, Y + 2, 40, 9, 0, Math.PI, 0); c.fill(); r(c, X - 40, Y + 2, 80, 2, '#c8b080');
      r(c, X + 4, Y - 32, 3, 30, '#8a5a2a'); for (const [dx, dy] of [[-14, -2], [-10, 2], [10, -1], [14, 3], [0, -4]]) { c.fillStyle = '#3aa04a'; c.beginPath(); c.ellipse(X + 5 + dx, Y - 32 + dy, 9, 3, dx / 30, 0, 7); c.fill(); }
      c.fillStyle = '#2a1a10'; c.beginPath(); c.arc(X - 16, Y + 1, 6, Math.PI, 0); c.fill();
      ripple(c, X, Y + 5, 90, t);
      break;
    }
    case 'coral': {
      for (let i = 0; i < 9; i++) { const x = X - 48 + i * 12, h = 10 + rnd(i) * 18, col = ['#ff7aa8', '#ffb04a', '#c87aff', '#5ae0c0'][i % 4]; r(c, x, Y + 4 - h, 3, h, col); r(c, x - 3, Y + 4 - h * 0.7, 3, 2, col); r(c, x + 3, Y + 4 - h * 0.5, 3, 2, col); }
      for (let i = 0; i < 5; i++) { const x = X - 40 + ((i * 29 + t * 14) % 90); r(c, x, Y - 20 + Math.sin(t * 2 + i) * 5, 4, 2, '#ffe07a'); }
      break;
    }
    case 'lighthouse': {
      r(c, X - 30, Y - 2, 60, 6, '#4a5260'); r(c, X - 6, Y - 52, 12, 50, '#f0f0f0'); for (let k = 0; k < 3; k++) r(c, X - 6, Y - 46 + k * 14, 12, 6, '#d23a3a');
      r(c, X - 8, Y - 60, 16, 8, '#2a2e3a'); r(c, X - 4, Y - 58, 8, 5, '#ffe27a');
      c.save(); c.translate(X, Y - 56); c.rotate(Math.sin(t * 0.8) * 0.8); c.fillStyle = 'rgba(255,240,160,0.25)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(110, -16); c.lineTo(110, 16); c.fill(); c.restore();
      break;
    }
    case 'aurora': {
      for (let k = 0; k < 3; k++) { c.fillStyle = ['rgba(110,255,180,0.22)', 'rgba(120,180,255,0.2)', 'rgba(200,120,255,0.16)'][k]; c.beginPath(); c.moveTo(-60, 30 + k * 8); for (let x = -60; x <= 320; x += 10) c.lineTo(x, 22 + k * 8 + Math.sin(x * 0.03 + t * 0.8 + k) * 8); c.lineTo(320, 0); c.lineTo(-60, 0); c.fill(); }
      break;
    }
    case 'volcano': case 'forge': {
      c.fillStyle = '#2a1410'; c.beginPath(); c.moveTo(X - 46, Y + 2); c.lineTo(X - 10, Y - 40); c.lineTo(X + 10, Y - 40); c.lineTo(X + 46, Y + 2); c.fill();
      r(c, X - 9, Y - 41, 18, 3, '#ff6a2a'); glow(c, X, Y - 44, 28, '255,120,40', 0.5);
      if (art === 'forge') { r(c, X - 16, Y - 6, 32, 6, '#4a4a52'); r(c, X - 10, Y - 10, 20, 4, '#6a6a74'); const s = Math.sin(t * 6) > 0.7; if (s) for (let k = 0; k < 6; k++) r(c, X + rnd(k + Math.floor(t * 6)) * 20 - 10, Y - 14 - rnd(k) * 10, 1, 1, '#ffe07a'); }
      for (let i = 0; i < 10; i++) { const p = (t * 0.6 + i / 10) % 1; r(c, X - 6 + rnd(i) * 12 + (rnd(i + 3) - 0.5) * p * 50, Y - 44 - p * 40 + p * p * 30, 2, 2, `rgba(255,${160 + i * 8},60,${1 - p})`); }
      break;
    }
    case 'terminal': {
      r(c, X - 16, Y - 40, 32, 42, '#2a3a5a'); r(c, X - 13, Y - 36, 26, 18, '#04121e'); r(c, X - 16, Y - 40, 32, 2, '#5a7aa8');
      for (let k = 0; k < 4; k++) r(c, X - 11, Y - 33 + k * 4, 6 + ((Math.floor(t * 4) + k * 3) % 14), 2, k === 1 ? '#ff4ac8' : '#5ff1ff');
      for (let k = 0; k < 6; k++) r(c, X - 12 + (k % 3) * 9, Y - 13 + Math.floor(k / 3) * 6, 6, 4, Math.sin(t * 5 + k) > 0.5 ? '#ffcf4a' : '#4a5a7a');
      glow(c, X, Y - 26, 30, '95,241,255', 0.25);
      break;
    }
    case 'orb': {
      const f = Math.sin(t * 1.5) * 3; glow(c, X, Y - 26 + f, 40, '120,180,255', 0.55);
      c.fillStyle = '#d8f4ff'; c.beginPath(); c.arc(X, Y - 26 + f, 6, 0, 7); c.fill();
      for (let i = 0; i < 8; i++) { const a = t * 0.8 + (i / 8) * Math.PI * 2; r(c, X + Math.cos(a) * 16, Y - 26 + f + Math.sin(a) * 8, 1, 1, '#9ad8ff'); }
      break;
    }
    case 'mirror': {
      const f = Math.sin(t * 1.2) * 3;
      r(c, X - 13, Y - 50 + f, 26, 40, '#c89aff'); r(c, X - 11, Y - 48 + f, 22, 36, '#1a0a34');
      c.fillStyle = 'rgba(200,170,255,0.5)'; c.beginPath(); c.ellipse(X, Y - 30 + f, 6, 9, 0, 0, 7); c.fill();
      r(c, X - 9, Y - 46 + f, 3, 14, 'rgba(255,255,255,0.35)');
      for (let i = 0; i < 6; i++) { const a = t + i; r(c, X + Math.cos(a) * 24, Y - 30 + f + Math.sin(a * 1.3) * 18, 2, 2, '#c89aff'); }
      break;
    }
  }
}
