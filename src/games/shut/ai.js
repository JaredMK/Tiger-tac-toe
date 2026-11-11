// Shut the Box: the computer's play.
import { randInt } from '../../core/random.js';
import { goAgain, tune } from '../../core/tune.js';
import { shutCfg, shutDice, shutN, shutSum, shutWays } from './rules.js';

// The box is small (at most 9 tiles: 512 sets of open tiles), so everything is worked out exactly, once per box
// (tiles, one-die point):
//  - V[S]: the turns still needed from open tiles S with "Go again on success" off (a turn is one roll and its
//    flip), each roll's tiles chosen to make V least;
//  - F[S]: the same with it on (a turn ends only on a roll no tiles make): the failed rolls still to come, F least;
//  - P[S]: with it on, the chance of shutting the box from S without a failed roll (this turn), P greatest.
// Hard flips by the measure for the switch; Normal by a player's rule of thumb (the fewest tiles, the highest
// first); Easy any tiles that make the roll. q: the chance this turn shuts the box.
const TABLES = new Map();
const DICE = n => {                                                // [total, chance] for one die or two
  const out = new Map();
  if (n === 1) for (let a = 1; a <= 6; a++) out.set(a, 1 / 6);
  else for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) out.set(a + b, (out.get(a + b) || 0) + 1 / 36);
  return [...out];
};
export function shutTables(N, oneDie) {
  const key = N + ':' + oneDie;
  if (TABLES.has(key)) return TABLES.get(key);
  const size = 1 << N, sum = new Int16Array(size), V = new Float64Array(size), F = new Float64Array(size), P = new Float64Array(size);
  for (let S = 1; S < size; S++) for (let i = 0; i < N; i++) if (S >> i & 1) sum[S] += i + 1;
  const subsBySum = S => { const m = new Map(); for (let T = S; T; T = (T - 1) & S) { const s = sum[T]; if (!m.has(s)) m.set(s, []); m.get(s).push(T); } return m; };
  const order = Array.from({ length: size }, (_, S) => S).sort((a, b) => sum[a] - sum[b]);
  P[0] = 1;
  for (const S of order) {
    if (!S) continue;
    const by = subsBySum(S), rolls = DICE(sum[S] <= oneDie ? 1 : 2);
    let pn = 0, aV = 0, aF = 0, aP = 0;
    for (const [r, pr] of rolls) {
      const ts = by.get(r);
      if (!ts) { pn += pr; continue; }
      let v = Infinity, f = Infinity, q = -1;
      for (const T of ts) { const R = S & ~T; v = Math.min(v, V[R]); f = Math.min(f, F[R]); q = Math.max(q, P[R]); }
      aV += pr * v; aF += pr * f; aP += pr * q;
    }
    V[S] = pn >= 1 ? 1e6 : (1 + aV) / (1 - pn);                    // (a box no roll can ever finish: never with the defaults)
    F[S] = pn >= 1 ? 1e6 : (pn + aF) / (1 - pn);
    P[S] = aP;
  }
  const t = { N, V, F, P, sum };
  TABLES.set(key, t);
  return t;
}
const mask = up => up.reduce((a, u, k) => (u ? a | (1 << k) : a), 0);
const maskOf = tiles => tiles.reduce((a, t) => a | (1 << (t - 1)), 0);
const tablesOf = pm => { const c = shutCfg(pm); return shutTables(shutN(pm), c.oneDie); };
// The turns p still needs (the main board's choice of square): exact, by the switch.
export function needs(pm, p) {
  const t = tablesOf(pm), S = mask(pm.up[p]);
  if (!S) return 0;
  return Math.max(1, goAgain(pm) ? 1 + t.F[S] : t.V[S]);
}
// Normal's rule of thumb: the fewest tiles, then the highest tile, then the next.
const thumb = ways => ways.slice().sort((a, b) => a.length - b.length || b[b.length - 1] - a[a.length - 1] || (a.join() < b.join() ? 1 : -1))[0];
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', up = pm.up[me], t = tablesOf(pm), on = goAgain(pm), S = mask(up);
  if (!pm.roll || pm.roll.by !== me) {                            // Roll; q: the chance this turn shuts the box
    let q = 0;
    if (on) q = t.P[S];
    else for (const [r, pr] of DICE(shutDice(up, shutCfg(pm)))) if (r === t.sum[S]) q += pr;   // (off: one flip a turn, so only a roll of everything left)
    return { move: 'roll', q };
  }
  const ways = shutWays(up, shutSum(pm.roll.d));
  if (!ways.length) return { move: 'drop', q: 0 };
  const miss = tune(pm).miss;
  let pick;
  if (level === 'easy' || (miss && rng() * 100 < miss)) pick = ways[randInt(rng, ways.length)];
  else if (level === 'hard') {
    let bv = Infinity;
    for (const w of ways) { const R = S & ~maskOf(w), v = on ? -t.P[R] * 1e3 + t.F[R] : t.V[R]; if (v < bv - 1e-12) { bv = v; pick = w; } }
  } else pick = thumb(ways);
  const R = S & ~maskOf(pick);
  return { move: pick, q: !R ? 1 : on ? t.P[R] : 0 };
}
