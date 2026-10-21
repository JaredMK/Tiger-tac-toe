// Blackjack: the computer's play.
import { tune } from '../../core/tune.js';
import { bjStrategy } from './rules.js';

export function needs(pm, p) {
  return Math.max(1, (tune(pm).goal - pm.wins[p]) / 0.43);      // about 0.43 a hand won (naturals included), pushes replayed
}
export function best(pm, me, rng, style, ctx) {
  // Deal, then basic strategy (hit or stand: no doubling).
  const h = pm.hand && pm.hand.by === me ? pm.hand : null, need = tune(pm).goal - pm.wins[me];
  if (!h) return { move: 'deal', q: need <= 1 ? 0.43 : need === 2 ? 0.05 : 0 };
  return { move: bjStrategy(h.cards, h.up), q: 0 };
}
