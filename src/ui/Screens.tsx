import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { FORMS, STARTERS } from '../data/creatures';
import { ELEM, effectiveness, RARITY, RARITY_ORDER, type Elem } from '../data/types';
import { ITEMS, statusLabel, type ItemId } from '../game/battle';
import { ancestryOf, blockRate, dodgeRate, formOf, maxHp, xpToNext, type Mon } from '../game/creature';
import { achStats, ACHIEVEMENTS, bayCap, bringBack, buyUpgrade, claimable, claimAchievement, loadMeta, saveMeta, titleOf, UPGRADES, upLv, type BayMon, type UpgradeId } from '../game/meta';
import { canUseOutside, enterSpecial, FINAL_ZONE, ZONE_CHOICES, healParty, loadDex, NODE_INFO, priceOf, saveRun, SHOP, spotName, totalStation, applyItemOutside, ZONES, zoneOf, type RunState, type ZoneId } from '../game/run';
import type { GameEvent } from '../game/events';
import { APP_VERSION, CHANGELOG, hasUnreadNews, markNewsRead } from '../game/version';
import { loadSound, saveSound, type SoundSettings } from '../audio/engine';
import { BOONS, LURES } from '../data/boons';
import { chartPos, drawChart, drawDeep, drawPort, drawSea, drawStarterScene, drawTitle, PEDESTALS } from '../render/scene';
import { AbilityLines, Bar, Elems, IvStars, EnvHint, RarityTag, SkillLine, Sprite, StageTag, StyleMeter } from './components';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';

export function MenuItem({ children, onClick, disabled, hot, sel, sub, onHover }: { children: ComponentChildren; onClick: () => void; disabled?: boolean; hot?: boolean; sel?: boolean; sub?: ComponentChildren; onHover?: () => void }) {
  return (
    <button class={`mi ${hot ? 'hot' : ''} ${sel ? 'sel' : ''}`} onClick={onClick} disabled={disabled} onMouseEnter={onHover} onFocus={onHover} aria-pressed={sel}>
      <span class="cursor">▶</span><span class="mi-main">{children}</span>{sub && <span class="mi-sub">{sub}</span>}
    </button>
  );
}

// ── 標題 ──
export function Title({ vp, hasSave, onNew, onContinue, onDex, onHelp, onPort, onBay }: { vp: Viewport; hasSave: boolean; onNew: () => void; onContinue: () => void; onDex: () => void; onHelp: () => void; onPort: () => void; onBay: () => void }) {
  const dex = loadDex(), meta = loadMeta();
  const [news, setNews] = useState(false);
  const [sound, setSound] = useState(false);
  const [snd, setSnd] = useState(loadSound);
  const updSnd = (p: Partial<SoundSettings>) => { const n = { ...snd, ...p }; setSnd(n); saveSound(n); };
  const [unread, setUnread] = useState(hasUnreadNews);
  const openNews = () => { setNews(true); setUnread(false); markNewsRead(); };
  return (
    <GameScreen vp={vp}
      scene={<SceneCanvas draw={drawTitle} label="夕陽下的海面，潮靈躍出水面" />}
      overlay={<>
        <div class="title-logo"><span class="title-en">TIDE HUNTER</span><h1>潮汐獵手</h1><span class="title-sub">釣起潮靈 · 收服 · 進化 · 挑戰霸主</span>{titleOf(meta) && <span class="title-badge">🏅 {titleOf(meta)}</span>}</div>
        <div class="title-tools">
          <button class="tool-btn" onClick={() => { setNews(false); setSound(!sound); }} aria-label="聲音設定">{snd.muted ? '🔇' : '🔊'}</button>
          <button class="tool-btn news-btn" onClick={() => { setSound(false); news ? setNews(false) : openNews(); }} aria-label="更新通知">📢 通知{unread && <i class="news-dot" aria-label="有新消息" />}</button>
        </div>
        <span class="app-version">v{APP_VERSION}</span>
      </>}
      onPanelClose={sound || news ? () => { setSound(false); setNews(false); } : undefined}
      panel={sound ? (
        <Win class="big-panel sound-panel" title="聲音設定">
          <label class="snd-row"><span>背景音樂</span><input type="range" min="0" max="100" value={Math.round(snd.music * 100)} onInput={(e) => updSnd({ music: Number((e.target as HTMLInputElement).value) / 100 })} /><b>{Math.round(snd.music * 100)}</b></label>
          <label class="snd-row"><span>海浪與環境音</span><input type="range" min="0" max="100" value={Math.round(snd.amb * 100)} onInput={(e) => updSnd({ amb: Number((e.target as HTMLInputElement).value) / 100 })} /><b>{Math.round(snd.amb * 100)}</b></label>
          <MenuItem onClick={() => updSnd({ muted: !snd.muted })} hot={snd.muted}>{snd.muted ? '🔇 目前靜音，點一下開啟聲音' : '🔊 點一下靜音'}</MenuItem>
          <p class="small dim">聲音會在第一次點擊畫面後開始播放。電腦上也可以按 M 鍵切換靜音。</p>
          <MenuItem onClick={() => setSound(false)}>關閉</MenuItem>
        </Win>
      ) : news && (
        <Win class="big-panel" title={`更新通知　目前版本 v${APP_VERSION}`}>
          <div class="item-list">
            {CHANGELOG.map((c, i) => (
              <div class="news-entry" key={c.version}>
                <h3 class="sub-h">v{c.version}<span class="small dim">　{c.date}{i === 0 ? '　最新' : ''}</span></h3>
                <ul>{c.items.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            ))}
          </div>
          <MenuItem onClick={() => setNews(false)} hot>關閉</MenuItem>
        </Win>
      )}
      dock={
        <div class="dock-center">
          <Win class="title-menu">
            {hasSave && <MenuItem onClick={onContinue} hot>繼續冒險</MenuItem>}
            <MenuItem onClick={onNew} hot={!hasSave}>新的冒險</MenuItem>
            {meta.bay.length > 0 && <MenuItem onClick={onBay} sub={`${meta.bay.length}/${bayCap(meta)}`}>棲息灣</MenuItem>}
            <MenuItem onClick={onPort} sub={claimable(meta, achStats(meta, dex)) ? `● 成就可領　◆ ${meta.pearls}` : `◆ ${meta.pearls}`}>港口</MenuItem>
            <MenuItem onClick={onDex} sub={`${dex.caught.length}/${Object.keys(FORMS).length}`}>圖鑑</MenuItem>
            <MenuItem onClick={onHelp}>玩法說明</MenuItem>
          </Win>
        </div>
      } />
  );
}

// ── 選初始：預設三隻＋已招募＋棲息灣 ──
type StartOpt = { kind: 'base'; form: string } | { kind: 'bay'; bay: BayMon };
export function StarterPick({ vp, onPick, onBack }: { vp: Viewport; onPick: (form: string) => void; onBack: () => void }) {
  const opts: StartOpt[] = STARTERS.map((form) => ({ kind: 'base', form }) as StartOpt);
  const [sel, setSel] = useState(1);
  const cur = opts[sel];
  const formOfOpt = (o: StartOpt) => (o.kind === 'base' ? o.form : o.bay.root);
  const f = FORMS[formOfOpt(cur)];
  const pick = () => onPick(formOfOpt(cur));
  const move = (d: number) => setSel((s0) => (s0 + d + opts.length) % opts.length);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') move(-1);
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'Enter') pick();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });
  // 三座礁石台顯示「上一個、目前、下一個」
  const win = [-1, 0, 1].map((d) => (opts.length < 2 && d ? null : opts[(sel + d + opts.length) % opts.length]));
  return (
    <GameScreen vp={vp}
      scene={<SceneCanvas draw={(c, t) => drawStarterScene(c, t, win.map((o) => (o ? formOfOpt(o) : null)), 1)} label="可以選的夥伴站在礁石上" />}
      overlay={<>
        <Win class="banner">第一次出海！選一隻成為你的第一位夥伴</Win>
        {PEDESTALS.map((p, i) => (
          <button class="hit" key={i} aria-label={i === 0 ? '上一隻' : i === 2 ? '下一隻' : f.name} onClick={() => i !== 1 && move(i - 1)}
            style={{ left: `${((p.x - 26) / 256) * 100}%`, top: `${((p.y - 50) / 144) * 100}%`, width: `${(52 / 256) * 100}%`, height: `${(56 / 144) * 100}%` }} />
        ))}
      </>}
      dock={
        <div class="dock-split">
          <Win class="info">
            <div class="row-gap"><b class="big-name">{f.name}</b><Elems list={f.elems} /><StageTag form={f.id} />{cur.kind === 'bay' && <span class="bay-tag">棲息灣</span>}</div>
            <AbilityLines form={f.id} />
            <p class="small dim">{f.desc}</p>
            <p class="small accent">選好的夥伴會住進棲息灣，之後每次出海都可以帶牠。只有第一次可以選喔！</p>
          </Win>
          <Win class="cmd">
            <MenuItem onClick={pick} hot>就決定是你了！</MenuItem>
            <div class="cmd-grid">
              <MenuItem onClick={() => move(-1)}>◀ 上一隻</MenuItem>
              <MenuItem onClick={() => move(1)}>下一隻 ▶</MenuItem>
            </div>
            <MenuItem onClick={onBack}>返回</MenuItem>
          </Win>
        </div>
      } />
  );
}

// ── 港口 ──
export function Port({ vp, onBack, onGacha }: { vp: Viewport; onBack: () => void; onGacha: () => void }) {
  const [meta, setMeta] = useState(loadMeta);
  const [tab, setTab] = useState<'up' | 'recruit' | 'bay' | 'ach'>('up');
  const dex = loadDex(), st = achStats(meta, dex), canClaim = claimable(meta, st);
  const [, force] = useState(0);
  const refresh = () => { setMeta(loadMeta()); force((n) => n + 1); };
  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={(c, t) => drawPort(c, t, meta.bay.map((b) => b.form))} label="港口與棲息灣" />}
      onPanelClose={onBack}
      panel={
        <Win class="big-panel port" title={`港口　珍珠 ◆ ${meta.pearls}`}>
          <div class="tabs">
            {([['up', '設施升級'], ['recruit', '招募夥伴'], ['ach', `成就${canClaim ? ` ●${canClaim}` : ''}`]] as const).map(([k, label]) => (
              <button key={k} class={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
          {tab === 'up' && (
            <div class="item-list">
              {(Object.keys(UPGRADES) as UpgradeId[]).map((id) => {
                const u = UPGRADES[id], lv = upLv(meta, id), cost = u.costs[lv];
                return (
                  <button class="pick shop-row" key={id} disabled={cost === undefined || meta.pearls < cost} onClick={() => { buyUpgrade(meta, id); refresh(); }}>
                    <span class="grow"><b>{u.name} <span class="num dim">Lv{lv}/{u.costs.length}</span></b>
                      <span class="small dim">{lv ? `目前：${u.desc(lv)}` : '尚未建造'}{cost !== undefined ? `　→ 下一級：${u.desc(lv + 1)}` : '　（已滿級）'}</span></span>
                    <span class="num">{cost !== undefined ? `◆ ${cost}` : 'MAX'}</span>
                  </button>
                );
              })}
            </div>
          )}
          {tab === 'recruit' && (
            <div class="item-list">
              <p>在港口邊拋下釣竿，就有機會釣到新的夥伴！所有生物都可能出現，連霸主也是。</p>
              <p class="small dim">一次 ◆ 200，十連 ◆ 1800。釣竿的顏色代表稀有度，水面變色就是「轉」，會再升一級。稀有的夥伴非常難釣到。</p>
              <MenuItem onClick={onGacha} hot>🎣 前往招募</MenuItem>
            </div>
          )}
          {tab === 'ach' && (
            <div class="item-list">
              <p class="small dim">完成成就可以領取珍珠，也會解鎖稱號，顯示在主畫面上。{titleOf(meta) ? `目前稱號：「${titleOf(meta)}」` : ''}</p>
              {ACHIEVEMENTS.map((a) => {
                const got = meta.achieved?.includes(a.id), done = a.check(st);
                return (
                  <div class={`ach-row ${got ? 'got' : done ? 'ready' : ''}`} key={a.id}>
                    <span class="grow"><b>{got ? '🏅' : done ? '✨' : '🔒'} {a.title}</b><span class="small dim">{a.desc}</span></span>
                    {got ? (meta.title === a.id ? <span class="small accent">使用中</span> : <button class="chip-btn" onClick={() => { meta.title = a.id; saveMeta(meta); refresh(); }}>設為稱號</button>)
                      : <button class="chip-btn" disabled={!done} onClick={() => { claimAchievement(meta, a.id); refresh(); }}>{done ? `領取 ◆ ${a.reward}` : `◆ ${a.reward}`}</button>}
                  </div>
                );
              })}
            </div>
          )}
          <MenuItem onClick={onBack} hot>返回標題</MenuItem>
        </Win>
      } />
  );
}

// ── 航程（海圖） ──
export function Voyage({ vp, run, onGo, onNext, onQuit }: { vp: Viewport; run: RunState; onGo: () => void; onNext: () => void; onQuit: () => void }) {
  const opts = run.route[run.station];
  if (run.picked === null && opts.length === 1) run.picked = 0;
  const [rested, setRested] = useState(false);
  const [panel, setPanel] = useState<'party' | 'items' | 'shop' | null>(null);
  const [hover, setHover] = useState(0);
  const [, force] = useState(0);
  const choose = (j: number) => { run.picked = j; saveRun(run); setPanel(null); force((n) => n + 1); };

  const node = run.picked !== null ? opts[run.picked] : null;
  let action: { text: string; btn: string; fn: () => void; alt?: { btn: string; fn: () => void } } | null = null;
  const notice = run.notice;
  if (node) {
    const spot = spotName(run, node.spot);
    if (node.kind === 'fish') action = { text: `${spot.name}的釣點。${spot.desc}`, btn: '拋竿出擊', fn: onGo };
    else if (node.kind === 'elite') action = { text: `精英釣點（${spot.name}）。強大的潮靈盤據在這裡，打贏能挑更好的能力卡。`, btn: '挑戰精英', fn: onGo };
    else if (node.kind === 'treasure') action = { text: '寶藏點！海面閃閃發光，這裡只會釣到寶箱。', btn: '拋竿撈寶', fn: onGo };
    else if (node.kind === 'boss') action = { text: `海面暗了下來……${zoneOf(run).name}的霸主就在前方。先整理好隊伍吧。`, btn: '挑戰霸主', fn: onGo };
    else if (node.kind === 'portal' && node.target) {
      const tz = ZONES[node.target];
      action = { text: `海面裂開了一道發光的縫隙，裡面隱約看得到「${tz.name}」。${tz.desc}要進去嗎？（打倒守護者後會回到這條航線）`, btn: '進入', fn: () => { enterSpecial(run, node.target!); saveRun(run); force((n) => n + 1); },
        alt: { btn: '不進入', fn: onNext } };
    }
    else if (node.kind === 'event') action = { text: '海面上好像發生了什麼事……要過去看看嗎？', btn: '前往查看', fn: onGo };
    else if (node.kind === 'shop') action = { text: `漂流商店的老闆揮著手。你有 ${run.shells} 枚貝殼幣。`, btn: '逛商店', fn: () => setPanel('shop') };
    else action = rested
      ? { text: '夥伴們休息好了，準備出發。', btn: '繼續航行', fn: onNext }
      : { text: `找到一座小島可以紮營：全隊回復 ${Math.round((0.6 + (run.perks?.camp ?? 0)) * 100)}% HP，倒下的夥伴也會醒來。`, btn: '紮營休息', fn: () => { healParty(run, 0.6 + (run.perks?.camp ?? 0), true); setRested(true); } };
  }
  const hv = opts[hover] ?? opts[0];

  return (
    <GameScreen vp={vp}
      scene={<SceneCanvas draw={(c, t) => drawChart(c, t, run.route, run.station, run.picked, run.path, run.seed, zoneOf(run).theme)} label="海圖與航線" />}
      overlay={<>
        <Win class="banner left"><span class="eyebrow">{zoneOf(run).special ? '特殊區域' : `海域 ${run.zoneNo + 1}`} · {zoneOf(run).name}</span><b>第 {run.station + 1} / {run.route.length} 站 · {node ? NODE_INFO[node.kind].name : '選擇航線'}</b></Win>
        <Win class="banner right"><span class="res">🐚 {run.shells}</span><span class="res">捕捉餌 {run.catchBait}</span></Win>
        <div class="voy-tools">
          <button class={`tool-btn ${panel === 'party' ? 'on' : ''}`} onClick={() => setPanel(panel === 'party' ? null : 'party')}>👥 隊伍</button>
          <button class={`tool-btn ${panel === 'items' ? 'on' : ''}`} onClick={() => setPanel(panel === 'items' ? null : 'items')}>🎒 背包</button>
          <button class="tool-btn" onClick={onQuit}>💾 存檔</button>
        </div>
        {run.picked === null && opts.map((o, j) => {
          const [x, y] = chartPos(run.station, j, opts.length);
          return <button key={j} class="hit" aria-label={NODE_INFO[o.kind].name} onMouseEnter={() => setHover(j)} onClick={() => choose(j)}
            style={{ left: `${((x - 10) / 256) * 100}%`, top: `${((y - 18) / 144) * 100}%`, width: `${(20 / 256) * 100}%`, height: `${(20 / 144) * 100}%` }} />;
        })}
      </>}
      onPanelClose={panel && panel !== 'shop' ? () => setPanel(null) : undefined}
      panel={panel && (
        <Win class="big-panel" title={panel === 'party' ? `隊伍 ${run.party.length}/6` : panel === 'shop' ? `漂流商店　🐚 ${run.shells}` : '背包'}>
          {panel === 'party' && <PartyList run={run} onChange={() => force((n) => n + 1)} />}
          {panel === 'items' && <ItemList run={run} onChange={() => { saveRun(run); force((n) => n + 1); }} />}
          {panel === 'shop' && <ShopList run={run} onChange={() => { saveRun(run); force((n) => n + 1); }} />}
          {panel === 'shop' ? <MenuItem onClick={onNext} hot>離開商店，繼續航行</MenuItem> : <MenuItem onClick={() => setPanel(null)}>關閉</MenuItem>}
        </Win>
      )}
      dock={
        <div class="dock-split">
          <Win class="msg">
            {notice && <p class="accent">{notice}</p>}
            {node && action ? <p>{action.text}</p> : <p><b>選擇航線：</b>{NODE_INFO[hv.kind].name}{hv.kind === 'fish' || hv.kind === 'elite' ? `（${spotName(run, hv.spot).name}）` : ''}——{NODE_INFO[hv.kind].desc}</p>}
            <div class="party-strip">
              {run.party.map((m) => (
                <div class={`slot ${m.hp <= 0 ? 'ko' : ''}`} key={m.uid} title={formOf(m).name}>
                  <Sprite form={m.form} size={48} mutant={m.mutant} />
                  <Bar value={m.hp} max={maxHp(m)} />
                  <span class="slot-lv">Lv{m.lv}</span>
                </div>
              ))}
            </div>
          </Win>
          <Win class="cmd">
            <div class="cmd-grid">
              {node && action ? <><MenuItem onClick={() => { run.notice = undefined; action!.fn(); }} hot>{action.btn}</MenuItem>{action.alt && <MenuItem onClick={action.alt.fn}>{action.alt.btn}</MenuItem>}</>
                : opts.map((o, j) => <MenuItem key={j} hot={j === hover} onHover={() => setHover(j)} onClick={() => choose(j)}>{NODE_INFO[o.kind].name}{o.kind === 'fish' || o.kind === 'elite' ? `・${spotName(run, o.spot).name}` : ''}</MenuItem>)}

            </div>
          </Win>
        </div>
      } />
  );
}

function ShopList({ run, onChange }: { run: RunState; onChange: () => void }) {
  return (
    <div class="item-list">
      {SHOP.map((it) => (
        <button class="pick shop-row" key={it.id} disabled={run.shells < priceOf(run, it)} onClick={() => { run.shells -= priceOf(run, it); it.buy(run); onChange(); }}>
          <span class="grow"><b>{it.name}</b><span class="small dim">{it.desc}</span></span>
          <span class="num">🐚 {priceOf(run, it)}</span>
        </button>
      ))}
    </div>
  );
}

function PartyList({ run, onChange }: { run: RunState; onChange: () => void }) {
  return (
    <div class="party-list">
      {run.party.map((m, i) => {
        const f = formOf(m), mx = maxHp(m);
        return (
          <div class={`pcard ${m.hp <= 0 ? 'ko' : ''}`} key={m.uid}>
            <Sprite form={m.form} size={96} mutant={m.mutant} />
            <div class="grow">
              <div class="row-gap"><b class="name">{f.name}</b><RarityTag r={f.rarity} /><StageTag form={m.form} />{m.mutant && <span class="mutant-tag">✦ 異變</span>}<span class="num">Lv{m.lv}</span></div>
              <div class="row-gap"><Elems list={f.elems} /><span class="small dim">{f.category}</span><IvStars iv={m.iv} detail /></div>
              <span class="small dim">閃避 {Math.round(dodgeRate(f) * 100)}%・格擋 {Math.round(blockRate(f) * 100)}%</span>
              <StyleMeter mon={m} /><EnvHint mon={m} />
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

const BAG_USABLE: ItemId[] = ['potion', 'superpotion', 'revive'];

function ItemList({ run, onChange }: { run: RunState; onChange: () => void }) {
  const owned = Object.entries(run.boons).filter(([, n]) => n > 0);
  const [using, setUsing] = useState<ItemId | null>(null);
  const [msg, setMsg] = useState('');
  if (using) return (
    <div class="item-list">
      <p class="small">要對誰使用 <b>{ITEMS[using].name}</b>？（剩 {run.items[using]} 個）</p>
      <div class="pick-grid">
        {run.party.map((m, i) => (
          <button class="pick" key={m.uid} disabled={!canUseOutside(m, using)}
            onClick={() => { setMsg(applyItemOutside(run, using, i)); setUsing(null); onChange(); }}>
            <Sprite form={m.form} size={48} mutant={m.mutant} />
            <span class="grow">
              <span class="row-gap"><b>{formOf(m).name}</b><span class="num">Lv{m.lv}</span></span>
              <Bar value={m.hp} max={maxHp(m)} />
              <span class="small dim">{Math.max(0, m.hp)}/{maxHp(m)}{m.hp <= 0 ? ' · 倒下' : m.status ? ` · ${statusLabel(m.status)}` : ''}</span>
            </span>
          </button>
        ))}
      </div>
      <MenuItem onClick={() => setUsing(null)}>返回背包</MenuItem>
    </div>
  );
  return (
    <div class="item-list">
      {msg && <p class="accent">{msg}</p>}
      <h3 class="sub-h">回復道具（點「使用」）</h3>
      {BAG_USABLE.map((id) => (
        <div class="item-row" key={id}><b>{ITEMS[id].name}</b><span class="num">×{run.items[id] ?? 0}</span><span class="small dim grow">{ITEMS[id].desc}</span>
          <button class="chip-btn" disabled={!run.items[id] || !run.party.some((m) => canUseOutside(m, id))} onClick={() => { setMsg(''); setUsing(id); }}>使用</button></div>
      ))}
      <div class="item-row"><b>能量海膽</b><span class="num">×{run.items.ether ?? 0}</span><span class="small dim">{ITEMS.ether.desc}（只能在戰鬥中用）</span></div>
      <div class="item-row"><b>生命石</b><span class="num">×{run.lifeStones ?? 0}</span><span class="small dim">戰鬥中全隊倒下時，可以讓全隊以 50% HP 復活，再選擇繼續戰鬥或逃跑。</span></div>
      <h3 class="sub-h">魚餌與貨幣</h3>
      <div class="item-row"><b>捕捉餌</b><span class="num">×{run.catchBait}</span><span class="small dim">收服夥伴時消耗 1 個。</span></div>
      <div class="item-row"><b>星光餌</b><span class="num">×{run.lures.star}</span><span class="small dim">{LURES.star.desc}</span></div>
      <div class="item-row"><b>傳說餌</b><span class="num">×{run.lures.legend}</span><span class="small dim">{LURES.legend.desc}</span></div>
      <div class="item-row"><b>貝殼幣</b><span class="num">{run.shells}</span><span class="small dim">在漂流商店使用。</span></div>
      <h3 class="sub-h">已獲得的能力</h3>
      {owned.length ? owned.map(([id, n]) => (
        <div class="item-row" key={id}><b>{BOONS[id].name}</b><span class="num">×{n}</span><span class="small dim">{BOONS[id].desc}</span></div>
      )) : <p class="small dim">還沒有。每場戰鬥勝利後可以挑選一張能力卡。</p>}
    </div>
  );
}

// ── 圖鑑 ──
export function Dex({ vp, onBack }: { vp: Viewport; onBack: () => void }) {
  const dex = loadDex();
  const all = Object.values(FORMS).sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
  const [sel, setSel] = useState<string | null>(() => all.find((x) => dex.seen.includes(x.id))?.id ?? null);
  const f = sel ? FORMS[sel] : null;
  // 進化路線：從最初型態往後展開（分支用「／」）
  const line = (() => {
    if (!f) return [];
    const root = ancestryOf(f.id)[0];
    const out: string[][] = [[root.id]];
    for (let guard = 0; guard < 4; guard++) {
      const next = out[out.length - 1].flatMap((id) => (FORMS[id].evolve ?? []).map((e) => e.to));
      if (!next.length) break;
      out.push([...new Set(next)]);
    }
    return out;
  })();
  const STAT = [['hp', 'HP'], ['atk', '攻擊'], ['def', '防禦'], ['spd', '速度']] as const;
  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={drawDeep} label="海底" />}
      onPanelClose={onBack}
      panel={
        <Win class="big-panel dex-panel">
          <div class="dex-head">
            <b>圖鑑</b><span class="small dim">見過 {dex.seen.length}・收服 {dex.caught.length}・共 {all.length}</span>
            <button class="chip-btn dex-close" onClick={onBack}>✕ 返回</button>
          </div>
          <div class="dex-split">
            <div class="dex-list">
              {all.map((x) => {
                const seen = dex.seen.includes(x.id), caught = dex.caught.includes(x.id);
                return (
                  <button class={`dex-cell ${caught ? 'caught' : ''} ${sel === x.id ? 'on' : ''}`} key={x.id} onClick={() => seen && setSel(x.id)} disabled={!seen} aria-label={seen ? x.name : '未發現'}>
                    <Sprite form={x.id} size={48} silhouette={!seen} still />
                    <span class="small">{seen ? x.name : '？？？'}</span>
                  </button>
                );
              })}
            </div>
            <div class="dex-side">
              {f ? <>
                <Sprite form={f.id} size={144} />
                <div class="row-gap">{f.no && <span class="num dim">No.{String(f.no).padStart(4, '0')}</span>}<b class="big-name">{f.name}</b><RarityTag r={f.rarity} /><StageTag form={f.id} /></div>
                <div class="row-gap"><Elems list={f.elems} /><span class="dim small">{f.category}</span>{dex.caught.includes(f.id) ? <span class="small accent">已收服</span> : <span class="small dim">只見過</span>}</div>
                {f.height && <span class="dim small">身高 {f.height} m・體重 {f.weight?.toFixed(1)} kg</span>}
                <p class="small">{f.desc}</p>
                <AbilityLines form={f.id} label={false} />
                <div class="dex-stats">
                  {STAT.map(([k, label]) => <span key={k} class="small">{label}<i style={{ width: `${Math.min(100, f.base[k] / 1.3)}%` }} /><b class="num">{f.base[k]}</b></span>)}
                </div>
                <span class="small dim">閃避 {Math.round(dodgeRate(f) * 100)}%・格擋 {Math.round(blockRate(f) * 100)}%</span>
                {line.length > 1 && (
                  <div class="dex-line">
                    {line.map((ids, k) => (
                      <span class="row-gap" key={k}>{k > 0 && <span class="dim">→</span>}
                        {ids.map((id) => {
                          const known = dex.seen.includes(id), e = Object.values(FORMS).flatMap((x) => x.evolve ?? []).find((ev) => ev.to === id);
                          return <button key={id} class={`dex-evo ${id === f.id ? 'on' : ''}`} disabled={!known} onClick={() => setSel(id)}>
                            <Sprite form={id} size={48} silhouette={!known} still /><span class="small">{known ? FORMS[id].name : '？？？'}{e ? ` Lv${e.level}` : ''}</span>
                          </button>;
                        })}
                      </span>
                    ))}
                  </div>
                )}
              </> : <p class="small dim">還沒有見過任何生物。</p>}
            </div>
          </div>
        </Win>
      } />
  );
}

// ── 說明 ──
export function Help({ vp, onBack }: { vp: Viewport; onBack: () => void }) {
  const els = Object.keys(ELEM) as Elem[];
  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={drawDeep} label="海底" />}
      onPanelClose={onBack}
      panel={
        <Win class="big-panel help" title="玩法說明">
          <h3>一場遭遇</h3>
          <ol>
            <li><b>拋竿</b>：力量條停在魚影的目標區（黃色），紅色是完美落點：對手開場 HP 減少、比較好捕捉，稀有度也可能提升。</li>
            <li><b>等待咬鉤</b>：浮標下沉、出現「！」時立刻點擊。太早點會把魚嚇跑。</li>
            <li><b>回合制戰鬥</b>：每回合 +1 能量（上限 5），強力技能需要較多能量。</li>
            <li><b>收線捕捉</b>：對手 HP 越低、身上有異常狀態，捕捉區就越寬。失敗的話對手會獲得一次攻擊機會。</li>
          </ol>
          <h3>技能數量</h3>
          <p>幼體最多 2 招、成長體 3 招、完全體 4 招。有些生物會跳過成長體，也有些天生就是完全體。</p>
          <h3>棲息灣與招募</h3>
          <p class="small">第一次出海時從三隻初始夥伴選一隻，之後所有夥伴都住在主畫面的「棲息灣」。最上面的「出航夥伴」就是下次要帶出海的夥伴。冒險結束可以帶一隻新夥伴回來；多的夥伴可以分解成少量珍珠。</p>
          <p class="small">在港口可以用珍珠「招募」：像釣魚一樣拋竿，釣竿顏色代表稀有度（破損＜普通 N＜綠 B＜藍 A＜紅 S＜金 SSR），水面變色就是「轉」，會再升一級。</p>
          <h3>個體值與分支進化</h3>
          <p class="small">每隻生物的 HP、攻擊、防禦、速度都有 ±10% 的個體差異，用 ★1～5 表示（霸主固定）。帶回棲息灣的夥伴會保留個體值。</p>
          <p class="small">初始三隻在 Lv18 進化時會分成兩種：戰鬥中常用攻擊技會成為<b>攻擊型</b>；變化技（強化、回復、護盾、場地、異常）用得夠多（35% 以上）會成為<b>守護型</b>。在隊伍畫面可以看到目前的傾向。</p>
          <p class="small"><b>環境進化</b>：有些生物在特定區域進化時會變成地區形態，例如潮汐胞體在冰封峽灣進化會變成冰晶星渦。隊伍畫面會顯示提示。</p>
          <p class="small"><b>✦ 異變個體</b>：野生生物有很小的機率是異變個體，顏色跟一般的不同，個體值也比較好。</p>
          <h3>異常狀態</h3>
          <ul class="small">
            <li><b>灼傷</b>：每回合扣 1/16 HP，攻擊力下降。<b>中毒</b>：每回合扣 1/10 HP。<b>流血</b>：每回合扣 1/12 HP（岩、數碼、骷髏不會流血）。</li>
            <li><b>麻痺</b>：速度減半，25% 無法行動。<b>冰凍</b>：無法行動，最多 3 回合。<b>睡眠</b>：無法行動，睡著時防禦 +1。</li>
            <li><b>致盲</b>：命中率 ×0.6，換下場時解除。<b>資料錯亂</b>：30% 使出別的技能。</li>
            <li>灼傷 4 回合、中毒 5 回合、流血 4 回合、麻痺／致盲／資料錯亂 3 回合，時間到會自動解除，狀態欄會顯示剩下幾回合。</li>
            <li><b>閃避</b>：速度越快越容易整招躲開（2%～15%）。<b>格擋</b>：防禦越高越容易擋下 40% 傷害（2%～15%）。麻痺、冰凍、睡著時沒辦法閃避。</li>
          </ul>
          <h3>場地與連鎖</h3>
          <p class="small">漲潮、熔岩地面、濃霧、雷暴雲、極光、資料網格、聖林等場地會持續 5 回合，影響雙方。有些技能在對手處於特定異常狀態時更強，例如「導電」對麻痺的對手必定擊中要害、「凍裂」對冰凍的對手威力提升。</p>
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

// ── 結算：珍珠＋帶夥伴回棲息灣 ──
export function End({ vp, run, win, pearls, onTitle }: { vp: Viewport; run: RunState; win: boolean; pearls: number; onTitle: () => void }) {
  const [meta, setMeta] = useState(loadMeta);
  const [picked, setPicked] = useState<Mon | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const candidates = run.party.filter((m) => !m.bayId);
  const full = meta.bay.length >= bayCap(meta);
  const keep = (m: Mon, replaceId?: string) => { bringBack(meta, m, replaceId); setMeta(loadMeta()); setDone(`${formOf(m).name} 住進了棲息灣！下次出海可以帶牠一起走。`); setPicked(null); };
  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={win ? drawTitle : drawDeep} />}
      panel={
        <Win class="big-panel end" title={win ? `${zoneOf(run).name}的霸主已被擊敗！` : '航程結束'}>
          <p>{win ? '恭喜通關！帶著收穫回到港口吧。' : '隊伍全部倒下了。回港口整頓一下，再出海一次吧。'}</p>
          <div class="end-stats">
            <span>抵達</span><b class="num">{zoneOf(run).name} 第 {run.station + 1} 站（共 {totalStation(run)} 站）</b>
            <span>勝利</span><b class="num">{run.battlesWon} 場</b>
            <span>收服</span><b class="num">{run.caught} 隻</b>
            <span>獲得珍珠</span><b class="num accent">◆ {pearls}（共 {meta.pearls}）</b>
          </div>
          {done ? <p class="accent">{done}</p> : candidates.length > 0 && <>
            <h3 class="sub-h">要帶哪一隻回棲息灣？（{meta.bay.length}/{bayCap(meta)}）</h3>
            {!picked ? (
              <div class="pick-grid">
                {candidates.map((m) => (
                  <button class="pick" key={m.uid} onClick={() => (full ? setPicked(m) : keep(m))}>
                    <Sprite form={m.form} size={48} mutant={m.mutant} />
                    <span class="grow"><b>{formOf(m).name}</b><span class="small dim">Lv{m.lv}・回港後以 {FORMS[ancestryOf(m.form)[0].id].name} 的樣子重新出發</span></span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <p class="small">棲息灣滿了，要讓誰離開，換 {formOf(picked).name} 住進來？</p>
                <div class="pick-grid">
                  {meta.bay.map((b) => (
                    <button class="pick" key={b.id} onClick={() => keep(picked, b.id)}>
                      <Sprite form={b.form} size={48} mutant={b.mutant} /><span class="grow"><b>{FORMS[b.form].name}</b><span class="small">羈絆 {b.bond}</span></span>
                    </button>
                  ))}
                </div>
                <MenuItem onClick={() => setPicked(null)}>算了</MenuItem>
              </>
            )}
          </>}
          {run.party.some((m) => m.bayId) && <p class="small dim">從棲息灣帶出來的夥伴，羈絆 +1，已經自動回港。</p>}
          <MenuItem onClick={onTitle} hot>回到港口</MenuItem>
        </Win>
      } />
  );
}

// ── 隨機事件 ──
export function EventScreen({ vp, run, ev, onDone }: { vp: Viewport; run: RunState; ev: GameEvent; onDone: () => void }) {
  const [result, setResult] = useState<string | null>(null);
  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={(c, t) => drawSea(c, t, zoneOf(run).theme)} label="海面" />}
      panel={
        <Win class="big-panel event" title={`❓ ${ev.title}`}>
          <p>{ev.text}</p>
          {result ? <>
            <p class="accent">{result}</p>
            <MenuItem onClick={onDone} hot>{run.eventFight ? '⚔ 開始戰鬥' : '繼續航行'}</MenuItem>
          </> : ev.options.map((o, i) => {
            const ok = o.can ? o.can(run) : true;
            return <MenuItem key={i} disabled={!ok} onClick={() => { setResult(o.act(run)); saveRun(run); }} sub={o.hint}>{o.label}</MenuItem>;
          })}
          <div class="party-strip">{run.party.map((m) => <div class={`slot ${m.hp <= 0 ? 'ko' : ''}`} key={m.uid}><Sprite form={m.form} size={48} mutant={m.mutant} /><Bar value={m.hp} max={maxHp(m)} /><span class="slot-lv">Lv{m.lv}</span></div>)}</div>
        </Win>
      } />
  );
}

// ── 選擇下一片海域 ──
export function ZonePick({ vp, run, onPick }: { vp: Viewport; run: RunState; onPick: (z: ZoneId) => void }) {
  const opts: ZoneId[] = ZONE_CHOICES[run.zoneNo + 1] ?? ['ice', 'lava'];
  const show: Partial<Record<ZoneId, string[]>> = { shallows: [], ice: ['iceshrimp', 'walrus', 'frostking'], lava: ['lavasnail', 'cinderbone', 'lavadragon'], cyber: ['pixfish', 'neonray', 'mainframe_leviathan'], abyss: ['lanternlarva', 'ghost_squid', 'nether_whale'] };
  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={drawTitle} label="夕陽下的海面" />}
      panel={
        <Win class="big-panel" title={`${zoneOf(run).name}的霸主被擊敗了！要往哪裡前進？`}>
          <p class="small dim">全隊會在出發前回復一半 HP，倒下的夥伴也會醒來。{run.zoneNo + 1 >= FINAL_ZONE ? '這是最後一片海域，打倒霸主就通關！' : ''}</p>
          <div class="zone-row">
            {opts.map((z) => (
              <button class={`zone-card zone-${z}`} key={z} onClick={() => onPick(z)}>
                <b class="big-name">{ZONES[z].name}</b>
                <div class="row-gap">{(show[z] ?? []).map((f) => <Sprite form={f} size={48} key={f} still />)}</div>
                <span class="small">{ZONES[z].desc}</span>
              </button>
            ))}
          </div>
        </Win>
      } />
  );
}
