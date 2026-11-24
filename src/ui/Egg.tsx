// 潮汐卵的小圖、棲息灣的巢、孵化動畫
import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '../audio/engine';
import { FORMS } from '../data/creatures';
import { EGG_INFO, failRate, hatchEgg, NEST_CAP, warmEgg, WARM_COST, WARM_MAX, type Egg, type EggZone, type HatchResult } from '../game/eggs';
import { loadMeta, saveMeta } from '../game/meta';
import { fx } from '../render/fx';
import { Sprite } from './components';
import { Icon } from './Icon';

const EW = 24, EH = 30;
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** 畫一顆像素蛋：crack = 0..1 裂開的程度，glow = 外圍光 */
export function paintEgg(c: CanvasRenderingContext2D, zone: EggZone, t: number, crack = 0, glow = 0) {
  const P = EGG_INFO[zone];
  c.clearRect(0, 0, EW, EH);
  const sh = hex(P.shell), dk = hex(P.dark);
  for (let y = 0; y < EH; y++) for (let x = 0; x < EW; x++) {
    // 上尖下圓的蛋形
    const ny = (y - 17) / 13, w = ny < 0 ? 10.5 * Math.sqrt(Math.max(0, 1 - ny * ny * 1.35)) : 10.5 * Math.sqrt(Math.max(0, 1 - ny * ny));
    const dx = Math.abs(x + 0.5 - EW / 2);
    if (dx > w) continue;
    const edge = dx > w - 1.2 || (ny < 0 ? false : y >= EH - 2);
    const shade = (x - 6) / EW + (y - 6) / EH; // 右下比較暗
    const k = edge ? 0.35 : 1 - Math.max(0, shade) * 0.28;
    let col = edge ? dk : sh.map((v, i) => Math.round(v * k + dk[i] * (1 - k) * 0.2));
    // 斑點
    const sx = x - 12, sy = y - 15;
    const spot = ((sx * 7 + sy * 13 + 400) % 23 < 2 && !edge && Math.abs(sx) < 8) || (Math.hypot(sx + 3, sy + 2) < 2.2) || (Math.hypot(sx - 4, sy - 5) < 1.6);
    if (spot) col = hex(P.spot);
    // 高光
    if (!edge && Math.hypot(x - 8, y - 10) < 1.6) col = [255, 255, 255];
    c.fillStyle = `rgb(${col.join(',')})`; c.fillRect(x, y, 1, 1);
  }
  if (crack > 0) {
    c.fillStyle = 'rgba(20,16,30,0.9)';
    const pts = [[4, 15], [7, 13], [9, 16], [12, 12], [14, 15], [17, 12], [20, 14]];
    const n = Math.min(pts.length, Math.ceil(Math.min(1, crack) * pts.length));
    for (let i = 0; i < n - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; const m = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let k = 0; k <= m; k++) c.fillRect(Math.round(x0 + ((x1 - x0) * k) / m), Math.round(y0 + ((y1 - y0) * k) / m), 1, 1); }
  }
  if (glow > 0) {
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = `rgba(255,250,220,${glow})`; c.fillRect(0, 0, EW, EH);
    c.globalCompositeOperation = 'source-over';
  }
  void t;
}

/** 蛋的小圖：快孵化時會輕輕搖晃 */
export function EggView({ zone, ready, size = 40 }: { zone: EggZone; ready?: boolean; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current!.getContext('2d')!; paintEgg(c, zone, 0); }, [zone]);
  return <canvas ref={ref} width={EW} height={EH} class={`egg-canvas ${ready ? 'ready' : ''}`} style={{ width: `${size}px`, height: `${(size * EH) / EW}px` }} aria-label={EGG_INFO[zone].name} />;
}

/** 孵化動畫：搖晃 → 裂開 → 白光 → 結果 */
function HatchScene({ egg, result, onDone }: { egg: Egg; result: HatchResult; onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const c = ref.current!.getContext('2d')!; c.imageSmoothingEnabled = false;
    const D = fx.reduce ? 0.6 : 2.4, t0 = performance.now(); let raf = 0;
    const timers = [0, 1, 2].map((k) => setTimeout(() => sfx('shake'), (200 + k * 500) * (D / 2.4)));
    timers.push(setTimeout(() => { sfx(result.ok ? 'fanfare' : 'lose'); setShow(true); }, D * 1000));
    const loop = (now: number) => {
      const t = (now - t0) / 1000, p = Math.min(1, t / D);
      const cv = ref.current; if (!cv) return;
      const wob = p < 0.75 ? Math.sin(t * 22) * (2 + p * 4) * (Math.floor(t * 2) % 2 ? 1 : 0.3) : 0;
      cv.style.transform = `rotate(${wob}deg)`;
      paintEgg(c, egg.zone, t, Math.max(0, (p - 0.35) / 0.5), p > 0.85 ? (p - 0.85) / 0.15 : 0);
      if (p < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, []);
  return (
    <div class="hatch-scene" onClick={() => show && onDone()}>
      {!show ? <canvas ref={ref} width={EW} height={EH} class="egg-canvas hatch-egg" /> : result.ok ? (
        <div class="hatch-result ok">
          <span class="hatch-rays" />
          <Sprite form={result.mon.root} size={96} mutant={result.mon.mutant} />
          <b class="big-name">{result.mon.mutant ? '✦ ' : ''}{FORMS[result.mon.root].name} 孵出來了！</b>
          {result.legacyName && <span class="accent">遺傳技「{result.legacyName}」</span>}
          <span class="small dim">已經住進棲息灣。點一下繼續</span>
        </div>
      ) : (
        <div class="hatch-result fail">
          <span style={{ opacity: 0.45 }}><EggView zone={egg.zone} size={56} /></span>
          <b>蛋殼裂開了……裡面什麼都沒有。</b>
          <span class="small dim">下次記得多暖暖蛋。點一下繼續</span>
        </div>
      )}
    </div>
  );
}

/** 棲息灣裡的巢：顯示每顆蛋的進度、失敗率，可以暖蛋、孵化 */
export function EggNest({ onChange }: { onChange: (msg: string) => void }) {
  const [meta, setMeta] = useState(loadMeta);
  const [hatching, setHatching] = useState<{ egg: Egg; result: HatchResult } | null>(null);
  const eggs = meta.eggs ?? [];
  const refresh = () => setMeta(loadMeta());
  const warm = (id: string) => { const m = loadMeta(); if (warmEgg(m, id)) { saveMeta(m); sfx('heal'); refresh(); onChange('你把蛋抱在懷裡暖了一下，蛋殼微微發燙。'); } };
  const hatch = (e: Egg) => {
    const m = loadMeta(); const r = hatchEgg(m, e.id); if (!r) return;
    if (r.ok) m.bay.push(r.mon);
    saveMeta(m); setHatching({ egg: e, result: r });
  };
  if (!eggs.length && !hatching) return <p class="small dim">巢是空的。打倒霸主、守護者，或開到黃金寶箱時，有機會拿到潮汐卵。</p>;
  return (
    <>
      <div class="egg-nest">
        {eggs.map((e) => {
          const ready = e.left <= 0;
          return (
            <div class="egg-slot" key={e.id}>
              <EggView zone={e.zone} ready={ready} />
              <b class="small">{EGG_INFO[e.zone].name}</b>
              <span class="egg-dots" aria-label={`還要出海 ${e.left} 次`}>{Array.from({ length: e.total }, (_, i) => <i key={i} class={i < e.total - e.left ? 'on' : ''} />)}</span>
              <span class="small dim">失敗率 {Math.round(failRate(e) * 100)}%</span>
              {ready ? <button class="chip-btn hot" onClick={() => hatch(e)}><Icon name="sparkle" /> 孵化！</button>
                : <span class="small">再出海 {e.left} 次</span>}
              <button class="chip-btn" disabled={e.warm >= WARM_MAX || meta.pearls < WARM_COST} onClick={() => warm(e.id)}>暖蛋 ◆{WARM_COST}{e.warm ? `（${e.warm}/${WARM_MAX}）` : ''}</button>
            </div>
          );
        })}
      </div>
      <p class="small dim">巢最多放 {NEST_CAP} 顆蛋。每出海一局（不管輸贏）蛋就前進一格。</p>
      {hatching && <HatchScene egg={hatching.egg} result={hatching.result} onDone={() => { const r = hatching.result; setHatching(null); refresh(); onChange(r.ok ? `${FORMS[r.mon.root].name} 加入了棲息灣！` : '這顆蛋沒能孵出來……'); }} />}
    </>
  );
}
