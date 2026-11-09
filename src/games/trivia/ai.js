// Trivia: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { TRIVIA, triviaCrossed } from './rules.js';

// Race mode (core/race.js): the computer reads its own card alone (pm.side[me].crossed); the other side's progress is
// its shape (wrong tries made, right or not), and the first right answer takes the square.
const optsOf = pm => (pm.ask && Number.isInteger(pm.ask.opts) ? pm.ask.opts : tune(pm).opts);
function wrongTries(pm, p) {                                     // the options p has crossed out: their own card, or their shape
  const part = pm.side && pm.side[p];
  if (part) return triviaCrossed(pm, p).length;
  const sh = pm.shape && pm.shape[p];
  return sh && Number.isInteger(sh.n) ? sh.n : 0;
}
export function needs(pm, p) {
  const t = tune(pm);
  if (pm.race) {                                                 // one right answer wins: the moves it takes, knowing it or guessing among what is left to this side
    const know = t.know / 100, left = Math.max(1, optsOf(pm) - wrongTries(pm, p));
    return Math.max(1, 1 / (know + (1 - know) / left));
  }
  const r = t.know === 53 && t.opts === TRIVIA.options ? TRIVIA.aiRight : t.know / 100 + (1 - t.know / 100) / t.opts;   // (its settings, TUNE: the right rate they make)
  return Math.max(1, (t.goal - pm.right[p]) / r);
}
export function best(pm, me, rng, style, ctx) {   // it knows it about half the time, else guesses among the options still standing (never one crossed out; a race: on its own card)
  const t = tune(pm), know = t.know / 100, right = pm.answer, n = optsOf(pm), crossed = pm.race ? triviaCrossed(pm, me) : pm.crossed || [];
  if (!Number.isInteger(right)) return { move: 'auto', q: 0 };
  const left = Array.from({ length: n }, (_, k) => k).filter(k => !crossed.includes(k));
  const q = know + (1 - know) / Math.max(1, left.length);
  if (left.length <= 1 || rng() < know) return { move: right, q };
  return { move: left[randInt(rng, left.length)], q };
}
