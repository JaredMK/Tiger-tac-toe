// Coin Pusher: the computer's play (November 2026).
import { randInt } from '../../core/random.js';
import { PUSH, pushCfg, pushSim } from './rules.js';

// The coins a column's push would shove: the coins in the band a drop at slot s lands in, weighted the nearer the front
// edge they lie (a coin at the front is what falls; one at the back only passes the push on).
export function pushPressure(coins, s) {
  const x0 = (s + 0.5) / PUSH.slots, band = PUSH.r * 2.2;
  let v = 0;
  for (const [xi, yi] of coins) {
    const x = xi / PUSH.Q, y = yi / PUSH.Q, dx = Math.abs(x - x0);
    if (dx < band) v += (1 - dx / band) * (y > 0.55 ? (y - 0.55) * 4 : 0.1);
  }
  return v;
}
// Normal: the slot with the most pressure behind it, then its next best (the drops spread along the strongest column).
export function pushNormal(coins, n) {
  const sc = Array.from({ length: PUSH.slots }, (_, s) => [s, pushPressure(coins, s)]).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const out = [];
  for (let k = 0; k < n; k++) out.push(sc[k % 2 === 0 ? 0 : Math.min(sc.length - 1, 1)][0]);
  return out;
}
// What a move did, for Hard: coins over the front, less those lost off the sides, and a little for the pressure it left.
const worth = res => res.pts * 10 - res.lost * 6 + 0.5 * Math.max(...Array.from({ length: PUSH.slots }, (_, s) => pushPressure(res.coins, s)));
// Hard's candidates: Normal's drops, every slot three times over, and the strongest columns paired with their neighbours.
function candidates(coins, n, tries) {
  const sc = Array.from({ length: PUSH.slots }, (_, s) => [s, pushPressure(coins, s)]).sort((a, b) => b[1] - a[1] || a[0] - b[0]), seen = new Set(), out = [];
  const add = list => { const k = list.slice().sort((a, b) => a - b).join(','); if (!seen.has(k)) { seen.add(k); out.push(list); } };
  add(pushNormal(coins, n));
  for (const [s] of sc) add(Array(n).fill(s));
  for (let i = 0; i < 3; i++) for (const d of [-1, 1]) { const t = sc[i][0] + d; if (t >= 0 && t < PUSH.slots) add(Array.from({ length: n }, (_, k) => (k % 2 ? t : sc[i][0]))); }
  return out.slice(0, Math.max(1, tries));
}
// The turns p still needs, about: the coins left to the target over what a move pushes off, about (tests/sim/pusher.sim.js).
export const PUSH_RATE = 2.4;
export function needs(pm, p) { const c = pushCfg(pm); return Math.max(1, (c.target - pm.score[p]) / PUSH_RATE); }
export function best(pm, me, rng, style, ctx) {
  const c = pushCfg(pm), n = Math.max(1, c.perMove | 0), coins = pm.coins[me], lvl = ctx && ctx.level, left = c.target - pm.score[me];
  const q = left <= 1 ? 0.7 : left <= 2 ? 0.5 : left <= 3 ? 0.35 : left <= 5 ? 0.12 : 0;
  if (lvl === 'easy') return { move: { s: Array.from({ length: n }, () => randInt(rng, PUSH.slots)) }, q };
  if (lvl !== 'hard') return { move: { s: pushNormal(coins, n) }, q };
  // Hard: each candidate through the real push (its drops at the slots' centres: the scatter is luck), the best kept.
  let top = null;
  const until = ctx && typeof ctx.until === 'function' ? ctx.until : null;
  for (const s of candidates(coins, n, c.aiTries)) {
    if (top && until && until() <= 0) break;
    const drops = s.map(k => [Math.round(((k + 0.5) / PUSH.slots) * PUSH.Q), 0]), res = pushSim(c, coins, drops, false, 0.25), v = worth(res);   // (the bar's start is luck: a middling one)
    if (!top || v > top.v) top = { s, v, res };
  }
  const won = top.res.pts >= left;
  return { move: { s: top.s }, q: won ? Math.max(q, 0.8) : q };
}
