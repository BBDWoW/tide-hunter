import { render } from 'preact';
import './data/sprites';
import './styles.css';
import { App } from './ui/App';
import { artReady } from './render/art';

// 手機：禁止兩指縮放（iOS Safari 不理會 viewport 的設定，要另外擋）；連點兩下放大由 CSS 的 touch-action 處理
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

artReady.then(() => render(<App />, document.getElementById('app')!));
