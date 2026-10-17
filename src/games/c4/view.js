// Connect 4: the screen, the miniature, the move's words and sounds, and the inputs.
import { C4 } from './rules.js';
import { mv } from '../../ui/app.js';
import { toon } from '../../ui/art.js';

export function miniature(mini, final) {
  return `<div class="tg g5">${mini.cells.map(c => `<i class="${c || ''}"></i>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = `<div class="g-c4">${mini.cells.map((c, i) => {
        const col = i % C4.cols, full = !!mini.cells[col];
        const lit = won(i) && fresh;
        const style = lit ? ` style="--k:${wk(i)}"` : '';
        const drop = anim === i && c;                     // the piece just played falls on its own layer; its hole stays drawn under it
        const inner = drop ? `<span class="c4p ${c}" style="--fall:${Math.floor(i / C4.cols) + 1}">${toon(c)}</span>` : c ? toon(c) : '';
        return `<button class="c4c ${drop ? 'landing' : c || ''}${won(i) ? ' win' : ''}${lit ? ' lit' : ''}"${style} data-act="move" ${mv(col)} aria-label="Drop in column ${col + 1}"${full || locked ? ' disabled' : ''}>${inner}</button>`;
      }).join('')}</div>`;
  return g;
}
export function sounds(f, add, won, mini, last) {
  add('whoosh', 0); add('clack', 330); return;
}
