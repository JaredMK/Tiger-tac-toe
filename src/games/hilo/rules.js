// Higher/Lower: the rules (pure: no page, no clock; the server runs the same code).
import { randInt } from '../../core/random.js';
import { tuneLive } from '../../core/tune.js';
import { other } from '../../core/util.js';

// 1 to 30, and each player has 5 guesses in a square: a player whose 5th guess misses loses the square to
// the other. (A square from before: 1 to 20, no limit; top and limit say which.)
export const HILO = { lo: 1, hi: 30, limit: 5 };
export const hiloTop = mini => (mini && Number.isInteger(mini.top) ? mini.top : 20);
export const hiloLimit = mini => (mini && Number.isInteger(mini.limit) ? mini.limit : 0);   // 0: no limit
export const hiloUsed = (mini, p) => mini.guesses.filter(g => g.by === p).length;
export const hiloLeft = (mini, p) => (hiloLimit(mini) ? Math.max(0, hiloLimit(mini) - hiloUsed(mini, p)) : Infinity);
export function create(type, rng) {
  const c = tuneLive(type);                                 // (the admin's settings: the top number and the guesses each)
  return { type, target: HILO.lo + randInt(rng, c.hi - HILO.lo + 1), lo: HILO.lo, hi: c.hi, top: c.hi, limit: c.limit, guesses: [] };
}
export function apply(mini, p, m, rng, idx) {
  if (!Number.isInteger(m) || m < mini.lo || m > mini.hi) return { ok: false, reason: 'bad' };
  if (hiloLeft(mini, p) <= 0) return { ok: false, reason: 'out' };
  if (m === mini.target) { mini.guesses.push({ by: p, n: m, res: 'hit' }); return { ok: true, outcome: 'win' }; }
  const res = m < mini.target ? 'higher' : 'lower';
  mini.guesses.push({ by: p, n: m, res });
  if (res === 'higher') mini.lo = m + 1; else mini.hi = m - 1;
  if (hiloLeft(mini, p) <= 0) return { ok: true, outcome: 'win', winner: other(p), note: 'out' };   // the last guess missed: the square goes to the other player
  return { ok: true, outcome: 'continue', note: res };
}
export function publicView(mini) {
  return { type: 'hilo', lo: mini.lo, hi: mini.hi, top: hiloTop(mini), limit: hiloLimit(mini), guesses: mini.guesses.map(g => ({ by: g.by, n: g.n, res: g.res })) };
}
export function randomMove(mini, p, rng, from, empties) {
  return mini.lo + randInt(rng, mini.hi - mini.lo + 1);
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const g = mini.guesses[mini.guesses.length - 1];
  flash.n = m; flash.range = range; flash.res = g ? g.res : null; flash.left = hiloLimit(mini) ? hiloLeft(mini, p) : null; return;
}
export function secret(mini) {
  return { target: mini.target };
}
export function hide(m, k, st) {
  delete m.target; return;
}
export function flashMs(f, winLen, won) {
  return 1100;
}
// Super Chaos: each player gets their own answer during their move; at the round's end both guesses and their
// answers join the shared history (the range narrowed by both).
export function scMerge(m, c) {   // (each player's 5 guesses count their own: a 5th that misses gives the square away, as ever)
  const n = c.base.guesses.length;
  m.guesses = c.base.guesses.concat(...c.played.map(p => c.forks[p].guesses.slice(n)));
  m.lo = Math.max(c.base.lo, ...c.played.map(p => c.forks[p].lo)); m.hi = Math.min(c.base.hi, ...c.played.map(p => c.forks[p].hi));
}
