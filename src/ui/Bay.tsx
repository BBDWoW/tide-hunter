import { Icon } from './Icon';
// 棲息灣：所有夥伴住的地方。最上面一格是「出航夥伴」，多的夥伴可以分解成少量珍珠
import { useState } from 'preact/hooks';
import { FORMS } from '../data/creatures';
import { SKILLS } from '../data/skills';
import { RARITY_ORDER } from '../data/types';
import { bayCap, bayStartLevel, dismantle, dismantleValue, loadMeta, saveMeta, selectedBay, type BayMon } from '../game/meta';
import { drawPort } from '../render/scene';
import { Elems, IvStars, RarityTag, Sprite, StageTag } from './components';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';
import { MenuItem } from './Screens';

export function Bay({ vp, onBack, onGacha, hint }: { vp: Viewport; onBack: () => void; onGacha: () => void; hint?: string }) {
  const [meta, setMeta] = useState(loadMeta);
  const [cur, setCur] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState(hint ?? '');
  const refresh = () => setMeta(loadMeta());
  const sel = selectedBay(meta);
  const b = meta.bay.find((x) => x.id === cur) ?? null;
  // 稀有度高的排前面
  const list = [...meta.bay].sort((x, y) => RARITY_ORDER.indexOf(FORMS[y.root].rarity) - RARITY_ORDER.indexOf(FORMS[x.root].rarity) || y.bond - x.bond);

  const choose = (x: BayMon) => { const m = loadMeta(); m.selected = x.id; saveMeta(m); refresh(); setNote(`${FORMS[x.root].name} 會跟你一起出海！`); };
  const scrap = (x: BayMon) => { const v = dismantle(loadMeta(), x.id); refresh(); setCur(null); setConfirm(false); setNote(`${FORMS[x.root].name} 回到了大海，留下 ◆ ${v} 顆珍珠。`); };

  const card = (x: BayMon, big = false) => (
    <span class="grow">
      <span class="row-gap"><b class={big ? 'big-name' : ''}>{x.mutant ? '✦ ' : ''}{FORMS[x.root].name}</b><RarityTag r={FORMS[x.root].rarity} />{big && <StageTag form={x.root} />}{x.iv && <IvStars iv={x.iv} />}</span>
      {big && <Elems list={FORMS[x.root].elems} />}
      <span class="small">出海 Lv{bayStartLevel(x, meta)}・羈絆 <span class="hearts">{Array.from({ length: Math.min(10, x.bond) }, (_, i) => <Icon key={i} name="heart" size="0.9em" />)}</span>{x.bond}</span>
      {big && <span class="small dim">{x.legacy ? `傳承技能「${SKILLS[x.legacy]?.name}」` : '還沒有傳承技能'}{x.evoMemory.length ? '・進化記憶：提早 2 級進化' : ''}{x.form !== x.root ? `・上次的樣子：${FORMS[x.form]?.name}` : ''}</span>}
    </span>
  );

  return (
    <GameScreen vp={vp} scene={<SceneCanvas draw={(c, t) => drawPort(c, t, list.map((x) => ({ id: x.root, mutant: x.mutant })))} label="棲息灣" />}
      panel={
        <Win class="big-panel bay" title={`棲息灣　${meta.bay.length}/${bayCap(meta)}　珍珠 ◆ ${meta.pearls}`} onClose={onBack} closeLabel="返回標題">
          {note && <p class="accent small">{note}</p>}
          <h3 class="sub-h"><Icon name="boat" /> 出航夥伴</h3>
          {sel ? <div class="pick bay-sel"><Sprite form={sel.root} size={96} mutant={sel.mutant} />{card(sel, true)}</div>
            : <p class="small dim">還沒有選擇出航夥伴，從下面挑一隻吧。</p>}
          {b && (
            <div class="bay-detail">
              <div class="pick"><Sprite form={b.root} size={48} mutant={b.mutant} />{card(b, true)}</div>
              <div class="row-gap">
                <button class="chip-btn" disabled={meta.selected === b.id} onClick={() => choose(b)}>{meta.selected === b.id ? '出航中' : '設為出航夥伴'}</button>
                {meta.selected !== b.id && (confirm
                  ? <><button class="chip-btn danger" onClick={() => scrap(b)}>確定分解（◆ {dismantleValue(b)}）</button><button class="chip-btn" onClick={() => setConfirm(false)}>算了</button></>
                  : <button class="chip-btn" onClick={() => setConfirm(true)}>分解（◆ {dismantleValue(b)}）</button>)}
              </div>
            </div>
          )}
          <h3 class="sub-h">所有夥伴</h3>
          {list.length ? (
            <div class="bay-grid">
              {list.map((x) => (
                <button key={x.id} class={`bay-cell ${x.id === meta.selected ? 'on' : ''} ${x.id === cur ? 'cur' : ''}`} onClick={() => { setCur(x.id); setConfirm(false); }} aria-label={FORMS[x.root].name}>
                  <Sprite form={x.root} size={48} mutant={x.mutant} still />
                  <span class="small">{FORMS[x.root].name}</span>
                  {x.id === meta.selected && <span class="bay-flag"><Icon name="boat" /></span>}
                </button>
              ))}
            </div>
          ) : <p class="small dim">棲息灣還是空的。</p>}
          <MenuItem onClick={onGacha} hot><Icon name="rod" /> 前往招募</MenuItem>
        </Win>
      } />
  );
}
