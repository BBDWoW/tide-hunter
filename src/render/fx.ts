// 特效設定：「減少特效」會關掉戰鬥震動、閃光與光環，並減少粒子（記在這台裝置上）
const KEY = 'tidehunter.fx';
const sysReduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
function load(): { reduce: boolean } {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s.reduce === 'boolean') return s; } catch { /* 略過 */ }
  return { reduce: sysReduce };
}
export const fx = load();
const apply = () => document.documentElement.classList.toggle('reduce-fx', fx.reduce);
apply();
export function setReduceFx(v: boolean) {
  fx.reduce = v; apply();
  try { localStorage.setItem(KEY, JSON.stringify(fx)); } catch { /* 略過 */ }
}
/** 粒子數量倍率 */
export const partMul = () => (fx.reduce ? 0.4 : 1);
