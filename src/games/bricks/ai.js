// Brick Break: the computer's play. Its go is an autopilot on the paddle (rules.js brkAi): Normal's hand reacts a
// little late and aims a little off, Hard's faster and truer, tilting the paddle to send the ball at the fullest
// column; Easy's slower and wider. The go is worked out here, from the square as the computer sees it (everything
// in it is public), so the same move comes out of the page's worker and the server's bots alike.
import { brkAi, brkHand, brkLeft } from './rules.js';

export const BRK_GAIN = 7;   // bricks the computer breaks in a go, about (Normal: see tests/sim/bricks.sim.js)
export function needs(pm, p) {
  return Math.max(1, brkLeft(pm, p) / BRK_GAIN);
}
export function best(pm, me, rng, style, ctx) {
  const level = ctx && ctx.level === 'hard' ? 'hard' : ctx && ctx.level === 'easy' ? 'easy' : 'normal';
  const n = needs(pm, me), r = brkAi(pm, me, rng, brkHand(pm, level));
  return { move: r.move, q: r.move.end === 'clear' ? 1 : n <= 1 ? 0.6 : 0.35 / n };
}
