import { useState } from 'preact/hooks';
import { boon, healParty, isBoss, loadRun, markSeen, newRun, rollEncounter, saveRun, updateDex, type Encounter, type RunState } from '../game/run';
import { AfterBattle } from './AfterBattle';
import { Battle, type BattleResult } from './Battle';
import { Fishing } from './Fishing';
import { Dex, End, Help, StarterPick, Title, Voyage } from './Screens';
import { useViewport } from './layout';
import { makeMon } from '../game/creature';
import { FORMS } from '../data/creatures';

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
  | { k: 'end'; win: boolean } | { k: 'dex' } | { k: 'help' };

export function App() {
  const vp = useViewport();
  const [screen, setScreen] = useState<Screen>({ k: 'title' });
  const [run, setRun] = useState<RunState | null>(null);
  const [n, setN] = useState(0); // 換畫面時強制重新掛載
  const go = (s: Screen) => { setScreen(s); setN((x) => x + 1); };
  const boss = !!run && isBoss(run);

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
        onContinue={() => { const r = loadRun(); if (r) { setRun(r); go({ k: 'voyage' }); } }}
        onDex={() => go({ k: 'dex' })} onHelp={() => go({ k: 'help' })} />;
      break;
    case 'starter':
      body = <StarterPick vp={vp} onBack={() => go({ k: 'title' })} onPick={(f) => { const r = newRun(f); markSeen(f); updateDex((d) => { if (!d.caught.includes(f)) d.caught.push(f); }); saveRun(r); setRun(r); go({ k: 'voyage' }); }} />;
      break;
    case 'voyage':
      body = <Voyage vp={vp} run={run!} onGo={() => go({ k: 'fishing' })} onNext={advance} onQuit={() => { saveRun(run); go({ k: 'title' }); }} />;
      break;
    case 'fishing':
      body = <Fishing vp={vp} run={run!} boss={boss} onDone={advance} onHook={(q, sh) => { const enc = devEncounter() ?? rollEncounter(run!, q, sh); markSeen(enc.mon.form); go({ k: 'battle', enc }); }} />;
      break;
    case 'battle':
      body = <Battle vp={vp} run={run!} enc={screen.enc} boss={boss} onEnd={(result) => {
        if (result.outcome === 'lose') {
          updateDex((d) => { d.bestStation = Math.max(d.bestStation, run!.station + 1); });
          saveRun(null);
          go({ k: 'end', win: false });
        } else go({ k: 'after', result });
      }} />;
      break;
    case 'after':
      body = <AfterBattle vp={vp} run={run!} result={screen.result} onDone={() => {
        if (boss && screen.result.outcome === 'win') {
          updateDex((d) => { d.clears++; d.bestStation = Math.max(d.bestStation, run!.station + 1); });
          saveRun(null);
          go({ k: 'end', win: true });
          return;
        }
        healParty(run!, 0.15 + boon(run!, 'breeze') * 0.15);
        advance();
      }} />;
      break;
    case 'end':
      body = <End vp={vp} run={run!} win={screen.win} onTitle={() => { setRun(null); go({ k: 'title' }); }} />;
      break;
    case 'dex':
      body = <Dex vp={vp} onBack={() => go({ k: 'title' })} />;
      break;
    case 'help':
      body = <Help vp={vp} onBack={() => go({ k: 'title' })} />;
      break;
  }
  return <main class="app" key={n}>{body}</main>;
}
