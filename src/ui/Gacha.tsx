import { Icon } from './Icon';
// 招募抽卡：像釣魚一樣拋竿。釣竿顏色代表稀有度，水面變色就是「轉」（升一級）
import { useEffect, useRef, useState } from 'preact/hooks';
import { FORMS } from '../data/creatures';
import { RARITY } from '../data/types';
import { bayCap, BROKEN_REFUND, doPulls, loadMeta, PULL_COST, ROD_NAME, ROD_RATES, TEN_COST, TIERS, TURN_RATES, type PullResult, type Tier } from '../game/meta';
import { markCaught } from '../game/run';
import { drawGacha, TIER_COLOR, type GachaView } from '../render/scene';
import { RarityTag, Sprite, StageTag } from './components';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';
import { MenuItem } from './Screens';
import { sfx } from '../audio/engine';

const rank = (t: Tier) => TIERS.indexOf(t);

export function Gacha({ vp, onBack }: { vp: Viewport; onBack: () => void }) {
  const [meta, setMeta] = useState(loadMeta);
  const [msg, setMsg] = useState('拋下釣竿，看看會釣到哪一位夥伴！釣竿的顏色代表稀有度，水面變色的話……就是「轉」！');
  const [results, setResults] = useState<PullResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [rates, setRates] = useState(false);
  const view = useRef<GachaView>({ phase: 'idle', since: 0, rod: 'N', pool: null, form: null, mutant: false, parts: [] });
  const now = useRef(0);
  const timers = useRef<number[]>([]);
  const pending = useRef<PullResult[] | null>(null);
  useEffect(() => () => timers.current.forEach((x) => clearTimeout(x)), []);

  const set = (p: Partial<GachaView>) => Object.assign(view.current, p, { since: now.current });
  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };
  const finish = () => {
    timers.current.forEach((x) => clearTimeout(x)); timers.current = [];
    const res = pending.current; if (!res) return;
    pending.current = null;
    const best = res.reduce((a, b) => (rank(b.tier) > rank(a.tier) ? b : a));
    sfx(best.form ? 'reveal' : 'escape');
    set({ phase: best.form ? 'reveal' : 'miss', rod: best.tier, pool: best.path.length ? best.tier : null, form: best.form, mutant: best.mutant });
    res.forEach((r) => r.form && markCaught(r.form, 'port'));
    setResults(res); setBusy(false); setMeta(loadMeta());
    setMsg(res.length === 1 ? (best.form ? `${best.mutant ? '✦ 異變的 ' : ''}${FORMS[best.form].name}上鉤了！已經住進棲息灣。` : `線斷了……退還 ${BROKEN_REFUND} 顆珍珠。`) : '十連抽結束！所有夥伴都住進棲息灣了。');
  };

  const pull = (n: 1 | 10) => {
    const m = loadMeta();
    const res = doPulls(m, n);
    if (!res) {
      setMsg(m.pearls < (n === 10 ? TEN_COST : PULL_COST) ? '珍珠不夠……出海冒險可以賺到珍珠。' : `棲息灣的空位不夠（${m.bay.length}/${bayCap(m)}），先分解一些夥伴，或到港口擴建棲息灣吧。`);
      return;
    }
    setMeta(loadMeta()); setResults(null); setBusy(true); pending.current = res;
    // 用這次最好的結果來演出
    const best = res.reduce((a, b) => (rank(b.tier) > rank(a.tier) ? b : a));
    view.current.parts = [];
    sfx('cast'); later(500, () => sfx('splash'));
    set({ phase: 'cast', rod: best.rod, pool: null, form: null, mutant: best.mutant });
    setMsg(`拿出了${ROD_NAME[best.rod]}……${best.rod === 'broken' ? '看起來不太妙。' : best.rod === 'SSR' ? '釣竿發出了耀眼的金光！' : best.rod === 'S' ? '釣竿冒出了紅色的火花！' : ''}`);
    let t = 700;
    later(t, () => { set({ phase: 'wait' }); setMsg('等待上鉤……'); });
    t += 1100;
    for (const step of best.path) {
      later(t, () => { sfx('turn'); set({ phase: 'turn', pool: step, rod: step }); setMsg(`水面變色了！……變成了${ROD_NAME[step]}！`); });
      t += 1200;
    }
    if (best.tier === 'broken') { later(t, () => { set({ phase: 'miss' }); setMsg('啪！釣線斷了……'); }); t += 900; }
    else { later(t, () => { sfx('bite'); set({ phase: 'bite' }); setMsg('咬鉤了！'); }); t += 600; }
    later(t, finish);
  };

  return (
    <GameScreen vp={vp}
      scene={<SceneCanvas draw={(c, t, dt) => { now.current = t; drawGacha(c, t, dt, view.current); }} label="招募：拋竿釣起新夥伴" />}
      overlay={<><button class="tool-btn screen-back" onClick={onBack} disabled={busy}>✕ 返回</button><Win class="banner left"><span class="eyebrow">招募</span><b>珍珠 ◆ {meta.pearls}　棲息灣 {meta.bay.length}/{bayCap(meta)}</b></Win></>}
      onPanelClose={rates ? () => setRates(false) : results && results.length > 1 ? () => setResults(null) : undefined}
      panel={rates ? (
        <Win class="big-panel" title="釣竿與機率" onClose={() => setRates(false)}>
          <div class="item-list">
            {ROD_RATES.map(([tier, w]) => (
              <div class="item-row" key={tier}><b style={{ color: TIER_COLOR[tier] }}>{ROD_NAME[tier]}</b><span class="num">{w}%</span>
                <span class="small dim">{tier === 'broken' ? `可能釣不到（退還 ${BROKEN_REFUND} 顆珍珠）` : `${RARITY[tier].name}（${tier}）`}{TURN_RATES[tier] ? `・${Math.round(TURN_RATES[tier]! * 100)}% 會轉成更高一級` : ''}</span></div>
            ))}
            <p class="small dim">「轉」可以連續發生。除了霸主以外，所有生物都可能被招募到；招募到的夥伴從最初的型態開始。</p>
          </div>
        </Win>
      ) : results && results.length > 1 ? (
        <Win class="big-panel" title="十連抽結果" onClose={() => setResults(null)} closeLabel="確定">
          <div class="gacha-grid">
            {results.map((r, i) => (
              <div class={`gacha-card t-${r.tier}`} key={i} style={{ borderColor: TIER_COLOR[r.tier] }}>
                {r.form ? <><Sprite form={r.form} size={48} mutant={r.mutant} /><b class="small">{r.mutant ? '✦' : ''}{FORMS[r.form].name}</b><RarityTag r={FORMS[r.form].rarity} />{r.path.length > 0 && <span class="small accent">轉！</span>}</>
                  : <><span class="broken-rod"><Icon name="broken" size="2em" /></span><b class="small">線斷了</b><span class="small dim">+{BROKEN_REFUND}</span></>}
              </div>
            ))}
          </div>
        </Win>
      ) : null}
      dock={
        <div class="dock-split">
          <Win class="msg">
            <p>{msg}</p>
            {results && results.length === 1 && results[0].form && (
              <div class="row-gap"><Sprite form={results[0].form} size={48} mutant={results[0].mutant} /><b>{FORMS[results[0].form].name}</b><RarityTag r={FORMS[results[0].form].rarity} /><StageTag form={results[0].form} />{results[0].mutant && <span class="mutant-tag">✦ 異變</span>}</div>
            )}
          </Win>
          <Win class="cmd">
            {busy ? <MenuItem onClick={finish} hot><Icon name="skip" /> 跳過</MenuItem> : (
              <div class="cmd-grid">
                <MenuItem onClick={() => pull(1)} hot disabled={meta.pearls < PULL_COST} sub={`◆ ${PULL_COST}`}><Icon name="rod" /> 單抽</MenuItem>
                <MenuItem onClick={() => pull(10)} disabled={meta.pearls < TEN_COST} sub={`◆ ${TEN_COST}`}>十連抽</MenuItem>
                <MenuItem onClick={() => setRates(true)}>機率說明</MenuItem>
              </div>
            )}
          </Win>
        </div>
      } />
  );
}
