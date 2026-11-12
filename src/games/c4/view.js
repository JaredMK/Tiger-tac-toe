// Four in a Row: the screen, the miniature, the move's words and sounds, and the inputs.
import { C4, c4Drop } from './rules.js';
import { mv } from '../../ui/app.js';

// The move's moments (ms from the move, at the game's pace; the stylesheet's .g-c4w figures are the same ones): the
// piece leaves the rail over its column and falls as a dropped thing does (the further, the longer: fall * sqrt(rows)),
// lands with its thunk, squashes and settles (land); a win: the line is drawn through the four and each hops as it
// passes, from the landing on. All of it inside rules.js flashMs (600, a win 1150).
export const C4_T = { fall: 145, land: 220 };
export const c4FallMs = k => Math.round(C4_T.fall * Math.sqrt(Math.floor(k / C4.cols) + 1.3));   // the fall to cell k, from the rail

// A piece: a disc in its player's colour with their mark on it (the disc itself is the cell's or the falling piece's).
const disc = p => `<svg class="c4d ${p}" viewBox="0 0 40 40" aria-hidden="true"><circle class="c4rim" cx="20" cy="20" r="14.6"/>${p === 'X' ? '<path class="c4m" d="M14.2 14.2 25.8 25.8M25.8 14.2 14.2 25.8"/>' : '<circle class="c4m" cx="20" cy="20" r="6.4"/>'}</svg>`;
// The winning line, drawn through the four (as a stroke when the win is fresh). One unit a cell's pitch.
function c4Line(run, animate) {
  const c = k => [k % C4.cols + 0.5, Math.floor(k / C4.cols) + 0.5];
  const [x1, y1] = c(run[0]), [x2, y2] = c(run[run.length - 1]);
  const len = Math.hypot(x2 - x1, y2 - y1) || 1, ex = (x2 - x1) / len * 0.3, ey = (y2 - y1) / len * 0.3;   // a little past the end pieces
  const at = `x1="${(x1 - ex).toFixed(2)}" y1="${(y1 - ey).toFixed(2)}" x2="${(x2 + ex).toFixed(2)}" y2="${(y2 + ey).toFixed(2)}" pathLength="1"`;
  return `<svg class="c4line${animate ? ' draw' : ''}" viewBox="0 0 ${C4.cols} ${C4.rows}" preserveAspectRatio="none" aria-hidden="true"><line class="c4lo" ${at}/><line class="c4lc" ${at}/></svg>`;
}
export function miniature(mini, final) {
  const last = !final && Number.isInteger(mini.last) ? mini.last : -1;   // the piece played last, ringed
  return `<div class="tg g5">${mini.cells.map((c, i) => `<i class="${c || ''}${c && i === last ? ' last' : ''}"></i>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const cells = mini.cells, t = turn === 'O' ? 'O' : 'X';
  const last = !view && !mini.winCells && Number.isInteger(mini.last) ? mini.last : -1;   // the piece played last (a finished square shows its line instead)
  const board = cells.map((c, i) => {
    const lit = won(i) && fresh;
    const drop = anim === i && c;                         // the piece just played falls on its own layer; its hole stays drawn under it
    const inner = drop ? `<span class="c4p" style="--fall:${Math.floor(i / C4.cols) + 1}"><span class="c4b ${c}">${disc(c)}</span></span>` : c ? disc(c) : '';
    return `<i class="c4c ${drop ? 'landing' : c || ''}${won(i) ? ' win' : ''}${lit ? ' lit' : ''}${c && i === last ? ' last' : ''}"${lit ? ` style="--k:${wk(i)}"` : ''}>${inner}</i>`;
  }).join('');
  // a column is one button over its rail slot and its six holes: the piece waiting on the rail, the hole it would land in
  const cols = Array.from({ length: C4.cols }, (_, col) => {
    const k = c4Drop(cells, col), full = k < 0;
    return `<button class="c4col${full ? ' full' : ''}" data-act="move" ${mv(col)} aria-label="Drop in column ${col + 1}${full ? ', full' : ''}"${full ? '' : ` style="--land:${Math.floor(k / C4.cols)}"`}${full || locked ? ' disabled' : ''}><span class="c4gh"></span><span class="c4tg"></span></button>`;
  }).join('');
  g = `<div class="g-c4w t${t}${locked ? '' : ' open'}"${Number.isInteger(anim) ? ` style="--ft:${c4FallMs(anim)}ms"` : ''}><div class="c4rail"></div><div class="g-c4">${board}${mini.winCells ? c4Line(mini.winCells, !!fresh) : ''}</div><div class="c4cols">${cols}</div></div>`;
  return g;
}
export function sounds(f, add, won, mini, last) {
  const m = f.drawn && f.drawn.type === 'c4' ? f.drawn : mini;    // (a draw: the full board that drew; the square has a new game by now)
  add('c4drop', m && m.type === 'c4' && Number.isInteger(m.last) ? c4FallMs(m.last) : c4FallMs((C4.rows - 1) * C4.cols)); return;   // (a soft wooden thunk as it lands: nothing harsh on the way down)
}
