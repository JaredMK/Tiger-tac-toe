// Rummy Lite: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, shuffle } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';
import { CARD, cardDeck } from '../shared/cards.js';

// ---------- Rummy Lite (November 2026) ----------
// Each player plays alone: their own hand of `hand` (6) cards, their own deck (hidden, its order on the server alone:
// secret/hide) and their own discard pile (open, its top card on show). A move is two steps:
//  - Take: the top card of the pile ('pile') or the top of the deck ('deck'); the turn is held to the square for the
//    second step (`again`: the game's own step, as 21's Deal is, not a success). The deck run out: the pile under its top
//    card is shuffled into a new deck (the move's rng: the server's online).
//  - Discard: one card of the seven (`{ d: card }`), face up on the pile. The hand is checked then: `melds` (2) melds
//    side by side, each a set (three of a rank) or a run (three in a row in one suit; an ace low, A-2-3, or high, Q-K-A,
//    never round the corner), wins the square. With "Go again on success" on, a discard that leaves the hand with
//    more melds than it had keeps the turn (a new Take).
// A timeout between the steps puts the card just taken back on the pile (core/board.js timeoutClose: 'auto').
// Nothing of a player's touches the other's: a player moving alone wins (individual progress). Both hands are open
// (no per-side secret channel online; nothing in one hand matters to the other player).
// `ranks`: the ranks in each player's deck, from the ace up (6 by default: the ace to 6, 24 cards; 13 a full deck, where
// a square takes about 18 turns each).
export const RUMMY = { hand: 6, melds: 2, ranks: 6 };
export const rmyCfg = mini => { const t = tune(mini); return { hand: Math.round(t.hand != null ? t.hand : RUMMY.hand), melds: Math.round(t.melds != null ? t.melds : RUMMY.melds), ranks: Math.round(t.ranks != null ? t.ranks : RUMMY.ranks) }; };
// A card's rank as a number: 2-9, T 10, J 11, Q 12, K 13, A 14 (low in a run: 1).
export const rmyVal = c => '23456789TJQKA'.indexOf(c[0]) + 2;
// The deck of `ranks` ranks: the ace and then 2, 3 ... up (13: the whole deck).
export function rmyDeck(ranks) {
  const keep = new Set(['A', ...'23456789TJQK'].slice(0, Math.max(3, Math.min(13, ranks))));
  return cardDeck().filter(c => keep.has(c[0]));
}
// Are these three cards a meld: a set (one rank) or a run (one suit, three in a row; an ace low or high)?
export function rmyMeld(a, b, c) {
  if (a[0] === b[0] && b[0] === c[0]) return 'set';
  if (a[1] !== b[1] || b[1] !== c[1]) return false;
  const v = [a, b, c].map(rmyVal).sort((x, y) => x - y);
  if (v[1] === v[0] + 1 && v[2] === v[1] + 1) return 'run';
  if (v[2] === 14 && v[0] === 2 && v[1] === 3) return 'run';      // (A-2-3)
  return false;
}
// The most melds side by side in a hand, and which: { n, melds: [[c, c, c] ...] } (a hand of up to 9 cards).
export function rmyMelds(hand) {
  const h = hand.slice(), n = h.length;
  let best = { n: 0, melds: [] };
  const go = (used, got) => {
    if (got.length > best.n) best = { n: got.length, melds: got.map(m => m.slice()) };
    for (let i = 0; i < n; i++) {
      if (used & (1 << i)) continue;
      for (let j = i + 1; j < n; j++) {
        if (used & (1 << j)) continue;
        for (let k = j + 1; k < n; k++) {
          if (used & (1 << k)) continue;
          if (rmyMeld(h[i], h[j], h[k])) { got.push([h[i], h[j], h[k]]); go(used | 1 << i | 1 << j | 1 << k, got); got.pop(); }
        }
      }
      used |= 1 << i;                                              // (the first card left out of every meld from here: no repeats)
    }
  };
  go(0, []);
  return best;
}
export const rmyWins = (hand, need) => rmyMelds(hand).n >= need;
const sortHand = h => h.slice().sort((a, b) => CARD.suits.indexOf(a[1]) - CARD.suits.indexOf(b[1]) || rmyVal(a) - rmyVal(b));
export { sortHand as rmySort };
export function create(type, rng) {
  const r = needRng(rng), c = rmyCfg({ type, tune: tuneLive(type) }), deal = () => shuffle(rmyDeck(c.ranks), r);
  const mini = { type, v: 1, hand: {}, deck: {}, pile: {}, left: {}, held: null, turns: { X: 0, O: 0 }, last: null };
  for (const p of ['X', 'O']) {
    const d = deal();
    mini.hand[p] = sortHand(d.splice(d.length - c.hand, c.hand));
    mini.pile[p] = [d.pop()];
    mini.deck[p] = d; mini.left[p] = d.length;
  }
  return mini;
}
// The top of p's deck (the deck out: the pile under its top card shuffled in).
function draw(mini, p, rng) {
  if (!mini.deck || typeof mini.deck !== 'object') mini.deck = {};
  if (!Array.isArray(mini.deck[p])) mini.deck[p] = [];
  let reshuf = false;
  if (!mini.deck[p].length) {
    const pile = mini.pile[p], top = pile.pop();
    mini.deck[p] = shuffle(pile.splice(0), needRng(rng));
    mini.pile[p] = top ? [top] : [];
    reshuf = true;
    if (!mini.deck[p].length) {                                    // (a deck and pile with nothing left: a fresh deck, all but the cards in play)
      const inPlay = new Set([...mini.hand[p], ...mini.pile[p]]);
      mini.deck[p] = shuffle(rmyDeck(rmyCfg(mini).ranks).filter(c => !inPlay.has(c)), needRng(rng));
    }
  }
  const c = mini.deck[p].pop();
  mini.left[p] = mini.deck[p].length;
  return { c, reshuf };
}
export function apply(mini, p, m, rng, idx) {
  const cfg = rmyCfg(mini);
  if (mini.held && mini.held.by !== p) mini.held = null;           // (a take left by the other player's timeout: gone; its card was put back then)
  if (m === 'pile' || m === 'deck') {
    if (mini.held) return { ok: false, reason: 'taken' };
    const before = rmyMelds(mini.hand[p]).n;
    let c, reshuf = false;
    if (m === 'pile') { c = mini.pile[p].pop(); if (!c) return { ok: false, reason: 'empty' }; }
    else ({ c, reshuf } = draw(mini, p, rng));
    mini.hand[p] = sortHand(mini.hand[p].concat(c));
    mini.held = { by: p, from: m, c, before };
    mini.last = { by: p, kind: 'take', from: m, c, reshuf };
    return { ok: true, outcome: 'continue', note: 'take', again: true };
  }
  if (m === 'auto') {                                              // the time ran out between the steps: the card taken goes back on the pile
    if (!mini.held) return { ok: false, reason: 'bad' };
    m = { d: mini.held.c };
  }
  if (!mini.held || !m || typeof m !== 'object' || typeof m.d !== 'string') return { ok: false, reason: 'bad' };
  const hand = mini.hand[p], i = hand.indexOf(m.d);
  if (i < 0) return { ok: false, reason: 'bad' };
  const before = mini.held.before;
  hand.splice(i, 1);
  mini.pile[p].push(m.d);
  mini.held = null;
  mini.turns[p] += 1;
  const got = rmyMelds(hand);
  mini.last = { by: p, kind: 'discard', d: m.d, melds: got.melds, n: got.n };
  if (got.n >= cfg.melds) return { ok: true, outcome: 'win', note: 'melds' };
  if (got.n > before && goAgain(mini)) return { ok: true, outcome: 'continue', note: 'meld', again: true };   // ("Go again on success" on: a new meld, take again)
  return { ok: true, outcome: 'continue', note: got.n > before ? 'meld' : 'discard' };
}
export function timeoutClose(mini, p) { return mini.held && mini.held.by === p ? 'auto' : null; }
export function publicView(mini) {
  return { type: 'rummy', v: mini.v, hand: { X: mini.hand.X.slice(), O: mini.hand.O.slice() }, pile: { X: mini.pile.X.slice(), O: mini.pile.O.slice() }, left: { X: mini.left.X, O: mini.left.O }, held: mini.held ? Object.assign({}, mini.held) : null, turns: { X: mini.turns.X, O: mini.turns.O } };   // never the decks (only how many are left); the piles are open (every card in them was shown)
}
export function secret(mini) {   // the decks (the order of each)
  return mini.deck ? { deck: { X: (mini.deck.X || []).slice(), O: (mini.deck.O || []).slice() } } : null;
}
export function hide(m, k, st) { delete m.deck; }
export function canMove(mini) { return true; }
export function randomMove(mini, p, rng, from, empties) {        // (the tests' stand-in: a take, then any card)
  const r = needRng(rng);
  if (!mini.held || mini.held.by !== p) return r() < 0.5 && mini.pile[p].length ? 'pile' : 'deck';
  const h = mini.hand[p]; return { d: h[Math.floor(r() * h.length)] };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.rummy = Object.assign({}, l, { hand: mini.hand[p].slice(), top: mini.pile[p].slice(-1)[0] || null, left: mini.left[p] }, l.melds ? { melds: l.melds.map(x => x.slice()) } : {});
}
// The move's moments (ms): a take slides the card from the pile or the deck into the hand; a discard slides it out
// onto the pile, and a meld lights after it.
export const RMYT = { slide: 380, light: 420, hold: 420 };
export function rmyTimes(r) {
  if (!r) return { end: RMYT.hold };
  if (r.kind === 'take') return { end: RMYT.slide + 120 };
  return { light: RMYT.slide, end: RMYT.slide + (r.n ? RMYT.light : 0) + RMYT.hold };
}
export function flashMs(f, winLen, won) { return rmyTimes(f.rummy).end + (won ? 600 : 0); }
