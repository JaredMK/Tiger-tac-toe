// Clash Grid: the rules (pure: no page, no clock; the server runs the same code).

// Clash Grid (Super Chaos only): a 5x5 grid both players share. A move claims one empty cell. Both claiming
// the same cell in the same round block it for good (grey: nobody's, and it breaks lines). Four in a row (a
// row, a column or a diagonal) takes the square; both completing one in the same round reset it, as does a grid
// that is full, or where neither player can still make four. Each player's claim shows on their own screen at
// once, never judged there (the other player's claim could block it): the round's end (scMerge) puts both
// claims on the shared grid, plays a clash where they met, and only then looks for four in a row (and plays it).
export const CLASH = { n: 5, need: 4, place: 380, hold: 900, clash: 1300 };
// Every run of four cells in a line: 10 across, 10 down, 8 diagonal.
export const CLASH_LINES = (() => {
  const n = CLASH.n, k = CLASH.need, out = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const end = [r + dr * (k - 1), c + dc * (k - 1)];
    if (end[0] < 0 || end[0] >= n || end[1] < 0 || end[1] >= n) continue;
    out.push(Array.from({ length: k }, (_, j) => (r + dr * j) * n + c + dc * j));
  }
  return out;
})();
export const clashLine = (cells, p) => CLASH_LINES.find(l => l.every(k => cells[k] === p)) || null;
export const clashOpen = (cells, p) => CLASH_LINES.filter(l => l.every(k => cells[k] == null || cells[k] === p));   // the runs p can still make four of
export function create(type, rng) {
  return { type, cells: new Array(CLASH.n * CLASH.n).fill(null), last: null };
}
export function apply(mini, p, m, rng, idx) {   // an empty cell: the mover's (until the round's end says otherwise)
  if (!Number.isInteger(m) || m < 0 || m >= mini.cells.length || mini.cells[m] != null) return { ok: false, reason: 'bad' };
  mini.cells[m] = p;
  const line = clashLine(mini.cells, p);
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
  if (f.scr) return CLASH.clash + CLASH.hold;
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
  const line = { X: clashLine(m.cells, 'X'), O: clashLine(m.cells, 'O') }, win = { X: !!line.X, O: !!line.O };
  if (win.X !== win.O) m.winCells = line[win.X ? 'X' : 'O'];
  const out = { win };
  if (met) {
    const pre = JSON.parse(JSON.stringify(m)); pre.cells = c.base.cells.slice(); delete pre.winCells;
    m.last = { by: c.me, c: at.X, blocked: true, line: null };
    out.resolve = { pre, joint: false, flash: { by: c.me, scr: { blocked: at.X } } };
  } else if (win.X || win.O) {                                    // four in a row, found now both claims are down: the recap lights it up
    const pre = JSON.parse(JSON.stringify(m)); delete pre.winCells;
    const who = ['X', 'O'].filter(p => win[p]);
    m.last = { by: who.length === 1 ? who[0] : c.me, c: at[who[0]], line: line[who[0]] };
    out.resolve = { pre, joint: false, flash: { by: who.length === 1 ? who[0] : c.me, scr: { lines: who.map(p => line[p]), who: who.join('') } } };
  }
  if (!win.X && !win.O) {
    if (!m.cells.includes(null)) { out.reset = true; out.note = 'full'; }
    else if (!clashOpen(m.cells, 'X').length && !clashOpen(m.cells, 'O').length) { out.reset = true; out.note = 'blocked'; }
  }
  return out;
}
