// Gem Swap: the computer's play, from the board both players see. A swap is worth the gems it is sure to remove: its
// own line and every cascade the gems already on the board decide (the new gems are not known yet: a cell filled from
// the top lines up with nothing, `gemsResolve` with no rng). Easy takes any swap that makes a line `aiEasy` % of the
// time and the one worth most otherwise. Normal takes the swap worth most now, but for `aiNormal` % taken at random. Hard takes a swap that wins at once;
// else the swap worth most less `aiHard` % of the best swap it would leave the other side on the board it knows (a
// swap that keeps the turn, "Go again" on, counts its own next swap instead), within `ctx.until`.
import { tune } from '../../core/tune.js';
import { GEMS_DEF, gemsArr, gemsCfg, gemsMoves, gemsResolve } from './rules.js';

// What a turn brings on average with the best swap on show taken (tests/sim/gems.sim.js), by the kinds of gem.
export const GEMS_AVG = { 4: 20.6, 5: 10.4, 6: 6.3 };
function swaps(g, n) { return gemsMoves(g, n).map(m => { const r = gemsResolve(g, n, 0, m[0], m[1], null); return { m, pts: r.pts, g: r.g }; }); }
const bestPts = (g, n) => { let b = 0; for (const m of gemsMoves(g, n)) { const r = gemsResolve(g, n, 0, m[0], m[1], null); if (r.pts > b) b = r.pts; } return b; };
export function needs(pm, p) { const c = gemsCfg(pm), left = c.target - pm.pts[p]; return pm.final ? 1 : left <= 0 ? 0 : Math.max(1, left / (GEMS_AVG[pm.kinds] || GEMS_AVG[GEMS_DEF.kinds])); }
export function best(pm, me, rng, style, ctx) {
  const c = gemsCfg(pm), level = (ctx && ctx.level) || 'normal', n = pm.n, all = swaps(gemsArr(pm.b), n), fin = pm.final;
  const left = fin && fin.by === me ? 0 : fin ? fin.pts + 1 - pm.pts[me] : c.target - pm.pts[me];   // (the points this swap needs to take the square: any at all for a leader never answered, past the leader's total for an answer)
  const until = ctx && typeof ctx.until === 'function' ? ctx.until : null;
  if (!all.length) return { move: null, q: 0 };
  const out = e => ({ move: { a: e.m[0], b: e.m[1] }, q: e.pts >= left ? 1 : left - e.pts <= 2 ? 0.25 : 0 });
  const top = (list, val) => { let b = -Infinity, pick = []; for (const e of list) { const v = val(e); if (v > b + 1e-9) { b = v; pick = [e]; } else if (Math.abs(v - b) <= 1e-9) pick.push(e); } return pick[Math.floor(rng() * pick.length)]; };
  if (level === 'easy') return out(rng() * 100 < c.aiEasy ? all[Math.floor(rng() * all.length)] : top(all, e => e.pts));
  if (level === 'normal' && rng() * 100 < (Number.isFinite(Number(tune(pm).aiNormal)) ? Number(tune(pm).aiNormal) : 0)) return out(all[Math.floor(rng() * all.length)]);
  if (level !== 'hard') return out(top(all, e => e.pts));
  all.sort((x, y) => y.pts - x.pts);
  if (all[0].pts >= left || fin) return out(top(all, e => e.pts));  // (a swap that wins; an answer is one turn: all it can get)
  const w = c.aiHard / 100; let seen = 0;
  for (const e of all) {
    if (until && seen >= 4 && until() <= 0) break;                 // out of time: the swaps not looked into stand by what they give now
    const reply = bestPts(e.g, n), mine = c.again && e.pts >= c.againAt;
    e.v = e.pts + (mine ? w : -w) * reply; seen++;
  }
  const mean = seen ? all.slice(0, seen).reduce((s, e) => s + (e.v - e.pts), 0) / seen : 0;
  return out(top(all, e => (e.v != null ? e.v : e.pts + mean)));
}
