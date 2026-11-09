// Patterns: the computer's play.
import { randInt } from '../../core/random.js';
import { PATTERNS, patCfg, patCrossed, patFitting, patPuzOf } from './rules.js';

// Race mode (core/race.js, `rv: 2`): the computer plays its own puzzles (its own cross-outs, its own score to the goal).
// Nothing hidden is in its view, so it works its puzzle out from what is shown (patFitting: the one option a rule
// gives, as every puzzle is made to have) and plays to the same rate as in Shared, where it is told the answer.
const optsOf = (pm, p) => { const z = pm.race ? patPuzOf(pm, p) : pm.puz; return z && Array.isArray(z.opts) ? z.opts.length : PATTERNS.options; };
// Expected picks to get a puzzle with `left` options standing: right this often (`r`) while a wrong one stands, then sure.
function onePuz(r, left) {
  let e = 0, reach = 1;
  for (let w = Math.max(0, left - 1), k = 1; w >= 0; w--, k++) { const q = w ? r : 1; e += reach * q * k; reach *= 1 - q; }
  return e;
}
export function needs(pm, p) {
  const cf = patCfg(pm), r = Math.max(0.05, cf.aiRight);
  if (pm.race) {                                                 // its own ladder: what is left of this puzzle, then a whole one for each point still to go
    const n = optsOf(pm, p), left = Math.max(1, n - patCrossed(pm, p).length), to = Math.max(0, cf.goal - (pm.right[p] || 0));
    return to ? Math.max(1, onePuz(r, left) + (to - 1) * onePuz(r, n)) : 0;
  }
  return Math.max(1, (cf.goal - pm.right[p]) / r);
}
// Its own race puzzle's answer, worked out: the one option a fitting rule gives (null where it cannot tell).
export function patSolve(puz) {
  if (!puz || !Array.isArray(puz.seq) || !Array.isArray(puz.opts)) return null;
  const fit = patFitting(puz, puz.opts);
  return fit.length === 1 ? fit[0] : null;
}
export function best(pm, me, rng, style, ctx) {   // right about 60% of the time (the admin's settings), else a wrong option still standing (never one crossed out; a race: on its own puzzle)
  const cf = patCfg(pm), crossed = pm.race ? patCrossed(pm, me) : pm.crossed || [], n = optsOf(pm, me);
  const right = pm.race ? patSolve(patPuzOf(pm, me)) : pm.answer;
  if (!Number.isInteger(right)) {
    if (!pm.race) return { move: 'auto', q: 0 };
    const left = Array.from({ length: n }, (_, k) => k).filter(k => !crossed.includes(k));
    return left.length ? { move: left[randInt(rng, left.length)], q: 0 } : { move: 'auto', q: 0 };
  }
  const wrong = Array.from({ length: n }, (_, k) => k).filter(k => k !== right && !crossed.includes(k));
  const last = pm.right[me] >= cf.goal - 1;
  const q = last ? (wrong.length ? cf.aiRight : 1) : 0;
  if (!wrong.length || rng() < cf.aiRight) return { move: right, q };
  return { move: wrong[randInt(rng, wrong.length)], q };
}
