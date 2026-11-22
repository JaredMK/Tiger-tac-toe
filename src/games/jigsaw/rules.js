// Puzzle Build: the rules (pure: no page, no clock; the server runs the same code).
// One shared picture puzzle, `n` by `n` pieces (the `size` setting, 3 to 5), its picture drawn from the square's public
// `seed` by a pure function (picture.js: the page's alone; nothing here knows what is in it). On an odd grid the centre
// piece is in place from the start, laid by nobody (the `centre` setting; an even grid has no single centre and starts
// empty). `placed` is the board, one character a cell: '.' empty, 'X' or 'O' whoever laid that piece, 'C' the centre
// laid at the deal (a string: it survives the database whole, as a list with gaps would not). `got` is each player's
// count of pieces laid.
// A turn is two steps, as Bingo's: 'draw' (the rules take, by the move's rng, so online the server's at that moment, a
// piece from the pile whose own cell touches a piece already on the board, up, down, left or right; `offer` is that
// piece: its cell, public from then on, null before, so nothing can be studied during the other player's turn; `by` who
// drew it; `again`: the turn goes on, held to the square) and then the placement `{ c }`, the empty cell tapped, or 'out'
// (the piece timer on the mover's phone ran down: the phone's word, so the game is held out of Find Match,
// core/games.js FIND_MATCH_HOLD). The piece's own cell: it locks in and counts for the mover. Any other cell, or 'out':
// no point, and the piece goes back in the pile (it can come up again). A turn that runs out on the server after the
// draw ends the same way (timeoutClose: 'out'; not a missed turn).
// More than half of the pieces to lay takes the square at once (jigNeed); once neither player can still get there (an
// even number of pieces, level: 4-4 of 8) it is a draw and the square resets. "Go again on success" on: a piece that
// fits keeps the turn (the next piece is drawn and placed).
import { needRng, randInt } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';

// A move's moments (ms from the move). A draw: the piece slides out of the pile onto the tray (`out`), a breath
// (`rest`). A placement: the piece travels to the cell chosen (`fly`), the verdict (`snap`: it clicks in with a shine,
// or shakes), a wrong one flies back to the pile (`back`); 'out': the piece wobbles on the tray (`slow`) and goes back.
// The square decided: the pieces still in the pile drop into their places one after another (`fill` apart, from
// `fill0` after the verdict), then the cuts fade and the whole picture shows (`whole`), held a moment (`show`).
export const JIG = { out: 420, rest: 80, fly: 360, snap: 340, back: 380, slow: 420, hold: 240, fill0: 160, fill: 90, whole: 620, show: 520 };
export const JIG_LIMITS = { size: [3, 5] };
export const JIG_DRAW = 'draw', JIG_OUT = 'out';
const clampInt = (v, [lo, hi], def) => { const n = v == null || v === '' ? NaN : Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };
export const jigSize = mini => clampInt(mini && mini.n, JIG_LIMITS.size, 3);
export const jigCells = mini => { const n = jigSize(mini), s = typeof (mini && mini.placed) === 'string' ? mini.placed : ''; return Array.from({ length: n * n }, (_, i) => (s[i] === 'X' || s[i] === 'O' || s[i] === 'C' ? s[i] : '.')); };
export const jigOffer = mini => (mini && Number.isInteger(mini.offer) && mini.offer >= 0 && mini.offer < jigSize(mini) ** 2 ? mini.offer : null);   // the piece on show (its cell), or null
export const jigGot = mini => ({ X: (mini && mini.got && mini.got.X) | 0, O: (mini && mini.got && mini.got.O) | 0 });
// The pieces the players lay (every cell but a centre laid at the deal), and how many take the square: more than half.
export const jigTotal = mini => jigCells(mini).filter(v => v !== 'C').length;
export const jigNeed = mini => Math.floor(jigTotal(mini) / 2) + 1;
export const jigLeft = mini => jigCells(mini).filter(v => v === '.').length;
// A cell's neighbours (up, down, left, right) on an n by n grid.
export function jigNear(n, i) {
  const r = Math.floor(i / n), c = i % n, out = [];
  if (r > 0) out.push(i - n); if (r < n - 1) out.push(i + n); if (c > 0) out.push(i - 1); if (c < n - 1) out.push(i + 1);
  return out;
}
// The empty cells that touch a piece on the board: where the next piece can come from, and the only places a piece on
// offer can belong. An empty board: every cell.
export function jigEdge(mini) {
  const n = jigSize(mini), cells = jigCells(mini), open = cells.map((v, i) => (v === '.' ? i : -1)).filter(i => i >= 0);
  if (open.length === cells.length) return open;
  return open.filter(i => jigNear(n, i).some(j => cells[j] !== '.'));
}
// The square's end as it stands: 'X' or 'O' (more than half), 'draw' (neither can still get there), or null.
export function jigEnd(mini) {
  const g = jigGot(mini), need = jigNeed(mini), left = jigLeft(mini);
  if (g.X >= need) return 'X';
  if (g.O >= need) return 'O';
  return g.X + left < need && g.O + left < need ? 'draw' : null;
}
export function create(type, rng) {
  rng = needRng(rng);
  const t = tuneLive(type), n = clampInt(t.size, JIG_LIMITS.size, 3), mid = n % 2 && t.centre !== 'off' ? (n * n - 1) / 2 : -1;
  return { type, n, seed: randInt(rng, 1e9), placed: Array.from({ length: n * n }, (_, i) => (i === mid ? 'C' : '.')).join(''), got: { X: 0, O: 0 }, offer: null, by: null, k: 0, last: null };   // (k: the pieces drawn so far; no offer: the first turn draws it)
}
const setCell = (mini, i, v) => { const a = jigCells(mini); a[i] = v; mini.placed = a.join(''); };
export function apply(mini, p, m, rng, idx) {
  const offer = jigOffer(mini);
  if (m === JIG_DRAW) {                                             // Draw a piece: one whose cell touches the pieces on the board, by this move's rng
    if (offer != null) return { ok: false, reason: 'bad' };         // (one on show already: it is placed first)
    const edge = jigEdge(mini);
    if (!edge.length || jigEnd(mini)) return { ok: false, reason: 'bad' };
    mini.offer = edge[randInt(needRng(rng), edge.length)]; mini.by = p; mini.k = (mini.k | 0) + 1;
    return { ok: true, outcome: 'continue', note: 'draw', again: true };   // the turn goes on: the placement
  }
  if (offer == null) return { ok: false, reason: 'bad' };
  let at;
  if (m === JIG_OUT) at = -1;                                       // the piece timer ran down (or the turn's own time: timeoutClose)
  else if (m && typeof m === 'object' && !Array.isArray(m) && Object.keys(m).length === 1 && Number.isInteger(m.c) && m.c >= 0 && m.c < jigSize(mini) ** 2 && jigCells(mini)[m.c] === '.') at = m.c;
  else return { ok: false, reason: 'bad' };
  const was = jigGot(mini), ok = at === offer;
  mini.offer = null; mini.by = null;
  if (ok) { setCell(mini, at, p); mini.got = { X: was.X + (p === 'X' ? 1 : 0), O: was.O + (p === 'O' ? 1 : 0) }; }
  const end = ok ? jigEnd(mini) : null;
  mini.last = { by: p, c: offer, at, ok, was, end: end || null };
  if (end === 'draw') return { ok: true, outcome: 'draw', note: 'tie' };
  if (end) return { ok: true, outcome: 'win', note: 'won' };       // (only the mover's count grew: the mover's)
  if (ok && goAgain(mini)) return { ok: true, outcome: 'continue', note: 'fits', again: true };   // ("Go again on success" on: the next piece is theirs to draw)
  return { ok: true, outcome: 'continue', note: ok ? 'fits' : at < 0 ? 'out' : 'wrong' };
}
// A turn out of time with a piece on show: the piece goes back, no point (and it is not a missed turn: core/board.js).
export function timeoutClose(mini, p) { return jigOffer(mini) != null && mini.by === p ? JIG_OUT : null; }
export function publicView(mini) {
  return { type: 'jigsaw', n: jigSize(mini), seed: mini.seed, placed: jigCells(mini).join(''), got: jigGot(mini), offer: jigOffer(mini), by: mini.by || null, k: mini.k | 0, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null };
}
// (the tests' stand-in: the draw, then any empty cell)
export function randomMove(mini, p, rng, from, empties) {
  if (jigOffer(mini) == null) return jigEdge(mini).length ? JIG_DRAW : null;
  const open = jigCells(mini).map((v, i) => (v === '.' ? i : -1)).filter(i => i >= 0);
  return open.length ? { c: open[randInt(needRng(rng), open.length)] } : JIG_OUT;
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  if (m === JIG_DRAW) { flash.jig = { draw: true, by: p, c: jigOffer(mini), k: mini.k | 0 }; return; }   // the draw: the piece that came out (a replay shows this one, never the square's)
  const l = mini.last;
  flash.jig = { by: p, c: l.c, at: l.at, ok: l.ok, was: { X: l.was.X, O: l.was.O }, got: jigGot(mini), end: l.end, placed: jigCells(mini).join(''), fill: l.end ? jigLeft(mini) : 0 };
}
// A placement's moments (ms from the move; a: its flash's jig): the piece lands on its cell (land), the verdict (the
// same moment: the click or the shake), a wrong piece leaves for the pile (back) and is in it (home); the square
// decided: the pile's pieces drop in from `fill`, the cuts fade from `whole`; the move's animation ends (end).
export function jigTimes(a) {
  const T = JIG, out = !!a && a.at < 0, land = out ? T.slow : T.fly, back = a && !a.ok ? land + (out ? 0 : T.snap) : null, home = back != null ? back + T.back : null;
  const fill = a && a.end ? land + T.snap + T.fill0 : null, whole = fill != null ? fill + (a.fill || 0) * T.fill + (a.fill ? 200 : 0) : null;
  return { land, back, home, fill, whole, end: whole != null ? whole + T.whole + T.show : home != null ? home + T.hold : land + T.snap + T.hold };
}
export function flashMs(f, winLen, won) { const a = f.jig; return !a ? JIG.fly + JIG.snap : a.draw ? JIG.out + JIG.rest : jigTimes(a).end; }
