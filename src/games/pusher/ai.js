// Craps: the computer's play.
import { goAgain, tune } from '../../core/tune.js';
import { CRAPS, CRAPS_MAKE } from './rules.js';

// A hot streak: a round won keeps the turn, so a turn wins rounds until one is lost. needs: the turns still
// needed (the rounds lost before the last one won, each ending a turn, and the turn that finishes it).
export function needs(pm, p) {
  const k = Math.max(0, tune(pm).goal - pm.wins[p]), w = CRAPS.winOdds;
  if (!goAgain(pm)) return Math.max(1, k / w);   // ("Go again on success" off: a round a turn)
  return Math.max(1, 1 + k * (1 - w) / w);
}
export function best(pm, me, rng, style, ctx) {
  const k = Math.max(1, tune(pm).goal - pm.wins[me]), first = pm.point != null ? CRAPS_MAKE[pm.point] : CRAPS.winOdds;
  return { move: 'roll', q: goAgain(pm) ? first * CRAPS.winOdds ** (k - 1) : k <= 1 ? first : 0 };   // the only move: Roll (the round rolls itself out); q: the chance this turn takes the square (every round still needed won in a row)
}
