// 遊戲畫面版型：一個固定 16:9 的「主畫面」，所有介面都畫在場景上。
// 直式手機則改成掌機的上下雙螢幕：上面是場景，下面放訊息與指令。
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

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
  const vw = W0 - (portraitRaw ? 0 : ins.l + ins.r), vh = H0 - (portraitRaw ? 0 : ins.t + ins.b);
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

// 橫向時螢幕比 16:9 長，兩側用目前場景的模糊延伸填滿（不要黑邊）
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
      fn.current(ctx, t, dt);
      if (ambient) ambient.getContext('2d')!.drawImage(ref.current!, 0, 0, ambient.width, ambient.height);
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
      {!vp.portrait && <canvas class="ambient" width={32} height={18} ref={setAmbient} aria-hidden="true" />}
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
