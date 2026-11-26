import { FORMS } from "../../src/data/creatures";
import { SKILLS } from "../../src/data/skills";
import { STAGE_NAME } from "../../src/data/types";
import * as fs from 'fs';
const F = FORMS as any; const all = Object.values(F).filter((x: any) => !x.secret) as any[];
const parents: Record<string, any[]> = {};
for (const f of all) for (const e of f.evolve ?? []) (parents[e.to] ??= []).push({ f, e });
const issues: string[] = []; const chains: string[] = [];
const bst = (f: any) => f.base.hp + f.base.atk + f.base.def + f.base.spd;
const sprites = new Set(fs.readdirSync('src/art/sprites').map((x) => x.replace('.png', '')));
for (const f of all) {
  if (!sprites.has(f.sprite) && !f.recolor) issues.push(`${f.name}：找不到圖 ${f.sprite}`);
  const lv = f.learn.map((x: any) => x[0]);
  if (lv.some((v: number, i: number) => i && v < lv[i - 1])) issues.push(`${f.name}：學招等級沒有照順序 ${lv.join(',')}`);
  if (lv.some((v: number) => v > 30)) issues.push(`${f.name}：有超過 Lv30 才學的招`);
  for (const [, sk] of f.learn) if (!SKILLS[sk]) issues.push(`${f.name}：技能 ${sk} 不存在`);
  for (const e of f.evolve ?? []) {
    const t = F[e.to];
    if (!t) { issues.push(`${f.name} → ${e.to}：進化目標不存在`); continue; }
    if (t.stage !== f.stage + 1 && !(f.stage === 1 && t.stage === 3)) issues.push(`${f.name}(${STAGE_NAME[f.stage]}) → ${t.name}(${STAGE_NAME[t.stage]})：階段沒有往上一階`);
    if (f.stage === 1 && t.stage === 3) issues.push(`${f.name} → ${t.name}：從幼體直接跳到完全體（中間少成長體）`);
    if (t.stage <= f.stage) issues.push(`${f.name} → ${t.name}：進化後階段沒有變高`);
    if (t.family !== f.family) issues.push(`${f.name} → ${t.name}：家族不同（${f.family} / ${t.family}）`);
    if (t.rarity !== f.rarity) issues.push(`${f.name}(${f.rarity}) → ${t.name}(${t.rarity})：稀有度不同`);
    if (!t.elems.some((x: string) => f.elems.includes(x))) issues.push(`${f.name}[${f.elems}] → ${t.name}[${t.elems}]：屬性完全不同`);
    if (bst(t) <= bst(f)) issues.push(`${f.name}(${bst(f)}) → ${t.name}(${bst(t)})：進化後總能力沒有變強`);
    if (e.level > 30) issues.push(`${f.name} → ${t.name}：Lv${e.level} 超過等級上限 30`);
    const tl = t.learn.map((x: any) => x[0]);
    if (tl.length && Math.min(...tl) < e.level && !t.recolor) issues.push(`${f.name} → ${t.name}：進化形有 Lv${Math.min(...tl)} 的招，比進化等級 Lv${e.level} 還早（學不到）`);
    const pl = f.learn.map((x: any) => x[0]);
    if (pl.length && Math.max(...pl) > e.level + 3) issues.push(`${f.name}：Lv${Math.max(...pl)} 的招在進化（Lv${e.level}）之後很久才學，進化後就學不到了`);
  }
  // 多個進化方向的條件是否有區分
  if ((f.evolve?.length ?? 0) > 1) {
    const keys = f.evolve.map((e: any) => `${e.style ?? ''}|${e.zone ?? ''}`);
    if (new Set(keys).size !== keys.length) issues.push(`${f.name}：有兩個進化方向的條件一樣，玩家無法選`);
    if (!f.evolve.some((e: any) => !e.style && !e.zone) && f.evolve.every((e: any) => e.zone)) issues.push(`${f.name}：只有地區進化，沒有一般進化方向（在其他海域會卡住）`);
  }
  if (f.stage > 1 && !parents[f.id] && !f.evolve?.length && f.stage !== 3) issues.push(`${f.name}(${STAGE_NAME[f.stage]})：沒有前一階也沒有下一階（單獨的成長體）`);
}
// 印出進化樹
const roots = all.filter((f) => !parents[f.id]);
const walk = (f: any, d = 0): string => `${f.name}${f.evolve?.length ? ' → ' + f.evolve.map((e: any) => `[Lv${e.level}${e.style ? (e.style === 'atk' ? ' 攻擊型' : ' 守護型') : ''}${e.zone ? ' 在' + e.zone : ''}] ` + walk(F[e.to], d + 1)).join(' ／ ') : ''}`;
for (const r of roots) if (r.evolve?.length) chains.push(walk(r));
console.log('== 問題 ==\n' + (issues.join('\n') || '沒有'));
console.log('\n== 進化線 (' + chains.length + ') ==\n' + chains.join('\n'));
console.log('\n不會進化的單獨角色:', roots.filter((r) => !r.evolve?.length).map((r) => `${r.name}(${STAGE_NAME[r.stage]})`).join('、'));
