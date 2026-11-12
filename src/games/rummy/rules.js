// Rummy Lite: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, shuffle } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';
import { CARD, cardDeck } from '../shared/cards.js';

// ---------- Rummy Lite (November 2026; one deck and one pile for both from the rework, v 2) ----------
// Both players draw from one shared deck (hidden: its order on the server alone, secret/hide) and throw onto one shared
// discard pile (open: its cards in order, the top one on show), so a player can take the other's discard. Each holds a
// hand of `hand` (6) cards that is theirs alone: online it rides the per-side channel (games/{id}/sides/{side}: rules.js
// sidePart/sideMerge, core/records.js), never the public state, a move's entry or the other phone; on one phone (the
// computer's match) the view shows the other hand as card backs, and the computer reads only its own (publicView with
// the side). A move is two steps:
//  - Take: the top card of the pile ('pile') or the top of the deck ('deck'); the turn is held to the square for the
//    second step (`again`: the game's own step, as 21's Deal is, not a success). The deck run out: the pile under its top
//    card is shuffled into a new deck (the move's rng: the server's online). A card taken from the pile was on show and
//    stays public (`held.c`); one from the deck is the taker's alone.
//  - Discard: one card of the seven (`{ d: card }`), face up on the pile. The hand is checked then: `melds` (2) melds
//    side by side, each a set (three of a rank) or a run (three in a row in one suit; an ace low, A-2-3, or high, Q-K-A,
//    never round the corner), wins the square. With "Go again on success" on, a discard that leaves the hand with
//    more melds than it had keeps the turn (a new Take). How many melds each hand holds is public (`mc`), never which.
// A timeout between the steps throws the card just taken back on the pile (core/board.js timeoutClose: 'auto').
// Never dealt to two people on one phone (meta.js samePhone: false). A square from before the rework (v 1: a deck and
// pile each) is dealt again as the record is read (`stale`, core/records.js fullState).
// `ranks`: the ranks in the deck, from the ace up (8 by default: the ace to 8, 32 cards; tests/sim/rummy.sim.js).
export const RUMMY = { hand: 6, melds: 2, ranks: 8 };
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
  const r = needRng(rng), c = rmyCfg({ type, tune: tuneLive(type) }), d = shuffle(rmyDeck(c.ranks), r);
  const mini = { type, v: 2, hand: {}, deck: d, pile: [], left: 0, hn: { X: c.hand, O: c.hand }, mc: { X: 0, O: 0 }, held: null, turns: { X: 0, O: 0 }, last: null };
  for (const p of ['X', 'O']) mini.hand[p] = sortHand(d.splice(d.length - c.hand, c.hand));
  for (const p of ['X', 'O']) mini.mc[p] = rmyMelds(mini.hand[p]).n;
  mini.pile = [d.pop()];
  mini.left = d.length;
  return mini;
}
export const stale = mini => (mini.v || 1) < 2;                    // (a square from before the rework: dealt again, core/records.js)
// The top of the deck (the deck out: the pile under its top card shuffled in; nothing left at all: a fresh deck of
// every card not in a hand or on the pile).
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
      mini.deck = shuffle(rmyDeck(rmyCfg(mini).ranks).filter(c => !inPlay.has(c)), needRng(rng));
    }
  }
  const c = mini.deck.pop();
  mini.left = mini.deck.length;
  return { c, reshuf };
}
export function apply(mini, p, m, rng, idx) {
  const cfg = rmyCfg(mini);
  if (!mini.hand || !Array.isArray(mini.hand[p])) return { ok: false, reason: 'secret' };
  if (mini.held && mini.held.by !== p) mini.held = null;           // (a take left by the other player's timeout: gone; its card was put back then)
  if (m === 'pile' || m === 'deck') {
    if (mini.held) return { ok: false, reason: 'taken' };
    const before = rmyMelds(mini.hand[p]).n;
    let c, reshuf = false;
    if (m === 'pile') { c = mini.pile.pop(); if (!c) return { ok: false, reason: 'empty' }; }
    else ({ c, reshuf } = draw(mini, rng));
    mini.hand[p] = sortHand(mini.hand[p].concat(c));
    mini.hn[p] = mini.hand[p].length;
    mini.held = { by: p, from: m, c, before };
    mini.last = Object.assign({ by: p, kind: 'take', from: m, reshuf, left: mini.left }, m === 'pile' ? { c } : {});   // (a deck card: the taker's alone)
    return { ok: true, outcome: 'continue', note: 'take', again: true };
  }
  if (m === 'auto') {                                              // the time ran out between the steps: the card taken goes on the pile
    if (!mini.held) return { ok: false, reason: 'bad' };
    m = { d: mini.held.c };
  }
  if (!mini.held || !m || typeof m !== 'object' || typeof m.d !== 'string') return { ok: false, reason: 'bad' };
  const hand = mini.hand[p], i = hand.indexOf(m.d);
  if (i < 0) return { ok: false, reason: 'bad' };
  const before = mini.held.before;
  hand.splice(i, 1);
  mini.pile.push(m.d);
  mini.held = null;
  mini.turns[p] += 1;
  mini.hn[p] = hand.length;
  const got = rmyMelds(hand);
  mini.mc[p] = got.n;
  mini.last = { by: p, kind: 'discard', d: m.d, n: got.n };
  if (got.n >= cfg.melds) return { ok: true, outcome: 'win', note: 'melds' };
  if (got.n > before && goAgain(mini)) return { ok: true, outcome: 'continue', note: 'meld', again: true };   // ("Go again on success" on: a new meld, take again)
  return { ok: true, outcome: 'continue', note: got.n > before ? 'meld' : 'discard' };
}
export function timeoutClose(mini, p) { return mini.held && mini.held.by === p ? 'auto' : null; }
// What the board may show (and the computer for `forSide` may know): the pile, the counts, the meld counts, the take in
// hand (its card only when it came off the pile), and forSide's own hand alone. A claimed square: both hands (its review).
const pubHeld = h => (h ? Object.assign({ by: h.by, from: h.from }, h.from === 'pile' ? { c: h.c } : {}) : null);
export function publicView(mini, forSide) {
  const v = { type: 'rummy', v: mini.v, pile: (mini.pile || []).slice(), left: mini.left, hn: Object.assign({}, mini.hn), mc: Object.assign({}, mini.mc), held: pubHeld(mini.held), turns: Object.assign({}, mini.turns), last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null, hand: {} };
  if (forSide && mini.hand && mini.hand[forSide]) { v.hand[forSide] = mini.hand[forSide].slice(); if (mini.held && mini.held.by === forSide) v.held.c = mini.held.c; }
  return v;
}
// The server's alone: the deck's order, both hands and the take in hand whole.
export function secret(mini) {
  if (!mini.hand || !Array.isArray(mini.deck)) return null;
  return { deck: mini.deck.slice(), hand: { X: (mini.hand.X || []).slice(), O: (mini.hand.O || []).slice() }, held: mini.held ? Object.assign({}, mini.held) : null };
}
export function hide(m, k, st) { delete m.deck; if (m.hand) m.hand = {}; m.held = pubHeld(m.held); }
// Each side's own part (games/{id}/sides/{side}: that side alone reads it): its hand, and the card it took from the deck.
export function sidePart(mini, p) {
  if (!mini.hand || !Array.isArray(mini.hand[p])) return null;
  return Object.assign({ hand: mini.hand[p].slice() }, mini.held && mini.held.by === p ? { took: mini.held.c } : {});
}
export function sideMerge(mini, p, part) {
  if (!part || !Array.isArray(part.hand)) return;
  mini.hand = Object.assign({}, mini.hand, { [p]: part.hand.slice() });
  if (part.took && mini.held && mini.held.by === p) mini.held = Object.assign({}, mini.held, { c: part.took });
}
export function canMove(mini) { return true; }
export function randomMove(mini, p, rng, from, empties) {        // (the tests' stand-in: a take, then any card)
  const r = needRng(rng);
  if (!mini.held || mini.held.by !== p) return r() < 0.5 && mini.pile.length ? 'pile' : 'deck';
  const h = mini.hand[p]; return { d: h[Math.floor(r() * h.length)] };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.rummy = Object.assign({}, l, { top: mini.pile.slice(-1)[0] || null, left: mini.left, hn: Object.assign({}, mini.hn), mc: Object.assign({}, mini.mc) });   // (public alone: the entry goes to both phones; the mover's hand is in its own side)
}
// The move's moments (ms): a take flies the card from the pile or the deck into the hand (`land`; a deck card of
// one's own then turns up, `flip`; a deck run out is gathered from the pile first, three backs `gap` apart taking
// `fly` each, and the take leaves at `deal`); a discard flies it out onto the pile, and a new meld lights as it
// lands (`light`), held a little longer.
export const RMYT = { slide: 300, flip: 260, light: 420, hold: 450, gap: 60, fly: 220, deal: 180 };
export function rmyTimes(r) {
  if (!r) return { end: RMYT.hold };
  if (r.kind === 'take') { const at = r.reshuf ? RMYT.deal : 0; return { at, land: at + RMYT.slide, end: at + RMYT.slide + (r.from === 'deck' ? RMYT.flip : 0) + 150 }; }
  return { at: 0, land: RMYT.slide, light: RMYT.slide + 40, end: RMYT.slide + (r.n ? RMYT.light : 0) + RMYT.hold };
}
export function flashMs(f, winLen, won) { return rmyTimes(f.rummy).end + (won ? 600 : 0); }
