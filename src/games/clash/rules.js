// Clash Grid: the rules (pure: no page, no clock; the server runs the same code).
import { tune, tuneLive } from '../../core/tune.js';

// Clash Grid (Super Chaos only): a 5x5 grid both players share. A move claims one empty cell. Both claiming
// the same cell in the same round block it for good (grey: nobody's, and it breaks lines). Four in a row (a
// row, a column or a diagonal) takes the square; both completing one in the same round reset it, as does a grid
// that is full, or where neither player can still make four. Each player's claim shows on their own screen at
// once, never judged there (the other player's claim could block it): the round's end (scMerge) puts both
// claims on the shared grid, plays a clash where they met, and only then looks for four in a row (and plays it).
export const CLASH = { n: 5, need: 4, place: 380, hold: 900, clash: 1300 };   // (n, need: the defaults of its settings, TUNE in meta.js)
// Every run of k cells in a line on an n x n grid (5 and 4: 10 across, 10 down, 8 diagonal).
const LINES = {};
export function clashLines(n = CLASH.n, k = CLASH.need) {
  if (LINES[n + ':' + k]) return LINES[n + ':' + k];
  const out = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const end = [r + dr * (k - 1), c + dc * (k - 1)];
    if (end[0] < 0 || end[0] >= n || end[1] < 0 || end[1] >= n) continue;
    out.push(Array.from({ length: k }, (_, j) => (r + dr * j) * n + c + dc * j));
  }
  return (LINES[n + ':' + k] = out);
}
export const CLASH_LINES = clashLines();
export const clashSize = mini => Math.round(Math.sqrt(mini.cells.length));   // the grid's width (the square keeps it as its cells)
export const clashNeed = mini => tune(mini).need || CLASH.need;               // how many in a row: the square's own setting
export const clashLinesOf = mini => clashLines(clashSize(mini), clashNeed(mini));
export const clashLine = (cells, p, lines = CLASH_LINES) => lines.find(l => l.every(k => cells[k] === p)) || null;
export const clashOpen = (cells, p, lines = CLASH_LINES) => lines.filter(l => l.every(k => cells[k] == null || cells[k] === p));   // the runs p can still make four of
export function create(type, rng) {
  const n = tuneLive(type).n;                                    // (the admin's setting: the grid's width)
  return { type, cells: new Array(n * n).fill(null), last: null };
}
export function apply(mini, p, m, rng, idx) {   // an empty cell: the mover's (until the round's end says otherwise)
  if (!Number.isInteger(m) || m < 0 || m >= mini.cells.length || mini.cells[m] != null) return { ok: false, reason: 'bad' };
  mini.cells[m] = p;
  const line = clashLine(mini.cells, p, clashLinesOf(mini));
  mini.last = { by: p, c: m, line };
  if (line) return { ok: true, outcome: 'win', note: 'four', cells: line };
  return { ok: true, outcome: 'continue', note: 'claim' };
}
// Super Chaos (the only way it is played): the claim alone; lines are looked for at the round's end.
export function scApply(mini, p, m, rng) {
  if (!Number.isInteger(m) || m < 0 || m >= mini.cells.length || mini.cells[m] != null) return { ok: false, reason: 'bad' };
  mini.cells[m] = p;
  mini.last = { by: p, c: m, line: null };
  return { ok: true, outcome: 'continue', note: 'claim' };
}
export function publicView(mini) {   // nothing hidden
  return { type: 'clash', cells: mini.cells.slice(), last: mini.last ? Object.assign({}, mini.last) : null };
}
export function randomMove(mini, p, rng, from, empties) {
  return from(empties(mini.cells, c => c == null));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.clash = { c: l.c, line: l.line ? l.line.slice() : null };
}
export function flashMs(f, winLen, won) {
  if (f.scr) return (f.scr.blocked != null ? CLASH.clash : f.scr.both ? CLASH.place : 0) + (f.scr.lines ? 600 : 0) + CLASH.hold;
  return CLASH.place + CLASH.hold + (f.clash && f.clash.line ? 600 : 0);
}
// The round's end: both claims on the grid, X's and O's (one cell claimed by both: blocked, with a clash in
// the square for the recap); then four in a row for either (both: a reset), else a full or dead grid resets.
export function scMerge(m, c) {
  const at = {};
  for (const p of c.played) { const l = c.forks[p].last; if (l && l.by === p && Number.isInteger(l.c) && c.base.cells[l.c] == null) at[p] = l.c; }
  m.cells = c.base.cells.slice();
  const met = at.X != null && at.X === at.O;
  if (met) m.cells[at.X] = 'B';
  else for (const p of Object.keys(at)) m.cells[at[p]] = p;
  const L = clashLinesOf(m), line = { X: clashLine(m.cells, 'X', L), O: clashLine(m.cells, 'O', L) }, win = { X: !!line.X, O: !!line.O };
  if (win.X !== win.O) m.winCells = line[win.X ? 'X' : 'O'];
  const out = { win }, joint = at.X != null && at.O != null;   // (both claimed here this round: both claims drop in together, in each player's own view)
  if (met || joint || win.X || win.O) {                          // settled now both claims are down: a cell both took is shut; four in a row lights up
    const pre = JSON.parse(JSON.stringify(m)); delete pre.winCells;
    if (met || joint) pre.cells = c.base.cells.slice();
    const who = ['X', 'O'].filter(p => win[p]), scr = {};
    if (met) { scr.blocked = at.X; m.last = { by: c.me, c: at.X, blocked: true, line: null }; }
    else if (joint) scr.both = { X: at.X, O: at.O };
    if (who.length) { scr.lines = who.map(p => line[p]); scr.who = who.join(''); m.last = { by: who.length === 1 ? who[0] : c.me, c: at[who[0]], line: line[who[0]] }; }
    out.resolve = { pre, joint, flash: { by: who.length === 1 ? who[0] : c.me, scr } };
  }
  if (!win.X && !win.O) {
    if (!m.cells.includes(null)) { out.reset = true; out.note = 'full'; }
    else if (!clashOpen(m.cells, 'X', L).length && !clashOpen(m.cells, 'O', L).length) { out.reset = true; out.note = 'blocked'; }
  }
  return out;
}
