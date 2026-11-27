// 最終大Boss：統領者・潮汐默旭的登場劇情、打倒後的結局劇情
import { ensureSprite } from '../render/art';
import { MOXU_ASCENDED } from '../data/moxu';
import { useEffect, useRef, useState } from 'preact/hooks';
import { sfx } from '../audio/engine';
import { FORMS, recolorOf } from '../data/creatures';
import { FINAL_BOSS, zoneOf, type RunState } from '../game/run';
import { formOf } from '../game/creature';
import { animFrame, drawSprite, PAL, spriteSize } from '../render/pixel';
import { drawSea, drawSunMoonSea, drawTitle, type ThemeId } from '../render/scene';
import { GameScreen, SceneCanvas, Win, type Viewport } from './layout';
import { MenuItem } from './Screens';
import arrivalUrl from '../art/story/arrival.png';
import recognitionUrl from '../art/story/recognition.png';

type Ctx = CanvasRenderingContext2D;
const W = 256, H = 144;
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** 畫統領者：置中、底部對齊 y；dark = 0..1 變成黑色剪影的程度 */
function moxu(c: Ctx, t: number, cx: number, by: number, scale: number, alpha = 1, dark = 0, form = FINAL_BOSS) {
  const f = FORMS[form], n = spriteSize(f.sprite) * scale;
  const x = Math.round(cx - n / 2), y = Math.round(by - n + Math.sin(t * 1.6) * 2);
  const fr = animFrame(f.sprite, t, 0);
  if (dark < 1) drawSprite(c, f.sprite, PAL[f.pal], x, y, { f: fr, flip: true, scale, alpha: alpha * (1 - dark), recolor: recolorOf(form, false) });
  if (dark > 0) drawSprite(c, f.sprite, PAL[f.pal], x, y, { f: fr, flip: true, scale, alpha: alpha * dark, tint: '#04060f' });
}
/** 整個畫面蓋一層顏色 */
function veil(c: Ctx, col: string, a: number) { if (a <= 0) return; c.globalAlpha = a; c.fillStyle = col; c.fillRect(-200, 0, W + 400, H); c.globalAlpha = 1; }
/** 往上飄的光點 */
function motes(c: Ctx, t: number, n: number, col: string, x0 = 0, w = W) {
  for (let i = 0; i < n; i++) {
    const y = H - ((t * (10 + rnd(i) * 14) + rnd(i + 3) * H) % (H + 10));
    c.globalAlpha = 0.35 + 0.5 * rnd(i + 7); c.fillStyle = col;
    c.fillRect(Math.round(x0 + rnd(i + 1) * w + Math.sin(t + i) * 3), Math.round(y), rnd(i + 2) < 0.3 ? 2 : 1, rnd(i + 2) < 0.3 ? 2 : 1);
  }
  c.globalAlpha = 1;
}
/** 從海面升起的水牆 */
function waterWall(c: Ctx, t: number, p: number) {
  const top = 92 - ease(p) * 110;
  for (let x = -200; x < W + 200; x += 4) {
    const wob = Math.sin(x * 0.08 + t * 3) * 3 + Math.sin(x * 0.21 - t * 2) * 2;
    const y = Math.round(top + wob);
    if (y >= 92) continue;
    const g = c.createLinearGradient(0, y, 0, 92);
    g.addColorStop(0, 'rgba(160,235,255,0.95)'); g.addColorStop(0.15, 'rgba(40,120,190,0.85)'); g.addColorStop(1, 'rgba(8,30,70,0.9)');
    c.fillStyle = g; c.fillRect(x, y, 4, 92 - y);
  }
}

/** img：這一頁要疊上的劇情動畫（美術畫的 APNG，播一次） */
interface Page { art: (c: Ctx, t: number, run: RunState) => void; lines: string[]; speaker?: string; sound?: string; img?: 'arrival' | 'recognition' }
const STORY: Record<'arrival' | 'recognition', string> = { arrival: arrivalUrl, recognition: recognitionUrl };

const INTRO: Page[] = [
  { sound: 'debuff', lines: ['霸主倒下的瞬間，海面突然靜止了。', '浪聲、風聲、海鳥的叫聲——全部消失。'],
    art: (c, t, run) => { drawSea(c, t * 0.05, zoneOf(run).theme as ThemeId); veil(c, '#050814', 0.35 + 0.2 * clamp(t / 2)); } },
  { sound: 'enrage', lines: ['海水開始往上倒流。', '一道看不見頂的水牆，在船的四周升了起來。'],
    art: (c, t, run) => { drawSea(c, t * 0.2, zoneOf(run).theme as ThemeId); veil(c, '#050814', 0.5); waterWall(c, t, t / 2.2); motes(c, t, 24, '#bdf2ff'); } },
  { sound: 'reveal', speaker: '？？？', img: 'arrival', lines: ['「……你們走得比我想的還遠。」', '水牆的中央，有什麼巨大的東西睜開了眼睛。'],
    art: (c, t) => { c.fillStyle = '#06142e'; c.fillRect(-200, 0, W + 400, H); waterWall(c, t, 1); motes(c, t, 30, '#7fd8ff'); } },
  { sound: 'fanfare', speaker: '潮汐・默旭', lines: ['「我是統領萬潮之人——潮汐・默旭。」', '「每一片海的霸主，都是聽著我的潮聲長大的。讓我看看，你們配不配得上『潮汐獵手』這個名字。」'],
    art: (c, t) => { c.fillStyle = '#06142e'; c.fillRect(-200, 0, W + 400, H); waterWall(c, t, 1); moxu(c, t, W / 2, 92, 1.5, 1, Math.max(0, 0.85 - t * 0.9)); motes(c, t, 40, '#ffe7a0'); veil(c, '#ffffff', Math.max(0, 0.7 - t * 1.4)); } },
  { sound: 'heal', speaker: '潮汐・默旭', lines: ['「來吧。用你們全部的力量。」', '（夥伴們重新振作起來：全隊回復一半 HP，倒下的夥伴也醒了。）'],
    art: (c, t) => { c.fillStyle = '#06142e'; c.fillRect(-200, 0, W + 400, H); waterWall(c, t, 1); moxu(c, t, W / 2, 92, 1.5, 1); motes(c, t, 50, '#9cf5b8'); } },
];

const ZONE_ORBS = ['#7fe3ff', '#d8f4ff', '#ff8a3a', '#5ff1ff', '#9a7aff'];
const ENDING: Page[] = [
  { sound: 'reveal', lines: ['日月從默旭身後分離，兩座潮壁落回海面。', '日月御潮之姿隨著金色與銀藍的光退去。'],
    art: (c, t) => {
      const fade = ease(t / 2.8);
      drawSunMoonSea(c, t, 1 - fade);
      veil(c, '#06142e', fade * .55);
      moxu(c, t, W / 2, 92 + fade * 14, 1.45, 1 - fade, 0, MOXU_ASCENDED);
      moxu(c, t, W / 2, 92, 1.4, fade);
      motes(c, t, 24, '#ffdda0'); motes(c, -t - 8, 24, '#a9ddff');
    } },
  { speaker: '潮汐・默旭', lines: ['「……打了這麼久，你和你的夥伴，沒有一次丟下彼此。」', '「那就夠了。」'],
    art: (c, t) => { drawSea(c, t * 0.3, 'abyss'); veil(c, '#0a1b3a', 0.35); moxu(c, t, W / 2, 92, 1.4, 0.75); motes(c, t, 30, '#ffe7a0'); } },
  { speaker: '潮汐・默旭', lines: ['「潮汐從來不屬於任何人。我只是替大海看守它，等一個能和大海並肩的人。」', '「從今天起，這片海就交給你們了——潮汐獵手。」'],
    art: (c, t) => { drawSea(c, t * 0.3, 'day'); veil(c, '#0a1b3a', 0.25); moxu(c, t, W / 2, 92, 1.4, 0.6 - clamp(t / 6) * 0.3); motes(c, t, 40, '#ffe7a0'); } },
  { sound: 'heal', img: 'recognition', lines: ['默旭的身體化成無數光點，飛向了每一片海域——', '淺灘、冰原、裂谷、資料海，還有最深的深淵。'],
    art: (c, t) => {
      drawSea(c, t * 0.3, 'day'); veil(c, '#0a1b3a', 0.2);
      ZONE_ORBS.forEach((col, k) => {
        for (let i = 0; i < 14; i++) {
          const p = clamp((t * 0.45 - i * 0.04)), ang = -Math.PI + (k + 0.5) * (Math.PI / ZONE_ORBS.length);
          const x = W / 2 + Math.cos(ang) * p * 150 + Math.sin(i * 3 + t) * 4, y = 74 + Math.sin(ang) * p * 90 + i * 0.6;
          c.globalAlpha = (1 - p) * 0.9; c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), i % 4 ? 1 : 2, i % 4 ? 1 : 2);
        }
      });
      c.globalAlpha = 1;
    } },
  { sound: 'fanfare', lines: ['天亮了。', '破曉的光照在海面上，遠方港口的燈塔，亮了起來。'],
    art: (c, t) => { drawTitle(c, t); veil(c, '#000000', Math.max(0, 0.6 - t * 0.4)); } },
  { lines: [], art: (c, t, run) => {
    drawTitle(c, t); veil(c, '#0a1430', 0.25);
    const team = run.party.slice(0, 6), gap = Math.min(40, 220 / Math.max(1, team.length));
    team.forEach((m, i) => {
      const f = formOf(m), n = spriteSize(f.sprite), x = W / 2 + (i - (team.length - 1) / 2) * gap - n / 2;
      drawSprite(c, f.sprite, PAL[f.pal], Math.round(x), Math.round(92 - n + Math.sin(t * 2 + i) * 1.5), { f: animFrame(f.sprite, t, i), recolor: recolorOf(m.form, m.mutant) });
    });
    motes(c, t, 20, '#fff3c0');
  } },
];

/** 劇情：一頁一頁播，點一下或按「繼續」換頁 */
export function Finale({ vp, run, mode, onDone }: { vp: Viewport; run: RunState; mode: 'intro' | 'ending'; onDone: () => void }) {
  useEffect(() => {
    void ensureSprite(FINAL_BOSS);
    if (mode === 'ending') void ensureSprite(MOXU_ASCENDED);
  }, [mode]);
  const pages = mode === 'intro' ? INTRO : ENDING;
  const [i, setI] = useState(0);
  const start = useRef(-1), page = pages[i];
  useEffect(() => { start.current = -1; if (page.sound) sfx(page.sound as never); }, [i]);
  const nextPage = () => (i + 1 < pages.length ? setI(i + 1) : onDone());
  const last = i === pages.length - 1;
  const names = run.party.map((m) => formOf(m).name).join('、');
  const lines = mode === 'ending' && last ? [`潮汐獵手與 ${names} 的航程，在這裡寫下了結局。`, '但大海永遠還有下一道潮——隨時歡迎你再出海。'] : page.lines;
  return (
    <GameScreen vp={vp} outsideClose={false} dockTall
      overlay={page.img && <img key={`${mode}-${i}`} class="finale-img" src={STORY[page.img]} alt="" aria-hidden="true" />}
      scene={<SceneCanvas draw={(c, t) => { if (start.current < 0) start.current = t; page.art(c, t - start.current, run); }} label={mode === 'intro' ? '統領者登場' : '結局'} />}
      dock={
        <Win class={`finale ${mode}`} title={mode === 'ending' && last ? '終章' : page.speaker ?? (mode === 'intro' ? '最終決戰' : '尾聲')}>
          <div class="finale-text" key={i} onClick={nextPage}>
            {lines.map((l, k) => <p key={k} style={{ animationDelay: `${k * 0.6}s` }}>{l}</p>)}
          </div>
          <div class="finale-nav">
            <span class="small dim">{i + 1} / {pages.length}</span>
            <MenuItem onClick={nextPage} hot>{last ? (mode === 'intro' ? '迎戰統領者！' : '凱旋回港') : '繼續'}</MenuItem>
            {!last && <MenuItem onClick={onDone}>跳過劇情</MenuItem>}
          </div>
        </Win>
      } />
  );
}
