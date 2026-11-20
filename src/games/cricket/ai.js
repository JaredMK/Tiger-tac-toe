// Darts Cricket: the computer's play. It aims at a spot and lands off it by an error of its level's size (wall units,
// a normal spread each way: `aiErr`). Normal and Hard weigh the spots worth trying (each number still open: its wedge's
// middle and its outer band's; the bullseye) by the marks a dart aimed there is worth on average, over a grid of
// where it may land, and take the best; Easy aims at the middle of any open number. With scoring on and everything
// closed but behind on points, it aims at a number the other player has not closed.
import { gaussOf } from '../../core/random.js';
import { cricketAt, cricketCfg, cricketOpen, cricketSpot } from './rules.js';

const GRID = [-1.5, -0.75, 0, 0.75, 1.5], WT = GRID.map(z => Math.exp(-z * z / 2));
function worth(pm, c, me, sx, sy, err) {                           // the useful marks (and points) of a dart aimed at (sx, sy)
  const o = me === 'X' ? 'O' : 'X'; let sum = 0, tot = 0;
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    const w = WT[i] * WT[j], h = cricketAt(pm, c, sx + GRID[i] * err, sy + GRID[j] * err); tot += w;
    if (h.t < 0) continue;
    const add = Math.min(h.n, c.hits - pm.marks[me][h.t]);
    sum += w * (add + (c.scoring && pm.marks[o][h.t] < c.hits ? (h.n - add) * 0.5 : 0));
  }
  return sum / tot;
}
function options(pm, c, me, err) {
  const o = me === 'X' ? 'O' : 'X', n = pm.nums.length; let open = cricketOpen(pm, c, me);
  if (!open.length) open = pm.marks[o].map((v, t) => (v < c.hits ? t : -1)).filter(t => t >= 0);   // (behind on points: where a mark still scores)
  if (!open.length) open = [n];
  const out = [];
  for (const t of open) { out.push({ t, s: cricketSpot(pm, c, t, false) }); if (t < n && c.band > 0) out.push({ t, s: cricketSpot(pm, c, t, true) }); }
  out.forEach(e => { e.w = worth(pm, c, me, e.s[0], e.s[1], err); });
  return out;
}
export function needs(pm, p) {
  const c = cricketCfg(pm), left = pm.marks[p].reduce((x, v) => x + Math.max(0, c.hits - v), 0);
  if (left <= 0) return c.scoring && pm.pts[p] < pm.pts[p === 'X' ? 'O' : 'X'] ? 2 : 0;
  const best = options(pm, c, p, c.ai.normal).reduce((x, e) => Math.max(x, e.w), 0.15);
  return Math.max(1, left / best);
}
export function best(pm, me, rng, style, ctx) {
  const c = cricketCfg(pm), level = (ctx && ctx.level) || 'normal', err = c.ai[level] == null ? c.ai.normal : c.ai[level], opts = options(pm, c, me, err);
  const e = level === 'easy' ? opts.filter(q => q.s === opts.find(z => z.t === q.t).s)[Math.floor(rng() * new Set(opts.map(q => q.t)).size)] : opts.slice().sort((a, b) => b.w - a.w)[0];
  const cl = v => Math.max(0, Math.min(1, Math.round(v * 10) / 1000));
  const left = pm.marks[me].reduce((x, v) => x + Math.max(0, c.hits - v), 0);
  return { move: { x: cl(e.s[0] + gaussOf(rng) * err), y: cl(e.s[1] + gaussOf(rng) * err) }, q: left <= 2 ? e.w / 2 : 0 };
}
