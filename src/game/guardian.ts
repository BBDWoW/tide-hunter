// 打倒特殊區域守護者後的獎勵：每個區域有自己的三選一，另外固定給一筆貝殼幣
import { HELD } from '../data/held';
import type { DomainId } from '../data/domains';
import { formOf, gainXp, xpToNext } from './creature';
import { applyBoon, boon, giveHeld, healParty, type RunState } from './run';

export interface GuardianReward { id: string; name: string; desc: string; icon: string; can?: (r: RunState) => boolean; apply: (r: RunState) => string }

const levelAll = (r: RunState, n: number) => {
  const ups: string[] = [];
  for (const m of r.party) { const lv0 = m.lv; for (let i = 0; i < n; i++) gainXp(m, Math.max(0, xpToNext(m.lv) - m.xp)); if (m.lv > lv0) ups.push(`${formOf(m).name} Lv${m.lv}`); }
  return ups;
};

export const GUARDIAN: Record<DomainId, { title: string; line: string; bonus: number; rewards: GuardianReward[] }> = {
  forest: {
    title: '森林恢復了寧靜', line: '藤角鹿低下頭，森林裡的花一朵朵開了。', bonus: 50,
    rewards: [
      { id: 'g_forest', name: '林之恩惠', icon: 'leaf', desc: '永久：每場戰鬥後，倒下的夥伴會以 30% HP 醒來。', can: (r) => boon(r, 'g_forest') < 1, apply: (r) => applyBoon(r, 'g_forest') },
      { id: 'fruit', name: '聖樹的果實', icon: 'heart', desc: '全隊每隻夥伴提升 1 級，並完全回復。', apply: (r) => { const ups = levelAll(r, 1); healParty(r, 1, true); return `全隊吃下果實，力量湧了上來！${ups.join('、')}`; } },
      { id: 'spring', name: '生命之泉', icon: 'lifestone', desc: '生命石 ×1、珍珠精華 ×2，並讓全隊完全回復。', apply: (r) => { r.lifeStones = (r.lifeStones ?? 0) + 1; r.items.superpotion += 2; healParty(r, 1, true); return '拿到了生命石和珍珠精華，全隊完全回復！'; } },
    ],
  },
  void: {
    title: '虛無歸於平靜', line: '星龍化成一陣星塵，倒過來的天空慢慢翻了回來。', bonus: 60,
    rewards: [
      { id: 'g_void', name: '虛空之眼', icon: 'eye', desc: '永久：擊中要害的機率 +12%。', can: (r) => boon(r, 'g_void') < 2, apply: (r) => applyBoon(r, 'g_void') },
      { id: 'stardust', name: '星辰碎片', icon: 'legendlure', desc: '傳說餌 ×2（有機會釣到 SSR 傳說級）。', apply: (r) => { r.lures.legend += 2; return '拿到了傳說餌 ×2！'; } },
      { id: 'voidbox', name: '虛無的寶匣', icon: 'chest', desc: '隨機兩個攜帶道具。', apply: (r) => { const a = giveHeld(r), b = giveHeld(r); return `匣子裡是「${HELD[a].name}」和「${HELD[b].name}」！`; } },
    ],
  },
  core: {
    title: '系統重新啟動', line: '域界核心的光環停止轉動，所有方塊整齊地排回原位。', bonus: 60,
    rewards: [
      { id: 'g_core', name: '核心同步', icon: 'cube', desc: '永久：每場戰鬥開始時能量 +1。', can: (r) => boon(r, 'g_core') < 2, apply: (r) => applyBoon(r, 'g_core') },
      { id: 'vault', name: '加密金庫', icon: 'shell', desc: '150 枚貝殼幣、能量海膽 ×2。', apply: (r) => { r.shells += 150; r.items.ether += 2; return '金庫打開了：150 枚貝殼幣和能量海膽 ×2！'; } },
      { id: 'backup', name: '資料備份', icon: 'revive', desc: '復甦貝 ×2、捕捉餌 ×3。', apply: (r) => { r.items.revive += 2; r.catchBait += 3; return '拿到了復甦貝 ×2 和捕捉餌 ×3！'; } },
    ],
  },
};
