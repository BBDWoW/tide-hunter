import { createBattle, resolveTurn, aiChoose, aiForcedSwitch, forcedSwitch, startFinal, canRod, finalSlots, type Action } from '../../src/game/battle';
import { makeMon } from '../../src/game/creature';
import { makeRng, next } from '../../src/game/rng';
import { CYBER_POOL, ABYSS_POOL, ICE_POOL, LAVA_POOL } from '../../src/data/creatures';
const pool = [...ICE_POOL, ...LAVA_POOL, ...CYBER_POOL, ...ABYSS_POOL];
function rate(blv: number, size: number, hpFrac: number, strat: 'main' | 'ally' | 'norod', N = 500) {
  let win = 0, err = 0, turns = 0, p2 = 0, p3 = 0, rods = 0; const summ: Record<string, number> = {};
  for (let i = 0; i < N; i++) {
    try {
      const r = makeRng(i * 13 + 5); const team = Array.from({ length: size }, () => makeMon(pool[Math.floor(next(r) * pool.length)], 26));
      for (const m of team) m.hp = Math.ceil(m.hp * hpFrac);
      const s = createBattle(makeRng(i), { team, name: 'P', mods: { atk: 1, def: 1, energy: 0, crit: 0 } }, { team: [makeMon('tide_moxu', blv, true, true)], name: 'B', boss: true, mods: { atk: 1.2, def: 1.2, energy: 0, crit: 0 } }, true);
      startFinal(s);
      while (!s.over && s.turn < 200) {
        let a: Action = aiChoose(s, 0);
        if (strat !== 'norod' && canRod(s)) a = { type: 'rod' };
        else if (a.type === 'skill' && strat === 'ally' && s.final!.ally != null && finalSlots(s).includes(s.final!.ally)) a = { ...a, target: s.final!.ally };
        resolveTurn(s, [a, aiChoose(s, 1)]);
        if (s.needSwitch[0] && !s.over) forcedSwitch(s, 0, aiForcedSwitch(s, 0));
      }
      if (s.final!.phase >= 2) p2++; if (s.final!.phase === 3) p3++; rods += s.final!.rodUses; if (s.final!.summoned) summ[s.final!.summoned] = (summ[s.final!.summoned] ?? 0) + 1;
      if (s.over?.winner === 0) win++; turns += s.turn;
    } catch (e) { err++; if (err < 3) console.log(e); }
  }
  return `${(win / N * 100).toFixed(0)}% win, reach p2 ${(p2 / N * 100).toFixed(0)}%, reach p3 ${(p3 / N * 100).toFixed(0)}%, ${(turns / N).toFixed(1)}t, rods ${(rods / N).toFixed(1)}, err ${err}`;
}
console.log('5@85% focus main  ', rate(28, 5, 0.85, 'main'));
console.log('5@85% focus ally  ', rate(28, 5, 0.85, 'ally'));
console.log('5@85% no rod      ', rate(28, 5, 0.85, 'norod'));
console.log('6@85% focus ally  ', rate(28, 6, 0.85, 'ally'));
