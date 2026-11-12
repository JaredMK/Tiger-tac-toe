// Takeover: the screen, the miniature, the move's words and sounds, and the inputs.
import { other } from '../../core/util.js';
import { TAKEOVER_MS, takeCount, takeSide } from './rules.js';
import { esc, mv, state, waitLine } from '../../ui/app.js';
import { arcTally, lateAt, sbar } from '../../ui/progress.js';

const T = TAKEOVER_MS;   // the move's moments (rules.js: the piece lands at `place`, the cells round it turn a `step` apart, `flip` each; the stylesheet's .tk figures are the same ones)
const grid = n => (n === 5 ? '' : ` style="grid-template-columns:repeat(${n},1fr);grid-template-rows:repeat(${n},1fr)"`);   // (the admin's settings: a bigger board)
// The cells round cell i, clockwise from the top: the order the capture ripples in.
export function takeRing(i, n) { const r = Math.floor(i / n), c = i % n, out = []; if (r > 0) out.push(i - n); if (c < n - 1) out.push(i + 1); if (r < n - 1) out.push(i + n); if (c > 0) out.push(i - 1); return out; }
// The cells a move turned (taken empty, or turned over from the other player), in that order.
export const takeWave = (tk, n) => takeRing(tk.at, n).filter(k => tk.took.includes(k) || tk.flipped.includes(k));
const flipAt = k => T.place + k * T.step;                           // the k-th cell's turn begins (its colour changes half way through)
const endAt = T.place + 3 * T.step + T.flip;                        // the ripple over: a full board's payoff begins
// A cell's mark, drawn (Four in a Row's discs carry the same ones): white strokes for X, an ink ring for O.
const mark = p => `<svg class="tkm ${p}" viewBox="0 0 40 40" aria-hidden="true">${p === 'X' ? '<path d="M13 13 27 27M27 13 13 27"/>' : '<circle cx="20" cy="20" r="7.2"/>'}</svg>`;
function takeTable(mini, a, o) {
  const tk = a && a.take ? a.take : null, turn = o.turn === 'O' ? 'O' : 'X', by = tk ? a.by : null;
  const n = takeSide(mini.cells), wave = tk ? takeWave(tk, n) : [];
  // the counts: before the move while it plays (they turn over as the cells do), and the bar chart under the board: X's cells, the empty ones, O's
  const now = { X: takeCount(mini.cells, 'X'), O: takeCount(mini.cells, 'O') }, total = mini.cells.length, was = tk ? { [by]: now[by] - tk.took.length - tk.flipped.length, [other(by)]: now[other(by)] + tk.flipped.length } : now;
  const lead = was.X === was.O ? null : was.X > was.O ? 'X' : 'O';
  const tal = p => {
    const moved = tk && was[p] !== now[p], mine = p === by, len = Math.max(0, wave.length - 1) * T.step;
    const fig = moved ? `<b class="cnt" data-from="${was[p]}" data-delay="${mine ? T.place : T.place + T.flip / 2}" data-ms="${Math.max(120, len + (mine ? T.flip / 2 : 0))}">${now[p]}</b>` : `<b>${now[p]}</b>`;
    return arcTally(p, o, `<span class="tksc${lead === p ? ' lead' : ''}" aria-label="${now[p]} squares">${fig}</span>`);
  };
  const bar = sbar([{ cls: 'X', n: now.X, n0: was.X, label: 'X' }, { cls: 'E', n: total - now.X - now.O, n0: total - was.X - was.O, label: 'Empty' }, { cls: 'O', n: now.O, n0: was.O, label: 'O' }], total, tk ? T.place + T.flip / 2 : null);   // (total, not N: N is the players' names)
  const full = tk && o.fresh && !mini.cells.includes(null), winner = full ? (now.X > now.O ? 'X' : 'O') : null;   // the board just filled: the winner's cells ripple out from the last piece
  const lastAt = !tk && !o.view && mini.last ? mini.last.at : -1;   // the piece played last, ringed (a finished square shows the board alone)
  const cells = mini.cells.map((c, i) => {
    let cls = 'tkc' + (c ? ' ' + c : ''), st = '', inner = c ? mark(c) : '';
    const k = wave.indexOf(i);
    if (tk && i === tk.at) { cls += ' land'; inner = `<span class="tkpc ${c}">${mark(c)}</span><i class="tkwave"></i>`; }   // the piece comes down onto its cell; a ring runs out from it as it lands
    else if (k >= 0) {                                              // a cell turning over: its old face, then the mover's
      const from = tk.flipped.includes(i) ? other(by) : null;
      cls += ' flip ' + (from ? 'from' + from : 'fromE'); st += `--t:${flipAt(k)}ms;`;
      inner = `${from ? `<span class="tko">${mark(from)}</span>` : ''}<span class="tkn">${mark(c)}</span>`;
    }
    if (i === lastAt) cls += ' last';
    if (winner) { const d = Math.abs(Math.floor(i / n) - Math.floor(tk.at / n)) + Math.abs(i % n - tk.at % n); cls += c === winner ? ' won' : ' lost'; st += `--w:${endAt + d * 55}ms;`; }
    if (!c && !o.locked) {                                          // what a tap here would take: the mover's mark, and a ring on each cell round it that would turn
      const dx = j => j % n - i % n, dy = j => Math.floor(j / n) - Math.floor(i / n);
      inner = `<i class="tkg">${mark(turn)}</i>${takeRing(i, n).filter(j => mini.cells[j] !== turn).map(j => `<i class="tkp${mini.cells[j] ? ' own' : ''}" style="--dx:${dx(j)};--dy:${dy(j)}"></i>`).join('')}`;
    }
    return `<button class="${cls}"${st ? ` style="${st}"` : ''} data-act="move" ${mv(i)} aria-label="Square ${i + 1}${c ? ', ' + esc(c) : ''}"${c || o.locked ? ' disabled' : ''}>${inner}</button>`;
  }).join('');
  const res = tk ? `<p ${lateAt('arcres ok', T.place + T.flip / 2)} role="status">+${tk.took.length + tk.flipped.length}${tk.flipped.length ? ` · ${tk.flipped.length} turned over` : ''}</p>`
    : `<p class="arcnote">${o.view || !o.locked ? '' : waitLine(turn)}</p>`;
  return `<div class="g-arc g-tk t${turn}${o.locked ? '' : ' open'}"><div class="ctals">${tal('X')}${tal('O')}</div><div class="takeover"><div class="tkgrid"${grid(n)}>${cells}</div>${bar}${res}</div></div>`;
}
// The board in small with each player's cells in their colour, and under it the bar of who holds how much.
export function miniature(mini, final) {
  const total = mini.cells.length, pct = p => (100 * takeCount(mini.cells, p) / total).toFixed(1);
  return `<div class="ttk"><div class="tg gtk"${grid(takeSide(mini.cells))}>${mini.cells.map(c => `<i class="${c || ''}"></i>`).join('')}</div><div class="ttkbar" aria-hidden="true"><i class="X" style="width:${pct('X')}%"></i><i class="O" style="width:${pct('O')}%"></i></div></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = takeTable(mini, a, { view, locked, turn, fresh: !!fresh, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return f.take ? `${who} took ${f.take.took.length + f.take.flipped.length}${f.take.flipped.length ? `, ${f.take.flipped.length} of them turned over` : ''}` : `${who} took a square`;
}
export function sounds(f, add, won, mini, last) {
  if (!f.take) return;
  add('hexPlace', T.place);                                         // the piece's click as it lands
  takeWave(f.take, mini && mini.cells ? takeSide(mini.cells) : 5).forEach((k, j) => add('tkFlip', flipAt(j) + T.flip / 2, Math.pow(2, j / 6)));   // a tick a cell as it turns, each a tone higher
  return;
}
