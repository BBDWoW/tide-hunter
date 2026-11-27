// 確認連擊、回合末傷害與防禦變動在刻紋系統中的結算順序。
import assert from 'node:assert/strict';
import { createBattle, resolveTurn, canAfford, volOf, calcDamage, aiChoose } from '../../src/game/battle';
import { makeRng } from '../../src/game/rng';
import { makeMon } from '../../src/game/creature';
import { SKILLS } from '../../src/data/skills';

const turtle = makeMon('oracle', 30), foe = makeMon('water1', 10);
turtle.hpFixed = turtle.hp = 10000; foe.hpFixed = foe.hp = 10000;
foe.skills = ['bubblebarrage'];
const s = createBattle(makeRng(7), { name: '龜', team: [turtle] }, { name: '敵', team: [foe] }, false);
const ult = turtle.skills.indexOf('oracle_tide');
assert(ult >= 0 && !canAfford(s, 0, ult));
s.traps = [2, 0];
resolveTurn(s, [{type:'pass'},{type:'pass'}]);
assert.equal(volOf(s,0).omenMarks?.length ?? 0, 0);
for (let count = 1; count <= 3; count++) {
  volOf(s,1).lockOn = true;
  const ev = resolveTurn(s,[{type:'pass'},{type:'skill',slot:0}]);
  assert(ev.filter(e => e.t === 'dmg' && e.side === 0).length >= 2);
  assert.equal(ev.filter(e => e.t === 'omen').length, 1);
  assert.equal(volOf(s,0).omenMarks?.length, count);
}
assert(canAfford(s,0,ult));
const damage = () => { s.rng = makeRng(31); return calcDamage(s,0,1,SKILLS.oracle_tide).dmg; };
const base = damage();
volOf(s,0).stages.atk = 2; assert.equal(damage(),base);
volOf(s,0).stages.def = 2; assert(damage() > base);
const events = resolveTurn(s,[{type:'skill',slot:ult},{type:'pass'}]);
assert(events.some(e => e.t === 'use' && e.skill === 'oracle_tide'));
assert.equal(volOf(s,0).omenMarks?.length,0); assert(!canAfford(s,0,ult));
for(let i=0;i<30;i++) assert.notDeepEqual(aiChoose(s,0),{type:'skill',slot:ult});
console.log('卜潮靈龜刻紋與防禦傷害測試通過');
