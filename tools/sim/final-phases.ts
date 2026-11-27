import assert from 'node:assert/strict';
import { aiChoose, battleEffectiveness, battleStats, calcDamage, canRod, clearConvergence, createBattle, finalSlots, hitChance, lifeStoneRevive, resolveTurn, skillFor, startFinal, volOf } from '../../src/game/battle';
import { makeMon, maxHp, recruitCaughtMon, statsOf } from '../../src/game/creature';
import { foeMods, newRun } from '../../src/game/run';
import { makeRng } from '../../src/game/rng';
import { ELEM, type Elem } from '../../src/data/types';
import { MOXU_ASCENDED, MOXU_ASCENDED_SKILLS } from '../../src/data/moxu';

const player = makeMon('water1', 28);
player.hp = player.hpFixed = 5000;
const reserve = makeMon('fire1', 28);
reserve.hp = reserve.hpFixed = 5000;
const boss = makeMon('tide_moxu', 28, true, true);
const run = newRun(player);
const state = createBattle(makeRng(7), { team: [player, reserve], name: '玩家' },
  { team: [boss], name: '統領者', boss: true, mods: foeMods(run) }, false);
startFinal(state);
const final = state.final!;
const first = statsOf(boss), originalSkills = [...boss.skills];
const pass = { type: 'pass' } as const;
const kill = () => { boss.hp = 0; return resolveTurn(state, [pass, pass]); };

assert.equal(final.phase, 1);
assert.equal(canRod(state), false);
const summon = kill();
assert(summon.some(event => event.t === 'summon'));
assert(summon.some(event => event.t === 'summonShield' && event.amount === first.hp * 5));
assert.equal(final.phase, 2);
assert.equal(boss.hp, first.hp);
assert.deepEqual(boss.skills, originalSkills);
assert.equal(skillFor(boss, -2).id, 'moxu_daybreak');
assert.equal(finalSlots(state).length, 2);
assert.equal(canRod(state), true);

const ally = state.sides[1].team[final.ally!];
assert.equal(maxHp(ally), 2 * maxHp(makeMon(ally.form, ally.lv, true, true)));
final.allyPlan = pass;
const hitShield = resolveTurn(state, [{ type: 'skill', slot: 0, target: 0 }, pass]);
assert.equal(boss.hp, first.hp);
assert(!hitShield.some(event => event.t === 'summonShield'));

boss.hp = 1;
boss.status = 'poison';
boss.statusTurns = 2;
final.allyPlan = pass;
const allyHp = ally.hp;
const protectedTurn = resolveTurn(state, [{ type: 'rod' }, pass]);
assert.equal(boss.hp, 1);
assert(ally.hp < allyHp);
assert(!protectedTurn.some(event => event.t === 'phase3' || event.t === 'summonShield'));

ally.hp = 1;
boss.status = null;
final.rodCd = 0;
final.allyPlan = pass;
const breakShield = resolveTurn(state, [{ type: 'rod' }, pass]);
assert(breakShield.some(event => event.t === 'faint' && event.slot === 1));
assert(breakShield.some(event => event.t === 'summonShield' && event.amount === 0));
assert.equal(boss.hp, 1);
assert.equal(final.phase, 2);
assert.deepEqual(finalSlots(state), [0]);

final.rodCd = 0;
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
assert.equal(ascended.hp, Math.round(first.hp * 1.1) * 2);
for (const stat of ['atk', 'def', 'spd'] as const) assert.equal(ascended[stat], Math.round(first[stat] * 1.1));
for (const elem of Object.keys(ELEM) as Elem[]) {
  assert.equal(battleEffectiveness(MOXU_ASCENDED, 'fire', [elem]), 2);
}
assert.equal(calcDamage(state, 1, 0, skillFor(boss, 0)).eff, 2);
assert.equal(boss.hp, ascended.hp);
assert.equal(volOf(state, 1).energy, 2);
const casts = new Set<string>();
const ultimateTurns: number[] = [];
for (let turn = 0; turn < 10; turn++) {
  const round = state.turn;
  const events = resolveTurn(state, [pass, aiChoose(state, 1)]);
  for (const event of events) if (event.t === 'use' && event.side === 1) {
    casts.add(event.skill);
    if (event.skill === 'moxu_convergence') ultimateTurns.push(round);
  }
}
assert.deepEqual([...casts].sort(), [...MOXU_ASCENDED_SKILLS].sort());
assert.equal(ultimateTurns.length, 2);
assert.equal(ultimateTurns[1] - ultimateTurns[0], 5);
assert.equal(volOf(state, 0).convergenceLoss, 20);
assert.equal(volOf(state, 0).stages.def, 0);
for (const stat of ['hp', 'atk', 'def', 'spd'] as const) {
  assert.equal(battleStats(state, 0)[stat], Math.round(statsOf(player)[stat] * .8));
}

const ultimate = { type: 'skill', slot: -2 } as const;
boss.status = 'blind';
reserve.held = 'ripplecloak';
state.sides[0].vol[reserve.uid].shield = 5000;
assert.equal(hitChance(state, 1, skillFor(boss, -2)), 1);
const onReserve = resolveTurn(state, [{ type: 'switch', to: 1 }, ultimate]);
assert(!onReserve.some(event => event.t === 'miss' || event.t === 'dodge'));
assert(onReserve.some(event => event.t === 'dmg' && event.side === 0 && event.amount === 0));
assert.equal(volOf(state, 0).convergenceLoss, 10);
assert.equal(reserve.hp, 4500);
assert.equal(state.sides[0].vol[player.uid].convergenceLoss, 20);

const back = resolveTurn(state, [{ type: 'switch', to: 0 }, ultimate]);
assert(back.some(event => event.t === 'switch' && event.max === 4000 && event.convergenceLoss === 20));
assert(back.some(event => event.t === 'convergence' && event.max === 3500 && event.loss === 30));
player.hp = 0;
lifeStoneRevive(state, 0);
assert.equal(player.hp, 1750);
assert.equal(volOf(state, 0).convergenceLoss, 30);
resolveTurn(state, [{ type: 'item', item: 'superpotion', target: 0 }, pass]);
assert.equal(player.hp, 3500);

for (let i = 0; i < 8; i++) {
  volOf(state, 0).shield = 5000;
  resolveTurn(state, [pass, ultimate]);
}
assert.equal(volOf(state, 0).convergenceLoss, 90);
assert.equal(player.hp, 500);
clearConvergence(state, 0);
assert.equal(player.hp, 5000);
assert.equal(reserve.hp, 5000);
assert.equal(volOf(state, 0).convergenceLoss, undefined);
player.hp = 1;
volOf(state, 0).shield = 0;
const lethal = resolveTurn(state, [pass, ultimate]);
assert(lethal.some(event => event.t === 'convergence' && event.hp === 0 && event.loss === 10));
assert.equal(player.hp, 0);
lifeStoneRevive(state, 0);
assert.equal(player.hp, 2250);
assert(kill().some(event => event.t === 'end' && event.winner === 0));
console.log('統領者三條血、召喚、釣竿、變身能力、四招、萬海歸寂削弱疊加與勝利判定通過');

const wild = makeMon('water1', 10, false, true, () => 0.9);
wild.hp = Math.floor(maxHp(wild) * 0.6);
const baseline = foeMods(run);
for (let star = 1; star <= 5; star++) {
  const mods = foeMods({ ...run, star });
  assert.equal(mods.damage, 1.15 ** star);
  assert.equal(mods.def, baseline.def * mods.damage);
  const encounter = createBattle(makeRng(7), { name: '玩家', team: [player] },
    { name: '野生潮靈', team: [wild], mods }, true);
  const enemy = encounter.sides[1].team[0];
  assert.equal(maxHp(enemy), Math.round(maxHp(wild) * mods.damage));
  const caught = recruitCaughtMon(enemy);
  assert.equal(caught.lv, 7);
  assert.deepEqual(caught.iv, wild.iv);
  assert.deepEqual(caught.skills, makeMon(wild.form, 7).skills);
  assert.equal(caught.hp, Math.round(maxHp(caught) * enemy.hp / maxHp(enemy)));
  assert.equal(caught.hpFixed, undefined);
}
assert.equal(recruitCaughtMon(makeMon('water1', 3, false, true)).lv, 1);
console.log('潮位倍率、敵方生命與收服後等級、個體值和技能檢查通過');
