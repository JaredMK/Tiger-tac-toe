// Fruit Reels: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own score and their own last spin (`reels[p]`: three pictures, 0 cherry, 1 lemon, 2 bell, 3 star;
// none before a first spin). A move is one spin: 'spin' all three reels, or 'h0'/'h1'/'h2' to hold that reel of the
// player's last spin and spin the other two. Each spun reel draws its picture by the weights (the move's rng: the
// server's online). Two alike score `pair`; three alike their own points; three stars win the square at once while
// that is on. First to the target wins. One spin a turn: nothing is held between the players.
import { needRng } from '../../core/random.js';
import { tune } from '../../core/tune.js';

export const REELS = { n: 4, names: ['cherry', 'lemon', 'bell', 'star'], plural: ['cherries', 'lemons', 'bells', 'stars'], stop: [620, 900, 1180], judge: 1300, hold: 520 };   // (stop: when each reel stops, ms from the move)
export const MOVES = ['spin', 'h0', 'h1', 'h2'];
export function reelsCfg(mini) {
  const t = tune(mini);
  return { target: t.target, stars: t.stars !== 'off', pair: t.pair, tri: [t.tri1, t.tri2, t.tri3, t.tri4], w: [t.w1, t.w2, t.w3, t.w4] };
}
export function create(type, rng) { return { type, score: { X: 0, O: 0 }, reels: { X: null, O: null }, spins: { X: 0, O: 0 }, last: null }; }
const draw = (w, r) => { const sum = w[0] + w[1] + w[2] + w[3]; let x = r() * sum; for (let k = 0; k < 4; k++) { x -= w[k]; if (x < 0) return k; } return 0; };
// What three pictures score: { pts, kind: 'none' | 'pair' | 'tri' | 'stars', sym (the matched picture), cells (the reels in it) }.
export function reelsScore(c, v) {
  if (v[0] === v[1] && v[1] === v[2]) return v[0] === 3 && c.stars ? { pts: 0, kind: 'stars', sym: 3, cells: [0, 1, 2] } : { pts: c.tri[v[0]], kind: 'tri', sym: v[0], cells: [0, 1, 2] };
  for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) if (v[a] === v[b]) return { pts: c.pair, kind: 'pair', sym: v[a], cells: [a, b] };
  return { pts: 0, kind: 'none', sym: -1, cells: [] };
}
export function apply(mini, p, m, rng, idx) {
  const h = MOVES.indexOf(m) - 1;
  if (h < -1) return { ok: false, reason: 'bad' };
  const was = mini.reels[p];
  if (h >= 0 && !was) return { ok: false, reason: 'nohold' };
  const c = reelsCfg(mini), r = needRng(rng), v = [0, 1, 2].map(k => (k === h ? was[k] : draw(c.w, r))), s = reelsScore(c, v), from = mini.score[p];
  mini.reels[p] = v; mini.spins[p]++;
  mini.score[p] = Math.min(c.target, from + s.pts);
  mini.last = { by: p, v, was: was ? was.slice() : null, h, pts: s.pts, kind: s.kind, sym: s.sym, cells: s.cells, from, to: mini.score[p] };
  if (s.kind === 'stars' || mini.score[p] >= c.target) return { ok: true, outcome: 'win', note: s.kind === 'stars' ? 'stars' : 'won' };
  return { ok: true, outcome: 'continue', note: s.kind };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) {
  const cp = v => (v ? v.slice() : null);
  return { type: 'reels', score: { X: mini.score.X, O: mini.score.O }, reels: { X: cp(mini.reels.X), O: cp(mini.reels.O) }, spins: { X: mini.spins.X, O: mini.spins.O }, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null };
}
export function randomMove(mini, p, rng, from, empties) { return mini.reels[p] ? from(MOVES) : 'spin'; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.rl3 = JSON.parse(JSON.stringify(mini.last)); }
export function flashMs(f, winLen, won) { return REELS.judge + REELS.hold + (won ? 600 : 0); }
