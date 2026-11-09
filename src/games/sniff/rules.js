// Sniff: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { RACE_V, raceDealt, raceSide } from '../../core/race.js';
import { tune, tuneLive } from '../../core/tune.js';

// ---------- Sniff ----------
// A 7x7 field with one buried treasure and one dog, shared. The dog starts at a random cell at least 3 steps
// from the treasure in a straight line (its setting, minStart). A move walks it one step, any of the 8 ways (diagonals too): "Hotter" when that
// step brought it closer to the treasure in a straight line, "Colder" when further, "Same" when the straight-
// line distance did not change. Nothing of the past stays on the board: the step's line and its word
// show while it plays, then they are gone. The square keeps only the last 3 steps (who made each, and which it
// was), for the computer, which remembers that much. Whoever walks the dog onto the treasure wins the square.
// Online the server keeps the treasure.
// Race mode (core/race.js, `rv: 2`): the same field and start for both, a dog each (`mini.side[p]`: { dog, path (the
// cells it has stood on, the start first), trail (its last few steps, the computer's memory), last }, open to both) and
// a treasure each (`mini.tg`: { X, O }, the square's secret), the two the same walk from the start (the same number of
// steps, diagonals counting one: sniffSteps) and both at least minStart from it in a straight line: equally far to go.
// A step is hotter, colder or the same by the walker's own treasure. No step limit: the first dog onto its own treasure wins.
export const SNIFF = { n: 7, minStart: 3, step: 420, hold: 1200, memory: 3 };   // (minStart, hold, memory: the defaults of its settings, TUNE in meta.js)
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
// Race: the starts for a treasure at t (at least min from it in a straight line) that have a second spot for the other
// treasure (the same walk from the start, as far in a straight line), and those spots.
const raceAlts = (t, s, min) => SNIFF_CELLS.filter(c => c !== t && c !== s && sniffSteps(s, c) === sniffSteps(s, t) && sniffDist(c, s) >= min);
const raceStarts = (t, min) => SNIFF_CELLS.filter(s => sniffDist(s, t) >= min && raceAlts(t, s, min).length);
const SNIFF_CELLS = Array.from({ length: SNIFF.n * SNIFF.n }, (_, c) => c);
export function create(type, rng, opts) {   // the treasure (hidden online), and the dog at least 3 steps from it, as the crow flies
  const r = needRng(rng), min = tuneLive(type).minStart;
  if (raceDealt(type, opts)) {                                     // a race: a dog each, both from one start; the second treasure the same walk from it, as far in a straight line
    const ts = SNIFF_CELLS.filter(t => raceStarts(t, min).length);  // (every cell but the middle one with a minStart of 4)
    const treasure = ts[randInt(r, ts.length)], starts = raceStarts(treasure, min), dog = starts[randInt(r, starts.length)], alt = raceAlts(treasure, dog, min);
    const part = () => ({ dog, path: [dog], trail: [], last: null });
    return { type, g: SNIFF.n, start: dog, race: true, rv: RACE_V, tg: { X: treasure, O: alt[randInt(r, alt.length)] }, side: { X: part(), O: part() } };
  }
  const treasure = randInt(r, SNIFF.n * SNIFF.n);
  const far = SNIFF_CELLS.filter(c => sniffDist(c, treasure) >= min);   // (on 7x7 every cell has some at least 4 away)
  const dog = far[randInt(r, far.length)];
  return { type, g: SNIFF.n, treasure, dog, start: dog, trail: [], last: null };
}
// Where p's dog lives: p's own side of a race square (null for a side this copy has not got), else nothing (the shared dog).
export const sniffPart = (mini, p) => (mini && mini.race ? raceSide(mini, p) : null);
// The treasure p's dog is after: a race square's own (null where this copy has not got it), else the square's one.
export const sniffTreasure = (mini, p) => (mini.race ? (mini.tg && Number.isInteger(mini.tg[p]) ? mini.tg[p] : null) : mini.treasure);
// Race: a side's progress in brief: the steps its dog has taken and its last step's word.
export function raceShape(mini, p) {
  const part = raceSide(mini, p);
  return part ? { n: Math.max(0, (part.path || []).length - 1), heat: part.last ? (part.last.found ? 'found' : part.last.res || (part.last.hot ? 'hot' : 'cold')) : null } : {};
}
function raceWalk(mini, p, m) {                   // a race: p's own dog one step, hotter, colder or the same by its own treasure; onto it: found
  const part = raceSide(mini, p), t = sniffTreasure(mini, p);
  if (!part) return { ok: false, reason: 'bad' };
  const from = part.dog, to = typeof m === 'string' ? sniffStep(from, m) : null;
  if (to == null) return { ok: false, reason: 'bad' };
  if (t == null) return { ok: false, reason: 'secret' };
  const res = sniffRes(from, to, t), hot = res === 'hot', found = to === t;
  part.dog = to; part.path = (part.path || [from]).concat(to);
  part.trail = (part.trail || []).concat({ f: from, t: to, by: p, r: res, hot: hot ? 1 : 0 }).slice(-sniffMem(mini));
  part.last = { by: p, f: from, t: to, hot, res, found };
  if (found) return { ok: true, outcome: 'win', note: 'found' };
  return { ok: true, outcome: 'continue', note: res };
}
export function apply(mini, p, m, rng, idx) {   // the dog one step: hotter, colder or the same; onto the treasure: found
  if (mini.race) return raceWalk(mini, p, m);
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
  const was = mini.was ? { was: mini.was } : {};                 // (a square from the 5x5 field: the computer's to know)
  if (mini.race) return { type: 'sniff', g: mini.g, ...was, start: mini.start, race: true, side: JSON.parse(JSON.stringify(mini.side || {})) };   // both dogs, never a treasure
  if (mini.dogs) return { type: 'sniff', g: mini.g, ...was, dogs: Object.assign({}, mini.dogs), paths: { X: mini.paths.X.slice(), O: mini.paths.O.slice() }, trails: { X: mini.trails.X.map(t => Object.assign({}, t)), O: mini.trails.O.map(t => Object.assign({}, t)) } };
  return { type: 'sniff', g: mini.g, ...was, dog: mini.dog, start: mini.start, trail: (mini.trail || []).slice(-sniffMem(mini)).map(t => Object.assign({}, t)) };   // never the treasure; the last few steps
}
export function randomMove(mini, p, rng, from, empties) {
  const part = sniffPart(mini, p);
  return from(sniffDirs(mini.race ? (part ? part.dog : mini.start) : mini.dogs ? mini.dogs[p] : mini.dog));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.race ? (raceSide(mini, p) || {}).last : mini.last, hold = tune(mini).hold; flash.sniff = { f: l.f, t: l.t, hot: l.hot, res: l.res || (l.hot ? 'hot' : 'cold'), found: l.found };
  if (hold && hold !== SNIFF.hold) flash.hold = hold;            // (the admin's setting: how long the word shows)
  return;
}
export function secret(mini) {
  return mini.race ? { tg: Object.assign({}, mini.tg) } : { treasure: mini.treasure };
}
export function hide(m, k, st) {
  delete m.treasure; delete m.tg; return;
}
export function flashMs(f, winLen, won) {
  return SNIFF.step + (f.hold || SNIFF.hold) + (won ? 900 : 0);
}

// A square from the 5x5 field (no g): its cells move into the middle of the 7x7 one, one row and column in,
// so every distance (and every clue already given) stays as it was; the treasure too, where it is known.
export function sniffUpgrade(mini) {
  if (!mini || mini.type !== 'sniff' || mini.g) return mini;
  const at = c => (Number.isInteger(c) ? (Math.floor(c / 5) + 1) * SNIFF.n + (c % 5) + 1 : c);
  const step = s => Object.assign({}, s, { f: at(s.f), t: at(s.t) });
  for (const k of ['treasure', 'dog', 'start']) if (Number.isInteger(mini[k])) mini[k] = at(mini[k]);
  if (Array.isArray(mini.trail)) mini.trail = mini.trail.map(step);
  if (mini.side) for (const p of ['X', 'O']) { const sd = mini.side[p]; if (!sd) continue; sd.dog = at(sd.dog); sd.path = (sd.path || []).map(at); sd.trail = (sd.trail || []).map(step); if (sd.last) sd.last = Object.assign({}, sd.last, { f: at(sd.last.f), t: at(sd.last.t) }); }
  if (mini.dogs) for (const p of ['X', 'O']) { mini.dogs[p] = at(mini.dogs[p]); mini.paths[p] = (mini.paths[p] || []).map(at); mini.trails[p] = (mini.trails[p] || []).map(step); }
  if (mini.last) mini.last = Object.assign({}, mini.last, { f: at(mini.last.f), t: at(mini.last.t) });
  mini.g = SNIFF.n; mini.was = 5;   // (was: the computer knows the treasure is in the middle five, and that its start rule was another)
  return mini;
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
  return { type, g: SNIFF.n, treasure, dogs: { X: SNIFF_MID, O: SNIFF_MID }, paths: { X: [SNIFF_MID], O: [SNIFF_MID] }, trails: { X: [], O: [] }, last: null };
}
// Both walked their dogs in the same round: the two steps play together at the round's end (resolve), in each
// player's own view: both dogs trot from where the round began, each with its own word.
export function scMerge(m, c) {
  if (m.race) { for (const p of c.played) m.side[p] = c.forks[p].side[p]; return; }   // (a race square keeps each side's own)
  if (c.played.length !== 2) return undefined;
  const pre = JSON.parse(JSON.stringify(m)), steps = {};
  for (const p of c.played) {
    const l = c.forks[p].last;
    if (!l || l.by !== p || !Number.isInteger(l.f)) return undefined;
    steps[p] = { f: l.f, t: l.t, res: l.res, hot: !!l.hot, found: !!l.found };
    pre.dogs[p] = l.f; pre.paths[p] = pre.paths[p].slice(0, -1);
  }
  pre.last = null;
  return { resolve: { pre, joint: true, flash: { by: c.me, scr: { steps } } } };
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
