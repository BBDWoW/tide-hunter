import { Icon } from './Icon';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { ABILITIES, abilitiesOf, FORMS, recolorOf } from '../data/creatures';
import { ELEM, RARITY, STAGE_NAME, type Elem, type Rarity } from '../data/types';
import { animFrame, drawSprite, PAL, spriteRes, spriteSize } from '../render/pixel';
import { SKILLS } from '../data/skills';
import { GUARD_THRESHOLD, IV_LABELS, ivStars as ivStarsOf, styleRatio, type Mon } from '../game/creature';

// 所有小圖共用一個動畫時鐘（每 0.09 秒檢查一次，各自依格數換格）
let clock = 0;
const subs = new Set<(t: number) => void>();
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const t0 = performance.now();
  setInterval(() => { clock = (performance.now() - t0) / 1000; subs.forEach((fn) => fn(clock)); }, 90);
}

export function Sprite({ form, size = 96, flip = false, silhouette = false, still = false, mutant = false }: { form: string; size?: number; flip?: boolean; silhouette?: boolean; still?: boolean; mutant?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!, ctx = c.getContext('2d')!, f = FORMS[form];
    // 畫布用圖檔的原始解析度，高解析版的細節才不會被縮掉
    const n = spriteSize(f?.sprite ?? ''), res = spriteRes(f?.sprite ?? ''), k = res / n;
    c.width = res; c.height = res;
    let last = -1;
    const draw = (t: number) => {
      const fr = f ? animFrame(f.sprite, t) : 0;
      if (fr === last) return; last = fr;
      ctx.clearRect(0, 0, res, res);
      if (f) drawSprite(ctx, f.sprite, PAL[f.pal], 0, 0, { f: fr, flip, scale: k, tint: silhouette ? '#1d2a55' : undefined, recolor: recolorOf(form, mutant) });
    };
    draw(clock);
    if (still || silhouette) return;
    subs.add(draw);
    return () => { subs.delete(draw); };
  }, [form, flip, silhouette, still, mutant]);
  return <canvas ref={ref} width={48} height={48} class="sprite" style={{ width: `calc(var(--u, 4px) * ${size / 4})`, height: `calc(var(--u, 4px) * ${size / 4})` }} />;
}

export function ElemChip({ e }: { e: Elem }) {
  return <span class="chip" style={{ background: ELEM[e].color }}>{ELEM[e].name}</span>;
}
export function Elems({ list }: { list: Elem[] }) {
  return <span class="chips">{list.map((e) => <ElemChip e={e} key={e} />)}</span>;
}
export function RarityTag({ r }: { r: Rarity }) {
  return <span class={`rar rar-${r}`} title={RARITY[r].name}>{r}</span>;
}
export function StageTag({ form }: { form: string }) {
  return <span class="stage">{STAGE_NAME[FORMS[form].stage]}</span>;
}

export function Bar({ value, max, kind = 'hp' }: { value: number; max: number; kind?: 'hp' | 'xp' }) {
  const r = Math.max(0, Math.min(1, value / max));
  const cls = kind === 'xp' ? 'xp' : r > 0.5 ? 'good' : r > 0.2 ? 'warn' : 'bad';
  return <div class={`bar bar-${kind}`}><i class={cls} style={{ width: `${r * 100}%` }} /></div>;
}

export function Energy({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span class="energy" aria-label={`能量 ${value}/${max}`}>
      {Array.from({ length: max }, (_, i) => <i class={i < value ? 'on' : ''} key={i} />)}
    </span>
  );
}

export function SkillLine({ id }: { id: string }) {
  const s = SKILLS[id];
  if (!s) return null;
  return (
    <span class="skill-line">
      <i class="dot" style={{ background: s.elem ? ELEM[s.elem].color : '#c8d2e8' }} />
      {s.name}
      <span class="muted"> · {s.power ? `威力 ${s.power}` : '變化'} · 能量 {s.cost}</span>
    </span>
  );
}

export function Panel({ children, class: cls = '' }: { children: ComponentChildren; class?: string }) {
  return <div class={`px ${cls}`}>{children}</div>;
}

// 特性（傳說級可能有多個）
export function AbilityLines({ form, label = true }: { form: string; label?: boolean }) {
  return (
    <>
      {abilitiesOf(FORMS[form]).map((a) => (
        <p class="small" key={a}>{label ? '特性' : ''}「{ABILITIES[a].name}」{ABILITIES[a].desc}</p>
      ))}
    </>
  );
}

/** 個體評價星等；detail 時顯示四項個體值 */
export function IvStars({ iv, detail = false }: { iv?: number[]; detail?: boolean }) {
  const n = ivStarsOf(iv);
  return (
    <span class={`iv-stars s${n}`} title={iv ? IV_LABELS.map((l, i) => `${l} ${iv[i] >= 0 ? '+' : ''}${iv[i]}%`).join('　') : '個體值未知'}>
      {'★'.repeat(n)}<i>{'★'.repeat(5 - n)}</i>
      {detail && iv && <span class="iv-detail">{IV_LABELS.map((l, i) => <span key={l} class={iv[i] > 3 ? 'up' : iv[i] < -3 ? 'down' : ''}>{l}{iv[i] >= 0 ? '+' : ''}{iv[i]}%</span>)}</span>}
    </span>
  );
}

/** 環境進化提示：在特定區域進化會變成地區形態 */
export function EnvHint({ mon }: { mon: Mon }) {
  const evo = FORMS[mon.form].evolve?.filter((e) => e.zone);
  if (!evo?.length) return null;
  return <p class="small env-hint">環境進化：{evo.map((e) => `在${ZONE_NAMES[e.zone!] ?? e.zone}進化會變成「${FORMS[e.to].name}」`).join('；')}</p>;
}
const ZONE_NAMES: Record<string, string> = { shallows: '碧藍淺灘', ice: '冰封峽灣', lava: '熔岩裂谷', forest: '聖林域', void: '無稽區', core: '域核區域' };

/** 分支進化的傾向：只在接下來會分支進化時顯示 */
export function StyleMeter({ mon }: { mon: Mon }) {
  const evo = FORMS[mon.form].evolve;
  if (!evo?.some((e) => e.style)) return null;
  const r = styleRatio(mon), lv = evo[0].level - (mon.evoBonus ?? 0);
  const guard = r >= GUARD_THRESHOLD;
  const name = (st: 'atk' | 'guard') => FORMS[evo.find((e) => e.style === st)!.to].name;
  return (
    <div class="style-meter">
      <span class="small">Lv{lv} 進化傾向：<b class={guard ? 'guard' : 'atk'}>{guard ? `守護型（${name('guard')}）` : `攻擊型（${name('atk')}）`}</b></span>
      <div class="sm-bar"><i style={{ width: `${Math.round(r * 100)}%` }} /><em style={{ left: `${GUARD_THRESHOLD * 100}%` }} /></div>
      <span class="small dim">變化技使用比例 {Math.round(r * 100)}%（達 {GUARD_THRESHOLD * 100}% 走守護型）</span>
    </div>
  );
}

// ── 新手提示：每個提示只出現一次 ──
const TIP_KEY = 'tidehunter.tips.v1';
const seenTips = (): string[] => { try { return JSON.parse(localStorage.getItem(TIP_KEY) || '[]'); } catch { return []; } };
export function Tip({ id, children, inline }: { id: string; children: ComponentChildren; inline?: boolean }) {
  const [show, setShow] = useState(() => !seenTips().includes(id));
  if (!show) return null;
  const close = (e: Event) => {
    e.stopPropagation();
    try { localStorage.setItem(TIP_KEY, JSON.stringify([...seenTips(), id])); } catch { /* 略過 */ }
    setShow(false);
  };
  return <button class={`tip ${inline ? 'inline' : ''}`} onClick={close} onPointerDown={(e) => e.stopPropagation()}><span><Icon name="bulb" /> {children}</span><small>知道了 ✕</small></button>;
}

/** 買東西後的小提示：顯示買了什麼、扣了多少、還剩多少。連續買會一條條疊起來，幾秒後自己消失 */
export interface BuyNote { name: string; icon?: string; cost: number; cur: 'shell' | 'pearl'; left: number; note?: string }
export function useBuyToast() {
  const [list, setList] = useState<(BuyNote & { id: number })[]>([]);
  const show = (n: BuyNote) => {
    const id = Math.random();
    setList((l) => [...l.slice(-2), { ...n, id }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 2600);
  };
  // 畫到 body 最上層，才不會被面板的捲動區域裁掉
  const node = list.length ? createPortal(
    <div class="buy-toasts" role="status" aria-live="polite">
      {list.map((n) => (
        <div class="buy-toast" key={n.id}>
          <span class="bt-ok"><Icon name="bag" /></span>
          <span class="grow"><b>{n.icon && <Icon name={n.icon} />} {n.name}</b>{n.note && <span class="small dim">{n.note}</span>}</span>
          <span class="num cost">−{n.cur === 'shell' ? <Icon name="shell" /> : '◆'} {n.cost}</span>
          <span class="num small dim">剩 {n.left}</span>
        </div>
      ))}
    </div>, document.body,
  ) : null;
  return [node, show] as const;
}
