// Hexapawn: the computer's play.
import { other } from '../../core/util.js';
import { HP, hpMoves, hpMovesValued, hpNeeds, hpSolve } from './rules.js';

export function needs(pm, p) {
  return hpNeeds(pm.cells, p);
}
export function best(pm, me, rng, style, ctx) {
  const moves = hpMovesValued(pm.cells, me);
  if (!moves.length) return { move: null, q: 0 };
  const ahead = mv => mv.after.reduce((s, c, k) => s + (c === me ? (me === 'X' ? HP.rows - 1 - Math.floor(k / HP.cols) : Math.floor(k / HP.cols)) : c ? -1 : 0), 0);
  const hard = !!ctx && ctx.level === 'hard';
  // Hard: between moves of the same (minimax) value, the one that leaves the other side the fewest replies
  // that hold it (a slip loses them the square); Normal, the one furthest ahead
  const traps = mv => { if (mv.v >= 100) return 0; if (mv.traps === undefined) mv.traps = hpHolds(mv.after, other(me)); return mv.traps; };
  let best = moves[0];
  for (const mv of moves) if (mv.v > best.v || (mv.v === best.v && (hard ? traps(mv) < traps(best) || (traps(mv) === traps(best) && ahead(mv) > ahead(best)) : ahead(mv) > ahead(best)))) best = mv;
  return { move: best.move, win: best.v === 100, after: { type: 'hexapawn', cells: best.after } };
}
// The replies for p (to move) that keep what the position is worth to p (hpSolve): how many.
function hpHolds(cells, p) {
  const o = other(p), v = hpSolve(cells, p).v;
  let n = 0;
  for (const [a, b] of hpMoves(cells, p)) {
    const next = cells.slice(); next[b] = p; next[a] = null;
    const r = Math.floor(b / HP.cols) === (p === 'X' ? 0 : HP.rows - 1) ? 1 : -hpSolve(next, o).v;
    if (r === v) n++;
  }
  return n;
}
