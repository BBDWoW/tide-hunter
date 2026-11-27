import assert from 'node:assert/strict';
import { aiChoose, canRod, createBattle, finalSlots, resolveTurn, skillFor, startFinal, volOf } from '../../src/game/battle';
import { makeMon, statsOf } from '../../src/game/creature';
import { foeMods, newRun } from '../../src/game/run';
import { makeRng } from '../../src/game/rng';
import { MOXU_ASCENDED, MOXU_ASCENDED_SKILLS } from '../../src/data/moxu';

const player = makeMon('water1', 28);
player.hp = player.hpFixed = 5000;
const boss = makeMon('tide_moxu', 28, true, true);
const run = newRun(player);
const state = createBattle(makeRng(7), { team: [player], name: '玩家' },
  { team: [boss], name: '統領者', boss: true, mods: foeMods(run) }, false);
startFinal(state);
const final = state.final!;
const first = statsOf(boss), originalSkills = [...boss.skills];
const pass = { type: 'pass' } as const;
const kill = () => { boss.hp = 0; return resolveTurn(state, [pass, pass]); };

assert.equal(final.phase, 1);
assert.equal(canRod(state), false);
assert(kill().some(event => event.t === 'summon'));
assert.equal(final.phase, 2);
assert.equal(boss.hp, first.hp);
assert.deepEqual(boss.skills, originalSkills);
assert.equal(skillFor(boss, -2).id, 'moxu_daybreak');
assert.equal(finalSlots(state).length, 2);
assert.equal(canRod(state), true);

boss.hp = 1;
state.field = { id: 'lava', turns: 3 };
state.traps = [0, 2];
const shift = resolveTurn(state, [{ type: 'rod' }, aiChoose(state, 1)]);
assert.equal(shift.filter(event => event.t === 'phase3').length, 1);
assert(!shift.some(event => event.t === 'use' && event.side === 1));
assert.equal(final.phase, 3);
assert.deepEqual(finalSlots(state), [0]);
assert.equal(state.over, null);
assert.equal(state.field, null);
assert.equal(boss.form, MOXU_ASCENDED);
assert.deepEqual(boss.skills, MOXU_ASCENDED_SKILLS);
const ascended = statsOf(boss);
for (const stat of ['hp', 'atk', 'def', 'spd'] as const) assert.equal(ascended[stat], Math.round(first[stat] * 1.1));
assert.equal(boss.hp, ascended.hp);
assert.equal(volOf(state, 1).energy, 2);
const casts = new Set<string>();
for (let turn = 0; turn < 8; turn++) {
  const events = resolveTurn(state, [pass, aiChoose(state, 1)]);
  for (const event of events) if (event.t === 'use' && event.side === 1) casts.add(event.skill);
}
assert.deepEqual([...casts].sort(), [...MOXU_ASCENDED_SKILLS].sort());
assert(kill().some(event => event.t === 'end' && event.winner === 0));
console.log('統領者三條血、召喚、釣竿、變身能力、四招與勝利判定通過');
