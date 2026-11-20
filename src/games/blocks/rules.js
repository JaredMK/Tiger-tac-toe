// Block Drop: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own board (`grid[p]`: rows from the bottom, each cell 0 or a piece's colour) and their own run of
// pieces (the k-th piece of a player is the same wherever it is worked out: `blockKind`, from the square's public
// seed). A turn is `pieces` pieces, one a move (the turn is held between them, `again`): a move is where to drop the
// piece, `{ r, c }` (its turn of four, its left column); it falls straight down and rests on what is there. A full
// row clears and counts a line. A piece that would rest above the top fills the board: it is cleared and its player
// loses a line, and the turn ends. First to `lines` lines takes the square. Nothing hidden, nothing by chance: the
// server makes the same move.
// Equal turns (`even`, on by default: without it both players finish on the same turn nearly every time and the first
// to move takes three squares in four): a player who reaches the target having had a turn more than the other
// (`mini.final`) does not take the square yet: the other player has one turn to answer. Reaching the target too, the
// fewer pieces used wins; level, the fewer blocks left on the board; still level, a draw and the square resets.
// Falling short leaves it to the first (`held`, with `winner`); an answer never made is taken by the leader's next
// move there (`unanswered`). A turn left unfinished when its time runs out ends there ('end', timeoutClose).
// Junk rows (`junk`, off by default): two or more rows cleared by one piece send one junk row fewer than that to the
// other player's board, pushed in under their stack (one gap in each, drawn by the move's rng); a stack pushed over
// the top clears that board and costs its player a line.
import { makeRng, needRng } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

export const BLOCKS = { fall: 300, clear: 300, hold: 380, junkCol: 9 };   // ms: the piece's fall, a cleared row's flash; the colour of a junk cell
// The pieces (never more than three cells but for the square): each turn of it as cells [x, y], y up from its foot.
export const KINDS = [
  { id: 'two', w: 2, rot: [[[0, 0], [1, 0]], [[0, 0], [0, 1]]] },
  { id: 'three', w: 2, rot: [[[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]]] },
  { id: 'corner', w: 3, rot: [[[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1]], [[1, 0], [0, 1], [1, 1]], [[0, 0], [0, 1], [1, 1]]] },
  { id: 'square', w: 1, rot: [[[0, 0], [1, 0], [0, 1], [1, 1]]] },
];
export function blocksCfg(mini) { const t = tune(mini); return { lines: t.lines, pieces: t.pieces, junk: t.junk === 'on', even: t.even !== 'off' }; }
export function create(type, rng) {
  const t = tuneLive(type), cols = t.cols, rows = t.rows, empty = () => Array.from({ length: rows }, () => Array(cols).fill(0));
  return { type, seed: Math.floor(needRng(rng)() * 1e9), cols, rows, grid: { X: empty(), O: empty() }, lines: { X: 0, O: 0 }, k: { X: 0, O: 0 }, turns: { X: 0, O: 0 }, run: null, final: null, last: null };
}
export function blockKind(mini, p, k) { const r = makeRng(`blocks:${mini.seed}:${p}:${k}`), tot = KINDS.reduce((x, q) => x + q.w, 0); let v = r() * tot; for (let i = 0; i < KINDS.length; i++) { v -= KINDS[i].w; if (v < 0) return i; } return 0; }
export const blockCells = (kind, r) => { const q = KINDS[kind].rot; return q[((r % q.length) + q.length) % q.length]; };
export const blockWide = cells => cells.reduce((x, c) => Math.max(x, c[0]), 0) + 1;
// Where a piece dropped with its left edge on column c comes to rest on a grid: its cells [x, y], or null off the sides.
export function blockRest(grid, cells, c) {
  const cols = grid[0].length, rows = grid.length;
  if (!Number.isInteger(c) || c < 0 || c + blockWide(cells) > cols) return null;
  const top = x => { for (let y = rows - 1; y >= 0; y--) if (grid[y][x]) return y + 1; return 0; };
  const y0 = cells.reduce((m, [dx, dy]) => Math.max(m, top(c + dx) - dy), 0);
  return cells.map(([dx, dy]) => [c + dx, y0 + dy]);
}
// The move worked out on a copy: { grid, at (the cells), cleared (rows, as they stood), over (the board filled) }.
export function blockTry(grid, kind, r, c) {
  const at = blockRest(grid, blockCells(kind, r), c); if (!at) return null;
  const rows = grid.length, cols = grid[0].length;
  if (at.some(q => q[1] >= rows)) return { grid: grid.map(() => Array(cols).fill(0)), at, cleared: [], over: true };
  const g = grid.map(row => row.slice()); at.forEach(([x, y]) => { g[y][x] = kind + 1; });
  const cleared = []; g.forEach((row, y) => { if (row.every(v => v)) cleared.push(y); });
  const kept = g.filter((row, y) => !cleared.includes(y)); while (kept.length < rows) kept.push(Array(cols).fill(0));
  return { grid: kept, at, cleared, over: false };
}
export function blockPlaces(grid, kind) { const out = []; KINDS[kind].rot.forEach((cells, r) => { for (let c = 0; c + blockWide(cells) <= grid[0].length; c++) out.push({ r, c }); }); return out; }
export function apply(mini, p, m, rng, idx) {
  const c = blocksCfg(mini), o = p === 'X' ? 'O' : 'X', mine = mini.run && mini.run.by === p;
  const answering = mini.final && mini.final.by === o;
  if (m === 'end') { if (!mine) return { ok: false, reason: 'norun' }; mini.run = null; return answering ? { ok: true, outcome: 'win', winner: o, note: 'held' } : { ok: true, outcome: 'continue', note: 'end' }; }
  if (!m || typeof m !== 'object' || !Number.isInteger(m.r) || m.r < 0 || m.r > 3 || !Number.isInteger(m.c)) return { ok: false, reason: 'bad' };
  const kind = blockKind(mini, p, mini.k[p]), t = blockTry(mini.grid[p], kind, m.r, m.c);
  if (!t) return { ok: false, reason: 'off' };
  if (mini.final && mini.final.by === p) { mini.last = null; return { ok: true, outcome: 'win', note: 'unanswered' }; }   // (the answer was never made: the square is the leader's)
  if (!mine) mini.turns[p] = (mini.turns[p] || 0) + 1;
  const was = mini.grid[p].map(row => row.slice()), from = mini.lines[p];
  mini.grid[p] = t.grid; mini.k[p]++;
  mini.lines[p] = t.over ? Math.max(0, from - 1) : Math.min(c.lines, from + t.cleared.length);
  let junk = 0, hit = false;
  if (c.junk && t.cleared.length > 1 && mini.lines[p] < c.lines) {    // junk rows in under the other player's stack
    const r = needRng(rng), g = mini.grid[o]; junk = t.cleared.length - 1;
    if (g.slice(mini.rows - junk).some(row => row.some(v => v))) { mini.grid[o] = g.map(() => Array(mini.cols).fill(0)); mini.lines[o] = Math.max(0, mini.lines[o] - 1); hit = true; }
    else { for (let k = 0; k < junk; k++) { const gap = Math.floor(r() * mini.cols); g.pop(); g.unshift(Array.from({ length: mini.cols }, (_, x) => (x === gap ? 0 : BLOCKS.junkCol))); } }
  }
  const left = t.over ? 0 : (mine ? mini.run.left : c.pieces) - 1;
  mini.last = { by: p, kind, r: m.r % KINDS[kind].rot.length, c: m.c, at: t.at, cleared: t.cleared, over: t.over, junk, hit, from, to: mini.lines[p], left, was };
  const blocksLeft = q => mini.grid[q].reduce((x, row) => x + row.filter(v => v).length, 0);
  if (mini.lines[p] >= c.lines) {
    mini.run = null;
    if (answering) {                                                // the answer reached the target too: the fewer pieces, then the cleaner board
      const f = mini.final, mineLeft = blocksLeft(p), d = (mini.k[p] - f.k) || (mineLeft - f.left);
      mini.last.ans = { k: mini.k[p], left: mineLeft, fk: f.k, fleft: f.left };
      return d < 0 ? { ok: true, outcome: 'win', note: 'passed' } : d > 0 ? { ok: true, outcome: 'win', winner: o, note: 'held' } : { ok: true, outcome: 'draw', note: 'tie' };
    }
    if (c.even && (mini.turns[p] || 0) > (mini.turns[o] || 0)) { mini.final = { by: p, k: mini.k[p], left: blocksLeft(p) }; return { ok: true, outcome: 'continue', note: 'reached' }; }
    return { ok: true, outcome: 'win', note: 'won' };
  }
  if (answering && left <= 0) { mini.run = null; return { ok: true, outcome: 'win', winner: o, note: 'held' }; }
  mini.run = left > 0 ? { by: p, left } : null;
  return { ok: true, outcome: 'continue', note: t.over ? 'over' : t.cleared.length ? 'line' : 'place', again: left > 0 };
}
export function timeoutClose(mini, p) { return mini.run && mini.run.by === p ? 'end' : null; }
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
export function randomMove(mini, p, rng, from, empties) { return from(blockPlaces(mini.grid[p], blockKind(mini, p, mini.k[p]))); }
export function moveFlash(m, p, range, bjFrom, mini, flash) { if (m !== 'end' && mini.last) flash.bd = JSON.parse(JSON.stringify(mini.last)); }
export function flashMs(f, winLen, won) { return f.bd ? BLOCKS.fall + (f.bd.cleared.length || f.bd.over ? BLOCKS.clear : 0) + BLOCKS.hold + (won ? 500 : 0) : 0; }
