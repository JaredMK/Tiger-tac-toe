// Dice Race: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { PLAY } from '../../core/timer.js';

export const DICE_GOAL = 16;   // 15 numbered spaces, then the finish
export function create(type, rng) {
  return { type, totals: { X: 0, O: 0 }, last: null };
}
export function apply(mini, p, m, rng, idx) {
  const roll = 1 + randInt(needRng(rng), 6);
  mini.totals[p] += roll; mini.last = { by: p, roll };
  if (mini.totals[p] >= DICE_GOAL) return { ok: true, outcome: 'win' };
  return { ok: true, outcome: 'continue', note: 'roll' };
}
export function publicView(mini) {
  return { type: 'dice', totals: { X: mini.totals.X, O: mini.totals.O } };
}
export function randomMove(mini, p, rng, from, empties) {
  return 1;
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.roll = mini.last.roll; flash.total = mini.totals[p]; return;
}
export const diceSlot = t => (t <= 0 ? -1 : Math.min(t, DICE_GOAL) - 1);   // a Dice race total as a track slot
export function flashMs(f, winLen, won) {
  return PLAY.die + Math.max(1, diceSlot(f.total) - diceSlot(f.total - f.roll)) * PLAY.hop + 250;
}
