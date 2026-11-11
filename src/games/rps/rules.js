// Rock Paper Scissors: the rules (pure: no page, no clock; the server runs the same code).
import { needRng } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';

// ---------- Rock Paper Scissors (November 2026) ----------
// Each player plays against the house, which throws from a deck of its own for that player: `rocks` rocks, `papers`
// papers and `scissors` scissors (3 of each by default). The counts left are public (the order of the deck is
// nobody's: the house's throw is drawn from what is left, each card as likely, only as the move is made: the server
// online). A move is one throw: the player picks rock, paper or scissors ('r', 'p', 's') and both throws show; rock
// beats scissors, scissors beat paper, paper beats rock. A win scores 1; a loss scores nothing and ends the turn; a
// tie keeps the turn (`again`, note 'tie'): the player picks again, against the deck as it now stands (the turn is one
// move until it is decided). The throw that takes the house's last card turns the deck over: it is full again for
// the next throw (`reshuf`). First to `goal` (4) wins. With "Go again on success" on, a win keeps the turn too.
// A timeout while a tie waits for its re-throw plays nothing (the turn passes, not a miss: timeoutClose).
export const RPS = { kinds: ['r', 'p', 's'], beats: { r: 's', s: 'p', p: 'r' } };
export const RPS_NAME = { r: 'rock', p: 'paper', s: 'scissors' };
export const rpsBeater = k => RPS.kinds.find(t => RPS.beats[t] === k);   // the throw that beats k
export const rpsCfg = mini => Object.assign({ goal: 4, rocks: 5, papers: 5, scissors: 5 }, tune(mini));
export function rpsFull(mini) {                                  // the house's full deck, as the square was dealt
  return rpsDeckOf(rpsCfg(mini));
}
// A deck from the settings; one set to nothing at all is one of each (the house always has a card to throw).
export function rpsDeckOf(c) {
  const d = { r: Math.max(0, c.rocks | 0), p: Math.max(0, c.papers | 0), s: Math.max(0, c.scissors | 0) };
  return d.r + d.p + d.s ? d : { r: 1, p: 1, s: 1 };
}
export const rpsLeft = d => d.r + d.p + d.s;
export function rpsJudge(t, h) { return t === h ? 'tie' : RPS.beats[t] === h ? 'win' : 'lose'; }
export function create(type, rng) {
  const m = { type, score: { X: 0, O: 0 }, deck: null, tie: null, last: null };
  const full = rpsDeckOf(tuneLive(type));                          // (the settings dealt now: the square keeps them, mini.tune)
  m.deck = { X: Object.assign({}, full), O: Object.assign({}, full) };
  return m;
}
// The house's throw from p's deck: each card left as likely.
function draw(deck, rng) {
  const n = rpsLeft(deck);
  let k = Math.floor(rng() * n);
  for (const t of RPS.kinds) { if (k < deck[t]) return t; k -= deck[t]; }
  return RPS.kinds.find(t => deck[t] > 0);
}
export function apply(mini, p, m, rng, idx) {
  if (!RPS.kinds.includes(m)) return { ok: false, reason: 'bad' };
  const r = needRng(rng), deck = mini.deck[p], goal = rpsCfg(mini).goal;
  if (!rpsLeft(deck)) Object.assign(deck, rpsFull(mini));         // (a deck left empty: whole again)
  const h = draw(deck, r), res = rpsJudge(m, h);
  deck[h] -= 1;
  let reshuf = false;
  if (!rpsLeft(deck)) { Object.assign(deck, rpsFull(mini)); reshuf = true; }   // the last card thrown: the house turns its deck over
  if (res === 'win') mini.score[p] = Math.min(goal, mini.score[p] + 1);
  mini.tie = res === 'tie' ? p : null;
  mini.last = { by: p, t: m, h, res, reshuf, deck: Object.assign({}, deck), score: { X: mini.score.X, O: mini.score.O } };
  if (mini.score[p] >= goal) return { ok: true, outcome: 'win', note: 'won' };
  if (res === 'tie') return { ok: true, outcome: 'continue', note: 'tie', again: true };   // a tie: throw again, the same turn
  if (res === 'win' && goAgain(mini)) return { ok: true, outcome: 'continue', note: 'won', again: true };
  return { ok: true, outcome: 'continue', note: res === 'win' ? 'won' : 'lost' };
}
// A timeout while a tie waits for its re-throw: nothing more is thrown (the turn passes, not a miss).
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) {
  return { type: 'rps', score: { X: mini.score.X, O: mini.score.O }, deck: { X: Object.assign({}, mini.deck.X), O: Object.assign({}, mini.deck.O) }, tie: mini.tie || null, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null };
}
export function randomMove(mini, p, rng, from, empties) { return RPS.kinds[Math.floor(needRng(rng)() * 3)]; }
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.rps = { t: l.t, h: l.h, res: l.res, reshuf: l.reshuf, deck: Object.assign({}, l.deck), score: Object.assign({}, l.score) };
}
// The move's moments (ms from the move): both fists shake (`shake`), the throws show (`show`), the verdict (`judge`), the end.
export const RPST = { shake: 720, judge: 260, hold: 520, tie: 380 };
export function rpsTimes(f) {
  const show = RPST.shake, judge = show + RPST.judge;
  return { show, judge, end: judge + (f && f.res === 'tie' ? RPST.tie : RPST.hold) };
}
export function flashMs(f, winLen, won) { return rpsTimes(f.rps).end + (won ? 600 : 0); }
