// 戰後處理：收服入隊、經驗與升級、學習技能、進化
import { useEffect, useRef, useState } from 'preact/hooks';
import { next } from '../game/rng';
import { FORMS } from '../data/creatures';
import { SKILLS } from '../data/skills';
import { RARITY, STAGE_NAME } from '../data/types';
import { evolve, evolveTarget, formOf, gainXp, maxHp, skillSlots, xpReward, xpToNext, type Mon } from '../game/creature';
import { FINAL_ZONE, saveRun, applyBoon, giveHeld, boon, isBoss, markCaught, updateDex, nodeOf, PARTY_MAX, rollBoons, ZONES, type RunState, type ZoneId } from '../game/run';
import { BOON_TIER, BOONS } from '../data/boons';
import { HELD } from '../data/held';
import { EVO_W, playEvolution } from '../render/evo';
import type { BattleResult } from './Battle';
import { AbilityLines, Bar, Elems, IvStars, EnvHint, RarityTag, SkillLine, Sprite, StageTag, StyleMeter } from './components';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';
import { MenuItem } from './Screens';
import { sfx } from '../audio/engine';
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
  // 戰鬥勝利或收服後：三選一能力卡（霸主戰後直接結算，不抽卡）
  const [boonOpts] = useState<string[] | null>(() => (result.outcome !== 'fled' && !isBoss(run) ? rollBoons(run, nodeOf(run).kind === 'elite' || !!result.team) : null));
  const [boonDone, setBoonDone] = useState(false);

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
      if (enemy.mutant) updateDex((d) => { d.mutants = (d.mutants ?? 0) + 1; });
      run.caught++;
      if (run.party.length < PARTY_MAX) { run.party.push(enemy); out.push({ uid: enemy.uid, text: `${formOf(enemy).name} 加入了隊伍！` }); }
      else q.push({ k: 'full', mon: enemy });
    }
    if (result.outcome === 'win' || result.outcome === 'caught') {
      run.battlesWon++;
      // 船隊：每一隻都算經驗（稍微打折），貝殼幣加倍
      const foes = result.team ?? [enemy];
      const reward = Math.floor(foes.reduce((a, f) => a + xpReward(f), 0) * (foes.length > 1 ? 0.75 : 1) * (result.outcome === 'caught' ? 0.7 : 1) * (1 + boon(run, 'xp') * 0.3));
      const coins = Math.floor(foes.reduce((a, f) => a + 8 + f.lv * 2, 0) * (nodeOf(run).kind === 'elite' ? 2 : 1));
      run.shells += coins;
      out.push({ uid: '_coins', text: `獲得 ${coins} 枚貝殼幣（共 ${run.shells}）` });
      // 霸主：額外獎勵（貝殼幣、攜帶道具）
      const bossWin = isBoss(run) && result.outcome === 'win';
      if (bossWin) {
        const bonus = 60 + run.zoneNo * 40;
        run.shells += bonus;
        out.push({ uid: '_coins', text: `霸主的寶藏：${bonus} 枚貝殼幣！（共 ${run.shells}）` });
        const h = giveHeld(run); out.push({ uid: '_held', text: `霸主守護的攜帶道具「${HELD[h].icon} ${HELD[h].name}」！` });
      }
      if (!bossWin && (result.team || (nodeOf(run).kind === 'elite' && next(run.rng) < 0.5))) { const h = giveHeld(run); out.push({ uid: '_held', text: `${result.team ? "船隊留下" : "菁英掉落"}了攜帶道具「${HELD[h].icon} ${HELD[h].name}」！` }); }
      for (const m of run.party) {
        if (m.hp <= 0 || m === enemy) continue;
        const bondMul = 1 + Math.min(10, m.bond ?? 0) * 0.05; // 羈絆經驗加成
        const share = Math.floor((result.participants.includes(m.uid) ? reward : reward / 2) * bondMul);
        const r = gainXp(m, share, run.zone);
        out.push({ uid: m.uid, text: `${formOf(m).name} 獲得 ${share} 經驗值${r.levels ? `，升到了 Lv${m.lv}！` : ''}` });
        // 先進化（技能上限會增加），再處理新技能
        if (r.evolveTo) q.push({ k: 'evolve', uid: m.uid, to: r.evolveTo });
        for (const sk of r.learnable) q.push({ k: 'learn', uid: m.uid, skill: sk });
      }
    }
    // 立刻存檔：結算到一半關掉 App，重開後也不會弄丟這場戰鬥的結果
    run.after = { boons: boonOpts ?? undefined, bossWin: isBoss(run) && result.outcome === 'win' ? enemy.form : undefined };
    saveRun(run);
    setLines(out);
    setTasks(q);
    // 結算音效：貝殼幣、升級
    if (out.some((l) => l.uid === '_coins')) sfx('coin');
    if (out.some((l) => l.text.includes('升到了'))) setTimeout(() => sfx('levelup'), 350);
  }, []);

  const find = (uid: string) => run.party.find((m) => m.uid === uid);
  const shift = (extra: Task[] = []) => { saveRun(run); setTasks((t) => [...extra, ...(t ?? []).slice(1)]); };
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

  const bossWin = isBoss(run) && result.outcome === 'win';
  const title = bossWin ? '霸主討伐成功！' : result.outcome === 'caught' ? '收服成功！' : result.outcome === 'win' ? '戰鬥勝利' : '順利脫身';
  const doneLabel = !bossWin ? '繼續航行' : run.returnTo ? '回到原本的航線' : run.zoneNo < FINAL_ZONE ? '前往下一片海域' : '凱旋回港';

  const evolving = cur?.k === 'evolve';
  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={(c, t) => (evolving ? drawDeep(c, t) : drawSea(c, t, 'day'))} />}
      panel={
        <Win class={`big-panel after ${evolving ? 'evolving' : ''}`} title={evolving ? '進化' : title}>
          {cur?.k === 'evolve' ? (
            <EvolveScene mon={find(cur.uid)!} to={cur.to}
              onDone={(learn) => {
                const m = find(cur.uid)!;
                updateDex((d) => { d.evolved = [...new Set([...(d.evolved ?? []), cur.to])]; });
                const branch = Object.values(FORMS).flatMap((f) => f.evolve ?? []).find((e) => e.to === cur.to && (e.style || e.zone));
                const why = branch?.zone ? `（受到${ZONES[branch.zone as ZoneId]?.name ?? ''}的環境影響）` : branch?.style ? `（依戰鬥風格走向${branch.style === 'guard' ? '守護型' : '攻擊型'}）` : '';
                note(m.uid, `進化成了 ${formOf(m).name}！${why}`);
                const extra: Task[] = learn.map((sk) => ({ k: 'learn', uid: m.uid, skill: sk }));
                const nextEvo = evolveTarget(m, run.zone);
                if (nextEvo) extra.push({ k: 'evolve', uid: m.uid, to: nextEvo });
                shift(extra);
              }} />
          ) : <>
            {bossWin && <p class="accent boss-calm">{ZONES[run.zone]?.name}的潮水平靜了下來。夥伴們都成長了不少！</p>}
            {caughtMon.current && <CaughtCard mon={caughtMon.current} />}
            <div class="after-list">
              {run.party.map((m) => (
                <div class="after-row" key={m.uid}>
                  <Sprite form={m.form} size={48} mutant={m.mutant} />
                  <div class="grow">
                    <span class="row-gap"><b>{formOf(m).name}</b><span class="num">Lv{m.lv}</span></span>
                    <Bar value={m.xp} max={xpToNext(m.lv)} kind="xp" />
                    <StyleMeter mon={m} /><EnvHint mon={m} />
                    {lines.filter((l) => l.uid === m.uid).map((l, i) => <p class="small" key={i}>{l.text}</p>)}
                  </div>
                </div>
              ))}
              {result.outcome === 'fled' && <p class="dim">沒有獲得經驗值。</p>}
              {lines.filter((l) => l.uid === '_coins' || l.uid === '_held' || l.uid === '_boon').map((l, i) => <p class="small accent" key={'c' + i}>{l.text}</p>)}
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
            {!cur && boonOpts && !boonDone && <BoonPick ids={boonOpts} onPick={(id) => { note('_boon', applyBoon(run, id)); if (run.after) run.after.boons = undefined; saveRun(run); setBoonDone(true); }} />}
            {!cur && (!boonOpts || boonDone) && <MenuItem onClick={onDone} hot>{doneLabel}</MenuItem>}
          </>}
        </Win>
      } />
  );
}

function CaughtCard({ mon }: { mon: Mon }) {
  const f = formOf(mon);
  return (
    <div class="caught-card" style={{ '--rar': RARITY[f.rarity].color }}>
      <Sprite form={mon.form} size={144} mutant={mon.mutant} />
      <div class="grow">
        <div class="row-gap"><b class="big-name">{f.name}</b><RarityTag r={f.rarity} /><StageTag form={mon.form} />{mon.mutant && <span class="mutant-tag">✦ 異變</span>}</div>
        <div class="row-gap"><Elems list={f.elems} /><span class="muted">{f.category} · Lv{mon.lv}</span></div>
        <div class="row-gap"><span class="small">個體評價</span><IvStars iv={mon.iv} detail /></div>
        <AbilityLines form={f.id} />
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
      <p><b>{f.name}</b> 想學習 <b class="accent">{SKILLS[skill].name}</b>，但技能槽已經滿了（{skillSlots(mon)} 招）。</p>
      <p class="small muted">新技能：{SKILLS[skill].desc}（{SKILLS[skill].power ? `威力 ${SKILLS[skill].power}` : '變化'} · 能量 {SKILLS[skill].cost}）</p>
      <p class="small">要忘記哪一招？</p>
      <div class="grid2">
        {mon.skills.map((s, i) => <MenuItem key={s} disabled={i === 0} onClick={() => onPick(i)} sub={i === 0 ? '普攻' : undefined}><SkillLine id={s} /></MenuItem>)}
        <MenuItem onClick={() => onPick(null)}>放棄學習 {SKILLS[skill].name}</MenuItem>
      </div>
    </div>
  );
}

function EvolveScene({ mon, to, onDone }: { mon: Mon; to: string; onDone: (learn: string[]) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'ask' | 'play' | 'done'>('ask');
  const [label, setLabel] = useState(formOf(mon).name);
  const [from] = useState(mon.form); // 進化前的型態（進化後 mon.form 會改變）
  const learned = useRef<string[]>([]);
  useEffect(() => {
    if (phase !== 'play') return;
    sfx('buff'); setTimeout(() => sfx('reveal'), 3000);
    return playEvolution(ref.current!, from, to, () => {
      learned.current = evolve(mon, to);
      setPhase('done');
    }, (p) => { if (p === 'reveal') setLabel(FORMS[to].name); }, mon.mutant);
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
        <p>恭喜！{FORMS[from].name} 進化成了 <b class="accent">{FORMS[to].name}</b>（{STAGE_NAME[FORMS[to].stage]}）！</p>
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

function BoonPick({ ids, onPick }: { ids: string[]; onPick: (id: string) => void }) {
  return (
    <div class="boon-pick">
      <p class="win-title">選一張能力卡</p>
      <div class="boon-row">
        {ids.map((id) => {
          const b = BOONS[id], tier = BOON_TIER[b.tier];
          return (
            <button class="boon-card" key={id} style={{ '--tier': tier.color }} onClick={() => onPick(id)}>
              <span class="boon-tier">{tier.name} · {b.cat}</span>
              <b class="boon-name">{b.name}</b>
              <span class="small">{b.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 結算到一半關掉 App：重開後先把沒選的能力卡選完 */
export function ResumeBoon({ vp, run, onDone }: { vp: Viewport; run: RunState; onDone: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={(c, t) => drawSea(c, t, 'day')} />}
      panel={
        <Win class="big-panel after" title="戰鬥勝利">
          <p class="small dim">上次的戰鬥還沒選能力卡。</p>
          {msg ? <><p class="small accent">{msg}</p><MenuItem onClick={onDone} hot>繼續航行</MenuItem></>
            : <BoonPick ids={run.after?.boons ?? []} onPick={(id) => { setMsg(applyBoon(run, id)); if (run.after) run.after.boons = undefined; saveRun(run); }} />}
        </Win>
      } />
  );
}
