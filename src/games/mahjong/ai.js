// Mahjong: the computer's play (December 2026, the hand-building game).
// What it knows: its own hand and the discard piles (open), so the tiles it has not seen (its tile set less its hand and
// every pile it can see: in a race its own set alone; the other side's hand is the other side's alone, never in its
// view: publicView with its side). A hand's distance from complete is its step count (rules.js mjShanten: -1 complete,
// 0 one tile away). Normal throws the tile that leaves the fewest steps, ties by how many kinds of tile would bring it a
// step closer; it takes the pile's tile (Shared) when that wins or brings it a step closer. Hard counts the tiles left
// unseen that would bring it closer (its outs, by copy), and takes the pile's tile when its hand after the best throw
// beats the wall's average draw. Easy: Normal's play, never taking the pile's tile but to win. Each level's mistakes
// (aiMiss<Level>: Easy 50%, Normal 25% by default) are a careless throw, a tile of its hand at random, or the wall's tile over the
// pile's (`worse`).
import { randInt } from '../../core/random.js';
import { mjCfg, mjComplete, mjKinds, mjShanten, mjTiles } from './rules.js';

export const MJ_AI = { base: 2.5, perStep: 2.2 };
const keyOf = (pm, p) => (pm.mode === 'shared' ? 'S' : p);
// The tiles it has not seen, by copy.
export function mjUnseen(pm, p) {
  const c = mjCfg(pm), seen = [...(pm.hand[p] || [])];
  for (const [k, pile] of Object.entries(pm.pile || {})) if (pm.mode === 'shared' || k === p) seen.push(...pile);
  const left = new Map(); for (const t of mjTiles(c)) left.set(t, (left.get(t) || 0) + 1);
  for (const t of seen) if (left.get(t)) left.set(t, left.get(t) - 1);
  return left;
}
// A hand ready to throw from (3m + 1 tiles): its steps and how many tiles (of `pool`, a Map tile -> copies; kinds when
// `kinds`) would bring it a step closer.
function value(h, m, pool, kinds) {
  const s = mjShanten(h, m); let outs = 0;
  for (const [t, n] of pool) { if (!n) continue; if (mjShanten(h.concat(t), m) < s) outs += kinds ? 1 : n; }
  return { s, outs, v: -1000 * s + outs };
}
function bestThrow(h, m, pool, kinds, rng) {
  let best = [], bv = -Infinity, bs = 99;
  for (const d of [...new Set(h)]) { const rest = h.slice(); rest.splice(rest.indexOf(d), 1); const x = value(rest, m, pool, kinds); if (x.v > bv) { bv = x.v; bs = x.s; best = [d]; } else if (x.v === bv) best.push(d); }
  return { d: rng ? best[randInt(rng, best.length)] : best[0], v: bv, s: bs };
}
export function needs(pm, p) {
  const m = mjCfg(pm).sets;
  if (!Array.isArray(pm.hand && pm.hand[p])) { const sc = Math.min(m, (pm.sc && pm.sc[p]) || 0); return MJ_AI.base + MJ_AI.perStep * Math.max(0, 2 * (m - sc)); }
  const h = pm.hand[p], s = pm.held && pm.held.by === p ? Math.min(...[...new Set(h)].map(d => { const r = h.slice(); r.splice(r.indexOf(d), 1); return mjShanten(r, m); })) : mjShanten(h, m);
  return s < 0 ? 1 : MJ_AI.base * 0.4 + MJ_AI.perStep * (s + 1);
}
export function best(pm, me, rng, style, ctx) {
  const c = mjCfg(pm), m = c.sets, lvl = (ctx && ctx.level) || 'normal', h = pm.hand[me], held = pm.held && pm.held.by === me;
  const top = pm.mode === 'shared' ? ((pm.pile && pm.pile[keyOf(pm, me)]) || []).slice(-1)[0] : null;
  const hard = lvl === 'hard', pool = hard ? mjUnseen(pm, me) : new Map(mjKinds(c).map(t => [t, 1]));
  if (held) {
    const b = bestThrow(h, m, pool, !hard, rng);
    return { move: { d: b.d }, q: b.s === 0 ? 0.15 : 0 };
  }
  if (top) {
    const withTop = h.concat(top);
    if (mjComplete(withTop)) return { move: 'pile', q: 1 };
    if (lvl !== 'easy') {
      const now = mjShanten(h, m), after = bestThrow(withTop, m, pool, !hard);
      if (!hard) { if (after.s < now) return { move: 'pile', q: 0 }; }
      else {
        // the wall's tile: each unseen tile as likely, the hand after its best throw
        let sum = 0, n = 0, wins = 0;
        for (const [t, k] of pool) { if (!k) continue; const w = h.concat(t); if (mjComplete(w)) { wins += k; sum += 2000 * k; } else sum += bestThrow(w, m, pool, false).v * k; n += k; }
        if (after.v > (n ? sum / n : -Infinity)) return { move: 'pile', q: 0 };
        return { move: 'wall', q: n ? wins / n : 0 };
      }
    }
  }
  return { move: 'wall', q: 0 };
}
// A slip (the level's mistake rate): holding a tile, a careless throw (any tile of its hand); else the wall's tile.
export function worse(pm, me, rng) {
  const h = pm.hand && pm.hand[me];
  if (!Array.isArray(h) || !h.length) return null;
  if (pm.held && pm.held.by === me) return { d: h[randInt(rng, h.length)] };
  return 'wall';
}
