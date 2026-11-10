// Risky Spins: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { other } from '../../core/util.js';
import { SKULL, pushYourLuck, wheelTurn, wheelsOf } from './rules.js';

// Each wheel's numbers: its skull chance (r), its average (of the values), its values' chances. Per square (its
// wheels and target), kept a while. A square has two wheels (high, low), or three if it was dealt so before November 2026
// (high, mid, low): every function here reads the wheels the square has (wheelsOf), never a fixed list.
const MEMO = new Map();
function facts(pm) {
  const ws = wheelsOf(pm), key = pm.target + ':' + ws.map(w => w + '=' + pm.wheels[w].join(',')).join('|');
  let f = MEMO.get(key);
  if (f) return f;
  if (MEMO.size >= 12) MEMO.delete(MEMO.keys().next().value);
  f = { key, T: pm.target, ws, w: {} };
  for (const w of ws) {
    const v = pm.wheels[w], vals = v.filter(x => x !== SKULL), r = (v.length - vals.length) / v.length;
    f.w[w] = { r, avg: vals.length ? vals.reduce((t, x) => t + x, 0) / vals.length : 0, vals, n: v.length, gain: vals.reduce((t, x) => t + x, 0) / v.length };
  }
  // The turn that banks the most on average: one wheel, spun until the pot reaches its K (its expected bank, E:
  // rules.js wheelTurn); and the pot Normal banks at, level: the first no wheel's spin adds more to than it risks.
  let best = { w: 'low', K: 1, E: 0 }, bankAt = 1;
  f.K = {};
  for (const w of ws) {
    const { K, E } = wheelTurn(pm.wheels[w], f.T);
    f.K[w] = K;
    if (E > best.E) best = { w, K, E };
    bankAt = Math.max(bankAt, K);
  }
  f.best = best; f.bankAt = bankAt;
  MEMO.set(key, f);
  return f;
}
// A turn on one wheel from a pot, spun until the pot reaches k, then banked: what it ends with, as chances by pot
// (0: a skull, the pot lost). The turns it takes to bank x more points, turn after turn (TURNS[x]): each turn on the
// wheel that gets there soonest, to its own bank-at score (rules.js wheelTurn's K) or to what is still needed when
// that is less; a skull is a turn spent with nothing banked.
function turnEnds(y, from, k) {
  const pr = new Float64Array(k + 11), out = new Map();
  pr[from] = 1;
  for (let p = from; p < k + 10; p++) {
    if (!pr[p]) continue;
    if (p >= k) { out.set(p, (out.get(p) || 0) + pr[p]); continue; }
    out.set(0, (out.get(0) || 0) + pr[p] * y.r);
    for (const v of y.vals) pr[p + v] += pr[p] / y.n;
  }
  if (pr[k + 10]) out.set(k + 10, (out.get(k + 10) || 0) + pr[k + 10]);
  return out;
}
function turnsTo(f, x) {
  const t = f.turns || (f.turns = [0]);
  for (let r = t.length; r <= x; r++) {
    let top = Infinity;
    for (const w of f.ws) {
      const y = f.w[w]; if (!y.vals.length) continue;
      let sum = 1, stay = 0;
      for (const [v, pr] of turnEnds(y, 0, Math.min(r, f.K[w]))) { if (v === 0) stay = pr; else sum += pr * t[Math.max(0, r - v)]; }
      const n = sum / (1 - stay);
      if (n < top) top = n;
    }
    t[r] = top;
  }
  return t[x];
}
// The moves (turns) a side still needs: the points still needed against what its turns bank (turnsTo); in its own
// turn under way, this turn (from its pot, on the wheel that leaves the fewest) and the turns after it.
export function needs(pm, p) {
  const r = pm.target - pm.pts[p];
  if (r <= 0) return 0;
  if (!pushYourLuck(pm)) { let g = 0; for (const w of wheelsOf(pm)) g = Math.max(g, facts(pm).w[w].gain); return Math.max(0.5, r / Math.max(0.5, g)); }   // (a square from before the skulls: every spin scores)
  const f = facts(pm), t = pm.turn && pm.turn.by === p ? pm.turn : null;
  if (!(r <= 200)) return Math.max(0.5, r / Math.max(0.5, f.best.E));
  if (!t || !t.pot) return turnsTo(f, r);
  if (t.pot >= r) return 0.5;                                 // (only Bank is left: it wins with the next tap)
  let top = Infinity;
  for (const w of f.ws) {
    const y = f.w[w]; if (!y.vals.length) continue;
    let n = 1;
    for (const [v, pr] of turnEnds(y, t.pot, Math.max(t.pot, Math.min(r, f.K[w])))) n += pr * turnsTo(f, Math.max(0, r - v));
    if (n < top) top = n;
  }
  return top;
}
// The chance this spin of wheel w reaches the target (a + pot + its points).
const reach = (pm, w, need) => pm.wheels[w].filter(v => v !== SKULL && v >= need).length / pm.wheels[w].length;
export function best(pm, me, rng, style, ctx) {
  const T = pm.target, a = pm.pts[me], b = pm.pts[other(me)], miss = tune(pm).miss;
  const t = pushYourLuck(pm) && pm.turn && pm.turn.by === me ? pm.turn : null, pot = t ? t.pot : 0, need = T - a - pot;
  if (t && need <= 0) return { move: 'bank', q: 1 };          // enough: only Bank is left
  if (miss && rng() * 100 < miss) { const ws = wheelsOf(pm), w = ws[randInt(rng, ws.length)]; return { move: w, q: reach(pm, w, need) }; }   // (now and then, the admin's mistake rate: any wheel)
  const f = facts(pm);
  if (!pushYourLuck(pm)) {                                    // the old rule: the best average, the riskier wheel when it can finish
    let w = 'low'; for (const k of f.ws) if (reach(pm, k, need) > reach(pm, w, need) || (reach(pm, k, need) === reach(pm, w, need) && f.w[k].gain > f.w[w].gain)) w = k;
    return { move: w, q: reach(pm, w, need) };
  }
  if (ctx && ctx.level === 'hard') { const h = hard(pm, me, f, style, ctx.until); if (h) return h; }
  // Normal: bank once the pot reaches the bank-at score (level, the first pot no wheel's spin is worth; more when behind, less when ahead; a
  // bolder style or the admin's setting shifts it); else the wheel whose spin adds the most to the pot on average,
  // the pot it risks counted against it (a riskier wheel is worth it only on a small pot).
  const gap = b - a, base = f.bankAt;
  const K = Math.max(2, Math.min(base + 10, base + Math.round(gap / 4) + ((style && style.rollRisk) || 0)));
  if (t && pot >= Math.min(K, need)) return { move: 'bank', q: 0 };
  let w = null, g = -Infinity;
  for (const k of f.ws) {
    const x = f.w[k], v = x.gain - x.r * pot * (gap > 6 ? 0.7 : 1);   // (well behind: the pot weighs a little less)
    if (v > g) { g = v; w = k; }
  }
  if (t && g <= 0) return { move: 'bank', q: 0 };
  return { move: w, q: reach(pm, w, need) };
}

// ---- Hard: the exact race ----
// P[a][b]: the chance the player to move (no pot yet), a points to the other's b, wins the square, both playing
// their best. A turn is a walk over the pot: at each, bank (1 - P[b][a + pot], or the square once a + pot reaches
// the target) or spin a wheel (a skull is worth 1 - P[b][a]; a value, the pot with it). Pairs (a, b), (b, a) lean
// on each other only through the skull, so each pair is solved as a fixed point (a secant on it), sums a + b from
// the top down (a bank only ever raises the sum). One table per square's wheels and target (RACE), built in slices
// within the time the search may spend (a fixed slice without a clock); until it is done Hard plays Normal's rule.
export const RACE = new Map();
const SLICE = 1e9;                                            // (without a clock: the whole table at the first call, 465 pairs to 30, some 10 to 25 ms a square)
function turnVals(e, a, b, x, V, C) {                          // V[pot]: the turn's worth from (a, b, pot); C[pot] its best move
  const { T, P, f } = e;
  for (let p = T - a; p >= 0; p--) {
    if (a + p >= T) { V[p] = 1; C[p] = 'bank'; continue; }
    let bv = p ? 1 - P[b * T + a + p] : -1, bc = 'bank';
    for (const w of f.ws) {
      const y = f.w[w]; let s = y.r * y.n * x;
      for (const v of y.vals) s += a + p + v >= T ? 1 : V[p + v];
      s /= y.n;
      if (s > bv + 1e-12) { bv = s; bc = w; }
    }
    V[p] = bv; C[p] = bc;
  }
  return V[0];
}
export function wheelsRace(pm, until) {
  const f = facts(pm);
  let e = RACE.get(f.key);
  if (!e) {
    if (RACE.size >= 6) RACE.delete(RACE.keys().next().value);
    const T = f.T;
    e = { T, f, P: new Float64Array(T * T), s: 2 * T - 2, a: T - 1, done: false, V: new Float64Array(T + 12), C: new Array(T + 12) };
    RACE.set(f.key, e);
  }
  if (e.done) return e;
  const { T, P, V, C } = e;
  const F = (a, b, x) => turnVals(e, a, b, x, V, C);
  let left = until ? Infinity : SLICE;
  while (e.s >= 0) {
    const a = e.a, b = e.s - a;
    if (b >= 0 && b < T && a < T && a >= b) {
      if (until ? until() <= 0 : left-- <= 0) return e;
      let o = 0;
      const G = p => { o = a === b ? 0 : F(b, a, 1 - p); return F(a, b, 1 - (a === b ? p : o)); };
      let p0 = a + 1 < T ? P[(a + 1) * T + b] : 0.5, h0 = G(p0) - p0, p1 = Math.min(1, Math.max(0, p0 + h0)), h1 = G(p1) - p1;
      for (let it = 0; it < 24 && Math.abs(h1) > 1e-7; it++) {
        const d = h1 - h0, p2 = Math.min(1, Math.max(0, Math.abs(d) > 1e-12 ? p1 - h1 * (p1 - p0) / d : p1 + h1));
        p0 = p1; h0 = h1; p1 = p2; h1 = G(p1) - p1;
      }
      P[a * T + b] = p1 + h1; P[b * T + a] = a === b ? p1 + h1 : o;
    }
    if (--e.a < 0) { e.s--; e.a = Math.min(T - 1, e.s); }
  }
  e.done = true;
  return e;
}
function hard(pm, me, f, style, until) {
  const e = wheelsRace(pm, until);
  if (!e || !e.done) return null;
  const T = e.T, a = pm.pts[me], b = pm.pts[other(me)], t = pm.turn && pm.turn.by === me ? pm.turn : null;
  const shift = (style && style.rollRisk) || 0, pot = t ? Math.max(0, t.pot - shift) : 0;   // bolder: it plays as if the pot were that much smaller
  turnVals(e, a, b, 1 - e.P[b * T + a], e.V, e.C);
  let c = e.C[Math.min(T - a, pot)];
  if (c === 'bank' && !(t && t.pot)) c = f.best.w;             // (no pot: a spin it must make)
  return { move: c, q: c === 'bank' ? 0 : reach(pm, c, T - a - (t ? t.pot : 0)) };
}
