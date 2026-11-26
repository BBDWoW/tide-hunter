import { newRun, rollEncounter, ZONES, rollCrew, type RunState } from '../../src/game/run';
import { makeMon } from '../../src/game/creature';
import { FORMS } from '../../src/data/creatures';
const meta = { pearls: 0, bay: [], upgrades: {} } as never;
let err = 0; const seen: Record<string, Set<string>> = {}; let wrongRegional = 0;
for (const z of Object.keys(ZONES)) {
  seen[z] = new Set();
  for (let i = 0; i < 600; i++) {
    try {
      const r = newRun(makeMon('water1', 5), meta) as RunState; r.zone = z as never; r.station = 1 + (i % 9); r.zoneNo = 1;
      r.route[r.station] = [{ kind: 'fish', spot: 'deep' } as never]; r.picked = 0;
      for (const rar of ['N', 'B', 'A', 'S', 'SSR'] as const) {
        const e = rollEncounter(r, Math.random(), { rarity: rar, size: 2, x: 120 } as never);
        seen[z].add(FORMS[e.mon.form].name);
        // 區域限定的進化型態只能在那個區域出現
        for (const f of Object.values(FORMS)) for (const ev of f.evolve ?? []) if (ev.zone && ev.to === e.mon.form && ev.zone !== z) wrongRegional++;
      }
      if (i % 50 === 0) rollCrew(r);
    } catch (x) { err++; if (err < 3) console.log(z, x); }
  }
}
console.log('errors', err, 'wrong regional', wrongRegional);
for (const [z, s] of Object.entries(seen)) console.log(z, s.size, [...s].join(' '));
