// Tank Duel: the computer's play. A firing solution by search, then an error of its level's size: it runs candidate
// angles and powers through the rules' own shot (tankTry: the wind, the hills, both tanks) and keeps the ones that do
// the other tank most harm for least to itself (`solve`: a coarse sweep of elevations towards the other tank and of
// powers, then every angle and power round the best few). Easy and Normal take the one nearest an elevation of their
// liking that shot (40 to 65 degrees: a lob, as a player's first try); Hard the one that still does best when its angle
// and power are a little off (`robust`: a flat, hard shot where the way is clear, which forgives the power). Then the
// angle is off by a normal spread of `aiAng` degrees and the power by `aiPow` points, by level:
// the error stands in for a player's eye. Hard ranges in: with its last shot fired from the same column at the same
// column (`sh[me]`), its errors are `aiRange` per cent of themselves.
// It drives only when it has no shot from where it stands (no solution that harms the other tank: a hill in the way):
// to the nearest column that has one. Hard also drives off the bottom of a crater it has just been blasted into (the
// other side has its range), as far as it can go and still have a shot. Within `ctx.until`.
import { gaussOf } from '../../core/random.js';
import { other } from '../../core/util.js';
import { TANK, tankCfg, tankDrive, tankHeights, tankTry } from './rules.js';

const left = until => (typeof until === 'function' ? until() : Infinity);
// What a shot is worth to `me`: the other tank's damage less its own twice over, where that comes to something;
// where it does no harm at all, how near the other tank it fell (below zero: any harm beats any miss; off the field
// -500); and a shot that costs itself as much as it gains is worse than any miss (-1000 and its net).
function worth(c, H, wind, at, me, m) {
  const o = other(me), t = tankTry(c, H, wind, at, me, m), net = t.dmg[o] - 2 * t.dmg[me];
  if (net > 0) return net;
  if (t.dmg[o] > 0 || t.dmg[me] > 0) return -1000 + net;
  if (t.hit === 'out') return -500;
  const dx = t.x - at[o], dy = t.y - (H[at[o]] + TANK.cy);
  return -Math.sqrt(dx * dx + dy * dy);
}
// The solutions from where `me` stands after driving d: [{ m, v }], best first (a coarse sweep, then round the best).
export function solve(c, H, wind, at, me, d) {
  const o = other(me), to = tankDrive(H, c, at[me], d, at[o]), right = at[o] >= to, seen = {}, all = [];
  const tryAt = (el, p) => {
    if (el < 5 || el > 89 || p < TANK.pmin || p > TANK.pmax) return;
    const key = el * 128 + p; if (seen[key]) return; seen[key] = 1;
    const m = { d, a: right ? el : 180 - el, p };
    all.push({ m, el, v: worth(c, H, wind, at, me, m) });
  };
  for (let el = 15; el <= 85; el += 5) for (let p = TANK.pmin; p <= TANK.pmax; p += 3) tryAt(el, p);
  const top = all.slice().sort((a, b) => b.v - a.v), picked = [];
  for (const s of top) { if (picked.length >= 4) break; if (!picked.some(q => Math.abs(q.el - s.el) < 10)) picked.push(s); }
  for (const s of picked) for (let de = -3; de <= 3; de++) for (let dp = -3; dp <= 3; dp++) tryAt(s.el + de, s.m.p + dp);
  return all.sort((a, b) => b.v - a.v);
}
// A solution's worth when the angle and the power are each off by e either way (Hard's choice among its solutions).
function robust(c, H, wind, at, me, s, e) {
  let sum = 0, n = 0;
  for (const da of [-e[0], 0, e[0]]) for (const dp of [-e[1], 0, e[1]]) {
    const m = { d: s.m.d, a: Math.max(0, Math.min(180, Math.round(s.m.a + da))), p: Math.max(TANK.pmin, Math.min(TANK.pmax, Math.round(s.m.p + dp))) };
    const v = worth(c, H, wind, at, me, m), w = da === 0 && dp === 0 ? 2 : 1;
    sum += (v > 0 ? v : v <= -900 ? v + 1000 : Math.max(-8, v / 4)) * w; n += w;   // (a miss counts a little by how near it fell; a hit on itself by what it cost)
  }
  return sum / n;
}
// The share of a direct hit an average Normal shot does (tests/sim/tanks.sim.js: about five shots for 100 health at 40 a hit).
const RATE = 0.5;
export function needs(pm, p) { const c = tankCfg(pm); return Math.max(1, pm.hp[other(p)] / Math.max(1, c.hitDmg * RATE)); }
export function best(pm, me, rng, style, ctx) {
  const c = tankCfg(pm), level = (ctx && ctx.level) || 'normal', until = ctx && ctx.until, o = other(me), H = tankHeights(pm.h), at = pm.at, wind = pm.wind;
  const e0 = c.ai[level] || c.ai.normal, sh = pm.sh && pm.sh[me], l = pm.last;
  let d = 0, sols = solve(c, H, wind, at, me, 0);
  const hasShot = s => s.length && s[0].v > 0;
  // off the bottom of a crater it was just blasted into (Hard): the furthest drive that still has a shot
  const pit = level === 'hard' && l && l.by === o && l.hit !== 'out' && l.dmg[me === 'X' ? 0 : 1] > 0 && c.fuel > 0
    && H[at[me]] < Math.min(H[Math.max(0, at[me] - 4)], H[Math.min(TANK.w - 1, at[me] + 4)]);
  if (!hasShot(sols) || pit) {
    const order = []; for (let k = 1; k <= c.fuel; k++) order.push(k, -k);
    if (pit) order.reverse();
    let pick = null, far = 0;
    for (const dd of order) {
      if (left(until) <= 0) break;
      const to = tankDrive(H, c, at[me], dd, at[o]); if (to === at[me]) continue;
      const s = solve(c, H, wind, at, me, dd);
      if (!hasShot(s)) { if (!pick && s.length && (!sols.length || s[0].v > sols[0].v)) { sols = s; d = dd; } continue; }
      if (!pit) { pick = s; d = dd; break; }
      if (Math.abs(to - at[me]) > far) { far = Math.abs(to - at[me]); pick = s; d = dd; }
    }
    if (pick) sols = pick; else if (pit && hasShot(solve(c, H, wind, at, me, 0))) { d = 0; sols = solve(c, H, wind, at, me, 0); }
  }
  const q = pm.hp[o] <= c.hitDmg * 0.35 ? 0.6 : pm.hp[o] <= c.hitDmg ? 0.3 : 0;   // (its chance of ending the square with this shot: a near miss would do, or only a direct hit)
  if (!sols.length) return { move: { d: 0, a: at[o] >= at[me] ? 60 : 120, p: 60 }, q: 0 };
  const good = sols.filter(s => s.v >= sols[0].v - Math.max(2, Math.abs(sols[0].v) * 0.1));
  const to = tankDrive(H, c, at[me], d, at[o]), ranged = level === 'hard' && !!sh && sh[0] === to && sh[5] === at[o], k = ranged ? c.range / 100 : 1, e = [e0[0] * k, e0[1] * k];
  let s;
  if (level === 'hard') {
    const cand = []; for (const g of good) { if (cand.length >= 6) break; if (!cand.some(x => Math.abs(x.el - g.el) < 4)) cand.push(g); }
    let bv = -Infinity; s = cand[0];
    for (const g of cand) { if (left(until) <= 0) break; const v = robust(c, H, wind, at, me, g, [Math.max(1, e[0]), Math.max(1, e[1])]); if (v > bv) { bv = v; s = g; } }
  } else { const like = 40 + rng() * 25; s = good.slice().sort((a, b) => Math.abs(a.el - like) - Math.abs(b.el - like))[0]; }
  const a = Math.max(0, Math.min(180, Math.round(s.m.a + gaussOf(rng) * e[0]))), p = Math.max(TANK.pmin, Math.min(TANK.pmax, Math.round(s.m.p + gaussOf(rng) * e[1])));
  return { move: { d, a, p }, q };
}
