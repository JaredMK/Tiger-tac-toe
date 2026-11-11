// Hex: the screen, the miniature, the move's words and sounds, and the inputs.
import { hexSize } from './rules.js';
import { esc, mv } from '../../ui/app.js';

const seq = n => Array.from({ length: n }, (_, k) => k);
export function miniature(mini, final) {
  const n = hexSize(mini.cells);
  return `<div class="thex n${n}">${seq(n).map(r => `<div class="hr" style="--k:${r}">${seq(n).map(c => `<i class="${mini.cells[r * n + c] || ''}"></i>`).join('')}</div>`).join('')}</div>`;
}
// The board (4x4; a square from before 5x5).
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const n = hexSize(mini.cells);
  const rows = seq(n).map(r => `<div class="hrow" style="--r:${r}">${seq(n).map(c => {
        const i = r * n + c, v = mini.cells[i], lit = won(i) && fresh;
        return `<button class="hexc ${v || ''}${won(i) ? ' win' : ''}${lit ? ' lit' : ''}${anim === i ? ' fill' : ''}"${lit ? ` style="--k:${mini.winCells.length - 1 - wk(i)}"` : ''} data-act="move" ${mv(i)} aria-label="Row ${r + 1} cell ${c + 1}${v ? ', ' + esc(v) : ''}"${v || locked ? ' disabled' : ''}></button>`;
      }).join('')}</div>`).join('');
  g = `<div class="g-hex" style="--hn:${n}"><div class="hexgoal O">O</div><div class="hexmid"><div class="hexgoal X">X</div><div class="hexboard">${rows}</div><div class="hexgoal X">X</div></div><div class="hexgoal O">O</div></div>`;
  return g;
}
export function moveText(f, who) {
  return `${who} claimed a hex`;
}
export function sounds(f, add, won, mini, last) {
  add('hexPlace', 0); if (won) { const n = mini.winCells ? mini.winCells.length : 4; for (let k = 0; k < n; k++) add('pathNote', 400 + k * 90, Math.pow(2, k / 12)); } return;
}
