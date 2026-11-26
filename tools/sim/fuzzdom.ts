import { createBattle, resolveTurn, aiChoose, aiForcedSwitch, forcedSwitch } from "../../src/game/battle";
import { makeMon } from "../../src/game/creature";
import { makeRng, next } from "../../src/game/rng";
import { FORMS } from "../../src/data/creatures";
const ids = Object.keys(FORMS); let err = 0, n = 0;
for (const dom of ['forest', 'void', 'core', undefined] as const) for (let i = 0; i < 1000; i++) {
  const r = makeRng(i * 13 + 1); const pick = () => ids[Math.floor(next(r) * ids.length)] ?? ids[0];
  try {
    const s = createBattle(makeRng(i), { team: [0, 1, 2].map(() => makeMon(pick(), 5 + (i % 25))), name: 'A' }, { team: [0, 1].map(() => makeMon(pick(), 5 + (i % 25))), name: 'B' }, i % 2 === 0, dom);
    while (!s.over && s.turn < 200) { resolveTurn(s, [aiChoose(s, 0), aiChoose(s, 1)]); for (const sd of [0, 1] as const) if (s.needSwitch[sd] && !s.over) forcedSwitch(s, sd, aiForcedSwitch(s, sd)); }
    n++;
  } catch (e) { err++; if (err < 3) console.log(e); }
}
console.log('battles', n, 'errors', err);
