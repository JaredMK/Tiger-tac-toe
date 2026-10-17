// Tic-Tac-Toe: the screen, the miniature, the move's words and sounds, and the inputs.
import { mv } from '../../ui/app.js';
import { toonT } from '../../ui/art.js';

/* ----- zoomed mini-game ----- */
// Tic-tac-toe's winning line, drawn across the grid (animated when the win is fresh).
function tttLine(run, p, animate) {
  const c = k => [(k % 3) * 100 / 3 + 100 / 6, Math.floor(k / 3) * 100 / 3 + 100 / 6];
  const [x1, y1] = c(run[0]), [x2, y2] = c(run[run.length - 1]);
  const len = Math.hypot(x2 - x1, y2 - y1), ex = (x2 - x1) / len * 9, ey = (y2 - y1) / len * 9;   // a little past the end cells
  return `<svg class="winline${animate ? ' draw' : ''}" viewBox="0 0 100 100" aria-hidden="true"><line x1="${x1 - ex}" y1="${y1 - ey}" x2="${x2 + ex}" y2="${y2 + ey}" class="${p}"/></svg>`;
}
export function miniature(mini, final) {
  return `<div class="tg g3">${mini.cells.map(c => `<i class="${c || ''}">${c ? toonT(c) : ''}</i>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const line = mini.winCells ? tttLine(mini.winCells, sq.owner || 'X', !!fresh) : '';
  g = `<div class="g-ttt">${mini.cells.map((c, i) =>
        `<button class="cell ${c || ''}${won(i) ? ' win' : ''}${won(i) && fresh ? ' lit' : ''}${anim === i ? ' pop' : ''}" data-act="move" ${mv(i)} aria-label="Cell ${i + 1}${c ? ', ' + c : ''}"${c || locked ? ' disabled' : ''}>${c ? `<span class="mk">${toonT(c)}</span>` : ''}</button>`
      ).join('')}${line}</div>`;
  return g;
}
export function sounds(f, add, won, mini, last) {
  add('mark', 0); if (won) add('swish', 380); return;
}
