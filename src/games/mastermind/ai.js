// Mastermind: the computer's play.
import { mmBestGuess, mmCandidates, mmCode } from './rules.js';

export function needs(pm, p) {
  const n = mmCandidates(pm).length; return n <= 1 ? 1 : Math.min((n + 1) / 2, 1 + Math.log(n) / Math.log(5));
}
export function best(pm, me, rng, style, ctx) {
  const cand = mmCandidates(pm);
  if (!cand.length) return { move: mmCode(rng), q: 0, shared: true };
  if (cand.length === 1) return { move: cand[0].slice(), q: 1, shared: true };
  return { move: mmBestGuess(cand), q: 1 / cand.length, shared: true };
}
