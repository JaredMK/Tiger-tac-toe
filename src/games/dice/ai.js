// Dice Race: the computer's play.
import { DICE_GOAL } from './rules.js';

export function needs(pm, p) {
  return Math.max(1, (DICE_GOAL - pm.totals[p]) / 3.5);
}
export function best(pm, me, rng, style, ctx) {
  const need = DICE_GOAL - pm.totals[me]; return { move: 1, q: need <= 6 ? (7 - need) / 6 : 0 };
}
