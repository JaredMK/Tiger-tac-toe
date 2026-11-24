// Point Roll: the computer's play. A pick's worth is its chance of coming before a 7 times its points (never more
// than the points still needed). Normal takes the pick worth the most this turn; Hard the pick that leaves the fewest
// turns still needed (solved exactly: turns(need) = the least of 1 / chance + turns(need - points)); Easy any number.
import { tune } from '../../core/tune.js';
import { PICKS, prollCfg, prollChance } from './rules.js';

const TABLES = new Map();
export function prollTable(c) {
  const key = JSON.stringify([c.target, c.pts]);
  if (TABLES.has(key)) return TABLES.get(key);
  const T = [0];
  for (let need = 1; need <= c.target; need++) { let b = Infinity; for (const n of PICKS) if (c.pts[n] > 0) b = Math.min(b, 1 / prollChance(n) + T[Math.max(0, need - c.pts[n])]); T.push(b); }
  TABLES.set(key, T); return T;
}
export function needs(pm, p) { const c = prollCfg(pm); return prollTable(c)[Math.max(0, c.target - pm.score[p])]; }
// Risk appetite by level (meta.js TUNE, Computer: Easy / Normal / Hard): `aiLong<Level>`, the share of its picks that
// go for a long shot (2, 3, 11 or 12: big points, rarely before a 7) whatever it still needs; the rest by its level's
// judgement (Easy any number, Normal the most this turn, Hard the fewest turns).
const LV = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
export const LONG = { easy: 50, normal: 0, hard: 0 }, LONGS = [2, 3, 11, 12];
export function longShare(pm, level) { const L = LV[level] ? level : 'normal', v = Number(tune(pm)['aiLong' + LV[L]]); return (Number.isFinite(v) && tune(pm)['aiLong' + LV[L]] != null ? v : LONG[L]) / 100; }
export function best(pm, me, rng, style, ctx) {
  const c = prollCfg(pm), level = (ctx && ctx.level) || 'normal', need = c.target - pm.score[me], T = prollTable(c);
  const opts = PICKS.map(n => ({ n, ev: prollChance(n) * Math.min(need, c.pts[n]), t: 1 / prollChance(n) + T[Math.max(0, need - c.pts[n])], win: c.pts[n] >= need ? prollChance(n) : 0, k: rng() }));
  const long = longShare(pm, level);
  if (long > 0 && rng() < long) { const ls = opts.filter(o => LONGS.includes(o.n)), e = ls[Math.floor(rng() * ls.length)]; return { move: e.n, q: e.win }; }
  if (level === 'easy') { const e = opts[Math.floor(rng() * opts.length)]; return { move: e.n, q: e.win }; }
  if (level === 'hard') opts.sort((a, b) => (a.t - b.t) || (b.ev - a.ev) || (a.k - b.k)); else opts.sort((a, b) => (b.ev - a.ev) || (a.k - b.k));
  return { move: opts[0].n, q: opts[0].win };
}
