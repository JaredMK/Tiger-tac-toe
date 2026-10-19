// Bump: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { PLAY } from '../../core/timer.js';
import { other } from '../../core/util.js';

// Bump: 9 spaces between Home and the Finish (10); a spin moves 1, 2 or 3.
export const BUMP = { n: 9, max: 3 };
export const BUMP_KNOCK = { lead: 450, hold: 900 };   // Super Chaos's round end: a moment on both pieces where they landed, the knock, then held
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
  if (f.scr) return BUMP_KNOCK.lead + PLAY.knock + BUMP_KNOCK.hold;   // Super Chaos's round end: the knock (or both pieces) back Home
  return PLAY.spin3 + Math.max(1, f.to - f.from) * PLAY.hop + (f.bumped ? PLAY.knock : 0) + 250;
}
// Super Chaos: a spin moves only the spinner's own piece during the round (it may land on the other piece's
// space: nothing is knocked yet, the other may be moving too). The knocks are settled when the round ends,
// with both moves known: a piece ending on the other's space sends that one Home (only one of them moved
// here), both ending on the same space send both Home. The recap plays the knock (resolve).
export function scApply(mini, p, m, rng) {
  if (m !== 'spin') return { ok: false, reason: 'bad' };
  const spin = 1 + randInt(needRng(rng), BUMP.max), from = mini.pos[p], fin = BUMP.n + 1, to = Math.min(from + spin, fin);
  mini.pos[p] = to; mini.last = { by: p, spin, from, to, bumped: false };
  if (to >= fin) return { ok: true, outcome: 'win' };
  return { ok: true, outcome: 'continue', note: 'spin' };
}
export function scMerge(m, c) {
  const fin = BUMP.n + 1, pos = { X: m.pos.X, O: m.pos.O };
  for (const p of c.played) pos[p] = c.forks[p].pos[p];
  m.pos = { X: pos.X, O: pos.O };
  const met = pos.X === pos.O && pos.X > 0 && pos.X < fin;
  if (!met) return;
  const knocked = c.played.length === 2 ? ['X', 'O'] : [other(c.played[0])];
  const pre = JSON.parse(JSON.stringify(m));
  for (const k of knocked) m.pos[k] = 0;
  const by = knocked.length === 2 ? c.me : other(knocked[0]);
  m.last = Object.assign({}, m.last, { by, bumped: true, knocked, both: knocked.length === 2 });
  return { resolve: { pre, flash: { by, scr: { knocked, at: { X: pos.X, O: pos.O } } } } };
}
