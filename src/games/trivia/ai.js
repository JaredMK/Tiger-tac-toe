// Trivia: the computer's play.
import { randInt } from '../../core/random.js';
import { TRIVIA } from './rules.js';

export function needs(pm, p) {
  return Math.max(1, (TRIVIA.goal - pm.right[p]) / TRIVIA.aiRight);
}
export function best(pm, me, rng, style, ctx) {   // it knows it about half the time, else guesses among the options still standing (never one crossed out)
  const right = pm.answer, n = pm.ask ? pm.ask.opts : TRIVIA.options, crossed = pm.crossed || [];
  if (!Number.isInteger(right)) return { move: 'auto', q: 0 };
  const left = Array.from({ length: n }, (_, k) => k).filter(k => !crossed.includes(k));
  const q = TRIVIA.aiKnow + (1 - TRIVIA.aiKnow) / Math.max(1, left.length);
  if (left.length <= 1 || rng() < TRIVIA.aiKnow) return { move: right, q };
  return { move: left[randInt(rng, left.length)], q };
}
