// Flood: the computer's play.
import { FLOOD, floodSearch } from './rules.js';

export function needs(pm, p) {
  return Math.max(0.5, (FLOOD.goal - pm.score[p]) / 3.2);
}
export function best(pm, me, rng, style, ctx) {
  const b = floodSearch(pm, me, rng); return { move: b.c, after: b.after, win: b.win };
}
