// Higher/Lower: the rules (pure: no page, no clock; the server runs the same code).
import { randInt } from '../../core/random.js';

export const HILO = { lo: 1, hi: 20 };
export function create(type, rng) {
  return { type, target: HILO.lo + randInt(rng, HILO.hi - HILO.lo + 1), lo: HILO.lo, hi: HILO.hi, guesses: [] };
}
export function apply(mini, p, m, rng, idx) {
  if (!Number.isInteger(m) || m < mini.lo || m > mini.hi) return { ok: false, reason: 'bad' };
  if (m === mini.target) { mini.guesses.push({ by: p, n: m, res: 'hit' }); return { ok: true, outcome: 'win' }; }
  const res = m < mini.target ? 'higher' : 'lower';
  mini.guesses.push({ by: p, n: m, res });
  if (res === 'higher') mini.lo = m + 1; else mini.hi = m - 1;
  return { ok: true, outcome: 'continue', note: res };
}
export function publicView(mini) {
  return { type: 'hilo', lo: mini.lo, hi: mini.hi, guesses: mini.guesses.map(g => ({ by: g.by, n: g.n, res: g.res })) };
}
export function randomMove(mini, p, rng, from, empties) {
  return mini.lo + randInt(rng, mini.hi - mini.lo + 1);
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.n = m; flash.range = range; return;
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
