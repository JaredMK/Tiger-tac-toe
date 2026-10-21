// Candy Race: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { PLAY } from '../../core/timer.js';
import { tuneLive } from '../../core/tune.js';

export const CANDY = { len: 12, colors: ['red', 'yellow', 'green', 'blue'], gap: 3 };   // same colour at least 3 spaces apart
// Candy race track: 12 random colours where any three consecutive spaces differ, so the same colour
// is never closer than 3 spaces to itself (or gap: the admin's setting).
export function candyTrack(rng, gap = CANDY.gap) {
  const track = [];
  for (let i = 0; i < CANDY.len; i++) {
    const recent = track.slice(Math.max(0, i - (gap - 1)), i);
    const options = CANDY.colors.filter(c => !recent.includes(c));
    track.push(options[randInt(rng, options.length)]);
  }
  return track;
}
export function create(type, rng) {
  return { type, track: candyTrack(rng, tuneLive(type).gap), pos: { X: -1, O: -1 }, last: null };
}
export function apply(mini, p, m, rng, idx) {
  const color = CANDY.colors[randInt(needRng(rng), CANDY.colors.length)];
  const from = mini.pos[p];
  let to = CANDY.len;                                    // the finish, unless a space of that colour is ahead
  for (let i = from + 1; i < CANDY.len; i++) if (mini.track[i] === color) { to = i; break; }
  mini.pos[p] = to; mini.last = { by: p, color, from, to };
  if (to === CANDY.len) return { ok: true, outcome: 'win' };
  return { ok: true, outcome: 'continue', note: 'spin' };
}
export function publicView(mini) {
  return { type: 'candy', track: mini.track.slice(), pos: { X: mini.pos.X, O: mini.pos.O } };
}
// Candy race: expected spins to the finish from each position (index = position + 1, the start being -1).
export function candyExpected(track) {
  const E = new Array(CANDY.len + 2).fill(0);
  for (let pos = CANDY.len - 1; pos >= -1; pos--) {
    let sum = 0;
    for (const color of CANDY.colors) {
      let to = CANDY.len;
      for (let i = pos + 1; i < CANDY.len; i++) if (track[i] === color) { to = i; break; }
      sum += E[to + 1];
    }
    E[pos + 1] = 1 + sum / CANDY.colors.length;
  }
  return E;
}
export function randomMove(mini, p, rng, from, empties) {
  return 1;
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.color = mini.last.color; flash.from = mini.last.from; flash.to = mini.last.to; return;
}
export function flashMs(f, winLen, won) {
  return PLAY.spin + Math.max(1, f.to - f.from) * PLAY.hop + 250;
}
