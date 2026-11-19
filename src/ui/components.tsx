import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { FORMS } from '../data/creatures';
import { ELEM, RARITY, STAGE_NAME, type Elem, type Rarity } from '../data/types';
import { drawSprite, PAL, spriteSize } from '../render/pixel';
import { SKILLS } from '../data/skills';

// 所有小圖共用一個動畫節拍
let frame = 0;
const subs = new Set<(f: number) => void>();
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  setInterval(() => { frame ^= 1; subs.forEach((fn) => fn(frame)); }, 330);
}

export function Sprite({ form, size = 96, flip = false, silhouette = false, still = false }: { form: string; size?: number; flip?: boolean; silhouette?: boolean; still?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!, ctx = c.getContext('2d')!, f = FORMS[form];
    const n = spriteSize(f?.sprite ?? '');
    c.width = n; c.height = n;
    const draw = (fr: number) => {
      ctx.clearRect(0, 0, n, n);
      if (f) drawSprite(ctx, f.sprite, PAL[f.pal], 0, 0, { f: fr, flip, tint: silhouette ? '#1d2a55' : undefined });
    };
    draw(frame);
    if (still || silhouette) return;
    subs.add(draw);
    return () => { subs.delete(draw); };
  }, [form, flip, silhouette, still]);
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
