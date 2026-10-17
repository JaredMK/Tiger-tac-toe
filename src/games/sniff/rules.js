// Sniff: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';

// ---------- Sniff ----------
// A 5x5 field with one buried treasure and one dog, shared. The dog starts at least 3 steps (along the
// grid) from the treasure. A move walks it one step north, south, east or west: "Hotter" when that step
// brought it closer to the treasure, "Colder" when further (a step along the grid always changes the
// distance by one, so it is always one or the other). Nothing of the past stays on the board: the step's
// paw prints and its "Hotter" or "Colder" show while it plays, then they are gone. The square keeps only
// the last 3 steps (who made each, and which it was), for the computer, which remembers that much.
// Whoever walks the dog onto the treasure wins the square. Online the server keeps the treasure.
export const SNIFF = { n: 5, minStart: 3, step: 420, hold: 1900, memory: 3 };
export const SNIFF_DIRS = { N: [-1, 0], S: [1, 0], W: [0, -1], E: [0, 1] };
export const sniffDist = (a, b) => Math.abs(Math.floor(a / SNIFF.n) - Math.floor(b / SNIFF.n)) + Math.abs((a % SNIFF.n) - (b % SNIFF.n));
export function sniffStep(cell, dir) {
  const d = SNIFF_DIRS[dir]; if (!d) return null;
  const r = Math.floor(cell / SNIFF.n) + d[0], c = (cell % SNIFF.n) + d[1];
  return r < 0 || c < 0 || r >= SNIFF.n || c >= SNIFF.n ? null : r * SNIFF.n + c;
}
export const sniffDirs = cell => Object.keys(SNIFF_DIRS).filter(d => sniffStep(cell, d) != null);
// Where the treasure may still be, from what is remembered (the last few steps): never where the dog has
// stood in them, nor where it stands, and every one of those steps' hotter or colder true of it.
export function sniffCands(pm) {
  const been = new Set([pm.dog].concat(...(pm.trail || []).map(s => [s.f, s.t])));
  const out = [];
  for (let c = 0; c < SNIFF.n * SNIFF.n; c++) {
    if (been.has(c)) continue;
    if ((pm.trail || []).every(s => (sniffDist(s.t, c) < sniffDist(s.f, c)) === !!s.hot)) out.push(c);
  }
  return out;
}
// The computer: onto a cell the treasure may be in, next to the dog, if there is one; else the step that
// brings the dog closest, on average, to the cells it may still be in.
export function sniffPick(pm, rng) {
  const cands = sniffCands(pm), dirs = sniffDirs(pm.dog), set = new Set(cands);
  const on = dirs.filter(d => set.has(sniffStep(pm.dog, d)));
  if (on.length) return { move: on[randInt(rng, on.length)], q: 1 / Math.max(1, cands.length) };
  let best = [], top = Infinity;
  for (const d of dirs) {
    const to = sniffStep(pm.dog, d), avg = cands.length ? cands.reduce((s, c) => s + sniffDist(to, c), 0) / cands.length : 0;
    if (avg < top - 1e-9) { top = avg; best = [d]; } else if (Math.abs(avg - top) < 1e-9) best.push(d);
  }
  return { move: best[randInt(rng, best.length)], q: 0 };
}
export function create(type, rng) {   // the treasure (hidden online), and the dog at least 3 steps from it
  const r = needRng(rng), treasure = randInt(r, SNIFF.n * SNIFF.n), far = Array.from({ length: SNIFF.n * SNIFF.n }, (_, c) => c).filter(c => sniffDist(c, treasure) >= SNIFF.minStart);
  const dog = far[randInt(r, far.length)];
  return { type, treasure, dog, start: dog, trail: [], last: null };
}
export function apply(mini, p, m, rng, idx) {   // the dog one step: hotter or colder; onto the treasure: found
  const to = typeof m === 'string' ? sniffStep(mini.dog, m) : null;
  if (to == null) return { ok: false, reason: 'bad' };
  if (!Number.isInteger(mini.treasure)) return { ok: false, reason: 'secret' };
  const from = mini.dog, hot = sniffDist(to, mini.treasure) < sniffDist(from, mini.treasure), found = to === mini.treasure;
  mini.dog = to; mini.trail = (mini.trail || []).concat({ f: from, t: to, by: p, hot: hot ? 1 : 0 }).slice(-SNIFF.memory);   // (the last few steps only: the computer's memory)
  mini.last = { by: p, f: from, t: to, hot, found };
  if (found) return { ok: true, outcome: 'win', note: 'found' };
  return { ok: true, outcome: 'continue', note: hot ? 'hot' : 'cold' };
}
export function publicView(mini) {
  return { type: 'sniff', dog: mini.dog, start: mini.start, trail: (mini.trail || []).slice(-SNIFF.memory).map(t => Object.assign({}, t)) };   // never the treasure; the last few steps
}
export function randomMove(mini, p, rng, from, empties) {
  return from(sniffDirs(mini.dog));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.sniff = { f: l.f, t: l.t, hot: l.hot, found: l.found }; return;
}
export function secret(mini) {
  return { treasure: mini.treasure };
}
export function hide(m, k, st) {
  delete m.treasure; return;
}
export function flashMs(f, winLen, won) {
  return SNIFF.step + SNIFF.hold + (won ? 900 : 0);
}
