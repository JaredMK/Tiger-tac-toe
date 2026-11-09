// Find the Pair: the screen, the miniature, the move's words and sounds, and the inputs.
import { playMove } from '../../core/board.js';
import { SND } from '../../audio/sound.js';
import { attemptMove, dbPick } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { N, RNG, commit, pickKey, state, viewer } from '../../ui/app.js';
import { raceSide } from '../../core/race.js';
import { raceShape } from './rules.js';
import { fxAt, fxAttr, startFx } from '../../ui/fx.js';
import { repTake } from '../../ui/replay.js';
import { playFlash } from '../../ui/turns.js';

const CARD_COLORS = { green: '#5be37a', yellow: '#ffd54a', purple: '#c084fc', orange: '#ff9e4a' };
const SHAPES = {
  circle: '<circle cx="12" cy="12" r="9"/>',
  square: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/>',
  triangle: '<path d="M12 3 21.5 20h-19z"/>',
  diamond: '<path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/>',
};
function shapeSvg(card) { return `<svg viewBox="0 0 24 24" fill="${CARD_COLORS[card.c]}">${SHAPES[card.s]}</svg>`; }
// Race mode (core/race.js): the deck this view gets is this phone's own (its part: the cards it has turned and their faces,
// online the deck itself stays on the server) and both players' flip counts (the shapes: the race row over the cards); the
// other side's move arrives redacted (a.race: their count after it): no card of theirs turns here. Reviewed, the whole deck.
const shapeOf = (mini, p) => (mini.shape && mini.shape[p]) || raceShape(mini, p) || {};
const flipsOf = (mini, p) => { const sh = shapeOf(mini, p); return Number.isInteger(sh.n) ? sh.n : 0; };
const cardsOf = mini => (Array.isArray(mini.cards) && mini.cards.length === 9 ? mini.cards : new Array(9).fill(null));   // (a race square online: no deck on this phone)
// The miniature: the nine cards face down (a drawn back, no "?": too small a figure to read), the winning pair face up;
// a race: the backs and each player's flips.
export function miniature(mini, final) {
  const shown = final && mini.winCells ? mini.winCells : [], cards = cardsOf(mini);
  const grid = `<div class="tg g3 tmem">${cards.map((card, i) => (shown.includes(i) && card ? `<i class="up">${shapeSvg(card)}</i>` : '<i></i>')).join('')}</div>`;
  if (mini.race && !final) {
    const rows = ['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><span class="tdn">${flipsOf(mini, p)}</span></div>`).join('');
    return `<div class="tart tmemr trace" aria-label="Race: ${['X', 'O'].map(p => `${p} ${flipsOf(mini, p)} flip${flipsOf(mini, p) === 1 ? '' : 's'}`).join(', ')}"><div class="tpic" aria-hidden="true">${grid}</div><div class="tpip">${rows}</div></div>`;
  }
  return grid;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const race = !!mini.race, me = race ? (viewer() || turn) : null, part = race ? raceSide(mini, me) : null;
  const theirs = race && a && a.race && a.by !== me ? a : null;   // the other side's flip in a race: its count alone
  const cards = cardsOf(mini), faceOf = i => (part && part.faces && part.faces[i]) || cards[i];   // (a race: the faces this side has turned, kept in its part)
  const up = new Set();
  if (state.pick != null && state.pickSq === state.zoom && !f && !d && (!race || state.turn === me)) up.add(state.pick);   // (a race: the other side's first card never shows here)
  if (f && f.reveal) f.reveal.forEach(k => up.add(k));
  if (view) cards.forEach((_, k) => up.add(k));           // the whole deck, once the square is won
  const flipped = f && f.reveal ? f.reveal : [];
  const back = !f && d && d.reveal && !sq.owner ? d.reveal : [];   // the two cards just seen, turning face down again
  const row = race ? `<div class="mrace">${['X', 'O'].map(p => { const fr = !!(theirs && theirs.by === p), n = flipsOf(mini, p); return `<span class="${p}${fr ? ' fresh' : ''}"><b class="${p} mrn">${N(p)}</b><small>${n} flip${n === 1 ? '' : 's'}</small></span>`; }).join('')}</div>` : '';   // a race: each player's flips (always there: the cards never move)
  const grid = `<div class="g-mem">${cards.map((card, i) => {
        const isUp = up.has(i), picking = state.pick === i && state.pickSq === state.zoom && !f && !d && (!race || state.turn === me), face = faceOf(i);
        const cls = `mc ${isUp ? 'up' : 'down'}${picking ? ' pick' : ''}${won(i) ? ' win' : ''}${won(i) && fresh ? ' glow' : ''}${picking || flipped[1] === i ? ' flipup' : ''}${back.includes(i) ? ' flipdown' : ''}`;
        // a card's face is only in the page while it is (or was just) on show
        return `<button class="${cls}" data-act="pick" data-i="${i}" aria-label="Card ${i + 1}${isUp ? ', face up' : ''}"${picking ? fxAttr(fxAt('pick', pickKey())) : ''}${locked ? ' disabled' : ''}><span class="in"><span class="bk">?</span><span class="ft">${(isUp || back.includes(i)) && face ? shapeSvg(face) : ''}</span></span></button>`;
      }).join('')}</div>`;
  g = race ? `<div class="g-memr">${row}${grid}</div>` : grid;
  return g;
}
export function moveText(f, who) {
  if (f.race && !f.reveal) return `Flip ${f.race.n} · no match`;   // the other side's flip in a race: its count alone
  return 'No match';
}
export function sounds(f, add, won, mini, last) {
  add('flipUp', 0); add(won ? 'pair' : 'nopair', 380); return;
}
export function pickAct(el, e, act) {
  const i = Number(el.dataset.i);
  const first = state.pick != null && state.pickSq === state.zoom ? state.pick : null;
  if (state.online) {                          // the first card is turned up in the room, for both to see; two cards make the move
    if (blocked()) return;
    if (first == null || first === i) dbPick(state.zoom, first === i ? null : i);
    else attemptMove([first, i]);
    return;
  }
  if (first == null) { state.pick = i; state.pickSq = state.zoom; startFx('pick', pickKey()); SND.play('flipUp'); }   // the card turns up: its own event
  else if (first === i) { state.pick = null; state.pickSq = null; }
  else if (!playMove(state, state.zoom, [first, i], RNG, { rep: repTake() }).ok) { state.pick = null; state.pickSq = null; }
  else playFlash();
  commit();
}
// Someone else's move replayed (ui/replay.js): their first card turns up as it did for them; the second is the move.
function replayInput(act, val, r) {
  if (act !== 'pick' || !/^i=\d$/.test(val || '')) return false;
  const i = Number(val.slice(2));
  if (state.pick == null || state.pickSq !== r.sq) { state.pick = i; state.pickSq = r.sq; startFx('pick', pickKey()); SND.play('flipUp'); }
  return true;
}
const replaySynth = m => (Array.isArray(m) && m.length === 2 ? [[0, 'pick', 'i=' + m[0]], [800, 'pick', 'i=' + m[1]]] : null);
export const replay = { input: replayInput, synth: replaySynth };
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { pick: pickAct };
