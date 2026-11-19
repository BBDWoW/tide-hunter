// 收線捕捉小遊戲：按住讓捕捉區往右，放開往左；讓魚待在區內，進度條滿就成功，張力條滿就斷線。
import { useEffect, useRef, useState } from 'preact/hooks';
import { RARITY, type Rarity } from '../data/types';
import { useHold } from './input';

export function reelZoneWidth(rarity: Rarity, hpRatio: number, hasStatus: boolean) {
  return Math.max(0.1, Math.min(0.5, 0.15 + 0.34 * (1 - hpRatio) + (hasStatus ? 0.06 : 0) - RARITY[rarity].reel * 0.25));
}

// onDone(ok, quality)：quality 0–1，收線過程中張力越低越高，會影響之後晃動的成功率
export function Reel({ rarity, hpRatio, hasStatus, name, zoneBonus = 0, onDone }: { rarity: Rarity; hpRatio: number; hasStatus: boolean; name: string; zoneBonus?: number; onDone: (ok: boolean, quality: number) => void }) {
  const zoneRef = useRef<HTMLDivElement>(null), fishRef = useRef<HTMLDivElement>(null);
  const progRef = useRef<HTMLElement>(null), tenRef = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<'ready' | 'go' | 'ok' | 'fail'>('ready');
  const hold = useHold(true);
  const w = Math.min(0.6, reelZoneWidth(rarity, hpRatio, hasStatus) * (1 + zoneBonus));

  useEffect(() => {
    const reel = RARITY[rarity].reel;
    const st = { zx: 0.5, zv: 0, fx: 0.5, ft: 0.5, timer: 0, prog: 25, ten: 0, t: 0 };
    let raf = 0, last = performance.now(), ended = false;
    let tenSum = 0, tenT = 0;
    const end = (ok: boolean) => { if (ended) return; ended = true; setPhase(ok ? 'ok' : 'fail'); const q = 1 - Math.min(1, tenSum / Math.max(0.1, tenT) / 100); setTimeout(() => onDone(ok, q), 900); };
    const loop = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; st.t += dt;
      if (st.t > 1 && !ended) {
        if (st.t - dt <= 1) setPhase('go');
        st.zv += (hold.current ? 2.8 : -2.8) * dt; st.zx += st.zv * dt;
        const lo = w / 2, hi = 1 - w / 2;
        if (st.zx < lo) { st.zx = lo; st.zv *= -0.3; } if (st.zx > hi) { st.zx = hi; st.zv *= -0.3; }
        st.timer -= dt;
        if (st.timer <= 0) { st.ft = 0.05 + Math.random() * 0.9; st.timer = (0.4 + Math.random() * 0.9) / (1 + reel * 2); }
        st.fx += (st.ft - st.fx) * Math.min(1, dt * (1.6 + reel * 5));
        const inZ = Math.abs(st.fx - st.zx) < w / 2;
        if (inZ) { st.prog += 24 * dt; st.ten = Math.max(0, st.ten - 30 * dt); }
        else { st.ten += (30 + reel * 45) * dt; st.prog = Math.max(0, st.prog - 5 * dt); }
        tenSum += st.ten * dt; tenT += dt;
        if (st.prog >= 100) end(true);
        else if (st.ten >= 100) end(false);
        zoneRef.current?.classList.toggle('in', inZ);
      }
      if (zoneRef.current) { zoneRef.current.style.left = `${(st.zx - w / 2) * 100}%`; zoneRef.current.style.width = `${w * 100}%`; }
      if (fishRef.current) fishRef.current.style.left = `${st.fx * 100}%`;
      if (progRef.current) progRef.current.style.width = `${Math.min(100, st.prog)}%`;
      if (tenRef.current) tenRef.current.style.width = `${Math.min(100, st.ten)}%`;
      if (!ended) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div class="reel" {...hold.bind}>
      <div class="reel-box win">
        <div class="reel-head">
          <b>收線捕捉 · {name}</b>
          <span class="muted">捕捉區寬度 {Math.round(w * 100)}%</span>
        </div>
        <div class="reel-meter"><span>進度</span><div class="meter"><i ref={progRef} class="prog" /></div></div>
        <div class="reel-meter"><span>張力</span><div class="meter"><i ref={tenRef} class="ten" /></div></div>
        <div class="track">
          <div class="zone" ref={zoneRef} />
          <div class="fish" ref={fishRef}>◆</div>
        </div>
        <p class="reel-tip">
          {phase === 'ready' && '準備……'}
          {phase === 'go' && '按住（滑鼠／觸控／空白鍵）讓捕捉區往右，放開就往左。讓魚待在綠色區域裡！'}
          {phase === 'ok' && <b class="good">收線成功！</b>}
          {phase === 'fail' && <b class="bad">線斷了，牠掙脫了！</b>}
        </p>
      </div>
    </div>
  );
}
