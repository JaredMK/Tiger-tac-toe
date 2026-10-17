// Tic-Tac-Toe: the computer's play.
import { lineNeeds, pickValued } from '../shared/lines.js';
import { tttMinimax } from './rules.js';

export function needs(pm, p) {
  return lineNeeds(pm.cells, 3, 3, 3, p);
}
export function best(pm, me, rng, style, ctx) {
  return pickValued(pm, me, tttMinimax(pm.cells, me), (cells, i) => i);
}
