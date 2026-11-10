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

// ---- Hard: expectimax over the grey pieces, the square solved once it can be ----
// Spots that touch the same regions are alike, so a position is how many of each kind are X's, O's, grey and empty
// (the region tallies kept as the search goes). Every kind for the mover, then every kind the grey could land on
// (weighted by its empty spots; a move that cannot beat the best so far is left as soon as the greys still to count
// could not lift it), the other player's reply, its grey, and so on, with the rule's own result where it comes (more
// than half the regions locked; a full map, most regions led) and the position's eval at the leaves of a search cut
// short. With DIST_AI.solve spots empty or fewer the square is solved to its end, exactly (the chance of each result
// under best play by both; given up for the search where it would cost more than DIST_AI.work positions), and what
// is solved is kept for the square's later moves (DIST_MEMO, by map); above that two or three moves deep, deeper
// while the clock allows.
// A level map is a draw and the square resets (core/board.js): DIST_AI.draw is what that is worth to the side that
// moved first in the square, from -1 (as bad as losing it) to 1; 0 holds a reset square as worth half a square to each.
export const DIST_AI = { solve: 10, mid: 12, draw: 0, keep: 6, cap: 300000, sure: 8, work: 6000 };   // solve: spots empty at most for the exact solve with no clock (above `sure`, given up after `work` positions); mid: for three moves deep (else two); keep: maps whose solved positions are kept; cap: positions kept a map
const DIST_MEMO = new Map();                                     // map signature -> Map(position -> X's exact value)
export function distExpecti(pm, me, until, rng) {
  const map = pm.map, who = pm.who, o = other(me), R = map.regions.length, grey = pm.grey !== false;
  const need = Math.floor(R / 2) + 1;                            // the locks that take the square
  const kinds = [], of = {};                                     // the kinds of spot: the regions touched
  map.spots.forEach((s, k) => { const key = s.r.join(','); if (of[key] == null) { of[key] = kinds.length; kinds.push({ r: s.r, spots: [], x: 0, o: 0, e: 0 }); } const g = kinds[of[key]]; g.spots.push(k); if (who[k] === 'X') g.x++; else if (who[k] === 'O') g.o++; else if (!who[k]) g.e++; });
  const G = kinds.length, tx = new Array(R).fill(0), to = new Array(R).fill(0), te = new Array(R).fill(0);   // the tallies: X's, O's, empty, by region
  for (const g of kinds) for (const r of g.r) { tx[r] += g.x; to[r] += g.o; te[r] += g.e; }
  const empty = kinds.reduce((n, g) => n + g.e, 0);
  let nx = 0, no = 0; for (const g of kinds) { nx += g.x; no += g.o; }
  // who moved first in the square: the side to move when both have placed as many (with the greys, an even split of the spots)
  const firstX = (me === 'X') === (nx === no);
  const tieX = (firstX ? 1 : -1) * DIST_AI.draw;                 // a level map, for X
  const put = (g, side, d) => { const k = kinds[g]; k.e -= d; if (side === 1) k.x += d; else if (side === 2) k.o += d; for (const r of k.r) { te[r] -= d; if (side === 1) tx[r] += d; else if (side === 2) to[r] += d; } };
  let nodes = 0, out = false;
  let cap = Infinity;                                            // (no clock: the positions a solve may cost before it is given up)
  const tick = () => { nodes++; if (until ? (nodes & 255) === 0 && until() <= 0 : nodes > cap) out = true; };
  const final = () => { let x = 0, y = 0; for (let r = 0; r < R; r++) { if (tx[r] > to[r]) x++; else if (to[r] > tx[r]) y++; } return x > y ? 1 : y > x ? -1 : tieX; };
  const locked = () => { let x = 0, y = 0; for (let r = 0; r < R; r++) { if (tx[r] > to[r] + te[r]) x++; else if (to[r] > tx[r] + te[r]) y++; } return x >= need ? 1 : y >= need ? -1 : 0; };   // the square taken by locks: 1 X's, -1 O's
  const leaf = () => { let v = 0; for (let r = 0; r < R; r++) { const m = tx[r], th = to[r], e = te[r]; v += m > th + e ? 1 : th > m + e ? -1 : 0.6 * (m - th) / (e + 1); } return Math.max(-0.9, Math.min(0.9, v / R)); };
  const keyOf = () => { let k = ''; for (const g of kinds) k += String.fromCharCode(40 + g.x * 100 + g.o * 10 + g.e); return k; };
  const sig = (grey ? 'g' : 'n') + DIST_AI.draw + (firstX ? 'x' : 'o') + '|' + kinds.map(g => g.r.join('.') + '*' + g.spots.length).join('|');
  let exact = DIST_MEMO.get(sig);
  if (!exact) { exact = new Map(); DIST_MEMO.set(sig, exact); if (DIST_MEMO.size > DIST_AI.keep) DIST_MEMO.delete(DIST_MEMO.keys().next().value); }
  else { DIST_MEMO.delete(sig); DIST_MEMO.set(sig, exact); }      // (the latest used last out)
  if (exact.size > DIST_AI.cap) exact.clear();
  const memo = new Map();
  // X's value with `side` to move (1 X, 2 O), e spots empty; depth: the moves still searched (at least the moves left: to the end)
  const node = (side, depth, e) => {
    const lk = locked(); if (lk) return lk;
    if (!e) return final();
    if (depth === 0) return leaf();
    const whole = depth >= e, pos = keyOf() + side, key = whole ? pos : pos + depth;
    const got = whole ? exact.get(key) : (exact.get(pos) !== undefined ? exact.get(pos) : memo.get(key));
    if (got !== undefined) return got;
    tick();
    let bestV = side === 1 ? -Infinity : Infinity;
    for (let g = 0; g < G && !out; g++) {
      if (!kinds[g].e) continue;
      put(g, side, 1);
      let v = 0, rem = 1;                                        // rem: the weight of the greys still to count (a value is never beyond 1 either way)
      if (e === 1 || !grey) v = node(3 - side, depth - 1, e - 1);
      else for (let h = 0; h < G; h++) { const w = kinds[h].e / (e - 1); if (!w) continue; put(h, 0, 1); v += w * node(3 - side, depth - 1, e - 2); put(h, 0, -1); rem -= w; if (out || (side === 1 ? v + rem <= bestV : v - rem >= bestV)) break; }
      put(g, side, -1);
      if (side === 1 ? v > bestV : v < bestV) bestV = v;
    }
    if (!out) (whole ? exact : memo).set(key, bestV);
    return bestV;
  };
  const mine = me === 'X' ? 1 : 2, sgn = me === 'X' ? 1 : -1;
  const pick = depth => {                                        // the kind to take: its value for me
    let top = null;
    for (let g = 0; g < G && !out; g++) {
      if (!kinds[g].e) continue;
      put(g, mine, 1);
      let v = 0, rem = 1;
      if (empty === 1 || !grey) v = sgn * node(3 - mine, depth - 1, empty - 1);
      else for (let h = 0; h < G; h++) { const w = kinds[h].e / (empty - 1); if (!w) continue; put(h, 0, 1); v += w * sgn * node(3 - mine, depth - 1, empty - 2); put(h, 0, -1); rem -= w; if (out || (top && v + rem <= top.v)) break; }
      put(g, mine, -1);
      if (out) break;                                            // (the clock: this kind's value is not whole)
      if (!top || v > top.v) top = { g, v };
    }
    return top;
  };
  let got = null;
  if (!until) {
    if (empty <= DIST_AI.solve) { cap = empty <= DIST_AI.sure ? Infinity : DIST_AI.work; got = pick(empty); if (out) { got = null; out = false; nodes = 0; cap = Infinity; } }   // (too big a solve: the search instead; what it did solve is kept)
    if (!got && empty <= DIST_AI.mid) { cap = DIST_AI.work; got = pick(3); if (out) { got = null; out = false; nodes = 0; cap = Infinity; } }
    if (!got) got = pick(2);
  }
  else { for (let d = 2; !out && d < empty; d++) { const r = pick(d); if (!out || !got) got = r; } if (!out) { const ex = pick(empty); if (!out || !got) got = ex; } }
  if (!got) { const b = distSearch(pm, me, null); return { k: b.k, v: 0, after: b.after }; }   // (no time at all: the ordinary search)
  const spots = kinds[got.g].spots.filter(k => !who[k]), k = spots[rng ? randInt(rng, spots.length) : 0];   // (any empty spot of the kind: alike)
  const after = who.slice(); after[k] = me;
  return { k, v: got.v, after };
}
