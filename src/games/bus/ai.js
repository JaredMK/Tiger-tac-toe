// Ride the Bus: the computer's play.
import { randInt } from '../../core/random.js';
import { BUS, BUS_AVG, busOdds } from './rules.js';

export function needs(pm, p) {   // turns: one, plus one for every miss on the way
  const kept = pm.prog[p];
  let n = 1;
  for (let r = kept.length; r < BUS.rounds; r++) { const q = r === kept.length ? Math.max(...busOdds(kept).map(o => o.p)) : BUS_AVG[r]; n += (1 - q) / q; }
  return n;
}
export function best(pm, me, rng, style, ctx) {
  // The guess most likely right, from the cards left in its own deck (a tie: either).
  const kept = pm.prog[me], odds = busOdds(kept), top = Math.max(...odds.map(o => o.p));
  const best = odds.filter(o => o.p >= top - 1e-9), g = best[randInt(rng, best.length)];
  let q = g.p;
  for (let r = kept.length + 1; r < BUS.rounds; r++) q *= BUS_AVG[r];   // right all the way to the end, this turn
  return { move: g.guess, q };
}
