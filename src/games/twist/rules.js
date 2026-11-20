// Twist Five: the rules (pure: no page, no clock; the server runs the same code).
// One board of `n` by `n` (`cells`: 'X', 'O' or null), in four quarters. A move places one piece on an empty cell and
// then turns one quarter a quarter turn: `{ c, q, d }` (the cell; the quarter 0 top left, 1 top right, 2 bottom left,
// 3 bottom right; d 1 clockwise, -1 the other way). A line of `L` of one side's pieces, straight or diagonal, wins:
// looked for after the placement (the mover's line there wins at once and nothing is turned: `{ c }` alone is then
// enough) and after the turn: the mover's line wins, also when the turn makes one for both; a turn that makes a line
// for the other side alone gives them the square. A full board with no line is a draw (the square resets).
import { tuneLive } from '../../core/tune.js';

export const TWIST = { place: 300, turn: 460, hold: 420 };         // ms: the piece popping in, the quarter turning, the result
export function create(type, rng) { const t = tuneLive(type), n = t.size === 4 ? 4 : 6; return { type, v: 1, n, L: Math.min(t.line, n), cells: new Array(n * n).fill(null), moves: 0, winCells: null, last: null }; }
// The windows a line can lie in: every run of L cells, straight or diagonal (kept per size and length).
const WIN = new Map();
export function twistLines(n, L) {
  const key = n * 10 + L; if (WIN.has(key)) return WIN.get(key);
  const out = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const er = r + dr * (L - 1), ec = c + dc * (L - 1);
    if (er < 0 || er >= n || ec < 0 || ec >= n) continue;
    out.push(Array.from({ length: L }, (_, k) => (r + dr * k) * n + c + dc * k));
  }
  WIN.set(key, out); return out;
}
// The cells of a line p has on the board (the first found), or null.
export function twistLine(cells, n, L, p) { for (const w of twistLines(n, L)) if (w.every(i => cells[i] === p)) return w; return null; }
// A quarter turned: the board after (a new array). The map of where each of its cells goes is kept per size.
const TURN = new Map();
function turnMap(n, q, d) {
  const key = `${n}:${q}:${d}`; if (TURN.has(key)) return TURN.get(key);
  const h = n / 2, r0 = q >= 2 ? h : 0, c0 = q % 2 ? h : 0, m = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < h; c++) { const from = (r0 + r) * n + c0 + c, tr = d === 1 ? c : h - 1 - c, tc = d === 1 ? h - 1 - r : r; m.push([from, (r0 + tr) * n + c0 + tc]); }
  TURN.set(key, m); return m;
}
export function twistTurn(cells, n, q, d) { const out = cells.slice(); for (const [from, to] of turnMap(n, q, d)) out[to] = cells[from]; return out; }
export const twistTo = (n, q, d, cell) => { const e = turnMap(n, q, d).find(x => x[0] === cell); return e ? e[1] : cell; };   // where a cell ends up after the turn
// What a move comes to, without making it: { cells, end: null | 'win' | 'lose' | 'draw', line, turned }.
export function twistTry(cells, n, L, p, m) {
  const o = p === 'X' ? 'O' : 'X', a = cells.slice(); a[m.c] = p;
  let line = twistLine(a, n, L, p);
  if (line) return { cells: a, end: 'win', line, turned: false };
  if (m.q == null) return null;
  const b = twistTurn(a, n, m.q, m.d);
  line = twistLine(b, n, L, p); if (line) return { cells: b, end: 'win', line, turned: true };
  line = twistLine(b, n, L, o); if (line) return { cells: b, end: 'lose', line, turned: true };
  return { cells: b, end: b.every(Boolean) ? 'draw' : null, line: null, turned: true };
}
export function apply(mini, p, m, rng, idx) {
  const n = mini.n;
  if (!m || typeof m !== 'object' || !Number.isInteger(m.c) || m.c < 0 || m.c >= n * n) return { ok: false, reason: 'bad' };
  if (m.q != null && (![0, 1, 2, 3].includes(m.q) || (m.d !== 1 && m.d !== -1))) return { ok: false, reason: 'bad' };
  if (mini.cells[m.c]) return { ok: false, reason: 'taken' };
  const r = twistTry(mini.cells, n, mini.L, p, m);
  if (!r) return { ok: false, reason: 'noturn' };                   // (no line by the placement alone: the quarter to turn is owed)
  mini.cells = r.cells; mini.moves++;
  mini.last = { by: p, c: m.c, q: r.turned ? m.q : null, d: r.turned ? m.d : null, at: r.turned ? twistTo(n, m.q, m.d, m.c) : m.c };
  if (r.line) mini.winCells = r.line.slice();
  if (r.end === 'win') return { ok: true, outcome: 'win', cells: r.line, note: 'line' };
  if (r.end === 'lose') return { ok: true, outcome: 'win', winner: p === 'X' ? 'O' : 'X', cells: r.line, note: 'gift' };
  if (r.end === 'draw') return { ok: true, outcome: 'draw', note: 'full' };
  return { ok: true, outcome: 'continue', note: 'placed' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return { type: 'twist', v: mini.v, n: mini.n, L: mini.L, cells: mini.cells.slice(), moves: mini.moves, winCells: mini.winCells ? mini.winCells.slice() : null, last: mini.last ? Object.assign({}, mini.last) : null }; }
export function randomMove(mini, p, rng, from, empties) { const e = empties(mini.cells, c => !c); return { c: from(e), q: Math.floor(rng() * 4), d: rng() < 0.5 ? 1 : -1 }; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.tw = Object.assign({}, mini.last, { line: mini.winCells ? mini.winCells.slice() : null }); }
export function flashMs(f, winLen, won) { const l = f.tw; return TWIST.place + (l && l.q != null ? TWIST.turn : 0) + TWIST.hold + (won ? 500 : 0); }
