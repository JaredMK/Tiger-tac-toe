// Shelves: the screen, the miniature, the move's words and sounds, and the inputs.
import { PLACE_MS } from '../shared/placement.js';
import { shelfCfg, shelfOn } from './rules.js';
import { N, esc, isYou, mv, state, waitLine } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { markSvgG } from '../../ui/thumbs.js';
import { cfAnchor, cfFrom } from '../../ui/cardfly.js';

// Shelves: a bookcase of shelves, three spots each. A tap on an open spot is the move: the mover's block comes from
// their name's chip onto the shelf (ui/cardfly.js), then a grey block drops onto a random open spot. At each shelf's
// end, who is on it; by each name, how many shelves they are on (it counts on as the block lands).
const mk = p => `<svg class="shmk ${p}" viewBox="-10 -10 20 20" aria-hidden="true">${markSvgG(p, p === 'O' ? 7.2 : 6)}</svg>`;
const block = (w, attr = '') => `<span class="shb ${w}"${attr}>${w === 'G' ? '' : mk(w)}</span>`;
function shelfTable(mini, a, o) {
  const sh = a && a.shelf ? a.shelf : null, turn = o.turn === 'O' ? 'O' : 'X', c = mini.cells, per = shelfCfg(mini).per, nS = c.length / per;   // (a square from before: 6 shelves)
  const on = p => shelfOn(c, p, per), T = PLACE_MS, end = T.mark + (sh && sh.grey != null ? T.drop : 0) + T.hold;
  const tie = a && a.note === 'tie';
  const newOn = p => !!sh && a.by === p && c.filter((w, i) => w === p && Math.floor(i / per) === Math.floor(sh.at / per)).length === 1;   // this move put them on a shelf they were not on
  const tal = p => arcTally(p, o, `<span class="shsc${newOn(p) ? ' bump' : ''}"${cfAnchor('shtal:' + p)} aria-label="on ${on(p)} of ${nS} shelves">${newOn(p) ? `<b class="cnt" data-from="${on(p) - 1}" data-delay="${T.mark - 60}" data-ms="120">${on(p)}</b>` : `<b>${on(p)}</b>`}<small>/${nS}</small></span>`);
  const last = !sh && !o.view && mini.last ? mini.last : null;      // the block placed last and the grey one that followed, ringed (a finished square shows the case alone)
  const winner = sh && o.fresh && on('X') !== on('O') ? (on('X') > on('O') ? 'X' : 'O') : null;   // the case just filled: the winner's shelves light up, top to bottom
  const rows = Array.from({ length: nS }, (_, s) => {
    const ids = Array.from({ length: per }, (_, k) => s * per + k), has = p => ids.some(i => c[i] === p);
    const spots = ids.map(i => {
      const w = c[i], can = !w && !o.locked;
      let cls = 'shs' + (w ? ' ' + w : ''), st = '', inner = '';
      if (sh && i === sh.at) { cls += ' pop'; inner = block(w, cfFrom('shtal:' + w, 0)); }
      else if (sh && i === sh.grey) { cls += ' drop'; st = ` style="--t:${T.mark}ms"`; inner = block(w); }
      else if (w) inner = block(w);
      else if (can) inner = `<i class="shgh ${turn}">${mk(turn)}</i>`;   // (what a tap here would shelve: the mover's block, shown under the finger)
      if (last && (i === last.at || i === last.grey)) cls += ' last';
      return `<button class="${cls}"${st} data-act="move" ${mv(i)} aria-label="Shelf ${s + 1}, spot ${i % per + 1}${w === 'G' ? ', grey' : w ? ', ' + esc(w) : ''}"${w || o.locked ? ' disabled' : ''}>${inner}</button>`;
    }).join('');
    const fresh = p => newOn(p) && ids.includes(sh.at);
    const tag = ['X', 'O'].map(p => `<i class="${has(p) ? 'on ' + p : ''}${fresh(p) ? ' fillin' : ''}${winner === p && has(p) ? ' won' : ''}"${fresh(p) || (winner === p && has(p)) ? ` style="--t:${T.mark - 60}ms;--w:${end + s * 55}ms"` : ''}>${mk(p)}</i>`).join('');
    return `<div class="shrow"><div class="shspots"${per === 3 ? '' : ` style="grid-template-columns:repeat(${per},1fr)"`}>${spots}</div><div class="shon" aria-label="On shelf ${s + 1}: ${['X', 'O'].filter(has).join(' and ') || 'nobody'}">${tag}</div></div>`;
  }).join('');
  const res = sh ? `<p ${lateAt('arcres ok', T.mark)} role="status">${tie ? `${on('X')} each` : `<b class="${a.by}">${N(a.by)}</b> ${isYou(a.by) ? 'are' : 'is'} on ${on(a.by)} shel${on(a.by) === 1 ? 'f' : 'ves'}`}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? waitLine(turn) : ''}</p>`;
  return `<div class="g-arc g-shf t${turn}"><div class="ctals">${tal('X')}${tal('O')}</div><div class="shelves" style="--n:${nS}"><div class="shcase">${rows}</div>${res}</div></div>`;
}
// The miniature: the bookcase in small, each block in its colour, and at each shelf's end who is on it (a dot each).
export function miniature(mini, final) {
  const per = shelfCfg(mini).per, nS = mini.cells.length / per, row = r => mini.cells.slice(r * per, r * per + per);
  return `<div class="tshelf" aria-label="Shelves: X on ${shelfOn(mini.cells, 'X', per)}, O on ${shelfOn(mini.cells, 'O', per)} of ${nS}">${Array.from({ length: nS }, (_, r) => `<span style="grid-template-columns:repeat(${per},1fr) auto auto">${row(r).map(w => `<i class="${w || ''}"></i>`).join('')}${['X', 'O'].map(p => `<u class="${row(r).includes(p) ? p : ''}"></u>`).join('')}</span>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = shelfTable(mini, a, { view, locked, turn, fresh: !!fresh, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return `${who} marked a shelf`;
}
// The block sliding over from the name and its wooden thunk on the shelf (a rising note when it is their first on
// that shelf); then the grey block's duller thud as it drops in.
export function sounds(f, add, won, mini, last) {
  if (!f.shelf) return;
  add('pieceSlide', 0); add('c4drop', PLACE_MS.mark - 80);
  if (mini && mini.cells) { const per = shelfCfg(mini).per, s = Math.floor(f.shelf.at / per); if (mini.cells.filter((w, i) => w === f.by && Math.floor(i / per) === s).length === 1) add('point', PLACE_MS.mark - 20); }
  if (f.shelf.grey != null) add('thud', PLACE_MS.mark + PLACE_MS.drop - 150);
}
