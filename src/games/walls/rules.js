// Wall Race: the rules (pure: no page, no clock; the server runs the same code).
// One board of `n` by `n`. X's pawn starts in the middle of the bottom row and wins on the top row; O's starts in the
// middle of the top row and wins on the bottom (`at[p]`: [row, col]). A move is a step, `{ s: [row, col] }`: one square
// up, down, left or right, not through a wall (the pawns do not block each other); or a wall, `{ w: [o, row, col] }`: o 'h' lies under squares (row, col) and
// (row, col + 1), o 'v' to the right of squares (row, col) and (row + 1, col); two squares long, never over or across
// another wall, and never where it would leave either pawn no way to its far side (`wallPath`). Each player has
// `left[p]` walls. The first pawn on its far row takes the square. Nothing hidden, nothing by chance.
import { tuneLive } from '../../core/tune.js';

export const WALLS = { step: 240, wall: 300, hold: 300 };          // ms: a pawn's step, a wall dropping in, the result
export function create(type, rng) {
  const t = tuneLive(type), n = t.size, mid = n >> 1;
  return { type, v: 1, n, at: { X: [n - 1, mid], O: [0, n % 2 ? mid : mid - 1] }, walls: [], left: { X: t.walls, O: t.walls }, last: null };
}
export const wallGoal = (n, p) => (p === 'X' ? 0 : n - 1);
const has = (walls, o, r, c) => walls.some(w => w[0] === o && w[1] === r && w[2] === c);
// Is the way from (r, c) one square by (dr, dc) shut by a wall?
export function wallShut(walls, r, c, dr, dc) {
  if (dr === 1) return has(walls, 'h', r, c) || has(walls, 'h', r, c - 1);
  if (dr === -1) return has(walls, 'h', r - 1, c) || has(walls, 'h', r - 1, c - 1);
  if (dc === 1) return has(walls, 'v', r, c) || has(walls, 'v', r - 1, c);
  return has(walls, 'v', r, c - 1) || has(walls, 'v', r - 1, c - 1);
}
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
// The fewest steps from a square to the far row of p (the other pawn left out of it); -1: no way.
export function wallPath(n, walls, from, p) {
  const goal = wallGoal(n, p), seen = new Array(n * n).fill(-1), q = [from]; seen[from[0] * n + from[1]] = 0;
  for (let h = 0; h < q.length; h++) {
    const [r, c] = q[h], d = seen[r * n + c];
    if (r === goal) return d;
    for (const [dr, dc] of DIRS) { const r2 = r + dr, c2 = c + dc; if (r2 < 0 || r2 >= n || c2 < 0 || c2 >= n || seen[r2 * n + c2] >= 0 || wallShut(walls, r, c, dr, dc)) continue; seen[r2 * n + c2] = d + 1; q.push([r2, c2]); }
  }
  return -1;
}
// The squares p's pawn may step to (the other pawn is no obstacle: two pawns may stand on one square. A pawn in the way
// that had to be jumped or walked round handed the race to one side by the board's size alone).
export function wallSteps(mini, p) {
  const n = mini.n, [r, c] = mini.at[p], out = [];
  for (const [dr, dc] of DIRS) { const r2 = r + dr, c2 = c + dc; if (r2 < 0 || r2 >= n || c2 < 0 || c2 >= n || wallShut(mini.walls, r, c, dr, dc)) continue; out.push([r2, c2]); }
  return out;
}
// May this wall go down: on the board, clear of the others, and leaving both pawns a way.
export function wallFits(mini, o, r, c) {
  const n = mini.n, W = mini.walls;
  if ((o !== 'h' && o !== 'v') || !Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r > n - 2 || c > n - 2) return false;
  if (has(W, 'h', r, c) || has(W, 'v', r, c)) return false;        // the same place, or across it
  if (o === 'h' ? has(W, 'h', r, c - 1) || has(W, 'h', r, c + 1) : has(W, 'v', r - 1, c) || has(W, 'v', r + 1, c)) return false;   // end over end
  const next = W.concat([[o, r, c]]);
  return wallPath(n, next, mini.at.X, 'X') >= 0 && wallPath(n, next, mini.at.O, 'O') >= 0;
}
export function wallSpots(mini, p) { const out = []; if (mini.left[p] <= 0) return out; for (const o of ['h', 'v']) for (let r = 0; r < mini.n - 1; r++) for (let c = 0; c < mini.n - 1; c++) if (wallFits(mini, o, r, c)) out.push([o, r, c]); return out; }
export function apply(mini, p, m, rng, idx) {
  if (!m || typeof m !== 'object') return { ok: false, reason: 'bad' };
  if (Array.isArray(m.s)) {
    const to = wallSteps(mini, p).find(q => q[0] === m.s[0] && q[1] === m.s[1]);
    if (!to) return { ok: false, reason: 'illegal' };
    const from = mini.at[p].slice(); mini.at[p] = to.slice();
    mini.last = { by: p, from, to: to.slice() };
    return to[0] === wallGoal(mini.n, p) ? { ok: true, outcome: 'win', note: 'across' } : { ok: true, outcome: 'continue', note: 'step' };
  }
  if (Array.isArray(m.w)) {
    if (mini.left[p] <= 0) return { ok: false, reason: 'nowalls' };
    const [o, r, c] = m.w;
    if (!wallFits(mini, o, r, c)) return { ok: false, reason: 'nofit' };
    mini.walls.push([o, r, c]); mini.left[p]--;
    mini.last = { by: p, wall: [o, r, c] };
    return { ok: true, outcome: 'continue', note: 'wall' };
  }
  return { ok: false, reason: 'bad' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return { type: 'walls', v: mini.v, n: mini.n, at: { X: mini.at.X.slice(), O: mini.at.O.slice() }, walls: mini.walls.map(w => w.slice()), left: { X: mini.left.X, O: mini.left.O }, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null }; }
export function randomMove(mini, p, rng, from, empties) {        // (the tests' stand-in: mostly the shortest way on, now and then a wall)
  const spots = rng() < 0.2 ? wallSpots(mini, p) : [];
  if (spots.length) return { w: from(spots) };
  const steps = wallSteps(mini, p), d = q => wallPath(mini.n, mini.walls, q, p), best = Math.min(...steps.map(d));
  return { s: from(rng() < 0.8 ? steps.filter(q => d(q) === best) : steps) };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.wr = JSON.parse(JSON.stringify(mini.last)); }
export function flashMs(f, winLen, won) { const l = f.wr; return (l && l.wall ? WALLS.wall : WALLS.step) + WALLS.hold + (won ? 400 : 0); }
