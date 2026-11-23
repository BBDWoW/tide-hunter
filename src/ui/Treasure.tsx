// 開寶箱動畫：寶箱掉下來 → 抖三下 → 蓋子彈開、光芒四射 → 道具一個個跳出來
import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '../audio/engine';
import { CHEST_NAME, type ChestTier, type Loot } from '../game/run';
import { fx } from '../render/fx';
import { Icon } from './Icon';

const CW = 96, CH = 80;
const PAL: Record<Exclude<ChestTier, 'junk'>, { body: string; dark: string; band: string; gem: string; glow: string }> = {
  wood: { body: '#a0622d', dark: '#5e3414', band: '#6d6f78', gem: '#c8d0dc', glow: '255,230,170' },
  silver: { body: '#a9b8cc', dark: '#56657c', band: '#e8eef8', gem: '#4ec3ff', glow: '170,225,255' },
  gold: { body: '#f2b632', dark: '#8a5a0c', band: '#fff0a0', gem: '#ff4a5a', glow: '255,225,120' },
};
const rnd = (i: number) => { const x = Math.sin(i * 91.7 + 13.3) * 43758.5453; return x - Math.floor(x); };

function drawChest(c: CanvasRenderingContext2D, tier: Exclude<ChestTier, 'junk'>, t: number) {
  const P = PAL[tier];
  c.clearRect(0, 0, CW, CH);
  const drop = Math.min(1, t / 0.35), bounce = t > 0.35 && t < 0.55 ? Math.sin(((t - 0.35) / 0.2) * Math.PI) * 4 : 0;
  const shakeT = t - 0.6, shaking = shakeT > 0 && shakeT < 1.0;
  const sx = shaking && (shakeT * 3) % 1 < 0.45 ? Math.sin(shakeT * 60) * (1 + Math.floor(shakeT * 3)) : 0;
  const open = Math.min(1, Math.max(0, (t - 1.65) / 0.25));
  const x0 = 28 + Math.round(sx), by = Math.round(-40 + drop * 80 - bounce); // by：箱身頂端
  // 光芒
  if (open > 0) {
    c.save(); c.translate(48, by + 2); c.rotate(t * 0.6);
    for (let i = 0; i < 10; i++) { c.rotate(Math.PI / 5); c.fillStyle = `rgba(${P.glow},${0.35 * open})`; c.beginPath(); c.moveTo(0, 0); c.lineTo(-5, -70); c.lineTo(5, -70); c.fill(); }
    c.restore();
    c.fillStyle = `rgba(${P.glow},${0.9 * open})`; c.beginPath(); c.ellipse(48, by + 2, 18 * open, 6 * open, 0, 0, 7); c.fill();
  }
  // 箱身
  c.fillStyle = P.dark; c.fillRect(x0 - 1, by - 1, 42, 24);
  c.fillStyle = P.body; c.fillRect(x0, by, 40, 22);
  c.fillStyle = P.dark; for (let k = 1; k < 4; k++) c.fillRect(x0, by + k * 6, 40, 1);
  c.fillStyle = P.band; c.fillRect(x0 + 6, by, 3, 22); c.fillRect(x0 + 31, by, 3, 22);
  // 蓋子（打開時往後翻）
  const lh = Math.round(12 * (1 - open * 1.6));
  const ly = by - lh;
  if (lh > 0) {
    c.fillStyle = P.dark; c.fillRect(x0 - 1, ly - 1, 42, lh + 1);
    c.fillStyle = P.body; c.fillRect(x0, ly, 40, lh);
    c.fillStyle = P.band; c.fillRect(x0 + 6, ly, 3, lh); c.fillRect(x0 + 31, ly, 3, lh);
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x0, ly, 40, 2);
  } else {
    // 翻開的蓋子內側
    c.fillStyle = P.dark; c.fillRect(x0, by - 9, 40, 8);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x0 + 2, by - 7, 36, 5);
  }
  // 鎖扣與寶石
  c.fillStyle = P.band; c.fillRect(x0 + 17, by - 2, 6, 8);
  c.fillStyle = P.gem; c.fillRect(x0 + 19, by, 2, 3);
  // 縫隙漏出的光
  if (shaking || (t > 1.6 && open < 1)) { c.fillStyle = `rgba(${P.glow},0.9)`; c.fillRect(x0 + 1, by - 1, 38, 1); }
  // 閃光粒子
  if (open > 0) for (let i = 0; i < 22; i++) {
    const tt = (t - 1.65) * (0.7 + rnd(i) * 0.6), a = rnd(i + 5) * Math.PI - Math.PI, d = tt * (30 + rnd(i + 9) * 40);
    if (tt > 1.4) continue;
    c.fillStyle = i % 3 ? `rgba(${P.glow},${1 - tt / 1.4})` : `rgba(255,255,255,${1 - tt / 1.4})`;
    c.fillRect(Math.round(48 + Math.cos(a) * d), Math.round(by + Math.sin(a) * d * 0.9 + tt * tt * 12), 2, 2);
  }
  // 影子
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x0 + 2, Math.min(by + 22, 62) + 1, 38, 2);
}

export function ChestReveal({ loot, onOpened }: { loot: Loot; onOpened?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [shown, setShown] = useState(loot.tier === 'junk' ? loot.items.length : 0);
  useEffect(() => {
    if (loot.tier === 'junk') { onOpened?.(); return; }
    const tier = loot.tier;
    const c = ref.current!.getContext('2d')!; c.imageSmoothingEnabled = false;
    const speed = fx.reduce ? 3 : 1;
    const t0 = performance.now(); let raf = 0;
    const timers = [
      setTimeout(() => sfx('splash'), 250 / speed),
      ...[0, 1, 2].map((k) => setTimeout(() => sfx('shake'), (650 + k * 333) / speed)),
      setTimeout(() => { sfx(tier === 'gold' ? 'fanfare' : 'reveal'); }, 1650 / speed),
      ...loot.items.map((_, i) => setTimeout(() => { setShown(i + 1); sfx('coin'); if (i === loot.items.length - 1) onOpened?.(); }, (2000 + i * 380) / speed)),
    ];
    const loop = (now: number) => { drawChest(c, tier, ((now - t0) / 1000) * speed); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, []);
  return (
    <div class={`chest-reveal tier-${loot.tier}`}>
      {loot.tier !== 'junk' && <canvas ref={ref} width={CW} height={CH} class="chest-canvas" aria-label={CHEST_NAME[loot.tier]} />}
      <span class="chest-name">{loot.tier === 'junk' ? '釣到了垃圾……' : CHEST_NAME[loot.tier]}</span>
      <div class="chest-items">
        {loot.items.slice(0, shown).map((it, i) => (
          <div class="chest-item" key={i}><Icon name={it.icon} size="1.7em" /><span>{it.name}</span></div>
        ))}
      </div>
    </div>
  );
}
