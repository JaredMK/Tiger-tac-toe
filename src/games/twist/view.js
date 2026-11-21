// Twist Four: the screen, the miniature, the move's words and sounds, and the placing of a piece.
// The board is four quarters, each a little tray of square holes. A move is a few taps: an empty hole (the piece goes in:
// this phone's draft; a tap on it takes it back), then a quarter (it lights up), then one of the two big curved arrows under
// the board (that way: the quarter is drawn as it would be after the turn, its pieces as ghosts), then Twist! (the move goes in).
// A placement that makes the line goes in at once, with no twist. The move plays as the piece popping in (TWIST.place) and the
// quarter turning a quarter turn with its pieces (TWIST.turn); a line lights up.
import { TWIST, twistTry, twistTurn } from './rules.js';
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
let draft = null;                                                  // this phone's piece placed, the twist still to pick: { sq, p, n, c, q, d }
const draftFor = (sq, p, mini) => (draft && draft.sq === sq && draft.p === p && draft.n === mini.moves && !mini.cells[draft.c] ? draft : null);
const live = () => { const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini; return m && m.type === 'twist' && !state.flash && !state.done && !blocked() ? m : null; };
function placeAct(el) {
  const m = live(); if (!m) return;
  const p = state.turn, c = Number(el.dataset.c);
  if (!(c >= 0 && c < m.cells.length) || m.cells[c]) return;
  const dr = draftFor(state.zoom, p, m);
  if (dr && dr.c === c) { draft = null; SND.play('twPlace', { rate: 0.8 }); render(); return; }   // taken back
  const alone = twistTry(m.cells, m.n, m.L, p, { c });
  if (alone && alone.end === 'win') { draft = null; attemptMove({ c }); return; }   // the line is made: no twist
  draft = { sq: state.zoom, p, n: m.moves, c, q: -1, d: 0 }; SND.play('twPlace'); haptic('tap'); render();
}
function quarterAct(el) {
  const m = live(), dr = m && draftFor(state.zoom, state.turn, m); if (!dr) return;
  const q = Number(el.dataset.q); if (!(q >= 0 && q < 4) || dr.q === q) return;
  dr.q = q; dr.d = 0; SND.play('tap'); haptic('tap'); render();
}
function dirAct(el) {
  const m = live(), dr = m && draftFor(state.zoom, state.turn, m); if (!dr || dr.q < 0) return;
  const d = Number(el.dataset.d) === -1 ? -1 : 1; if (dr.d === d) return;
  dr.d = d; SND.play('twTurn', { rate: 1.25 }); haptic('tap'); render();
}
export const actions = { 'tw-place': el => { ownPress(); placeAct(el); }, 'tw-q': el => { ownPress(); quarterAct(el); }, 'tw-dir': el => { ownPress(); dirAct(el); } };
// A big curved arrow: d 1 clockwise, -1 the other way.
const ARC = d => `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="${d === -1 ? 'M14 30a13 13 0 1 1 6 9' : 'M34 30a13 13 0 1 0-6 9'}" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/><path d="${d === -1 ? 'M6 24.5 13.5 32l8-7' : 'M42 24.5 34.5 32l-8-7'}" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const QN = ['top left', 'top right', 'bottom left', 'bottom right'];
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const n = mini.n, h = n / 2, s = a && a.tw ? a.tw : null, o = { view, locked, turn }, on = !view && !locked && !s;
  const dr = on ? draftFor(state.zoom, turn, mini) : null, dc = dr ? dr.c : -1, win = new Set(mini.winCells || []);
  const pq = dr && dr.q >= 0 && dr.d ? dr.q : -1;                  // the quarter shown turned, its pieces as ghosts
  const prev = pq >= 0 ? twistTurn(mini.cells.map((v, i) => (i === dc ? turn : v)), n, pq, dr.d) : null;
  const tal = p => arcTally(p, o, tok(p));
  const quarter = q => {
    const r0 = q >= 2 ? h : 0, c0 = q % 2 ? h : 0; let cells = '';
    for (let r = 0; r < h; r++) for (let c = 0; c < h; c++) {
      const i = (r0 + r) * n + c0 + c, here = dc === i, ghost = q === pq;
      const v = ghost ? prev[i] : mini.cells[i];
      const cls = `twc${win.has(i) ? (s ? ' win late' : ' win') : ''}${s && s.at === i ? ' new' : ''}${here && !ghost ? ' draft' : ''}`;
      const inner = ghost ? (v ? tok(v, 'pv') : '') : v ? tok(v) : here ? tok(turn, 'ghost') : '';
      cells += on && !v && !ghost && (dc < 0 || here) ? `<button class="${cls}" data-act="tw-place" data-c="${i}" aria-label="Row ${r0 + r + 1}, column ${c0 + c + 1}${here ? ': take back' : ''}">${inner}</button>` : `<div class="${cls}">${inner}</div>`;
    }
    const turning = s && s.q === q, pick = dr && dr.q === q;
    const cls = `twq${turning ? ' turn' : ''}${pick ? ' pick' : ''}${q === pq ? ' prev' : ''}${dr ? ' can' : ''}`;
    const at = dr ? ` data-act="tw-q" data-q="${q}" role="button" tabindex="0" aria-pressed="${!!pick}" aria-label="The ${QN[q]} quarter"` : '';
    return `<div class="${cls}"${at}${turning ? ` style="--from:${-s.d * 90}deg"` : ''}><div class="twqi" style="--h:${h}">${cells}</div></div>`;
  };
  const off = !dr || dr.q < 0, ready = dr && dr.q >= 0 && dr.d;
  const dir = dd => `<button class="twdir ${turn}${dr && dr.d === dd ? ' on' : ''}" data-act="tw-dir" data-d="${dd}"${off ? ' disabled' : ''} aria-pressed="${!!(dr && dr.d === dd)}" aria-label="Turn it ${dd === 1 ? 'clockwise' : 'counterclockwise'}">${ARC(dd)}</button>`;
  const go = `<button class="twgo big ${turn}" data-act="move" ${ready ? mv({ c: dc, q: dr.q, d: dr.d }) : ''}${ready ? '' : ' disabled'}>Twist!</button>`;
  const tip = !on ? '' : !dr ? '' : dr.q < 0 ? 'Tap a quarter to turn' : !dr.d ? 'Pick a way to turn it' : '';
  const line = `<p class="twline">${tip}</p>`;
  const ctl = view ? '' : `<div class="twctl">${dir(-1)}${go}${dir(1)}</div>`;
  return `<div class="g-tw pc-${s ? a.by : turn}${dr ? ' twisting' : ''}" style="--tp:${TWIST.place}ms;--tt:${TWIST.turn}ms"><div class="ctals">${tal('X')}${tal('O')}</div><div class="twbox"><div class="twrim"><div class="twboard">${[0, 1, 2, 3].map(quarter).join('')}</div></div></div>${line}${ctl}</div>`;
}
// The miniature: the board from above, its quarters marked, every piece on it.
export function miniature(mini, final) {
  const n = mini.n, u = 60 / n; let out = `<rect class="ttwb" x="1" y="1" width="58" height="58" rx="6"/><path class="ttwq" d="M30 3v54M3 30h54"/>`;
  mini.cells.forEach((v, i) => { const x = (i % n + 0.5) * u, y = (Math.floor(i / n) + 0.5) * u; out += v ? `<circle class="ttwp ${v}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(u * 0.34).toFixed(1)}"/>` : `<circle class="ttwh" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(u * 0.15).toFixed(1)}"/>`; });
  return `<div class="ttw" aria-label="Twist Four: ${mini.cells.filter(v => v === 'X').length} X, ${mini.cells.filter(v => v === 'O').length} O on the board"><svg viewBox="0 0 60 60" aria-hidden="true">${out}</svg></div>`;
}
export function moveText(f, who) { return f.note === 'gift' ? `${who} twisted a line for the other side` : `${who} placed and twisted`; }
// The piece clacking into its hole, then the quarter's ratchet as it turns.
export function sounds(f, add, won, mini, last) {
  const l = f.tw; if (!l) return;
  add('twPlace', 0); if (l.q != null) add('twTurn', TWIST.place);
}
