import { HandFilter } from './Icon';
import { useEffect, useState } from 'preact/hooks';
import { dailyPartner, MAX_STAR, pearlMul, todayKey, boon, enterZone, zoneOf, FINAL_ZONE, LANDING_BONUS, leaveSpecial, healParty, isBoss, loadRun, nodeOf, totalStation, markCaught, markSeen, newRun, rollCrew, rollEncounter, saveRun, updateDex, type Encounter, type RunState } from '../game/run';
import { AfterBattle, ResumeBoon } from './AfterBattle';
import { Battle, type BattleResult } from './Battle';
import { Fishing } from './Fishing';
import { Dex, End, EventScreen, Help, Port, StarterPick, Title, Voyage, ZonePick } from './Screens';
import { pickEvent, type GameEvent } from '../game/events';
import { loadMeta, monFromBay, newBayMon, pearlsFor, returnFromRun, saveMeta, selectedBay } from '../game/meta';
import { Bay } from './Bay';
import { Gacha } from './Gacha';
import type { Mon } from '../game/creature';
import { useViewport } from './layout';
import { makeMon, makeMutant } from '../game/creature';
import { next } from '../game/rng';
import { FORMS } from '../data/creatures';
import { APP_VERSION, fetchLatestVersion } from '../game/version';
import { setScene } from '../audio/engine';
import type { SongId } from '../audio/songs';

// 只在這些畫面自動更新（不在冒險途中），重新整理不會打斷遊戲
const SAFE_TO_UPDATE = new Set(['title', 'port', 'dex', 'help', 'bay']);
const CHECK_EVERY = 60_000;

/** 每分鐘檢查一次有沒有新版本（只在正式網站）；回傳新版本號 */
const zoneTheme = (r: RunState) => zoneOf(r).theme;

function useNewVersion(): string | null {
  const [latest, setLatest] = useState<string | null>(null);
  useEffect(() => {
    if (import.meta.env.DEV) return;
    const check = async () => { const v = await fetchLatestVersion(); if (v && v !== APP_VERSION) setLatest(v); };
    check();
    const id = setInterval(check, CHECK_EVERY);
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  return latest;
}

/** 有新版本時：安全的畫面倒數 5 秒後重新整理；冒險途中只顯示提示，等回到主畫面 */
function UpdateToast({ version, safe }: { version: string; safe: boolean }) {
  const [left, setLeft] = useState(5);
  useEffect(() => {
    if (!safe) { setLeft(5); return; }
    if (left <= 0) { location.reload(); return; }
    const id = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(id);
  }, [safe, left]);
  return (
    <div class={`update-toast ${safe ? '' : 'quiet'}`} role="status">
      {safe ? <>有新版本 v{version}，<b>{Math.max(0, left)}</b> 秒後更新…</> : <>新版本 v{version} 已就緒，回到主畫面後會自動更新</>}
    </div>
  );
}

// 開發用：網址加 ?enc=形態id&lv=等級 可指定遭遇（正式版不會生效）
function devEncounter(): Encounter | null {
  if (!import.meta.env.DEV) return null;
  const q = new URLSearchParams(location.search), id = q.get('enc');
  if (!id || !FORMS[id]) return null;
  const mon = makeMon(id, Number(q.get('lv')) || 5, false, true);
  if (q.get('mutant')) makeMutant(mon);
  return { mon, rarity: FORMS[id].rarity };
}

type Screen =
  | { k: 'title' } | { k: 'starter' } | { k: 'voyage' } | { k: 'fishing' }
  | { k: 'battle'; enc: Encounter } | { k: 'after'; result: BattleResult }
  | { k: 'end'; win: boolean; pearls: number } | { k: 'dex' } | { k: 'help' } | { k: 'port' }
  | { k: 'event'; ev: GameEvent } | { k: 'boon' } | { k: 'zonepick' } | { k: 'bay'; hint?: string } | { k: 'gacha'; from: 'bay' | 'port' };

export function App() {
  const vp = useViewport();
  const [screen, setScreen] = useState<Screen>({ k: 'title' });
  const [run, setRun] = useState<RunState | null>(null);
  const [n, setN] = useState(0); // 換畫面時強制重新掛載
  const boss = !!run && isBoss(run);
  const newVersion = useNewVersion();

  // 背景音樂：依畫面與所在海域切換
  useEffect(() => {
    const k = screen.k, theme = run && !['title', 'port', 'dex', 'help', 'starter', 'end'].includes(k) ? zoneTheme(run) : 'sunset';
    const song: SongId = k === 'battle' ? (boss ? 'boss' : 'battle') : k === 'fishing' ? 'fish' : ['voyage', 'event', 'zonepick', 'after'].includes(k) ? 'voyage' : 'bay';
    setScene(song, theme);
  }, [screen.k, run?.zone, boss]);
  const go = (s: Screen) => { setScreen(s); setN((x) => x + 1); };

  // 冒險結束：結算珍珠、讓棲息灣的夥伴回港
  const finishRun = (win: boolean, r: RunState = run!) => {
    const meta = loadMeta();
    let pearls = Math.round(pearlsFor({ station: totalStation(r), battlesWon: r.battlesWon, caught: r.caught, win }) * pearlMul(r.star ?? 0));
    if (r.daily) {
      // 每日挑戰：記錄當天最好的成績，珍珠只有當天第一次結算時拿得到
      const d = meta.daily?.day === r.daily ? meta.daily : { day: r.daily, best: 0, win: false, paid: false };
      d.best = Math.max(d.best, totalStation(r)); d.win ||= win;
      if (d.paid) pearls = 0;
      d.paid = true; meta.daily = d;
    } else if (win && (r.star ?? 0) >= (meta.maxStar ?? 0) && (meta.maxStar ?? 0) < MAX_STAR) meta.maxStar = (r.star ?? 0) + 1;
    meta.pearls += pearls; meta.totalPearls += pearls; meta.runs++;
    saveMeta(meta);
    returnFromRun(meta, r.party);
    updateDex((d) => { d.bestStation = Math.max(d.bestStation, totalStation(r)); if (win) d.clears++; });
    saveRun(null);
    go({ k: 'end', win, pearls });
  };

  const startRun = (mon: Mon, daily?: string) => { const m = loadMeta(); const r = newRun(mon, m, { star: m.star ?? 0, daily }); if (!daily) markCaught(mon.form); saveRun(r); setRun(r); go({ k: 'voyage' }); };
  const onNew = () => {
    const m = loadMeta();
    if (!m.bay.length) { go({ k: 'starter' }); return; }
    const b = selectedBay(m);
    if (!b) { go({ k: 'bay', hint: '先選一隻「出航夥伴」再出海吧！點下面的夥伴，再按「設為出航夥伴」。' }); return; }
    startRun(monFromBay(b));
  };

  const advance = (r: RunState | null = run) => {
    if (!r) return;
    r.path.push(r.picked ?? 0);
    r.station++;
    r.picked = null;
    saveRun(r);
    go({ k: 'voyage' });
  };
  /** 戰鬥結算完、離開這一站（打倒霸主時前往下一片海域或通關） */
  const finishAfter = (r: RunState) => {
    const bossWin = r.after?.bossWin;
    r.after = undefined;
    if (bossWin) {
      updateDex((d) => { d.bosses = [...new Set([...(d.bosses ?? []), bossWin])]; });
      if (r.returnTo) { leaveSpecial(r); saveRun(r); go({ k: 'voyage' }); return; }
      if (r.zoneNo < FINAL_ZONE) { r.pendingZone = true; saveRun(r); go({ k: 'zonepick' }); } else finishRun(true, r);
      return;
    }
    healParty(r, 0.15 + boon(r, 'breeze') * 0.15);
    advance(r);
  };

  let body;
  switch (screen.k) {
    case 'title':
      body = <Title vp={vp} hasSave={!!loadRun()} onNew={onNew} onDaily={() => { const day = todayKey(); startRun(dailyPartner(day), day); }} onBay={() => go({ k: 'bay' })}
        onContinue={() => { const r = loadRun(); if (!r) return; setRun(r); if (r.after?.boons) go({ k: 'boon' }); else if (r.after) finishAfter(r); else go(r.pendingZone ? { k: 'zonepick' } : { k: 'voyage' }); }}
        onDex={() => go({ k: 'dex' })} onHelp={() => go({ k: 'help' })} onPort={() => go({ k: 'port' })} />;
      break;
    case 'starter':
      body = <StarterPick vp={vp} onBack={() => go({ k: 'title' })} onPick={(form) => { const m = loadMeta(); const b = newBayMon(form); m.bay.push(b); m.selected = b.id; saveMeta(m); startRun(monFromBay(b)); }} />;
      break;
    case 'voyage':
      body = <Voyage vp={vp} run={run!} onGo={() => { const k = nodeOf(run!).kind; if (k === 'event') go({ k: 'event', ev: pickEvent(run!) }); else if (k === 'crew') { const enc = rollCrew(run!); enc.team!.forEach((m) => markSeen(m.form)); saveRun(run); go({ k: 'battle', enc }); } else go({ k: 'fishing' }); }} onNext={() => advance()} onQuit={() => { saveRun(run); go({ k: 'title' }); }} />;
      break;
    case 'fishing':
      body = <Fishing vp={vp} run={run!} boss={boss} onDone={advance} onHook={(q, sh, landing) => {
        const enc = devEncounter() ?? rollEncounter(run!, q, sh);
        // 甩竿落點：對手開場 HP 減少（霸主減半）
        const cut = LANDING_BONUS[landing].hpCut * (boss ? 0.5 : 1);
        if (cut > 0) enc.mon.hp = Math.max(1, Math.round(enc.mon.hp * (1 - cut)));
        enc.landing = landing;
        markSeen(enc.mon.form); go({ k: 'battle', enc });
      }} />;
      break;
    case 'battle':
      body = <Battle vp={vp} run={run!} enc={screen.enc} boss={boss} onEnd={(result) => {
        if (result.outcome === 'lose') finishRun(false);
        else go({ k: 'after', result });
      }} />;
      break;
    case 'after':
      body = <AfterBattle vp={vp} run={run!} result={screen.result} onDone={() => finishAfter(run!)} />;
      break;
    case 'boon':
      body = <ResumeBoon vp={vp} run={run!} onDone={() => finishAfter(run!)} />;
      break;
    case 'end':
      body = <End vp={vp} run={run!} win={screen.win} pearls={screen.pearls} onTitle={() => { setRun(null); go({ k: 'port' }); }} />;
      break;
    case 'dex':
      body = <Dex vp={vp} onBack={() => go({ k: 'title' })} />;
      break;
    case 'event':
      body = <EventScreen vp={vp} run={run!} ev={screen.ev} onDone={() => {
        if (run!.party.every((m) => m.hp <= 0)) { finishRun(false); return; }
        // 事件引發的戰鬥：打完（或逃跑）後回到航線
        const f = run!.eventFight;
        if (f) {
          run!.eventFight = undefined; saveRun(run);
          const mon = makeMon(f.form, f.lv, false, true, () => next(run!.rng));
          markSeen(mon.form);
          go({ k: 'battle', enc: { mon, rarity: FORMS[f.form].rarity } });
          return;
        }
        advance();
      }} />;
      break;
    case 'zonepick':
      body = <ZonePick vp={vp} run={run!} onPick={(z) => { enterZone(run!, z); saveRun(run); go({ k: 'voyage' }); }} />;
      break;
    case 'port':
      body = <Port vp={vp} onBack={() => go({ k: 'title' })} onGacha={() => go({ k: 'gacha', from: 'port' })} />;
      break;
    case 'bay':
      body = <Bay vp={vp} hint={screen.hint} onBack={() => go({ k: 'title' })} onGacha={() => go({ k: 'gacha', from: 'bay' })} />;
      break;
    case 'gacha':
      body = <Gacha vp={vp} onBack={() => go(screen.from === 'bay' ? { k: 'bay' } : { k: 'port' })} />;
      break;
    case 'help':
      body = <Help vp={vp} onBack={() => go({ k: 'title' })} />;
      break;
  }
  return <>
    <HandFilter />
    <main class="app" key={n}>{body}</main>
    {newVersion && <UpdateToast version={newVersion} safe={SAFE_TO_UPDATE.has(screen.k)} />}
  </>;
}
