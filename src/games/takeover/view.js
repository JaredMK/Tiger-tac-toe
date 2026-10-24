// Takeover: the screen, the miniature, the move's words and sounds, and the inputs.
import { other } from '../../core/util.js';
import { TAKEOVER_MS, takeCount, takeNear, takeSide } from './rules.js';
import { N, esc, mv, state } from '../../ui/app.js';
import { arcTally, lateAt, sbar } from '../../ui/progress.js';

const grid = n => (n === 5 ? '' : ` style="grid-template-columns:repeat(${n},1fr);grid-template-rows:repeat(${n},1fr)"`);   // (the admin's settings: a bigger board)
function takeTable(mini, a, o) {
  const tk = a && a.take ? a.take : null, turn = o.turn;
  const tal = p => arcTally(p, o, '');
  const n = takeSide(mini.cells), order = tk ? takeNear(tk.at, n).filter(k => k !== tk.at) : [];
  // the bar chart under the board: X's cells, the empty ones, O's, in their colours (before the move, then after it)
  const now = { X: takeCount(mini.cells, 'X'), O: takeCount(mini.cells, 'O') }, total = mini.cells.length, was = tk ? { [a.by]: now[a.by] - tk.took.length - tk.flipped.length, [other(a.by)]: now[other(a.by)] + tk.flipped.length } : now;
  const bar = sbar([{ cls: 'X', n: now.X, n0: was.X, label: 'X' }, { cls: 'E', n: total - now.X - now.O, n0: total - was.X - was.O, label: 'Empty' }, { cls: 'O', n: now.O, n0: was.O, label: 'O' }], total, tk ? TAKEOVER_MS.place : null);   // (total, not N: N is the players' names)
  const cells = mini.cells.map((c, i) => {
    let cls = 'tkc' + (c ? ' ' + c : ''), st = '';
    if (tk && i === tk.at) cls += ' pop';
    else if (tk && (tk.took.includes(i) || tk.flipped.includes(i))) {
      const k = order.indexOf(i), from = tk.flipped.includes(i) ? other(a.by) : null;
      cls += ' turn' + (from ? ' from' + from : ' fromnone');
      st = ` style="--t:${TAKEOVER_MS.place + k * 70}ms"`;
    }
    return `<button class="${cls}"${st} data-act="move" ${mv(i)} aria-label="Square ${i + 1}${c ? ', ' + esc(c) : ''}"${c || o.locked ? ' disabled' : ''}>${c ? `<b>${esc(c)}</b>` : ''}</button>`;
  }).join('');
  const l = mini.last;
  const res = tk ? `<p ${lateAt('arcres ok', TAKEOVER_MS.place)} role="status">+${tk.took.length + tk.flipped.length}${tk.flipped.length ? ` · ${tk.flipped.length} turned over` : ''}</p>`
    : o.view ? `<p class="arcnote">${l ? `${takeCount(mini.cells, 'X')} to ${takeCount(mini.cells, 'O')}` : ''}</p>`
    : `<p class="arcnote">${o.locked ? `Waiting for <b class="${turn}">${N(turn)}</b>…` : ''}</p>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="takeover"><div class="tkgrid"${grid(n)}>${cells}</div>${bar}${res}</div></div>`;
}
export function miniature(mini, final) {
  return `<div class="tg gtk"${grid(takeSide(mini.cells))}>${mini.cells.map(c => `<i class="${c || ''}"></i>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = takeTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return f.take ? `${who} took ${f.take.took.length + f.take.flipped.length}${f.take.flipped.length ? `, ${f.take.flipped.length} of them turned over` : ''}` : `${who} took a square`;
}
export function sounds(f, add, won, mini, last) {
  if (f.take) { add('mark', 0); [...f.take.took, ...f.take.flipped].filter(k => k !== f.take.at).slice(0, 4).forEach((k, n) => add(f.take.flipped.includes(k) ? 'flipUp' : 'pop', TAKEOVER_MS.place + n * 70)); } return;
}
