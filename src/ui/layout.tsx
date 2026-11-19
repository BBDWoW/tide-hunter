// 遊戲畫面版型：一個固定 16:9 的「主畫面」，所有介面都畫在場景上。
// 直式手機則改成掌機的上下雙螢幕：上面是場景，下面放訊息與指令。
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

export const SCENE_W = 256, SCENE_H = 144;

export interface Viewport { portrait: boolean; w: number; h: number; u: number }

function measure(): Viewport {
  const vw = window.innerWidth, vh = window.innerHeight;
  const portrait = vh > vw * 1.15;
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
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  return vp;
}

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
      fn.current(ctx, t, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} class="scene-canvas" width={SCENE_W} height={SCENE_H} aria-label={label} role={label ? 'img' : undefined} />;
}

/**
 * 一個遊戲畫面。
 * - scene：背景場景
 * - overlay：永遠疊在場景上的東西（HUD、標題字、浮動數字）
 * - dock：底部的訊息／指令區。橫式時疊在場景下緣，直式時移到下螢幕。
 * - panel：大型視窗（隊伍、圖鑑），橫式時置中浮在場景上，直式時放在下螢幕。
 */
export function GameScreen({ vp, scene, overlay, dock, panel, dockTall, onScene, tappable }: {
  vp: Viewport; scene: ComponentChildren; overlay?: ComponentChildren; dock?: ComponentChildren; panel?: ComponentChildren; dockTall?: boolean;
  onScene?: Record<string, unknown>; tappable?: boolean;
}) {
  const lower = (dock || panel) && vp.portrait;
  return (
    <div class={`console ${vp.portrait ? 'portrait' : 'landscape'}`}>
      <div class={`frame ${tappable ? 'tappable' : ''}`} style={{ width: `${vp.w}px`, height: `${vp.h}px`, '--u': `${vp.u}px` }} {...onScene}>
        {scene}
        <div class="overlay">{overlay}</div>
        {!vp.portrait && panel && <div class={`panel-layer ${dock ? 'with-dock' : ''}`}>{panel}</div>}
        {!vp.portrait && dock && <div class={`dock ${dockTall ? 'tall' : ''}`}>{dock}</div>}
      </div>
      {lower && (
        <div class="lower" style={{ width: `${vp.w}px`, '--u': `${Math.min(3.2, Math.max(2.4, vp.w / 150))}px` }}>
          {panel && <div class="lower-panel">{panel}</div>}
          {dock && <div class="dock">{dock}</div>}
        </div>
      )}
    </div>
  );
}

export function Win({ children, class: cls = '', title }: { children: ComponentChildren; class?: string; title?: string }) {
  return (
    <div class={`win ${cls}`}>
      {title && <div class="win-title">{title}</div>}
      {children}
    </div>
  );
}
