// Rock Paper Scissors: the rules (pure: no page, no clock; the server runs the same code).
import { needRng } from '../../core/random.js';
import { goAgain, tune } from '../../core/tune.js';

// ---------- Rock Paper Scissors (November 2026; December 2026: no house deck) ----------
// Each player plays against the house, which throws rock, paper or scissors at random, each as likely, drawn only as
// the move is made (the server online). A move is one throw: the player picks rock, paper or scissors ('r', 'p', 's')
// and both throws show; rock beats scissors, scissors beat paper, paper beats rock. A win scores 1; a loss scores
// nothing and ends the turn; a tie keeps the turn (`again`, note 'tie'): the player picks again (the turn is one move
// until it is decided). First to `goal` (3) wins. With "Go again on success" on, a win keeps the turn too.
// A timeout while a tie waits for its re-throw plays nothing (the turn passes, not a miss: timeoutClose).
// (A square dealt with the old deck keeps its wins; its deck is ignored and dropped at its next move.)
export const RPS = { kinds: ['r', 'p', 's'], beats: { r: 's', s: 'p', p: 'r' } };
export const RPS_NAME = { r: 'rock', p: 'paper', s: 'scissors' };
export const rpsBeater = k => RPS.kinds.find(t => RPS.beats[t] === k);   // the throw that beats k
export const rpsCfg = mini => Object.assign({ goal: 3 }, tune(mini));
export function rpsJudge(t, h) { return t === h ? 'tie' : RPS.beats[t] === h ? 'win' : 'lose'; }
export function create(type, rng) {
  return { type, score: { X: 0, O: 0 }, tie: null, last: null };
}
export function apply(mini, p, m, rng, idx) {
  if (!RPS.kinds.includes(m)) return { ok: false, reason: 'bad' };
  const r = needRng(rng), goal = rpsCfg(mini).goal;
  if (mini.deck) delete mini.deck;                                // (a square from before: the deck is gone)
  const h = RPS.kinds[Math.min(2, Math.floor(r() * 3))], res = rpsJudge(m, h);
  if (res === 'win') mini.score[p] = Math.min(goal, mini.score[p] + 1);
  mini.tie = res === 'tie' ? p : null;
  mini.last = { by: p, t: m, h, res, score: { X: mini.score.X, O: mini.score.O } };
  if (mini.score[p] >= goal) return { ok: true, outcome: 'win', note: 'won' };
  if (res === 'tie') return { ok: true, outcome: 'continue', note: 'tie', again: true };   // a tie: throw again, the same turn
  if (res === 'win' && goAgain(mini)) return { ok: true, outcome: 'continue', note: 'won', again: true };
  return { ok: true, outcome: 'continue', note: res === 'win' ? 'won' : 'lost' };
}
// A timeout while a tie waits for its re-throw: nothing more is thrown (the turn passes, not a miss).
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) {
  return { type: 'rps', score: { X: mini.score.X, O: mini.score.O }, tie: mini.tie || null, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null };
}
export function randomMove(mini, p, rng, from, empties) { return RPS.kinds[Math.floor(needRng(rng)() * 3)]; }
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.rps = { t: l.t, h: l.h, res: l.res, score: Object.assign({}, l.score) };
}
// The move's moments (ms from the move): both fists shake (`shake`), the throws show (`show`), the verdict (`judge`: the
// winner's hand strikes, landing `strike` later), the end.
export const RPST = { shake: 720, judge: 260, strike: 130, hold: 520, tie: 380 };
export function rpsTimes(f) {
  const show = RPST.shake, judge = show + RPST.judge;
  return { show, judge, end: judge + (f && f.res === 'tie' ? RPST.tie : RPST.hold) };
}
export function flashMs(f, winLen, won) { return rpsTimes(f.rps).end + (won ? 600 : 0); }
