import { ChestReveal } from './Treasure';
import { Icon } from './Icon';
// 釣魚：選魚餌 → 對準海面的漣漪拋竿（力量條）→ 等待（小心假咬鉤）→ 咬鉤時點擊 → 上鉤後揭曉種類
import { useRef, useState } from 'preact/hooks';
import { LURES, type LureId } from '../data/boons';
import { castTarget, judgeLanding, landingZones, nodeOf, rollShadows, rollTreasure, spotName, zoneOf, type Landing, type Loot, type RunState, type Shadow } from '../game/run';
import { drawFishing, type FishPhase, type FishView } from '../render/scene';
import { useTap } from './input';
import { Tip } from './components';
import { sfx } from '../audio/engine';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';
import { MenuItem } from './Screens';

// 上鉤時從拉力感受魚的大小
const PULL = { 1: '上鉤了！拉力輕輕的。', 2: '上鉤了！有點重量！', 3: '好重！是大傢伙！' } as const;

export function Fishing({ vp, run, boss, onHook, onDone }: { vp: Viewport; run: RunState; boss: boolean; onHook: (q: number, sh: Shadow, landing: Landing) => void; onDone: () => void }) {
  const spot = nodeOf(run).spot;
  const hasLures = run.lures.star > 0 || run.lures.legend > 0;
  const meter = useRef<HTMLElement>(null);
  // 魚影大小由釣點決定；用了特殊魚餌會引來大魚
  const roll = (l: LureId, fishOnly = false) => {
    const sh = rollShadows(run, l, fishOnly);
    const big = sh.findIndex((x) => x.size === 3);
    const i = boss ? 0 : l !== 'normal' && big >= 0 ? big : Math.floor(Math.random() * sh.length);
    return { sh, i, x: Math.max(120, Math.min(220, sh[i].x + (Math.random() - 0.5) * 20)) };
  };
  const first = useRef(boss || !hasLures ? roll('normal') : null);
  const [shadows, setShadows] = useState<Shadow[]>(() => first.current?.sh ?? []);
  const [phase, setPhase] = useState<FishPhase | 'lure' | 'loot'>(boss || !hasLures ? 'choose' : 'lure');
  const [sel, setSel] = useState(first.current?.i ?? 0);
  const spotX = useRef(first.current?.x ?? 170);
  const [loot, setLoot] = useState<Loot | null>(null);
  const [opened, setOpened] = useState(false);
  const [msg, setMsg] = useState(boss ? '海面異常平靜……霸主就在這片水域。' : `${spotName(run, spot).name}：${spotName(run, spot).desc}`);
  const st = useRef({
    view: { phase: 'choose', power: 0, castT: 0, bobX: 170, shadows: [], sel: 0, spot: zoneOf(run).theme === 'day' ? spot : 'none', theme: zoneOf(run).theme, ripple: 170 } as FishView,
    t: 0, wait: 0, nibbles: 0, nib: 0, bite: 0, q: 0, done: false, land: 'miss' as Landing,
  });
  // 拋竿前可比較輪廓，咬鉤後才揭曉種類。
  st.current.view.shadows = shadows;
  st.current.view.sel = sel;
  st.current.view.ripple = spotX.current;
  const setP = (p: FishPhase) => { st.current.view.phase = p; setPhase(p); };
  const lureUsed = useRef<LureId>('normal');
  const treasureNode = nodeOf(run).kind === 'treasure';
  const prepare = (l: LureId, fishOnly = false) => { const r = roll(l, fishOnly); setShadows(r.sh); setSel(r.i); spotX.current = r.x; };

  const pickLure = (l: LureId) => {
    if (l !== 'normal') run.lures[l]--;
    lureUsed.current = l;
    prepare(l);
    setMsg(l === 'normal' ? '對準漣漪拋竿！' : `用了${LURES[l].name}！好像有大東西被吸引過來了……`);
    setP('choose');
  };
  // 釣到寶箱或垃圾後留在原地繼續釣：換個位置，這次水面下都是魚（用同一種餌，不會再扣）
  const fishAgain = () => {
    const s = st.current;
    s.done = false; s.t = 0; s.view.castT = 0; s.view.power = 0;
    setLoot(null); setOpened(false);
    prepare(lureUsed.current, true);
    setMsg('換個位置再拋一次！');
    setP('choose');
  };
  const startCast = () => { sfx('select'); st.current.t = Math.random() * 2; setP('cast'); setMsg('點一下定力道，瞄準兩道刻痕之間。'); };

  const draw = (ctx: CanvasRenderingContext2D, t: number, dt: number) => {
    const s = st.current, v = s.view; s.t += dt;
    if (v.phase === 'cast') {
      const k = (s.t * 1.6) % 2; v.power = k < 1 ? k : 2 - k; // 擺動得比較快
      if (meter.current) meter.current.style.height = `${v.power * 100}%`;
    } else if (v.phase === 'flying') {
      v.castT += dt;
      if (v.castT >= 0.6) {
        sfx('splash');
        setP('wait');
        // 甩太偏，魚會被嚇到：等比較久、假咬鉤比較多
        const spook = s.land === 'far' ? 2 : s.land === 'miss' ? 1 : 0;
        s.wait = 1 + Math.random() * 1.6 + spook * 0.8; s.nibbles = boss ? 0 : Math.floor(Math.random() * 3) + spook;
        setMsg(s.land === 'perfect' && shadows[sel]?.kind === 'fish' ? '完美落點！對手開場 HP 降低。' : s.land === 'far' ? '魚被嚇到了……' : '等浮標整顆沉下再收竿。');
      }
    } else if (v.phase === 'wait') {
      s.wait -= dt;
      if (s.wait <= 0) {
        if (s.nibbles > 0) { s.nibbles--; s.nib = 0.55; sfx('nibble'); setP('nibble'); setMsg('魚在試探，再等等。'); }
        else { sfx('bite'); setP('bite'); s.bite = 0.9; setMsg('咬鉤！點一下收竿。'); }
      }
    } else if (v.phase === 'nibble') {
      s.nib -= dt;
      if (s.nib <= 0) { setP('wait'); s.wait = 0.6 + Math.random() * 1.2; }
    } else if (v.phase === 'bite') {
      s.bite -= dt;
      if (s.bite <= 0) { setP('wait'); s.wait = 1.2 + Math.random() * 1.6; s.nibbles = Math.floor(Math.random() * 2); setMsg('太慢了，魚把餌吐掉了……'); }
    }
    drawFishing(ctx, t, dt, v);
  };

  const tap = useTap(() => {
    const s = st.current, v = s.view;
    if (s.done) return;
    if (v.phase === 'choose') { startCast(); return; }
    if (v.phase === 'cast') {
      const x = spotX.current;
      s.land = judgeLanding(run, v.power, x);
      s.q = s.land === 'perfect' ? 1 : 0.5;
      // 浮標落在實際甩到的位置（太大力會甩過頭，太小力會不夠遠）
      v.bobX = Math.max(80, Math.min(236, x + (v.power - castTarget(x)) * 180)); v.castT = 0;
      sfx('cast'); if (s.land === 'perfect') setTimeout(() => sfx('confirm'), 120);
      setP('flying');
      setMsg(s.land === 'perfect' ? '★ 完美落點！' : s.land === 'good' ? '不錯的落點！' : s.land === 'miss' ? '甩偏了……' : '甩太偏了！');
    } else if (v.phase === 'wait' || v.phase === 'nibble') {
      s.wait = 1.6 + Math.random(); s.nibbles = Math.floor(Math.random() * 2); setP('wait');
      setMsg(v.phase === 'nibble' ? '那只是試探！' : '太早了！');
    } else if (v.phase === 'bite') {
      s.done = true; setP('hooked'); sfx('splash'); sfx('confirm');
      const sh = shadows[sel];
      if (sh.kind === 'fish') {
        setMsg(boss ? '！！巨大的身影浮上來了！' : PULL[sh.size]);
        setTimeout(() => onHook(s.q, sh, s.land), 700);
      } else {
        const l = rollTreasure(run, sh.kind);
        setTimeout(() => { setLoot(l); setPhase('loot'); }, 600);
        setMsg('拉上來了……這是？');
      }
    }
  });
  const sceneTap = phase === 'choose' || phase === 'cast' || phase === 'flying' || phase === 'wait' || phase === 'nibble' || phase === 'bite';

  return (
    <GameScreen vp={vp} tappable={sceneTap} onScene={sceneTap ? (tap as unknown as Record<string, unknown>) : undefined}
      scene={<SceneCanvas draw={draw} label="釣魚場景" />}
      overlay={<>
        {phase === 'choose' && shadows.length > 1 && shadows.map((sh, i) => (
          <button key={i} class="hit fish-target" aria-label={`選擇${['小', '中', '大'][sh.size - 1]}魚影`} aria-pressed={sel === i}
            style={{ left: `${(sh.x - 16) / 256 * 100}%` }}
            onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}
            onClick={() => { setSel(i); spotX.current = sh.x; sfx('select'); }} />
        ))}
        {phase === 'cast' && (() => {
          const tp = castTarget(spotX.current), z = landingZones(run);
          const band = (w: number) => ({ bottom: `${Math.max(0, tp - w) * 100}%`, height: `${Math.min(1, tp + w) * 100 - Math.max(0, tp - w) * 100}%` });
          return <div class="cast-meter" aria-hidden="true"><div class="zone-good" style={band(z.good)} /><div class="zone-perfect" style={band(z.perfect)} /><i ref={meter} /></div>;
        })()}
        {phase === 'hooked' && <div class="flash" />}
        {phase === 'loot' && loot && <ChestReveal loot={loot} onOpened={() => setOpened(true)} />}

      </>}
      dock={
        <div class="dock-split">
          <Win class="msg">{phase === 'choose' && !boss && <Tip inline id="fishing">點魚影選落點，再點「拋竿」。</Tip>}<p class="msg-text">{phase === 'loot' && loot ? (opened ? <><b>{loot.title}</b><br />{loot.text}</> : '打開來看看……') : msg}</p></Win>
          <Win class="cmd">
            {phase === 'lure' && <div class="cmd-grid">
              <MenuItem onClick={() => pickLure('normal')} hot sub="∞">普通餌</MenuItem>
              <MenuItem onClick={() => pickLure('star')} disabled={!run.lures.star} sub={`×${run.lures.star}`}>星光餌</MenuItem>
              <MenuItem onClick={() => pickLure('legend')} disabled={!run.lures.legend} sub={`×${run.lures.legend}`}>傳說餌</MenuItem>
            </div>}
            {phase === 'choose' && <MenuItem onClick={startCast} hot><Icon name="rod" /> 拋竿！</MenuItem>}
            {phase === 'loot' && (treasureNode ? <MenuItem onClick={onDone} hot>繼續航行</MenuItem> : <div class="cmd-grid">
              <MenuItem onClick={fishAgain} hot>繼續釣魚</MenuItem>
              <MenuItem onClick={onDone}>離開這裡</MenuItem>
            </div>)}
          </Win>
        </div>
      } />
  );
}
