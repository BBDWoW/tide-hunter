import { useEffect, useState } from 'preact/hooks';
import { boon, enterZone, leaveSpecial, healParty, isBoss, loadRun, nodeOf, totalStation, markCaught, markSeen, newRun, rollEncounter, saveRun, updateDex, type Encounter, type RunState } from '../game/run';
import { AfterBattle } from './AfterBattle';
import { Battle, type BattleResult } from './Battle';
import { Fishing } from './Fishing';
import { Dex, End, EventScreen, Help, Port, StarterPick, Title, Voyage, ZonePick } from './Screens';
import { pickEvent, type GameEvent } from '../game/events';
import { loadMeta, pearlsFor, returnFromRun, saveMeta } from '../game/meta';
import { useViewport } from './layout';
import { makeMon } from '../game/creature';
import { FORMS } from '../data/creatures';
import { APP_VERSION, fetchLatestVersion } from '../game/version';

// 只在這些畫面自動更新（不在冒險途中），重新整理不會打斷遊戲
const SAFE_TO_UPDATE = new Set(['title', 'port', 'dex', 'help']);
const CHECK_EVERY = 60_000;

/** 每分鐘檢查一次有沒有新版本（只在正式網站）；回傳新版本號 */
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
  return { mon: makeMon(id, Number(q.get('lv')) || 5, false, true), rarity: FORMS[id].rarity };
}

type Screen =
  | { k: 'title' } | { k: 'starter' } | { k: 'voyage' } | { k: 'fishing' }
  | { k: 'battle'; enc: Encounter } | { k: 'after'; result: BattleResult }
  | { k: 'end'; win: boolean; pearls: number } | { k: 'dex' } | { k: 'help' } | { k: 'port' }
  | { k: 'event'; ev: GameEvent } | { k: 'zonepick' };

export function App() {
  const vp = useViewport();
  const [screen, setScreen] = useState<Screen>({ k: 'title' });
  const [run, setRun] = useState<RunState | null>(null);
  const [n, setN] = useState(0); // 換畫面時強制重新掛載
  const newVersion = useNewVersion();
  const go = (s: Screen) => { setScreen(s); setN((x) => x + 1); };
  const boss = !!run && isBoss(run);

  // 冒險結束：結算珍珠、讓棲息灣的夥伴回港
  const finishRun = (win: boolean) => {
    const r = run!;
    const meta = loadMeta();
    const pearls = pearlsFor({ station: totalStation(r), battlesWon: r.battlesWon, caught: r.caught, win });
    meta.pearls += pearls; meta.totalPearls += pearls; meta.runs++;
    saveMeta(meta);
    returnFromRun(meta, r.party);
    updateDex((d) => { d.bestStation = Math.max(d.bestStation, totalStation(r)); if (win) d.clears++; });
    saveRun(null);
    go({ k: 'end', win, pearls });
  };

  const advance = () => {
    if (!run) return;
    run.path.push(run.picked ?? 0);
    run.station++;
    run.picked = null;
    saveRun(run);
    go({ k: 'voyage' });
  };

  let body;
  switch (screen.k) {
    case 'title':
      body = <Title vp={vp} hasSave={!!loadRun()} onNew={() => go({ k: 'starter' })}
        onContinue={() => { const r = loadRun(); if (r) { setRun(r); go(r.pendingZone ? { k: 'zonepick' } : { k: 'voyage' }); } }}
        onDex={() => go({ k: 'dex' })} onHelp={() => go({ k: 'help' })} onPort={() => go({ k: 'port' })} />;
      break;
    case 'starter':
      body = <StarterPick vp={vp} onBack={() => go({ k: 'title' })} onPick={(m) => { const r = newRun(m, loadMeta()); markCaught(m.form); saveRun(r); setRun(r); go({ k: 'voyage' }); }} />;
      break;
    case 'voyage':
      body = <Voyage vp={vp} run={run!} onGo={() => (nodeOf(run!).kind === 'event' ? go({ k: 'event', ev: pickEvent(run!) }) : go({ k: 'fishing' }))} onNext={advance} onQuit={() => { saveRun(run); go({ k: 'title' }); }} />;
      break;
    case 'fishing':
      body = <Fishing vp={vp} run={run!} boss={boss} onDone={advance} onHook={(q, sh) => { const enc = devEncounter() ?? rollEncounter(run!, q, sh); markSeen(enc.mon.form); go({ k: 'battle', enc }); }} />;
      break;
    case 'battle':
      body = <Battle vp={vp} run={run!} enc={screen.enc} boss={boss} onEnd={(result) => {
        if (result.outcome === 'lose') finishRun(false);
        else go({ k: 'after', result });
      }} />;
      break;
    case 'after':
      body = <AfterBattle vp={vp} run={run!} result={screen.result} onDone={() => {
        if (boss && screen.result.outcome === 'win' && run!.returnTo) { leaveSpecial(run!); saveRun(run); go({ k: 'voyage' }); return; }
        if (boss && screen.result.outcome === 'win') {
          if (run!.zoneNo === 0) { run!.pendingZone = true; saveRun(run); go({ k: 'zonepick' }); } else finishRun(true);
          return;
        }
        healParty(run!, 0.15 + boon(run!, 'breeze') * 0.15);
        advance();
      }} />;
      break;
    case 'end':
      body = <End vp={vp} run={run!} win={screen.win} pearls={screen.pearls} onTitle={() => { setRun(null); go({ k: 'port' }); }} />;
      break;
    case 'dex':
      body = <Dex vp={vp} onBack={() => go({ k: 'title' })} />;
      break;
    case 'event':
      body = <EventScreen vp={vp} run={run!} ev={screen.ev} onDone={() => { if (run!.party.every((m) => m.hp <= 0)) finishRun(false); else advance(); }} />;
      break;
    case 'zonepick':
      body = <ZonePick vp={vp} run={run!} onPick={(z) => { enterZone(run!, z); saveRun(run); go({ k: 'voyage' }); }} />;
      break;
    case 'port':
      body = <Port vp={vp} onBack={() => go({ k: 'title' })} />;
      break;
    case 'help':
      body = <Help vp={vp} onBack={() => go({ k: 'title' })} />;
      break;
  }
  return <>
    <main class="app" key={n}>{body}</main>
    {newVersion && <UpdateToast version={newVersion} safe={SAFE_TO_UPDATE.has(screen.k)} />}
  </>;
}
