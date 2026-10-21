// Clash Grid: the screen, the miniature, the move's words and sounds, and the inputs.
import { CLASH } from './rules.js';
import { mv, state } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';

// The 5x5 grid: a tap on an empty cell claims it (it pops in, in the mover's colour). Four in a row lights
// up only at the round's end (a.scr.lines), once both claims are down.
// A blocked cell is grey, crossed. The round's end where both claimed one cell (a.scr): both marks slam into
// it from either side, then it turns grey for good.
function clashTable(mini, a, o) {
  const cl = a && a.clash ? a.clash : null, scr = a && a.scr ? a.scr : null, lines = scr && scr.lines ? scr.lines : null;
  const line = cl && cl.line ? cl.line : lines ? [].concat(...lines) : !a && mini.winCells ? mini.winCells : null;   // (the round's end: the lines it found light up)
  const cells = mini.cells.map((c, i) => {
    let cls = 'clc' + (c ? ' ' + c : ''), st = '', inner = c === 'B' ? '<s aria-hidden="true"></s>' : c ? `<b>${c}</b>` : '';
    if (cl && i === cl.c) cls += ' pop';
    if (line && line.includes(i)) { cls += ' win'; if (cl || lines) st = ` style="--t:${(lines ? 0 : CLASH.place) + (line.indexOf(i) % CLASH.need) * 80}ms"`; }
    if (scr && scr.blocked != null && i === scr.blocked) { cls = 'clc clash'; inner = `<i class="cx">X</i><i class="co">O</i><s ${lateAt('', CLASH.clash * 0.55)} aria-hidden="true"></s>`; st = ` style="--t:${Math.round(CLASH.clash * 0.55)}ms"`; }
    return `<button class="${cls}"${st} data-act="move" ${mv(i)} aria-label="Square ${i + 1}${c === 'B' ? ', blocked' : c ? ', ' + c : ''}"${c || o.locked || o.view || a ? ' disabled' : ''}>${inner}</button>`;
  }).join('');
  const res = lines ? `<p class="arcres hot" role="status">${scr.who.length > 1 ? 'Both made four!' : 'Four in a row!'}</p>`
    : scr ? `<p ${lateAt('arcres cold', CLASH.clash * 0.55)} role="status">Same square: blocked!</p>`
    : cl && cl.line ? `<p ${lateAt('arcres hot', CLASH.place)} role="status">Four in a row!</p>`
    : '<p class="arcnote"></p>';
  return `<div class="g-arc"><div class="ctals">${arcTally('X', o, '')}${arcTally('O', o, '')}</div><div class="clashg"><div class="clgrid">${cells}</div>${res}</div></div>`;
}
export function miniature(mini, final) {
  return `<div class="tg gcl">${mini.cells.map(c => `<i class="${c || ''}"></i>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = clashTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  if (f.scr && f.scr.lines) return f.scr.who.length > 1 ? 'Both made four in a row' : `${who} made four in a row`;
  if (f.scr) return 'Same square: blocked for good';
  return f.clash && f.clash.line ? `${who} made four in a row` : `${who} claimed a square`;
}
export function sounds(f, add, won, mini, last) {
  if (f.scr && f.scr.lines) { add('sparkle', 0); return; }
  if (f.scr) { add('stamp', 0); add('stamp', 120); add('knock', Math.round(CLASH.clash * 0.55)); return; }   // both marks slam in, then the cell is shut
  if (f.clash) { add('mark', 0); if (f.clash.line) add('sparkle', CLASH.place); }
}
