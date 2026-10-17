// Patterns: the computer's play.
import { randInt } from '../../core/random.js';
import { PATTERNS } from './rules.js';

export function needs(pm, p) {
  return Math.max(1, (PATTERNS.goal - pm.right[p]) / PATTERNS.aiRight);
}
export function best(pm, me, rng, style, ctx) {   // right about 60% of the time, else a wrong option still standing (never one crossed out)
  const right = pm.answer, crossed = pm.crossed || [], n = pm.puz ? pm.puz.opts.length : PATTERNS.options;
  if (!Number.isInteger(right)) return { move: 'auto', q: 0 };
  const wrong = Array.from({ length: n }, (_, k) => k).filter(k => k !== right && !crossed.includes(k));
  const q = pm.right[me] >= PATTERNS.goal - 1 ? (wrong.length ? PATTERNS.aiRight : 1) : 0;
  if (!wrong.length || rng() < PATTERNS.aiRight) return { move: right, q };
  return { move: wrong[randInt(rng, wrong.length)], q };
}
