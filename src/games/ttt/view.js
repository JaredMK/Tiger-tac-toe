// Tic-Tac-Toe: the screen, the miniature, the move's words and sounds, and the inputs.
import { esc, mv } from '../../ui/app.js';
import { toonG, toonT } from '../../ui/art.js';

// The move's moments (ms from the move, at the game's pace; the stylesheet's .g-ttt figures are the same ones):
// an X is two strokes, one after the other, an O one sweep of the ring; then the face; a win: the line is drawn
// through the three and each hops as it passes. All of it inside rules.js flashMs (450, a win 950).
export const TTT_T = { stroke2: 130, line: 480, won: 600 };

/* ----- zoomed mini-game ----- */
// The mark as it is being drawn: the character's own strokes one at a time (its outlines under both its fills, so the
// X's crossing looks as the finished character's does), then its face. Drawn through, it is the character exactly.
function drawnMark(p) {
  const g = toonG(p), face = g.slice(g.indexOf('<g class="eyes"'));
  const parts = p === 'X' ? ['M22 20 L78 80', 'M78 20 L22 80'].map((d, k) => c => `<path class="${c} s${k + 1}" pathLength="1" d="${d}"/>`)
    : [c => `<circle class="${c} s1" pathLength="1" cx="50" cy="50" r="32" transform="rotate(-110 50 50)"/>`];
  return `<svg class="pc p${p} tdraw" viewBox="0 0 100 100" aria-hidden="true">${parts.map(s => s('ol')).join('')}${parts.map(s => s('fl')).join('')}<g class="tface">${face}</g></svg><b class="sr">${esc(p)}</b>`;
}
// Tic-tac-toe's winning line, drawn across the grid behind the three marks (drawn as a stroke when the win is fresh).
function tttLine(run, p, animate) {
  const c = k => [(k % 3) * 100 / 3 + 100 / 6, Math.floor(k / 3) * 100 / 3 + 100 / 6];
  const [x1, y1] = c(run[0]), [x2, y2] = c(run[run.length - 1]);
  const len = Math.hypot(x2 - x1, y2 - y1), ex = (x2 - x1) / len * 11, ey = (y2 - y1) / len * 11;   // a little past the end cells
  const at = `x1="${(x1 - ex).toFixed(1)}" y1="${(y1 - ey).toFixed(1)}" x2="${(x2 + ex).toFixed(1)}" y2="${(y2 + ey).toFixed(1)}" pathLength="1"`;
  return `<svg class="tline${animate ? ' draw' : ''}" viewBox="0 0 100 100" aria-hidden="true"><line class="tlo" ${at}/><line class="tlc ${p}" ${at}/></svg>`;
}
export function miniature(mini, final) {
  const last = !final && Number.isInteger(mini.last) ? mini.last : -1;   // the mark played last, lit in its colour
  return `<div class="tg g3">${mini.cells.map((c, i) => `<i class="${c || ''}${c && i === last ? ' last' : ''}">${c ? toonT(c) : ''}</i>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const line = mini.winCells ? tttLine(mini.winCells, sq.owner || 'X', !!fresh) : '';
  const last = !view && !mini.winCells && Number.isInteger(mini.last) ? mini.last : -1;   // the mark played last (a finished square shows its line instead)
  g = `<div class="g-ttt t${turn === 'O' ? 'O' : 'X'}${locked ? '' : ' open'}">${mini.cells.map((c, i) => {
        const lit = won(i) && fresh;
        return `<button class="cell ${c || ''}${won(i) ? ' win' : ''}${lit ? ' lit' : ''}${c && i === last ? ' last' : ''}"${lit ? ` style="--k:${wk(i)}"` : ''} data-act="move" ${mv(i)} aria-label="Cell ${i + 1}${c ? ', ' + esc(c) : ''}"${c || locked ? ' disabled' : ''}>${c ? `<span class="mk">${anim === i ? drawnMark(c) : toonT(c)}</span>` : ''}</button>`;
      }).join('')}${line}</div>`;
  return g;
}
export function sounds(f, add, won, mini, last) {
  add('mark', 0); if (f.by === 'X') add('mark', TTT_T.stroke2);   // the pen: a stroke for the O's ring, two for the X
  if (won) { add('swish', TTT_T.line); add('won', TTT_T.won); }    // the line through the three, then the chime as they hop
  return;
}
