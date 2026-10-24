// Standoff Grid: the screen, the miniature, the move's words and sounds, and the inputs.
import { CLASH, clashNeed, clashSize } from './rules.js';
import { esc, mv, state } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';

// The 5x5 grid: a tap on an empty cell claims it (it pops in, in the mover's colour). Four in a row lights
// up only at the round's end (a.scr.lines), once both claims are down.
// A blocked cell is grey, crossed. The round's end where both claimed one cell (a.scr): both marks slam into
// it from either side, then it turns grey for good; where both claimed different cells (a.scr.both), both pop
// in together, then any line lights up.
const ROW = { 3: 'Three', 4: 'Four', 5: 'Five' };
const grid = mini => { const n = clashSize(mini); return n === CLASH.n ? '' : ` style="grid-template-columns:repeat(${n},1fr);grid-template-rows:repeat(${n},1fr)"`; };   // (another width: the admin's setting)
function clashTable(mini, a, o) {
  const k = clashNeed(mini), four = ROW[k] || k;
  const cl = a && a.clash ? a.clash : null, scr = a && a.scr ? a.scr : null, lines = scr && scr.lines ? scr.lines : null;
  const line = cl && cl.line ? cl.line : lines ? [].concat(...lines) : !a && mini.winCells ? mini.winCells : null;   // (the round's end: the lines it found light up)
  const cells = mini.cells.map((c, i) => {
    let cls = 'clc' + (c ? ' ' + c : ''), st = '', inner = c === 'B' ? '<s aria-hidden="true"></s>' : c ? `<b>${esc(c)}</b>` : '';
    if ((cl && i === cl.c) || (scr && scr.both && (i === scr.both.X || i === scr.both.O))) cls += ' pop';
    if (line && line.includes(i)) { cls += ' win'; if (cl || lines) st = ` style="--t:${(lines && !scr.both ? 0 : CLASH.place) + (line.indexOf(i) % k) * 80}ms"`; }
    if (scr && scr.blocked != null && i === scr.blocked) { cls = 'clc clash'; inner = `<i class="cx">X</i><i class="co">O</i><s ${lateAt('', CLASH.clash * 0.55)} aria-hidden="true"></s>`; st = ` style="--t:${Math.round(CLASH.clash * 0.55)}ms"`; }
    return `<button class="${cls}"${st} data-act="move" ${mv(i)} aria-label="Square ${i + 1}${c === 'B' ? ', blocked' : c ? ', ' + esc(c) : ''}"${c || o.locked || o.view || a ? ' disabled' : ''}>${inner}</button>`;
  }).join('');
  const res = lines ? `<p ${lateAt('arcres hot', scr.both ? CLASH.place : null)} role="status">${scr.who.length > 1 ? `Both made ${four.toLowerCase()}!` : `${four} in a row!`}</p>`
    : scr && scr.blocked != null ? `<p ${lateAt('arcres cold', CLASH.clash * 0.55)} role="status">Same square: blocked!</p>`
    : cl && cl.line ? `<p ${lateAt('arcres hot', CLASH.place)} role="status">${four} in a row!</p>`
    : '<p class="arcnote"></p>';
  return `<div class="g-arc"><div class="ctals">${arcTally('X', o, '')}${arcTally('O', o, '')}</div><div class="clashg"><div class="clgrid"${grid(mini)}>${cells}</div>${res}</div></div>`;
}
export function miniature(mini, final) {
  return `<div class="tg gcl"${grid(mini)}>${mini.cells.map(c => `<i class="${c || ''}"></i>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = clashTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  const n = f.scr && f.scr.lines ? f.scr.lines[0].length : f.clash && f.clash.line ? f.clash.line.length : 4, four = (ROW[n] || String(n)).toLowerCase();   // (its line's own length)
  if (f.scr && f.scr.lines) return f.scr.who.length > 1 ? `Both made ${four} in a row` : `${who} made ${four} in a row`;
  if (f.scr && f.scr.blocked != null) return 'Same square: blocked for good';
  if (f.scr && f.scr.both) return 'Both claimed a square';
  return f.clash && f.clash.line ? `${who} made ${four} in a row` : `${who} claimed a square`;
}
export function sounds(f, add, won, mini, last) {
  if (f.scr && f.scr.both) { add('mark', 0); add('mark', 120); }   // both claims drop in
  if (f.scr && f.scr.lines) { add('sparkle', f.scr.both ? CLASH.place : 0); return; }
  if (f.scr && f.scr.blocked != null) { add('stamp', 0); add('stamp', 120); add('knock', Math.round(CLASH.clash * 0.55)); return; }   // both marks slam in, then the cell is shut
  if (f.clash) { add('mark', 0); if (f.clash.line) add('sparkle', CLASH.place); }
}
