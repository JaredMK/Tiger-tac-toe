// Block Drop: the screen, the miniature, the move's words and sounds, and this phone's piece in hand.
// The mover's board is a grid of chunky blocks (original pieces of two, three and four cells in their own colours,
// never a player's). The piece in hand hovers over the board in the two rows above it: a tap on a column lines it up
// there (its shadow shows where it will rest), Turn turns it, Drop drops it: only Drop is the move (`{ r, c }`), so
// lining up costs nothing and is never sent. A move plays from the move itself, for everyone: the piece falls into
// place (BLOCKS.fall), a full row flashes and goes (BLOCKS.clear), a board that filled shakes and empties.
import { BLOCKS, blockCells, blockKind, blockRest, blockWide, blocksCfg } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { N, state } from '../../ui/app.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // lining a piece up is never sent: the move plays from the flash
let draft = null;                                                  // the piece in hand on this phone: { sq, p, k, r, c }
const fit = (mini, kind, r, c) => Math.max(0, Math.min(mini.cols - blockWide(blockCells(kind, r)), c));
function hand(mini, p) {
  const k = mini.k[p], kind = blockKind(mini, p, k);
  if (!draft || draft.sq !== state.zoom || draft.p !== p || draft.k !== k) draft = { sq: state.zoom, p, k, r: 0, c: fit(mini, kind, 0, Math.floor((mini.cols - blockWide(blockCells(kind, 0))) / 2)) };
  return { kind, cells: blockCells(kind, draft.r) };
}
const cur = () => { const sq = state.squares && state.squares[state.zoom], mini = sq && sq.mini; return mini && mini.type === 'blocks' && draft && draft.sq === state.zoom && !state.flash && !state.done ? mini : null; };
export const actions = {
  'bd-col': b => { const mini = cur(); if (!mini) return; const kind = blockKind(mini, draft.p, draft.k), w = blockWide(blockCells(kind, draft.r)); draft.c = fit(mini, kind, draft.r, Number(b.dataset.c) - Math.floor((w - 1) / 2)); ownPress(); SND.play('rtTick'); haptic('tap'); render(); },
  'bd-turn': () => { const mini = cur(); if (!mini) return; const kind = blockKind(mini, draft.p, draft.k); draft.r = (draft.r + 1) % 4; draft.c = fit(mini, kind, draft.r, draft.c); ownPress(); SND.play('bdTurn'); haptic('tap'); render(); },
  'bd-drop': () => { const mini = cur(); if (!mini) return; ownPress(); attemptMove({ r: draft.r, c: draft.c }); },
};
const cell = (x, y, k, cls, st) => `<i class="bdc k${k}${cls ? ' ' + cls : ''}" style="--x:${x};--y:${y}${st || ''}"></i>`;
const pieceSvg = (kind, r) => { const cells = blockCells(kind, r == null ? 0 : r), w = blockWide(cells), h = cells.reduce((m, q) => Math.max(m, q[1]), 0) + 1; return `<svg class="bdnext k${kind + 1}" viewBox="0 0 ${w * 10} ${h * 10}" style="--w:${w};--h:${h}" aria-hidden="true">${cells.map(([x, y]) => `<rect x="${x * 10 + 0.8}" y="${(h - 1 - y) * 10 + 0.8}" width="8.4" height="8.4" rx="2"/>`).join('')}</svg>`; };
function words(l, c) {
  if (l.over) return 'Board full! −1 row';
  if (l.ans) return l.to >= c.lines ? `${l.ans.k} pieces to ${l.ans.fk}` : '';
  if (l.cleared.length) return `${l.cleared.length} row${l.cleared.length === 1 ? '' : 's'}!${l.junk ? ' Junk sent!' : ''}`;
  return '';
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const c = blocksCfg(mini), s = a && a.bd ? a.bd : null, o = { view, locked, turn }, rest = !s && (view || d) && mini.last ? mini.last : null, l = s || rest;
  const by = s ? a.by : rest ? rest.by : turn, mine = !view && !locked && !s && !d, rows = mini.rows, cols = mini.cols, after = BLOCKS.fall;
  const tal = p => arcTally(p, o, pips(p, s && a.by === p && s.to < s.from ? s.to : mini.lines[p], c.lines, !!(s && a.by === p && s.to > s.from), after));
  let cells = '', cols2 = '', hov = '';
  if (s) {                                                        // the move playing: the board as it was, the piece falling in, full rows going
    s.was.forEach((row, y) => row.forEach((k, x) => { if (k) cells += cell(x, y, k, s.cleared.includes(y) ? 'clr' : s.over ? 'bust' : '', `;--t:${after}ms`); }));
    s.at.forEach(([x, y]) => { cells += cell(x, y, s.kind + 1, 'drop' + (s.cleared.includes(y) ? ' clr' : s.over ? ' bust' : ''), `;--from:${rows + 1 - y};--t:${after}ms`); });
  } else {
    mini.grid[by].forEach((row, y) => row.forEach((k, x) => { if (k) cells += cell(x, y, k); }));
    if (mine) {
      const h = hand(mini, turn), at = blockRest(mini.grid[turn], h.cells, draft.c) || [], top = h.cells.reduce((m, q) => Math.max(m, q[1]), 0);
      at.forEach(([x, y]) => { if (y < rows) cells += cell(x, y, h.kind + 1, 'ghost'); });
      h.cells.forEach(([dx, dy]) => { hov += cell(draft.c + dx, rows + 1 - (top - dy) + (top > 1 ? top - 1 : 0), h.kind + 1, 'hov'); });
      cols2 = Array.from({ length: cols }, (_, x) => `<button class="bdcol" data-act="bd-col" data-c="${x}" style="--x:${x}" aria-label="Column ${x + 1}"></button>`).join('');
    }
  }
  const fin = mini.final, note = !l && fin ? `${c.lines} rows in ${fin.k} pieces` : '';
  const txt = l ? words(l, c) : note, ok = l ? !l.over : true;
  const line = s ? `<p ${lateAt('bdline ' + (ok ? 'ok' : 'no'), after)} role="status">${txt}</p>` : `<p class="bdline ${ok ? 'ok' : 'no'}">${txt}</p>`;
  const left = mine ? (mini.run && mini.run.by === turn ? mini.run.left : c.pieces) : 0, nextK = mine ? blockKind(mini, turn, mini.k[turn] + 1) : null;
  const ctl = view ? '' : `<div class="bdctl"><span class="bdnx" aria-label="Next piece">${nextK != null && left > 1 ? pieceSvg(nextK) : ''}<small>${mine ? `${left} left` : ''}</small></span><button class="btn bdturn" data-act="bd-turn"${mine ? '' : ' disabled'} aria-label="Turn the piece"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12a7 7 0 1 1-2.500-5.360"/><path d="M19.500 3.500v4.200h-4.200"/></svg></button><button class="big ${turn} bddrop" data-act="bd-drop"${mine ? '' : ' disabled'}>${fin && fin.by === turn && mine ? 'Take it' : 'Drop'}</button></div>`;
  return `<div class="g-bd pc-${by}"><div class="ctals">${tal('X')}${tal('O')}</div><div class="bdbox"><div class="bdgrid${s && s.over ? ' over' : ''}" style="--c:${cols};--r:${rows}" role="img" aria-label="${N(by)}'s board: ${mini.lines[by]} of ${c.lines} rows cleared"><div class="bdsky"></div><div class="bdwell"></div>${cells}${hov}${cols2}</div></div>${line}${ctl}</div>`;
}
export function heldSub(mini, turn, f, a) { return f || !mini.run ? '' : `<b class="${turn}">${N(turn)}</b>: ${mini.run.left} piece${mini.run.left === 1 ? '' : 's'} left`; }
// The miniature: both boards side by side (X's, then O's) as little grids of blocks, over each player's rows as pips.
export function miniature(mini, final) {
  const c = blocksCfg(mini), u = 4, W = mini.cols * u, H = mini.rows * u;
  const board = (p, x0) => `<g transform="translate(${x0} 2)"><rect class="tbdb ${p}" x="-1" y="-1" width="${W + 2}" height="${H + 2}" rx="2"/>${mini.grid[p].map((row, y) => row.map((k, x) => (k ? `<rect class="tbdc k${k}" x="${x * u}" y="${(mini.rows - 1 - y) * u}" width="${u}" height="${u}"/>` : '')).join('')).join('')}</g>`;
  const art = `<svg class="tbd" viewBox="0 0 ${W * 2 + 10} ${H + 4}">${board('X', 2)}${board('O', W + 8)}</svg>`;
  return thumbArt(art, pipRows(mini.lines, c.lines), 'tbdw', `Block Drop: X ${mini.lines.X}, O ${mini.lines.O} of ${c.lines} rows`);
}
export function moveText(f, who) { const s = f.bd; return !s ? `${who} dropped a piece` : s.over ? `${who} filled the board` : s.cleared.length ? `${who} cleared ${s.cleared.length} row${s.cleared.length === 1 ? '' : 's'}` : `${who} dropped a piece`; }
// The piece's landing, then a rising sweep for each row cleared (a chime with it), or the crash of a board that filled.
export function sounds(f, add, won, mini, last) {
  const s = f.bd; if (!s) return;
  add('bdDrop', BLOCKS.fall - 40);
  if (s.over) add('crash', BLOCKS.fall + 40);
  else if (s.cleared.length) { s.cleared.forEach((_, k) => add('bdClear', BLOCKS.fall + 60 + k * 90, 1 + k * 0.15)); add('ding', BLOCKS.fall + BLOCKS.clear); }
}
