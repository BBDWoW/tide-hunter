import assert from 'node:assert/strict';
import { EVENTS } from '../../src/game/events';
import { next, randomSource } from '../../src/game/rng';
import { dailyPartner, newRun, rollBoons, rollEncounter, rollShadows } from '../../src/game/run';

function sample() {
  const day = '2026-11-28';
  const starter = dailyPartner(day);
  const run = newRun(starter, undefined, { daily: day });
  const fishingRandom = randomSource(run.rng.s ^ 0x2e8a27c3);
  const shadows = rollShadows(run, 'normal');
  const selection = Math.floor(fishingRandom() * shadows.length);
  const target = shadows[selection].x + (fishingRandom() - 0.5) * 20;
  const biteSchedule = Array.from({ length: 6 }, fishingRandom);
  const encounter = rollEncounter(run, 1, shadows[selection]).mon;
  const reelRandom = randomSource((next(run.rng) * 2 ** 32) >>> 0);
  const reelPath = Array.from({ length: 12 }, reelRandom);
  const trapped = EVENTS.find(event => event.id === 'trapped')!;
  trapped.options[0].act(run);
  const rescued = run.party[1];
  return {
    route: run.route, first: [starter.form, starter.iv], shadows, selection, target, biteSchedule,
    encounter: [encounter.form, encounter.lv, encounter.iv], reelPath, rescue: [rescued.form, rescued.iv],
    boons: rollBoons(run),
  };
}

const original = Math.random;
try {
  Math.random = () => 0.01;
  const first = sample();
  assert.equal(randomSource()(), 0.01);
  Math.random = () => 0.99;
  assert.deepEqual(sample(), first);
  assert.equal(randomSource()(), 0.99);
} finally { Math.random = original; }
console.log('每日挑戰：魚影、落點、咬鉤、收線、遭遇、事件個體值與能力卡的種子一致');
