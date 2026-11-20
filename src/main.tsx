import { render } from 'preact';
import './data/sprites';
import './styles.css';
import { App } from './ui/App';
import { artReady } from './render/art';
import { loadSound, saveSound, unlockAudio } from './audio/engine';

// 啟動畫面：進度條跟著美術載入前進，完成後淡出（最少顯示 1.2 秒，才不會一閃而過）
const splash = document.getElementById('splash');
const bar = splash?.querySelector<HTMLElement>('.bar i');
const tip = splash?.querySelector<HTMLElement>('.tip');
const TIPS = ['正在準備釣具……', '正在整理魚餌……', '海面上起風了……', '潮靈們正在集合……'];
(window as unknown as { __splash?: (p: number) => void }).__splash = (p) => {
  if (bar) { const now = bar.getBoundingClientRect().width / (bar.parentElement?.getBoundingClientRect().width || 1); bar.style.animation = 'none'; bar.style.width = `${Math.round(Math.max(now * 100, 8 + p * 82))}%`; }
  if (tip) tip.textContent = TIPS[Math.min(TIPS.length - 1, Math.floor(p * TIPS.length))];
};
function hideSplash() {
  if (!splash) return;
  if (bar) { bar.style.animation = 'none'; bar.style.width = '100%'; }
  if (tip) tip.textContent = '出航！';
  setTimeout(() => { splash.classList.add('hide'); setTimeout(() => splash.remove(), 600); }, Math.max(250, 1200 - performance.now()));
}


// 手機：禁止兩指縮放（iOS Safari 不理會 viewport 的設定，要另外擋）；連點兩下放大由 CSS 的 touch-action 處理
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

// 聲音：瀏覽器規定要先有使用者操作，所以第一次點擊／按鍵時才開始播放；M 鍵切換靜音
for (const ev of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(ev, () => unlockAudio(), { passive: true });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'm' && e.key !== 'M') return;
  if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
  const s = loadSound(); saveSound({ ...s, muted: !s.muted });
});

artReady.then(() => { render(<App />, document.getElementById('app')!); hideSplash(); });
