// 回港確認後發放獎勵。港口與圖鑑分別記下已完成的航程，寫入中斷時可以安全重試。
import { settleEggs } from './eggs';
import { addBayMon, bayCap, bringBackSlots, loadMeta, pearlsFor, releaseValue, returnFromRun, saveMeta, type Meta } from './meta';
import { FINAL_PEARLS, loadRun, MAX_STAR, pearlMul, saveRun, totalStation, updateDex, type RunState } from './run';

export function settlementPearls(run: RunState, meta: Meta): number {
  if (run.settlement?.pearls !== undefined) return run.settlement.pearls;
  if (run.daily && meta.daily?.day === run.daily && meta.daily.paid) return 0;
  const win = run.settlement!.win;
  const multiplier = pearlMul(run.star ?? 0);
  const extra = run.finale === 'won' ? Math.round(FINAL_PEARLS * multiplier) : 0;
  return Math.round(pearlsFor({ station: totalStation(run), battlesWon: run.battlesWon, caught: run.caught, win }) * multiplier) + extra;
}

export function settlementCandidates(run: RunState) {
  return run.daily ? [] : run.party.filter(mon => !mon.bayId);
}

function commitSettlement(id: string): boolean {
  const run = loadRun();
  const settlement = run?.settlement;
  if (!run || !settlement || settlement.id !== id) return false;
  const meta = loadMeta();
  if (meta.lastSettlementId !== id) {
    const candidates = settlementCandidates(run);
    const kept = new Set<string>();
    const pearls = settlementPearls(run, meta);
    // 完成名單檢查前保留修改選擇的機會。
    const keepers = settlement.kept.slice(0, bringBackSlots(meta));
    const replacements = new Set(keepers.map(choice => choice.replaceId).filter(id => meta.bay.some(resident => resident.id === id)));
    if (meta.bay.length + keepers.length - replacements.size > Math.max(meta.bay.length, bayCap(meta))) return false;
    if (!settlement.submitted) {
      settlement.submitted = true;
      settlement.pearls = pearls;
      if (!saveRun(run)) return false;
    }
    if (run.daily) {
      const daily = meta.daily?.day === run.daily ? meta.daily : { day: run.daily, best: 0, win: false, paid: false };
      daily.best = Math.max(daily.best, totalStation(run));
      daily.win ||= settlement.win;
      daily.paid = true;
      meta.daily = daily;
    } else if (settlement.win && (run.star ?? 0) >= (meta.maxStar ?? 0) && (meta.maxStar ?? 0) < MAX_STAR) {
      meta.maxStar = (run.star ?? 0) + 1;
    }
    returnFromRun(meta, run.party);
    for (const { uid, replaceId } of keepers) {
      const mon = candidates.find(partner => partner.uid === uid);
      if (!mon || kept.has(uid)) continue;
      const replacesResident = replaceId && meta.bay.some(resident => resident.id === replaceId);
      const resident = addBayMon(meta, mon, replacesResident ? replaceId : undefined);
      if (replacesResident && meta.selected === replaceId) meta.selected = resident.id;
      kept.add(uid);
    }
    const released = candidates.filter(mon => !kept.has(mon.uid)).reduce((sum, mon) => sum + releaseValue(mon), 0);
    meta.pearls += pearls + released;
    meta.totalPearls += pearls + released;
    meta.runs++;
    settleEggs(meta, run.eggs ?? []);
    meta.lastSettlementId = id;
    if (!saveMeta(meta)) return false;
  }

  const dexSaved = updateDex(dex => {
    if (dex.lastSettlementId === id) return;
    dex.bestStation = Math.max(dex.bestStation, totalStation(run));
    if (settlement.win) dex.clears++;
    dex.lastSettlementId = id;
  });
  return dexSaved && saveRun(null);
}

export async function completeSettlement(id: string): Promise<boolean> {
  // 同時開了兩個分頁時，由先取得鎖的分頁完成回港。
  return navigator.locks
    ? navigator.locks.request('tidehunter-settlement', () => commitSettlement(id))
    : commitSettlement(id);
}
