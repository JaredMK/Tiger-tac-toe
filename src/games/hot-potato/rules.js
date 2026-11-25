// Hot Potato: the rules (pure: no page, no clock; the server runs the same code).
// One bomb, nobody holding it at the start. The first player to play this square tosses it to the other player, who
// now holds it. From then on only the holder can play here, and playing here tosses the bomb back (`toss`). The square
// is never won by a move: from the first toss on, after EVERY turn on the main board (any square: the toss turn, a
// turn played elsewhere, a turn passed or missed), the bomb ticks and rolls to explode (boardTick, called by
// core/board.js tickBombs with the move's rng: the server's online). An explosion loses the square for whoever holds
// it then: the other player wins it. No tick once the square is decided or the board is won.
// Tick n (1 the toss turn's) explodes with start% while n <= grace, else
//   min(cap, start + inc * (floor((n - grace - 1) / every) + 1)).
// (start 10, grace 5, inc 1, every 2: ticks 1-5 10%, 6-7 11%, 8-9 12% ...)
import { needRng } from '../../core/random.js';
import { tune } from '../../core/tune.js';

export const HP_DEFAULTS = { start: 10, grace: 5, inc: 1, every: 2, cap: 100 };
// Its moments (ms, base time): a toss's flight from one side to the other; on the board, a tick's wobble and the
// explosion's burst after it.
export const HPT = { toss: 620, hold: 380, tick: 520, boom: 760 };
const other = p => (p === 'X' ? 'O' : 'X');
export function hpCfg(mini) {
  const t = tune(mini), n = (k, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+t[k]) ? +t[k] : HP_DEFAULTS[k]));
  return { start: n('start', 0, 100), grace: Math.round(n('grace', 0, 99)), inc: n('inc', 0, 100), every: Math.round(n('every', 1, 99)), cap: n('cap', 0, 100) };
}
// Tick n's chance to explode, in percent.
export function hpChance(n, c) {
  if (n <= c.grace) return Math.min(c.cap, c.start);
  return Math.min(c.cap, c.start + c.inc * (Math.floor((n - c.grace - 1) / c.every) + 1));
}
export function create(type) { return { type, v: 1, holder: null, n: 0, tosses: { X: 0, O: 0 }, last: null, tick: null, boom: null }; }
// Only the holder plays here (anyone before the first toss): core/minis.js canMove.
export const canMove = (mini, p) => !mini.boom && (mini.holder == null || mini.holder === p);
export function apply(mini, p, m) {
  if (m !== 'toss') return { ok: false, reason: 'bad' };
  if (mini.boom) return { ok: false, reason: 'over' };
  if (mini.holder != null && mini.holder !== p) return { ok: false, reason: 'not-holder' };
  const to = other(p), first = mini.holder == null;
  mini.holder = to; mini.tosses[p] += 1;
  mini.last = { by: p, to, first, n: mini.n };
  return { ok: true, outcome: 'continue', note: first ? 'first' : 'toss' };
}
// After a turn on the main board: the bomb ticks and rolls (nothing before the first toss or once it has gone off).
// Returns the winner when it explodes (the holder loses the square), else null.
export function boardTick(mini, rng) {
  if (mini.holder == null || mini.boom) return null;
  const n = mini.n + 1, pct = hpChance(n, hpCfg(mini)), roll = needRng(rng)();
  const boom = roll * 100 < pct, holder = mini.holder;
  mini.n = n;
  mini.tick = { n, pct, roll: Math.round(roll * 1e4) / 1e4, holder, boom };
  if (!boom) return null;
  mini.boom = { n, holder, winner: other(holder) };
  return other(holder);
}
export function timeoutClose() { return null; }   // (a toss is one tap: nothing under way to close)
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
export function randomMove(mini, p) { return canMove(mini, p) ? 'toss' : null; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.hp = { by: p, to: mini.holder, first: !!(mini.last && mini.last.first) }; }
export function flashMs() { return HPT.toss + HPT.hold; }
