// Coin Pusher: the computer's play (November 2026; reworked with the timed dropper).
import { randInt } from '../../core/random.js';
import { PUSH, pushCfg, pushDropX, pushDrops, pushMaxSteps, pushSim, pushStars } from './rules.js';

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
// Normal's columns: the one with the most pressure behind it, then its next best (the drops spread along the strongest column).
export function pushNormal(coins, n) {
  const sc = Array.from({ length: PUSH.slots }, (_, s) => [s, pushPressure(coins, s)]).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const out = [];
  for (let k = 0; k < n; k++) out.push(sc[k % 2 === 0 ? 0 : Math.min(sc.length - 1, 1)][0]);
  return out;
}
// What a move did, for Hard: coins over the front, less those lost off the sides, and a little for the pressure it left.
const worth = res => res.pts * 10 - res.lost * 6 + 0.5 * Math.max(...Array.from({ length: PUSH.slots }, (_, s) => pushPressure(res.coins, s)));
// Hard's candidates: Normal's columns, every column three times over, and the strongest columns paired with their neighbours.
function candidates(coins, n, tries) {
  const sc = Array.from({ length: PUSH.slots }, (_, s) => [s, pushPressure(coins, s)]).sort((a, b) => b[1] - a[1] || a[0] - b[0]), seen = new Set(), out = [];
  const add = list => { const k = list.join(','); if (!seen.has(k)) { seen.add(k); out.push(list); } };
  add(pushNormal(coins, n));
  for (const [s] of sc) add(Array(n).fill(s));
  for (let i = 0; i < 3; i++) for (const d of [-1, 1]) { const t = sc[i][0] + d; if (t >= 0 && t < PUSH.slots) add(Array.from({ length: n }, (_, k) => (k % 2 ? t : sc[i][0]))); }
  return out.slice(0, Math.max(1, tries));
}
const gauss = rng => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
// The taps that drop coins over the columns `cols` (slots), as a hand would make them: the first when the dropper is over
// the first column (dp chosen so: its moment is the move's start), each next one the next time the dropper passes over
// its column, at least `gap` steps on; each tap off by a timing error of about `err` ms (0: exact). ph: the bar's place.
export function pushPlan(c, cols, ph, err, rng) {
  const r = PUSH.r, half = (1 - 2 * r), tx = s => Math.max(r, Math.min(1 - r, (s + 0.5) / PUSH.slots)), off = () => (err > 0 ? gauss(rng) * err / 1000 : 0);
  // the first: dp puts the dropper over the column now, going right (the cycle's rising half), shifted by the hand's error
  let dp = ((tx(cols[0]) - r) / half) / 2 + off() / Math.max(0.5, c.dropPeriod);
  dp = ((dp % 1) + 1) % 1;
  const dpi = Math.round(dp * 1000) % 1000, k = [0], max = pushMaxSteps(c), gap = Math.round(PUSH.hz * 0.25);
  for (let i = 1; i < cols.length; i++) {
    const want = tx(cols[i]);
    let best = null;
    for (let s = k[i - 1] + gap; s <= Math.min(max, k[i - 1] + gap + Math.round(c.dropPeriod * PUSH.hz) + 1); s++) {
      const d = Math.abs(pushDropX(c, s / PUSH.hz, dpi / 1000) - want);
      if (!best || d < best.d - 1e-9) best = { s, d };
    }
    let s = best ? best.s + Math.round(off() * PUSH.hz) : k[i - 1] + 1;
    s = Math.max(k[i - 1] + 1, Math.min(max - (cols.length - 1 - i), s));
    k.push(s);
  }
  return { ph: Math.max(0, Math.min(999, Math.round(ph * 1000))), dp: dpi, k };
}
// The turns p still needs, about: the coins left to the target over what a move pushes off, about (tests/sim/pusher.sim.js).
export const PUSH_RATE = 2.8;
export function needs(pm, p) { const c = pushCfg(pm); return Math.max(1, (c.target - pm.score[p]) / PUSH_RATE); }
export function best(pm, me, rng, style, ctx) {
  const c = pushCfg(pm), n = Math.max(1, c.perMove | 0), coins = pm.coins[me], lvl = ctx && ctx.level, left = c.target - pm.score[me];
  const q = left <= 1 ? 0.7 : left <= 2 ? 0.5 : left <= 3 ? 0.35 : left <= 5 ? 0.12 : 0;
  const ph = rng();                                               // (where the bar is when it starts: whenever it happens to)
  if (lvl === 'easy') return { move: pushPlan(c, Array.from({ length: n }, () => randInt(rng, PUSH.slots)), ph, c.aiErrEasy, rng), q };
  if (lvl !== 'hard') return { move: pushPlan(c, pushNormal(coins, n), ph, c.aiErr, rng), q };
  // Hard: each candidate's exact taps through the real push (its own stars and the bar where it is), the best kept, then
  // tapped with Hard's own (small) timing error.
  let top = null;
  const until = ctx && typeof ctx.until === 'function' ? ctx.until : null, stars = pushStars(pm, me, c, n);
  for (const cols of candidates(coins, n, c.aiTries)) {
    if (top && until && until() <= 0) break;
    const mv = pushPlan(c, cols, ph, 0, rng), res = pushSim(c, coins, pushDrops(c, mv, stars), false, mv.ph / 1000), v = worth(res);
    if (!top || v > top.v) top = { cols, v, res };
  }
  const won = top.res.pts >= left;
  return { move: pushPlan(c, top.cols, ph, c.aiErrHard, rng), q: won ? Math.max(q, 0.8) : q };
}
