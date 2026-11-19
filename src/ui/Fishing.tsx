// 釣魚：選魚餌 → 選魚影 → 拋竿（力量條）→ 等待（小心假咬鉤）→ 真的咬鉤時點擊 → 上鉤
import { useRef, useState } from 'preact/hooks';
import { LURES, type LureId } from '../data/boons';
import { nodeOf, perfectAt, rollShadows, rollTreasure, spotName, zoneOf, type Loot, type RunState, type Shadow } from '../game/run';
import { drawFishing, type FishPhase, type FishView } from '../render/scene';
import { useTap } from './input';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';
import { MenuItem } from './Screens';

const SIZE_NAME = { 1: '小', 2: '中', 3: '大' } as const;

export function Fishing({ vp, run, boss, onHook, onDone }: { vp: Viewport; run: RunState; boss: boolean; onHook: (q: number, sh: Shadow) => void; onDone: () => void }) {
  const spot = nodeOf(run).spot;
  const hasLures = run.lures.star > 0 || run.lures.legend > 0;
  const meter = useRef<HTMLElement>(null);
  const [shadows, setShadows] = useState<Shadow[]>(() => (boss || !hasLures ? rollShadows(run, 'normal') : []));
  const [phase, setPhase] = useState<FishPhase | 'lure' | 'loot'>(boss || !hasLures ? 'choose' : 'lure');
  const [sel, setSel] = useState(boss ? 0 : 1);
  const [loot, setLoot] = useState<Loot | null>(null);
  const [msg, setMsg] = useState(boss ? '海面異常平靜……霸主就在這片水域。' : `${spotName(run, spot).name}：${spotName(run, spot).desc}`);
  const st = useRef({
    view: { phase: 'choose', power: 0, castT: 0, bobX: 170, shadows: [], sel: 1, spot: zoneOf(run).theme === 'day' ? spot : 'none', theme: zoneOf(run).theme } as FishView,
    t: 0, wait: 0, nibbles: 0, nib: 0, bite: 0, q: 0, done: false,
  });
  st.current.view.shadows = shadows;
  st.current.view.sel = sel;
  const setP = (p: FishPhase) => { st.current.view.phase = p; setPhase(p); };

  const pickLure = (l: LureId) => {
    if (l !== 'normal') run.lures[l]--;
    setShadows(rollShadows(run, l));
    setMsg(l === 'normal' ? '用普通餌。選一個魚影吧，影子越大，越可能是稀有的魚。' : `用了${LURES[l].name}！大魚影裡可能藏著不得了的東西……`);
    setP('choose');
  };
  const startCast = () => { setP('cast'); setMsg('點擊畫面（或空白鍵）拋竿！力量條停在頂端的紅色區域是完美拋竿。'); };

  const draw = (ctx: CanvasRenderingContext2D, t: number, dt: number) => {
    const s = st.current, v = s.view; s.t += dt;
    if (v.phase === 'cast') {
      const k = (s.t * 0.9) % 2; v.power = k < 1 ? k : 2 - k;
      if (meter.current) meter.current.style.height = `${v.power * 100}%`;
    } else if (v.phase === 'flying') {
      v.castT += dt;
      if (v.castT >= 0.6) { setP('wait'); s.wait = 1 + Math.random() * 1.6; s.nibbles = boss ? 0 : Math.floor(Math.random() * 3); setMsg('等待魚兒上鉤……浮標輕輕點水是在試探，等牠大力拉下去再點！'); }
    } else if (v.phase === 'wait') {
      s.wait -= dt;
      if (s.wait <= 0) {
        if (s.nibbles > 0) { s.nibbles--; s.nib = 0.55; setP('nibble'); }
        else { setP('bite'); s.bite = 0.9; setMsg('！！咬鉤了！快點擊！'); }
      }
    } else if (v.phase === 'nibble') {
      s.nib -= dt;
      if (s.nib <= 0) { setP('wait'); s.wait = 0.6 + Math.random() * 1.2; }
    } else if (v.phase === 'bite') {
      s.bite -= dt;
      if (s.bite <= 0) { setP('wait'); s.wait = 1.2 + Math.random() * 1.6; s.nibbles = Math.floor(Math.random() * 2); setMsg('太慢了，魚把餌吐掉了……再等等看。'); }
    }
    drawFishing(ctx, t, dt, v);
  };

  const tap = useTap(() => {
    const s = st.current, v = s.view;
    if (s.done) return;
    if (v.phase === 'cast') {
      s.q = v.power;
      v.bobX = shadows[sel].x; v.castT = 0;
      setP('flying');
      setMsg(v.power >= perfectAt(run) ? '★ 完美拋竿！稀有度提升！' : v.power > 0.7 ? '不錯的拋竿！' : '拋竿了。');
    } else if (v.phase === 'wait' || v.phase === 'nibble') {
      s.wait = 1.6 + Math.random(); s.nibbles = Math.floor(Math.random() * 2); setP('wait');
      setMsg(v.phase === 'nibble' ? '拉太早了！那只是試探，魚嚇了一跳……' : '太早了！魚被嚇跑了一下……');
    } else if (v.phase === 'bite') {
      s.done = true; setP('hooked');
      const sh = shadows[sel];
      if (sh.kind === 'fish') {
        setMsg(boss ? '！！巨大的身影浮上來了！' : '上鉤了！');
        setTimeout(() => onHook(s.q, sh), 700);
      } else {
        const l = rollTreasure(run, sh.kind);
        setTimeout(() => { setLoot(l); setPhase('loot'); }, 600);
        setMsg('拉上來了……這是？');
      }
    }
  });
  const sceneTap = phase === 'cast' || phase === 'flying' || phase === 'wait' || phase === 'nibble' || phase === 'bite';

  return (
    <GameScreen vp={vp} tappable={sceneTap} onScene={sceneTap ? (tap as unknown as Record<string, unknown>) : undefined}
      scene={<SceneCanvas draw={draw} label="釣魚場景" />}
      overlay={<>
        {phase === 'cast' && <div class="cast-meter" aria-hidden="true"><div class="sweet" style={{ height: `${(1 - perfectAt(run)) * 100}%` }} /><i ref={meter} /><span>力量</span></div>}
        {phase === 'hooked' && <div class="flash" />}
        {phase === 'choose' && shadows.map((sh, i) => (
          <button key={i} class={`hit shadow-hit ${i === sel ? 'on' : ''}`} aria-label={`${SIZE_NAME[sh.size]}魚影`} onClick={() => setSel(i)}
            style={{ left: `${((sh.x - 20) / 256) * 100}%`, top: `${((78 + i * 7) / 144) * 100}%`, width: `${(40 / 256) * 100}%`, height: `${(18 / 144) * 100}%` }} />
        ))}
      </>}
      dock={
        <div class="dock-split">
          <Win class="msg"><p class="msg-text">{phase === 'loot' && loot ? <><b>{loot.title}</b><br />{loot.text}</> : msg}</p></Win>
          <Win class="cmd">
            {phase === 'lure' && <div class="cmd-grid">
              <MenuItem onClick={() => pickLure('normal')} hot sub="∞">普通餌</MenuItem>
              <MenuItem onClick={() => pickLure('star')} disabled={!run.lures.star} sub={`×${run.lures.star}`}>星光餌</MenuItem>
              <MenuItem onClick={() => pickLure('legend')} disabled={!run.lures.legend} sub={`×${run.lures.legend}`}>傳說餌</MenuItem>
            </div>}
            {phase === 'choose' && <div class="cmd-grid">
              {shadows.map((sh, i) => <MenuItem key={i} onClick={() => setSel(i)} hot={i === sel}>{['左', '中', '右'][[...shadows].sort((a, b) => a.x - b.x).indexOf(sh)] ?? ''}・{SIZE_NAME[sh.size]}魚影</MenuItem>)}
              <MenuItem onClick={startCast}>對準它拋竿！</MenuItem>
            </div>}
            {phase === 'loot' && <MenuItem onClick={onDone} hot>繼續航行</MenuItem>}
            {sceneTap && <p class="dim center small">點擊畫面</p>}
          </Win>
        </div>
      } />
  );
}
