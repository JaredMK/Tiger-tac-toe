// Trail Race: the rules (pure: no page, no clock; the server runs the same code).
// One board of `n` by `n` for both players. X's trail starts in the middle of the bottom row and makes for the top
// row; O's starts in the middle of the top row and makes for the bottom (`tr[p]`: the trail's cells [row, col] in
// order, its head last). A move extends the mover's trail by 1 to `cells` steps, each onto an empty square forward
// (towards the far row) or sideways, never back: a string of ways, 'n', 'e', 's', 'w' (X never 's', O never 'n').
// Both trails are walls for both players. The head on the far row takes the square. A player whose head has no
// step to take when their turn comes has their trail rubbed out and starts again from their own edge (the middle of
// it, or the nearest free square): looked at after every move, for the player about to move. Nothing hidden, nothing
// by chance: the server makes the same move.
// Equal turns (`even`): a player who reaches the far row having had a turn more than the other (`mini.final`) does
// not take the square yet: the other player has one turn to answer. Reaching their far row too, the trail that took
// fewer squares in all wins (`used[p]`: every square a player has drawn, rubbed out or not); level, a draw and the
// square resets. Not reaching it leaves the square to the first (`held`, with `winner`); an answer never made is taken
// by the leader's next move there ('claim': `unanswered`).
import { tune, tuneLive } from '../../core/tune.js';

export const TRAIL = { step: 190, wipe: 420, hold: 420 };          // ms: each new cell of a move, a trail rubbed out
const D = { n: [1, 0], s: [-1, 0], e: [0, 1], w: [0, -1] };
export const WAYS = { X: ['n', 'e', 'w'], O: ['s', 'e', 'w'] };
export const trailCfg = mini => ({ cells: tune(mini).cells, even: tune(mini).even === 'on' });
const mid = n => Math.floor(n / 2);
export function create(type, rng) { const n = tuneLive(type).size; return { type, n, tr: { X: [[0, mid(n)]], O: [[n - 1, mid(n)]] }, moves: { X: 0, O: 0 }, used: { X: 0, O: 0 }, wipes: { X: 0, O: 0 }, final: null, last: null }; }
export const trailFar = (mini, p) => (p === 'X' ? mini.n - 1 : 0);
export function trailGrid(mini) { const g = Array.from({ length: mini.n }, () => Array(mini.n).fill(null)); for (const q of ['X', 'O']) mini.tr[q].forEach(([r, c]) => { g[r][c] = q; }); return g; }
export const trailHead = (mini, p) => mini.tr[p][mini.tr[p].length - 1];
// The steps a head at [r, c] may take on a grid: [{ w, r, c }].
export function trailSteps(g, p, r, c) { const n = g.length, out = []; for (const w of WAYS[p]) { const rr = r + D[w][0], cc = c + D[w][1]; if (rr >= 0 && rr < n && cc >= 0 && cc < n && !g[rr][cc]) out.push({ w, r: rr, c: cc }); } return out; }
// The fewest steps from a player's head to their far row (never back, round both trails), or Infinity with no way.
export function trailDist(mini, p, g0) {
  const g = g0 || trailGrid(mini), n = mini.n, far = trailFar(mini, p), [hr, hc] = trailHead(mini, p), seen = new Set([hr * n + hc]);
  if (hr === far) return 0;
  let q = [[hr, hc]], d = 0;
  while (q.length) { d++; const nx = []; for (const [r, c] of q) for (const s of trailSteps(g, p, r, c)) { if (s.r === far) return d; const k = s.r * n + s.c; if (!seen.has(k)) { seen.add(k); nx.push([s.r, s.c]); } } q = nx; }
  return Infinity;
}
// Every move a player has: the strings of 1 to `cells` ways.
export function trailMoves(mini, p, cells) {
  const g = trailGrid(mini), out = [], [hr, hc] = trailHead(mini, p), far = trailFar(mini, p);
  const go = (r, c, path) => { for (const s of trailSteps(g, p, r, c)) { const m = path + s.w; out.push(m); if (m.length < cells && s.r !== far) { g[s.r][s.c] = p; go(s.r, s.c, m); g[s.r][s.c] = null; } } };
  go(hr, hc, '');
  return out;
}
// The move worked out on a copy: null where it cannot be made, else { mini (after it, a boxed-in player started again), path, won, wipe, was }.
export function trailTry(mini, p, m, cells) {
  if (typeof m !== 'string' || m.length < 1 || m.length > cells) return null;
  const t = { type: mini.type, n: mini.n, tune: mini.tune, tr: { X: mini.tr.X.map(q => q.slice()), O: mini.tr.O.map(q => q.slice()) }, moves: Object.assign({}, mini.moves), used: Object.assign({ X: 0, O: 0 }, mini.used), wipes: Object.assign({}, mini.wipes), final: mini.final || null };
  const g = trailGrid(t), far = trailFar(t, p), path = []; let [r, c] = trailHead(t, p), won = false;
  for (const w of m) {
    if (won || !WAYS[p].includes(w)) return null;
    const rr = r + D[w][0], cc = c + D[w][1]; if (rr < 0 || rr >= t.n || cc < 0 || cc >= t.n || g[rr][cc]) return null;
    g[rr][cc] = p; t.tr[p].push([rr, cc]); path.push([rr, cc]); r = rr; c = cc; won = r === far;
  }
  t.moves[p]++; t.used[p] += path.length;
  const o = p === 'X' ? 'O' : 'X'; let wipe = null, was = null;
  { const [orow, ocol] = trailHead(t, o); if (orow !== trailFar(t, o) && !trailSteps(g, o, orow, ocol).length) { wipe = o; was = t.tr[o]; was.forEach(([a, b]) => { g[a][b] = null; }); const row = o === 'X' ? 0 : t.n - 1; let col = mid(t.n); for (let k = 0; k < t.n && g[row][col]; k++) col = mid(t.n) + (k % 2 ? 1 : -1) * Math.ceil((k + 1) / 2); t.tr[o] = [[row, Math.max(0, Math.min(t.n - 1, col))]]; t.wipes[o]++; } }
  return { mini: t, path, won, wipe, was };
}
export function apply(mini, p, m, rng, idx) {
  const c = trailCfg(mini), o = p === 'X' ? 'O' : 'X';
  if (mini.final && mini.final.by === p) { if (m !== 'claim') return { ok: false, reason: 'claim' }; mini.last = null; return { ok: true, outcome: 'win', note: 'unanswered' }; }   // (the answer was never made: the square is the leader's, their trail already on the far row)
  const t = trailTry(mini, p, m, c.cells);
  if (!t) return { ok: false, reason: 'bad' };
  const from = mini.tr[p].length, answering = !!(mini.final && mini.final.by === o);
  mini.tr = t.mini.tr; mini.moves = t.mini.moves; mini.used = t.mini.used; mini.wipes = t.mini.wipes;
  mini.last = { by: p, m, path: t.path, from, wipe: t.wipe, was: t.was };
  if (answering) {
    if (!t.won) return { ok: true, outcome: 'win', winner: o, note: 'held' };
    const d = mini.used[p] - mini.final.used; mini.last.ans = { used: mini.used[p], fused: mini.final.used };
    return d < 0 ? { ok: true, outcome: 'win', note: 'passed' } : d > 0 ? { ok: true, outcome: 'win', winner: o, note: 'held' } : { ok: true, outcome: 'draw', note: 'tie' };
  }
  if (t.won) {
    if (c.even && mini.moves[p] > mini.moves[o]) { mini.final = { by: p, used: mini.used[p] }; return { ok: true, outcome: 'continue', note: 'reached' }; }
    return { ok: true, outcome: 'win', note: 'won' };
  }
  return { ok: true, outcome: 'continue', note: t.wipe ? 'wipe' : 'step' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
export function randomMove(mini, p, rng, from, empties) { if (mini.final && mini.final.by === p) return 'claim'; const ms = trailMoves(mini, p, trailCfg(mini).cells); return ms.length ? from(ms) : null; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { if (mini.last) flash.tl = JSON.parse(JSON.stringify(mini.last)); }
export const trailMs = l => l.path.length * TRAIL.step + (l.wipe ? TRAIL.wipe : 0);
export function flashMs(f, winLen, won) { return f.tl ? trailMs(f.tl) + TRAIL.hold + (won ? 500 : 0) : 0; }
