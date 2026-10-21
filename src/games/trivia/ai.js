// Trivia: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { TRIVIA } from './rules.js';

export function needs(pm, p) {
  const t = tune(pm), r = t.know === 53 && t.opts === TRIVIA.options ? TRIVIA.aiRight : t.know / 100 + (1 - t.know / 100) / t.opts;   // (its settings, TUNE: the right rate they make)
  return Math.max(1, (t.goal - pm.right[p]) / r);
}
export function best(pm, me, rng, style, ctx) {   // it knows it about half the time, else guesses among the options still standing (never one crossed out)
  const t = tune(pm), know = t.know / 100, right = pm.answer, n = pm.ask ? pm.ask.opts : t.opts, crossed = pm.crossed || [];
  if (!Number.isInteger(right)) return { move: 'auto', q: 0 };
  const left = Array.from({ length: n }, (_, k) => k).filter(k => !crossed.includes(k));
  const q = know + (1 - know) / Math.max(1, left.length);
  if (left.length <= 1 || rng() < know) return { move: right, q };
  return { move: left[randInt(rng, left.length)], q };
}
