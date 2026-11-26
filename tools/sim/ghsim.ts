import { createBattle, resolveTurn, aiChoose, aiForcedSwitch, forcedSwitch, restorePulled } from "../../src/game/battle";
import { makeMon, maxHp } from "../../src/game/creature";
import { makeRng } from "../../src/game/rng";
import { FORMS, ZONE1_POOL } from "../../src/data/creatures";
let win = 0, err = 0; const N = 600; const turns: number[] = []; const evs: Record<string, number> = {};
for (let i = 0; i < N; i++) {
  try {
    const pool = ZONE1_POOL; const lv = 12 + (i % 15);
    const team = [0, 1, 2, 3].slice(0, 2 + (i % 3)).map((k) => makeMon(pool[(i * 7 + k * 3) % pool.length], lv));
    const before = team.map((m) => [...m.skills].join());
    const hand = makeMon('godhand', lv); hand.skills = ['gh_toss','gh_love','gh_fire','gh_stay','gh_pull']; hand.hpFixed = 1000 * Math.max(...team.map(maxHp)); hand.hp = hand.hpFixed;
    const s = createBattle(makeRng(i), { team, name: 'P' }, { team: [hand], name: 'G' }, false, undefined, true);
    while (!s.over && s.turn < 200) { const ev = resolveTurn(s, [aiChoose(s, 0), aiChoose(s, 1)]); for (const e of ev) if (e.t === 'pull' || e.t === 'rewind' || e.t === 'toss') evs[e.t] = (evs[e.t] ?? 0) + 1; for (const sd of [0, 1] as const) if (s.needSwitch[sd] && !s.over) forcedSwitch(s, sd, aiForcedSwitch(s, sd)); }
    if (s.over?.winner === 0) win++;
    turns.push(s.turn);
    restorePulled(s);
    if (team.map((m) => [...m.skills].join()).join('|') !== before.join('|')) console.log('skills not restored');
  } catch (e) { err++; if (err < 3) console.log(e); }
}
console.log('survive rate', (win / N * 100).toFixed(1) + '%', 'avg turns', (turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1), 'errors', err, evs);
