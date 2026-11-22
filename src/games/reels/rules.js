// Fruit Reels: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own score and their own last spin (`grid[p]`: nine pictures, a 3x3 window, row by row: 0 cherry,
// 1 lemon, 2 bell, 3 star; none before a first spin). A move is one spin, 'spin': every cell draws its picture by the
// weights (the move's rng: the server's online). Five lines score (`LINES`: the three rows and the two diagonals):
// three alike on a line score that picture's points; three stars on a line win the square at once while that is on.
// First to the target wins. Nothing is held between spins or players (v 2, December 2026: no hold; a square from
// before, three reels and a hold, is dealt again as the record is read, `stale`).
import { needRng } from '../../core/random.js';
import { tune } from '../../core/tune.js';

export const REELS = { n: 4, names: ['cherry', 'lemon', 'bell', 'star'], plural: ['cherries', 'lemons', 'bells', 'stars'], stop: [620, 900, 1180], judge: 1300, line: 260, hold: 520 };   // (stop: when each reel stops, ms from the move; line: each winning line lit one after the other)
export const MOVES = ['spin'];
export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 4, 8], [2, 4, 6]];   // the rows, then the diagonals (cells row by row)
export function reelsCfg(mini) {
  const t = tune(mini);
  return { target: t.target, stars: t.stars !== 'off', tri: [t.tri1, t.tri2, t.tri3, t.tri4], w: [t.w1, t.w2, t.w3, t.w4] };
}
export function create(type, rng) { return { type, v: 2, score: { X: 0, O: 0 }, grid: { X: null, O: null }, spins: { X: 0, O: 0 }, last: null }; }
export const stale = mini => mini.v !== 2;
const draw = (w, r) => { const sum = w[0] + w[1] + w[2] + w[3]; let x = r() * sum; for (let k = 0; k < 4; k++) { x -= w[k]; if (x < 0) return k; } return 0; };
// What a window scores: { pts, stars (a line of three stars that wins), wins: [{ line (its place in LINES), sym, pts }] }.
export function reelsScore(c, g) {
  const wins = [];
  LINES.forEach((L, k) => { const a = g[L[0]]; if (a === g[L[1]] && a === g[L[2]]) wins.push({ line: k, sym: a, pts: a === 3 && c.stars ? 0 : c.tri[a] }); });
  return { pts: wins.reduce((x, w) => x + w.pts, 0), stars: c.stars && wins.some(w => w.sym === 3), wins };
}
export function apply(mini, p, m, rng, idx) {
  if (mini.v !== 2) return { ok: false, reason: 'stale' };
  if (m !== 'spin') return { ok: false, reason: 'bad' };
  const c = reelsCfg(mini), r = needRng(rng), was = mini.grid[p], g = Array.from({ length: 9 }, () => draw(c.w, r)), s = reelsScore(c, g), from = mini.score[p];
  mini.grid[p] = g; mini.spins[p]++;
  mini.score[p] = Math.min(c.target, from + s.pts);
  mini.last = { by: p, g, was: was ? was.slice() : null, pts: s.pts, stars: s.stars, wins: s.wins, from, to: mini.score[p] };
  if (s.stars || mini.score[p] >= c.target) return { ok: true, outcome: 'win', note: s.stars ? 'stars' : 'won' };
  return { ok: true, outcome: 'continue', note: s.wins.length ? 'line' : 'none' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }   // (nothing hidden)
export function randomMove(mini, p, rng, from, empties) { return 'spin'; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.rl3 = JSON.parse(JSON.stringify(mini.last)); }
export const reelsShowMs = l => REELS.judge + (l && l.wins ? Math.max(0, l.wins.length - 1) * REELS.line : 0);   // (the last winning line lit)
export function flashMs(f, winLen, won) { return reelsShowMs(f.rl3) + REELS.hold + (won ? 600 : 0); }
