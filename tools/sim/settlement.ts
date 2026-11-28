import assert from 'node:assert/strict';
import { makeMon } from '../../src/game/creature';
import { loadMeta, newBayMon, saveMeta } from '../../src/game/meta';
import { loadDex, loadRun, newRun, saveRun } from '../../src/game/run';
import { completeSettlement, settlementPearls } from '../../src/game/settlement';

const entries = new Map<string, string>();
let fail: string | undefined;
let failRemove = false;
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => entries.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (fail === key) throw new Error('模擬寫入失敗');
    entries.set(key, value);
  },
  removeItem: (key: string) => {
    if (failRemove) throw new Error('模擬清理失敗');
    entries.delete(key);
  },
}});

const meta = loadMeta();
const existing = newBayMon('fire1');
meta.bay = [existing];
meta.eggs = [{id: 'older', zone: 'ice', left: 2, total: 2, warm: 0}];
saveMeta(meta);
const run = newRun(makeMon('fire1', 9));
run.party[0].bayId = existing.id;
const keeper = makeMon('jelly1', 8);
const released = makeMon('grass1', 8);
run.party.push(keeper, released);
run.eggs = ['shallows'];
run.settlement = { id: 'regular', win: true, kept: [{uid: keeper.uid}] };
const pearls = settlementPearls(run, meta);
assert(saveRun(run));
assert.equal(loadMeta().runs, 0);

fail = 'tidehunter.meta.v1';
assert.equal(await completeSettlement('regular'), false);
assert.equal(loadMeta().runs, 0);
assert.equal(loadDex().clears, 0);
fail = 'tidehunter.dex.v1';
assert.equal(await completeSettlement('regular'), false);
assert.equal(loadMeta().runs, 1);
assert.equal(loadMeta().bay.length, 2);
assert.equal(loadMeta().bay[0].bond, 1);
assert.equal(loadMeta().eggs?.[0].left, 1);
assert.equal(loadMeta().eggs?.length, 2);
assert.equal(loadMeta().pearls, pearls + 5);
assert.equal(loadRun()?.settlement?.submitted, true);

fail = undefined;
failRemove = true;
assert.equal(await completeSettlement('regular'), false);
assert.equal(loadDex().clears, 1);
failRemove = false;
assert.equal(await completeSettlement('regular'), true);
assert.equal(await completeSettlement('regular'), false);
assert.equal(loadRun(), null);
assert.equal(loadMeta().runs, 1);
assert.equal(loadDex().clears, 1);
assert.equal(loadMeta().pearls, pearls + 5);

for (const [i, day] of ['2026-11-28', '2026-11-28'].entries()) {
  const daily = newRun(makeMon('water1', 5), undefined, { daily: day });
  daily.station = i + 2;
  daily.settlement = { id: `daily-${i}`, win: false, kept: [] };
  const prior = loadMeta();
  assert.equal(settlementPearls(daily, prior) === 0, i === 1);
  saveRun(daily);
  assert.equal(await completeSettlement(`daily-${i}`), true);
  assert.equal(loadMeta().bay.length, prior.bay.length);
  assert.equal(loadMeta().pearls, prior.pearls + settlementPearls(daily, prior));
  assert.equal(loadMeta().daily?.best, i + 3);
}
console.log('回港結算：珍珠、蛋、羈絆、保留與放生夥伴、每日獎勵，以及三種儲存失敗重試均通過');
