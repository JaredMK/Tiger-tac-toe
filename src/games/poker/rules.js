// Poker Hands: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { goAgain, tune } from '../../core/tune.js';
import { cardDeck } from '../shared/cards.js';

// ---------- Poker Hands (November 2026) ----------
// Each player keeps their own total of points. A move is two actions on the turn: Deal ('deal': five cards from a
// fresh deck, drawn by the move's rng, the server's online; the turn is held to the square, `again`, as 21's Deal and
// Hit), then Draw once ('draw:MMMMM', a 1 for each card thrown away; all 0s keeps the hand): the thrown cards are
// replaced from the rest of that deck (never a card of the hand dealt), and the hand scores by its rank (the admin's
// points: a pair 1, two pair 2, three of a kind 3, a straight 4, a flush 5, a full house 6, four of a kind 8, a
// straight flush 10; nothing else 0). A pair of any rank counts; an ace is high or low (A-2-3-4-5 is a straight; no
// wrapping round past the ace). The first total at `target` takes the square. With "Go again on success" on
// (AGAIN_TUNE), a hand that scores keeps the turn: a fresh deal. A timeout with a hand dealt (core/board.js
// timeoutClose: 'auto') scores the hand as it was dealt, nothing thrown (as 21 stands on a hand in play).
// Nothing is hidden: the hand rides the public state (it is the mover's own and is shown to both), and the cards
// drawn are drawn only as the draw is made.
export const POK = { deal: 90, dealMs: 260, out: 220, hold: 650 };   // the moments: a card slides in every `deal` ms, each taking dealMs; thrown cards go `out` first
export const HANDS = ['none', 'pair', 'two', 'three', 'straight', 'flush', 'full', 'four', 'sf'];
export const HAND_NAMES = { none: 'Nothing', pair: 'Pair', two: 'Two pair', three: 'Three of a kind', straight: 'Straight', flush: 'Flush', full: 'Full house', four: 'Four of a kind', sf: 'Straight flush' };
export const POK_PTS = { none: 0, pair: 1, two: 2, three: 3, straight: 4, flush: 5, full: 6, four: 8, sf: 10 };   // (the defaults; the square's own from its settings: pokPoints)
export const pokCfg = mini => tune(mini);
export const pokPoints = mini => { const t = tune(mini); return { none: 0, pair: t.pair, two: t.two, three: t.three, straight: t.straight, flush: t.flush, full: t.full, four: t.four, sf: t.sf }; };
const RV = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };
export const rankVal = c => RV[c[0]];
// The rank of five cards (one of HANDS).
export function handRank(cards) {
  const cnt = {}, suits = new Set();
  for (const c of cards) { cnt[c[0]] = (cnt[c[0]] || 0) + 1; suits.add(c[1]); }
  const counts = Object.values(cnt).sort((a, b) => b - a), flush = suits.size === 1 && cards.length === 5;
  let straight = false;
  if (counts.length === 5) {
    const v = cards.map(rankVal).sort((a, b) => a - b);
    straight = v[4] - v[0] === 4 || (v[4] === 14 && v[0] === 2 && v[3] === 5);   // (A-2-3-4-5)
  }
  if (straight && flush) return 'sf';
  if (counts[0] === 4) return 'four';
  if (counts[0] === 3 && counts[1] === 2) return 'full';
  if (flush) return 'flush';
  if (straight) return 'straight';
  if (counts[0] === 3) return 'three';
  if (counts[0] === 2 && counts[1] === 2) return 'two';
  if (counts[0] === 2) return 'pair';
  return 'none';
}
export const handPoints = (mini, cards) => pokPoints(mini)[handRank(cards)];
// The cards a draw comes from: the deck less the five dealt (the thrown ones never come back).
export const pokRest = hand => cardDeck().filter(c => !hand.includes(c));
export function create(type, rng) {
  return { type, v: 1, score: { X: 0, O: 0 }, hands: { X: null, O: null }, cur: null, last: null };   // cur: the hand dealt, waiting for the draw { by, hand }; hands: each player's last scored hand (the miniature)
}
export const MASK = /^draw:[01]{5}$/;
function pick(deck, n, r) {
  const d = deck.slice(), out = [];
  for (let i = 0; i < n; i++) out.push(d.splice(randInt(r, d.length), 1)[0]);
  return out;
}
function settle(mini, p, hand, thrown, drawn) {
  const kind = handRank(hand), pts = pokPoints(mini)[kind], t = tune(mini), from = mini.score[p];
  mini.score[p] = Math.min(t.target, from + pts);
  mini.hands[p] = hand.slice();
  mini.cur = null;
  mini.last = { by: p, kind: 'draw', hand: hand.slice(), thrown, drawn, rank: kind, pts, from, to: mini.score[p] };
  if (mini.score[p] >= t.target) return { ok: true, outcome: 'win', note: kind };
  if (pts > 0 && goAgain(mini)) return { ok: true, outcome: 'continue', note: kind, again: true };   // ("Go again on success" on: a scoring hand deals again)
  return { ok: true, outcome: 'continue', note: kind };
}
export function apply(mini, p, m, rng, idx) {
  if (mini.cur && mini.cur.by !== p) mini.cur = null;                // (a hand left by a timeout: the other side's move starts afresh)
  if (m === 'deal') {
    if (mini.cur) return { ok: false, reason: 'bad' };
    const hand = pick(cardDeck(), 5, needRng(rng));
    mini.cur = { by: p, hand };
    mini.last = { by: p, kind: 'deal', hand: hand.slice() };
    return { ok: true, outcome: 'continue', note: 'deal', again: true };
  }
  if (m === 'auto') {                                                // the time ran out with a hand dealt: it scores as it is
    if (!mini.cur) return { ok: true, outcome: 'continue', note: 'none' };
    return settle(mini, p, mini.cur.hand.slice(), [0, 0, 0, 0, 0], []);
  }
  if (typeof m === 'string' && MASK.test(m)) {
    if (!mini.cur) return { ok: false, reason: 'bad' };
    const thrown = m.slice(5).split('').map(Number), n = thrown.reduce((a, b) => a + b, 0);
    const drawn = pick(pokRest(mini.cur.hand), n, needRng(rng)), hand = mini.cur.hand.slice();
    let k = 0;
    thrown.forEach((t, i) => { if (t) hand[i] = drawn[k++]; });
    return settle(mini, p, hand, thrown, drawn);
  }
  return { ok: false, reason: 'bad' };
}
export function publicView(mini) {
  return { type: 'poker', v: mini.v, score: { X: mini.score.X, O: mini.score.O }, hands: { X: mini.hands.X ? mini.hands.X.slice() : null, O: mini.hands.O ? mini.hands.O.slice() : null }, cur: mini.cur ? { by: mini.cur.by, hand: mini.cur.hand.slice() } : null };
}
// A legal move (the tests, the sandbox): deal; then throw a random few.
export function randomMove(mini, p, rng, from, empties) {
  if (!mini.cur || mini.cur.by !== p) return 'deal';
  return 'draw:' + Array.from({ length: 5 }, () => (rng() < 0.4 ? 1 : 0)).join('');
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.poker = Object.assign(JSON.parse(JSON.stringify(mini.last)), { score: { X: mini.score.X, O: mini.score.O } });
}
// The move's moments (ms from the move): a deal slides the five in one after another; a draw sends the thrown
// cards away, slides the new ones in, then shows the hand's name and points (`say`), and holds.
export function pokTimes(f) {
  if (!f) return { say: 0, end: 300 };
  if (f.kind === 'deal') { const land = 4 * POK.deal + POK.dealMs; return { land, say: land, end: land + 150 }; }
  const n = (f.thrown || []).reduce((a, b) => a + b, 0), land = n ? POK.out + (n - 1) * POK.deal + POK.dealMs : 0;
  return { land, say: land + 120, end: land + 120 + POK.hold };
}
// When the k-th card of the hand slides in (a deal: every card; a draw: the thrown ones, in order), or null.
export function pokSlideAt(f, k) {
  if (!f) return null;
  if (f.kind === 'deal') return k * POK.deal;
  if (!f.thrown || !f.thrown[k]) return null;
  const j = f.thrown.slice(0, k).reduce((a, b) => a + b, 0);
  return POK.out + j * POK.deal;
}
export function flashMs(f, winLen, won) { return pokTimes(f.poker).end + (won ? 600 : 0); }
// A timeout with a hand dealt (core/board.js timeoutClose): it scores as dealt ('auto').
export function timeoutClose(mini, p) { return mini.cur && mini.cur.by === p ? 'auto' : null; }
