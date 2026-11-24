// Shuffleboard: the computer's play. It picks how far to send the puck, straight up the middle, and is off by an
// error of its level's size (a share of the distance, in percent: `aiErr`), on top of the lane's own spread. Every level
// sends it the distance worth the most on average (each zone's points, never more than are needed, times the
// chance of stopping in it, the lane's end counted as nothing), but for its mistakes (`aiMiss<Level>`, `worse`:
// anywhere in the zones). On a shared
// lane it sends the puck up the left, the middle or the right: Normal the way with the fewest pucks in it, Hard the
// way that would strike one of the other side's pucks in a zone, else the clearest.
import { gaussOf } from '../../core/random.js';
import { SHUF, shufCfg, shufFlickAt } from './rules.js';

const phi = z => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), q = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - q : q; };
function plan(c, level, need) {
  const err = c.ai[level] == null ? c.ai.normal : c.ai[level], sdp = Math.hypot(err, c.spread) / 100;
  let best = { d: c.z0 + c.zl * 1.5, ev: -1, win: 0 };
  for (let d = c.z0 - 5; d <= SHUF.len; d += 1) {
    const sd = Math.max(0.5, d * sdp); let ev = 0, win = 0;
    for (let z = 0; z < 3; z++) { const lo = c.z0 + z * c.zl, hi = z === 2 ? SHUF.len : lo + c.zl, pr = phi((hi - d) / sd) - phi((lo - d) / sd); ev += pr * Math.min(need, c.vals[z]); if (c.vals[z] >= need) win += pr; }
    if (ev > best.ev) best = { d, ev, win };
  }
  return Object.assign(best, { err });
}
export function needs(pm, p) { const c = shufCfg(pm), need = c.target - pm.score[p]; return need <= 0 ? 0 : Math.max(1, need / Math.max(0.2, plan(c, 'normal', need).ev)); }
export function best(pm, me, rng, style, ctx) {
  const c = shufCfg(pm), level = (ctx && ctx.level) || 'normal', b = plan(c, level, c.target - pm.score[me]);
  let x0 = SHUF.w / 2;
  if (pm.shared && pm.pucks.length && level !== 'easy') {
    const ways = [SHUF.w / 2, SHUF.w * 0.24, SHUF.w * 0.76].map((x, k) => { const inWay = pm.pucks.filter(q => Math.abs(q.x - x) < 2 * SHUF.r + 1); return { x, n: inWay.length, foe: inWay.some(q => q.by !== me) && !inWay.some(q => q.by === me), k }; });
    ways.sort((a, z) => (level === 'hard' ? (z.foe - a.foe) : 0) || (a.n - z.n) || (a.k - z.k)); x0 = ways[0].x;
  }
  const d = b.d * (1 + gaussOf(rng) * b.err / 100), x = x0 + gaussOf(rng) * b.err / 100 * 30;
  return { move: shufFlickAt(c, x, Math.max(1, d)), q: b.win };
}
// A weaker push a person might make (the mistake rate, core/ai.js aiSlip): anywhere in the zones, straight up the
// middle, with the level's error.
export function worse(pm, me, rng, ctx) {
  const c = shufCfg(pm), level = (ctx && (ctx.diff || ctx.level)) || 'normal', err = c.ai[level] == null ? c.ai.normal : c.ai[level];
  return shufFlickAt(c, SHUF.w / 2 + gaussOf(rng) * err / 100 * 30, Math.max(1, (c.z0 + rng() * 3 * c.zl) * (1 + gaussOf(rng) * err / 100)));
}
