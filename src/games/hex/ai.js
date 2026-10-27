// Hex: the computer's play.
import { randInt } from '../../core/random.js';
import { pickValued, slip } from '../shared/lines.js';
import { HEX_HARD, HEX_OPEN, HEX_SWAP, hexCanSwap, hexDist, hexHard, hexMoves, hexSize, hexT } from './rules.js';

export function needs(pm, p) {
  return hexDist(pm.cells, p);
}
export function best(pm, me, rng, style, ctx) {
  const hard = !!(ctx && ctx.level === 'hard'), until = hard ? ctx.until : null, five = hexSize(pm.cells) === 5;
  // The swap rule, by the book (HEX_SWAP): the other side's first stone, alone in the square, taken when it is worth more
  // to them than playing on against it is to me (the admin's mistake rate: now and then it never thinks of it).
  if (five && hexCanSwap(pm, me) && !(slip(pm, [0, 1], rng).length === 1)) {
    const k = pm.cells.findIndex(Boolean);
    if (HEX_SWAP.includes(me === 'O' ? k : hexT(k))) { const sw = pm.cells.slice(); sw[k] = me; return { move: 'swap', v: 0, h: 0, after: { type: 'hex', cells: sw, swap: true }, win: false }; }
  }
  // The opening of a square with the swap rule: a stone from the book (HEX_OPEN), at random among them.
  if (five && pm.swap && !pm.cells.some(Boolean)) {
    const k = me === 'X' ? HEX_OPEN[randInt(rng, HEX_OPEN.length)] : hexT(HEX_OPEN[randInt(rng, HEX_OPEN.length)]), after = pm.cells.slice(); after[k] = me;
    return { move: k, v: 0, h: 0, after: { type: 'hex', cells: after, swap: true }, win: false };
  }
  const moves = hard ? hexHard(pm.cells, me, until).moves : hexMoves(pm.cells, me);   // (Hard: the deep search, as the time allows)
  return pickValued(pm, me, slip(pm, moves, rng), (cells, i) => i);
}
export { HEX_HARD };
