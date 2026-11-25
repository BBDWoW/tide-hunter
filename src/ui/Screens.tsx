import { ZoneCutscene } from './Special';
import { drawEventArt, EVENT_ART } from '../render/eventArt';
import { DOMAINS, isDomain, type DomainId } from '../data/domains';
import { Icon } from './Icon';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { FORMS, STARTERS } from '../data/creatures';
import { ELEM, effectiveness, RARITY, RARITY_ORDER, type Elem } from '../data/types';
import { ITEMS, statusLabel, type ItemId } from '../game/battle';
import { ancestryOf, blockRate, dodgeRate, formOf, maxHp, xpToNext, type Mon } from '../game/creature';
import { bringBackSlots, releaseValue, achStats, ACHIEVEMENTS, bayCap, bringBack, buyUpgrade, claimable, claimAchievement, loadMeta, saveMeta, titleOf, UPGRADES, upLv, type BayMon, type UpgradeId } from '../game/meta';
import { dailyRule, dailyRuleInfo, timeOfDay, TOD_INFO, MAX_STAR, STAR_RULES, todayKey, campHealMul, heldPrice, campSearch, campTrain, buyHeld, equipHeld, refreshCost, refreshShop, shopHeld, canUseOutside, enterSpecial, FINAL_ZONE, ZONE_CHOICES, healParty, loadDex, loadRun, NODE_INFO, priceOf, saveRun, SHOP, spotName, totalStation, applyItemOutside, ZONES, zoneOf, type RunState, type ZoneId } from '../game/run';
import type { GameEvent } from '../game/events';
import { APP_VERSION, CHANGELOG, hasUnreadNews, markNewsRead } from '../game/version';
import { loadSound, saveSound, sfx, type SoundSettings } from '../audio/engine';
import { fx, setReduceFx } from '../render/fx';
import { BOONS, LURES } from '../data/boons';
import { HELD, resonance, type HeldId } from '../data/held';
import { chartPos, drawChart, type ChartAnim, drawDeep, drawPort, drawSea, drawStarterScene, drawTitle, PEDESTALS } from '../render/scene';
import { useBuyToast, Tip, AbilityLines, Bar, Elems, IvStars, EnvHint, RarityTag, SkillLine, Sprite, StageTag, StyleMeter } from './components';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';

export function MenuItem({ children, onClick, disabled, hot, sel, sub, onHover }: { children: ComponentChildren; onClick: () => void; disabled?: boolean; hot?: boolean; sel?: boolean; sub?: ComponentChildren; onHover?: () => void }) {
  return (
    <button class={`mi ${hot ? 'hot' : ''} ${sel ? 'sel' : ''}`} onClick={() => { sfx('select'); onClick(); }} disabled={disabled} onMouseEnter={onHover} onFocus={onHover} aria-pressed={sel}>
      <span class="cursor">▶</span><span class="mi-main">{children}</span>{sub && <span class="mi-sub">{sub}</span>}
    </button>
  );
}

// ── 標題 ──
export function Title({ vp, hasSave, onNew, onDaily, onContinue, onDex, onHelp, onPort, onBay }: { vp: Viewport; hasSave: boolean; onNew: () => void; onDaily: () => void; onContinue: () => void; onDex: () => void; onHelp: () => void; onPort: () => void; onBay: () => void }) {
  const dex = loadDex(), meta = loadMeta();
  const [stars, setStars] = useState(false);
  const [dailyInfo, setDailyInfo] = useState(false);
  // 有進行中的冒險時，開新局前先確認
  const [confirm, setConfirm] = useState<null | { k: 'new' | 'daily'; go: () => void }>(null);
  const guard = (k: 'new' | 'daily', go: () => void) => () => (hasSave ? setConfirm({ k, go }) : go());
  const saved = hasSave ? loadRun() : null;
  const [star, setStar] = useState(meta.star ?? 0);
  const maxStar = meta.maxStar ?? 0;
  const today = todayKey(), daily = meta.daily?.day === today ? meta.daily : null;
  const todayRule = dailyRuleInfo(dailyRule(today));
  const begin = () => { const m = loadMeta(); m.star = Math.min(star, maxStar); saveMeta(m); setStars(false); onNew(); };
  const openNew = () => (maxStar > 0 ? setStars(true) : onNew());
  const [news, setNews] = useState(false);
  const [sound, setSound] = useState(false);
  const [snd, setSnd] = useState(loadSound);
  const [reduce, setReduce] = useState(fx.reduce);
  const updSnd = (p: Partial<SoundSettings>) => { const n = { ...snd, ...p }; setSnd(n); saveSound(n); };
  const [unread, setUnread] = useState(hasUnreadNews);
  const openNews = () => { setNews(true); setUnread(false); markNewsRead(); };
  return (
    <GameScreen vp={vp}
      scene={<SceneCanvas draw={drawTitle} label="夕陽下的海面，潮靈躍出水面" />}
      overlay={<>
        <div class="title-logo"><span class="title-en">TIDE HUNTER</span><h1>潮汐獵手</h1><span class="title-sub">釣起潮靈 · 收服 · 進化 · 挑戰霸主</span>{titleOf(meta) && <span class="title-badge"><Icon name="medal" /> {titleOf(meta)}</span>}</div>
        <div class="title-tools">
          <button class="tool-btn" onClick={onHelp} aria-label="玩法說明"><Icon name="help" /></button>
          <button class="tool-btn" onClick={() => { setNews(false); setSound(!sound); }} aria-label="聲音與特效設定"><Icon name={snd.muted ? 'mute' : 'sound'} /></button>
          <button class="tool-btn news-btn" onClick={() => { setSound(false); news ? setNews(false) : openNews(); }} aria-label="更新通知"><Icon name="news" /> 通知{unread && <i class="news-dot" aria-label="有新消息" />}</button>
        </div>
        <span class="app-version">v{APP_VERSION}</span>
      </>}
      onPanelClose={sound || news || stars || confirm || dailyInfo ? () => { setSound(false); setNews(false); setStars(false); setConfirm(null); setDailyInfo(false); } : undefined}
      panel={dailyInfo ? (
        <Win class="big-panel confirm-panel" title={`每日挑戰　${today}`} onClose={() => setDailyInfo(false)}>
          <p class="small dim">今天大家都用同一隻夥伴、同一條航線出發，比誰走得最遠。珍珠只有今天第一次結算時拿得到。</p>
          <div class="daily-rule"><span class="small dim">今日特殊規則</span><b><Icon name="sparkle" /> {todayRule.name}</b><span>{todayRule.desc}</span></div>
          {daily && <p class="small accent">今日最佳：{daily.best} 站{daily.win ? '・已通關' : ''}</p>}
          <MenuItem onClick={() => { setDailyInfo(false); guard('daily', onDaily)(); }} hot>出發</MenuItem>
        </Win>
      ) : confirm ? (
        <Win class="big-panel confirm-panel" title="還有進行中的冒險" onClose={() => setConfirm(null)} closeLabel="取消">
          <p>目前的冒險還沒結束{saved ? `（${saved.daily ? '每日挑戰・' : ''}第 ${totalStation(saved)} 站・夥伴 ${saved.party.length} 隻）` : ''}。</p>
          <p class="warn-text">開始{confirm.k === 'daily' ? '每日挑戰' : '新的冒險'}會<b>放棄目前的進度</b>，沒辦法復原。</p>
          <div class="confirm-btns">
            <MenuItem onClick={() => { setConfirm(null); onContinue(); }} hot>繼續目前的冒險</MenuItem>
            <MenuItem onClick={() => { const g = confirm.go; setConfirm(null); g(); }}>放棄進度，開始{confirm.k === 'daily' ? '每日挑戰' : '新的冒險'}</MenuItem>
          </div>
        </Win>
      ) : stars ? (
        <Win class="big-panel" title="選擇潮位（難度）" onClose={() => setStars(false)}>
          <div class="star-pick">
            {Array.from({ length: maxStar + 1 }, (_, i) => (
              <button key={i} class={`chip-btn star-btn ${star === i ? 'on' : ''}`} onClick={() => setStar(i)}>{i ? '★'.repeat(i) : '標準'}</button>
            ))}
          </div>
          <ul class="star-rules">
            {star === 0 ? <li class="dim">標準難度。</li> : STAR_RULES.slice(0, star).map((t, i) => <li key={i}>★{i + 1}　{t}</li>)}
          </ul>
          <p class="small accent">結算珍珠 +{star * 20}%{maxStar < MAX_STAR ? `　・用 ★${maxStar} 通關可以解鎖 ★${maxStar + 1}` : ''}</p>
          <MenuItem onClick={begin} hot>出航！</MenuItem>
        </Win>
      ) : sound ? (
        <Win class="big-panel sound-panel" title="聲音與特效設定" onClose={() => setSound(false)}>
          <label class="snd-row"><span>背景音樂</span><input type="range" min="0" max="100" value={Math.round(snd.music * 100)} onInput={(e) => updSnd({ music: Number((e.target as HTMLInputElement).value) / 100 })} /><b>{Math.round(snd.music * 100)}</b></label>
          <label class="snd-row"><span>海浪與環境音</span><input type="range" min="0" max="100" value={Math.round(snd.amb * 100)} onInput={(e) => updSnd({ amb: Number((e.target as HTMLInputElement).value) / 100 })} /><b>{Math.round(snd.amb * 100)}</b></label>
          <label class="snd-row"><span>音效</span><input type="range" min="0" max="100" value={Math.round(snd.sfx * 100)} onInput={(e) => updSnd({ sfx: Number((e.target as HTMLInputElement).value) / 100 })} onChange={() => sfx('hit')} /><b>{Math.round(snd.sfx * 100)}</b></label>
          <label class="snd-row fx-row"><span>減少特效</span><input type="checkbox" checked={reduce} onChange={(e) => { const v = (e.target as HTMLInputElement).checked; setReduce(v); setReduceFx(v); }} /><span class="small dim">關掉畫面震動與閃光、減少粒子</span></label>
          <MenuItem onClick={() => updSnd({ muted: !snd.muted })} hot={snd.muted}>{snd.muted ? <><Icon name="mute" /> 目前靜音，點一下開啟聲音</> : <><Icon name="sound" /> 點一下靜音</>}</MenuItem>
          <p class="small dim">聲音會在第一次點擊畫面後開始播放。電腦上也可以按 M 鍵切換靜音。</p>
        </Win>
      ) : news && (
        <Win class="big-panel" title={`更新通知　目前版本 v${APP_VERSION}`} onClose={() => setNews(false)}>
          <div class="item-list">
            {CHANGELOG.map((c, i) => (
              <div class="news-entry" key={c.version}>
                <h3 class="sub-h">v{c.version}<span class="small dim">　{c.date}{i === 0 ? '　最新' : ''}</span></h3>
                <ul>{c.items.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            ))}
          </div>
        </Win>
      )}
      dock={
        <div class="dock-center">
          <Win class="title-menu">
            {hasSave && <MenuItem onClick={onContinue} hot>繼續冒險</MenuItem>}
            <MenuItem onClick={guard('new', openNew)} hot={!hasSave} sub={maxStar > 0 && (meta.star ?? 0) > 0 ? '★'.repeat(meta.star ?? 0) : undefined}>新的冒險</MenuItem>
            {meta.runs > 0 && <MenuItem onClick={() => setDailyInfo(true)} sub={todayRule.name}>每日挑戰</MenuItem>}
            {meta.bay.length > 0 && <MenuItem onClick={onBay} sub={(meta.eggs ?? []).some((e) => e.left <= 0) ? '● 蛋要孵化了' : `${meta.bay.length}/${bayCap(meta)}`}>棲息灣</MenuItem>}
            <MenuItem onClick={onPort} sub={claimable(meta, achStats(meta, dex)) ? `● 成就可領　◆ ${meta.pearls}` : `◆ ${meta.pearls}`}>港口</MenuItem>
            <MenuItem onClick={onDex} sub={`${dex.caught.length}/${Object.values(FORMS).filter((f) => !f.secret).length}`}>圖鑑</MenuItem>
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
        <button class="tool-btn screen-back" onClick={onBack}>✕ 返回</button>
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
          </Win>
        </div>
      } />
  );
}

// ── 港口 ──
export function Port({ vp, onBack, onGacha }: { vp: Viewport; onBack: () => void; onGacha: () => void }) {
  const [meta, setMeta] = useState(loadMeta);
  const [tab, setTab] = useState<'up' | 'recruit' | 'bay' | 'ach'>('up');
  const [buyNote, showBuy] = useBuyToast();
  const dex = loadDex(), st = achStats(meta, dex), canClaim = claimable(meta, st);
  const [, force] = useState(0);
  const refresh = () => { setMeta(loadMeta()); force((n) => n + 1); };
  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={(c, t) => drawPort(c, t, meta.bay.map((b) => ({ id: b.form, mutant: b.mutant })))} label="港口與棲息灣" />}
      onPanelClose={onBack} outsideClose={false}
      panel={
        <Win class="big-panel port" title={`港口　珍珠 ◆ ${meta.pearls}`} onClose={onBack} closeLabel="返回標題">
          {buyNote}
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
                  <button class="pick shop-row" key={id} disabled={cost === undefined || meta.pearls < cost} onClick={() => { if (buyUpgrade(meta, id) !== false) { sfx('coin'); showBuy({ name: `${u.name} 升到 Lv${lv + 1}`, cost: cost!, cur: 'pearl', left: meta.pearls, note: u.desc(lv + 1) }); } refresh(); }}>
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
              <p>在港口邊拋下釣竿，就有機會釣到新的夥伴！各種生物都可能出現（霸主除外，霸主只能在冒險中靠特別的機緣得到）。</p>
              <p class="small dim">一次 ◆ 200，十連 ◆ 1800。釣竿的顏色代表稀有度，水面變色就是「轉」，會再升一級。稀有的夥伴非常難釣到。</p>
              <MenuItem onClick={onGacha} hot><Icon name="rod" /> 前往招募</MenuItem>
            </div>
          )}
          {tab === 'ach' && (
            <div class="item-list">
              <p class="small dim">完成成就可以領取珍珠，也會解鎖稱號，顯示在主畫面上。{titleOf(meta) ? `目前稱號：「${titleOf(meta)}」` : ''}</p>
              {ACHIEVEMENTS.filter((a) => !a.secret || meta.achieved?.includes(a.id)).map((a) => {
                const got = meta.achieved?.includes(a.id), done = a.check(st);
                return (
                  <div class={`ach-row ${got ? 'got' : done ? 'ready' : ''}`} key={a.id}>
                    <span class="grow"><b><Icon name={got ? 'medal' : done ? 'sparkle' : 'lock'} /> {a.title}</b><span class="small dim">{a.desc}</span></span>
                    {got ? (meta.title === a.id ? <span class="small accent">使用中</span> : <button class="chip-btn" onClick={() => { meta.title = a.id; saveMeta(meta); refresh(); }}>設為稱號</button>)
                      : <button class="chip-btn" disabled={!done} onClick={() => { claimAchievement(meta, a.id); refresh(); }}>{done ? `領取 ◆ ${a.reward}` : `◆ ${a.reward}`}</button>}
                  </div>
                );
              })}
            </div>
          )}
        </Win>
      } />
  );
}

// ── 航程（海圖） ──
// 同一站只播一次「霧散開」動畫（開關視窗、重新整理畫面不重播）
let revealSeen = '';
const SAIL_MS = 900, REVEAL_MS = 1300;
export function Voyage({ vp, run, onGo, onNext, onQuit }: { vp: Viewport; run: RunState; onGo: () => void; onNext: () => void; onQuit: () => void }) {
  const opts = run.route[run.station];
  if (run.picked === null && opts.length === 1) run.picked = 0;
  // 營地做過的事記在存檔裡（存檔離開再回來也不能重來）
  const campKey = `${run.zone}-${run.zoneNo}-${run.station}`;
  const rested = run.camp?.key === campKey ? run.camp.text : null;
  const setRested = (text: string) => { run.camp = { key: campKey, text }; };
  const [panel, setPanel] = useState<'party' | 'items' | 'shop' | null>(null);
  const [cut, setCut] = useState<DomainId | null>(null); // 進入特殊區域的過場動畫
  const [hover, setHover] = useState(0);
  const [, force] = useState(0);
  // 點路線：釣點、精英、寶藏、事件、船隊直接出發；營地、商店、入口要先看選項
  // 海圖動畫：剛到這一站時霧散開、島浮出來；選好航線後小船先開過去再出發
  const revealT0 = useRef(revealSeen === `${run.seed}-${run.zone}-${run.zoneNo}-${run.station}` ? -1e9 : performance.now());
  revealSeen = `${run.seed}-${run.zone}-${run.zoneNo}-${run.station}`;
  const sail = useRef<{ from: [number, number]; to: [number, number]; t0: number } | null>(null);
  const choose = (j: number) => {
    if (sail.current) return;
    const path = run.path, last = path.length - 1;
    const from: [number, number] = last >= 0 ? chartPos(last, path[last], run.route[last].length) : chartPos(0, 0, 1);
    const to = chartPos(run.station, j, opts.length);
    setPanel(null);
    if (fx.reduce || run.station === 0) return arrive(j);
    sfx('cast');
    sail.current = { from, to, t0: performance.now() };
    force((n) => n + 1);
    setTimeout(() => { sail.current = null; arrive(j); }, SAIL_MS);
  };
  const arrive = (j: number) => {
    run.picked = j; saveRun(run);
    if (['fish', 'elite', 'treasure', 'event', 'crew'].includes(opts[j].kind)) { run.notice = undefined; onGo(); return; }
    force((n) => n + 1);
  };
  const chartAnim = (): ChartAnim => {
    const now = performance.now(), sp = sail.current;
    return { reveal: Math.min(1, (now - revealT0.current) / REVEAL_MS), sail: sp ? { from: sp.from, to: sp.to, p: Math.min(1, (now - sp.t0) / SAIL_MS) } : undefined };
  };

  const node = run.picked !== null ? opts[run.picked] : null;
  let action: { text: string; btn: ComponentChildren; fn: () => void; alt?: { btn: string; fn: () => void }; more?: { btn: ComponentChildren; fn: () => void }[] } | null = null;
  const notice = run.notice;
  if (node) {
    const spot = spotName(run, node.spot);
    if (node.kind === 'fish') action = { text: `${spot.name}的釣點。${spot.desc}`, btn: '拋竿出擊', fn: onGo };
    else if (node.kind === 'elite') action = { text: `精英釣點（${spot.name}）。強大的潮靈盤據在這裡，打贏能挑更好的能力卡。`, btn: '挑戰精英', fn: onGo };
    else if (node.kind === 'treasure') action = { text: '寶藏點！海面閃閃發光，這裡只會釣到寶箱。', btn: '拋竿撈寶', fn: onGo };
    else if (node.kind === 'boss') action = { text: `海面暗了下來……${zoneOf(run).name}的霸主就在前方。先整理好隊伍吧。`, btn: '挑戰霸主', fn: onGo };
    else if (node.kind === 'portal' && node.target) {
      const tz = ZONES[node.target];
      const dm = isDomain(node.target) ? DOMAINS[node.target] : null;
      action = { text: `海面裂開了一道發光的縫隙，裡面隱約看得到「${tz.name}」。${tz.desc}${dm ? `裡面有領域效果「${dm.name}」（${dm.short}）。` : ''}打倒守護者可以挑一樣特別的謝禮，之後回到這條航線。要進去嗎？`, btn: '進入', fn: () => { const t = node.target!; enterSpecial(run, t); saveRun(run); if (isDomain(t)) setCut(t); force((n) => n + 1); },
        alt: { btn: '不進入', fn: onNext } };
    }
    else if (node.kind === 'event') action = { text: '海面上好像發生了什麼事……要過去看看嗎？', btn: '前往查看', fn: onGo };
    else if (node.kind === 'shop') action = { text: `漂流商店的老闆揮著手。你有 ${run.shells} 枚貝殼幣。`, btn: '逛商店', fn: () => setPanel('shop') };
    else {
      // 營地三選一：休息、特訓、探索
      const heal = (0.6 + (run.perks?.camp ?? 0)) * campHealMul(run);
      const done = (t: string) => { setRested(t); saveRun(run); force((n) => n + 1); };
      action = rested
        ? { text: rested, btn: '繼續航行', fn: onNext }
        : { text: `找到一座可以紮營的小島。只有時間做一件事：休息（全隊回復 ${Math.round(heal * 100)}% HP、倒下的醒來）、特訓（全隊獲得經驗）、或探索小島（找到道具）。`,
          btn: <><Icon name="fire" /> 休息</>, fn: () => { healParty(run, heal, true); done('夥伴們圍著營火睡了一覺，精神都恢復了。'); },
          more: [
            { btn: <><Icon name="train" /> 特訓</>, fn: () => done(campTrain(run)) },
            { btn: <><Icon name="search" /> 探索</>, fn: () => done(campSearch(run)) },
          ] };
    }
  }
  const hv = opts[hover] ?? opts[0];

  return (<>
    <GameScreen vp={vp}
      scene={<SceneCanvas draw={(c, t) => drawChart(c, t, run.route, run.station, run.picked, run.path, run.seed, zoneOf(run).theme, chartAnim())} label="海圖與航線" />}
      overlay={<>
        <Win class="banner left"><span class="eyebrow">{run.daily ? `每日 · ${run.dailyRule ? dailyRuleInfo(run.dailyRule).name + ' · ' : ''}` : ''}{run.star ? `${'★'.repeat(run.star)} · ` : ''}{zoneOf(run).special ? '特殊區域' : `海域 ${run.zoneNo + 1}`} · {zoneOf(run).name}{isDomain(run.zone) && <span class="voy-domain" style={{ color: DOMAINS[run.zone].color }}> · 領域「{DOMAINS[run.zone].name}」</span>}</span><b>第 {run.station + 1} / {run.route.length} 站 · {node ? NODE_INFO[node.kind].name : '選擇航線'}</b><span class={`tod-chip tod-${timeOfDay(run)}`}><Icon name={timeOfDay(run) === 'night' ? 'moon' : 'sun'} /> {TOD_INFO[timeOfDay(run)].name}</span></Win>
        <Win class="banner right"><span class="res"><Icon name="shell" /> {run.shells}</span><span class="res">捕捉餌 {run.catchBait}</span></Win>
        {run.picked === null && !panel && timeOfDay(run) !== 'day' && <Tip id={`tod-${timeOfDay(run)}`}>{TOD_INFO[timeOfDay(run)].name}：{TOD_INFO[timeOfDay(run)].desc}</Tip>}
        {run.picked === null && !panel && <Tip id="voyage">點海圖上的圖示選擇航線。釣點會遇到野生潮靈，精英更強，掛旗子的船隊會連續派出好幾隻。右上角可以看隊伍和背包。</Tip>}
        <div class="voy-tools">
          <button class={`tool-btn ${panel === 'party' ? 'on' : ''}`} onClick={() => setPanel(panel === 'party' ? null : 'party')}><Icon name="party" /> 隊伍</button>
          <button class={`tool-btn ${panel === 'items' ? 'on' : ''}`} onClick={() => setPanel(panel === 'items' ? null : 'items')}><Icon name="bag" /> 背包</button>
          <button class="tool-btn" onClick={onQuit}><Icon name="save" /> 存檔</button>
        </div>
        {run.picked === null && opts.map((o, j) => {
          const [x, y] = chartPos(run.station, j, opts.length);
          return <button key={j} class="hit" aria-label={NODE_INFO[o.kind].name} onMouseEnter={() => setHover(j)} onClick={() => choose(j)}
            style={{ left: `${((x - 10) / 256) * 100}%`, top: `${((y - 18) / 144) * 100}%`, width: `${(20 / 256) * 100}%`, height: `${(20 / 144) * 100}%` }} />;
        })}
      </>}
      onPanelClose={panel && panel !== 'shop' ? () => setPanel(null) : undefined}
      panel={panel && (
        <Win class="big-panel" title={panel === 'party' ? `隊伍 ${run.party.length}/6` : panel === 'shop' ? `漂流商店　貝殼幣 ${run.shells}` : '背包'} onClose={panel === 'shop' ? onNext : () => setPanel(null)} closeLabel={panel === 'shop' ? '離開商店' : '關閉'}>
          {panel === 'party' && <PartyList run={run} onChange={() => force((n) => n + 1)} />}
          {panel === 'items' && <ItemList run={run} onChange={() => { saveRun(run); force((n) => n + 1); }} />}
          {panel === 'shop' && <ShopList run={run} onChange={() => { saveRun(run); force((n) => n + 1); }} />}
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
              {node && action ? <><MenuItem onClick={() => { run.notice = undefined; action!.fn(); }} hot>{action.btn}</MenuItem>{action.alt && <MenuItem onClick={action.alt.fn}>{action.alt.btn}</MenuItem>}{action.more?.map((m, i) => <MenuItem key={i} onClick={m.fn}>{m.btn}</MenuItem>)}</>
                : opts.map((o, j) => <MenuItem key={j} hot={j === hover} onHover={() => setHover(j)} onClick={() => choose(j)}>{NODE_INFO[o.kind].name}{o.kind === 'fish' || o.kind === 'elite' ? `・${spotName(run, o.spot).name}` : ''}</MenuItem>)}

            </div>
          </Win>
        </div>
      } />
    {cut && <ZoneCutscene zone={cut} mode="enter" onDone={() => setCut(null)} />}
  </>
  );
}

const SHOP_ICON: Record<string, string> = { bait: 'bait', star: 'starlure', legend: 'legendlure', potion: 'potion', superpotion: 'elixir', revive: 'revive', lifestone: 'lifestone' };
/** 買完之後背包裡有幾個 */
function shopOwned(run: RunState, id: string): number {
  if (id === 'bait') return run.catchBait;
  if (id === 'star' || id === 'legend') return run.lures[id];
  if (id === 'lifestone') return run.lifeStones ?? 0;
  return (run.items as Record<string, number>)[id] ?? 0;
}

function ShopList({ run, onChange }: { run: RunState; onChange: () => void }) {
  const stock = shopHeld(run);
  const [buyNote, showBuy] = useBuyToast();
  return (
    <div class="item-list">
      {buyNote}
      <h3 class="sub-h">攜帶道具</h3>
      {stock.map((h) => { const price = heldPrice(run, h); return (
        <button class="pick shop-row" key={h} disabled={run.shells < price} onClick={() => { if (buyHeld(run, h)) { sfx('coin'); showBuy({ name: HELD[h].name, icon: HELD[h].icon, cost: price, cur: 'shell', left: run.shells, note: '已放進背包，可以在隊伍畫面裝上' }); } onChange(); }}>
          <span class="grow"><b><Icon name={HELD[h].icon} /> {HELD[h].name}</b><span class="small dim">{HELD[h].desc}</span></span>
          <span class="num"><Icon name="shell" /> {price}</span>
        </button>
      ); })}
      {!stock.length && <p class="small dim">攜帶道具賣完了。</p>}
      <button class="chip-btn" disabled={run.shells < refreshCost(run)} onClick={() => { const c = refreshCost(run); if (refreshShop(run)) { sfx('coin'); showBuy({ name: '換了一批攜帶道具', icon: 'refresh', cost: c, cur: 'shell', left: run.shells }); } onChange(); }}><Icon name="refresh" /> 換一批（<Icon name="shell" /> {refreshCost(run)}）</button>
      <h3 class="sub-h">補給</h3>
      {SHOP.map((it) => (
        <button class="pick shop-row" key={it.id} disabled={run.shells < priceOf(run, it)} onClick={() => { const c = priceOf(run, it); if (run.shells < c) return; run.shells -= c; it.buy(run); sfx('coin'); showBuy({ name: it.name, icon: SHOP_ICON[it.id], cost: c, cur: 'shell', left: run.shells, note: `已放進背包，現在有 ${shopOwned(run, it.id)} 個` }); onChange(); }}>
          <span class="grow"><b>{it.name}</b><span class="small dim">{it.desc}</span></span>
          <span class="num"><Icon name="shell" /> {priceOf(run, it)}</span>
        </button>
      ))}
    </div>
  );
}

/** 屬性共鳴的說明（隊伍同屬性 3 隻以上） */
export function ResoLine({ run }: { run: RunState }) {
  const r = Object.entries(resonance(run.party.map((m) => formOf(m).elems))) as [Elem, number][];
  const count = (e: Elem) => run.party.filter((m) => formOf(m).elems.includes(e)).length;
  if (!r.length) return <p class="small dim">屬性共鳴：隊伍有 3 隻同屬性時，該屬性的技能 +15%（4 隻 +25%）。</p>;
  return <p class="small reso">{r.map(([e, b]) => <span key={e} class="reso-tag" style={{ borderColor: ELEM[e].color }}>{ELEM[e].name} ×{count(e)}：{ELEM[e].name}技能 +{Math.round(b * 100)}%</span>)}</p>;
}

function HeldRow({ run, m, onChange }: { run: RunState; m: Mon; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const bag = [...new Set(run.heldBag ?? [])] as HeldId[];
  return (
    <div class="held-row">
      <span class="small">攜帶：{m.held ? <b><Icon name={HELD[m.held].icon} /> {HELD[m.held].name}</b> : <span class="dim">（無）</span>}{m.held && <span class="dim">　{HELD[m.held].desc}</span>}</span>
      {(bag.length > 0 || m.held) && <button class="chip-btn" onClick={() => setOpen(!open)}>{open ? '收起' : m.held ? '更換' : '裝上'}</button>}
      {open && (
        <div class="held-pick">
          {bag.map((h) => <button class="chip-btn" key={h} onClick={() => { equipHeld(run, m, h); setOpen(false); onChange(); }}><Icon name={HELD[h].icon} /> {HELD[h].name}<span class="dim">・{HELD[h].desc}</span></button>)}
          {m.held && <button class="chip-btn danger" onClick={() => { equipHeld(run, m, null); setOpen(false); onChange(); }}>卸下</button>}
        </div>
      )}
    </div>
  );
}

function PartyList({ run, onChange }: { run: RunState; onChange: () => void }) {
  return (<>
    <ResoLine run={run} />
    {(run.heldBag?.length ?? 0) > 0 && <Tip id="held" inline>拿到攜帶道具了！在夥伴卡片的「攜帶」那一行按「裝上」，戰鬥中會自動生效。</Tip>}
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
              <HeldRow run={run} m={m} onChange={onChange} />
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
  </>);
}

const BAG_USABLE: ItemId[] = ['potion', 'superpotion', 'revive'];

type BagTab = 'heal' | 'fish' | 'held' | 'boon';
interface BagEntry { key: string; icon: string; name: string; count: number | string; desc: string; use?: ItemId }
const BOON_ICON: Record<string, string> = { 戰鬥: 'attack', 捕捉: 'rod', 釣魚: 'starlure', 養成: 'train', 回復: 'heal' };
const ITEM_ICON: Record<ItemId, string> = { potion: 'potion', superpotion: 'elixir', revive: 'revive', ether: 'ether' };

/** 背包：分類分頁＋圖示格子，點一格在旁邊看說明（不用往下捲） */
function ItemList({ run, onChange }: { run: RunState; onChange: () => void }) {
  const [tab, setTab] = useState<BagTab>('heal');
  const [sel, setSel] = useState<string | null>(null);
  const [using, setUsing] = useState<ItemId | null>(null);
  const [last, setLast] = useState<{ uid: string; text: string; from: number; to: number; max: number; n: number } | null>(null);
  const heldCount = (run.heldBag ?? []).reduce<Record<string, number>>((a, h) => { a[h] = (a[h] ?? 0) + 1; return a; }, {});
  const lists: Record<BagTab, BagEntry[]> = {
    heal: [
      ...(['potion', 'superpotion', 'revive', 'ether'] as ItemId[]).map((id) => ({ key: id, icon: ITEM_ICON[id], name: ITEMS[id].name, count: run.items[id] ?? 0, desc: ITEMS[id].desc + (id === 'ether' ? '（只能在戰鬥中用）' : ''), use: BAG_USABLE.includes(id) ? id : undefined })),
      { key: 'lifestone', icon: 'lifestone', name: '生命石', count: run.lifeStones ?? 0, desc: '戰鬥中全隊倒下時，可以讓全隊以 50% HP 復活，再選擇繼續戰鬥或逃跑。' },
    ],
    fish: [
      { key: 'bait', icon: 'bait', name: '捕捉餌', count: run.catchBait, desc: '收服夥伴時消耗 1 個。' },
      { key: 'star', icon: 'starlure', name: '星光餌', count: run.lures.star, desc: LURES.star.desc },
      { key: 'legend', icon: 'legendlure', name: '傳說餌', count: run.lures.legend, desc: LURES.legend.desc },
      { key: 'shells', icon: 'shell', name: '貝殼幣', count: run.shells, desc: '在漂流商店使用。' },
    ],
    held: Object.entries(heldCount).map(([h, n]) => ({ key: h, icon: HELD[h as HeldId].icon, name: HELD[h as HeldId].name, count: n, desc: `${HELD[h as HeldId].desc}　到「隊伍」畫面就能讓夥伴裝上。` })),
    boon: Object.entries(run.boons).filter(([, n]) => n > 0).map(([id, n]) => ({ key: id, icon: BOON_ICON[BOONS[id].cat] ?? 'sparkle', name: BOONS[id].name, count: `${n} 層`, desc: BOONS[id].desc })),
  };
  const TABS: [BagTab, string, string][] = [['heal', '回復', 'heal'], ['fish', '魚餌與錢', 'bait'], ['held', '攜帶道具', 'scope'], ['boon', '能力', 'sparkle']];
  const list = lists[tab];
  const cur = list.find((e) => e.key === sel) ?? list[0] ?? null;
  const use = (item: ItemId, i: number) => {
    const m = run.party[i], from = Math.max(0, m.hp);
    const text = applyItemOutside(run, item, i);
    if (!text) return;
    setLast({ uid: m.uid, text, from, to: m.hp, max: maxHp(m), n: (last?.n ?? 0) + 1 });
    onChange();
  };

  if (using) return (
    <div class="bag">
      <button class="chip-btn back-chip" onClick={() => { setUsing(null); setLast(null); }}>← 返回背包</button>
      {last && (
        <div class="use-result" key={last.n}>
          <b><Icon name="heal" /> {last.text}</b>
          <span class="num">HP {last.from} → {last.to}/{last.max}</span>
        </div>
      )}
      <p class="small">要對誰使用 <b>{ITEMS[using].name}</b>？（剩 {run.items[using]} 個）</p>
      <div class="pick-grid">
        {run.party.map((m, i) => (
          <button class={`pick ${last?.uid === m.uid ? 'just-used' : ''}`} key={m.uid + (last?.uid === m.uid ? last.n : '')} disabled={!run.items[using] || !canUseOutside(m, using)}
            onClick={() => use(using, i)}>
            <Sprite form={m.form} size={48} mutant={m.mutant} />
            <span class="grow">
              <span class="row-gap"><b>{formOf(m).name}</b><span class="num">Lv{m.lv}</span></span>
              <Bar value={m.hp} max={maxHp(m)} />
              <span class="small dim">{Math.max(0, m.hp)}/{maxHp(m)}{m.hp <= 0 ? ' · 倒下' : m.status ? ` · ${statusLabel(m.status)}` : ''}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div class="bag">
      <div class="tabs bag-tabs">
        {TABS.map(([k, label, icon]) => <button key={k} class={`tab ${tab === k ? 'on' : ''}`} onClick={() => { setTab(k); setSel(null); }}><Icon name={icon} /> {label}</button>)}
      </div>
      <div class="bag-body">
        <div class="bag-grid">
          {list.length ? list.map((e) => (
            <button key={e.key} class={`bag-cell ${cur?.key === e.key ? 'on' : ''} ${e.count === 0 ? 'empty' : ''}`} onClick={() => setSel(e.key)}>
              <Icon name={e.icon} size="1.9em" />
              <span class="bag-name">{e.name}</span>
              <span class="bag-count num">{typeof e.count === 'number' ? `×${e.count}` : e.count}</span>
            </button>
          )) : <p class="small dim">{tab === 'held' ? '還沒有攜帶道具。寶箱、精英、船隊、營地、商店都有機會拿到。' : '還沒有能力。每場戰鬥勝利後可以挑選一張能力卡。'}</p>}
        </div>
        {cur && (
          <div class="bag-detail">
            <div class="row-gap"><Icon name={cur.icon} size="2.4em" /><b class="big-name">{cur.name}</b><span class="num">{typeof cur.count === 'number' ? `×${cur.count}` : cur.count}</span></div>
            <p class="small">{cur.desc}</p>
            {cur.use && <MenuItem hot disabled={!run.items[cur.use] || !run.party.some((m) => canUseOutside(m, cur.use!))} onClick={() => { setLast(null); setUsing(cur.use!); }}>使用</MenuItem>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 圖鑑 ──
export function Dex({ vp, onBack }: { vp: Viewport; onBack: () => void }) {
  const dex = loadDex();
  const all = Object.values(FORMS).filter((f) => !f.secret).sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
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
      onPanelClose={onBack} outsideClose={false}
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
      onPanelClose={onBack} outsideClose={false}
      panel={
        <Win class="big-panel help" title="玩法說明" onClose={onBack} closeLabel="返回標題">
          <h3>一場遭遇</h3>
          <ol>
            <li><b>拋竿</b>：對準海面的漣漪，力量條停在目標區（黃色），紅色是完美落點：對手開場 HP 減少、比較好捕捉，稀有度也可能提升。</li>
            <li><b>等待咬鉤</b>：浮標下沉、出現「！」時立刻點擊。太早點會把魚嚇跑。</li>
            <li><b>回合制戰鬥</b>：每回合 +1 能量（上限 5），強力技能需要較多能量。</li>
            <li><b>對手的下一步</b>：對手 HP 條下面會顯示牠這回合要做的事（<Icon name="attack" /> 攻擊、<Icon name="hinder" /> 妨礙、<Icon name="buff" /> 強化、<Icon name="heal" /> 回復）；標著 ‼ 代表對你目前的夥伴效果絕佳，可以考慮換人。霸主 HP 掉到一半時會狂暴（攻擊 +1、防禦 −1）。</li>
            <li><b>收線捕捉</b>：對手 HP 越低、身上有異常狀態，捕捉區就越寬。失敗的話對手會獲得一次攻擊機會。</li>
          </ol>
          <h3>航線</h3>
          <p class="small">釣點、精英釣點、寶藏點、神秘事件、漂流商店、營地，還有 <b>馴潮船隊</b>：2–3 隻對手輪番上陣、不能收服，但經驗、貝殼幣更多，還一定會留下攜帶道具。營地只能做一件事：休息、特訓或探索。商店可以花貝殼幣換一批攜帶道具。</p>
          <h3>攜帶道具與屬性共鳴</h3>
          <p class="small">每隻夥伴可以帶一個攜帶道具（鯊齒、硬殼片、吸血珊瑚、不屈珍珠……），從寶箱、精英、船隊、營地、商店和事件取得，在隊伍畫面裝上或更換。隊伍裡同屬性的夥伴有 3 隻時，該屬性的技能威力 +15%，4 隻以上 +25%。</p>
          <h3>潮汐卵</h3>
          <p class="small">打倒霸主（20%）、神秘區域的守護者（35%），或開到黃金寶箱（很少見）時，有機會拿到那片海域的<b>潮汐卵</b>。冒險結束後蛋會放進棲息灣的巢（最多 3 顆），每出海一局前進一格，時間到就能孵化。孵化有 25% 機率失敗，可以花珍珠<b>暖蛋</b>降低失敗率（每次 −8%，最多 3 次）。孵出來的夥伴一定帶一招平常學不到的<b>遺傳技</b>，異變的機率也比較高。</p>
          <h3>能力卡的流派</h3>
          <p class="small">有些能力卡屬於某個<b>流派</b>（灼燒流、護盾流、連擊流、捕捉流、共鳴流），同流派的卡會互相加乘，越收越強。偶爾還會出現粉紅色的<b>傳說能力卡</b>，效果非常強大，但一局只能拿一張；打贏精英和船隊之後比較容易出現。</p>
          <h3>潮位與每日挑戰</h3>
          <p class="small">通關後可以解鎖更高的<b>潮位</b>（★1～★5），對手更強、物價更高，但結算珍珠每顆星 +20%。<b>每日挑戰</b>每天一個固定的航線與夥伴，還有一條每天輪換的「今日特殊規則」（例如永夜之海、玻璃大砲、異色之日），珍珠只有當天第一次結算時拿得到。</p>
          <h3>技能數量</h3>
          <p>每隻夥伴都有 4 個技能槽，技能要升級才學得到。第 1 格固定是<b>普攻</b>（不耗能量的攻擊），學新技能時不能把它忘掉。</p>
          <h3>棲息灣與招募</h3>
          <p class="small">第一次出海時從三隻初始夥伴選一隻，之後所有夥伴都住在主畫面的「棲息灣」。最上面的「出航夥伴」就是下次要帶出海的夥伴。冒險結束可以帶一隻新夥伴回來（港口的「船艙擴建」可以多帶），沒帶回來的會回到大海、留下少量珍珠；棲息灣裡多的夥伴也可以分解成珍珠。</p>
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
        </Win>
      } />
  );
}

// ── 結算：珍珠＋帶夥伴回棲息灣 ──
export function End({ vp, run, win, pearls, onTitle }: { vp: Viewport; run: RunState; win: boolean; pearls: number; onTitle: () => void }) {
  const [meta, setMeta] = useState(loadMeta);
  const [picked, setPicked] = useState<Mon | null>(null);
  const [kept, setKept] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const all = run.daily ? [] : run.party.filter((m) => !m.bayId);
  const candidates = all.filter((m) => !kept.includes(m.uid));
  const slots = bringBackSlots(meta), left = slots - kept.length;
  const full = meta.bay.length >= bayCap(meta);
  const keep = (m: Mon, replaceId?: string) => { bringBack(meta, m, replaceId); setMeta(loadMeta()); setKept((k) => [...k, m.uid]); setDone(`${formOf(m).name} 住進了棲息灣！下次出海可以帶牠一起走。`); setPicked(null); };
  // 沒帶回去的新夥伴回到大海，留下一些珍珠
  const released = candidates;
  const releasePearls = released.reduce((a, m) => a + releaseValue(m), 0);
  const leave = () => {
    if (releasePearls > 0) { const m = loadMeta(); m.pearls += releasePearls; m.totalPearls += releasePearls; saveMeta(m); }
    onTitle();
  };
  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={win ? drawTitle : drawDeep} />}
      panel={
        <Win class="big-panel end" title={win ? `${zoneOf(run).name}的霸主已被擊敗！` : '航程結束'}>
          <p>{win ? '恭喜通關！帶著收穫回到港口吧。' : '隊伍全部倒下了。回港口整頓一下，再出海一次吧。'}</p>
          {(run.eggs?.length ?? 0) > 0 && <p class="small accent"><Icon name="egg" /> 帶回了 {run.eggs!.length} 顆潮汐卵，已經放進棲息灣的巢（巢滿了的話換成珍珠）。</p>}
          {run.daily && <p class="small accent">每日挑戰（{run.daily}）：今日最佳 {meta.daily?.best ?? 0} 站{pearls === 0 ? '・今天的珍珠已經領過了' : ''}。每日挑戰的夥伴不會帶回棲息灣。</p>}
          {!run.daily && (run.star ?? 0) > 0 && <p class="small accent">潮位 {'★'.repeat(run.star ?? 0)}：珍珠 +{(run.star ?? 0) * 20}%{win && (meta.maxStar ?? 0) > (run.star ?? 0) ? `・解鎖了 ★${meta.maxStar}！` : ''}</p>}
          <div class="end-stats">
            <span>抵達</span><b class="num">{zoneOf(run).name} 第 {run.station + 1} 站（共 {totalStation(run)} 站）</b>
            <span>勝利</span><b class="num">{run.battlesWon} 場</b>
            <span>收服</span><b class="num">{run.caught} 隻</b>
            <span>獲得珍珠</span><b class="num accent">◆ {pearls}（共 {meta.pearls}）</b>
          </div>
          {done && <p class="accent">{done}</p>}
          {left > 0 && candidates.length > 0 && <>
            <h3 class="sub-h">要帶誰回棲息灣？還可以帶 {left} 隻（棲息灣 {meta.bay.length}/{bayCap(meta)}）</h3>
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
          {releasePearls > 0 && <p class="small dim">沒有帶回去的 {released.length} 隻夥伴會回到大海，留下 ◆ {releasePearls} 顆珍珠。{slots < 3 ? '（港口的「船艙擴建」可以多帶幾隻）' : ''}</p>}
          <MenuItem onClick={leave} hot>回到港口</MenuItem>
        </Win>
      } />
  );
}

// ── 隨機事件 ──
/** 事件前後比較：算出得到／失去了什麼，用圖示標出來 */
type Snap = { shells: number; bait: number; star: number; legend: number; items: Record<string, number>; life: number; held: number; uids: string[]; hp: number; lv: number; boons: number };
const sumOld = (r: RunState, uids: string[], f: (m: RunState['party'][number]) => number) => r.party.filter((m) => uids.includes(m.uid)).reduce((a, m) => a + f(m), 0);
const snap = (r: RunState): Snap => ({ shells: r.shells, bait: r.catchBait, star: r.lures.star, legend: r.lures.legend, items: { ...r.items }, life: r.lifeStones ?? 0, held: r.heldBag?.length ?? 0,
  uids: r.party.map((m) => m.uid), hp: r.party.reduce((a, m) => a + Math.max(0, m.hp), 0), lv: r.party.reduce((a, m) => a + m.lv, 0), boons: Object.values(r.boons ?? {}).reduce((a, b) => a + b, 0) });
type Chip = { icon: string; text: string; good: boolean; form?: string };
function diffChips(a: Snap, r: RunState): Chip[] {
  const b = snap(r), out: Chip[] = [];
  const n = (icon: string, name: string, d: number) => { if (d) out.push({ icon, text: `${name} ${d > 0 ? '+' : ''}${d}`, good: d > 0 }); };
  n('shell', '貝殼幣', b.shells - a.shells); n('bait', '捕捉餌', b.bait - a.bait); n('starlure', '星光餌', b.star - a.star); n('legendlure', '傳說餌', b.legend - a.legend);
  const IN: Record<string, [string, string]> = { potion: ['potion', '海藻藥膏'], superpotion: ['elixir', '珍珠精華'], revive: ['revive', '復甦貝'], ether: ['ether', '能量海膽'] };
  for (const [k, [ic, nm]] of Object.entries(IN)) n(ic, nm, (b.items[k] ?? 0) - (a.items[k] ?? 0));
  n('lifestone', '生命石', b.life - a.life);
  for (const h of (r.heldBag ?? []).slice(a.held)) out.push({ icon: HELD[h].icon, text: HELD[h].name, good: true });
  for (const m of r.party.filter((m) => !a.uids.includes(m.uid))) out.push({ icon: 'party', text: `${formOf(m).name} 加入`, good: true, form: m.form });
  n('heart', 'HP', sumOld(r, a.uids, (m) => Math.max(0, m.hp)) - a.hp); n('train', '等級', sumOld(r, a.uids, (m) => m.lv) - a.lv);
  if (b.boons > a.boons) out.push({ icon: 'sparkle', text: '新能力', good: true });
  if (r.eventFight) out.push({ icon: 'attack', text: '戰鬥！', good: false });
  return out;
}

export function EventScreen({ vp, run, ev, onDone }: { vp: Viewport; run: RunState; ev: GameEvent; onDone: () => void }) {
  const [result, setResult] = useState<{ text: string; chips: Chip[] } | null>(null);
  const art = EVENT_ART[ev.id] ?? 'boat';
  const pick = (o: GameEvent['options'][number]) => {
    const before = snap(run);
    const text = o.act(run); saveRun(run);
    const chips = diffChips(before, run);
    sfx(chips.some((c) => c.good) ? 'coin' : chips.length ? 'debuff' : 'select');
    setResult({ text, chips });
  };
  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={(c, t) => { drawSea(c, t, zoneOf(run).theme); drawEventArt(c, t, art); }} label={ev.title} />}
      panel={
        <Win class="big-panel event" title={ev.title}>
          <p>{ev.text}</p>
          {result ? <>
            <p class="accent">{result.text}</p>
            {result.chips.length > 0 && <div class="ev-chips">{result.chips.map((c, i) => (
              <span key={i} class={`ev-chip ${c.good ? 'good' : 'bad'}`} style={{ animationDelay: `${i * 0.08}s` }}>{c.form ? <Sprite form={c.form} size={24} still /> : <Icon name={c.icon} />}{c.text}</span>
            ))}</div>}
            <MenuItem onClick={onDone} hot>{run.eventFight ? <><Icon name="attack" /> 開始戰鬥</> : '繼續航行'}</MenuItem>
          </> : ev.options.map((o, i) => {
            const ok = o.can ? o.can(run) : true;
            return <MenuItem key={i} disabled={!ok} onClick={() => pick(o)} sub={o.hint}>{o.label}</MenuItem>;
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
