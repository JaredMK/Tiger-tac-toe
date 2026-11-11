// Rummy Lite: the computer's play.
import { randInt } from '../../core/random.js';
import { rmyCfg, rmyDeck, rmyMelds, rmyVal } from './rules.js';

// What it knows: its own hand and pile (open) and so the cards still in its deck (every card of the deck but those),
// never their order. A hand's shape (`rmyShape`): its melds, then the pairs among the cards left that one more card
// would make a meld of (two of a rank; two of a suit one or two apart, an ace low or high). Normal keeps the shape:
// it takes the pile's card when that makes the shape better and throws the card that costs it least. Hard plays by
// the chance of finishing: for every card it could throw, the cards of its deck that would complete the hand on the
// next draw (its outs), then the shape; the pile's card against the deck's average over every card it could draw.
// Easy: either pile, any card not in a meld.
export function rmyNear(a, b) {
  if (a[0] === b[0]) return true;
  if (a[1] !== b[1]) return false;
  const x = rmyVal(a), y = rmyVal(b), d = Math.abs(x - y), low = (v) => (v === 14 ? 1 : v);
  return (d >= 1 && d <= 2) || (Math.abs(low(x) - low(y)) >= 1 && Math.abs(low(x) - low(y)) <= 2);
}
export function rmyShape(hand) {
  const m = rmyMelds(hand), used = new Set(m.melds.flat()), left = hand.filter(c => !used.has(c));
  let pairs = 0;
  const free = left.slice();
  for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) if (free[i] && free[j] && rmyNear(free[i], free[j])) { pairs++; free[i] = free[j] = null; break; }
  return { n: m.n, pairs, score: 10 * m.n + 3 * pairs };
}
export const rmyUnseen = (pm, p) => { const known = new Set([...pm.hand[p], ...(pm.pile[p] || [])]); return rmyDeck(rmyCfg(pm).ranks).filter(c => !known.has(c)); };
// The cards of `pool` that complete a six-card hand on a draw (the hand with it holds `need` melds).
export const rmyOuts = (h6, pool, need) => pool.reduce((a, c) => a + (rmyMelds(h6.concat(c)).n >= need ? 1 : 0), 0);
// A six-card hand's worth to Hard: certain win, else its outs over the cards left, then its shape.
function worth(h6, pool, need) {
  if (rmyMelds(h6).n >= need) return 1e6;
  return 1000 * rmyOuts(h6, pool, need) / Math.max(1, pool.length) + rmyShape(h6).score;
}
// The best card to throw from seven: { d, v } (ties: the first in the hand's order, or at random with rng).
function bestThrow(h7, val, rng) {
  let best = [], bv = -Infinity;
  for (const d of h7) { const v = val(h7.filter(c => c !== d)); if (v > bv + 1e-9) { bv = v; best = [d]; } else if (Math.abs(v - bv) <= 1e-9) best.push(d); }
  return { d: rng ? best[randInt(rng, best.length)] : best[0], v: bv };
}
export function needs(pm, p) {
  const need = rmyCfg(pm).melds, s = rmyShape(pm.hand[p]), miss = Math.max(0, need * 3 - (3 * Math.min(need, s.n) + 2 * Math.min(s.pairs, need - Math.min(need, s.n))));
  return miss ? RMY_AI.base + RMY_AI.perCard * miss : 1;
}
// needs: the turns a player still needs alone (Normal's play, tests/sim/rummy.sim.js: about 7.5 with one card missing,
// 10 with two); easySlip: Easy's careless moves (%).
export const RMY_AI = { base: 5, perCard: 2.5, easySlip: 30 };
export function best(pm, me, rng, style, ctx) {
  const cfg = rmyCfg(pm), lvl = ctx && ctx.level, held = pm.held && pm.held.by === me ? pm.held : null, h = pm.hand[me], top = (pm.pile[me] || []).slice(-1)[0];
  const late = () => (ctx && typeof ctx.until === 'function' ? ctx.until() <= 0 : false);   // (no clock in the engine: without ctx.until, a fixed amount of work, all of it)
  if (lvl === 'easy' && rng() * 100 < RMY_AI.easySlip) {          // Easy: now and then a careless take or throw (any card outside its melds)
    if (!held) return { move: top && rng() < 0.5 ? 'pile' : 'deck', q: 0 };
    const inMeld = new Set(rmyMelds(h).melds.flat()), loose = h.filter(c => !inMeld.has(c)), pick = loose.length ? loose : h;
    return { move: { d: pick[randInt(rng, pick.length)] }, q: 0 };
  }
  const pool = rmyUnseen(pm, me), need = cfg.melds;
  const val = lvl === 'hard' ? (h6 => worth(h6, pool, need)) : (h6 => (rmyMelds(h6).n >= need ? 1e6 : rmyShape(h6).score));
  if (held) {
    const b = bestThrow(h, val, rng);
    return { move: { d: b.d }, q: b.v >= 1e6 ? 1 : 0 };
  }
  // the take: the pile's card (known) against the deck's (each card it could be, as likely)
  const now = val(h);
  const vp = top ? bestThrow(h.concat(top), val).v : -Infinity;
  if (vp >= 1e6) return { move: 'pile', q: 1 };
  if (lvl !== 'hard') return { move: vp > now ? 'pile' : 'deck', q: 0 };
  let sum = 0, n = 0, wins = 0;
  for (const c of pool) {
    if (late() && n >= 6) break;
    const v = bestThrow(h.concat(c), val).v; sum += Math.min(v, 2000); n++; if (v >= 1e6) wins++;
  }
  const vd = n ? sum / n : now;
  return vp > vd ? { move: 'pile', q: 0 } : { move: 'deck', q: n ? wins / n : 0 };
}
