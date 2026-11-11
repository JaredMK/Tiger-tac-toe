// Thirty-One: the screen, the miniature, the move's words and sounds, and the inputs (November 2026).
import { T31, t31Best, t31Cfg, t31Score, t31Times } from './rules.js';
import { N, REDUCED, mv, state, waitLine } from '../../ui/app.js';
import { pcard, cardShort, SUIT_PATH } from '../../ui/cards.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { markSvgG, thumbArt } from '../../ui/thumbs.js';
import { cardRed } from '../bus/rules.js';

// The table: each player's score (their best suit) against the target in the tallies; the felt with the mover's deck
// (face down, its count on it) and their discard pile (its top card up), each a tap to take; the mover's hand under it,
// its best suit's cards lit, each card a tap to let go once a card is taken. A take slides the card into the hand (a
// deck card turning up as it lands); a discard slides it onto the pile and the score counts on as it lands. Every row
// has its room from the start (a hand of 4 at most): nothing moves.
function t31Table(mini, a, o) {
  const s = a && a.t31 ? a.t31 : null, turn = o.turn, target = t31Cfg(mini).target;
  const held = mini.held, by = s ? a.by : held ? held.by : turn;
  const mine = !o.view && !o.locked && by === turn, canTake = mine && !held, canDrop = mine && held && held.by === turn;
  const tim = t31Times(s), anim = !!s && !REDUCED;
  const tal = p => {
    const sc = t31Score(mini.hand[p].length > 3 && held && held.by === p ? mini.hand[p].slice(0, 3) : mini.hand[p]);
    const was = s && s.kind === 'drop' && a.by === p ? s.before : null;
    const num = was != null && was !== sc && anim ? `<b class="cnt" data-from="${was}" data-delay="${T31.land}">${sc}</b>` : `<b>${sc}</b>`;
    return arcTally(p, o, `<span class="t31sc" aria-label="${sc} of ${target}">${num}<small>/${target}</small></span>`);
  };
  // the deck and the pile: the mover's own
  const pile = mini.pile[by], top = pile.length ? pile[pile.length - 1] : null, n = mini.deckN[by];
  const deckBtn = `<button class="t31deck" data-act="move" ${mv('deck')} aria-label="Draw from the deck, ${n} cards"${canTake ? '' : ' disabled'}>${pcard(null, { down: true })}<span class="t31n">${n}</span></button>`;
  const dropNow = s && s.kind === 'drop' && anim;
  const pileCard = top ? pcard(top, dropNow ? { slide: 0, cls: 't31in' } : {}) : pcard(null, { down: true, cls: 'ghost' });
  const pileBtn = `<button class="t31pile" data-act="move" ${mv('pile')} aria-label="Take the top of the discard pile"${canTake && top ? '' : ' disabled'}>${pileCard}</button>`;
  // the hand: the best suit's cards lit; the card just taken sliding in
  const hand = mini.hand[by], best = t31Best(held && held.by === by ? hand.slice(0, 3) : hand).suit;
  const takeNow = s && s.kind === 'take' && anim;
  const cards = Array.from({ length: 4 }, (_, k) => {
    const c = hand[k];
    if (!c) return '<span class="t31slot" aria-hidden="true"></span>';
    const fresh = takeNow && k === hand.length - 1;
    const card = pcard(c, fresh ? (s.from === 'deck' ? { slide: 0, flip: T31.slide, cls: 't31dk' } : { slide: 0, cls: 't31pk' }) : {});
    const lit = c[1] === best && !(held && k === 3 && held.by === by) ? ' best' : '';
    return `<button class="t31c${lit}" data-act="move" ${mv('d' + k)} aria-label="Let go of this card"${canDrop ? '' : ' disabled tabindex="-1"'}>${card}</button>`;
  }).join('');
  let line;
  if (s && s.kind === 'take') line = `<p ${lateAt('arcres', anim ? tim.land : null)} role="status">Took ${cardShort(s.card)}</p>`;
  else if (s && s.kind === 'drop') line = `<p ${lateAt('arcres ' + (s.score > s.before ? 'ok' : ''), anim ? T31.land : null)} role="status">${s.score === 31 ? '31!' : `${s.score} in ${suitWord(s.suit)}`}</p>`;
  else line = `<p class="arcnote">${o.view ? '' : o.locked ? waitLine(turn) : ''}</p>`;
  return `<div class="g-arc t31"><div class="ctals">${tal('X')}${tal('O')}</div>
    <div class="t31felt"><div class="t31top">${deckBtn}${pileBtn}</div>${line}<div class="t31hand"><svg class="t31mk ${by}" viewBox="-10 -10 20 20" aria-label="${by}'s hand">${markSvgG(by, 6.5)}</svg><div class="t31row">${cards}</div></div></div></div>`;
}
const suitWord = s => ({ S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }[s] || 'one suit');
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = t31Table(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
// The miniature: each player's three cards as little cards (suits drawn; the best suit's ringed in the player's colour),
// each player's score beside them.
export function miniature(mini, final) {
  const row = (p, y) => {
    const h = mini.hand[p].slice(0, 3), best = t31Best(h).suit;
    return h.map((c, k) => { const x = 2 + k * 21; return `<g transform="translate(${x} ${y})"><rect class="tt31c${c[1] === best ? ' ' + p : ''}" width="18" height="24" rx="3"/><path class="tt31s${cardRed(c) ? ' red' : ''}" transform="translate(3 6) scale(.5)" d="${SUIT_PATH[c[1]]}"/></g>`; }).join('');
  };
  const art = `<svg class="tt31" viewBox="0 0 66 54" aria-hidden="true">${row('X', 1)}${row('O', 29)}</svg>`;
  const rows = ['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><span class="tsn">${t31Score(mini.hand[p].slice(0, 3))}</span></div>`).join('');
  return thumbArt(art, rows, 'tt31w', `Thirty-One: X ${t31Score(mini.hand.X.slice(0, 3))}, O ${t31Score(mini.hand.O.slice(0, 3))} of ${t31Cfg(mini).target}`);
}
export function moveText(f, who) {
  const s = f.t31;
  if (!s) return `${who} played`;
  if (s.kind === 'take') return `${who} ${s.from === 'deck' ? 'drew' : 'took'} a card`;
  return s.auto ? `${who} ran out of time` : `${who}: ${s.score} in one suit`;
}
// A take: the card sliding in (a turn as a deck card shows); a discard: the slide onto the pile, then a ding as the
// score rises (a sparkle at 31), or a soft no-pair when it does not.
export function sounds(f, add, won, mini, last) {
  const s = f.t31;
  if (!s) return;
  if (s.kind === 'take') { add('cardSlide', 0); if (s.from === 'deck') add('cardFlip', T31.slide); return; }
  add('cardSlide', 0);
  if (won || s.score === 31) add('sparkle', T31.land); else if (s.score > s.before) add('ding', T31.land); else add('nopair', T31.land);
}
// The square's line while the turn is held to it (ui/mini.js): a card taken, one to let go; or, with "Go again on success"
// on, a raised score taking again.
export function heldSub(mini, turn, f) {
  if (f) return '';
  const who = `<b class="${turn}">${N(turn)}</b>`;
  return mini.held && mini.held.by === turn ? `${who}: a card taken` : `${who} raised the score · goes again`;
}
