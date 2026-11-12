// War: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, shuffle } from '../../core/random.js';
import { CARD, cardDeck } from '../shared/cards.js';
import { goAgain, tune } from '../../core/tune.js';

// War: each player flips their card against the dealer's; the higher card wins the round for the player (ace
// high; the dealer's higher: the round is lost, nothing gained). A tie goes to war: three cards face down each,
// then both flip again (another tie, another war), and the war's winner takes the round, worth tune(mini).warWorth
// (1 or 2: a war that matters). Each player's rounds won are their own (individual progress, like 21 and Krabs),
// and the first to tune(mini).goal rounds takes the square. A move is one tap of Flip: the whole round, wars and
// all, is drawn where the move is made (the server online: no card is known before it turns), and the page plays
// it back card by card (warPlan). Each player draws from their own shuffled deck (so a Super Chaos round, both
// playing at once, keeps apart: the default per-player merge), kept hidden (secret/hide) until a card turns; the
// war's face-down cards are drawn and never shown. A deck running low (under WAR.low cards) is reshuffled fresh
// before the flip; one that runs out mid-war is refilled.
export const WAR = { goal: 3, warWorth: 2, low: 10, down: 3, maxWars: 12 };
export const WART = { slide: 280, flip: 280, gap: 120, judge: 360, war: 620, down: 140, lead: 160, result: 500, tok: 300, tokLead: 140, tokGap: 170, pip: 400 };   // the playback: a card flies in from its deck (the dealer's a gap after), the two turn together; they clash and the verdict comes a moment after both are up; "War!" held, the down cards one by one, the next pair after a lead; the result held; a won round's token leaves it (tokLead) and flies to its pip (tok; a war's second tokGap later), the pip filling in
export const warRank = c => CARD.ranks.indexOf(c[0]);   // 2 .. A as 0 .. 12 (suits never matter)
export const warWorthOf = (mini, battles) => (battles > 1 ? tune(mini).warWorth : 1);
export function create(type, rng) {
  needRng(rng);
  return { type, wins: { X: 0, O: 0 }, flips: { X: 0, O: 0 }, deck: { X: shuffle(cardDeck(), rng), O: shuffle(cardDeck(), rng) }, last: null };   // deck: hidden (each player's own)
}
// A card off the top of p's deck (a deck gone, or a square from a record without it: a fresh one).
function warDraw(mini, p, rng) {
  if (!mini.deck || typeof mini.deck !== 'object') mini.deck = {};
  if (!Array.isArray(mini.deck[p]) || !mini.deck[p].length) mini.deck[p] = shuffle(cardDeck(), rng);
  return mini.deck[p].pop();
}
// One round for p: battles [{ p, d }] (every one but the last a tie that went to war), the result and what it gains.
export function warRound(mini, p, rng) {
  rng = needRng(rng);
  if (!mini.deck || !Array.isArray(mini.deck[p]) || mini.deck[p].length < WAR.low) { if (!mini.deck || typeof mini.deck !== 'object') mini.deck = {}; mini.deck[p] = shuffle(cardDeck(), rng); }
  const battles = [];
  let result = null;
  for (let k = 0; k <= WAR.maxWars && !result; k++) {
    const pc = warDraw(mini, p, rng), dc = warDraw(mini, p, rng);
    battles.push({ p: pc, d: dc });
    const a = warRank(pc), b = warRank(dc);
    if (a > b) result = 'win';
    else if (a < b) result = 'lose';
    else if (k === WAR.maxWars) result = 'lose';                   // (never reached: a guard)
    else for (let i = 0; i < WAR.down; i++) { warDraw(mini, p, rng); warDraw(mini, p, rng); }   // war: three down each, never shown
  }
  const gain = result === 'win' ? warWorthOf(mini, battles.length) : 0;
  return { battles, result, gain, wars: battles.length - 1 };
}
export function apply(mini, p, m, rng, idx) { return flip(mini, p, m, rng, true); }
export function scApply(mini, p, m, rng) { return flip(mini, p, m, rng, false); }   // Super Chaos: a round's move is one flip, each player's own round against the dealer (their own deck)
// A hot streak (November 2026): a round won, the square not yet taken, keeps the turn: the same player flips again (`again`);
// a round lost ends it. (Super Chaos: one round a round, no streak: scApply.)
function flip(mini, p, m, rng, streak) {
  if (m !== 'flip') return { ok: false, reason: 'bad' };
  const r = warRound(mini, p, rng);
  mini.flips[p] += 1;
  mini.wins[p] = Math.min(tune(mini).goal, mini.wins[p] + r.gain);
  mini.last = { by: p, battles: r.battles.map(b => ({ p: b.p, d: b.d })), result: r.result, gain: r.gain, wars: r.wars };
  if (mini.wins[p] >= tune(mini).goal) return { ok: true, outcome: 'win', note: 'won' };
  if (r.result === 'win' && streak && goAgain(mini)) return { ok: true, outcome: 'continue', note: 'won', again: true };   // a hot streak: flip again
  return { ok: true, outcome: 'continue', note: r.result === 'win' ? 'won' : 'lost' };
}
export function publicView(mini) {
  return { type: 'war', wins: { X: mini.wins.X, O: mini.wins.O }, flips: { X: mini.flips.X, O: mini.flips.O }, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null };   // never the decks (the cards turned are public)
}
export function randomMove(mini, p, rng, from, empties) {
  return 'flip';
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.war = { battles: l.battles.map(b => ({ p: b.p, d: b.d })), result: l.result, gain: l.gain, wars: l.wars, wins: { X: mini.wins.X, O: mini.wins.O } };
  return;
}
export function secret(mini) {   // the decks
  return mini.deck ? { deck: { X: (mini.deck.X || []).slice(), O: (mini.deck.O || []).slice() } } : null;
}
export function hide(m, k, st) {
  delete m.deck; return;
}
// When each card of a round comes in (ms into the move): each battle's two cards fly in from their decks (the
// player's, then the dealer's a gap after) and turn face up together (`pFlip` = `dFlip`); once both are up (`up`) they
// clash, and the verdict comes at `judge` ("War!" on a tie, the result on the last); after a tie, the three down
// cards each side one by one (`downAt`, a card every WART.down), then the next battle. `end`: when the result shows.
// warPips: when each pip a round won fills in (its token landed), ms into the move.
export function warPlan(w) {
  const T = WART, battles = [];
  let t = 0;
  const n = w.battles.length;
  for (let k = 0; k < n; k++) {
    const b = { pAt: t, pFlip: t + T.gap + T.slide, dAt: t + T.gap, dFlip: t + T.gap + T.slide };
    b.up = b.dFlip + T.flip;
    t = b.up + T.judge; b.judge = t;
    if (k < n - 1) { t += T.war; b.downAt = t; t += WAR.down * T.down + T.lead; }
    battles.push(b);
  }
  return { battles, end: t };
}
export const warPips = (end, gain) => Array.from({ length: Math.max(0, gain || 0) }, (_, i) => end + WART.tokLead + i * WART.tokGap + WART.tok);
export function flashMs(f, winLen, won) {
  if (!f.war) return WART.slide + WART.flip + WART.result;
  const end = warPlan(f.war).end, pips = warPips(end, f.war.gain);
  return Math.max(end + WART.result, pips.length ? pips[pips.length - 1] + WART.pip : 0) + (won ? 600 : 0);
}
