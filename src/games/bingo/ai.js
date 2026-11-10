// Bingo: the computer's play. A turn draws first (Pick numbers: the move 'draw', when no offer is waiting), then calls one
// of the offered numbers; what matters is what each call does to both cards
// (a called number marks every card it is on). Normal weighs each offered number by the lines it advances on its own
// card against the lines it advances on the other's (a number that completes its own line is the move; one that
// completes only the other's is never called while another choice exists); Hard looks ahead, within ctx.until: the
// square's exact race where its table is done (bingoExact, below: 3x3 cards), else rollouts to the square's end.
import { needRng, randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { BINGO_DRAW, bingoLines, bingoPool, bingoSettings, bingoSize, bingoDiag } from './rules.js';

const other = p => (p === 'X' ? 'O' : 'X');
// A card's standing: its lines' marks, each line worth more the fuller it is (a complete one is the square).
const W = [0, 1, 3, 9, 27, 81];
function standing(card, called, lines, n) {
  let s = 0, best = 0;
  for (const l of lines) {
    let c = 0;
    for (const i of l) if (called.has(card[i])) c++;
    if (c >= n) return { s: 1e6, best: n, won: true };
    s += W[c] || 0; if (c > best) best = c;
  }
  return { s, best, won: false };
}
// The position from me's side after a set of calls: my standing against theirs (a square won +big, lost -big, a tie 0).
function evalPos(pm, me, called, lines, n) {
  const a = standing(pm.cards[me], called, lines, n), b = standing(pm.cards[other(me)], called, lines, n);
  if (a.won && b.won) return 0;
  if (a.won) return 1e6;
  if (b.won) return -1e6;
  return a.s - b.s;
}
// The moves (calls) p still needs: the fewest unmarked numbers in any line of their card (0 once a line is complete).
export function needs(pm, p) {
  const n = bingoSize(pm), lines = bingoLines(n, bingoDiag(pm)), called = new Set(pm.called || []), card = (pm.cards && pm.cards[p]) || [];
  if (!card.length) return n;
  let best = n;
  for (const l of lines) { let c = 0; for (const i of l) if (called.has(card[i])) c++; best = Math.min(best, n - c); }
  return best;
}
// k distinct numbers from the pool, by the rng (an offer the pool might deal next).
function sample(pool, k, rng) {
  const a = pool.slice(), out = [];
  for (let i = 0; i < k && a.length; i++) { const j = i + randInt(rng, a.length - i); const t = a[i]; a[i] = a[j]; a[j] = t; out.push(a[i]); }
  return out;
}
// Normal's pick from an offer: the number whose call leaves the best standing (a win at once first; a call that completes
// only the other card last). Returns its index in the offer, ties broken by the rng.
function greedy(pm, me, offer, called, lines, n, rng) {
  let bestK = 0, bestV = -Infinity;
  const order = offer.map((v, k) => k);
  for (let i = order.length - 1; i > 0; i--) { const j = randInt(rng, i + 1); const t = order[i]; order[i] = order[j]; order[j] = t; }
  for (const k of order) {
    called.add(offer[k]);
    const val = evalPos(pm, me, called, lines, n);
    called.delete(offer[k]);
    if (val > bestV) { bestV = val; bestK = k; }
  }
  return { k: bestK, v: bestV };
}
// A small seeded generator for the rollouts (the same offers in every option's i-th rollout: the options are compared on
// like luck). From the move's rng, so the same position and rng give the same move.
const lcg = seed => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
// One rollout from a position (me's call just made): both sides play Normal's pick on the offers the pool deals, to the
// square's end. 1 a win for me, 0 a loss, 0.5 a tie.
function rollout(pm, me, called, pool, offerN, lines, n, rng) {
  const pl = pool.slice();
  let who = other(me);
  for (let guard = 0; guard < 200 && pl.length; guard++) {
    const offer = sample(pl, Math.min(offerN, pl.length), rng), pick = greedy(pm, who, offer, called, lines, n, rng), v = offer[pick.k];
    called.add(v); pl.splice(pl.indexOf(v), 1);
    const a = standing(pm.cards.X, called, lines, n).won, b = standing(pm.cards.O, called, lines, n).won;
    if (a && b) return 0.5;
    if (a || b) return (a ? 'X' : 'O') === me ? 1 : 0;
    who = other(who);
  }
  return 0.5;
}
export function best(pm, me, rng, style, ctx) {
  rng = needRng(rng);
  const n = bingoSize(pm), lines = bingoLines(n, bingoDiag(pm)), offer = Array.isArray(pm.offer) ? pm.offer : [];
  const hard = !!(ctx && ctx.level === 'hard'), until = hard && ctx && typeof ctx.until === 'function' ? ctx.until : null;
  if (!offer.length) {                                                                         // nothing drawn yet: Pick numbers (its call is the turn's next move)
    if (hard && bingoPool(pm).length) bingoExact(pm, me, until);                                // (Hard: the square's table is begun while the cage turns)
    return { move: bingoPool(pm).length ? BINGO_DRAW : null, q: 0 };
  }
  const called = new Set(pm.called || []), pool = bingoPool(pm);
  const g = greedy(pm, me, offer, called, lines, n, rng);
  if (g.v >= 1e6) return { move: g.k, q: 1 };                                                  // a line now: the move at every level
  if (!hard) return { move: g.k, q: 0 };
  const half = until ? until() / 2 : 0;                                                        // (with a clock: half the time for the table, the rest for the rollouts if it is not done)
  const x = bingoExact(pm, me, until ? () => until() - half : null);                           // the exact race, where the square's table is done
  if (x) {
    let top = [], tv = -1;
    x.forEach((v, k) => { if (v > tv + 1e-9) { tv = v; top = [k]; } else if (v > tv - 1e-9) top.push(k); });
    return { move: top.length > 1 ? top[randInt(rng, top.length)] : top[0], q: 0, p: tv };
  }
  // Hard: each option scored by rollouts to the square's end (both sides Normal from there), the same luck for every option
  // in each round; as many rounds as the time allows (HARD.min at least, HARD.max at most; HARD.fixed with no clock).
  const live = offer.map((v, k) => { called.add(v); const e = evalPos(pm, me, called, lines, n); called.delete(v); return { k, v, sum: 0, dead: e <= -1e6 }; }).filter(o => !o.dead);   // (never a call that hands them the square, while another is open)
  if (!live.length) return { move: g.k, q: 0 };
  if (live.length === 1) return { move: live[0].k, q: 0 };
  const seed0 = randInt(rng, 2147483647), offerN = offer.length;
  let rounds = 0;
  const limit = until ? HARD.max : HARD.fixed;
  for (; rounds < limit; rounds++) {
    if (until && rounds >= HARD.min && until() <= 0) break;
    for (const o of live) {
      const r = lcg(seed0 + rounds * 7919), c = new Set(called); c.add(o.v);
      o.sum += rollout(pm, me, c, pool.filter(x => x !== o.v), offerN, lines, n, r);
    }
  }
  let pick = live[0];
  for (const o of live) if (o.sum > pick.sum) pick = o;
  return { move: pick.k, q: 0 };
}
export const HARD = { min: 24, max: 400, fixed: 160 };

// ---- Hard: the exact race ----
// Both cards are public and a call marks both, so the square is a game of chance with nothing hidden: its exact
// value is a walk over what has been called. Only the numbers on a card matter (at most 18 on two 3x3 cards: a bit
// each); the rest are blanks, alike, so a position is (the card numbers called, the blanks left, who is on the move).
// V = the mover's chance of the square, both sides calling their best from every offer: over the offers the pool can
// deal (m numbers of the N left, each set as likely), the best call's worth: the square (1), the other side's (0), both
// lines at once (a tie, the square resets: 0.5), else 1 - V for the other side from there. The best of an offer is the
// offered number worth most, so the expectation is a sum over the numbers sorted by worth: the i-th best is the offer's
// best in C(N - 1 - i, m - 1) of the C(N, m) offers. A table per square (its cards, range, lines and offer), filled
// depth first and kept between calls: a call adds up to EXACT.nodes positions (or works until the clock is out) and
// gives up for now if the answer is not reached (the rollouts stand in); the next call goes on from what is kept. A
// whole 3x3 square is some 20,000 to 400,000 positions (the fewer numbers the cards share, the more), and what is left
// of it shrinks fast as numbers are called: done by the first or second call of most squares. Bigger cards (more than EXACT.rel numbers) keep to
// the rollouts above.
export const EXACT = { rel: 18, nodes: 20000, cap: 1 << 20, keep: 2 };
const SOLVERS = new Map();
const CB = [];                                                   // binomials C(a, b), a to 64, b to 4
for (let a = 0; a <= 64; a++) { CB.push(new Float64Array(5)); CB[a][0] = 1; for (let b = 1; b <= 4 && b <= a; b++) CB[a][b] = CB[a - 1][b - 1] + (b <= a - 1 ? CB[a - 1][b] : 0); }
function solverFor(pm, offerN) {
  const n = bingoSize(pm), diag = bingoDiag(pm), X = pm.cards.X, O = pm.cards.O;
  if (!X || !O || X.length !== n * n || O.length !== n * n || !(pm.range <= 60)) return null;
  const key = `${n}|${diag ? 1 : 0}|${pm.range}|${offerN}|${X.join(',')}|${O.join(',')}`;
  let s = SOLVERS.get(key);
  if (s) return s;
  const rel = [...new Set([...X, ...O])];
  if (rel.length > EXACT.rel) return null;
  const ix = new Map(rel.map((v, i) => [v, i])), lines = bingoLines(n, diag);
  const lm = c => lines.map(l => l.reduce((m, i) => m | (1 << ix.get(c[i])), 0));
  const LX = lm(X), LO = lm(O);
  // by bit: the lines of each card through that number
  const through = L => rel.map((v, i) => L.filter(m => m & (1 << i)));
  s = { key, R: rel.length, ix, blanks: pm.range - rel.length, m: offerN, TX: through(LX), TO: through(LO), size: 1 << 14, keys: new Int32Array(1 << 14).fill(-1), vals: new Float32Array(1 << 14), count: 0, left: 0, out: false, until: null, tick: 0, dead: false, bufs: [] };
  if (SOLVERS.size >= EXACT.keep) SOLVERS.delete(SOLVERS.keys().next().value);
  SOLVERS.set(key, s);
  return s;
}
function grow(s) {
  const ok = s.keys, ov = s.vals, size = s.size * 2, keys = new Int32Array(size).fill(-1), vals = new Float32Array(size), mask = size - 1;
  for (let i = 0; i < ok.length; i++) { const k = ok[i]; if (k < 0) continue; let h = Math.imul(k, 0x9E3779B1) >>> 0 & mask; while (keys[h] >= 0) h = (h + 1) & mask; keys[h] = k; vals[h] = ov[i]; }
  s.keys = keys; s.vals = vals; s.size = size;
}
// The worth, for the mover (who: 0 X, 1 O), of calling the card number `bit` from (mask, k blanks left).
function callWorth(s, mask, k, who, bit, i, depth) {
  const m2 = mask | bit, TA = who ? s.TO[i] : s.TX[i], TB = who ? s.TX[i] : s.TO[i];
  let a = false, b = false;
  for (let j = 0; j < TA.length; j++) if ((m2 & TA[j]) === TA[j]) { a = true; break; }
  for (let j = 0; j < TB.length; j++) if ((m2 & TB[j]) === TB[j]) { b = true; break; }
  if (a) return b ? 0.5 : 1;
  if (b) return 0;
  return 1 - solve(s, m2, k, who ^ 1, depth + 1);
}
function solve(s, mask, k, who, depth) {
  if (s.out) return 0;
  const key = ((mask << 6 | k) << 1) | who, hm = s.size - 1;
  let h = Math.imul(key, 0x9E3779B1) >>> 0 & hm;
  const keys = s.keys;
  while (keys[h] >= 0) { if (keys[h] === key) return s.vals[h]; h = (h + 1) & hm; }
  if (s.until ? ((++s.tick & 255) === 0 && s.until() <= 0) : s.left-- <= 0) { s.out = true; return 0; }
  const buf = s.bufs[depth] || (s.bufs[depth] = new Float64Array(s.R + 1));
  let c = 0;
  for (let i = 0; i < s.R; i++) {
    const bit = 1 << i;
    if (mask & bit) continue;
    const v = callWorth(s, mask, k, who, bit, i, depth);
    if (s.out) return 0;
    let j = c++; while (j > 0 && buf[j - 1] < v) { buf[j] = buf[j - 1]; j--; } buf[j] = v;   // (sorted, the best first)
  }
  const N = c + k;
  let ev = 0.5;
  if (N) {
    const m = Math.min(s.m, N), bv = k ? 1 - solve(s, mask, k - 1, who ^ 1, depth + 1) : -1;
    if (s.out) return 0;
    let i = 0, pos = 0, blanks = k > 0, sum = 0;
    while (pos < N) {
      if (blanks && (i >= c || bv >= buf[i])) { sum += bv * (CB[N - pos][m] - CB[N - pos - k][m]); pos += k; blanks = false; }
      else { sum += buf[i] * CB[N - 1 - pos][m - 1]; i++; pos++; }
    }
    ev = sum / CB[N][m];
  }
  if (s.count * 2 >= s.size) { if (s.size >= EXACT.cap) { s.out = s.dead = true; return 0; } grow(s); }
  const km = s.size - 1; let g = Math.imul(key, 0x9E3779B1) >>> 0 & km;
  while (s.keys[g] >= 0) g = (g + 1) & km;
  s.keys[g] = key; s.vals[g] = ev; s.count++;
  return ev;
}
// Each offered number's exact worth to `me` (its chance of the square after calling it), or null where the table is
// not there yet (or the square is too big for one). With no offer: the table is worked on, null.
export function bingoExact(pm, me, until) {
  const offer = Array.isArray(pm.offer) ? pm.offer : [], s = solverFor(pm, offer.length || bingoSettings(tune(pm)).offer);
  if (!s || s.dead) return null;
  let mask = 0, k = s.blanks;
  for (const v of pm.called || []) { const i = s.ix.get(v); if (i === undefined) k--; else mask |= 1 << i; }
  if (k < 0) return null;
  const who = me === 'X' ? 0 : 1;
  s.out = false; s.until = until || null; s.left = EXACT.nodes; s.tick = 0;
  if (!offer.length) { solve(s, mask, k, who, 0); return null; }
  const out = [];
  for (const v of offer) {
    const i = s.ix.get(v);
    out.push(i === undefined ? 1 - solve(s, mask, k - 1, who ^ 1, 1) : callWorth(s, mask, k, who, 1 << i, i, 0));
    if (s.out) return null;
  }
  return out;
}
