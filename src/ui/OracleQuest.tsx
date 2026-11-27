import { makeMon, maxHp } from '../game/creature';
import { bringBack, loadMeta } from '../game/meta';
import { int, next } from '../game/rng';
import { markCaught, markSeen, PARTY_MAX, saveRun, zoneOf, type RunState } from '../game/run';
import { drawSea } from '../render/scene';
import { Sprite } from './components';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';
import { MenuItem } from './Screens';

const seals = ['日紋', '水紋', '龜紋'];
const clues = ['一輪初日從殼中升起。', '殼下傳出三聲水滴的回響。', '藍魂伸出四足，在甲片上留下自己的輪廓。'];

export function startOracleQuest(run: RunState) {
  const order = [0, 1, 2];
  for (let i = order.length - 1; i > 0; i--) {
    const j = int(run.rng, 0, i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const lv = Math.max(...run.party.map(m => m.lv));
  const mon = makeMon('oracle', lv, false, false, () => next(run.rng));
  run.oracleQuest = { stage: 'purify', mon, order, answer: int(run.rng, 0, 2) };
  markSeen(mon.form, run.zone);
  saveRun(run);
}

export function answerOracle(run: RunState, seal: number) {
  const quest = run.oracleQuest;
  if (quest?.stage !== 'choice') return;
  if (seal === quest.answer) {
    const mon = quest.mon;
    mon.hp = maxHp(mon); mon.status = null; mon.statusTurns = 0;
    markCaught(mon.form, run.zone); run.caught++;
    if (run.party.length < PARTY_MAX) {
      run.party.push(mon);
      quest.result = '龜魂睜開雙眼。卜潮靈龜踏上甲板，加入了隊伍。';
    } else {
      bringBack(loadMeta(), mon);
      quest.result = '卜潮靈龜認出了你的呼喚。隊伍已滿，牠先游回棲息灣等你。';
    }
  } else {
    for (const mon of run.party) {
      const before = maxHp(mon);
      mon.oracleBlessings = (mon.oracleBlessings ?? 0) + 1;
      if (mon.hp > 0) mon.hp = Math.max(1, Math.round(mon.hp / before * maxHp(mon)));
    }
    quest.result = '靈龜潛回深海，留下護佑。本次航行中，當前全隊防禦增加 20%，最大 HP 增加 10%。';
  }
  quest.stage = 'done'; saveRun(run);
}

export function OracleQuest({ vp, run, onFight, onChange, onDone }: { vp: Viewport; run: RunState; onFight: () => void; onChange: () => void; onDone: () => void }) {
  const q = run.oracleQuest!;
  return <GameScreen vp={vp} scene={<SceneCanvas draw={(c,t) => drawSea(c,t,zoneOf(run).theme)} label="蝕月海面" />}
    panel={<Win class="big-panel event" title="蝕月相・卜潮靈龜">
      <Sprite form="oracle" size={96} />
      {q.stage === 'choice' ? <><p>濁潮已散。{clues[q.answer]}你要輕觸哪一道刻紋？</p>
        {q.order.map(id => <MenuItem key={id} onClick={() => { answerOracle(run,id); onChange(); }}>{seals[id]}</MenuItem>)}</>
      : q.stage === 'done' ? <><p>{q.result}</p><MenuItem hot onClick={onDone}>繼續航行</MenuItem></>
      : <><p>缺月照在龜甲上，一縷濁潮纏住了沉睡的藍魂。以清水洗去殼上的陰影，再以對戰喚醒牠。</p><MenuItem hot onClick={onFight}>淨化龜甲，迎戰靈龜</MenuItem></>}
    </Win>} />;
}
