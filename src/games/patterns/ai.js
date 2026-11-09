// Patterns: the computer's play.
import { randInt } from '../../core/random.js';
import { PATTERNS, patCfg, patCrossed } from './rules.js';

// Race mode (core/race.js): the computer reads its own card alone (pm.side[me].crossed); the other side's progress is
// its shape (wrong tries made, right or not), and the first right pick takes the square.
const optsOf = pm => (pm.puz ? pm.puz.opts.length : PATTERNS.options);
function wrongTries(pm, p) {                                     // the options p has crossed out: their own card, or their shape
  if (pm.side && pm.side[p]) return patCrossed(pm, p).length;
  const sh = pm.shape && pm.shape[p];
  return sh && Number.isInteger(sh.n) ? sh.n : 0;
}
export function needs(pm, p) {
  const cf = patCfg(pm);
  if (pm.race) {                                                 // one right pick wins: the moves it takes, knowing it or guessing among what is left to this side
    const know = Math.max(0.05, cf.aiRight), left = Math.max(1, optsOf(pm) - wrongTries(pm, p));
    return Math.max(1, 1 / (know + (1 - know) / left));
  }
  return Math.max(1, (cf.goal - pm.right[p]) / Math.max(0.05, cf.aiRight));
}
export function best(pm, me, rng, style, ctx) {   // right about 60% of the time (the admin's settings), else a wrong option still standing (never one crossed out; a race: on its own card)
  const right = pm.answer, cf = patCfg(pm), crossed = pm.race ? patCrossed(pm, me) : pm.crossed || [], n = optsOf(pm);
  if (!Number.isInteger(right)) return { move: 'auto', q: 0 };
  const wrong = Array.from({ length: n }, (_, k) => k).filter(k => k !== right && !crossed.includes(k));
  const q = pm.race || pm.right[me] >= cf.goal - 1 ? (wrong.length ? cf.aiRight : 1) : 0;
  if (!wrong.length || rng() < cf.aiRight) return { move: right, q };
  return { move: wrong[randInt(rng, wrong.length)], q };
}
