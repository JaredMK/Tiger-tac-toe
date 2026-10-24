// Hex: the screen, the miniature, the move's words and sounds, and the inputs.
import { HEX_N } from './rules.js';
import { esc, mv } from '../../ui/app.js';

export function miniature(mini, final) {
  return `<div class="thex">${[0, 1, 2, 3].map(r => `<div class="hr" style="--k:${r}">${[0, 1, 2, 3].map(c => `<i class="${mini.cells[r * HEX_N + c] || ''}"></i>`).join('')}</div>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const rows = [0, 1, 2, 3].map(r => `<div class="hrow" style="--r:${r}">${[0, 1, 2, 3].map(c => {
        const i = r * HEX_N + c, v = mini.cells[i], lit = won(i) && fresh;
        return `<button class="hexc ${v || ''}${won(i) ? ' win' : ''}${lit ? ' lit' : ''}${anim === i ? ' fill' : ''}"${lit ? ` style="--k:${mini.winCells.length - 1 - wk(i)}"` : ''} data-act="move" ${mv(i)} aria-label="Row ${r + 1} cell ${c + 1}${v ? ', ' + esc(v) : ''}"${v || locked ? ' disabled' : ''}></button>`;
      }).join('')}</div>`).join('');
  g = `<div class="g-hex"><div class="hexgoal O">O</div><div class="hexmid"><div class="hexgoal X">X</div><div class="hexboard">${rows}</div><div class="hexgoal X">X</div></div><div class="hexgoal O">O</div></div>`;
  return g;
}
export function sounds(f, add, won, mini, last) {
  add('hexPlace', 0); if (won) { const n = mini.winCells ? mini.winCells.length : 4; for (let k = 0; k < n; k++) add('pathNote', 400 + k * 90, Math.pow(2, k / 12)); } return;
}
