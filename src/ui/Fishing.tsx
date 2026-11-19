// 釣魚：拋竿（力量條）→ 等待 → 咬鉤（限時點擊）→ 進入戰鬥
import { useRef, useState } from 'preact/hooks';
import { drawFishing, type FishView } from '../render/scene';
import { useTap } from './input';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';

export function Fishing({ vp, boss, onHook }: { vp: Viewport; boss: boolean; onHook: (quality: number) => void }) {
  const meter = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<FishView['phase']>('cast');
  const [msg, setMsg] = useState(boss ? '海面異常平靜……霸主就在這片水域。點擊畫面拋竿。' : '點擊畫面（或空白鍵）拋竿！力量條越接近頂端，越容易釣到稀有生物。');
  const st = useRef({ view: { phase: 'cast', power: 0, castT: 0, bobX: 170, shadowX: 170 } as FishView, wait: 0, bite: 0, q: 0, t: 0, done: false });
  const setP = (p: FishView['phase']) => { st.current.view.phase = p; setPhase(p); };

  const draw = (ctx: CanvasRenderingContext2D, t: number, dt: number) => {
    const s = st.current, v = s.view; s.t += dt;
    if (v.phase === 'cast') {
      const k = (s.t * 0.9) % 2; v.power = k < 1 ? k : 2 - k;
      if (meter.current) meter.current.style.height = `${v.power * 100}%`;
    } else if (v.phase === 'flying') {
      v.castT += dt;
      if (v.castT >= 0.6) { setP('wait'); s.wait = boss ? 1.4 : 1.2 + Math.random() * 2.3; setMsg('等待魚兒上鉤……（太早點擊會把魚嚇跑）'); }
    } else if (v.phase === 'wait') {
      s.wait -= dt;
      v.shadowX += Math.sign(v.bobX - v.shadowX) * Math.min(Math.abs(v.bobX - v.shadowX), dt * 16);
      if (s.wait <= 0) { setP('bite'); s.bite = 0.95; setMsg('！！咬鉤了！快點擊！'); }
    } else if (v.phase === 'bite') {
      s.bite -= dt;
      if (s.bite <= 0) { setP('wait'); s.wait = 1.2 + Math.random() * 1.8; v.shadowX = v.bobX + (Math.random() < 0.5 ? -40 : 40); setMsg('太慢了，魚跑掉了……再等等看。'); }
    }
    drawFishing(ctx, t, dt, v);
  };

  const tap = useTap(() => {
    const s = st.current, v = s.view;
    if (s.done) return;
    if (v.phase === 'cast') {
      s.q = v.power;
      v.bobX = Math.round(130 + v.power * 105); v.shadowX = v.bobX + (Math.random() < 0.5 ? -50 : 50); v.castT = 0;
      setP('flying');
      setMsg(v.power > 0.92 ? '★ 完美拋竿！' : v.power > 0.7 ? '不錯的拋竿！' : '拋竿了。');
    } else if (v.phase === 'wait') {
      s.wait += 1.4; v.shadowX = v.bobX + (Math.random() < 0.5 ? -45 : 45);
      setMsg('太早了！魚被嚇跑了一下……');
    } else if (v.phase === 'bite') {
      s.done = true; setP('hooked'); setMsg(boss ? '！！巨大的身影浮上來了！' : '上鉤了！');
      setTimeout(() => onHook(s.q), 700);
    }
  });

  return (
    <GameScreen vp={vp} tappable onScene={tap as unknown as Record<string, unknown>}
      scene={<SceneCanvas draw={draw} label="釣魚場景" />}
      overlay={<>
        {phase === 'cast' && <div class="cast-meter" aria-hidden="true"><div class="sweet" /><i ref={meter} /><span>力量</span></div>}
        {phase === 'hooked' && <div class="flash" />}
      </>}
      dock={<Win class="msg wide" ><p class="msg-text">{msg}</p></Win>} />
  );
}
