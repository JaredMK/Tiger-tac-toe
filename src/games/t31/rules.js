// Thirty-One: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, shuffle } from '../../core/random.js';
import { cardDeck, isCard } from '../shared/cards.js';
import { goAgain, tune } from '../../core/tune.js';

// ---------- Thirty-One (November 2026; one deck and one pile for both, private hands, 32 cards: the rework, v 2) ----------
// A mini deck of 32 cards (7, 8, 9, 10, J, Q, K, A in four suits) for both players: one shared deck (hidden: its order on
// the server alone, secret/hide; how many are left is public) and one shared discard pile (open, its cards in order, the
// top one on show), so a player can take the other's throw. Each holds 3 cards that are theirs alone: online a hand rides
// the per-side channel (games/{id}/sides/{side}: sidePart/sideMerge, core/records.js), never the public state, a move's
// entry, a flash or the other phone; the server keeps both whole in the secrets. A score comes from a hand, so it is its
// player's alone too, until the square is won (a claimed square's record is whole: the review shows both hands).
// A turn is two steps:
//  1. Take: the top card of the pile ('pile') or the top of the deck ('deck'); the turn is held to the square for step 2
//     (`again`: the game's own step, as 21's Deal is). A card off the pile was on show and stays public (`held.card`,
//     `last.card`, and `seen[p]`: the cards p took off the pile and still holds); one off the deck is the taker's alone.
//     The deck run out: the pile under its top card is shuffled into a new deck (the move's rng: the server's online).
//  2. Discard: one of the 4 cards in hand ('d0'..'d3', its place in the hand; the card taken is the last) goes face up
//     onto the pile.
// The hand's score is its best single-suit total: an ace 11, the 10 and the picture cards 10, the others their number;
// the cards of the other suits count nothing (a hand of four, a card taken: the best three of it, what the best discard
// leaves). After the discard a score at the target (`target`, the admin's: 30) wins; 31, an ace and two cards worth 10
// of one suit, is the most there is. With "Go again on success" on (core/tune.js AGAIN_TUNE), a discard that leaves a
// higher score than before the take keeps the turn for another take (which says so: off, nothing is said of a score).
// The deal: three cards of three different suits each (a hand worth 11 at most: nobody starts ahead, and no square is
// won before each player's second turn), the rest the deck (26), the pile empty: the square's first take is from the
// deck, and the first discard opens the pile (what keeps the first mover under 60%, tests/sim/t31.sim.js). A timeout
// with a card taken discards that card (`timeoutClose`: 'auto'), so the hand is as it was. Never dealt to two people on
// one phone (meta.js samePhone: false). A square from before the rework (v 1: a 52-card deck and a pile each, open
// hands) is dealt again as the record is read (`stale`, core/records.js fullState).
export const T31 = { hand: 3, target: 30, ranks: '789TJQKA', hold: 450, slide: 300, flip: 260, land: 620 };
export const t31Cfg = mini => Object.assign({ target: T31.target }, tune(mini));
export const t31Deck = () => cardDeck().filter(c => T31.ranks.includes(c[0]));   // 32 cards: 7 to the ace
export const t31Val = c => (c[0] === 'A' ? 11 : 'TJQK'.includes(c[0]) ? 10 : Number(c[0]) || 0);
// The best single-suit total of a hand, its suit and the cards that make it: { score, suit, cards }. Three cards count
// at most (a hand of four, a card taken: its best three of a suit, what the best discard leaves), so a score is never
// over 31. Anything that is not a card counts nothing; no cards: 0, no suit.
export function t31Best(hand) {
  const by = {};
  for (const c of Array.isArray(hand) ? hand : []) if (isCard(c)) (by[c[1]] = by[c[1]] || []).push(c);
  let score = 0, suit = null, cards = [];
  for (const s of 'SHDC') {
    if (!by[s]) continue;
    const top = by[s].slice().sort((a, b) => t31Val(b) - t31Val(a)).slice(0, T31.hand), sum = top.reduce((n, c) => n + t31Val(c), 0);
    if (sum > score) { score = sum; suit = s; cards = top; }
  }
  return { score, suit, cards };
}
export const t31Score = hand => t31Best(hand).score;
export const t31Won = (score, target) => score === 31 || score >= target;
export function create(type, rng) {
  const r = needRng(rng);
  const d = shuffle(t31Deck(), r), hand = {}, pile = [];
  for (const p of ['X', 'O']) {                                     // three cards of three suits each: the top card of the deck that brings a new suit, three times
    hand[p] = [];
    while (hand[p].length < T31.hand) { let i = d.length - 1; while (i > 0 && hand[p].some(c => c[1] === d[i][1])) i--; hand[p].push(d.splice(i, 1)[0]); }
  }
  return { type, v: 2, hand, deck: d, pile, left: d.length, hn: { X: T31.hand, O: T31.hand }, seen: { X: [], O: [] }, held: null, turns: { X: 0, O: 0 }, last: null };   // deck: hidden; hand: each side's own; seen: the cards each took off the pile and still holds (public); held: a card taken, waiting for the discard
}
export const stale = mini => (mini.v || 1) < 2;                    // (a square from before the rework: dealt again, core/records.js)
// The top of the deck (the deck out: the pile under its top card shuffled in; nothing there either: every card not in a
// hand or on the pile).
function draw(mini, rng) {
  if (!Array.isArray(mini.deck)) mini.deck = [];
  let reshuf = false;
  if (!mini.deck.length) {
    const top = mini.pile.pop();
    mini.deck = shuffle(mini.pile.splice(0), needRng(rng));
    mini.pile = top ? [top] : [];
    reshuf = true;
    if (!mini.deck.length) {
      const inPlay = new Set([...mini.hand.X, ...mini.hand.O, ...mini.pile]);
      mini.deck = shuffle(t31Deck().filter(c => !inPlay.has(c)), needRng(rng));
    }
  }
  const card = mini.deck.pop();
  mini.left = mini.deck.length;
  return { card, reshuf };
}
export function apply(mini, p, m, rng, idx) {
  if (!mini.hand || !Array.isArray(mini.hand[p]) || !Array.isArray(mini.pile)) return { ok: false, reason: 'secret' };
  if (!mini.seen) mini.seen = { X: [], O: [] };
  if (!mini.hn) mini.hn = { X: T31.hand, O: T31.hand };
  if (mini.held && mini.held.by !== p) mini.held = null;          // (a take left by the other player's timeout: gone; its card went then)
  if (m === 'deck' || m === 'pile') {
    if (mini.held) return { ok: false, reason: 'taken' };
    let card, reshuf = false;
    if (m === 'pile') { card = mini.pile.pop(); if (!card) return { ok: false, reason: 'bad' }; mini.seen[p] = mini.seen[p].concat(card); }
    else ({ card, reshuf } = draw(mini, rng));
    mini.hand[p] = mini.hand[p].concat(card);                       // (the card taken is the last of the hand: 'd3')
    mini.hn[p] = mini.hand[p].length;
    mini.held = { by: p, from: m, card };
    mini.last = Object.assign({ by: p, kind: 'take', from: m, reshuf, left: mini.left }, m === 'pile' ? { card } : {});   // (a deck card: the taker's alone)
    return { ok: true, outcome: 'continue', note: 'take', again: true };   // (the turn held for the discard)
  }
  let k;
  if (m === 'auto') { if (!mini.held) return { ok: false, reason: 'bad' }; k = mini.hand[p].length - 1; }   // the time ran out: the card taken goes
  else { const mm = /^d([0-3])$/.exec(String(m)); if (!mm || !mini.held) return { ok: false, reason: 'bad' }; k = Number(mm[1]); }
  if (k >= mini.hand[p].length) return { ok: false, reason: 'bad' };
  const before = t31Score(mini.hand[p].slice(0, -1)), gone = mini.hand[p][k];   // (before: the hand as it was before the take)
  mini.hand[p] = mini.hand[p].filter((_, i) => i !== k);
  mini.hn[p] = mini.hand[p].length;
  mini.seen[p] = mini.seen[p].filter(c => c !== gone);
  mini.pile.push(gone);
  mini.held = null; mini.turns[p] += 1;
  const best = t31Best(mini.hand[p]), target = t31Cfg(mini).target;
  mini.last = Object.assign({ by: p, kind: 'drop', card: gone, k }, m === 'auto' ? { auto: true } : {});   // (public alone: the card thrown and its place; never a score)
  if (best.score === 31) return { ok: true, outcome: 'win', note: 'thirtyone' };
  if (best.score >= target) return { ok: true, outcome: 'win', note: 'target' };
  if (m !== 'auto' && best.score > before && goAgain(mini)) return { ok: true, outcome: 'continue', note: 'up', again: true };   // ("Go again on success" on: a higher score takes again, and says so)
  return { ok: true, outcome: 'continue', note: 'drop' };
}
export function timeoutClose(mini, p) { return mini.held && mini.held.by === p ? 'auto' : null; }
// What the board may show (and the computer for `forSide` may know): the pile, the counts, the cards taken off the pile,
// the take in hand (its card only when it came off the pile), and forSide's own hand alone.
const pubHeld = h => (h ? Object.assign({ by: h.by, from: h.from }, h.from === 'pile' ? { card: h.card } : {}) : null);
const cp2 = o => ({ X: ((o && o.X) || []).slice(), O: ((o && o.O) || []).slice() });
export function publicView(mini, forSide) {
  const v = { type: 't31', v: mini.v, pile: (Array.isArray(mini.pile) ? mini.pile : []).slice(), left: mini.left, hn: Object.assign({}, mini.hn), seen: cp2(mini.seen), held: pubHeld(mini.held), turns: Object.assign({}, mini.turns), last: mini.last ? Object.assign({}, mini.last) : null, hand: {} };
  if (forSide && mini.hand && Array.isArray(mini.hand[forSide])) { v.hand[forSide] = mini.hand[forSide].slice(); if (mini.held && mini.held.by === forSide) v.held.card = mini.held.card; }
  return v;
}
// The server's alone: the deck's order, both hands and the take in hand whole.
export function secret(mini) {
  if (!mini.hand || !Array.isArray(mini.deck)) return null;
  return { deck: mini.deck.slice(), hand: cp2(mini.hand), held: mini.held ? Object.assign({}, mini.held) : null };
}
export function hide(m, k, st) { delete m.deck; if (m.hand) m.hand = {}; m.held = pubHeld(m.held); }
// Each side's own part (games/{id}/sides/{side}: that side alone reads it): its hand, and the card it took from the deck.
export function sidePart(mini, p) {
  if (!mini.hand || !Array.isArray(mini.hand[p])) return null;
  return Object.assign({ hand: mini.hand[p].slice() }, mini.held && mini.held.by === p ? { took: mini.held.card } : {});
}
export function sideMerge(mini, p, part) {
  if (!part || !Array.isArray(part.hand)) return;
  mini.hand = Object.assign({}, mini.hand, { [p]: part.hand.slice() });
  if (part.took && mini.held && mini.held.by === p) mini.held = Object.assign({}, mini.held, { card: part.took });
}
export function randomMove(mini, p, rng, from, empties) {
  const r = needRng(rng);
  if (!mini.held || mini.held.by !== p) return r() < 0.5 && Array.isArray(mini.pile) && mini.pile.length ? 'pile' : 'deck';
  const n = mini.hand && Array.isArray(mini.hand[p]) ? mini.hand[p].length : (mini.hn && mini.hn[p]) || T31.hand + 1;
  return 'd' + Math.floor(r() * n);
}
export function canMove(mini) { return true; }
// A move's flash: public alone (the entry goes to both phones; the mover's hand is in its own side). A square won: the
// winning hand and its score with it (a claimed square's hands are open).
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last, pile = Array.isArray(mini.pile) ? mini.pile : [];
  flash.t31 = Object.assign({}, l, { top: pile.length ? pile[pile.length - 1] : null, under: pile.length > 1 ? pile[pile.length - 2] : null, left: mini.left, hn: Object.assign({}, mini.hn) });
  if (flash.kind === 'claim' && mini.hand && Array.isArray(mini.hand[p])) { const b = t31Best(mini.hand[p]); Object.assign(flash.t31, { won: { hand: mini.hand[p].slice(), score: b.score, suit: b.suit } }); }
}
// The move's moments (ms from it): a take slides the card in (a deck card turning up as it lands); a discard slides the
// card onto the pile and the score counts on as it lands.
export function t31Times(s) {
  if (!s) return { end: T31.hold };
  if (s.kind === 'take') return { land: T31.slide, end: T31.slide + (s.from === 'deck' ? T31.flip : 0) + 150 };
  return { land: T31.slide, end: T31.land + T31.hold };
}
export function flashMs(f, winLen, won) { return t31Times(f.t31).end + (won ? 600 : 0); }
