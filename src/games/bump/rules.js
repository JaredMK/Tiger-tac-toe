// Bump: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { PLAY } from '../../core/timer.js';
import { other } from '../../core/util.js';

// Bump: 9 spaces between Home and the Finish (10); a spin moves 1, 2 or 3.
export const BUMP = { n: 9, max: 3 };
export function create(type, rng) {
  return { type, pos: { X: 0, O: 0 }, last: null };   // 0 is Home, 10 the Finish
}
export function apply(mini, p, m, rng, idx) {
  // One spin of 1, 2 or 3: the piece hops that far. Landing exactly on the other piece sends it
  // back Home. Reaching or passing the Finish wins.
  if (m !== 'spin') return { ok: false, reason: 'bad' };
  const spin = 1 + randInt(needRng(rng), BUMP.max), from = mini.pos[p], fin = BUMP.n + 1, to = Math.min(from + spin, fin), o = other(p);
  const bumped = to < fin && mini.pos[o] === to;
  if (bumped) mini.pos[o] = 0;
  mini.pos[p] = to; mini.last = { by: p, spin, from, to, bumped };
  if (to >= fin) return { ok: true, outcome: 'win' };
  return { ok: true, outcome: 'continue', note: bumped ? 'bump' : 'spin' };
}
export function publicView(mini) {
  return { type: 'bump', pos: { X: mini.pos.X, O: mini.pos.O } };
}
export function randomMove(mini, p, rng, from, empties) {
  return 'spin';
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.spin = mini.last.spin; flash.from = mini.last.from; flash.to = mini.last.to; flash.bumped = mini.last.bumped; return;
}
export function flashMs(f, winLen, won) {
  return PLAY.spin3 + Math.max(1, f.to - f.from) * PLAY.hop + (f.bumped ? PLAY.knock : 0) + 250;
}
// Super Chaos: both pieces move. A piece ending on the other's space sends that one Home (the normal rule,
// when only one of them moved here); both ending on the same space send both Home.
export function scMerge(m, c) {
  if (c.played.length < 2) return;
  const fin = BUMP.n + 1, a = c.forks.X.pos.X, b = c.forks.O.pos.O;
  m.pos = { X: a, O: b };
  if (a === b && a > 0 && a < fin) { m.pos = { X: 0, O: 0 }; m.last = Object.assign({}, m.last, { both: true }); return { note: 'bothHome' }; }
}
