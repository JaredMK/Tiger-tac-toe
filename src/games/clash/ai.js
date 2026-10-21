// Clash Grid: the computer's play.
import { clashLinesOf, clashNeed } from './rules.js';
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { other } from '../../core/util.js';

// What a cell is worth to p: each run of four through it still open to p, more the more of it p holds
// (the fourth: the square). Its own runs (W) weigh more than the other player's (WD: a run of theirs is
// blocked in earnest once it holds three): blocking everything leaves a grid nobody can win.
// (A run of another length, the admin's setting: the same weights, the last one the run's last cell.)
const W = [1, 4, 16, 1000], WD = [0.3, 1, 5, 900];
const weights = (w, k) => (k === w.length ? w : Array.from({ length: k }, (_, j) => (j === k - 1 ? w[w.length - 1] : w[Math.min(j, w.length - 2)])));
function worth(cells, i, p, w, lines) {
  let v = 0;
  for (const l of lines) if (l.includes(i) && l.every(k => cells[k] == null || cells[k] === p)) v += w[l.filter(k => cells[k] === p).length];
  return v;
}
export function needs(pm, p) {   // the fewest claims still missing from a run p can make
  let best = Infinity;
  for (const l of clashLinesOf(pm)) if (l.every(k => pm.cells[k] == null || pm.cells[k] === p)) best = Math.min(best, l.filter(k => pm.cells[k] == null).length);
  return best === Infinity ? Infinity : best + 0.5;               // (a collision now and then costs a claim)
}
// Its own lines, the other player's best line blocked; and a cell the other player is likely to pick too
// (their best: their own line, or a block of its) is worth less the more of its own it puts there: a collision
// blocks the cell for good, which still stops the other player there but gains it nothing.
export function best(pm, me, rng, style, ctx) {
  const o = other(me), cells = pm.cells, open = [], L = clashLinesOf(pm), k = clashNeed(pm), w = weights(W, k), wd = weights(WD, k);
  for (let i = 0; i < cells.length; i++) if (cells[i] == null) open.push(i);
  const miss = tune(pm).miss || 0;                               // (the admin's mistake rate: a claim anywhere open)
  if (miss && rng() * 100 < miss) return { move: open[randInt(rng, open.length)], q: 0 };
  const att = i => worth(cells, i, me, w, L), def = i => worth(cells, i, o, wd, L);
  const pref = open.map(i => Math.pow(worth(cells, i, o, w, L) + 0.8 * worth(cells, i, me, wd, L), 3)), sum = pref.reduce((a, b) => a + b, 0) || 1;   // the other player's own choice, as it would weigh it
  const vals = open.map((i, k) => { const a = att(i), d = def(i), p = Math.min(0.85, pref[k] / sum); return { i, p, win: a >= w[k - 1], v: (1 - p) * a + d }; });
  const hi = Math.max(...vals.map(x => x.v)), near = vals.filter(x => x.v >= hi * 0.8 - 1e-9);   // among the cells nearly as good, one at random: a player who can be read is easy to clash with
  const top = near[Math.floor(rng() * near.length)];
  return { move: top.i, q: top.win ? 1 - top.p : 0 };
}
