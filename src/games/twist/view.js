// Twist Five: the screen, the miniature, the move's words and sounds, and the placing of a piece.
// The board is four quarters, each a little tray of holes. A move is two taps: an empty hole (the piece goes in: this
// phone's draft; a tap on it takes it back), then one of the two round arrows that show by each quarter's outer corner, in the rim round the
// board (that quarter, that way: the move goes in). A placement that makes the line goes in at once, with no twist. The move plays as the
// piece popping in (TWIST.place) and the quarter turning a quarter turn with its pieces (TWIST.turn); a line lights up.
import { TWIST, twistTry } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { mv, state } from '../../ui/app.js';
import { arcTally } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { tok } from '../../ui/tok.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is its cell and its twist: shown from the flash
let draft = null;                                                  // this phone's piece placed, the twist still to pick: { sq, p, n, c }
const draftOf = (sq, p, mini) => (draft && draft.sq === sq && draft.p === p && draft.n === mini.moves && !mini.cells[draft.c] ? draft.c : -1);
function placeAct(el) {
  const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini;
  if (!m || m.type !== 'twist' || state.flash || state.done || blocked()) return;
  const p = state.turn, c = Number(el.dataset.c);
  if (!(c >= 0 && c < m.cells.length) || m.cells[c]) return;
  if (draftOf(state.zoom, p, m) === c) { draft = null; SND.play('twPlace', { rate: 0.8 }); render(); return; }   // taken back
  const alone = twistTry(m.cells, m.n, m.L, p, { c });
  if (alone && alone.end === 'win') { draft = null; attemptMove({ c }); return; }   // the line is made: no twist
  draft = { sq: state.zoom, p, n: m.moves, c }; SND.play('twPlace'); haptic('tap'); render();
}
export const actions = { 'tw-place': el => { ownPress(); placeAct(el); } };
const ARC = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d === -1 ? 'M6 14a6.500 6.500 0 1 1 3 5' : 'M18 14a6.500 6.500 0 1 0-3 5'}" fill="none" stroke="currentColor" stroke-width="3.200" stroke-linecap="round"/><path d="${d === -1 ? 'M2.500 11.500 6 15l3.800-3' : 'M21.500 11.500 18 15l-3.800-3'}" fill="none" stroke="currentColor" stroke-width="3.200" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const n = mini.n, h = n / 2, s = a && a.tw ? a.tw : null, o = { view, locked, turn }, live = !view && !locked;
  const dc = live ? draftOf(state.zoom, turn, mini) : -1, win = new Set(mini.winCells || []);
  const tal = p => arcTally(p, o, tok(p));
  const quarter = q => {
    const r0 = q >= 2 ? h : 0, c0 = q % 2 ? h : 0; let cells = '';
    for (let r = 0; r < h; r++) for (let c = 0; c < h; c++) {
      const i = (r0 + r) * n + c0 + c, v = mini.cells[i], here = dc === i;
      const cls = `twc${win.has(i) ? (s ? ' win late' : ' win') : ''}${s && s.at === i ? ' new' : ''}${here ? ' draft' : ''}`;
      const inner = v ? tok(v) : here ? tok(turn, 'ghost') : '';
      cells += live && !v && (dc < 0 || here) ? `<button class="${cls}" data-act="tw-place" data-c="${i}" aria-label="Row ${r0 + r + 1}, column ${c0 + c + 1}${here ? ': take back' : ''}">${inner}</button>` : `<div class="${cls}">${inner}</div>`;
    }
    const turning = s && s.q === q;
    return `<div class="twq${turning ? ' turn' : ''}"${turning ? ` style="--from:${-s.d * 90}deg"` : ''}><div class="twqi" style="--h:${h}">${cells}</div></div>`;
  };
  // The twist arrows, in the rim round the board (its room always kept): two by each quarter's outer corner, one on the
  // board's top or bottom edge and one on its side, each turning that quarter the way its arc shows.
  const SPOT = [[0, 'top', 0.25, 1], [0, 'left', 0.25, -1], [1, 'top', 0.75, -1], [1, 'right', 0.25, 1], [2, 'bottom', 0.25, -1], [2, 'left', 0.75, 1], [3, 'bottom', 0.75, 1], [3, 'right', 0.75, -1]];
  const arrows = dc >= 0 ? SPOT.map(([q, edge, at, dd]) => `<button class="twa ${edge} ${turn}" style="--at:${at}" data-act="move" ${mv({ c: dc, q, d: dd })} aria-label="Twist the ${['top left', 'top right', 'bottom left', 'bottom right'][q]} quarter ${dd === 1 ? 'clockwise' : 'the other way'}">${ARC(dd)}</button>`).join('') : '';
  const line = `<p class="twline">${dc >= 0 ? 'Now twist a quarter' : ''}</p>`;
  return `<div class="g-tw pc-${s ? a.by : turn}${dc >= 0 ? ' twisting' : ''}" style="--tp:${TWIST.place}ms;--tt:${TWIST.turn}ms"><div class="ctals">${tal('X')}${tal('O')}</div><div class="twbox"><div class="twrim"><div class="twboard">${[0, 1, 2, 3].map(quarter).join('')}</div>${arrows}</div></div>${line}</div>`;
}
// The miniature: the board from above, its quarters marked, every piece on it.
export function miniature(mini, final) {
  const n = mini.n, u = 60 / n; let out = `<rect class="ttwb" x="1" y="1" width="58" height="58" rx="6"/><path class="ttwq" d="M30 3v54M3 30h54"/>`;
  mini.cells.forEach((v, i) => { const x = (i % n + 0.5) * u, y = (Math.floor(i / n) + 0.5) * u; out += v ? `<circle class="ttwp ${v}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(u * 0.34).toFixed(1)}"/>` : `<circle class="ttwh" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(u * 0.15).toFixed(1)}"/>`; });
  return `<div class="ttw" aria-label="Twist Five: ${mini.cells.filter(v => v === 'X').length} X, ${mini.cells.filter(v => v === 'O').length} O on the board"><svg viewBox="0 0 60 60" aria-hidden="true">${out}</svg></div>`;
}
export function moveText(f, who) { return f.note === 'gift' ? `${who} twisted a line for the other side` : `${who} placed and twisted`; }
// The piece clacking into its hole, then the quarter's ratchet as it turns.
export function sounds(f, add, won, mini, last) {
  const l = f.tw; if (!l) return;
  add('twPlace', 0); if (l.q != null) add('twTurn', TWIST.place);
}
