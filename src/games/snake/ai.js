// Snake: the computer's play (the autopilot's run, logged like anyone's: rules.js snakeAi). It steers for its own
// colour of food and round the other colour's. Hard has the steadier hand, never steers into a pocket, and tries a
// few runs within its time (ctx.until: the ms it may still spend; null: all of them), keeping the best.
import { snakeBestOf, snakeGoal, snakeHand, snakeNeeds } from './rules.js';

export const SNAKE_HARD_TRIES = 2;   // Hard's runs to choose from (as its time allows)

export function needs(pm, p) {
  return snakeNeeds(pm, p);
}
export function best(pm, me, rng, style, ctx) {
  const level = ctx && ctx.level ? ctx.level : 'normal', hard = level === 'hard';
  const r = snakeBestOf(pm, me, rng, snakeHand(pm, level), hard ? SNAKE_HARD_TRIES : 1, hard ? ctx.until : null);
  const n = snakeNeeds(pm, me), won = pm.score[me] + r.move.n >= snakeGoal(pm);
  return { move: r.move, q: won ? 1 : r.move.end === 'gift' ? 0 : n <= 1 ? 0.6 : 0.35 / n };
}
