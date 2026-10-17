// Roulette: the computer's play.
import { AI } from '../../core/ai.js';
import { randInt } from '../../core/random.js';
import { other } from '../../core/util.js';
import { RL } from './rules.js';

export function needs(pm, p) {
  return Math.max(1, (RL.goal - pm.hits[p]) * RL.wheel.length / RL.pick);
}
export function best(pm, me, rng, style, ctx) {
  // A group, as a rule; now and then green 0: when the other side is one hit from a square that
  // matters (it would give them the match, or block a line of its own), or when well behind.
  const o = other(me), mine = pm.hits[me], theirs = pm.hits[o];
  const crit = !!ctx && ctx.value >= AI.block, behind = !!ctx && ctx.behind >= 2 && theirs > mine;
  const pz = theirs >= RL.goal - 1 && crit ? 0.4 : behind ? 0.25 : 0;
  if (pz && rng() < pz) return { move: 'zero', q: 1 / RL.wheel.length };
  return { move: ['g1', 'g2', 'g3'][randInt(rng, 3)], q: mine >= RL.goal - 1 ? RL.pick / RL.wheel.length : 0 };
}
