// Block Drop: the computer's play. Every place the piece can go is scored by the board it leaves: rows cleared are
// good; height, holes under blocks and an uneven top are bad; filling the board is worst. By level (below): Normal takes
// the best place give or take a little; Hard also plays the piece after it in its best place and takes the pair worth
// most; Easy takes one of the best third at random.
import { tune } from '../../core/tune.js';
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
const LV = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
const lvNum = (pm, key, level, D) => { const L = LV[level] ? level : 'normal', v = tune(pm)[key + LV[L]]; return v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : D[L]; };
// Each level's play is its settings (meta.js TUNE, Computer: Easy / Normal / Hard): how many pieces it thinks ahead
// (`aiLook<Level>`: 1 the piece in hand, 2 the next one too), how loosely it judges a place (`aiLoose<Level>`: a random
// amount up to that added to each place's worth) and how wide it picks (`aiShare<Level>`, %: one of that share of the
// best places at random).
export const LOOK = { easy: 1, normal: 1, hard: 2 }, LOOSE = { easy: 0, normal: 2.5, hard: 0 }, SHARE = { easy: 33, normal: 0, hard: 0 };
export function best(pm, me, rng, style, ctx) {
  const c = blocksCfg(pm), level = (ctx && ctx.level) || 'normal', opts = ranked(pm, me, lvNum(pm, 'aiLook', level, LOOK) >= 2);
  const loose = lvNum(pm, 'aiLoose', level, LOOSE), share = lvNum(pm, 'aiShare', level, SHARE);
  if (loose > 0) { opts.forEach(q => { q.v += rng() * loose; }); opts.sort((a, b) => b.v - a.v); }
  const e = share > 0 ? opts[Math.floor(rng() * Math.max(1, Math.ceil(opts.length * share / 100)))] : opts[0];
  return { move: e.m, q: pm.lines[me] + e.lines >= c.lines ? 1 : 0 };
}
// A weaker place a person might choose (the mistake rate, core/ai.js aiSlip): one of the worse half of the places.
export function worse(pm, me, rng, ctx) {
  const opts = ranked(pm, me, false), b = ctx && ctx.best, rest = opts.slice(Math.floor(opts.length / 2)).filter(q => !(b && q.m.r === b.r && q.m.c === b.c));
  return rest.length ? rest[Math.floor(rng() * rest.length)].m : null;
}
