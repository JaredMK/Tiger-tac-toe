// Thirty-One: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, shuffle } from '../../core/random.js';
import { cardDeck } from '../shared/cards.js';
import { goAgain, tune } from '../../core/tune.js';

// ---------- Thirty-One (November 2026) ----------
// Each player holds 3 cards and has a deck and a discard pile of their own (a full 52-card deck each: nothing they do
// touches the other player, so a player moving alone can always win). A turn is two steps:
//  1. Take: the top card of their discard pile ('pile') or the top of their deck ('deck', the card turned up as it
//     comes); the turn is held to the square for step 2 (`again`, as 21's Deal and Hit).
//  2. Discard: one of the 4 cards in hand ('d0'..'d3', its place in the hand) goes face up onto their discard pile.
// The hand's score is its best single-suit total: an ace 11, a picture card (and the 10) 10, the others their number;
// the cards of the other suits count nothing. After the discard, exactly 31 wins at once; else a score at the target
// (`target`, the admin's) wins. With "Go again on success" on (core/tune.js AGAIN_TUNE), a discard that raises the
// score keeps the turn for another take. The deck's order is hidden (secret/hide: online it stays on the server; the
// card drawn shows as it comes); the hands and the discard piles are public. A deck run out is refilled from that
// player's discard pile, all but its top card, shuffled. A timeout with a card taken discards that card (`timeoutClose`:
// 'auto'), so the hand is as it was and only the take is spent.
export const T31 = { hand: 3, target: 25, hold: 450, slide: 300, flip: 260, land: 620 };
export const t31Cfg = mini => Object.assign({ target: T31.target }, tune(mini));
export const t31Val = c => (c[0] === 'A' ? 11 : 'TJQK'.includes(c[0]) ? 10 : Number(c[0]));
// The best single-suit total of a hand, and its suit.
export function t31Best(hand) {
  const by = {};
  for (const c of hand || []) by[c[1]] = (by[c[1]] || 0) + t31Val(c);
  let best = 0, suit = null;
  for (const s of 'SHDC') if ((by[s] || 0) > best) { best = by[s]; suit = s; }
  return { score: best, suit };
}
export const t31Score = hand => t31Best(hand).score;
export const t31Won = (score, target) => score === 31 || score >= target;
// The cards p has not seen: their own 52 less their hand and their discard pile (where their hidden deck is).
export function t31Unseen(mini, p) {
  const seen = new Set([...(mini.hand[p] || []), ...(mini.pile[p] || [])]);
  return cardDeck().filter(c => !seen.has(c));
}
export function create(type, rng) {
  const r = needRng(rng), deal = () => shuffle(cardDeck(), r);
  const deck = { X: deal(), O: deal() }, hand = {}, pile = {};
  for (const p of ['X', 'O']) { hand[p] = deck[p].splice(-T31.hand).reverse(); pile[p] = [deck[p].pop()]; }
  return { type, v: 1, hand, pile, deck, deckN: { X: deck.X.length, O: deck.O.length }, held: null, turns: { X: 0, O: 0 }, last: null };   // deck: hidden (each player's own); held: a card taken, waiting for the discard
}
function drawDeck(mini, p, rng) {
  if (!mini.deck || typeof mini.deck !== 'object') mini.deck = {};
  if (!Array.isArray(mini.deck[p]) || !mini.deck[p].length) {     // run out: the discard pile, all but its top card, shuffled in
    const pile = mini.pile[p], keep = pile.length ? [pile[pile.length - 1]] : [];
    const back = pile.slice(0, -1);
    const known = new Set([...mini.hand[p], ...keep]);
    mini.deck[p] = shuffle(back.length ? back : cardDeck().filter(c => !known.has(c)), needRng(rng));
    mini.pile[p] = keep;
    mini.reshuf = p;
  }
  return mini.deck[p].pop();
}
export function apply(mini, p, m, rng, idx) {
  if (mini.held && mini.held.by !== p) mini.held = null;          // (a take left by the other player's timeout: gone)
  mini.reshuf = null;
  if (m === 'deck' || m === 'pile') {
    if (mini.held) return { ok: false, reason: 'taken' };
    if (m === 'pile' && !mini.pile[p].length) return { ok: false, reason: 'bad' };
    const before = t31Score(mini.hand[p]);
    const card = m === 'pile' ? mini.pile[p].pop() : drawDeck(mini, p, rng);
    mini.hand[p] = mini.hand[p].concat(card);
    mini.deckN[p] = mini.deck && Array.isArray(mini.deck[p]) ? mini.deck[p].length : mini.deckN[p] - (m === 'deck' ? 1 : 0);
    mini.held = { by: p, from: m, card, before };
    mini.last = { by: p, kind: 'take', from: m, card, reshuf: mini.reshuf === p };
    return { ok: true, outcome: 'continue', note: 'take', again: true };   // (the turn held for the discard)
  }
  let k;
  if (m === 'auto') { if (!mini.held) return { ok: false, reason: 'bad' }; k = mini.hand[p].length - 1; }   // the time ran out: the card taken goes
  else { const mm = /^d([0-3])$/.exec(String(m)); if (!mm || !mini.held) return { ok: false, reason: 'bad' }; k = Number(mm[1]); }
  if (k >= mini.hand[p].length) return { ok: false, reason: 'bad' };
  const before = mini.held.before, gone = mini.hand[p][k];
  mini.hand[p] = mini.hand[p].filter((_, i) => i !== k);
  mini.pile[p].push(gone);
  mini.held = null; mini.turns[p] += 1;
  const best = t31Best(mini.hand[p]), target = t31Cfg(mini).target;
  mini.last = { by: p, kind: 'drop', card: gone, k, score: best.score, suit: best.suit, before, auto: m === 'auto' };
  if (best.score === 31) return { ok: true, outcome: 'win', note: 'thirtyone' };
  if (best.score >= target) return { ok: true, outcome: 'win', note: 'target' };
  if (m !== 'auto' && best.score > before && goAgain(mini)) return { ok: true, outcome: 'continue', note: 'up', again: true };   // ("Go again on success" on: a higher score takes again)
  return { ok: true, outcome: 'continue', note: best.score > before ? 'up' : 'same' };
}
export function timeoutClose(mini, p) { return mini.held && mini.held.by === p ? 'auto' : null; }
export function publicView(mini) {
  const cp = o => ({ X: o.X.slice(), O: o.O.slice() });
  return { type: 't31', v: mini.v, hand: cp(mini.hand), pile: cp(mini.pile), deckN: Object.assign({}, mini.deckN), held: mini.held ? Object.assign({}, mini.held) : null, turns: Object.assign({}, mini.turns), last: mini.last ? Object.assign({}, mini.last) : null };   // never the decks
}
export function randomMove(mini, p, rng, from, empties) {
  const r = needRng(rng);
  if (!mini.held || mini.held.by !== p) return r() < 0.5 && mini.pile[p].length ? 'pile' : 'deck';
  return 'd' + Math.floor(r() * mini.hand[p].length);
}
export function canMove(mini) { return true; }
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.t31 = Object.assign({}, l, { hand: mini.hand[p].slice(), top: mini.pile[p].length ? mini.pile[p][mini.pile[p].length - 1] : null, deckN: mini.deckN[p], score: { X: t31Score(mini.hand.X), O: t31Score(mini.hand.O) } });
}
export function secret(mini) { return mini.deck ? { deck: { X: (mini.deck.X || []).slice(), O: (mini.deck.O || []).slice() } } : null; }
export function hide(m, k, st) { delete m.deck; }
// The move's moments (ms from it): a take slides the card in (a deck card turning up as it lands); a discard slides the
// card onto the pile and the score counts on as it lands.
export function t31Times(s) {
  if (!s) return { end: T31.hold };
  if (s.kind === 'take') return { land: T31.slide, end: T31.slide + (s.from === 'deck' ? T31.flip : 0) + 150 };
  return { land: T31.slide, end: T31.land + T31.hold };
}
export function flashMs(f, winLen, won) { return t31Times(f.t31).end + (won ? 600 : 0); }
