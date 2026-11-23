import { sfx } from '../audio/engine';
// 遊戲畫面版型：一個固定 16:9 的「主畫面」，所有介面都畫在場景上。
// 直式手機則改成掌機的上下雙螢幕：上面是場景，下面放訊息與指令。
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { view } from '../render/scene';

export const SCENE_W = 256, SCENE_H = 144;

export interface Viewport { portrait: boolean; w: number; h: number; u: number }

// 手機的瀏海、底部橫條等安全區域（加到主畫面全螢幕時才會有值）
function safeInsets() {
  const cs = getComputedStyle(document.documentElement);
  const v = (k: string) => parseFloat(cs.getPropertyValue(k)) || 0;
  return { t: v('--sat'), r: v('--sar'), b: v('--sab'), l: v('--sal') };
}

function measure(): Viewport {
  const ins = safeInsets();
  // 用版面的寬高（不受兩指縮放影響），避免畫面被縮放後變窄、偏移
  const de = document.documentElement;
  const W0 = de.clientWidth || window.innerWidth, H0 = window.innerHeight;
  const portraitRaw = H0 > W0 * 1.15;
  // 橫向：高度用滿整個螢幕（Home 橫條只是一條細線，不需要讓出空間），左右避開瀏海
  const vw = W0 - (portraitRaw ? 0 : ins.l + ins.r), vh = H0;
  const portrait = portraitRaw;
  if (portrait) {
    const w = vw, h = Math.round((w * 9) / 16);
    return { portrait, w, h, u: w / SCENE_W };
  }
  const w = Math.min(vw, (vh * 16) / 9), h = (w * 9) / 16;
  return { portrait, w: Math.floor(w), h: Math.floor(h), u: w / SCENE_W };
}

export function useViewport() {
  const [vp, setVp] = useState(measure);
  useEffect(() => {
    const on = () => setVp(measure());
    // 轉向時手機會晚一點才更新尺寸，所以多量幾次
    const onTurn = () => { on(); setTimeout(on, 150); setTimeout(on, 450); };
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', onTurn);
    window.visualViewport?.addEventListener('resize', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', onTurn); window.visualViewport?.removeEventListener('resize', on); };
  }, []);
  return vp;
}

// 橫向時螢幕比 16:9 長：場景往左右延伸到螢幕邊緣（介面維持在 16:9 範圍內）
// bleed = 每一側延伸幾個場景像素
let bleed = 0;
// 螢幕比 16:9 高（例如平板）時，上下用場景的模糊延伸填滿
let ambient: HTMLCanvasElement | null = null;
const setAmbient = (c: HTMLCanvasElement | null) => { ambient = c; };

export type SceneDraw = (ctx: CanvasRenderingContext2D, t: number, dt: number) => void;

// 持續繪製的場景畫布
export function SceneCanvas({ draw, label }: { draw: SceneDraw; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fn = useRef(draw);
  fn.current = draw;
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    let raf = 0, last = performance.now(), t = 0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const loop = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; t += reduce ? dt * 0.25 : dt;
      const c = ref.current!, want = SCENE_W + bleed * 2;
      if (c.width !== want) { c.width = want; ctx.imageSmoothingEnabled = false; }
      view.bleed = bleed; view.wide = false;
      ctx.setTransform(1, 0, 0, 1, bleed, 0);
      fn.current(ctx, t, dt);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // 有用海面背景的場景已經自己畫了延伸；其他場景（海圖、港口等）用鏡射補滿兩側
      if (bleed > 0 && !view.wide) extendSides(ctx, c, bleed);
      if (ambient) ambient.getContext('2d')!.drawImage(ref.current!, 0, 0, ambient.width, ambient.height);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} class="scene-canvas" width={SCENE_W} height={SCENE_H} aria-label={label} role={label ? 'img' : undefined} />;
}

/** 把場景左右邊緣鏡射延伸到螢幕兩側，外側稍微暗一點 */
function extendSides(ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, b: number) {
  const H = SCENE_H, w = Math.min(b, SCENE_W);
  ctx.save(); ctx.translate(b, 0); ctx.scale(-1, 1); ctx.drawImage(c, b, 0, w, H, 0, 0, w, H); ctx.restore();
  ctx.save(); ctx.translate(SCENE_W + b * 2, 0); ctx.scale(-1, 1); ctx.drawImage(c, SCENE_W + b - w, 0, w, H, 0, 0, w, H); ctx.restore();
  for (const [x0, x1] of [[b, 0], [SCENE_W + b, SCENE_W + b * 2]]) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), 0, b, H);
  }
}

/**
 * 一個遊戲畫面。
 * - scene：背景場景
 * - overlay：永遠疊在場景上的東西（HUD、標題字、浮動數字）
 * - dock：底部的訊息／指令區。橫式時疊在場景下緣，直式時移到下螢幕。
 * - panel：大型視窗（隊伍、圖鑑），橫式時置中浮在場景上，直式時放在下螢幕。
 */
export function GameScreen({ vp, scene, overlay, dock, panel, dockTall, onScene, tappable, onPanelClose }: {
  vp: Viewport; scene: ComponentChildren; overlay?: ComponentChildren; dock?: ComponentChildren; panel?: ComponentChildren; dockTall?: boolean;
  /** 有的話：點視窗外面的空白處就關閉視窗 */ onPanelClose?: () => void;
  onScene?: Record<string, unknown>; tappable?: boolean;
}) {
  // 電腦：按 Esc 關閉視窗
  const closeRef = useRef(onPanelClose); closeRef.current = panel ? onPanelClose : undefined;
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape' && closeRef.current) { e.preventDefault(); closeRef.current(); } };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  // 橫向：整個頁面固定不動，避免 iOS 拖一下整個畫面跟著上下滑
  useEffect(() => {
    const de = document.documentElement;
    de.classList.toggle('lock', !vp.portrait);
    if (vp.portrait) return;
    const guard = (e: TouchEvent) => {
      for (let el = e.target as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
        const oy = getComputedStyle(el).overflowY, ox = getComputedStyle(el).overflowX;
        if (((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) || ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1)) return;
      }
      e.preventDefault();
    };
    document.addEventListener('touchmove', guard, { passive: false });
    return () => document.removeEventListener('touchmove', guard);
  }, [vp.portrait]);
  const lower = (dock || panel) && vp.portrait;
  // 橫向：算出左右要延伸多少（用整個螢幕寬，連瀏海兩側也鋪滿）
  const full = typeof document !== 'undefined' ? document.documentElement.clientWidth || window.innerWidth : vp.w;
  bleed = vp.portrait ? 0 : Math.max(0, Math.min(128, Math.ceil((full - vp.w) / 2 / vp.u)));
  return (
    <div class={`console ${vp.portrait ? 'portrait' : 'landscape'}`}>
      {!vp.portrait && <canvas class="ambient" width={32} height={18} ref={setAmbient} aria-hidden="true" />}
      {vp.portrait && panel && onPanelClose && <div class="portrait-closer" style={{ height: `${vp.h}px` }} onClick={onPanelClose} aria-label="關閉視窗" />}
      <div class={`frame ${tappable ? 'tappable' : ''} ${bleed ? 'bleed' : ''}`} style={{ width: `${vp.w}px`, height: `${vp.h}px`, '--u': `${vp.u}px`, '--bleed': `${bleed * vp.u}px` }} {...onScene}>
        {scene}
        <div class="overlay">{overlay}</div>
        {!vp.portrait && panel && <div class={`panel-layer ${dock ? 'with-dock' : ''} ${onPanelClose ? 'closable' : ''}`} onClick={(e) => { if (onPanelClose && e.target === e.currentTarget) onPanelClose(); }}>{panel}</div>}
        {!vp.portrait && dock && <div class={`dock ${dockTall ? 'tall' : ''}`}>{dock}</div>}
      </div>
      {lower && (
        <div class="lower" style={{ width: `${vp.w}px`, '--scene-h': `${vp.h}px`, '--u': `${Math.min(3.2, Math.max(2.4, vp.w / 150))}px` }}>
          {panel && <div class="lower-panel">{panel}</div>}
          {dock && <div class="dock">{dock}</div>}
        </div>
      )}
    </div>
  );
}

/** 視窗。有 onClose 時，右上角會有固定的關閉／返回鍵（捲動時也一直看得到） */
export function Win({ children, class: cls = '', title, onClose, closeLabel = '關閉' }: { children: ComponentChildren; class?: string; title?: string; onClose?: () => void; closeLabel?: string }) {
  return (
    <div class={`win ${cls}`}>
      {onClose ? (
        <div class="win-title has-close"><span class="grow">{title}</span><button class="win-close" onClick={(e) => { e.stopPropagation(); sfx('back'); onClose(); }}>✕ {closeLabel}</button></div>
      ) : title && <div class="win-title">{title}</div>}
      {children}
    </div>
  );
}
