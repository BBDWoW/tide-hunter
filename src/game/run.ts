// 一局冒險的狀態：隊伍、道具、航程站點、存檔
import { FORMS, ZONE1_BOSS, ZONE1_POOL } from '../data/creatures';
import { effectiveness, RARITY, RARITY_ORDER, type Rarity } from '../data/types';
import { makeMon, maxHp, type Mon } from './creature';
import { int, makeRng, newSeed, next, weighted, type Rng } from './rng';
import type { ItemId } from './battle';

export type StationKind = 'fish' | 'camp' | 'boss';
export const STATION_INFO: Record<StationKind, { name: string; icon: string }> = {
  fish: { name: '釣點', icon: '🎣' },
  camp: { name: '營地', icon: '⛺' },
  boss: { name: '霸主', icon: '👑' },
};

export interface RunState {
  version: 1;
  seed: number;
  rng: Rng;
  party: Mon[];
  items: Record<ItemId, number>;
  stations: StationKind[];
  station: number;
  shells: number;
  caught: number;
  battlesWon: number;
}

export const PARTY_MAX = 6;

export function newRun(starter: string): RunState {
  const seed = newSeed();
  return {
    version: 1, seed, rng: makeRng(seed),
    party: [makeMon(starter, 5)],
    items: { potion: 3, superpotion: 0, revive: 1, ether: 1 },
    stations: ['fish', 'fish', 'fish', 'camp', 'fish', 'fish', 'fish', 'camp', 'boss'],
    station: 0, shells: 0, caught: 0, battlesWon: 0,
  };
}

export interface Encounter { mon: Mon; rarity: Rarity }

// 拋竿品質 q（0–1）會提高稀有生物出現的機率
export function rollEncounter(run: RunState, q: number): Encounter {
  if (run.stations[run.station] === 'boss') {
    const mon = makeMon(ZONE1_BOSS, 12, true, true);
    return { mon, rarity: FORMS[ZONE1_BOSS].rarity };
  }
  const bonus: Record<Rarity, number> = { N: -q * 15, B: q * 6, A: q * 5, S: q * 3, SSR: q > 0.92 ? 1.5 : q * 0.5 };
  // 第一站固定是普通生物，讓新手先熟悉戰鬥
  let rarity: Rarity = run.station === 0 ? 'N' : weighted(run.rng, RARITY_ORDER.map((r) => [r, Math.max(1, RARITY[r].weight + bonus[r])] as [Rarity, number]));
  let pool: string[] = [];
  for (let i = RARITY_ORDER.indexOf(rarity); i >= 0 && !pool.length; i--) {
    rarity = RARITY_ORDER[i];
    pool = ZONE1_POOL.filter((id) => FORMS[id].rarity === rarity);
  }
  if (run.station === 0) {
    // 第一站避開剋制初始夥伴的屬性
    const mine = FORMS[run.party[0].form].elems;
    const safe = pool.filter((id) => FORMS[id].elems.every((e) => effectiveness(e, mine) <= 1));
    if (safe.length) pool = safe;
  }
  let formId = pool[Math.floor(next(run.rng) * pool.length)];
  const lv = run.station === 0 ? 3 : Math.max(2, Math.round(3 + run.station * 0.9 + int(run.rng, 0, 2)) - ({ N: 0, B: 0, A: 1, S: 2, SSR: 2 } as const)[rarity]);
  const ev = FORMS[formId].evolve?.find((e) => lv >= e.level);
  if (ev) formId = ev.to;
  return { mon: makeMon(formId, lv, false, true), rarity };
}

export function healParty(run: RunState, ratio: number, revive = false) {
  for (const m of run.party) {
    if (m.hp <= 0 && !revive) continue;
    const mx = maxHp(m);
    m.hp = Math.min(mx, Math.max(m.hp, 0) + Math.ceil(mx * ratio));
    m.status = null;
  }
}

// ── 存檔 ──
const SAVE_KEY = 'tidehunter.run.v1';
const DEX_KEY = 'tidehunter.dex.v1';

export function saveRun(run: RunState | null) {
  try { if (run) localStorage.setItem(SAVE_KEY, JSON.stringify(run)); else localStorage.removeItem(SAVE_KEY); } catch { /* 無法存檔時略過 */ }
}
export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as RunState;
    if (r.version !== 1 || !r.party?.every((m) => FORMS[m.form])) return null;
    return r;
  } catch { return null; }
}

export interface Dex { seen: string[]; caught: string[]; bestStation: number; clears: number }
export function loadDex(): Dex {
  try {
    const d = JSON.parse(localStorage.getItem(DEX_KEY) || 'null');
    if (d && Array.isArray(d.seen)) return d;
  } catch { /* 略過 */ }
  return { seen: [], caught: [], bestStation: 0, clears: 0 };
}
export function updateDex(fn: (d: Dex) => void) {
  const d = loadDex();
  fn(d);
  try { localStorage.setItem(DEX_KEY, JSON.stringify(d)); } catch { /* 略過 */ }
}
export const markSeen = (form: string) => updateDex((d) => { if (!d.seen.includes(form)) d.seen.push(form); });
export const markCaught = (form: string) => updateDex((d) => {
  if (!d.seen.includes(form)) d.seen.push(form);
  if (!d.caught.includes(form)) d.caught.push(form);
});
