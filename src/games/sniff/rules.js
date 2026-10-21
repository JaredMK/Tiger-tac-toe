// Sniff: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

// ---------- Sniff ----------
// A 5x5 field with one buried treasure and one dog, shared. The dog starts at least 3 steps from the treasure
// (2 when the treasure is in the very middle, where nothing is further). A move walks it one step, any of the 8 ways (diagonals too): "Hotter" when that
// step brought it closer to the treasure in a straight line, "Colder" when further, "Same" when the straight-
// line distance did not change. Nothing of the past stays on the board: the step's line and its word
// show while it plays, then they are gone. The square keeps only the last 3 steps (who made each, and which it
// was), for the computer, which remembers that much. Whoever walks the dog onto the treasure wins the square.
// Online the server keeps the treasure.
export const SNIFF = { n: 5, minStart: 3, step: 420, hold: 1900, memory: 3 };   // (minStart, hold, memory: the defaults of its settings, TUNE in meta.js)
const sniffMem = mini => tune(mini).memory || SNIFF.memory;           // the steps a square keeps: its own setting
export const SNIFF_DIRS = { N: [-1, 0], NE: [-1, 1], E: [0, 1], SE: [1, 1], S: [1, 0], SW: [1, -1], W: [0, -1], NW: [-1, -1] };
// The straight-line distance squared (whole numbers, so "Same" is exact), the distance, and the steps a walk needs.
export const sniffD2 = (a, b) => { const dr = Math.floor(a / SNIFF.n) - Math.floor(b / SNIFF.n), dc = (a % SNIFF.n) - (b % SNIFF.n); return dr * dr + dc * dc; };
export const sniffDist = (a, b) => Math.sqrt(sniffD2(a, b));
export const sniffSteps = (a, b) => Math.max(Math.abs(Math.floor(a / SNIFF.n) - Math.floor(b / SNIFF.n)), Math.abs((a % SNIFF.n) - (b % SNIFF.n)));
// A step from f to t, for a treasure at c: 'hot' (closer), 'cold' (further) or 'same'.
export const sniffRes = (f, t, c) => { const a = sniffD2(t, c), b = sniffD2(f, c); return a < b ? 'hot' : a > b ? 'cold' : 'same'; };
const stepRes = s => s.r || (s.hot ? 'hot' : 'cold');                 // (a step remembered from before "Same": hotter or colder)
export function sniffStep(cell, dir) {
  const d = SNIFF_DIRS[dir]; if (!d) return null;
  const r = Math.floor(cell / SNIFF.n) + d[0], c = (cell % SNIFF.n) + d[1];
  return r < 0 || c < 0 || r >= SNIFF.n || c >= SNIFF.n ? null : r * SNIFF.n + c;
}
export const sniffDirs = cell => Object.keys(SNIFF_DIRS).filter(d => sniffStep(cell, d) != null);
// Where the treasure may still be, from what is remembered (the last few steps): never where the dog has
// stood in them, nor where it stands, and every one of those steps' hotter, colder or same true of it.
export function sniffCands(pm) {   // (pm.not: cells it cannot be in besides: Super Chaos's middle and both dogs' paths)
  const been = new Set([pm.dog].concat(...(pm.trail || []).map(s => [s.f, s.t]), pm.not || []));
  const out = [];
  for (let c = 0; c < SNIFF.n * SNIFF.n; c++) {
    if (been.has(c)) continue;
    if ((pm.trail || []).every(s => sniffRes(s.f, s.t, c) === stepRes(s))) out.push(c);
  }
  return out;
}
// The computer: onto a cell the treasure may be in, next to the dog, if there is one; else the step that
// brings the dog closest, on average, to the cells it may still be in.
export function sniffPick(pm, rng) {
  const cands = sniffCands(pm), dirs = sniffDirs(pm.dog), set = new Set(cands);
  const on = dirs.filter(d => set.has(sniffStep(pm.dog, d)));
  if (on.length) return { move: on[randInt(rng, on.length)], q: on.length / Math.max(1, cands.length) };
  let best = [], top = Infinity;
  for (const d of dirs) {
    const to = sniffStep(pm.dog, d), avg = cands.length ? cands.reduce((s, c) => s + sniffDist(to, c), 0) / cands.length : 0;
    if (avg < top - 1e-9) { top = avg; best = [d]; } else if (Math.abs(avg - top) < 1e-9) best.push(d);
  }
  return { move: best[randInt(rng, best.length)], q: 0 };
}
export function create(type, rng) {   // the treasure (hidden online), and the dog at least 3 steps from it
  const r = needRng(rng), treasure = randInt(r, SNIFF.n * SNIFF.n), cells = Array.from({ length: SNIFF.n * SNIFF.n }, (_, c) => c);
  const most = Math.min(tuneLive(type).minStart, Math.max(...cells.map(c => sniffSteps(c, treasure)))), far = cells.filter(c => sniffSteps(c, treasure) >= most);   // (a treasure in the middle: every cell is within 2 steps, so 2)
  const dog = far[randInt(r, far.length)];
  return { type, treasure, dog, start: dog, trail: [], last: null };
}
export function apply(mini, p, m, rng, idx) {   // the dog one step: hotter, colder or the same; onto the treasure: found
  if (mini.dogs) return scWalk(mini, p, m);
  const to = typeof m === 'string' ? sniffStep(mini.dog, m) : null;
  if (to == null) return { ok: false, reason: 'bad' };
  if (!Number.isInteger(mini.treasure)) return { ok: false, reason: 'secret' };
  const from = mini.dog, res = sniffRes(from, to, mini.treasure), hot = res === 'hot', found = to === mini.treasure;
  mini.dog = to; mini.trail = (mini.trail || []).concat({ f: from, t: to, by: p, r: res, hot: hot ? 1 : 0 }).slice(-sniffMem(mini));   // (the last few steps only: the computer's memory)
  mini.last = { by: p, f: from, t: to, hot, res, found };
  if (found) return { ok: true, outcome: 'win', note: 'found' };
  return { ok: true, outcome: 'continue', note: res };
}
export function publicView(mini) {
  if (mini.dogs) return { type: 'sniff', dogs: Object.assign({}, mini.dogs), paths: { X: mini.paths.X.slice(), O: mini.paths.O.slice() }, trails: { X: mini.trails.X.map(t => Object.assign({}, t)), O: mini.trails.O.map(t => Object.assign({}, t)) } };
  return { type: 'sniff', dog: mini.dog, start: mini.start, trail: (mini.trail || []).slice(-sniffMem(mini)).map(t => Object.assign({}, t)) };   // never the treasure; the last few steps
}
export function randomMove(mini, p, rng, from, empties) {
  return from(sniffDirs(mini.dogs ? mini.dogs[p] : mini.dog));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last, hold = tune(mini).hold; flash.sniff = { f: l.f, t: l.t, hot: l.hot, res: l.res || (l.hot ? 'hot' : 'cold'), found: l.found };
  if (hold && hold !== SNIFF.hold) flash.hold = hold;            // (the admin's setting: how long the word shows)
  return;
}
export function secret(mini) {
  return { treasure: mini.treasure };
}
export function hide(m, k, st) {
  delete m.treasure; return;
}
export function flashMs(f, winLen, won) {
  return SNIFF.step + (f.hold || SNIFF.hold) + (won ? 900 : 0);
}

// Super Chaos: one field and one treasure (never in the middle cell), but a dog each, both starting in the
// middle. A move walks your own dog one step: hotter, colder or the same by your own dog's distance. Both dogs
// and their paths stay on the board, each in its owner's colour. The first dog onto the treasure wins the
// square; both in the same round reset it. Each player's dog, path and last few steps (trails: what the
// computer remembers) are their own (core/chaos.js merges them player by player).
export const SNIFF_MID = Math.floor(SNIFF.n * SNIFF.n / 2);
export function scCreate(type, rng) {
  let treasure = randInt(needRng(rng), SNIFF.n * SNIFF.n - 1);
  if (treasure >= SNIFF_MID) treasure += 1;
  return { type, treasure, dogs: { X: SNIFF_MID, O: SNIFF_MID }, paths: { X: [SNIFF_MID], O: [SNIFF_MID] }, trails: { X: [], O: [] }, last: null };
}
function scWalk(mini, p, m) {
  const from = mini.dogs[p], to = typeof m === 'string' ? sniffStep(from, m) : null;
  if (to == null) return { ok: false, reason: 'bad' };
  if (!Number.isInteger(mini.treasure)) return { ok: false, reason: 'secret' };
  const res = sniffRes(from, to, mini.treasure), hot = res === 'hot', found = to === mini.treasure;
  mini.dogs[p] = to; mini.paths[p] = mini.paths[p].concat(to);
  mini.trails[p] = mini.trails[p].concat({ f: from, t: to, by: p, r: res, hot: hot ? 1 : 0 }).slice(-sniffMem(mini));
  mini.last = { by: p, f: from, t: to, hot, res, found };
  if (found) return { ok: true, outcome: 'win', note: 'found' };
  return { ok: true, outcome: 'continue', note: res };
}
