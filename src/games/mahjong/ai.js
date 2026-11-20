// Mahjong: the computer's play. Every free pair is a legal move and there is always one. Normal takes a pair that
// uncovers a tile when there is one (it keeps the turn), else any; Hard looks through the whole turn: the order of
// pairs that clears the most before the turn ends (a search over the chains, small); Easy takes any pair.
import { mahjCfg, mahjPairs, mahjUncovers } from './rules.js';

// The most pairs a turn can clear from here (and its first pair), taking chains as far as they go.
function deep(tiles, on, c, left, depth) {
  let best = { n: 0, move: null };
  for (const [i, j] of mahjPairs(tiles, on)) {
    const again = c.chain && mahjUncovers(tiles, on, i, j);
    let n = 1;
    if (again && left > 1 && depth < 6) { const o = on.slice(); o[i] = false; o[j] = false; n += deep(tiles, o, c, left - 1, depth + 1).n; }
    if (n > best.n) best = { n, move: [i, j] };
    if (best.n >= left) break;
  }
  return best;
}
export function needs(pm, p) { const c = mahjCfg(pm), left = c.goal - pm.got[p]; return left <= 0 ? 0 : Math.max(1, left / (c.chain ? 1.5 : 1)); }
export function best(pm, me, rng, style, ctx) {
  const c = mahjCfg(pm), level = (ctx && ctx.level) || 'normal', tiles = pm.lay[me], on = pm.on[me], pairs = mahjPairs(tiles, on), left = c.goal - pm.got[me];
  const pick = a => a[Math.floor(rng() * a.length)], q = left <= 1 ? 1 : 0.1;
  if (pm.final && pm.final.by === me) return { move: pairs[0] || [0, 1], q: 1 };   // the answer never came: any move takes the square
  if (level === 'easy' || !c.chain) return { move: pick(pairs), q };
  if (level === 'hard') { const d = deep(tiles, on, c, left, 0); return { move: d.move || pick(pairs), q: d.n >= left ? 1 : q }; }
  const good = pairs.filter(([i, j]) => mahjUncovers(tiles, on, i, j));
  return { move: pick(good.length ? good : pairs), q };
}
