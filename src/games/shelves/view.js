// Shelves: the screen, the miniature, the move's words and sounds, and the inputs.
import { PLACE_MS } from '../shared/placement.js';
import { shelfCfg, shelfOn } from './rules.js';
import { N, esc, mv, state } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';

// Shelves: six shelves of three spots. A tap on an open spot is the move: the mark pops in, then a grey
// mark drops onto a random open spot. At each shelf's end, who is on it.
function shelfTable(mini, a, o) {
  const sh = a && a.shelf ? a.shelf : null, turn = o.turn, c = mini.cells, per = shelfCfg(mini).per, nS = c.length / per;   // (a square from before: 6 shelves)
  const on = p => shelfOn(c, p, per), tal = p => arcTally(p, o, `<small>on ${on(p)} of ${nS}</small>`);
  const tie = a && a.note === 'tie';
  const rows = Array.from({ length: nS }, (_, s) => {
    const ids = Array.from({ length: per }, (_, k) => s * per + k), on = p => ids.some(i => c[i] === p);
    const spots = ids.map(i => {
      const w = c[i];
      let cls = 'shs' + (w ? ' ' + w : ''), st = '';
      if (sh && i === sh.at) cls += ' pop';
      else if (sh && i === sh.grey) { cls += ' drop'; st = ` style="--t:${PLACE_MS.mark}ms"`; }
      return `<button class="${cls}"${st} data-act="move" ${mv(i)} aria-label="Shelf ${s + 1}, spot ${i % per + 1}${w === 'G' ? ', grey' : w ? ', ' + esc(w) : ''}"${w || o.locked ? ' disabled' : ''}>${w === 'G' ? '' : w ? `<b>${esc(w)}</b>` : ''}</button>`;
    }).join('');
    const fresh = p => sh && a.by === p && ids.includes(sh.at) && ids.filter(i => c[i] === p).length === 1;
    const tag = ['X', 'O'].map(p => `<i class="${on(p) ? 'on ' + p : ''}${fresh(p) ? ' fillin' : ''}">${p}</i>`).join('');
    return `<div class="shrow"><div class="shspots"${per === 3 ? '' : ` style="grid-template-columns:repeat(${per},1fr)"`}>${spots}</div><div class="shon" aria-label="On shelf ${s + 1}: ${['X', 'O'].filter(on).join(' and ') || 'nobody'}">${tag}</div></div>`;
  }).join('');
  const res = sh ? `<p ${lateAt('arcres ok', PLACE_MS.mark)} role="status">${tie ? `${on('X')} each · a draw` : `${N(a.by)} is on ${on(a.by)} shel${on(a.by) === 1 ? 'f' : 'ves'}`}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? `Waiting for <b class="${turn}">${N(turn)}</b>…` : ''}</p>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="shelves"><div class="shcase">${rows}</div>${res}</div></div>`;
}
export function miniature(mini, final) {
  const per = shelfCfg(mini).per;
  return `<div class="tshelf">${Array.from({ length: mini.cells.length / per }, (_, r) => `<span${per === 3 ? '' : ` style="grid-template-columns:repeat(${per},1fr)"`}>${mini.cells.slice(r * per, r * per + per).map(w => `<i class="${w || ''}"></i>`).join('')}</span>`).join('')}</div>`;
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
