import { useEffect, useRef } from 'preact/hooks';

// 「按住」輸入：滑鼠、觸控、空白鍵通用
export function useHold(enabled = true) {
  const held = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const down = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); held.current = true; } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') held.current = false; };
    const release = () => (held.current = false);
    const press = (e: PointerEvent) => { if (!(e.target as HTMLElement)?.closest?.('button')) held.current = true; };
    window.addEventListener('pointerdown', press);
    // iOS：長按會叫出放大鏡、選字或選單，還會取消觸控讓按住失效。按住期間把這些系統手勢擋掉。
    const noTouch = (e: TouchEvent) => { if (!(e.target as HTMLElement)?.closest?.('button, input, select, textarea')) e.preventDefault(); };
    const noMenu = (e: Event) => e.preventDefault();
    document.addEventListener('touchstart', noTouch, { passive: false });
    document.addEventListener('touchmove', noTouch, { passive: false });
    document.addEventListener('contextmenu', noMenu);
    document.addEventListener('selectstart', noMenu);
    document.documentElement.classList.add('holding');
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('pointerup', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerdown', press);
      document.removeEventListener('touchstart', noTouch);
      document.removeEventListener('touchmove', noTouch);
      document.removeEventListener('contextmenu', noMenu);
      document.removeEventListener('selectstart', noMenu);
      document.documentElement.classList.remove('holding');
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('blur', release);
    };
  }, [enabled]);
  return {
    get current() { return held.current; },
    bind: {
      onPointerDown: (e: PointerEvent) => { e.preventDefault(); held.current = true; },
      onPointerUp: () => (held.current = false),
      onPointerCancel: () => (held.current = false),
      onContextMenu: (e: Event) => e.preventDefault(),
    },
  };
}

// 單次「點擊」：滑鼠、觸控、空白鍵
export function useTap(handler: () => void, enabled = true) {
  const h = useRef(handler);
  h.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const key = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); h.current(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [enabled]);
  return { onPointerDown: (e: PointerEvent) => { e.preventDefault(); h.current(); } };
}
