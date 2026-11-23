// 超特殊事件：神之手。打倒霸主後極低機率出現。
// 犧牲兩隻指定稀有度的夥伴 → 神之手把霸主抓給你；拒絕 → 可以選擇陪它玩 20 回合。
import { useState } from 'preact/hooks';
import { sfx } from '../audio/engine';
import { FORMS } from '../data/creatures';
import { RARITY } from '../data/types';
import { formOf, makeMon, maxHp, type Mon } from '../game/creature';
import { loadMeta, newBayMon, saveMeta, claimAchievement } from '../game/meta';
import { godHandMatch, markCaught, PARTY_MAX, saveRun, type RunState } from '../game/run';
import { PAL, drawSprite } from '../render/pixel';
import { drawSea } from '../render/scene';
import { Bar, Sprite } from './components';
import { Icon } from './Icon';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';
import { MenuItem } from './Screens';

/** 天上伸下來的白色手臂 + 手 */
export function drawGodHand(c: CanvasRenderingContext2D, t: number, x: number, handY: number, scale = 1.5, open = 0, hand = true) {
  const size = 64 * scale;
  // 光柱
  const beamH = hand ? handY + size : handY + 8;
  const g = c.createLinearGradient(0, 0, 0, beamH);
  g.addColorStop(0, 'rgba(255,250,220,0.35)'); g.addColorStop(1, 'rgba(255,250,220,0)');
  c.fillStyle = g; c.fillRect(x - size * 0.6, 0, size * 1.2, beamH);
  // 手臂（從畫面最上面接到手腕）
  const armW = Math.round(20 * scale), top = handY + 4 * scale;
  c.fillStyle = '#34385a'; c.fillRect(Math.round(x - armW / 2 - 1), -4, armW + 2, Math.max(0, top + 4));
  c.fillStyle = '#fafaff'; c.fillRect(Math.round(x - armW / 2), -4, armW, Math.max(0, top + 4));
  c.fillStyle = '#dee2f0'; c.fillRect(Math.round(x - armW / 2 + 2), -4, Math.round(3 * scale), Math.max(0, top + 4));
  // 光點
  for (let i = 0; i < 10; i++) { const p = (t * 0.3 + i / 10) % 1; c.fillStyle = `rgba(255,245,200,${1 - p})`; c.fillRect(Math.round(x - size / 2 + ((i * 37) % size)), Math.round(handY + size * 0.4 - p * 40), 1, 1); }
  if (hand) drawSprite(c, 'godhand', PAL.water, x - size / 2, handY, { f: open > 0.5 ? 1 : Math.floor(t * 1.5) % 2, scale });
}

const RAR_ORDER = ['SSR', 'S', 'A', 'B', 'N'];

export function GodHandScreen({ vp, run, onFight, onDone }: { vp: Viewport; run: RunState; onFight: () => void; onDone: () => void }) {
  const gh = run.godHand!;
  const [, force] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const setNote = (t: string) => { gh.text = t; };
  const note = gh.text;
  const bossName = FORMS[gh.boss].name;
  const picked = run.party.filter((m) => sel.includes(m.uid));
  const ok = godHandMatch(gh.need, picked);
  const canEver = (() => {
    // 隊伍裡有沒有符合的組合
    const rs = run.party.map((m) => FORMS[m.form].rarity);
    const [a, b] = gh.need; const i = rs.indexOf(a); if (i < 0) return false;
    return rs.some((r, j) => j !== i && r === b);
  })();
  const setStage = (st: typeof gh.stage) => { gh.stage = st; saveRun(run); force((n) => n + 1); };

  /** 把霸主交給玩家：隊伍有空位就加入，滿了就送回棲息灣 */
  const giveBoss = (): string => {
    const mon = makeMon(gh.boss, gh.lv);
    markCaught(gh.boss); run.caught++;
    if (run.party.length < PARTY_MAX) { run.party.push(mon); return `${bossName}（Lv${mon.lv}）加入了隊伍！`; }
    const meta = loadMeta(); meta.bay.push(newBayMon(gh.boss)); saveMeta(meta);
    return `隊伍已經滿了，${bossName} 先被送回棲息灣。`;
  };
  const sacrifice = () => {
    const meta = loadMeta();
    for (const m of picked) { if (m.bayId) meta.bay = meta.bay.filter((b) => b.id !== m.bayId); }
    saveMeta(meta);
    run.party = run.party.filter((m) => !sel.includes(m.uid));
    sfx('bossdown');
    const got = giveBoss();
    setNote(`${picked.map((m) => formOf(m).name).join(' 和 ')} 被神之手輕輕地帶走了。神之手一把抓住了 ${bossName}，放到你的船上。${got}`);
    setStage('took');
  };

  const scene = (c: CanvasRenderingContext2D, t: number) => {
    drawSea(c, t, 'abyss');
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(-200, 0, 700, 144);
    const X = 198, f = FORMS[gh.boss], took = gh.stage === 'took' || gh.stage === 'won';
    const intro = Math.min(1, t / 1.6);
    // 霸主在海面上；被抓走時往上升
    const lift = took ? Math.min(1, t / 2) * 26 : 0;
    drawSprite(c, f.sprite, PAL[f.pal], X - 32, 72 - lift + Math.sin(t * 2) * 1, { f: Math.floor(t * 2) % 2 });
    const hy = -80 + intro * (took ? 8 - lift + 80 : 14 + 80) + Math.sin(t * 1.2) * 2;
    drawGodHand(c, t, X, hy, 1, took ? 1 : 0);
  };
  let body;
  if (gh.stage === 'offer') body = (
    <>
      <p class="small">天空裂開了一道縫，一隻白色的巨手伸了下來，停在 {bossName} 的上方。</p>
      <p class="gh-say">「……好無聊。給我兩個小傢伙陪我，我就把這隻大的抓給你。」</p>
      <div class="gh-need"><span>需要犧牲：</span>{gh.need.map((r, i) => <span key={i} class="rar-chip" style={{ '--rar': RARITY[r].color }}>{RARITY[r].name}（{r}）</span>)}<span class="small warn-text">被帶走的會<b>永遠離開</b>（棲息灣裡的也是）</span></div>
      <div class="gh-party">
        {[...run.party].sort((a, b) => RAR_ORDER.indexOf(FORMS[a.form].rarity) - RAR_ORDER.indexOf(FORMS[b.form].rarity)).map((m) => {
          const on = sel.includes(m.uid), r = FORMS[m.form].rarity;
          return (
            <button key={m.uid} class={`gh-mon ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setSel(on ? sel.filter((u) => u !== m.uid) : sel.length >= 2 ? [sel[1], m.uid] : [...sel, m.uid])}>
              <Sprite form={m.form} size={32} mutant={m.mutant} still />
              <span class="small">{formOf(m).name}</span>
              <span class="rar-chip small" style={{ '--rar': RARITY[r].color }}>{r}</span>
            </button>
          );
        })}
      </div>
      {!canEver && <p class="small dim">你的隊伍裡沒有符合的組合。</p>}
      <div class="cmd-grid gh-btns">
        <MenuItem onClick={sacrifice} disabled={!ok} hot={ok}>{ok ? `犧牲，換得${bossName}` : '選兩隻符合的'}</MenuItem>
        <MenuItem onClick={() => { sfx('back'); setStage('ask'); }} hot={!canEver}>拒絕</MenuItem>
      </div>
    </>
  );
  else if (gh.stage === 'ask') body = (
    <>
      <p>神之手的手指動了動，好像有點失落。</p>
      <p class="gh-say">「……那，陪我玩一下好不好？只要 20 回合就好。」</p>
      <p class="small dim">神之手的 HP 是你夥伴的 1000 倍，打不倒的。只要撐過 20 回合，就能得到 {bossName}、稱號「神之手認可者」和 ◆ 2000 珍珠。全隊倒下也不會結束冒險。</p>
      <MenuItem onClick={() => { sfx('confirm'); setStage('fight'); onFight(); }} hot><Icon name="attack" /> 陪它玩（戰鬥）</MenuItem>
      <MenuItem onClick={() => { setNote('你搖了搖頭。神之手停了一下，慢慢縮回了雲裡。'); setStage('left'); }}>離開</MenuItem>
    </>
  );
  else body = (
    <>
      <p class="accent">{note}</p>
      <div class="party-strip">{run.party.map((m: Mon) => <div class={`slot ${m.hp <= 0 ? 'ko' : ''}`} key={m.uid}><Sprite form={m.form} size={48} mutant={m.mutant} /><Bar value={Math.max(0, m.hp)} max={maxHp(m)} /><span class="slot-lv">Lv{m.lv}</span></div>)}</div>
      <MenuItem onClick={() => { run.godHand = undefined; saveRun(run); onDone(); }} hot>繼續</MenuItem>
    </>
  );
  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={scene} label="從天上伸下來的白色巨手" />}
      panel={<Win class="big-panel godhand-panel" title="？？？　神之手">{body}</Win>} />
  );
}

/** 戰鬥結束後處理結果（撐過 → 霸主＋稱號＋2000 珍珠；倒下 → 什麼都沒有，但冒險繼續） */
export function settleGodHand(run: RunState, won: boolean): string {
  const gh = run.godHand!;
  if (won) {
    const name = FORMS[gh.boss].name;
    const mon = makeMon(gh.boss, gh.lv); markCaught(gh.boss); run.caught++;
    let got: string;
    if (run.party.length < PARTY_MAX) { run.party.push(mon); got = `${name}（Lv${mon.lv}）加入了隊伍！`; }
    else { const meta = loadMeta(); meta.bay.push(newBayMon(gh.boss)); saveMeta(meta); got = `隊伍已經滿了，${name} 先被送回棲息灣。`; }
    const meta = loadMeta(); meta.godHand = true; saveMeta(meta);
    claimAchievement(meta, 'godhand');
    const m2 = loadMeta(); m2.title = 'godhand'; saveMeta(m2);
    gh.stage = 'won';
    return gh.text = `「謝謝你陪我。」神之手把 ${name} 輕輕放到你的船上。${got} 獲得稱號「神之手認可者」和 ◆ 2000 珍珠！`;
  }
  for (const m of run.party) if (m.hp <= 0) m.hp = 1;
  gh.stage = 'lost';
  return gh.text = '神之手玩夠了，把你們輕輕放回船上，慢慢縮回了雲裡。';
}
