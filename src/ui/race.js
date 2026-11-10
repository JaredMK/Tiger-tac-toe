// Race mode's page parts (core/race.js, `rv: 2`): every race game draws its square as two boards, this phone's own large
// and the other player's smaller one under it, live (their moves and replays land there), named and marked; and its
// miniature as the two players' progress side by side. Shared by the ten race games' views; their own drawing goes in.
import { other } from '../core/util.js';
import { N, state, viewer } from './app.js';
import { markSvgG } from './thumbs.js';

// Whose board is the large one here: this phone's side (online, against the computer), else X's (a watcher, a test).
export const raceMe = () => viewer() || 'X';
export const raceThem = () => other(raceMe());
export const mark = (p, h) => `<svg class="rmk ${p}" viewBox="${-h} ${-h} ${2 * h} ${2 * h}" aria-hidden="true">${markSvgG(p, h * 0.8)}</svg>`;
// The square's two boards. mine/theirs: each board's own markup (sized from its box: both are size containers, so a
// view sizes with cqw/cqh); note: a short status of the other player's progress beside their name (e.g. "3 hits",
// "2 right"), kept in its own reserved line; opts.cls: the game's own class on the wrapper. The other board's box keeps
// the same height whatever it holds, so nothing moves as their moves land.
export function raceBoards(mine, theirs, note, opts) {
  const o = opts || {}, them = raceThem();
  return `<div class="rboards${o.cls ? ' ' + o.cls : ''}"><div class="rmain">${mine}</div>`
    + `<div class="ropp ${them}" aria-label="${them}'s board"><div class="ropph">${mark(them, 6)}<span class="rname">${N(them)}</span><small class="rnote">${note || ''}</small></div>`
    + `<div class="roppb">${theirs}</div></div></div>`;
}
// A race miniature: each player's progress as a small picture of its own, X on the left and O on the right, each
// under its drawn mark (never type). art(p): that player's picture's markup.
export const raceThumb = (art, cls, label) => `<div class="trace2${cls ? ' ' + cls : ''}"${label ? ` aria-label="${label}"` : ''}>${['X', 'O'].map(p => `<div class="trp ${p}">${mark(p, 7)}<div class="trart">${art(p)}</div></div>`).join('')}</div>`;
// A progress bar picture for a race miniature (0..1 filled; `left`: the part still open drawn instead, shrinking).
export const raceBar = (p, frac, cls) => `<i class="trbar ${p}${cls ? ' ' + cls : ''}"><b style="--f:${Math.max(0, Math.min(1, Number(frac) || 0)).toFixed(3)}"></b></i>`;
export { state };
