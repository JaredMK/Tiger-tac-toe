// Higher/Lower: the computer's play.
import { hiloLeft } from './rules.js';

// Halving the range finds the number within its guesses when there are enough (5 guesses cover 31
// numbers): the middle number, every time. Its last guess is a gamble: a miss hands the square over, so
// with one guess left a wide range is worth leaving alone (qLose), and a guess only taken when it is likely.
export function needs(pm, p) {
  const r = pm.hi - pm.lo + 1, n = r <= 1 ? 1 : Math.log2(r + 1);
  return n > hiloLeft(pm, p) + 0.001 ? Math.max(n, hiloLeft(pm, p) + 2) : n;   // more than its guesses left: a long shot
}
export function best(pm, me, rng, style, ctx) {
  const r = pm.hi - pm.lo + 1, left = hiloLeft(pm, me), q = 1 / r;
  return { move: Math.floor((pm.lo + pm.hi) / 2), q, qLose: left === 1 ? 1 - q : 0, shared: true };
}
