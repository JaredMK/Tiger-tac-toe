// Shelves: the computer's play.
import { other } from '../../core/util.js';
import { raceNeeds } from '../shared/placement.js';
import { randInt } from '../../core/random.js';
import { shelfCfg, shelfOn, shelfPick } from './rules.js';

export function needs(pm, p) {
  const e = pm.cells.filter(c => !c).length, per = shelfCfg(pm).per; return e ? raceNeeds(shelfOn(pm.cells, p, per) - shelfOn(pm.cells, other(p), per), e / 4, 1) : Infinity;
}
export function best(pm, me, rng, style, ctx) {
  const cf = shelfCfg(pm), e = pm.cells.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
  const b = cf.miss && rng() < cf.miss / 100 ? { i: e[randInt(rng, e.length)] } : ctx && ctx.level === 'hard' ? shelfSolve(pm, me, cf, ctx.until) : shelfPick(pm, me, rng), a = pm.cells.slice(); a[b.i] = me; return { move: b.i, after: { type: 'shelves', cells: a } };
}

// ---- Hard: the square solved ----
// A shelf is only how many spots are filled and who is on it, and shelves are alike, so a position is a
// multiset of shelf kinds: a few thousand on the usual board, every one solved exactly (expectimax over the
// grey mark, from the mover's side, with a memo). A board too big for that (the admin's settings) is searched
// a few moves deep with a plain eval at the leaves, deeper while the clock allows.
const KIND = (f, m, t) => f * 4 + m + 2 * t;                     // f spots filled, m: the mover is on it, t: the other player is
const POW = Array.from({ length: 20 }, (_, k) => 3 * Math.pow(8, k));   // (a kind's place in a position's number)
export function shelfSolve(pm, me, cf, until) {
  const per = cf.per, cells = pm.cells, n = Math.ceil(cells.length / per), o = other(me);
  const K = 4 * (per + 1), counts = new Array(K).fill(0), shelves = [];   // shelves: each shelf's kind, to turn a kind back into a spot
  for (let s = 0; s < n; s++) {
    const row = cells.slice(s * per, s * per + per);
    const k = KIND(row.filter(Boolean).length, row.includes(me) ? 1 : 0, row.includes(o) ? 1 : 0); shelves.push(k); counts[k]++;
  }
  const tie = pm.first ? (other(pm.first) === me ? 1 : -1) : cells.some(Boolean) ? 0 : -1;   // ties to the mover, to the other player (opening the square makes them mine to lose), or to nobody (a square from before)
  let bound = 1; for (let j = 1; j <= n; j++) bound = bound * (4 * per - 1 + j) / j;   // multisets of n shelves over the 4 * per kinds a shelf can be
  const memo = new Map();
  let nodes = 0, out = false;
  const tick = () => { if (until && (++nodes & 255) === 0 && until() <= 0) out = true; };
  // value for the mover: +1 a win, -1 a loss, 0 a reset
  const solve = (c, t, depth) => {
    let empty = 0, on = 0, off = 0, canM = 0, canT = 0;
    for (let k = 0; k < K; k++) { if (!c[k]) continue; const f = Math.floor(k / 4), m = k & 1, th = (k >> 1) & 1; empty += c[k] * (per - f); on += m * c[k]; off += th * c[k]; if (f < per) { canM += (1 - m) * c[k]; canT += (1 - th) * c[k]; } }
    if (!empty) return on > off ? 1 : off > on ? -1 : t;
    if (depth === 0) return Math.max(-0.9, Math.min(0.9, (on - off + 0.5 * (canM - canT)) / n));
    let key = t + 1; for (let k = 0; k < K; k++) if (c[k]) key += c[k] * POW[k]; key = key * 64 + (depth === Infinity ? 63 : depth);   // (counts under 8, kinds under 17, depth under 63: a number)
    const got = memo.get(key); if (got !== undefined) return got;
    tick();
    let bestV = -Infinity;
    for (let k = 0; k < K && !out; k++) {
      if (!c[k] || Math.floor(k / 4) >= per) continue;
      const kk = (k | 1) + 4; c[k]--; c[kk]++;                       // my mark: one more filled, me on it
      let v = 0;
      if (empty === 1) v = -solve(swap(c), -t, depth);              // the last spot: no grey
      else {
        for (let j = 0; j < K; j++) {
          if (!c[j]) continue;
          const f = Math.floor(j / 4), w = c[j] * (per - f) / (empty - 1);
          if (!w) continue;
          c[j]--; c[j + 4]++;
          v -= w * solve(swap(c), -t, depth - 1);
          c[j + 4]--; c[j]++;
          if (out) break;
        }
      }
      c[kk]--; c[k]++;
      if (v > bestV) bestV = v;
    }
    if (!out) memo.set(key, bestV);
    return bestV;
  };
  const swap = c => { const s = new Array(K).fill(0); for (let k = 0; k < K; k++) if (c[k]) s[(k & ~3) + ((k & 1) << 1) + ((k >> 1) & 1)] = c[k]; return s; };
  const pick = depth => {                                        // the kind to mark, by the value after it
    let top = null;
    for (let k = 0; k < K && !out; k++) {
      if (!counts[k] || Math.floor(k / 4) >= per) continue;
      const c = counts.slice(); c[k]--; c[(k | 1) + 4]++;
      let v = 0, empty = 0; for (let j = 0; j < K; j++) empty += c[j] * (per - Math.floor(j / 4));
      if (!empty) v = -solve(swap(c), -tie, depth);
      else for (let j = 0; j < K; j++) { if (!c[j]) continue; const w = c[j] * (per - Math.floor(j / 4)) / empty; if (!w) continue; c[j]--; c[j + 4]++; v -= w * solve(swap(c), -tie, depth - 1); c[j + 4]--; c[j]++; if (out) break; }
      if (out) break;                                            // (the clock: this kind's value is not whole)
      if (!top || v > top.v) top = { k, v };
    }
    return top;
  };
  let got = null;
  if (bound <= 60000) { if (until) got = pick(2); const ex = pick(Infinity); if (!out || !got) got = ex; }   // (with a clock, a quick look first: the solve may be cut short)
  else if (!until) got = pick(4);
  else for (let d = 2; !out && d <= 2 * n * per; d++) { const r = pick(d); if (!out || !got) got = r; }
  if (!got) return shelfPick(pm, me, null);                      // (no time at all: the ordinary pick)
  const s = shelves.indexOf(got.k), at = cells.findIndex((c, i) => !c && Math.floor(i / per) === s);
  return { i: at, v: got.v };
}
