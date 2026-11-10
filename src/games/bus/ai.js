// Ride the Bus: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { BUS, BUS_AVG, busDeck, busOdds, busRight, busTies } from './rules.js';

// The turns a side still needs, exactly: a right guess goes straight on, a wrong one ends the turn with the cards kept,
// so it is one turn plus the misses still to come, each round's (1 - p) / p for its best guess, over every card that
// guess can keep (busPlan: all of the player's own deck from here, to the last round). The likeliest guess is also the
// one that takes the fewest turns, at every hand of kept cards, with ties wrong or right (checked over all 56,186 and
// 67,652 of them: the misses still to come by the likeliest guess, any of its equals, are the fewest any guessing
// reaches), so there is nothing for Hard to find beyond it.
const PLAN = new Map();
const SUITS = ['S', 'H', 'D', 'C'];
// { n, q }: from a hand of kept cards, the misses still to come and the chance of going right through this turn.
export function busPlan(kept, tieOk) {
  const r = kept.length;
  if (r >= BUS.rounds) return { n: 0, q: 1 };
  const key = (tieOk ? 't' : 'w') + kept.join('');
  let out = PLAN.get(key);
  if (out) return out;
  if (r === BUS.rounds - 1) {                                    // the suit: the one with the most cards left
    let top = 0; for (const s of SUITS) top = Math.max(top, 13 - kept.filter(c => c[1] === s).length);
    const p = top / (52 - r); out = { n: (1 - p) / p, q: p };
  } else if (r === 0) {                                          // red or black: even; then any card (BUS_START: worked out once by busStart, held by the tests)
    out = BUS_START[tieOk ? 't' : 'w'];
  } else {
    const deck = busDeck(kept);
    let bp = 0, bn = Infinity, bq = 0;
    for (const g of BUS.guesses[r]) {
      let c = 0, n = 0, q = 0;
      for (const card of deck) if (busRight(kept, g, card, tieOk)) { const x = busPlan(kept.concat(card), tieOk); c++; n += x.n; q += x.q; }
      if (!c) continue;
      const p = c / deck.length, tn = (1 - p) / p + n / c;
      if (p > bp + 1e-12 || (p > bp - 1e-12 && tn < bn)) { bp = p; bn = tn; bq = p * q / c; }
    }
    out = { n: bn, q: bq };
  }
  if (r <= 2) { if (PLAN.size >= 6000) PLAN.delete(PLAN.keys().next().value); PLAN.set(key, out); }   // (kept: a first card's whole tree is a few ms; the last round is quick)
  return out;
}
// A fresh hand: one miss on average at red or black, then the first card's own count, over the thirteen ranks (the
// suits alike): 5.81 turns in all with ties wrong, 5.40 with ties right.
export const BUS_START = { w: { n: 4.806131998813276, q: 0.06306522609043617 }, t: { n: 4.399569061422884, q: 0.08239295718287316 } };
export function busStart(tieOk) {
  let n = 0, q = 0;
  for (const c of busDeck([])) if (c[1] === 'H') { const x = busPlan([c], tieOk); n += x.n / 13; q += x.q / 13; }
  return { n: 1 + n, q: 0.5 * q };
}
export function needs(pm, p) {
  return 1 + busPlan(pm.prog[p], busTies(pm)).n;
}
export function best(pm, me, rng, style, ctx) {
  // The guess most likely right, from the cards left in its own deck (a tie: either); now and then (the
  // admin's mistake rate) any guess.
  const kept = pm.prog[me], odds = busOdds(kept, busTies(pm)), miss = tune(pm).miss;
  if (miss && rng() * 100 < miss) { const o = odds[randInt(rng, odds.length)]; return { move: o.guess, q: 0 }; }
  const top = Math.max(...odds.map(o => o.p));
  const best = odds.filter(o => o.p >= top - 1e-9), g = best[randInt(rng, best.length)];
  if (ctx && ctx.level === 'hard') {                            // Hard: the same guess (it is the best one: busPlan); its chance of the square this turn, exact
    if (!kept.length) return { move: g.guess, q: busPlan(kept, busTies(pm)).q };   // (red or black: alike)
    const deck = busDeck(kept); let c = 0, q = 0;
    for (const card of deck) if (busRight(kept, g.guess, card, busTies(pm))) { c++; q += busPlan(kept.concat(card), busTies(pm)).q; }
    return { move: g.guess, q: c ? g.p * q / c : 0 };
  }
  let q = g.p;
  for (let r = kept.length + 1; r < BUS.rounds; r++) q *= BUS_AVG[r];   // right all the way to the end, this turn
  return { move: g.guess, q };
}
