// 戰後處理：收服入隊、經驗與升級、學習技能、進化
import { useEffect, useRef, useState } from 'preact/hooks';
import { next } from '../game/rng';
import { FORMS } from '../data/creatures';
import { SKILLS } from '../data/skills';
import { RARITY, STAGE_NAME } from '../data/types';
import { evolve, evolveTarget, formOf, gainXp, maxHp, recruitCaughtMon, skillSlots, xpReward, xpToNext, type Mon } from '../game/creature';
import { EGG_DROP, EGG_INFO } from '../game/eggs';
import { eggZoneOf, FINAL_ZONE, saveRun, applyBoon, giveHeld, boon, isBoss, loadDex, recordBattleCatch, recordBattleEvolutions, todayKey, nodeOf, PARTY_MAX, rollBoons, ZONES, type AfterTask, type BattleReview, type RunState, type ZoneId } from '../game/run';
import { BOON_STYLE, BOON_TIER, BOONS } from '../data/boons';
import { HELD } from '../data/held';
import { EVO_W, playEvolution } from '../render/evo';
import { ensureSprite } from '../render/art';
import type { BattleResult } from './Battle';
import { AbilityLines, Bar, Elems, IvStars, RarityTag, SkillLine, Sprite, StageTag } from './components';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';
import { MenuItem } from './Screens';
import { sfx } from '../audio/engine';
import { drawDeep, drawSea } from '../render/scene';

type Step = BattleReview['step'];

export function AfterBattle({ vp, run, result, onDone }: { vp: Viewport; run: RunState; result?: BattleResult; onDone: () => boolean }) {
  const [review, setReview] = useState(run.after?.review);
  const [saveFailed, setSaveFailed] = useState(false);
  const [finishFailed, setFinishFailed] = useState(false);

  const saveReview = (next: BattleReview) => {
    run.after!.review = next;
    setReview({ ...next });
    if (!saveRun(run)) { setSaveFailed(true); return; }
    const caught = next.caught;
    if (caught && !recordBattleCatch(caught.mon, run.zone, caught.recordedAt)) { setSaveFailed(true); return; }
    if (next.evolved?.length && !recordBattleEvolutions(next.evolved, run.zone)) { setSaveFailed(true); return; }
    setSaveFailed(false);
  };

  useEffect(() => {
    if (run.after?.review) { saveReview(run.after.review); return; }
    if (!result) return;
    const out: BattleReview['lines'] = [], q: AfterTask[] = [];
    let caught: BattleReview['caught'];
    // 只在首次結算抽能力卡，續玩時沿用存檔。
    const boons = result.outcome !== 'fled' && !isBoss(run) ? rollBoons(run, nodeOf(run).kind === 'elite' || !!result.team) : undefined;
    const enemy = result.enemy;
    if (result.outcome === 'caught') {
      const mon = recruitCaughtMon(enemy);
      caught = { mon, first: !loadDex().caught.includes(enemy.form), recordedAt: todayKey() };
      run.caught++;
      if (boon(run, 'x_thrift') && next(run.rng) < 0.5) { run.catchBait++; out.push({ uid: '_bait', text: '回收網：捕捉餌拿回來了！' }); }
      if (boon(run, 'x_hunter')) out.push({ uid: '_hunter', text: `獵人之心：全隊攻擊 +${run.caught * 4}%` });
      if (run.party.length < PARTY_MAX) { run.party.push(mon); out.push({ uid: mon.uid, text: `${formOf(mon).name} 加入了隊伍！` }); }
      else q.push({ k: 'full', mon });
    }
    if (result.outcome === 'win' || result.outcome === 'caught') {
      run.battlesWon++;
      // 船隊：每一隻都算經驗（稍微打折），貝殼幣加倍
      const foes = result.team ?? [enemy];
      const reward = Math.floor(foes.reduce((a, f) => a + xpReward(f), 0) * (foes.length > 1 ? 0.75 : 1) * (result.outcome === 'caught' ? 0.7 : 1) * (1 + boon(run, 'xp') * 0.3) * (run.dailyRule?.id === 'strong' ? 1.5 : 1));
      const coins = Math.floor(foes.reduce((a, f) => a + 8 + f.lv * 2, 0) * (nodeOf(run).kind === 'elite' ? 2 : 1)) + (boon(run, 'L_midas') ? 25 : 0);
      run.shells += coins;
      out.push({ uid: '_coins', text: `獲得 ${coins} 枚貝殼幣（共 ${run.shells}）` });
      // 霸主：額外獎勵（貝殼幣、攜帶道具）
      const bossWin = isBoss(run) && result.outcome === 'win';
      if (bossWin) {
        const bonus = 60 + run.zoneNo * 40;
        run.shells += bonus;
        out.push({ uid: '_coins', text: `霸主的寶藏：${bonus} 枚貝殼幣！（共 ${run.shells}）` });
        const h = giveHeld(run); out.push({ uid: '_held', text: `霸主守護的攜帶道具「${HELD[h].name}」！` });
        if (next(run.rng) < EGG_DROP.boss) { (run.eggs ??= []).push(eggZoneOf(run)); out.push({ uid: '_egg', text: `霸主的巢裡留下了一顆「${EGG_INFO[eggZoneOf(run)].name}」！冒險結束後會送回棲息灣。` }); }
      }
      if (!bossWin && (result.team || (nodeOf(run).kind === 'elite' && next(run.rng) < 0.5))) { const h = giveHeld(run); out.push({ uid: '_held', text: `${result.team ? "船隊留下" : "菁英掉落"}了攜帶道具「${HELD[h].name}」！` }); }
      for (const m of run.party) {
        if (m.hp <= 0 || m === caught?.mon) continue;
        const bondMul = 1 + Math.min(10, m.bond ?? 0) * 0.05; // 羈絆經驗加成
        const share = Math.floor((result.participants.includes(m.uid) ? reward : reward / 2) * bondMul);
        const r = gainXp(m, share, run.zone);
        out.push({ uid: m.uid, text: `${formOf(m).name} 獲得 ${share} 經驗值${r.levels ? `，升到了 Lv${m.lv}！` : ''}` });
        // 先進化（技能上限會增加），再處理新技能
        if (r.evolveTo) q.push({ k: 'evolve', uid: m.uid, to: r.evolveTo });
        for (const sk of r.learnable) q.push({ k: 'learn', uid: m.uid, skill: sk });
      }
    }
    run.after = { boons, bossWin: isBoss(run) && result.outcome === 'win' ? enemy.form : undefined };
    saveReview({ outcome: result.outcome, step: caught ? 'caught' : 'results', lines: out, tasks: q, caught });
    // 結算音效：貝殼幣、升級
    if (out.some((l) => l.uid === '_coins')) sfx('coin');
    if (out.some((l) => l.text.includes('升到了'))) setTimeout(() => sfx('levelup'), 350);
  }, []);

  const find = (uid: string) => run.party.find(mon => mon.uid === uid);
  const cur = review?.tasks[0];
  const learner = cur?.k === 'learn' ? find(cur.uid) : undefined;
  const needsLearnChoice = learner && cur?.k === 'learn' && !learner.skills.includes(cur.skill) && learner.skills.length >= skillSlots(learner);
  const note = (uid: string, text: string) => { review!.lines.push({ uid, text }); };
  const shift = (extra: AfterTask[] = []) => {
    saveReview({ ...review!, tasks: [...extra, ...review!.tasks.slice(1)] });
  };
  const updateTask = (task: AfterTask) => saveReview({ ...review!, tasks: [task, ...review!.tasks.slice(1)] });
  // 有空位時自動學習，已完成的任務一併存入。
  useEffect(() => {
    if (saveFailed || review?.step !== 'tasks' || cur?.k !== 'learn' || needsLearnChoice) return;
    if (learner && !learner.skills.includes(cur.skill)) {
      learner.skills.push(cur.skill);
      note(learner.uid, `${formOf(learner).name} 學會了 ${SKILLS[cur.skill].name}！`);
    }
    shift();
  }, [review, saveFailed]);

  if (!review) return null;
  if (saveFailed) return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={drawDeep} />} panel={
      <Win class="big-panel after" title="戰後結算">
        <p class="warn-text" role="alert">戰後進度還沒存妥，請再試一次。</p>
        <MenuItem onClick={() => saveReview(review)} hot>重新存檔</MenuItem>
      </Win>
    } />
  );

  const { step, lines, tasks, outcome, caught } = review;
  const boons = run.after!.boons;
  const bossWin = !!run.after!.bossWin;
  const doneLabel = !bossWin ? '繼續航行' : run.returnTo ? '回到原本的航線' : run.zoneNo < FINAL_ZONE ? '前往下一片海域' : '……海面好像不太對勁';

  // 收服、結算、夥伴成長與能力卡都各有續玩位置。
  const nextFrom = (from: Step): Step => {
    if (from === 'caught') return 'results';
    if (from === 'results' && tasks.length) return 'tasks';
    return boons?.length ? 'boon' : 'end';
  };
  const stepNow: Step = step === 'tasks' && !cur ? nextFrom('tasks') : step;
  const evolving = stepNow === 'tasks' && cur?.k === 'evolve';
  const finish = () => { if (!onDone()) setFinishFailed(true); };
  const go = (step: Step) => { if (step === 'end') finish(); else saveReview({ ...review, step }); };
  const boonLine = lines.find((l) => l.uid === '_boon');

  if (finishFailed) return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={drawDeep} />} panel={
      <Win class="big-panel after" title="戰後結算">
        <p class="warn-text" role="alert">航線進度還沒存妥，請再試一次。</p>
        <MenuItem onClick={finish} hot>繼續航行</MenuItem>
      </Win>
    } />
  );

  let body;
  if (stepNow === 'caught' && caught) body = (
    <Win class="big-panel after" title={caught.first ? '首次收服！' : '收服成功！'}>
      <CaughtCard mon={caught.mon} first={caught.first} />
      <MenuItem onClick={() => go(nextFrom('caught'))} hot>下一步</MenuItem>
    </Win>
  );
  else if (stepNow === 'results' || (stepNow === 'caught' && !caught)) body = (
    <Win class="big-panel after" title={bossWin ? '霸主討伐成功！' : outcome === 'fled' ? '順利脫身' : '經驗與升級'}>
      {bossWin && <p class="accent boss-calm">{ZONES[run.zone]?.name}的潮水平靜了下來。夥伴們都成長了不少！</p>}
      <div class="after-list">
        {run.party.map((m) => (
          <div class="after-row" key={m.uid}>
            <Sprite form={m.form} size={48} mutant={m.mutant} />
            <div class="grow">
              <span class="row-gap"><b>{formOf(m).name}</b><span class="num">Lv{m.lv}</span></span>
              <Bar value={m.xp} max={xpToNext(m.lv)} kind="xp" />
              {lines.filter((l) => l.uid === m.uid).map((l, i) => <p class="small" key={i}>{l.text}</p>)}
            </div>
          </div>
        ))}
        {outcome === 'fled' && <p class="dim">沒有獲得經驗值。</p>}
      </div>
      {lines.filter((l) => l.uid === '_coins' || l.uid === '_held').map((l, i) => <p class="small accent" key={'c' + i}>{l.text}</p>)}
      {(() => { const nx = nextFrom('results'); return <MenuItem onClick={() => go(nx)} hot>{nx === 'end' ? doneLabel : nx === 'tasks' ? '下一步：夥伴的成長' : '下一步：選能力卡'}</MenuItem>; })()}
    </Win>
  );
  else if (stepNow === 'tasks' && cur) body = (
    <Win class={`big-panel after ${evolving ? 'evolving' : ''}`} title={cur.k === 'evolve' ? '進化' : cur.k === 'learn' ? '學習新技能' : '隊伍滿了'}>
      {cur.k === 'evolve' && <EvolveScene key={`${cur.uid}-${cur.to}`} mon={find(cur.uid)!} to={cur.to} started={!!cur.started} completed={cur.completed}
        onStart={() => updateTask({ ...cur, started: true })}
        onEvolved={() => {
          const mon = find(cur.uid)!;
          const from = mon.form;
          const learn = evolve(mon, cur.to);
          const evolveTask = { ...cur, completed: { from, learn } };
          saveReview({ ...review, evolved: [...(review.evolved ?? []), cur.to], tasks: [evolveTask, ...tasks.slice(1)] });
        }}
        onDone={() => {
          const mon = find(cur.uid)!;
          const branch = FORMS[cur.completed!.from].evolve?.find(entry => entry.to === cur.to);
          const why = branch?.zone ? `（受到${ZONES[branch.zone as ZoneId]?.name ?? ''}的環境影響）` : branch?.style ? `（依戰鬥風格走向${branch.style === 'guard' ? '守護型' : '攻擊型'}）` : '';
          note(mon.uid, `進化成了 ${formOf(mon).name}！${why}`);
          const extra: AfterTask[] = cur.completed!.learn.map(skill => ({ k: 'learn', uid: mon.uid, skill }));
          const nextEvo = evolveTarget(mon, run.zone);
          if (nextEvo) extra.push({ k: 'evolve', uid: mon.uid, to: nextEvo });
          shift(extra);
        }} />}
      {cur.k === 'learn' && learner && needsLearnChoice && <LearnPrompt key={`${cur.uid}-${cur.skill}`} mon={learner} skill={cur.skill}
        sel={cur.selected ?? null} setSel={(selected) => updateTask({ ...cur, selected: selected ?? undefined })}
        onPick={(forget) => {
          const m = learner;
          if (forget !== null) {
            const old = m.skills[forget]; m.skills[forget] = cur.skill;
            note(m.uid, `${formOf(m).name} 忘記了 ${SKILLS[old].name}，學會了 ${SKILLS[cur.skill].name}！`);
          } else note(m.uid, `${formOf(m).name} 沒有學習 ${SKILLS[cur.skill].name}。`);
          shift();
        }} />}
      {cur.k === 'full' && <FullPrompt run={run} mon={cur.mon} onDone={(text) => { note(cur.mon.uid, text); shift(); }} />}
    </Win>
  );
  else if (stepNow === 'boon' && boons?.length) body = (
    <Win class="big-panel after" title="選一張能力卡">
      <BoonPick run={run} ids={boons} onPick={(id) => {
        if (!run.after?.boons?.includes(id)) return;
        note('_boon', applyBoon(run, id));
        run.after.boons = undefined;
        saveReview({ ...review, step: 'end' });
      }} />
    </Win>
  );
  else body = (
    <Win class="big-panel after" title="準備出發">
      {boonLine && <p class="accent">{boonLine.text}</p>}
      <MenuItem onClick={finish} hot>{doneLabel}</MenuItem>
    </Win>
  );

  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={(c, t) => (evolving ? drawDeep(c, t) : drawSea(c, t, 'day'))} />} panel={body} />
  );
}

function CaughtCard({ mon, first }: { mon: Mon; first: boolean }) {
  const f = formOf(mon);
  return (
    <div class={`caught-card ${first ? 'first-catch' : ''}`} style={{ '--rar': RARITY[f.rarity].color, '--reveal': f.rarity === 'S' || f.rarity === 'SSR' ? '900ms' : '600ms' }}>
      <div class="catch-portrait"><Sprite form={mon.form} size={144} mutant={mon.mutant} /></div>
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

/** 技能的完整資訊：屬性、威力、能量、命中、說明 */
function SkillInfo({ id, tag }: { id: string; tag?: string }) {
  const s = SKILLS[id];
  return (
    <div class="skill-info">
      {tag && <span class="si-tag">{tag}</span>}
      <b>{s.name}</b>
      <span class="si-stats"><Elems list={s.elem ? [s.elem] : []} />{!s.elem && <span class="small dim">無屬性</span>}
        <span class="num small">{s.power ? `威力 ${s.power}` : '變化技'}</span><span class="num small">能量 {s.cost}</span><span class="num small">命中 {s.acc}</span></span>
      <span class="small">{s.desc}</span>
    </div>
  );
}

// 技能槽滿了：先點一招看比較，確認後才真的替換
function LearnPrompt({ mon, skill, sel, setSel, onPick }: {
  mon: Mon; skill: string; sel: number | 'skip' | null;
  setSel: (choice: number | 'skip' | null) => void; onPick: (forget: number | null) => void;
}) {
  const f = formOf(mon);
  const box = useRef<HTMLDivElement>(null);
  // 選好之後把比較框捲進畫面（橫向手機的面板很矮）
  useEffect(() => { if (sel !== null) box.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [sel]);
  return (
    <div class="prompt">
      <div class="learn-head">
        <Sprite form={mon.form} size={72} mutant={mon.mutant} />
        <span class="grow">
          <b>{f.name}</b> 想學習新技能，但技能槽已經滿了（{skillSlots(mon)} 招）。
          <SkillInfo id={skill} tag="新技能" />
        </span>
      </div>
      <p class="small">點一招看看比較，確認後才會替換。（第 1 格的普攻不能忘記）</p>
      <div class="learn-list">
        {mon.skills.map((s, i) => (
          <button key={s} class={`pick learn-old ${sel === i ? 'on' : ''}`} disabled={i === 0} aria-pressed={sel === i} onClick={() => { sfx('select'); setSel(i); }}>
            <SkillLine id={s} />
            <span class="small dim">{i === 0 ? '普攻，不能忘記' : SKILLS[s].desc}</span>
          </button>
        ))}
        <button class={`pick learn-old skip ${sel === 'skip' ? 'on' : ''}`} aria-pressed={sel === 'skip'} onClick={() => { sfx('select'); setSel('skip'); }}>放棄學習 {SKILLS[skill].name}</button>
      </div>
      {typeof sel === 'number' && (
        <div class="learn-compare" ref={box}>
          <SkillInfo id={mon.skills[sel]} tag="忘記" />
          <span class="lc-arrow">→</span>
          <SkillInfo id={skill} tag="學會" />
          <div class="lc-btns">
            <MenuItem onClick={() => onPick(sel)} hot>確定替換</MenuItem>
            <MenuItem onClick={() => setSel(null)}>再想想</MenuItem>
          </div>
        </div>
      )}
      {sel === 'skip' && (
        <div class="learn-compare" ref={box}>
          <span class="grow">確定不學 <b>{SKILLS[skill].name}</b> 嗎？之後就學不到了。</span>
          <div class="lc-btns">
            <MenuItem onClick={() => onPick(null)} hot>確定放棄</MenuItem>
            <MenuItem onClick={() => setSel(null)}>再想想</MenuItem>
          </div>
        </div>
      )}
    </div>
  );
}

function EvolveScene({ mon, to, started, completed, onStart, onEvolved, onDone }: {
  mon: Mon; to: string; started: boolean; completed?: { from: string };
  onStart: () => void; onEvolved: () => void; onDone: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [from] = useState(completed?.from ?? mon.form);
  const [label, setLabel] = useState(FORMS[from].name);
  useEffect(() => {
    if (!started || completed) return;
    let stop: (() => void) | undefined, live = true;
    let reveal: ReturnType<typeof setTimeout> | undefined;
    Promise.all([ensureSprite(FORMS[from].sprite, mon.mutant), ensureSprite(FORMS[to].sprite, mon.mutant)]).then(() => {
      if (!live) return;
      sfx('buff'); reveal = setTimeout(() => sfx('reveal'), 3000);
      stop = playEvolution(ref.current!, from, to, onEvolved,
        (phase) => { if (phase === 'reveal') setLabel(FORMS[to].name); }, mon.mutant);
    });
    return () => { live = false; clearTimeout(reveal); stop?.(); };
  }, [started, completed]);
  return (
    <div class="evo-box">
      {completed ? <Sprite form={to} size={EVO_W} mutant={mon.mutant} /> : <canvas ref={ref} width={EVO_W * 2} height={EVO_W * 2} class="evo-canvas" />}
      <p class="evo-name">{completed ? FORMS[to].name : label}</p>
      {!started && !completed && <>
        <p>咦？{FORMS[from].name} 的樣子……開始發光了！</p>
        <MenuItem onClick={onStart} hot>開始進化</MenuItem>
      </>}
      {started && !completed && <p class="muted">資料重組中……</p>}
      {completed && <>
        <p>恭喜！{FORMS[from].name} 進化成了 <b class="accent">{FORMS[to].name}</b>（{STAGE_NAME[FORMS[to].stage]}）！</p>
        <MenuItem onClick={onDone} hot>太好了！</MenuItem>
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

function BoonPick({ ids, onPick, run }: { ids: string[]; onPick: (id: string) => void; run?: RunState }) {
  const owned = Object.entries(run?.boons ?? {}).filter(([, count]) => count > 0);
  return (
    <div class="boon-pick">
      <div class="boon-row">
        {ids.map((id) => {
          const b = BOONS[id], tier = BOON_TIER[b.tier], st = b.style ? BOON_STYLE[b.style] : null;
          const matches = st ? owned.filter(([key]) => BOONS[key]?.style === b.style) : [];
          return (
            <button class={`boon-card ${b.tier === 'legend' ? 'legend' : ''}`} key={id} style={{ '--tier': tier.color }} onClick={() => onPick(id)}>
              <span class="boon-tier">{tier.name} · {b.cat}{b.tier === 'legend' ? ' · 一局一張' : ''}</span>
              <b class="boon-name">{b.name}</b>
              {st && <span class="boon-style" style={{ color: st.color, borderColor: st.color }}>{st.name}</span>}
              {matches.length > 0 && <span class="small boon-match">
                同流派已有 {matches.map(([key, count]) => `${BOONS[key].name}${count > 1 ? ` ×${count}` : ''}`).join('、')}
              </span>}
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
          <p class="small dim">上次的戰鬥還沒選能力卡，選一張吧。</p>
          {msg ? <><p class="small accent">{msg}</p><MenuItem onClick={onDone} hot>繼續航行</MenuItem></>
            : <BoonPick run={run} ids={run.after?.boons ?? []} onPick={(id) => { setMsg(applyBoon(run, id)); if (run.after) run.after.boons = undefined; saveRun(run); }} />}
        </Win>
      } />
  );
}
