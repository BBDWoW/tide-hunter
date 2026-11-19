import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { FORMS, STARTERS } from '../data/creatures';
import { ELEM, effectiveness, RARITY, RARITY_ORDER, type Elem } from '../data/types';
import { ITEMS, type ItemId } from '../game/battle';
import { formOf, maxHp, xpToNext } from '../game/creature';
import { healParty, loadDex, STATION_INFO, type RunState } from '../game/run';
import { drawChart, drawDeep, drawStarterScene, drawTitle, PEDESTALS } from '../render/scene';
import { AbilityLines, Bar, Elems, RarityTag, SkillLine, Sprite, StageTag } from './components';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';

export function MenuItem({ children, onClick, disabled, hot, sub, onHover }: { children: ComponentChildren; onClick: () => void; disabled?: boolean; hot?: boolean; sub?: ComponentChildren; onHover?: () => void }) {
  return (
    <button class={`mi ${hot ? 'hot' : ''}`} onClick={onClick} disabled={disabled} onMouseEnter={onHover} onFocus={onHover}>
      <span class="cursor">▶</span><span class="mi-main">{children}</span>{sub && <span class="mi-sub">{sub}</span>}
    </button>
  );
}

// ── 標題 ──
export function Title({ vp, hasSave, onNew, onContinue, onDex, onHelp }: { vp: Viewport; hasSave: boolean; onNew: () => void; onContinue: () => void; onDex: () => void; onHelp: () => void }) {
  const dex = loadDex();
  return (
    <GameScreen vp={vp}
      scene={<SceneCanvas draw={drawTitle} label="夕陽下的海面，潮靈躍出水面" />}
      overlay={<div class="title-logo"><span class="title-en">TIDE HUNTER</span><h1>潮汐獵手</h1><span class="title-sub">釣起潮靈 · 收服 · 進化 · 挑戰霸主</span></div>}
      dock={
        <div class="dock-center">
          <Win class="title-menu">
            {hasSave && <MenuItem onClick={onContinue} hot>繼續冒險</MenuItem>}
            <MenuItem onClick={onNew} hot={!hasSave}>新的冒險</MenuItem>
            <MenuItem onClick={onDex} sub={`${dex.caught.length}/${Object.keys(FORMS).length}`}>圖鑑</MenuItem>
            <MenuItem onClick={onHelp}>玩法說明</MenuItem>
          </Win>
        </div>
      } />
  );
}

// ── 選初始 ──
export function StarterPick({ vp, onPick, onBack }: { vp: Viewport; onPick: (f: string) => void; onBack: () => void }) {
  const [sel, setSel] = useState(1);
  const f = FORMS[STARTERS[sel]];
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setSel((s) => (s + 2) % 3);
      if (e.key === 'ArrowRight') setSel((s) => (s + 1) % 3);
      if (e.key === 'Enter') onPick(STARTERS[sel]);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });
  return (
    <GameScreen vp={vp}
      scene={<SceneCanvas draw={(c, t) => drawStarterScene(c, t, STARTERS, sel)} label="三隻初始夥伴站在礁石上" />}
      overlay={<>
        <Win class="banner">選擇你的第一位夥伴</Win>
        {PEDESTALS.map((p, i) => (
          <button class="hit" key={i} aria-label={FORMS[STARTERS[i]].name} onClick={() => setSel(i)}
            style={{ left: `${((p.x - 26) / 256) * 100}%`, top: `${((p.y - 50) / 144) * 100}%`, width: `${(52 / 256) * 100}%`, height: `${(56 / 144) * 100}%` }} />
        ))}
      </>}
      dock={
        <div class="dock-split">
          <Win class="info">
            <div class="row-gap"><b class="big-name">{f.name}</b><Elems list={f.elems} /><StageTag form={f.id} /></div>
            <AbilityLines form={f.id} />
            <p class="small dim">{f.desc}</p>
          </Win>
          <Win class="cmd">
            <MenuItem onClick={() => onPick(f.id)} hot>就決定是你了！</MenuItem>
            <MenuItem onClick={() => setSel((sel + 1) % 3)}>看下一隻</MenuItem>
            <MenuItem onClick={onBack}>返回</MenuItem>
          </Win>
        </div>
      } />
  );
}

// ── 航程（海圖） ──
export function Voyage({ vp, run, onGo, onCamp, onQuit }: { vp: Viewport; run: RunState; onGo: () => void; onCamp: () => void; onQuit: () => void }) {
  const kind = run.stations[run.station];
  const [rested, setRested] = useState(false);
  const [panel, setPanel] = useState<'party' | 'items' | null>(null);
  const [, force] = useState(0);

  const action = kind === 'fish'
    ? { text: '前方是一處釣點，水面下有東西在游動。', btn: '拋竿出擊', fn: onGo }
    : kind === 'boss'
      ? { text: '海面暗了下來……淺灘的霸主就在前方。先整理好隊伍吧。', btn: '挑戰霸主', fn: onGo }
      : rested
        ? { text: '夥伴們休息好了，準備出發。', btn: '繼續航行', fn: onCamp }
        : { text: '找到一座小島可以紮營：全隊回復 60% HP，倒下的夥伴也會醒來。', btn: '紮營休息', fn: () => { healParty(run, 0.6, true); setRested(true); } };

  return (
    <GameScreen vp={vp}
      scene={<SceneCanvas draw={(c, t) => drawChart(c, t, run.stations, run.station)} label="海圖與航線" />}
      overlay={<Win class="banner left"><span class="eyebrow">海域 1 · 碧藍淺灘</span><b>第 {run.station + 1} / {run.stations.length} 站 · {STATION_INFO[kind].name}</b></Win>}
      panel={panel && (
        <Win class="big-panel" title={panel === 'party' ? `隊伍 ${run.party.length}/6` : '道具'}>
          {panel === 'party' ? <PartyList run={run} onChange={() => force((n) => n + 1)} /> : <ItemList run={run} />}
          <MenuItem onClick={() => setPanel(null)}>關閉</MenuItem>
        </Win>
      )}
      dock={
        <div class="dock-split">
          <Win class="msg">
            <p>{action.text}</p>
            <div class="party-strip">
              {run.party.map((m) => (
                <div class={`slot ${m.hp <= 0 ? 'ko' : ''}`} key={m.uid} title={formOf(m).name}>
                  <Sprite form={m.form} size={48} />
                  <Bar value={m.hp} max={maxHp(m)} />
                  <span class="slot-lv">Lv{m.lv}</span>
                </div>
              ))}
            </div>
          </Win>
          <Win class="cmd">
            <div class="cmd-grid">
              <MenuItem onClick={action.fn} hot>{action.btn}</MenuItem>
              <MenuItem onClick={() => setPanel(panel === 'party' ? null : 'party')}>隊伍</MenuItem>
              <MenuItem onClick={() => setPanel(panel === 'items' ? null : 'items')}>道具</MenuItem>
              <MenuItem onClick={onQuit}>存檔離開</MenuItem>
            </div>
          </Win>
        </div>
      } />
  );
}

function PartyList({ run, onChange }: { run: RunState; onChange: () => void }) {
  return (
    <div class="party-list">
      {run.party.map((m, i) => {
        const f = formOf(m), mx = maxHp(m);
        return (
          <div class={`pcard ${m.hp <= 0 ? 'ko' : ''}`} key={m.uid}>
            <Sprite form={m.form} size={96} />
            <div class="grow">
              <div class="row-gap"><b class="name">{f.name}</b><RarityTag r={f.rarity} /><StageTag form={m.form} /><span class="num">Lv{m.lv}</span></div>
              <div class="row-gap"><Elems list={f.elems} /><span class="small dim">{f.category}</span></div>
              <div class="hp-row"><Bar value={m.hp} max={mx} /><span class="num">{Math.max(0, m.hp)}/{mx}</span></div>
              <Bar value={m.xp} max={xpToNext(m.lv)} kind="xp" />
              <AbilityLines form={f.id} label={false} />
              <div class="skills-col">{m.skills.map((s) => <SkillLine id={s} key={s} />)}</div>
              {i > 0 && <button class="chip-btn" onClick={() => { const [x] = run.party.splice(i, 1); run.party.unshift(x); onChange(); }}>設為先發</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ItemList({ run }: { run: RunState }) {
  return (
    <div class="item-list">
      {(Object.keys(ITEMS) as ItemId[]).map((id) => (
        <div class="item-row" key={id}><b>{ITEMS[id].name}</b><span class="num">×{run.items[id] ?? 0}</span><span class="small dim">{ITEMS[id].desc}</span></div>
      ))}
    </div>
  );
}

// ── 圖鑑 ──
export function Dex({ vp, onBack }: { vp: Viewport; onBack: () => void }) {
  const dex = loadDex();
  const all = Object.values(FORMS).sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
  const [sel, setSel] = useState<string | null>(null);
  const f = sel ? FORMS[sel] : null;
  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={drawDeep} label="海底" />}
      panel={
        <Win class="big-panel" title={`圖鑑　見過 ${dex.seen.length} · 收服 ${dex.caught.length} · 共 ${all.length}`}>
          {f && (
            <div class="dex-detail">
              <Sprite form={f.id} size={144} />
              <div class="grow">
                <div class="row-gap"><b class="big-name">{f.name}</b><RarityTag r={f.rarity} /><StageTag form={f.id} /></div>
                <div class="row-gap"><Elems list={f.elems} /><span class="dim">{f.category}</span>{f.height && <span class="dim small">身高 {f.height} m · 體重 {f.weight?.toFixed(1)} kg</span>}</div>
                <AbilityLines form={f.id} label={false} />
                <p class="small dim">{f.desc}</p>
              </div>
            </div>
          )}
          <div class="dex-grid">
            {all.map((x) => {
              const seen = dex.seen.includes(x.id), caught = dex.caught.includes(x.id);
              return (
                <button class={`dex-cell ${caught ? 'caught' : ''} ${sel === x.id ? 'on' : ''}`} key={x.id} onClick={() => seen && setSel(x.id)} disabled={!seen}>
                  <Sprite form={x.id} size={96} silhouette={!seen} still />
                  <span class="small">{seen ? x.name : '？？？'}</span>
                  <RarityTag r={x.rarity} />
                </button>
              );
            })}
          </div>
          <MenuItem onClick={onBack}>返回標題</MenuItem>
        </Win>
      } />
  );
}

// ── 說明 ──
export function Help({ vp, onBack }: { vp: Viewport; onBack: () => void }) {
  const els = Object.keys(ELEM) as Elem[];
  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={drawDeep} label="海底" />}
      panel={
        <Win class="big-panel help" title="玩法說明">
          <h3>一場遭遇</h3>
          <ol>
            <li><b>拋竿</b>：力量條越接近頂端，越容易釣到稀有生物（N &lt; B &lt; A &lt; S &lt; SSR）。</li>
            <li><b>等待咬鉤</b>：浮標下沉、出現「！」時立刻點擊。太早點會把魚嚇跑。</li>
            <li><b>回合制戰鬥</b>：每回合 +1 能量（上限 5），強力技能需要較多能量。</li>
            <li><b>收線捕捉</b>：對手 HP 越低、身上有異常狀態，捕捉區就越寬。失敗的話對手會獲得一次攻擊機會。</li>
          </ol>
          <h3>技能數量</h3>
          <p>幼體最多 2 招、成長體 3 招、完全體 4 招。有些生物會跳過成長體，也有些天生就是完全體。</p>
          <h3>操作</h3>
          <p>電腦：滑鼠，或數字鍵選指令、空白鍵拋竿和收線。手機：點擊和按住。</p>
          <h3>屬性相剋（攻擊方 → 防守方）</h3>
          <div class="table-wrap">
            <table class="chart">
              <thead><tr><th>攻＼守</th>{els.map((e) => <th key={e} style={{ color: ELEM[e].color }}>{ELEM[e].name}</th>)}</tr></thead>
              <tbody>
                {els.map((a) => (
                  <tr key={a}>
                    <th style={{ color: ELEM[a].color }}>{ELEM[a].name}</th>
                    {els.map((d) => { const v = effectiveness(a, [d]); return <td key={d} class={v > 1 ? 'up' : v < 1 ? 'down' : ''}>{v > 1 ? '◎' : v < 1 ? '△' : ''}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p class="small dim">◎ 效果絕佳 ×2　△ 效果不好 ×0.5　本系技能額外 ×1.3</p>
          <h3>稀有度</h3>
          <div class="row-gap">{RARITY_ORDER.map((r) => <span key={r} class="row-gap"><RarityTag r={r} /><span class="small">{RARITY[r].name}</span></span>)}</div>
          <MenuItem onClick={onBack}>返回標題</MenuItem>
        </Win>
      } />
  );
}

// ── 結算 ──
export function End({ vp, run, win, onTitle }: { vp: Viewport; run: RunState; win: boolean; onTitle: () => void }) {
  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={win ? drawTitle : drawDeep} />}
      panel={
        <Win class="big-panel end" title={win ? '淺灘霸主已被擊敗！' : '航程結束'}>
          <p>{win ? 'M1 的內容到這裡結束。之後會開放冰封峽灣、熔岩裂谷與電子海域。' : '隊伍全部倒下了。整理好心情，再出海一次吧。'}</p>
          <div class="end-stats">
            <span>抵達</span><b class="num">第 {run.station + 1} 站</b>
            <span>勝利</span><b class="num">{run.battlesWon} 場</b>
            <span>收服</span><b class="num">{run.caught} 隻</b>
          </div>
          <div class="party-strip">{run.party.map((m) => <div class="slot" key={m.uid}><Sprite form={m.form} size={48} /><span class="slot-lv">Lv{m.lv}</span></div>)}</div>
          <MenuItem onClick={onTitle} hot>回到標題</MenuItem>
        </Win>
      } />
  );
}
