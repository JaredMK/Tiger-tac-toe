// Hexapawn: the computer's play.
import { HP, hpMovesValued, hpNeeds } from './rules.js';

export function needs(pm, p) {
  return hpNeeds(pm.cells, p);
}
export function best(pm, me, rng, style, ctx) {
  const moves = hpMovesValued(pm.cells, me);
  if (!moves.length) return { move: null, q: 0 };
  const ahead = mv => mv.after.reduce((s, c, k) => s + (c === me ? (me === 'X' ? HP.rows - 1 - Math.floor(k / HP.cols) : Math.floor(k / HP.cols)) : c ? -1 : 0), 0);
  let best = moves[0];
  for (const mv of moves) if (mv.v > best.v || (mv.v === best.v && ahead(mv) > ahead(best))) best = mv;
  return { move: best.move, win: best.v === 100, after: { type: 'hexapawn', cells: best.after } };
}
