// Bingo: the computer's play. A turn draws first (Pick numbers: the move 'draw', when no offer is waiting), then calls one
// of the offered numbers; what matters is what each call does to both cards
// (a called number marks every card it is on). Normal weighs each offered number by the lines it advances on its own
// card against the lines it advances on the other's (a number that completes its own line is the move; one that
// completes only the other's is never called while another choice exists); Hard looks ahead, within ctx.until: the
// other side's best reply over the offers the pool could deal them (sampled by the rng), and its own reply to that.
import { needRng, randInt } from '../../core/random.js';
import { BINGO_DRAW, bingoLines, bingoPool, bingoSize, bingoDiag } from './rules.js';

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
  if (!offer.length) return { move: bingoPool(pm).length ? BINGO_DRAW : null, q: 0 };       // nothing drawn yet: Pick numbers (its call is the turn's next move)
  const called = new Set(pm.called || []), pool = bingoPool(pm);
  const g = greedy(pm, me, offer, called, lines, n, rng);
  if (g.v >= 1e6) return { move: g.k, q: 1 };                                                  // a line now: the move at every level
  const hard = !!(ctx && ctx.level === 'hard'), until = hard && ctx && typeof ctx.until === 'function' ? ctx.until : null;
  if (!hard) return { move: g.k, q: 0 };
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
