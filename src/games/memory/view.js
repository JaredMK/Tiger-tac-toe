// Memory: the screen, the miniature, the move's words and sounds, and the inputs.
import { playMove } from '../../core/board.js';
import { SND } from '../../audio/sound.js';
import { attemptMove, dbPick } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { RNG, commit, pickKey, state } from '../../ui/app.js';
import { fxAt, fxAttr, startFx } from '../../ui/fx.js';
import { playFlash } from '../../ui/turns.js';

const CARD_COLORS = { green: '#5be37a', yellow: '#ffd54a', purple: '#c084fc', orange: '#ff9e4a' };
const SHAPES = {
  circle: '<circle cx="12" cy="12" r="9"/>',
  square: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/>',
  triangle: '<path d="M12 3 21.5 20h-19z"/>',
  diamond: '<path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/>',
};
function shapeSvg(card) { return `<svg viewBox="0 0 24 24" fill="${CARD_COLORS[card.c]}">${SHAPES[card.s]}</svg>`; }
export function miniature(mini, final) {
  const shown = final && mini.winCells ? mini.winCells : [];
  return `<div class="tg g3 tmem">${mini.cards.map((card, i) => (shown.includes(i) ? `<i class="up">${shapeSvg(card)}</i>` : '<i>?</i>')).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const up = new Set();
  if (state.pick != null && state.pickSq === state.zoom && !f && !d) up.add(state.pick);
  if (f && f.reveal) f.reveal.forEach(k => up.add(k));
  if (view) mini.cards.forEach((_, k) => up.add(k));      // the whole deck, once the square is won
  const flipped = f && f.reveal ? f.reveal : [];
  const back = !f && d && d.reveal && !sq.owner ? d.reveal : [];   // the two cards just seen, turning face down again
  g = `<div class="g-mem">${mini.cards.map((card, i) => {
        const isUp = up.has(i), picking = state.pick === i && state.pickSq === state.zoom && !f && !d;
        const cls = `mc ${isUp ? 'up' : 'down'}${picking ? ' pick' : ''}${won(i) ? ' win' : ''}${won(i) && fresh ? ' glow' : ''}${picking || flipped[1] === i ? ' flipup' : ''}${back.includes(i) ? ' flipdown' : ''}`;
        // a card's face is only in the page while it is (or was just) on show
        return `<button class="${cls}" data-act="pick" data-i="${i}" aria-label="Card ${i + 1}${isUp ? ', face up' : ''}"${picking ? fxAttr(fxAt('pick', pickKey())) : ''}${locked ? ' disabled' : ''}><span class="in"><span class="bk">?</span><span class="ft">${(isUp || back.includes(i)) && card ? shapeSvg(card) : ''}</span></span></button>`;
      }).join('')}</div>`;
  return g;
}
export function moveText(f, who) {
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
  else if (!playMove(state, state.zoom, [first, i], RNG).ok) { state.pick = null; state.pickSq = null; }
  else playFlash();
  commit();
}
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { pick: pickAct };
