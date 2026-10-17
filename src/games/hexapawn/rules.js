// Hexapawn: the rules (pure: no page, no clock; the server runs the same code).
import { other } from '../../core/util.js';

export const HP = { cols: 3, rows: 4 };
// Hexapawn: a pawn steps one square straight forward into an empty square, or captures an opposing pawn
// one square diagonally forward. Cells run row by row from the top; X moves up, O moves down.
export function hpMoves(cells, p) {
  const o = other(p), d = p === 'X' ? -1 : 1, out = [];
  for (let k = 0; k < HP.cols * HP.rows; k++) {
    if (cells[k] !== p) continue;
    const r = Math.floor(k / HP.cols), c = k % HP.cols, nr = r + d;
    if (nr < 0 || nr >= HP.rows) continue;
    if (!cells[nr * HP.cols + c]) out.push([k, nr * HP.cols + c]);
    for (const nc of [c - 1, c + 1]) if (nc >= 0 && nc < HP.cols && cells[nr * HP.cols + nc] === o) out.push([k, nr * HP.cols + nc]);
  }
  return out;
}

export function hpGoalRow(p) { return p === 'X' ? 0 : HP.rows - 1; }     // the opponent's home row
export function create(type, rng) {
  return { type, cells: ['O', 'O', 'O', null, null, null, null, null, null, 'X', 'X', 'X'], last: null };
}
export function apply(mini, p, m, rng, idx) {
  if (!Array.isArray(m) || m.length !== 2 || !m.every(k => Number.isInteger(k) && k >= 0 && k < HP.cols * HP.rows)) return { ok: false, reason: 'bad' };
  const [from, to] = m;
  if (!hpMoves(mini.cells, p).some(([a, b]) => a === from && b === to)) return { ok: false, reason: 'illegal' };
  const capture = mini.cells[to] === other(p);
  mini.cells[to] = p; mini.cells[from] = null;
  mini.last = { from, to, by: p, capture };
  if (Math.floor(to / HP.cols) === hpGoalRow(p)) return { ok: true, outcome: 'win', cells: [to], note: 'through' };
  // That is the only win. A player with no move here plays elsewhere; when neither can move, the
  // square resets (playMove sees that) like a drawn Tic-tac-toe.
  return { ok: true, outcome: 'continue', note: capture ? 'capture' : 'step' };
}
export function publicView(mini) {
  return { type: mini.type, cells: mini.cells.slice() };
}
// Hexapawn: full minimax over the whole game (it is tiny). solve(cells, p) is the outcome with p to move
// and both sides playing on in this square: { win: true when p wins, plies } with plies counting both sides.
// A side with no move passes (it is stuck, not beaten), and the other moves.
export const HP_MEMO = new Map();
// p to move. v: 1 when p gets a pawn through, -1 when the other side does, 0 when the square ends with
// nobody able to move (it resets). A side with no move here waits while the other moves on.
export function hpSolve(cells, p) {
  const key = cells.map(c => c || '.').join('') + p;
  if (HP_MEMO.has(key)) return HP_MEMO.get(key);
  const o = other(p), moves = hpMoves(cells, p);
  let res;
  if (!moves.length && !hpMoves(cells, o).length) res = { v: 0, plies: 0 };            // nobody can move: the square resets
  else if (!moves.length) { const r = hpSolve(cells, o); res = { v: -r.v, plies: r.plies }; }   // stuck: the other side moves
  else {
    let best = null;
    const better = (r, b) => r.v > b.v || (r.v === b.v && (r.v > 0 ? r.plies < b.plies : r.plies > b.plies));
    for (const [a, b] of moves) {
      const next = cells.slice(); next[b] = p; next[a] = null;
      let r;
      if (Math.floor(b / HP.cols) === hpGoalRow(p)) r = { v: 1, plies: 1 };
      else { const q = hpSolve(next, o); r = { v: -q.v, plies: q.plies + 1 }; }
      if (!best || better(r, best)) best = r;
    }
    res = best;
  }
  HP_MEMO.set(key, res);
  return res;
}
// Every move's value for me: a forced win soon is best, a forced loss late is the least bad.
export function hpMovesValued(cells, me) {
  const o = other(me);
  return hpMoves(cells, me).map(([a, b]) => {
    const next = cells.slice(); next[b] = me; next[a] = null;
    let v;
    if (Math.floor(b / HP.cols) === hpGoalRow(me)) v = 100;
    else { const q = hpSolve(next, o); v = q.v > 0 ? -100 + q.plies : q.v < 0 ? 100 - q.plies - 1 : 0; }
    return { move: [a, b], v, after: next };
  });
}
// How many of p's own moves p needs to claim the square, for weighing it on the board. Nobody has to
// move in a square, so "whoever is to move loses" lines from the minimax do not count here: the measure
// is the closest pawn's distance to the far row, one more when p is stuck for now, and 1 when p can
// get a pawn through at once.
export function hpNeeds(cells, p) {
  if (!cells.includes(p)) return Infinity;
  const moves = hpMoves(cells, p);
  for (const [, b] of moves) if (Math.floor(b / HP.cols) === hpGoalRow(p)) return 1;
  let best = Infinity;
  cells.forEach((c, k) => { if (c === p) best = Math.min(best, Math.abs(Math.floor(k / HP.cols) - hpGoalRow(p))); });
  return best + (moves.length ? 0 : 1);
}
export function randomMove(mini, p, rng, from, empties) {
  const ms = hpMoves(mini.cells, p); return ms.length ? from(ms) : null;
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.from = mini.last.from; flash.to = mini.last.to; flash.capture = mini.last.capture; return;
}
export function flashMs(f, winLen, won) {
  return (f.capture ? 1000 : 500) + (won ? 600 : 0);
}
