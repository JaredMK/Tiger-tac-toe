// Blackjack: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, shuffle } from '../../core/random.js';
import { cardDeck } from '../shared/cards.js';

// Blackjack: each player plays their own hands against the dealer, hitting or standing; every win adds 1
// to their tally (a natural blackjack too), and the first to 3 takes the square. Every hand is dealt from
// a freshly shuffled 52-card deck; the dealer's hole card and the deck stay hidden (online, with the
// server) until the dealer plays. The dealer hits on 16 or less and stands on every 17, soft ones too.
export const BJ = { goal: 3, dealerStand: 17 };
export function bjValue(c) { return c[0] === 'A' ? 1 : 'TJQK'.includes(c[0]) ? 10 : Number(c[0]); }
// A hand's best total: aces count 11 where that does not go over 21 (soft), otherwise 1.
export function bjTotal(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { t += bjValue(c); if (c[0] === 'A') aces++; }
  const soft = aces > 0 && t + 10 <= 21;
  return { total: soft ? t + 10 : t, soft };
}
export const bjNatural = cards => cards.length === 2 && bjTotal(cards).total === 21;
// The dealer turns the hole card over and draws to 17 or more.
export function bjDealerPlay(dealer, deck) {
  const out = dealer.slice();
  while (bjTotal(out).total < BJ.dealerStand && deck.length) out.push(deck.pop());
  return out;
}
// How a finished hand ends: 'bj' (a natural), 'win', 'push', 'lose' or 'bust', and what it adds to the tally.
export function bjOutcome(player, dealer, doubled, natural) {   // (doubled: from before; a win counts 1 whatever)
  const p = bjTotal(player).total, d = bjTotal(dealer).total, dn = bjNatural(dealer);
  if (natural) return dn ? { res: 'push', gain: 0 } : { res: 'bj', gain: 1 };
  if (p > 21) return { res: 'bust', gain: 0 };
  if (dn) return { res: 'lose', gain: 0, dealerBj: true };          // a dealer blackjack beats any other 21
  if (d > 21 || p > d) return { res: 'win', gain: 1 };
  return p === d ? { res: 'push', gain: 0 } : { res: 'lose', gain: 0 };
}
// Basic strategy for a hand of `cards` against the dealer's up card, for a dealer who stands on soft 17,
// with no splitting and no doubling: 'hit' or 'stand'.
export function bjStrategy(cards, up) {
  const { total, soft } = bjTotal(cards), u = bjValue(up) === 1 ? 11 : bjValue(up);
  if (soft) return total >= 19 ? 'stand' : total === 18 ? (u <= 8 ? 'stand' : 'hit') : 'hit';
  if (total >= 17) return 'stand';
  if (total >= 13) return u <= 6 ? 'stand' : 'hit';
  if (total === 12) return u >= 4 && u <= 6 ? 'stand' : 'hit';
  return 'hit';
}
export function create(type, rng) {
  return { type, wins: { X: 0, O: 0 }, hand: null, hole: null, deck: null, last: null };   // hand: the hand being played; hole and deck: hidden
}
export function apply(mini, p, m, rng, idx) {
  // A turn is played hand by hand: Deal (or Stand, which deals first), then Hit (again) or Stand.
  // A win or a loss ends the turn. A push does not: a new hand is dealt at once, from a reshuffled
  // deck, and the same player plays on. 'auto' (a timed-out turn) stands, dealing first if need be, and
  // stands again on every new hand a push brings, until a hand is won or lost. Only the hand's own
  // player can act in it until the turn is over.
  if (!['deal', 'hit', 'stand', 'auto'].includes(m)) return { ok: false, reason: 'bad' };
  let h = mini.hand;
  if (h && h.by !== p) return { ok: false, reason: 'busy' };
  if (m === 'deal' && h) return { ok: false, reason: 'dealt' };
  if (m === 'hit' && !h) return { ok: false, reason: 'nohand' };
  mini.pushed = null;                                // the hands this move ended in a push (shown before the new deal)
  const deal = () => {                               // player, dealer up, player, dealer face down; true for a natural
    const deck = shuffle(cardDeck(), needRng(rng));
    const c1 = deck.pop(), up = deck.pop(), c2 = deck.pop(), hole = deck.pop();
    h = mini.hand = { by: p, cards: [c1, c2], up };
    mini.hole = hole; mini.deck = deck;
    return bjNatural(h.cards);
  };
  const settle = (natural) => {                      // the hand is over: the hole card turns, the dealer plays
    const hole = mini.hole, deck = mini.deck || [], hand = mini.hand;
    const bust = bjTotal(hand.cards).total > 21;
    const dealer = natural || bust ? [hand.up, hole] : bjDealerPlay([hand.up, hole], deck);
    const o = bjOutcome(hand.cards, dealer, hand.doubled, natural);
    mini.last = { by: p, cards: hand.cards.slice(), dealer, res: o.res, gain: o.gain, dealerBj: !!o.dealerBj, natural: !!natural };
    mini.hand = null; mini.hole = null; mini.deck = null;
    if (o.res === 'push') mini.pushed = (mini.pushed || []).concat([mini.last]);
    else mini.wins[p] += o.gain;
    return o.res;
  };
  let res = null;
  if (!h) {
    if (deal()) res = settle(true);                  // a natural: settled at once
    else if (m === 'deal') return { ok: true, outcome: 'continue', note: 'deal', again: true };
  } else if (m === 'hit') {
    h.cards.push(mini.deck.pop());
    if (bjTotal(h.cards).total < 21) return { ok: true, outcome: 'continue', note: 'hit', again: true };
  }
  if (!res) res = settle(false);                     // stand, 21, or a bust
  for (let guard = 0; res === 'push' && guard < 60; guard++) {   // a push: deal again, the turn goes on
    if (deal()) { res = settle(true); continue; }
    if (m !== 'auto') return { ok: true, outcome: 'continue', note: 'push', again: true };
    res = settle(false);
  }
  if (mini.wins[p] >= BJ.goal) return { ok: true, outcome: 'win', note: res };
  return { ok: true, outcome: 'continue', note: res };
}
export function publicView(mini) {
  return { type: 'bj', wins: { X: mini.wins.X, O: mini.wins.O }, hand: mini.hand ? { by: mini.hand.by, cards: mini.hand.cards.slice(), up: mini.hand.up } : null };   // never the hole card or the deck
}
export function randomMove(mini, p, rng, from, empties) {
  return !mini.hand ? 'deal' : from(['hit', 'stand']);
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {   // what the table shows after the move: never the hole card while a hand goes on
  const h = mini.hand, l = mini.last, wins = { X: mini.wins.X, O: mini.wins.O };
  const inPlay = () => ({ cards: h.cards.slice(), dealer: [h.up], hole: true });
  const over = r => ({ cards: r.cards.slice(), dealer: r.dealer.slice(), hole: false, res: r.res, gain: r.gain, natural: !!r.natural, dealerBj: !!r.dealerBj });
  const pushed = mini.pushed || [];
  if (pushed.length) {                        // the hand played pushed: it shows, then the new hand is dealt (in play, or a natural settled)
    flash.bj = Object.assign({ act: m, from: bjFrom, wins, pushes: pushed.length }, over(pushed[0]), { next: h ? inPlay() : over(l) });
  } else flash.bj = Object.assign({ act: m, from: bjFrom, wins }, h ? inPlay() : over(l));
  return;
}
export function secret(mini) {
  return mini.hand && mini.hole ? { hole: mini.hole, deck: (mini.deck || []).slice() } : null;   // only while a hand is being played
}
export function hide(m, k, st) {
  delete m.hole; delete m.deck; return;
}
export function flashMs(f, winLen, won) {
  return bjMs(f.bj) + (won ? 600 : 0);
}
// Blackjack: each card dealt slides in and turns over; at the end of a hand the hole card turns, the dealer
// draws card by card, and the result shows. Ride the Bus: the guess shows (the chosen answer lights up,
// when it is someone else's: the computer's, the other phone's, or a timed-out one), the card slides off
// the deck and turns over, the tick or cross shows, and only then, if right, the card moves into its slot.
// (The phone that made the guess skips the first part: BUST.pre is counted here for the turn clock.)
// Roulette: the wheel spins, the ball settles in its pocket, and the hit or miss holds a second more.
export const BJT = { card: 260, flip: 300, reveal: 520, draw: 520, result: 500, pushHold: 700 };
// When each card of a Blackjack move comes in (ms into the move): the deal (player, dealer, player, then
// the dealer's card face down), a card drawn, then at the end of a hand the hole card turning over and the
// dealer's draws; the result shows at `end`. After a push (b.next): the push shows, the cards clear at
// `swap`, and the new hand is dealt (NP, ND), settled at once if it is a natural (`nEnd`).
export function bjPlan(b) {
  const T = BJT, P = [], D = [];
  let t = 0;
  const dealAt = (P, D, t0) => {
    P[0] = { slideAt: t0, flipAt: t0 + T.card }; D[0] = { slideAt: t0 + T.card, flipAt: t0 + 2 * T.card };
    P[1] = { slideAt: t0 + 2 * T.card, flipAt: t0 + 3 * T.card }; D[1] = { slideAt: t0 + 3 * T.card, flipAt: null };
    return t0 + 4 * T.card + T.flip;
  };
  const dealerPlays = (hand, D, t0) => {
    D[1] = Object.assign({}, D[1], { flipAt: t0 }); t0 += T.reveal;
    for (let k = 2; k < hand.dealer.length; k++) { D[k] = { slideAt: t0, flipAt: t0 + T.card }; t0 += T.draw; }
    return t0;
  };
  if (!b.from) t = dealAt(P, D, 0);
  else for (let k = b.from; k < b.cards.length; k++) { P[k] = { slideAt: t, flipAt: t + T.card }; t += T.card + T.flip; }
  const plan = { P, D, pEnd: t, end: t };
  if (b.res) plan.end = t = dealerPlays(b, D, t);
  if (b.next) {
    t += T.result + T.pushHold;
    plan.swap = t;
    plan.NP = []; plan.ND = [];
    plan.nPEnd = plan.nEnd = t = dealAt(plan.NP, plan.ND, t);
    if (b.next.res) plan.nEnd = dealerPlays(b.next, plan.ND, t);
  }
  return plan;
}
export function bjMs(b) {
  if (!b) return 800;
  const pl = bjPlan(b);
  if (b.next) return pl.nEnd + (b.next.res ? BJT.result : 0);
  return pl.end + (b.res ? BJT.result : 0);
}
