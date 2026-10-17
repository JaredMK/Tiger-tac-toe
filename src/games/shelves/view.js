// Shelves: the screen, the miniature, the move's words and sounds, and the inputs.
import { other } from '../../core/util.js';
import { PLACE_MS } from '../shared/placement.js';
import { SHELF, shelfOn } from './rules.js';
import { N, mv, state } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';

// Shelves: six shelves of three spots. A tap on an open spot is the move: the mark pops in, then a grey
// mark drops onto a random open spot. At each shelf's end, who is on it.
function shelfTable(mini, a, o) {
  const sh = a && a.shelf ? a.shelf : null, turn = o.turn, c = mini.cells, nS = c.length / SHELF.per;   // (a square from before: 6 shelves)
  const tal = p => arcTally(p, o, `<small>on ${shelfOn(c, p)} of ${nS}</small>`);
  const second = other(mini.first || turn), tie = a && a.note === 'tiebreak';
  const rows = Array.from({ length: nS }, (_, s) => {
    const ids = Array.from({ length: SHELF.per }, (_, k) => s * SHELF.per + k), on = p => ids.some(i => c[i] === p);
    const spots = ids.map(i => {
      const w = c[i];
      let cls = 'shs' + (w ? ' ' + w : ''), st = '';
      if (sh && i === sh.at) cls += ' pop';
      else if (sh && i === sh.grey) { cls += ' drop'; st = ` style="--t:${PLACE_MS.mark}ms"`; }
      return `<button class="${cls}"${st} data-act="move" ${mv(i)} aria-label="Shelf ${s + 1}, spot ${i % SHELF.per + 1}${w === 'G' ? ', grey' : w ? ', ' + w : ''}"${w || o.locked ? ' disabled' : ''}>${w === 'G' ? '' : w ? `<b>${w}</b>` : ''}</button>`;
    }).join('');
    const fresh = p => sh && a.by === p && ids.includes(sh.at) && ids.filter(i => c[i] === p).length === 1;
    const tag = ['X', 'O'].map(p => `<i class="${on(p) ? 'on ' + p : ''}${fresh(p) ? ' fillin' : ''}">${p}</i>`).join('');
    return `<div class="shrow"><div class="shspots">${spots}</div><div class="shon" aria-label="On shelf ${s + 1}: ${['X', 'O'].filter(on).join(' and ') || 'nobody'}">${tag}</div></div>`;
  }).join('');
  const res = sh ? `<p ${lateAt('arcres ok', PLACE_MS.mark)} role="status">${tie ? `${shelfOn(c, 'X')} each · the tie goes to ${N(a.winner)}` : `${N(a.by)} is on ${shelfOn(c, a.by)} shel${shelfOn(c, a.by) === 1 ? 'f' : 'ves'}`}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? `Waiting for <b class="${turn}">${N(turn)}</b>…` : ''}</p>`;
  const ties = mini.first !== undefined ? `<p class="dties">Ties go to <b class="${second}">${N(second)}</b></p>` : '';   // (a square from before the tie rule: its ties reset)
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="shelves">${ties}<div class="shcase">${rows}</div>${res}</div></div>`;
}
export function miniature(mini, final) {
  return `<div class="tshelf">${Array.from({ length: mini.cells.length / SHELF.per }, (_, r) => `<span>${mini.cells.slice(r * SHELF.per, r * SHELF.per + SHELF.per).map(w => `<i class="${w || ''}"></i>`).join('')}</span>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = shelfTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return `${who} marked a shelf`;
}
export function sounds(f, add, won, mini, last) {
  if (f.shelf) { add('mark', 0); if (f.shelf.grey != null) add('thud', PLACE_MS.mark + PLACE_MS.drop - 150); } return;
}
