// 戰後處理：收服入隊、經驗與升級、學習技能、進化
import { useEffect, useRef, useState } from 'preact/hooks';
import { ABILITIES, FORMS } from '../data/creatures';
import { SKILLS } from '../data/skills';
import { RARITY, STAGE_NAME } from '../data/types';
import { evolve, evolveTarget, formOf, gainXp, maxHp, skillSlots, xpReward, xpToNext, type Mon } from '../game/creature';
import { markCaught, PARTY_MAX, type RunState } from '../game/run';
import { EVO_W, playEvolution } from '../render/evo';
import type { BattleResult } from './Battle';
import { Bar, Elems, RarityTag, SkillLine, Sprite, StageTag } from './components';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';
import { MenuItem } from './Screens';
import { drawDeep, drawSea } from '../render/scene';

type Task =
  | { k: 'full'; mon: Mon }
  | { k: 'learn'; uid: string; skill: string }
  | { k: 'evolve'; uid: string; to: string };

interface Line { uid: string; text: string }

export function AfterBattle({ vp, run, result, onDone }: { vp: Viewport; run: RunState; result: BattleResult; onDone: () => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const caughtMon = useRef<Mon | null>(null);

  // 只執行一次：結算所有變化，產生待處理事項
  useEffect(() => {
    const out: Line[] = [], q: Task[] = [];
    const enemy = result.enemy;
    if (result.outcome === 'caught') {
      // 收服的個體：恢復正常能力值，並保留目前 HP 比例
      const ratio = enemy.hp / maxHp(enemy);
      enemy.wild = false; enemy.status = null;
      enemy.hp = Math.max(1, Math.round(maxHp(enemy) * ratio));
      caughtMon.current = enemy;
      markCaught(enemy.form);
      run.caught++;
      if (run.party.length < PARTY_MAX) { run.party.push(enemy); out.push({ uid: enemy.uid, text: `${formOf(enemy).name} 加入了隊伍！` }); }
      else q.push({ k: 'full', mon: enemy });
    }
    if (result.outcome === 'win' || result.outcome === 'caught') {
      run.battlesWon++;
      const reward = Math.floor(xpReward(enemy) * (result.outcome === 'caught' ? 0.7 : 1));
      for (const m of run.party) {
        if (m.hp <= 0 || m === enemy) continue;
        const share = result.participants.includes(m.uid) ? reward : Math.floor(reward / 2);
        const r = gainXp(m, share);
        out.push({ uid: m.uid, text: `${formOf(m).name} 獲得 ${share} 經驗值${r.levels ? `，升到了 Lv${m.lv}！` : ''}` });
        // 先進化（技能上限會增加），再處理新技能
        if (r.evolveTo) q.push({ k: 'evolve', uid: m.uid, to: r.evolveTo });
        for (const sk of r.learnable) q.push({ k: 'learn', uid: m.uid, skill: sk });
      }
    }
    setLines(out);
    setTasks(q);
  }, []);

  const find = (uid: string) => run.party.find((m) => m.uid === uid);
  const shift = (extra: Task[] = []) => setTasks((t) => [...extra, ...(t ?? []).slice(1)]);
  const note = (uid: string, text: string) => setLines((l) => [...l, { uid, text }]);
  const cur = tasks?.[0];

  // 不需要玩家選擇的學習（還有空位或已經會了）直接處理
  const autoLearn = cur?.k === 'learn' && (() => {
    const m = find(cur.uid);
    return !m || m.skills.includes(cur.skill) || m.skills.length < skillSlots(m);
  })();
  useEffect(() => {
    if (!cur || cur.k !== 'learn' || !autoLearn) return;
    const m = find(cur.uid);
    if (m && !m.skills.includes(cur.skill)) {
      m.skills.push(cur.skill);
      note(m.uid, `${formOf(m).name} 學會了 ${SKILLS[cur.skill].name}！`);
    }
    shift();
  }, [tasks]);

  if (!tasks) return null;

  const title = result.outcome === 'caught' ? '收服成功！' : result.outcome === 'win' ? '戰鬥勝利' : '順利脫身';

  const evolving = cur?.k === 'evolve';
  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={(c, t) => (evolving ? drawDeep(c, t) : drawSea(c, t, 'day'))} />}
      panel={
        <Win class={`big-panel after ${evolving ? 'evolving' : ''}`} title={evolving ? '進化' : title}>
          {cur?.k === 'evolve' ? (
            <EvolveScene mon={find(cur.uid)!} to={cur.to}
              onDone={(learn) => {
                const m = find(cur.uid)!;
                note(m.uid, `進化成了 ${formOf(m).name}！`);
                const extra: Task[] = learn.map((sk) => ({ k: 'learn', uid: m.uid, skill: sk }));
                const nextEvo = evolveTarget(m);
                if (nextEvo) extra.push({ k: 'evolve', uid: m.uid, to: nextEvo });
                shift(extra);
              }} />
          ) : <>
            {caughtMon.current && <CaughtCard mon={caughtMon.current} />}
            <div class="after-list">
              {run.party.map((m) => (
                <div class="after-row" key={m.uid}>
                  <Sprite form={m.form} size={48} />
                  <div class="grow">
                    <span class="row-gap"><b>{formOf(m).name}</b><span class="num">Lv{m.lv}</span></span>
                    <Bar value={m.xp} max={xpToNext(m.lv)} kind="xp" />
                    {lines.filter((l) => l.uid === m.uid).map((l, i) => <p class="small" key={i}>{l.text}</p>)}
                  </div>
                </div>
              ))}
              {result.outcome === 'fled' && <p class="dim">沒有獲得經驗值。</p>}
            </div>
            {cur?.k === 'learn' && !autoLearn && <LearnPrompt mon={find(cur.uid)!} skill={cur.skill}
              onPick={(forget) => {
                const m = find(cur.uid)!;
                if (forget !== null) {
                  const old = m.skills[forget]; m.skills[forget] = cur.skill;
                  note(m.uid, `${formOf(m).name} 忘記了 ${SKILLS[old].name}，學會了 ${SKILLS[cur.skill].name}！`);
                } else note(m.uid, `${formOf(m).name} 沒有學習 ${SKILLS[cur.skill].name}。`);
                shift();
              }} />}
            {cur?.k === 'full' && <FullPrompt run={run} mon={cur.mon} onDone={(text) => { note(cur.mon.uid, text); shift(); }} />}
            {!cur && <MenuItem onClick={onDone} hot>繼續航行</MenuItem>}
          </>}
        </Win>
      } />
  );
}

function CaughtCard({ mon }: { mon: Mon }) {
  const f = formOf(mon);
  return (
    <div class="caught-card" style={{ '--rar': RARITY[f.rarity].color }}>
      <Sprite form={mon.form} size={144} />
      <div class="grow">
        <div class="row-gap"><b class="big-name">{f.name}</b><RarityTag r={f.rarity} /><StageTag form={mon.form} /></div>
        <div class="row-gap"><Elems list={f.elems} /><span class="muted">{f.category} · Lv{mon.lv}</span></div>
        <p class="small">特性「{ABILITIES[f.ability].name}」：{ABILITIES[f.ability].desc}</p>
        <p class="small muted">{f.desc}</p>
        <div class="skills-col">{mon.skills.map((s) => <SkillLine id={s} key={s} />)}</div>
      </div>
    </div>
  );
}

function LearnPrompt({ mon, skill, onPick }: { mon: Mon; skill: string; onPick: (forget: number | null) => void }) {
  const f = formOf(mon);
  return (
    <div class="prompt">
      <p><b>{f.name}</b> 想學習 <b class="accent">{SKILLS[skill].name}</b>，但{STAGE_NAME[f.stage]}最多只能帶 {skillSlots(mon)} 招。</p>
      <p class="small muted">新技能：{SKILLS[skill].desc}（{SKILLS[skill].power ? `威力 ${SKILLS[skill].power}` : '變化'} · 能量 {SKILLS[skill].cost}）</p>
      <p class="small">要忘記哪一招？</p>
      <div class="grid2">
        {mon.skills.map((s, i) => <MenuItem key={s} onClick={() => onPick(i)}><SkillLine id={s} /></MenuItem>)}
        <MenuItem onClick={() => onPick(null)}>放棄學習 {SKILLS[skill].name}</MenuItem>
      </div>
    </div>
  );
}

function EvolveScene({ mon, to, onDone }: { mon: Mon; to: string; onDone: (learn: string[]) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'ask' | 'play' | 'done'>('ask');
  const [label, setLabel] = useState(formOf(mon).name);
  const from = mon.form;
  const learned = useRef<string[]>([]);
  useEffect(() => {
    if (phase !== 'play') return;
    return playEvolution(ref.current!, from, to, () => {
      learned.current = evolve(mon, to);
      setPhase('done');
    }, (p) => { if (p === 'reveal') setLabel(FORMS[to].name); });
  }, [phase]);
  return (
    <div class="evo-box">
      <canvas ref={ref} width={EVO_W} height={EVO_W} class="evo-canvas" />
      <p class="evo-name">{label}</p>
      {phase === 'ask' && <>
        <p>咦？{formOf(mon).name} 的樣子……開始發光了！</p>
        <MenuItem onClick={() => setPhase('play')} hot>開始進化</MenuItem>
      </>}
      {phase === 'play' && <p class="muted">資料重組中……</p>}
      {phase === 'done' && <>
        <p>恭喜！{FORMS[from].name} 進化成了 <b class="accent">{FORMS[to].name}</b>（{STAGE_NAME[FORMS[to].stage]}）！技能上限變成 {skillSlots(mon)} 招。</p>
        <MenuItem onClick={() => onDone(learned.current)} hot>太好了！</MenuItem>
      </>}
    </div>
  );
}

function FullPrompt({ run, mon, onDone }: { run: RunState; mon: Mon; onDone: (t: string) => void }) {
  return (
    <div class="prompt">
      <p>隊伍已經滿了（{PARTY_MAX} 隻）。要放生哪一隻，讓 {formOf(mon).name} 加入？</p>
      <div class="pick-grid">
        {run.party.map((m, i) => (
          <button class="pick" key={m.uid} onClick={() => { run.party[i] = mon; onDone(`放生了 ${formOf(m).name}，${formOf(mon).name} 加入了隊伍。`); }}>
            <b>{formOf(m).name}</b> <span class="muted">Lv{m.lv}</span><Bar value={m.hp} max={maxHp(m)} />
          </button>
        ))}
        <MenuItem onClick={() => onDone(`把 ${formOf(mon).name} 放回了大海。`)}>放生 {formOf(mon).name}</MenuItem>
      </div>
    </div>
  );
}
