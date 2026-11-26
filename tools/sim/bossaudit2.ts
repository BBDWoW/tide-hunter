import { gachaPool } from '../../src/game/meta';
import { hatchEgg } from '../../src/game/eggs';

const X = new Set(['whale', 'frostking', 'lavadragon', 'mainframe_leviathan', 'nether_whale', 'vine_antler_deer', 'void_star_dragon', 'domain_realm_core', 'tide_moxu', 'godhand']);
for (const r of ['N', 'B', 'A', 'S', 'SSR'] as const) { const h = gachaPool(r).filter((x) => X.has(x)); if (h.length) console.log('gacha', r, h); }
let leak = 0;
for (const z of ['shallows', 'ice', 'lava', 'cyber', 'abyss', 'forest', 'void', 'core'] as const) for (let i = 0; i < 400; i++) {
  const m = { eggs: [{ id: 'e', zone: z, left: 0, total: 2, warm: 3 }], bay: [], pearls: 0 } as never;
  const r = hatchEgg(m, 'e', () => Math.random()); if (r && r.ok && X.has(r.mon.form)) leak++;
}
console.log('egg leaks', leak);


