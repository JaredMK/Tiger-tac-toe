// Risky Rolls: the computer's play.
import { tune } from '../../core/tune.js';
import { other } from '../../core/util.js';
import { pigGoal, pigMaxRolls, pigSides } from './rules.js';

// The race, from the real state: a turn rolls until its pot reaches the bank-at score (BEST_POT, or what is still
// needed when that is less) and banks, or busts. TURN[sides][k] is what such a turn ends with when it stops at k
// (each pot's chance; 0 a bust), from the die's sets of numbers (pigSets below); TURNS[sides][r] the turns it
// takes on average to bank r more points, turn after turn (`needs`); REACH the chance a turn from a set of numbers
// already rolled makes r more points before a bust (what a turn going for the square wins it with: `best`'s q).
const BEST_POT = { 6: 9, 8: 12 };
const TURN = {}, TURNS = {}, REACH = {};
function pigTurnDist(sides, S, k) {                            // the pots a turn from set S ends with, banking once it has k: { pot: chance }
  const { pot } = pigSets(sides), out = new Map();
  const walk = (S, pr) => {
    if (pot[S] >= k) { out.set(pot[S], (out.get(pot[S]) || 0) + pr); return; }
    for (let f = 0; f < sides; f++) {
      const b = 1 << f;
      if (S & b) out.set(0, (out.get(0) || 0) + pr / sides); else walk(S | b, pr / sides);
    }
  };
  walk(S, 1);
  return out;
}
function pigTurns(sides, r) {                                  // turns to bank r more points (the bank-at rule; the last turn goes for what is left)
  const t = TURNS[sides] || (TURNS[sides] = [0]), turn = TURN[sides] || (TURN[sides] = []);
  for (let x = t.length; x <= r; x++) {
    const k = Math.min(x, BEST_POT[sides]), d = turn[k] || (turn[k] = pigTurnDist(sides, 0, k));
    let sum = 1, stay = 0;
    for (const [v, pr] of d) { if (v === 0) stay = pr; else sum += pr * t[Math.max(0, x - v)]; }
    t[x] = sum / (1 - stay);
  }
  return t[r];
}
export function pigReach(sides, S, r) {                        // the chance a turn from set S makes r more points before a bust
  if (r <= 0) return 1;
  const key = S * 1024 + Math.min(r, 1023), m = REACH[sides] || (REACH[sides] = new Map());
  if (m.has(key)) return m.get(key);
  let pr = 0;
  for (let f = 0; f < sides; f++) if (!(S & (1 << f))) pr += pigReach(sides, S | (1 << f), r - f - 1) / sides;
  m.set(key, pr);
  return pr;
}
const rollSet = rolls => rolls.reduce((S, n) => S | (1 << (n - 1)), 0);
// The moves (turns) a side still needs: the points still needed against what a turn banks; in its own turn under
// way, this turn's chances from the numbers it has rolled.
export function needs(pm, p) {
  const sides = pigSides(pm), t = pm.turn && pm.turn.by === p ? pm.turn : null, r = pigGoal(pm) - pm.bank[p];
  if (r <= 0) return 0;
  if (!t) return pigTurns(sides, r);
  if (t.pot >= r) return 0.5;                                  // (only Bank is left: it wins with the next tap)
  let n = 1;
  for (const [v, pr] of pigTurnDist(sides, rollSet(t.rolls), Math.min(r, t.pot + BEST_POT[sides]))) n += pr * pigTurns(sides, Math.max(0, r - v));
  return n;
}
// Tempo play (core/ai.js safeLead): the chance the other side's next turn here catches the computer up (leaves them
// needing no more turns than it does), going for it: the points that would take, made before a bust.
export function catchRisk(pm, me) {
  const sides = pigSides(pm), o = other(me), r = pigGoal(pm) - pm.bank[o], mine = needs(pm, me);
  if (r <= 0) return 1;
  let x = 1;
  while (x < r && pigTurns(sides, r - x) > mine) x++;
  return pigReach(sides, 0, x);
}
export function best(pm, me, rng, style, ctx) {
  const t = pm.turn && pm.turn.by === me ? pm.turn : null, sides = pigSides(pm), base = BEST_POT[sides], r = pigGoal(pm) - pm.bank[me];
  const gap = pm.bank[other(me)] - pm.bank[me];                // positive when behind
  const target = Math.max(4, Math.min(base + 11, Math.max(base - 3, Math.min(base + 5, base + Math.round(gap / (sides === 8 ? 6 : 4)))) + ((style && style.rollRisk) || 0) + tune(pm).risk));   // riskier when behind, safer when ahead (a bolder or warier style, or the admin's setting, shifts it)
  if (!t) return r <= target ? { move: 'roll', q: pigReach(sides, 0, r), stay: true } : { move: 'roll', q: 0 };   // within reach: the turn goes for the square (q its chance; a bust leaves it as it was)
  if (pm.bank[me] + t.pot >= pigGoal(pm)) return { move: 'bank', q: 1 };
  if (t.rolls.length >= pigMaxRolls(pm)) return { move: 'bank', q: 0 };
  if (ctx && ctx.level === 'hard') { const h = pigHard(pm, me, t, style, ctx.until); if (h) return h; }
  if (t.pot >= target || t.rolls.length / sides > 0.5) return { move: 'bank', q: 0 };
  return { move: 'roll', q: 0 };
}

// ---- Hard: the exact race ----
// P[a][b]: the chance the player to move, a banked to the other's b, wins the square, both playing their best.
// A turn is a walk over the numbers rolled so far (a set: its pot is its sum): at each, bank (1 - P[b][a + pot],
// or the square when a + pot reaches the target) or roll (a bust is worth 1 - P[b][a]; a new number, the set
// with it). Pairs (a, b), (b, a) lean on each other only through the bust, so each is solved as a fixed point
// (a secant on it), sums of a + b from the top down. The table is one per die and target, kept (PIG_RACE),
// built in slices within the time the search may spend (a fixed slice without a clock); until it is done the
// Hard computer plays the usual rule. The target's square is the table: a target past PIG_RACE_MAX keeps the rule.
export const PIG_RACE = new Map();
export const PIG_RACE_MAX = 64;
const SLICE = 150;                                             // pairs a call solves without a clock (about 6 ms for a d8 to 51)
const SETS = {};                                               // per die: each set's pot and count
function pigSets(sides) {
  if (SETS[sides]) return SETS[sides];
  const n = 1 << sides, pot = new Int32Array(n), cnt = new Int8Array(n);
  for (let S = 1; S < n; S++) { const low = S & -S, k = 31 - Math.clz32(low); pot[S] = pot[S ^ low] + k + 1; cnt[S] = cnt[S ^ low] + 1; }
  return (SETS[sides] = { n, pot, cnt });
}
// The turn's values from (a, b) with x the bust's worth: V[S] for every set S (V[0] the turn's), and
// R[S] the roll's alone (a bank's is 1 - P[b][a + pot]).
function pigTurn(e, a, b, x, V, R) {
  const { sides, T, P } = e, { n, pot, cnt } = pigSets(sides), full = n - 1;
  for (let S = full; S >= 0; S--) {
    const pt = pot[S], c = cnt[S];
    const bank = pt ? (a + pt >= T ? 1 : 1 - P[b * T + a + pt]) : -1;
    if (pt && (a + pt >= T || c === sides)) { V[S] = bank; R[S] = -1; continue; }   // only Bank is left
    let roll = c * x, m = ~S & full;
    while (m) { const low = m & -m; roll += V[S | low]; m ^= low; }
    roll /= sides;
    R[S] = roll; V[S] = roll > bank ? roll : bank;
  }
}
export function pigRace(sides, T, until) {
  const key = sides + ':' + T;
  let e = PIG_RACE.get(key);
  if (!e) {
    if (T > PIG_RACE_MAX || !BEST_POT[sides]) return null;
    if (PIG_RACE.size >= 6) PIG_RACE.delete(PIG_RACE.keys().next().value);
    e = { sides, T, P: new Float64Array(T * T), s: 2 * T - 2, a: T - 1, done: false, V: new Float64Array(1 << sides), R: new Float64Array(1 << sides) };
    PIG_RACE.set(key, e);
  }
  if (e.done) return e;
  const { T: t, P, V, R } = e;
  const F = (a, b, x) => { pigTurn(e, a, b, x, V, R); return V[0]; };
  let left = until ? Infinity : SLICE;
  while (e.s >= 0) {
    const a = e.a, b = e.s - a;
    if (b >= 0 && b < t && a >= b) {                              // each pair once, the larger bank first
      if (until ? until() <= 0 : left-- <= 0) return e;
      let o = 0;
      const G = p => { o = a === b ? 0 : F(b, a, 1 - p); return F(a, b, 1 - (a === b ? p : o)); };   // my chance again, from a guess p at it (o: the other side's from it)
      let p0 = a + 1 < t ? P[(a + 1) * t + b] : 0.5, h0 = G(p0) - p0, p1 = Math.min(1, Math.max(0, p0 + h0)), h1 = G(p1) - p1;
      for (let it = 0; it < 24 && Math.abs(h1) > 1e-7; it++) {
        const d = h1 - h0, p2 = Math.min(1, Math.max(0, Math.abs(d) > 1e-12 ? p1 - h1 * (p1 - p0) / d : p1 + h1));
        p0 = p1; h0 = h1; p1 = p2; h1 = G(p1) - p1;
      }
      P[a * t + b] = p1 + h1; P[b * t + a] = a === b ? p1 + h1 : o;
    }
    if (--e.a < 0) { e.s--; e.a = Math.min(t - 1, e.s); }
  }
  e.done = true;
  return e;
}
function pigHard(pm, me, t, style, until) {
  const sides = pigSides(pm), T = pigGoal(pm), e = pigRace(sides, T, until);
  if (!e || !e.done) return null;
  const a = pm.bank[me], b = pm.bank[other(me)], { P, V, R } = e;
  pigTurn(e, a, b, 1 - P[b * T + a], V, R);
  let S = 0; for (const n of t.rolls) S |= 1 << (n - 1);
  const shift = ((style && style.rollRisk) || 0) + tune(pm).risk;   // bolder: it banks as if the pot were that much smaller
  const pot = t.pot - shift;
  if (pot < 1) return { move: 'roll', q: 0 };
  const bank = a + pot >= T ? 1 : 1 - P[b * T + a + pot];
  return { move: bank >= R[S] ? 'bank' : 'roll', q: 0 };
}
