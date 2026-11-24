// 完整美術打包：所有夥伴（一般／異變色違、每一格動畫）、場景、時段、事件插圖、寶箱、蛋、釣客等，給美術重新設計用
import '../src/data/sprites';
import { FORMS, recolorOf } from '../src/data/creatures';
import { drawSprite, PAL, spriteSize, spriteFrames } from '../src/render/pixel';
import { sceneLayers, drawSea, drawBattleBg, drawTitle, drawPort, drawChart, drawDeep, setTimeOfDay, fisherCanvas, view, type ThemeId } from '../src/render/scene';
import { drawEventArt, EVENT_ART, type EventArt } from '../src/render/eventArt';
import { artReady } from '../src/render/art';
import { paintEgg } from '../src/ui/Egg';
import { drawChest } from '../src/ui/Treasure';
import { EGG_INFO, type EggZone } from '../src/game/eggs';

artReady.then(() => {
  const out: { path: string; data: string }[] = [];
  const png = (c: HTMLCanvasElement) => c.toDataURL('image/png');
  const cv = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!; x.imageSmoothingEnabled = false; return [c, x] as const; };

  // ── 夥伴：每一個形態都輸出（共用圖的地區形態、暫代進化形也各自輸出換色後的樣子） ──
  const list: Record<string, unknown>[] = [];
  const forms = Object.values(FORMS);
  forms.forEach((f) => {
    const n = spriteSize(f.sprite), frames = Math.max(2, spriteFrames(f.sprite));
    for (const mutant of [false, true]) {
      const rc = recolorOf(f.id, mutant);
      const [sheet, sx] = cv(n * frames, n);
      for (let k = 0; k < frames; k++) {
        const [one, ox] = cv(n, n);
        drawSprite(ox, f.sprite, PAL[f.pal], 0, 0, { f: k, recolor: rc });
        sx.drawImage(one, k * n, 0);
        out.push({ path: `frames/${f.id}/${mutant ? 'mutant' : 'normal'}_${String(k + 1).padStart(2, '0')}.png`, data: png(one) });
      }
      out.push({ path: `sheets/${mutant ? 'mutant' : 'normal'}/${f.id}.png`, data: png(sheet) });
    }
    const parent = forms.find((p) => p.evolve?.some((e) => e.to === f.id));
    list.push({
      id: f.id, name: f.name, family: f.family, stage: f.stage, rarity: f.rarity, category: f.category, elems: f.elems.join('+'),
      size: n, frames, sprite_file: f.sprite, shares_art: f.sprite !== f.id, recolor: f.recolor ? JSON.stringify(f.recolor) : '',
      placeholder: !!f.placeholder, secret: !!f.secret, evolves_from: parent?.id ?? '', evolves_to: (f.evolve ?? []).map((e) => `${e.to}@Lv${e.level}${e.style ? `(${e.style})` : ''}${e.zone ? `(${e.zone})` : ''}`).join(' / '),
      scale: f.scale ?? 1, desc: f.desc,
    });
  });

  // ── 場景：原始圖層 ──
  const themes: ThemeId[] = ['day', 'sunset', 'ice', 'lava', 'forest', 'void', 'core', 'cyber', 'abyss'];
  for (const id of themes) out.push({ path: `scenes/layers/bg-${id}.png`, data: png(sceneLayers.backdrop(id)) });
  for (const th of themes.filter((x) => x !== 'sunset')) {
    out.push({ path: `scenes/layers/shoal-${th}.png`, data: png(sceneLayers.shoal(th)) });
    out.push({ path: `scenes/layers/reef-${th}.png`, data: png(sceneLayers.reef(th)) });
  }
  // ── 場景：合成畫面（256×144），每個海域 × 白天／黃昏／夜晚 ──
  const NIGHT: Record<string, 'cute' | 'spooky'> = { abyss: 'spooky', void: 'spooky', cyber: 'spooky' };
  view.bleed = 0;
  for (const th of themes.filter((x) => x !== 'sunset')) for (const tod of ['day', 'dusk', 'night'] as const) {
    setTimeOfDay(tod, NIGHT[th] ?? 'cute');
    const [a, ax] = cv(256, 144); drawSea(ax, 1.3, th); out.push({ path: `scenes/composed/sea_${th}_${tod}.png`, data: png(a) });
    const [b, bx] = cv(256, 144); drawBattleBg(bx, 1.3, th); out.push({ path: `scenes/composed/battle_${th}_${tod}.png`, data: png(b) });
    const route = Array.from({ length: 10 }, (_, i) => (i === 0 || i === 9 ? [{ kind: i ? 'boss' : 'fish' }] : [{ kind: 'fish' }, { kind: 'event' }, { kind: 'treasure' }].slice(0, 2 + (i % 2)))) as never;
    const [c, cx] = cv(256, 144); drawChart(cx, 1.3, route, 4, null, [0, 0, 0, 0], 12345, th); out.push({ path: `scenes/composed/chart_${th}_${tod}.png`, data: png(c) });
  }
  setTimeOfDay('day');
  { const [a, ax] = cv(256, 144); drawTitle(ax, 1.3); out.push({ path: 'scenes/composed/title.png', data: png(a) }); }
  { const [a, ax] = cv(256, 144); drawPort(ax, 1.3, [{ id: 'water1' }, { id: 'fire1', mutant: true }, { id: 'grass1' }]); out.push({ path: 'scenes/composed/port_bay.png', data: png(a) }); }
  { const [a, ax] = cv(256, 144); drawDeep(ax, 1.3); out.push({ path: 'scenes/composed/deep_dex.png', data: png(a) }); }

  // ── 神秘事件插圖（畫在白天海面上） ──
  const arts = [...new Set(Object.values(EVENT_ART))] as EventArt[];
  for (const art of arts) { const [a, ax] = cv(256, 144); drawSea(ax, 1.3, 'day'); drawEventArt(ax, 1.3, art); out.push({ path: `events/${art}.png`, data: png(a) }); }
  // ── 寶箱（每種 6 個時間點：掉落、搖晃、打開） ──
  for (const tier of ['wood', 'silver', 'gold'] as const) for (const [k, t] of [0.2, 0.5, 0.9, 1.3, 1.8, 2.4].entries()) {
    const [a, ax] = cv(96, 80); drawChest(ax, tier, t); out.push({ path: `items/chest_${tier}_${k + 1}.png`, data: png(a) });
  }
  // ── 潮汐卵 ──
  for (const z of Object.keys(EGG_INFO) as EggZone[]) {
    const [a, ax] = cv(24, 30); paintEgg(ax, z, 0); out.push({ path: `items/egg_${z}.png`, data: png(a) });
    const [b, bx] = cv(24, 30); paintEgg(bx, z, 0, 0.8); out.push({ path: `items/egg_${z}_cracked.png`, data: png(b) });
  }
  // ── 釣客 ──
  out.push({ path: 'characters/fisher.png', data: png(fisherCanvas(false)) });
  out.push({ path: 'characters/fisher_blink.png', data: png(fisherCanvas(true)) });

  (window as unknown as Record<string, unknown>).__export = { files: out, list, palettes: PAL };
  document.getElementById('s')!.textContent = `done: ${out.length} files`;
});
