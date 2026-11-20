// Block Drop: the computer's play. Every place the piece can go is scored by the board it leaves: rows cleared are
// good; height, holes under blocks and an uneven top are bad; filling the board is worst. Normal takes the best place
// give or take a little; Hard also plays the piece after it in its best place and takes the pair worth most; Easy (a third:)
// takes one of the better half at random.
import { blockKind, blockPlaces, blockTry, blocksCfg } from './rules.js';

function shape(g) {
  const cols = g[0].length, rows = g.length; let agg = 0, holes = 0, bump = 0, prev = null;
  for (let x = 0; x < cols; x++) { let h = 0; for (let y = rows - 1; y >= 0; y--) if (g[y][x]) { h = y + 1; break; } for (let y = 0; y < h; y++) if (!g[y][x]) holes++; agg += h; if (prev != null) bump += Math.abs(h - prev); prev = h; }
  return { agg, holes, bump };
}
const value = t => { if (t.over) return -60; const s = shape(t.grid); return t.cleared.length * 12 - s.agg * 0.5 - s.holes * 3.2 - s.bump * 0.4; };
function ranked(pm, me, deep) {
  const g = pm.grid[me], kind = blockKind(pm, me, pm.k[me]), next = blockKind(pm, me, pm.k[me] + 1);
  return blockPlaces(g, kind).map(m => {
    const t = blockTry(g, kind, m.r, m.c); let v = value(t);
    if (deep && !t.over) v = t.cleared.length * 12 + blockPlaces(t.grid, next).reduce((b, n) => Math.max(b, value(blockTry(t.grid, next, n.r, n.c))), -Infinity);
    return { m, v, lines: t.cleared.length };
  }).sort((a, b) => b.v - a.v);
}
export function needs(pm, p) { const c = blocksCfg(pm), left = c.lines - pm.lines[p]; return pm.final && pm.final.by === p ? 1 : left <= 0 ? 0 : Math.max(1, left * 2.3 / c.pieces); }
export function best(pm, me, rng, style, ctx) {
  const c = blocksCfg(pm), level = (ctx && ctx.level) || 'normal', opts = ranked(pm, me, level === 'hard');
  let e = opts[0];
  if (level === 'easy') e = opts[Math.floor(rng() * Math.max(1, Math.ceil(opts.length / 3)))];
  else if (level !== 'hard') { opts.forEach(q => { q.v += rng() * 2.5; }); opts.sort((a, b) => b.v - a.v); e = opts[0]; }
  return { move: e.m, q: pm.lines[me] + e.lines >= c.lines ? 1 : 0 };
}
