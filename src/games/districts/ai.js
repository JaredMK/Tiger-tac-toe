// Districts: the computer's play.
import { other } from '../../core/util.js';
import { raceNeeds } from '../shared/placement.js';
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { distEval, distSearch, distTally } from './rules.js';

export function needs(pm, p) {
  const e = pm.who.filter(w => !w).length; return e ? raceNeeds(distEval(pm.map, pm.who, p), e / 2, 1.2) : Infinity;
}
export function best(pm, me, rng, style, ctx) {
  const miss = tune(pm).miss, e = pm.who.map((w, k) => (w ? -1 : k)).filter(k => k >= 0);
  if (miss && rng() < miss / 100) { const k = e[randInt(rng, e.length)], a = pm.who.slice(); a[k] = me; return { move: k, after: { type: 'districts', map: pm.map, who: a } }; }   // (the admin's settings: a mistake now and then, any empty spot)
  const b = ctx && ctx.level === 'hard' ? distExpecti(pm, me, ctx.until, rng) : distSearch(pm, me, rng); return { move: b.k, after: { type: 'districts', map: pm.map, who: b.after } };
}

// ---- Hard: expectimax over the grey pieces ----
// Spots that touch the same regions are alike, so a position is how many of each kind are X's, O's, grey
// and empty (the region tallies kept as the search goes). Every kind for the mover, then every kind the
// grey could land on (weighted by its empty spots), the other player's reply, its grey, and so on, with
// the position's eval at the leaves (distEval's reckoning) and the rule's own result once the map is full
// (most regions; the tie to whoever did not open the square); a memo of the positions met. The last moves
// are solved to the end, the opening two or three moves deep, deeper while the clock allows.
const FULL = 8, MID = 12;                                        // spots empty at most for the square to be solved to the end; for three moves deep (else two)
export function distExpecti(pm, me, until, rng) {
  const map = pm.map, who = pm.who, o = other(me), R = map.regions.length, grey = pm.grey !== false;
  const first = pm.first || me;                                  // (who opened it: me, when I am opening it now)
  const kinds = [], of = {};                                     // the kinds of spot: the regions touched
  map.spots.forEach((s, k) => { const key = s.r.join(','); if (of[key] == null) { of[key] = kinds.length; kinds.push({ r: s.r, spots: [], x: 0, o: 0, e: 0 }); } const g = kinds[of[key]]; g.spots.push(k); if (who[k] === me) g.x++; else if (who[k] === o) g.o++; else if (!who[k]) g.e++; });
  const G = kinds.length, tx = new Array(R).fill(0), to = new Array(R).fill(0), te = new Array(R).fill(0);   // the tallies: mine, theirs, empty, by region
  for (const g of kinds) for (const r of g.r) { tx[r] += g.x; to[r] += g.o; te[r] += g.e; }
  const empty = kinds.reduce((n, g) => n + g.e, 0);
  const put = (g, side, d) => { const k = kinds[g]; k.e -= d; if (side === 1) k.x += d; else if (side === 2) k.o += d; for (const r of k.r) { te[r] -= d; if (side === 1) tx[r] += d; else if (side === 2) to[r] += d; } };
  let nodes = 0, out = false;
  const tick = () => { if (until && (++nodes & 255) === 0 && until() <= 0) out = true; };
  const final = () => { let x = 0, y = 0; for (let r = 0; r < R; r++) { if (tx[r] > to[r]) x++; else if (to[r] > tx[r]) y++; } return x > y ? 1 : y > x ? -1 : other(first) === me ? 1 : -1; };
  const leaf = () => { let v = 0; for (let r = 0; r < R; r++) { const m = tx[r], th = to[r], e = te[r]; v += m > th + e ? 1 : th > m + e ? -1 : 0.6 * (m - th) / (e + 1); } return Math.max(-0.9, Math.min(0.9, v / R)); };
  const keyOf = () => { let k = ''; for (const g of kinds) k += String.fromCharCode(40 + g.x * 100 + g.o * 10 + g.e); return k; };
  const memo = new Map();
  const node = (p, depth, e) => {                                // the value for me, p to move, e spots empty
    if (!e) return final();
    if (depth === 0) return leaf();
    const key = keyOf() + p + depth;
    const got = memo.get(key); if (got !== undefined) return got;
    tick();
    const side = p === me ? 1 : 2;
    let bestV = p === me ? -Infinity : Infinity;
    for (let g = 0; g < G && !out; g++) {
      if (!kinds[g].e) continue;
      put(g, side, 1);
      let v = 0, rem = 1;                                        // rem: the weight of the greys still to count (a value is never beyond 1 either way: a move that cannot beat the best so far is left)
      if (e === 1 || !grey) v = node(other(p), depth - 1, e - 1);
      else for (let h = 0; h < G; h++) { const w = kinds[h].e / (e - 1); if (!w) continue; put(h, 0, 1); v += w * node(other(p), depth - 1, e - 2); put(h, 0, -1); rem -= w; if (out || (side === 1 ? v + rem <= bestV : v - rem >= bestV)) break; }
      put(g, side, -1);
      if (p === me ? v > bestV : v < bestV) bestV = v;
    }
    if (!out) memo.set(key, bestV);
    return bestV;
  };
  const pick = depth => {
    let top = null;
    for (let g = 0; g < G && !out; g++) {
      if (!kinds[g].e) continue;
      put(g, 1, 1);
      let v = 0, rem = 1;
      if (empty === 1 || !grey) v = node(o, depth - 1, empty - 1);
      else for (let h = 0; h < G; h++) { const w = kinds[h].e / (empty - 1); if (!w) continue; put(h, 0, 1); v += w * node(o, depth - 1, empty - 2); put(h, 0, -1); rem -= w; if (out || (top && v + rem <= top.v)) break; }
      put(g, 1, -1);
      if (out) break;                                            // (the clock: this kind's value is not whole)
      if (!top || v > top.v) top = { g, v };
    }
    return top;
  };
  let got = null;
  if (empty <= FULL) { if (until) got = pick(2); const ex = pick(empty); if (!out || !got) got = ex; }   // (with a clock, a quick look first: the solve may be cut short)
  else if (!until) got = pick(empty <= MID ? 3 : 2);
  else for (let d = 2; !out && d <= empty; d++) { const r = pick(d); if (!out || !got) got = r; }
  if (!got) { const b = distSearch(pm, me, null); return { k: b.k, v: 0, after: b.after }; }   // (no time at all: the ordinary search)
  const spots = kinds[got.g].spots.filter(k => !who[k]), k = spots[rng ? randInt(rng, spots.length) : 0];   // (any empty spot of the kind: alike)
  const after = who.slice(); after[k] = me;
  return { k, v: got.v, after };
}
