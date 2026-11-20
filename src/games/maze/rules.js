// Maze Runner: the rules (pure: no page, no clock; the server runs the same code).
// A maze on a square grid, every cell joined to every other by exactly one path (`open[cell]`: its open sides as bits,
// 1 north, 2 east, 4 south, 8 west; hidden, the server's alone online: `secret`/`hide`). A runner starts in the middle
// of the bottom row; the flag is the middle cell of the top row. A move is a way out of the runner's cell ('n', 'e',
// 's', 'w'): the runner dashes along the corridor, round its bends, until it comes to a fork, a dead end or the flag.
// Every cell it passes is seen from then on (`seen[cell]`: its open sides; -1 not yet). A fork: the same player picks
// again (`again`). A dead end ends the turn there (the next turn starts by running back). The flag wins.
// Separate (the default): a maze each (`open.X`, `open.O`), dealt to be as long as each other: both the same average
// number of turns for a runner alone (`turns`, within MAZE.tol). Never the same maze: the second runner would read the
// first one's map. Shared: one maze, both runners in it, what either has seen on show for both.
import { needRng, randInt } from '../../core/random.js';
import { tuneLive } from '../../core/tune.js';

export const MAZE = { step: 95, bonk: 340, flag: 500, tol: 0.5, tries: 60, trials: 30 };   // ms a cell of a dash, a dead end's bump, the flag's moment; the deal: how near the target turns, how many mazes tried, how many runs measure one
export const DIRS = ['n', 'e', 's', 'w'], BIT = { n: 1, e: 2, s: 4, w: 8 }, BACK = { n: 's', e: 'w', s: 'n', w: 'e' };
export const mazeStep = (w, cell, d) => (d === 'n' ? cell - w : d === 's' ? cell + w : d === 'e' ? cell + 1 : cell - 1);
const count = m => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
// A maze: a random spanning tree of the grid, grown a passage at a time from the cells already in it (Prim's way: many
// short branches, so a runner meets a fork every few cells and a third of the cells are dead ends; a depth-first walk
// made long corridors a runner got through in two turns).
export function mazeMake(w, rng) {
  const n = w * w, open = new Array(n).fill(0), inm = new Array(n).fill(false), edge = [];
  const add = c => {
    inm[c] = true; const x = c % w, y = Math.floor(c / w);
    for (const d of DIRS) if ((d === 'n' ? y > 0 : d === 's' ? y < w - 1 : d === 'e' ? x < w - 1 : x > 0) && !inm[mazeStep(w, c, d)]) edge.push([c, d]);
  };
  add(randInt(rng, n));
  while (edge.length) {
    const [c, d] = edge.splice(randInt(rng, edge.length), 1)[0], t = mazeStep(w, c, d);
    if (inm[t]) continue;
    open[c] |= BIT[d]; open[t] |= BIT[BACK[d]]; add(t);
  }
  return open;
}
export const mazeStart = w => w * (w - 1) + (w >> 1), mazeFlag = w => w >> 1;
// A dash from `cell` the way `d`: the cells passed, and how it ends: 'fork', 'dead' or 'flag' (null: no way there).
export function mazeRun(open, w, cell, d) {
  if (!(open[cell] & BIT[d])) return null;
  const path = [], flag = mazeFlag(w);
  let c = cell, dir = d;
  for (let k = 0; k < w * w; k++) {
    c = mazeStep(w, c, dir); path.push(c);
    if (c === flag) return { path, end: 'flag' };
    const n = count(open[c]);
    if (n === 1) return { path, end: 'dead' };
    if (n > 2) return { path, end: 'fork' };
    dir = DIRS.find(x => x !== BACK[dir] && (open[c] & BIT[x]));                // a corridor: on round its bend
  }
  return { path, end: 'fork' };
}
// What a runner knows: from `cell` the way `d`, is there anything left to find that way (a cell not yet seen, or the
// flag)? The maze is a tree, so each way out of a cell is a branch of its own. Also the flag's way, once it is seen.
export function mazeLive(seen, w, cell, d) {
  const flag = mazeFlag(w), stack = [[mazeStep(w, cell, d), BACK[d]]];
  let live = false, toFlag = false;
  while (stack.length) {
    const [c, from] = stack.pop();
    if (c === flag) toFlag = true;
    if (seen[c] < 0) { live = true; continue; }
    for (const x of DIRS) if (x !== from && (seen[c] & BIT[x])) stack.push([mazeStep(w, c, x), BACK[x]]);
  }
  return { live: live || toFlag, toFlag };
}
// The way a runner picks from what it has seen: the flag's way once known; else a way with something left to find,
// one leading on (not back towards the start) while there is one. level: 'hard' takes the way that heads for the flag
// when several lead on, 'easy' now and then any way at all; else at random among them.
export function mazePick(seen, w, cell, rng, level) {
  const ways = DIRS.filter(d => seen[cell] >= 0 && (seen[cell] & BIT[d]));
  const info = ways.map(d => Object.assign({ d }, mazeLive(seen, w, cell, d)));
  const flagWay = info.find(x => x.toFlag);
  if (flagWay) return flagWay.d;
  if (level === 'easy' && rng() < 0.3) return ways[Math.floor(rng() * ways.length)];
  const home = mazeStart(w), back = ways.find(d => cell !== home && homeward(seen, w, cell, d, home));
  let live = info.filter(x => x.live && x.d !== back);
  if (!live.length) live = info.filter(x => x.live);
  if (!live.length) return ways[Math.floor(rng() * ways.length)];
  if (level === 'hard' && live.length > 1) {
    const flag = mazeFlag(w), dist = c => Math.abs((c % w) - (flag % w)) + Math.floor(c / w), best = Math.min(...live.map(x => dist(mazeStep(w, cell, x.d))));
    live = live.filter(x => dist(mazeStep(w, cell, x.d)) === best);
  }
  return live[Math.floor(rng() * live.length)].d;
}
function homeward(seen, w, cell, d, home) {                     // does the way d lead back to the start (through cells seen)?
  const stack = [[mazeStep(w, cell, d), BACK[d]]];
  while (stack.length) { const [c, from] = stack.pop(); if (c === home) return true; if (seen[c] < 0) continue; for (const x of DIRS) if (x !== from && (seen[c] & BIT[x])) stack.push([mazeStep(w, c, x), BACK[x]]); }
  return false;
}
// The turns a runner alone takes to the flag, picking as mazePick does (one run of it).
export function mazeSolo(open, w, rng, level) {
  const seen = new Array(w * w).fill(-1); let at = mazeStart(w), turns = 1; seen[at] = open[at];
  for (let k = 0; k < 400; k++) {
    const r = mazeRun(open, w, at, mazePick(seen, w, at, rng, level));
    for (const c of r.path) seen[c] = open[c];
    at = r.path[r.path.length - 1];
    if (r.end === 'flag') return turns;
    if (r.end === 'dead') turns++;
  }
  return turns;
}
export function mazeTurns(open, w, rng) { let s = 0; for (let k = 0; k < MAZE.trials; k++) s += mazeSolo(open, w, rng, 'normal'); return s / MAZE.trials; }
// A maze of the wanted length: the first one within MAZE.tol of the target turns, else the nearest of those tried.
export function mazeDeal(w, target, rng) {
  let best = null, bd = Infinity;
  for (let k = 0; k < MAZE.tries; k++) {
    const open = mazeMake(w, rng), d = Math.abs(mazeTurns(open, w, rng) - target);
    if (d < bd) { best = open; bd = d; }
    if (d <= MAZE.tol) break;
  }
  return best;
}
export function create(type, rng, opts) {
  const t = tuneLive(type), r = needRng(rng), w = t.size, sep = t.boards !== 'shared', start = mazeStart(w);
  const blank = open => { const s = new Array(w * w).fill(-1); s[start] = open[start]; return s; };
  if (!sep) { const open = mazeDeal(w, t.turns, r); return { type, v: 1, sep, w, open, seen: blank(open), at: { X: start, O: start }, turns: { X: 0, O: 0 }, last: null }; }
  const open = { X: mazeDeal(w, t.turns, r), O: mazeDeal(w, t.turns, r) };
  return { type, v: 1, sep, w, open, seen: { X: blank(open.X), O: blank(open.O) }, at: { X: start, O: start }, turns: { X: 0, O: 0 }, last: null };
}
export const mazeSeen = (mini, p) => (mini.sep ? mini.seen[p] : mini.seen);
export function apply(mini, p, m, rng, idx) {
  if (!DIRS.includes(m)) return { ok: false, reason: 'bad' };
  const open = mini.sep ? mini.open && mini.open[p] : mini.open, seen = mazeSeen(mini, p);
  if (!open) return { ok: false, reason: 'secret' };
  const from = mini.at[p], r = mazeRun(open, mini.w, from, m);
  if (!r) return { ok: false, reason: 'wall' };
  const fresh = r.path.filter(c => seen[c] < 0);
  for (const c of r.path) seen[c] = open[c];
  mini.at[p] = r.path[r.path.length - 1];
  if (!mini.last || mini.last.by !== p || mini.last.end === 'dead') mini.turns[p]++;      // (a turn's first dash counts it)
  mini.last = { by: p, d: m, from, path: r.path, end: r.end, fresh };
  if (r.end === 'flag') return { ok: true, outcome: 'win', note: 'flag' };
  if (r.end === 'dead') return { ok: true, outcome: 'continue', note: 'dead' };
  return { ok: true, outcome: 'continue', note: 'fork', again: true };
}
export function timeoutClose(mini, p) { return null; }             // (a dash owed is not taken: the runner waits where it stands)
const cp = s => (Array.isArray(s) ? s.slice() : { X: s.X.slice(), O: s.O.slice() });
export function publicView(mini) {                                // never the walls not yet seen
  return { type: 'maze', v: mini.v, sep: !!mini.sep, w: mini.w, seen: cp(mini.seen), at: { X: mini.at.X, O: mini.at.O }, turns: { X: mini.turns.X, O: mini.turns.O }, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null };
}
export function secret(mini) { return mini.open ? { open: JSON.parse(JSON.stringify(mini.open)) } : null; }
export function hide(m, k, st) { delete m.open; }
export const mazeWays = (mini, p) => { const s = mazeSeen(mini, p)[mini.at[p]]; return DIRS.filter(d => s >= 0 && (s & BIT[d])); };
export function randomMove(mini, p, rng, from, empties) { return mazePick(mazeSeen(mini, p), mini.w, mini.at[p], needRng(rng), 'normal'); }   // (the tests' stand-in: a runner that gets there)
export function moveFlash(m, p, range, bjFrom, mini, flash) { const l = mini.last; flash.mz = { from: l.from, path: l.path.slice(), end: l.end, fresh: l.fresh.slice() }; }
export const mazeMs = (n, end) => n * MAZE.step + (end === 'dead' ? MAZE.bonk : end === 'flag' ? MAZE.flag : 60);
export function flashMs(f, winLen, won) { return f.mz ? mazeMs(f.mz.path.length, f.mz.end) : 300; }
