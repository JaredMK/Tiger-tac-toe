// Blackjack: the computer's play.
import { BJ, bjStrategy } from './rules.js';

export function needs(pm, p) {
  return Math.max(1, (BJ.goal - pm.wins[p]) / 0.45);      // about 0.45 a hand, doubles and naturals included
}
export function best(pm, me, rng, style, ctx) {
  // Deal, then basic strategy; with a tally of 1 a won double takes the square, so it doubles more readily.
  const h = pm.hand && pm.hand.by === me ? pm.hand : null, need = BJ.goal - pm.wins[me];
  if (!h) return { move: 'deal', q: need <= 1 ? 0.43 : need === 2 ? 0.05 : 0 };
  return { move: bjStrategy(h.cards, h.up, need === 2), q: 0 };
}
