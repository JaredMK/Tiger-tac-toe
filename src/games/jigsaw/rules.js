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
// Two options, both off by default (the admin's; a square keeps what it was dealt with, so one dealt before them plays
// on as it was). `edges` marks the pieces of the picture's outer border (the view alone: nothing here changes).
// `rotate`: the draw also draws how the piece is turned, by the same rng (`rot`: 1, 2 or 3 quarter turns clockwise,
// never upright; public once drawn, like the piece, and null once it is placed or back in the pile); the player turns
// it on their own phone (a draft) and the placement says how they left it, `{ c, r }` (r: 0 to 3 quarter turns
// clockwise as the player sees it, 0 upright). It fits only in its own cell and upright; its own cell turned any other
// way is a wrong placement like any other (no point, back in the pile; note 'turn'). Without the option a placement is
// `{ c }` alone, as ever.
import { needRng, randInt } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';

// A move's moments (ms from the move). A draw: the piece slides out of the pile onto the tray (`out`), a breath
// (`rest`). A placement: the piece travels to the cell chosen (`fly`), the verdict (`snap`: it clicks in with a shine,
// or shakes), a wrong one flies back to the pile (`back`); 'out': the piece wobbles on the tray (`slow`) and goes back.
// The square decided: the pieces still in the pile drop into their places one after another (`fill` apart, from
// `fill0` after the verdict), then the cuts fade and the whole picture shows (`whole`), held a moment (`show`).
export const JIG = { out: 420, rest: 80, fly: 360, snap: 340, back: 380, slow: 420, hold: 240, fill0: 160, fill: 90, whole: 620, show: 520, turn: 190, rot: 170 };
// (`rotate` on: someone else's placement first shows their piece turning on the tray from how it was drawn to how they
// placed it, `turn` a quarter turn, before it travels (jigTimes `pre`; this phone's own placement goes at once: its
// piece is already as its player turned it); `rot`: this phone's Rotate, a quarter turn of the piece on the tray.)
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
// The options (both off by default), and how the piece on show is turned (quarter turns clockwise; 0 without the option
// or with no piece on show).
export const jigEdgesOn = mini => tune(mini).edges === 'on';
export const jigRotOn = mini => tune(mini).rotate === 'on';
export const jigRot = mini => (jigRotOn(mini) && jigOffer(mini) != null && Number.isInteger(mini.rot) && mini.rot >= 0 && mini.rot <= 3 ? mini.rot : 0);
// The sides of cell i that lie on the picture's outer border, in the order top, right, bottom, left: a corner piece
// two, a piece on an edge between the corners one, an inner piece none (the edge marks: the view's).
export function jigBorder(n, i) {
  const r = Math.floor(i / n), c = i % n, out = [];
  if (r === 0) out.push('t'); if (c === n - 1) out.push('r'); if (r === n - 1) out.push('b'); if (c === 0) out.push('l');
  return out;
}
// A placement's quarter turns from how its piece was drawn to how it was placed (clockwise; none without the option or
// for a piece run out of time).
export const jigTurns = a => (a && a.at >= 0 && Number.isInteger(a.r) && Number.isInteger(a.rot) ? (((a.r - a.rot) % 4) + 4) % 4 : 0);
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
  const rotOn = jigRotOn(mini);
  if (m === JIG_DRAW) {                                             // Draw a piece: one whose cell touches the pieces on the board, by this move's rng
    if (offer != null) return { ok: false, reason: 'bad' };         // (one on show already: it is placed first)
    const edge = jigEdge(mini);
    if (!edge.length || jigEnd(mini)) return { ok: false, reason: 'bad' };
    const g = needRng(rng);
    mini.offer = edge[randInt(g, edge.length)]; mini.by = p; mini.k = (mini.k | 0) + 1;
    if (rotOn) mini.rot = 1 + randInt(g, 3);                        // (`rotate` on: how it comes out turned, by the same rng: never upright)
    return { ok: true, outcome: 'continue', note: 'draw', again: true };   // the turn goes on: the placement
  }
  if (offer == null) return { ok: false, reason: 'bad' };
  const rot = jigRot(mini);
  let at, r = 0;
  if (m === JIG_OUT) { at = -1; r = rot; }                          // the piece timer ran down (or the turn's own time: timeoutClose); it stays as it was drawn
  else if (m && typeof m === 'object' && !Array.isArray(m) && Object.keys(m).sort().join() === (rotOn ? 'c,r' : 'c') && Number.isInteger(m.c) && m.c >= 0 && m.c < jigSize(mini) ** 2 && jigCells(mini)[m.c] === '.' && (!rotOn || (Number.isInteger(m.r) && m.r >= 0 && m.r <= 3))) { at = m.c | 0; r = rotOn ? m.r | 0 : 0; }   // ({ c } alone; with `rotate` on, { c, r } exactly)
  else return { ok: false, reason: 'bad' };
  const was = jigGot(mini), ok = at === offer && r === 0;
  mini.offer = null; mini.by = null;
  if (rotOn) mini.rot = null;
  if (ok) { setCell(mini, at, p); mini.got = { X: was.X + (p === 'X' ? 1 : 0), O: was.O + (p === 'O' ? 1 : 0) }; }
  const end = ok ? jigEnd(mini) : null;
  mini.last = { by: p, c: offer, at, ok, was, end: end || null };
  if (rotOn) { mini.last.r = r; mini.last.rot = rot; }             // (how it was placed, and how it was drawn: the replay turns it from one to the other)
  if (end === 'draw') return { ok: true, outcome: 'draw', note: 'tie' };
  if (end) return { ok: true, outcome: 'win', note: 'won' };       // (only the mover's count grew: the mover's)
  if (ok && goAgain(mini)) return { ok: true, outcome: 'continue', note: 'fits', again: true };   // ("Go again on success" on: the next piece is theirs to draw)
  return { ok: true, outcome: 'continue', note: ok ? 'fits' : at < 0 ? 'out' : at === offer ? 'turn' : 'wrong' };   // ('turn': its own cell, turned the wrong way)
}
// A turn out of time with a piece on show: the piece goes back, no point (and it is not a missed turn: core/board.js).
export function timeoutClose(mini, p) { return jigOffer(mini) != null && mini.by === p ? JIG_OUT : null; }
export function publicView(mini) {
  const v = { type: 'jigsaw', n: jigSize(mini), seed: mini.seed, placed: jigCells(mini).join(''), got: jigGot(mini), offer: jigOffer(mini), by: mini.by || null, k: mini.k | 0, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null };
  if (jigRotOn(mini)) v.rot = jigOffer(mini) != null ? jigRot(mini) : null;   // (`rotate` on: how the piece on show is turned)
  return v;
}
// (the tests' stand-in: the draw, then any empty cell, turned any way with `rotate` on)
export function randomMove(mini, p, rng, from, empties) {
  if (jigOffer(mini) == null) return jigEdge(mini).length ? JIG_DRAW : null;
  const open = jigCells(mini).map((v, i) => (v === '.' ? i : -1)).filter(i => i >= 0);
  if (!open.length) return JIG_OUT;
  const c = open[randInt(needRng(rng), open.length)];
  return jigRotOn(mini) ? { c, r: randInt(rng, 4) } : { c };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  if (m === JIG_DRAW) { flash.jig = { draw: true, by: p, c: jigOffer(mini), k: mini.k | 0 }; if (jigRotOn(mini)) flash.jig.rot = jigRot(mini); return; }   // the draw: the piece that came out, and how it is turned (a replay shows this one, never the square's)
  const l = mini.last;
  flash.jig = { by: p, c: l.c, at: l.at, ok: l.ok, was: { X: l.was.X, O: l.was.O }, got: jigGot(mini), end: l.end, placed: jigCells(mini).join(''), fill: l.end ? jigLeft(mini) : 0 };
  if (jigRotOn(mini) && Number.isInteger(l.r)) { flash.jig.r = l.r; flash.jig.rot = Number.isInteger(l.rot) ? l.rot : 0; }   // (how it was placed, how it was drawn)
}
// A placement's moments (ms from the move; a: its flash's jig): with `rotate` on, someone else's piece first turns on
// the tray from how it was drawn to how they placed it (pre: a quarter turn each JIG.turn; none for this phone's own,
// `own`, whose piece is already as its player turned it, nor without the option); the piece lands on its cell (land),
// the verdict (the same moment: the click or the shake), a wrong piece leaves for the pile (back) and is in it (home);
// the square decided: the pile's pieces drop in from `fill`, the cuts fade from `whole`; the move's animation ends
// (end). The move's own time (flashMs) is the longest of these, with the turn.
export function jigTimes(a, own) {
  const T = JIG, out = !!a && a.at < 0, pre = own ? 0 : jigTurns(a) * T.turn, land = pre + (out ? T.slow : T.fly), back = a && !a.ok ? land + (out ? 0 : T.snap) : null, home = back != null ? back + T.back : null;
  const fill = a && a.end ? land + T.snap + T.fill0 : null, whole = fill != null ? fill + (a.fill || 0) * T.fill + (a.fill ? 200 : 0) : null;
  return { pre, land, back, home, fill, whole, end: whole != null ? whole + T.whole + T.show : home != null ? home + T.hold : land + T.snap + T.hold };
}
export function flashMs(f, winLen, won) { const a = f.jig; return !a ? JIG.fly + JIG.snap : a.draw ? JIG.out + JIG.rest : jigTimes(a).end; }
