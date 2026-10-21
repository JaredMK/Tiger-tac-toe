// Mastermind: the computer's play.
import { tune } from '../../core/tune.js';
import { mmBestGuess, mmCandidates, mmCode } from './rules.js';

export function needs(pm, p) {
  const n = mmCandidates(pm).length; return n <= 1 ? 1 : Math.min((n + 1) / 2, 1 + Math.log(n) / Math.log(5));
}
export function best(pm, me, rng, style, ctx) {
  const cand = mmCandidates(pm), t = tune(pm);
  if (!cand.length) return { move: mmCode(rng, t.colors), q: 0, shared: true };
  if (cand.length === 1) return { move: cand[0].slice(), q: 1, shared: true };
  if (t.miss && rng() * 100 < t.miss) { const g = mmCode(rng, t.colors), k = g.join(); return { move: g, q: cand.some(c => c.join() === k) ? 1 / cand.length : 0, shared: true }; }   // a slip: a code at random, clues ignored
  return { move: mmBestGuess(cand, t.colors), q: 1 / cand.length, shared: true };
}
