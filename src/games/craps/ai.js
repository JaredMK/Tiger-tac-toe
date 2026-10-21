// Craps: the computer's play.
import { tune } from '../../core/tune.js';
import { CRAPS, CRAPS_MAKE } from './rules.js';

export function needs(pm, p) {
  return Math.max(1, (tune(pm).goal - pm.wins[p]) / CRAPS.winOdds);
}
export function best(pm, me, rng, style, ctx) {
  return { move: 'roll', q: pm.wins[me] >= tune(pm).goal - 1 ? (pm.point != null ? CRAPS_MAKE[pm.point] : CRAPS.winOdds) : 0 };   // the only move: Roll (the round rolls itself out); q: the chance it takes the square now
}
