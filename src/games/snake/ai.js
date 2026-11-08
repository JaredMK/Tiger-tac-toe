// Snake: the computer's play (the autopilot's run, logged like anyone's: rules.js snakeAi).
import { snakeAi, snakeHand, snakeNeeds } from './rules.js';

export function needs(pm, p) {
  return snakeNeeds(pm, p);
}
export function best(pm, me, rng, style, ctx) {
  const n = snakeNeeds(pm, me), level = ctx && ctx.level ? ctx.level : 'normal';
  return { move: snakeAi(pm, me, rng, snakeHand(pm, level)).move, q: n <= 1 ? 0.6 : 0.35 / n };
}
