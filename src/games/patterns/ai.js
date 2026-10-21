// Patterns: the computer's play.
import { randInt } from '../../core/random.js';
import { PATTERNS, patCfg } from './rules.js';

export function needs(pm, p) {
  const cf = patCfg(pm); return Math.max(1, (cf.goal - pm.right[p]) / Math.max(0.05, cf.aiRight));
}
export function best(pm, me, rng, style, ctx) {   // right about 60% of the time (the admin's settings), else a wrong option still standing (never one crossed out)
  const right = pm.answer, cf = patCfg(pm), crossed = pm.crossed || [], n = pm.puz ? pm.puz.opts.length : PATTERNS.options;
  if (!Number.isInteger(right)) return { move: 'auto', q: 0 };
  const wrong = Array.from({ length: n }, (_, k) => k).filter(k => k !== right && !crossed.includes(k));
  const q = pm.right[me] >= cf.goal - 1 ? (wrong.length ? cf.aiRight : 1) : 0;
  if (!wrong.length || rng() < cf.aiRight) return { move: right, q };
  return { move: wrong[randInt(rng, wrong.length)], q };
}
