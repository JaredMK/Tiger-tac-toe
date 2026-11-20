// Fruit Reels: the computer's play. A spin's 64 outcomes are counted exactly for each of the four moves (spin all, or
// hold a reel of its last spin): Normal takes the move worth the most points (three stars counted as the points still
// needed); Hard the move that leaves the fewest spins still needed (`reelsTable`, solved exactly); Easy any move.
import { MOVES, reelsCfg, reelsScore } from './rules.js';

// A move's outcomes: [{ v, pr, pts, win }] (h: the reel held, -1 none; was: the last spin).
function outcomes(c, was, h, need) {
  const sum = c.w[0] + c.w[1] + c.w[2] + c.w[3], out = [];
  const go = (k, v, pr) => {
    if (k === 3) { const s = reelsScore(c, v); out.push({ v: v.slice(), pr, pts: s.pts, win: s.kind === 'stars' || s.pts >= need }); return; }
    if (k === h) { v[k] = was[k]; go(k + 1, v, pr); return; }
    for (let x = 0; x < 4; x++) if (c.w[x] > 0) { v[k] = x; go(k + 1, v, pr * c.w[x] / sum); }
  };
  go(0, [0, 0, 0], 1);
  return out;
}
const worth = (o, need) => o.reduce((x, e) => x + e.pr * (e.win ? need : Math.min(need, e.pts)), 0);
const winNow = o => o.reduce((x, e) => x + (e.win ? e.pr : 0), 0);
const options = was => (was ? [-1, 0, 1, 2] : [-1]);
// The spins still needed from a score and a last spin, playing each spin for the fewest (Hard's table, kept per settings):
// turns[score][reels] (reels: the last spin as a number 0-63, 64 none yet), by value iteration from the target down.
const TABLES = new Map();
const code = v => (v ? v[0] * 16 + v[1] * 4 + v[2] : 64);
export function reelsTable(c) {
  const key = JSON.stringify([c.target, c.stars, c.pair, c.tri, c.w]);
  if (TABLES.has(key)) return TABLES.get(key);
  const T = Array.from({ length: c.target }, () => new Float64Array(65).fill(1)), of = k => (k === 64 ? null : [k >> 4, (k >> 2) & 3, k & 3]);
  for (let s = c.target - 1; s >= 0; s--) {
    const outs = Array.from({ length: 65 }, (_, k) => options(of(k)).map(h => outcomes(c, of(k), h, c.target - s)));
    for (let it = 0; it < 200; it++) {
      let d = 0;
      for (let k = 0; k < 65; k++) {
        let bestV = Infinity;
        for (const o of outs[k]) { let v = 1; for (const e of o) if (!e.win) v += e.pr * T[s + e.pts][code(e.v)]; if (v < bestV) bestV = v; }
        d = Math.max(d, Math.abs(bestV - T[s][k])); T[s][k] = bestV;
      }
      if (d < 1e-7) break;
    }
  }
  TABLES.set(key, T); return T;
}
const SOLVE_MAX = 40;
// The turns a side still needs: Hard's table where the target is small enough, else the points needed over a spin's worth.
export function needs(pm, p) {
  const c = reelsCfg(pm), need = c.target - pm.score[p];
  if (need <= 0) return 0;
  if (c.target <= SOLVE_MAX) return reelsTable(c)[pm.score[p]][code(pm.reels[p])];
  const ev = Math.max(...options(pm.reels[p]).map(h => worth(outcomes(c, pm.reels[p], h, need), need)));
  return Math.max(1, need / Math.max(0.2, ev));
}
export function best(pm, me, rng, style, ctx) {
  const c = reelsCfg(pm), level = (ctx && ctx.level) || 'normal', was = pm.reels[me], s = pm.score[me], need = c.target - s;
  const opts = options(was).map(h => { const o = outcomes(c, was, h, need); return { h, o, ev: worth(o, need), win: winNow(o) }; });
  if (level === 'easy') { const e = opts[Math.floor(rng() * opts.length)]; return { move: MOVES[e.h + 1], q: e.win }; }
  if (level === 'hard' && c.target <= SOLVE_MAX) {
    const T = reelsTable(c);
    for (const e of opts) e.t = e.o.reduce((x, r) => x + (r.win ? 0 : r.pr * T[s + r.pts][code(r.v)]), 1);
    opts.sort((a, b) => (a.t - b.t) || (b.ev - a.ev));
  } else opts.sort((a, b) => (b.ev - a.ev) || (a.h - b.h));
  return { move: MOVES[opts[0].h + 1], q: opts[0].win };
}
