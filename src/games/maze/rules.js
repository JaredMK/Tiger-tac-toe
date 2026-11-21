// Maze Runner: the rules (pure: no page, no clock; the server runs the same code).
// A maze on a grid `w` cells wide and `h` tall, every cell joined to every other by exactly one path (`open[cell]`: its
// open sides as bits, 1 north, 2 east, 4 south, 8 west; hidden, the server's alone online: `secret`/`hide`). A runner
// starts in the bottom left corner (`start`); the flag is the opposite corner, top right (`flag`; on show from the
// start). A move is a way out of the runner's cell ('n', 'e', 's', 'w'): the runner dashes along the corridor, round
// its bends, until it comes to a fork, a dead end or the flag. Every cell it passes is seen from then on (`seen[cell]`:
// its open sides; -1 not yet). A fork: the same player picks again (`again`). A dead end ends the turn there (the next
// turn starts by running back). The flag wins.
// The deal (`mazeDeal`): a maze grown by `branch` % random picks (many short branches and dead ends) against the rest
// newest-first (longer corridors), and kept only if the one path from the door to the flag is at least `minPath` cells
// long; of those, the one nearest `turns`, the average turns a runner alone takes (MAZE.trials runs of `mazeSolo`).
// Boards (`boards`): 'separate' (the default): a maze each (`open.X`, `open.O`), dealt to the same length, never the
// same maze (the second runner would read the first one's map); 'shared': one maze, a runner each in it, what either
// has seen on show for both; 'one': one maze and ONE runner both players move in turn (`one`), whoever's dash reaches
// the flag takes the square.
// A square dealt before December 2026's rework (no `v` 2: a w by w maze, the door in the bottom row's middle, the flag
// in the top row's middle) plays on as it was dealt (`mazeGeo`).
import { needRng, randInt } from '../../core/random.js';
import { tuneLive } from '../../core/tune.js';

export const MAZE = { step: 95, bonk: 340, flag: 500, tol: 0.5, tries: 40, trials: 24, pathTries: 30 };   // ms a cell of a dash, a dead end's bump, the flag's moment; the deal: how near the target turns, how many mazes timed, how many runs time one, how many mazes drawn for one long enough
export const DIRS = ['n', 'e', 's', 'w'], BIT = { n: 1, e: 2, s: 4, w: 8 }, BACK = { n: 's', e: 'w', s: 'n', w: 'e' };
export const mazeStep = (w, cell, d) => (d === 'n' ? cell - w : d === 's' ? cell + w : d === 'e' ? cell + 1 : cell - 1);
const count = m => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
// A maze's shape: { w, h, n, start, flag }. From a square (`mazeGeo(mini)`) or from a size (`mazeGeoOf(w, h)`, the
// corners); a first square (no `h`) keeps its square and its middle door and flag.
export const mazeGeoOf = (w, h) => ({ w, h, n: w * h, start: (h - 1) * w, flag: w - 1 });
export const mazeGeo = mini => (mini.h ? { w: mini.w, h: mini.h, n: mini.w * mini.h, start: mini.start, flag: mini.flag } : { w: mini.w, h: mini.w, n: mini.w * mini.w, start: mini.w * (mini.w - 1) + (mini.w >> 1), flag: mini.w >> 1 });
export const mazeStart = mini => mazeGeo(mini).start, mazeFlag = mini => mazeGeo(mini).flag;
// A maze: a random spanning tree of the grid, grown a passage at a time from the cells already in it (the growing
// tree): `branch` % of the time from a random cell of the edge (Prim's way: many short branches, a fork every few
// cells, a third of the cells dead ends), else from the newest (a depth-first walk: long winding corridors).
export function mazeMake(g, rng, branch = 100) {
  const { w, h, n } = g, open = new Array(n).fill(0), inm = new Array(n).fill(false), edge = [], share = branch / 100;
  const add = c => {
    inm[c] = true; const x = c % w, y = Math.floor(c / w);
    for (const d of DIRS) if ((d === 'n' ? y > 0 : d === 's' ? y < h - 1 : d === 'e' ? x < w - 1 : x > 0) && !inm[mazeStep(w, c, d)]) edge.push([c, d]);
  };
  add(randInt(rng, n));
  while (edge.length) {
    const k = share >= 1 || rng() < share ? randInt(rng, edge.length) : edge.length - 1;
    const [c, d] = edge.splice(k, 1)[0], t = mazeStep(w, c, d);
    if (inm[t]) continue;
    open[c] |= BIT[d]; open[t] |= BIT[BACK[d]]; add(t);
  }
  return open;
}
// The one path from the door to the flag: its length in cells (the door not counted).
export function mazePathLen(open, g) {
  const dist = new Array(g.n).fill(-1), q = [g.start]; dist[g.start] = 0;
  for (let i = 0; i < q.length; i++) { const c = q[i]; if (c === g.flag) return dist[c]; for (const d of DIRS) if (open[c] & BIT[d]) { const t = mazeStep(g.w, c, d); if (dist[t] < 0) { dist[t] = dist[c] + 1; q.push(t); } } }
  return -1;
}
export const mazeDeadEnds = open => open.filter(m => count(m) === 1).length / open.length;
// A dash from `cell` the way `d`: the cells passed, and how it ends: 'fork', 'dead' or 'flag' (null: no way there).
export function mazeRun(open, g, cell, d) {
  if (!(open[cell] & BIT[d])) return null;
  const path = [];
  let c = cell, dir = d;
  for (let k = 0; k < g.n; k++) {
    c = mazeStep(g.w, c, dir); path.push(c);
    if (c === g.flag) return { path, end: 'flag' };
    const m = count(open[c]);
    if (m === 1) return { path, end: 'dead' };
    if (m > 2) return { path, end: 'fork' };
    dir = DIRS.find(x => x !== BACK[dir] && (open[c] & BIT[x]));                // a corridor: on round its bend
  }
  return { path, end: 'fork' };
}
// What a runner knows: from `cell` the way `d`, is there anything left to find that way (a cell not yet seen, or the
// flag)? The maze is a tree, so each way out of a cell is a branch of its own. Also the flag's way, once it is seen.
export function mazeLive(seen, g, cell, d) {
  const stack = [[mazeStep(g.w, cell, d), BACK[d]]];
  let live = false, toFlag = false;
  while (stack.length) {
    const [c, from] = stack.pop();
    if (c === g.flag) toFlag = true;
    if (seen[c] < 0) { live = true; continue; }
    for (const x of DIRS) if (x !== from && (seen[c] & BIT[x])) stack.push([mazeStep(g.w, c, x), BACK[x]]);
  }
  return { live: live || toFlag, toFlag };
}
// The way a runner picks from what it has seen: the flag's way once known; else a way with something left to find,
// one leading on (not back towards the start) while there is one. level: 'hard' takes the way that heads for the flag
// when several lead on, 'easy' now and then any way at all; else at random among them.
export function mazePick(seen, g, cell, rng, level) {
  const ways = DIRS.filter(d => seen[cell] >= 0 && (seen[cell] & BIT[d]));
  const info = ways.map(d => Object.assign({ d }, mazeLive(seen, g, cell, d)));
  const flagWay = info.find(x => x.toFlag);
  if (flagWay) return flagWay.d;
  if (level === 'easy' && rng() < 0.3) return ways[Math.floor(rng() * ways.length)];
  const back = ways.find(d => cell !== g.start && homeward(seen, g, cell, d));
  let live = info.filter(x => x.live && x.d !== back);
  if (!live.length) live = info.filter(x => x.live);
  if (!live.length) return ways[Math.floor(rng() * ways.length)];
  if (level === 'hard' && live.length > 1) {
    const fx = g.flag % g.w, fy = Math.floor(g.flag / g.w), dist = c => Math.abs((c % g.w) - fx) + Math.abs(Math.floor(c / g.w) - fy), best = Math.min(...live.map(x => dist(mazeStep(g.w, cell, x.d))));
    live = live.filter(x => dist(mazeStep(g.w, cell, x.d)) === best);
  }
  return live[Math.floor(rng() * live.length)].d;
}
function homeward(seen, g, cell, d) {                             // does the way d lead back to the start (through cells seen)?
  const stack = [[mazeStep(g.w, cell, d), BACK[d]]];
  while (stack.length) { const [c, from] = stack.pop(); if (c === g.start) return true; if (seen[c] < 0) continue; for (const x of DIRS) if (x !== from && (seen[c] & BIT[x])) stack.push([mazeStep(g.w, c, x), BACK[x]]); }
  return false;
}
// The turns a runner alone takes to the flag, picking as mazePick does (one run of it).
export function mazeSolo(open, g, rng, level) {
  const seen = new Array(g.n).fill(-1); let at = g.start, turns = 1; seen[at] = open[at];
  for (let k = 0; k < 4 * g.n; k++) {
    const r = mazeRun(open, g, at, mazePick(seen, g, at, rng, level));
    for (const c of r.path) seen[c] = open[c];
    at = r.path[r.path.length - 1];
    if (r.end === 'flag') return turns;
    if (r.end === 'dead') turns++;
  }
  return turns;
}
export function mazeTurns(open, g, rng) { let s = 0; for (let k = 0; k < MAZE.trials; k++) s += mazeSolo(open, g, rng, 'normal'); return s / MAZE.trials; }
// A maze long enough: the first of MAZE.pathTries whose path to the flag is `minPath` cells or more, else the longest.
export function mazeLong(g, rng, branch, minPath) {
  let best = null, bl = -1;
  for (let k = 0; k < MAZE.pathTries; k++) { const open = mazeMake(g, rng, branch), l = mazePathLen(open, g); if (l > bl) { best = open; bl = l; } if (l >= minPath) break; }
  return best;
}
// A maze of the wanted length: the first long-enough maze within MAZE.tol of the target turns, else the nearest of
// those tried.
export function mazeDeal(g, o, rng) {
  let best = null, bd = Infinity;
  for (let k = 0; k < MAZE.tries; k++) {
    const open = mazeLong(g, rng, o.branch, o.minPath), d = Math.abs(mazeTurns(open, g, rng) - o.turns);
    if (d < bd) { best = open; bd = d; }
    if (d <= MAZE.tol) break;
  }
  return best;
}
export function create(type, rng, opts) {
  const t = tuneLive(type), r = needRng(rng), g = mazeGeoOf(t.cols, t.rows), o = { branch: t.branch, minPath: t.minPath, turns: t.turns };
  const mode = t.boards === 'shared' || t.boards === 'one' ? t.boards : 'separate', sep = mode === 'separate';
  const blank = open => { const s = new Array(g.n).fill(-1); s[g.start] = open[g.start]; return s; };
  const base = { type, v: 2, sep, one: mode === 'one', w: g.w, h: g.h, start: g.start, flag: g.flag, at: { X: g.start, O: g.start }, turns: { X: 0, O: 0 }, last: null };
  if (!sep) { const open = mazeDeal(g, o, r); return Object.assign(base, { open, seen: blank(open) }); }
  const open = { X: mazeDeal(g, o, r), O: mazeDeal(g, o, r) };
  return Object.assign(base, { open, seen: { X: blank(open.X), O: blank(open.O) } });
}
export const mazeSeen = (mini, p) => (mini.sep ? mini.seen[p] : mini.seen);
export function apply(mini, p, m, rng, idx) {
  if (!DIRS.includes(m)) return { ok: false, reason: 'bad' };
  const g = mazeGeo(mini), open = mini.sep ? mini.open && mini.open[p] : mini.open, seen = mazeSeen(mini, p);
  if (!open) return { ok: false, reason: 'secret' };
  const from = mini.at[p], r = mazeRun(open, g, from, m);
  if (!r) return { ok: false, reason: 'wall' };
  const fresh = r.path.filter(c => seen[c] < 0);
  for (const c of r.path) seen[c] = open[c];
  const to = r.path[r.path.length - 1];
  if (mini.one) { mini.at.X = to; mini.at.O = to; } else mini.at[p] = to;    // (one runner: both players move it)
  if (!mini.last || mini.last.by !== p || mini.last.end === 'dead') mini.turns[p]++;      // (a turn's first dash counts it)
  mini.last = { by: p, d: m, from, path: r.path, end: r.end, fresh };
  if (r.end === 'flag') return { ok: true, outcome: 'win', note: 'flag' };
  if (r.end === 'dead') return { ok: true, outcome: 'continue', note: 'dead' };
  return { ok: true, outcome: 'continue', note: 'fork', again: true };
}
export function timeoutClose(mini, p) { return null; }             // (a dash owed is not taken: the runner waits where it stands)
const cp = s => (Array.isArray(s) ? s.slice() : { X: s.X.slice(), O: s.O.slice() });
export function publicView(mini) {                                // never the walls not yet seen
  const v = { type: 'maze', v: mini.v, sep: !!mini.sep, one: !!mini.one, w: mini.w, seen: cp(mini.seen), at: { X: mini.at.X, O: mini.at.O }, turns: { X: mini.turns.X, O: mini.turns.O }, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null };
  if (mini.h) Object.assign(v, { h: mini.h, start: mini.start, flag: mini.flag });
  return v;
}
export function secret(mini) { return mini.open ? { open: JSON.parse(JSON.stringify(mini.open)) } : null; }
export function hide(m, k, st) { delete m.open; }
export const mazeWays = (mini, p) => { const s = mazeSeen(mini, p)[mini.at[p]]; return DIRS.filter(d => s >= 0 && (s & BIT[d])); };
export function randomMove(mini, p, rng, from, empties) { return mazePick(mazeSeen(mini, p), mazeGeo(mini), mini.at[p], needRng(rng), 'normal'); }   // (the tests' stand-in: a runner that gets there)
export function moveFlash(m, p, range, bjFrom, mini, flash) { const l = mini.last; flash.mz = { from: l.from, path: l.path.slice(), end: l.end, fresh: l.fresh.slice() }; }
export const mazeMs = (n, end) => n * MAZE.step + (end === 'dead' ? MAZE.bonk : end === 'flag' ? MAZE.flag : 60);
export function flashMs(f, winLen, won) { return f.mz ? mazeMs(f.mz.path.length, f.mz.end) : 300; }
