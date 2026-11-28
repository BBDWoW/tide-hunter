import { setTimeOfDay } from '../render/scene';
import { OracleQuest, startOracleQuest } from './OracleQuest';
import { Finale } from './Finale';
import { ensureSprite } from '../render/art';
import { GuardianReward, ZoneCutscene } from './Special';
import { GodHandScreen, settleGodHand } from './GodHand';
import { completeSettlement } from '../game/settlement';
import { ChestReveal } from './Treasure';
import type { DomainId } from '../data/domains';
// 開發用：網址加 ?cut=forest-enter 可以直接看過場動畫
const devChest = import.meta.env.DEV ? new URLSearchParams(location.search).get('chest') : null;
const devEv = import.meta.env.DEV ? new URLSearchParams(location.search).get('ev') : null;
const devGH = import.meta.env.DEV && new URLSearchParams(location.search).has('godhand');
const devCut = import.meta.env.DEV ? new URLSearchParams(location.search).get('cut')?.split('-') ?? null : null;
import { HandFilter } from './Icon';
import { useEffect, useState } from 'preact/hooks';
import { NIGHT_STYLE, timeOfDay, GODHAND_CHANCE, rollGodHand, dailyPartner, todayKey, boon, enterZone, zoneOf, FINAL_ZONE, LANDING_BONUS, healParty, isBoss, loadRun, nodeOf, markCaught, markSeen, newRun, rollCrew, rollEncounter, saveRun, updateDex, FINAL_BOSS, makeFinalBoss, type Encounter, type RunState } from '../game/run';
import { AfterBattle, ResumeBoon } from './AfterBattle';
import { Battle, type BattleResult } from './Battle';
import { Fishing } from './Fishing';
import { Dex, End, EventScreen, Help, Port, StarterPick, Title, Voyage, ZonePick } from './Screens';
import { EVENTS, pickEvent, type GameEvent } from '../game/events';
import { loadMeta, monFromBay, newBayMon, saveMeta, selectedBay } from '../game/meta';
import { Bay } from './Bay';
import { Gacha } from './Gacha';
import type { Mon } from '../game/creature';
import { useViewport } from './layout';
import { makeMon, makeMutant, maxHp, newUid } from '../game/creature';
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
      {safe ? <>v{version} 將於 <b>{Math.max(0, left)}</b> 秒後更新</> : <>v{version} 待更新，離開冒險後套用</>}
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
  | { k: 'battle'; enc: Encounter } | { k: 'after'; result?: BattleResult }
  | { k: 'end' } | { k: 'dex' } | { k: 'help' } | { k: 'port' }
  | { k: 'oracle' } | { k: 'event'; ev: GameEvent } | { k: 'boon' } | { k: 'zonepick' } | { k: 'bay'; hint?: string } | { k: 'gacha'; from: 'bay' | 'port' } | { k: 'guardian' } | { k: 'godhand' } | { k: 'finale' };

export function App() {
  const vp = useViewport();
  const [screen, setScreen] = useState<Screen>({ k: 'title' });
  const [run, setRun] = useState<RunState | null>(null);
  const [n, setN] = useState(0); // 換畫面時強制重新掛載
  const boss = !!run && (isBoss(run) || !!run.finale);
  const newVersion = useNewVersion();

  // 背景音樂：依畫面與所在海域切換
  useEffect(() => {
    const k = screen.k, theme = run && !['title', 'port', 'dex', 'help', 'starter', 'end'].includes(k) ? zoneTheme(run) : 'sunset';
    // 時段：冒險中依站數決定；主畫面、港口、圖鑑固定白天
    const inRun = run && !['title', 'port', 'dex', 'help', 'starter', 'end', 'bay', 'gacha', 'zonepick', 'guardian', 'godhand'].includes(k);
    setTimeOfDay(inRun ? timeOfDay(run!) : 'day', run ? NIGHT_STYLE[run.zone] : 'cute');
    const ghFight = k === 'battle' && !!(screen as { enc?: Encounter }).enc?.godhand;
    if (k === 'godhand' || ghFight) { setScene(ghFight ? 'godfight' : 'godhand', 'godhand'); return; }
    if (k === 'finale') { setScene(run?.finale === 'ending' ? 'bay' : 'final', run?.finale === 'ending' ? theme : 'final'); return; }
    // 最終決戰：專屬的決戰曲
    if (k === 'battle' && (screen as { enc?: Encounter }).enc?.final) { setScene('final', 'final'); return; }
    const song: SongId = k === 'battle' ? (boss ? 'boss' : 'battle') : k === 'fishing' ? 'fish' : ['voyage', 'event', 'zonepick', 'after'].includes(k) ? 'voyage' : 'bay';
    setScene(song, theme);
  }, [screen.k, run?.zone, boss, n]);
  const go = (s: Screen) => { setScreen(s); setN((x) => x + 1); };

  const finishRun = (win: boolean, r: RunState = run!) => {
    r.settlement ??= { id: newUid(), win, kept: [] };
    saveRun(r);
    go({ k: 'end' });
  };

  const startRun = (mon: Mon, daily?: string) => { const m = loadMeta(); const r = newRun(mon, m, { star: m.star ?? 0, daily }); if (!daily) markCaught(mon.form); saveRun(r); setRun(r); go({ k: 'voyage' }); };
  const onNew = () => {
    const m = loadMeta();
    if (!m.bay.length) { go({ k: 'starter' }); return; }
    const b = selectedBay(m);
    if (!b) { go({ k: 'bay', hint: '先選一隻「出航夥伴」再出海吧！點下面的夥伴，再按「設為出航夥伴」。' }); return; }
    startRun(monFromBay(b));
  };

  const proceed = (run: RunState, next: RunState, screen: Screen) => {
    if (!saveRun(next)) return false;
    Object.assign(run, next);
    go(screen);
    return true;
  };
  const advance = (r: RunState | null = run, next = r) => {
    if (!r || !next) return false;
    return proceed(r, {
      ...next, event: undefined, eventFight: undefined,
      path: [...next.path, next.picked ?? 0], station: next.station + 1, picked: null,
    }, { k: 'voyage' });
  };
  /** 打倒主海域霸主之後：選下一片海域；最後一片海域打完後進入決戰 */
  const afterBoss = (r: RunState, next = structuredClone(r)) => {
    if (next.zoneNo < FINAL_ZONE) return proceed(r, { ...next, pendingZone: true }, { k: 'zonepick' });
    healParty(next, 0.5, true);
    return proceed(r, { ...next, finale: 'intro' }, { k: 'finale' });
  };
  /** 最終決戰：統領者・潮汐默旭 */
  const finalFight = (r: RunState) => {
    r.finale = 'fight'; saveRun(r);
    updateDex((d) => { d.legend = { wins: 0, ...d.legend, met: true }; });
    go({ k: 'battle', enc: { mon: makeFinalBoss(r), rarity: 'SSR', final: true } });
  };
  /** 陪神之手玩：建立神之手的對手 */
  const godHandFight = (r: RunState) => {
    const gh = r.godHand!, hand = makeMon('godhand', gh.lv, false, false, r.daily ? () => next(r.rng) : undefined);
    hand.skills = ['gh_toss', 'gh_love', 'gh_fire', 'gh_stay', 'gh_pull'];
    hand.hpFixed = 1000 * Math.max(...r.party.map(maxHp)); hand.hp = hand.hpFixed;
    markSeen('godhand', r.zone);
    go({ k: 'battle', enc: { mon: hand, rarity: 'SSR', godhand: true } });
  };
  /** 戰鬥結算完、離開這一站（打倒霸主時前往下一片海域或通關） */
  const finishAfter = (r: RunState) => {
    const bossWin = r.after?.bossWin;
    const draft = structuredClone(r);
    draft.after = undefined;
    if (bossWin) {
      if (!updateDex(d => { d.bosses = [...new Set([...(d.bosses ?? []), bossWin])]; })) return false;
      if (draft.returnTo) return proceed(r, { ...draft, guardianWin: draft.zone }, { k: 'guardian' });
      if (devGH || next(draft.rng) < GODHAND_CHANCE) {
        draft.godHand = rollGodHand(draft, bossWin, zoneOf(draft).bossLv + ((draft.star ?? 0) >= 4 ? 2 : 0));
        return proceed(r, draft, { k: 'godhand' });
      }
      return afterBoss(r, draft);
    }
    if (draft.dailyRule?.id !== 'drought') healParty(draft, 0.15 + boon(draft, 'breeze') * 0.15);
    // 林之恩惠：倒下的夥伴會醒來
    if (boon(draft, 'g_forest')) for (const m of draft.party) if (m.hp <= 0) m.hp = Math.ceil(maxHp(m) * 0.3);
    return advance(r, draft);
  };

  const startEventBattle = (r: RunState) => {
    const draft = structuredClone(r);
    const fight = draft.eventFight!;
    const mon = makeMon(fight.form, fight.lv, false, true, () => next(draft.rng));
    const enc: Encounter = { mon, rarity: FORMS[fight.form].rarity };
    draft.event ??= { id: '' };
    draft.event.encounter = enc;
    draft.eventFight = undefined;
    const saved = proceed(r, draft, { k: 'battle', enc: structuredClone(enc) });
    if (saved) markSeen(mon.form, r.zone);
    return saved;
  };

  const continueRun = () => {
    const saved = loadRun();
    if (!saved) return;
    setRun(saved);
    if (saved.settlement) go({ k: 'end' });
    else if (saved.oracleQuest) go({ k: 'oracle' });
    else if (saved.godHand) {
      if (saved.godHand.stage === 'fight') saved.godHand.stage = 'ask';
      go({ k: 'godhand' });
    } else if (saved.finale === 'intro' || saved.finale === 'fight' || saved.finale === 'ending') {
      if (saved.finale === 'fight') saved.finale = 'intro';
      go({ k: 'finale' });
    } else if (saved.guardianWin) go({ k: 'guardian' });
    else if (saved.after?.review) go({ k: 'after' });
    else if (saved.after?.boons) go({ k: 'boon' });
    else if (saved.after) finishAfter(saved);
    else if (saved.event?.encounter) go({ k: 'battle', enc: structuredClone(saved.event.encounter) });
    else if (saved.event) {
      const event = EVENTS.find(e => e.id === saved.event!.id);
      if (event) go({ k: 'event', ev: event });
      else advance(saved);
    } else if (saved.eventFight) startEventBattle(saved);
    else go(saved.pendingZone ? { k: 'zonepick' } : { k: 'voyage' });
  };

  const visitNode = (r: RunState) => {
    const kind = nodeOf(r).kind;
    if (kind === 'event') {
      if (r.event || r.oracleQuest) return;
      if (devEv === 'oracle' || (!devEv && next(r.rng) < 0.02)) {
        startOracleQuest(r);
        go({ k: 'oracle' });
      } else {
        const event = (devEv && EVENTS.find(e => e.id === devEv)) || pickEvent(r);
        r.event = { id: event.id };
        saveRun(r);
        go({ k: 'event', ev: event });
      }
    } else if (kind === 'crew') {
      const enc = rollCrew(r);
      enc.team!.forEach(mon => markSeen(mon.form, r.zone));
      saveRun(r);
      go({ k: 'battle', enc });
    } else go({ k: 'fishing' });
  };

  let body;
  switch (screen.k) {
    case 'title':
      body = <Title vp={vp} hasSave={!!loadRun()} onNew={onNew} onDaily={() => { const day = todayKey(); startRun(dailyPartner(day), day); }} onBay={() => go({ k: 'bay' })}
        onContinue={continueRun}
        onDex={() => go({ k: 'dex' })} onHelp={() => go({ k: 'help' })} onPort={() => go({ k: 'port' })} />;
      break;
    case 'starter':
      body = <StarterPick vp={vp} onBack={() => go({ k: 'title' })} onPick={(form) => { const m = loadMeta(); const b = newBayMon(form); m.bay.push(b); m.selected = b.id; saveMeta(m); startRun(monFromBay(b)); }} />;
      break;
    case 'voyage':
      body = <Voyage vp={vp} run={run!} onGo={() => visitNode(run!)} onNext={() => advance()} onQuit={() => go({ k: 'title' })} />;
      break;
    case 'fishing':
      body = <Fishing vp={vp} run={run!} boss={boss} onDone={advance} onHook={(q, sh, landing) => {
        const enc = devEncounter() ?? rollEncounter(run!, q, sh);
        // 甩竿落點：對手開場 HP 減少（霸主減半）
        const cut = LANDING_BONUS[landing].hpCut * (boss ? 0.5 : 1);
        if (cut > 0) enc.mon.hp = Math.max(1, Math.round(enc.mon.hp * (1 - cut)));
        enc.landing = landing;
        markSeen(enc.mon.form, run!.zone);
        // 對手的圖可能還在背景下載：最多等 1.5 秒再進戰鬥，免得一開場看不到牠
        Promise.race([ensureSprite(FORMS[enc.mon.form].sprite, enc.mon.mutant), new Promise((r) => setTimeout(r, 1500))]).then(() => go({ k: 'battle', enc }));
      }} />;
      break;
    case 'battle':
      body = <Battle vp={vp} run={run!} enc={screen.enc} boss={(boss || !!screen.enc.final) && !screen.enc.godhand} onEnd={(result) => {
        if (screen.enc.oracle) {
          const r = run!;
          if (result.outcome === 'win') { r.battlesWon++; r.oracleQuest!.stage = 'choice'; saveRun(r); go({ k: 'oracle' }); }
          else if (result.outcome === 'lose') finishRun(false);
          else { r.oracleQuest = undefined; advance(r); }
          return;
        }
        if (screen.enc.godhand) { settleGodHand(run!, result.outcome === 'win'); saveRun(run); go({ k: 'godhand' }); return; }
        if (screen.enc.final) {
          // 打贏：播結局；打輸：三片海域還是算通關，但統領者會等你下次再來
          const r = run!;
          if (result.outcome === 'win') { r.finale = 'ending'; updateDex((d) => { d.bosses = [...new Set([...(d.bosses ?? []), FINAL_BOSS])]; const l = d.legend ?? { met: true, wins: 0 }; d.legend = { ...l, met: true, wins: l.wins + 1, first: l.first ?? todayKey() }; }); saveRun(r); go({ k: 'finale' }); }
          else { r.finale = 'lost'; finishRun(true, r); }
          return;
        }
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
      body = <End vp={vp} run={run!} onTitle={async () => {
        if (!await completeSettlement(run!.settlement!.id)) return false;
        setRun(null);
        go({ k: 'port' });
        return true;
      }} />;
      break;
    case 'dex':
      body = <Dex vp={vp} onBack={() => go({ k: 'title' })} />;
      break;
    case 'event':
      body = <EventScreen vp={vp} run={run!} ev={screen.ev} onDone={() => {
        if (run!.party.every(mon => mon.hp <= 0)) { finishRun(false); return true; }
        return run!.eventFight ? startEventBattle(run!) : advance();
      }} />;
      break;
    case 'oracle':
      body = <OracleQuest vp={vp} run={run!} onChange={() => go({ k: 'oracle' })} onDone={() => { run!.oracleQuest = undefined; advance(); }}
        onFight={() => { const q = run!.oracleQuest!; q.stage = 'fight'; saveRun(run); go({ k: 'battle', enc: { mon: { ...q.mon }, rarity: 'SSR', oracle: true } }); }} />;
      break;
    case 'godhand':
      body = <GodHandScreen vp={vp} run={run!} onFight={() => godHandFight(run!)} onDone={() => afterBoss(run!)} />;
      break;
    case 'finale':
      body = <Finale vp={vp} run={run!} mode={run!.finale === 'ending' ? 'ending' : 'intro'} onDone={() => { const r = run!; if (r.finale === 'ending') { r.finale = 'won'; finishRun(true, r); } else finalFight(r); }} />;
      break;
    case 'guardian':
      body = <GuardianReward vp={vp} run={run!} onDone={() => go({ k: 'voyage' })} />;
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
    {devChest && <div class="frame" style={{ position: 'fixed', inset: 0, zIndex: 100, '--u': `${vp.u}px` }}><ChestReveal loot={{ title: '', text: '', tier: devChest as 'gold', items: [{ icon: 'legendlure', name: '傳說餌 ×1' }, { icon: 'shell', name: '貝殼幣 ×128' }] }} /></div>}
    {devCut && <ZoneCutscene zone={devCut[0] as DomainId} mode={devCut[1] as 'enter' | 'win'} onDone={() => {}} />}
    {newVersion && <UpdateToast version={newVersion} safe={SAFE_TO_UPDATE.has(screen.k)} />}
  </>;
}
