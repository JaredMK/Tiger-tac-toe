// Peg Drop: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { other } from '../../core/util.js';
import { PLINKO, plinkoBonusPts, plinkoDist, plinkoExp, plinkoOpen, plinkoTouches, plinkoWays } from './rules.js';

export function needs(pm, p) {
  const e = Array.from({ length: PLINKO.slots }, (_, k) => plinkoExp(pm, k)), best = Math.max(...plinkoOpen(pm).map(k => e[k])), mean = e.reduce((x, y) => x + y, 0) / e.length; return Math.max(1, (pm.target - pm.pts[p]) / ((best + mean) / 2));
}
export function best(pm, me, rng, style, ctx) {   // the open slot with the most points to expect (the bonus peg counted); level, the likelier to finish. Hard: the likelier to win the square (plinkoHard)
  const need = pm.target - pm.pts[me], q = k => Object.entries(plinkoDist(pm, k)).reduce((t, [v, c]) => t + (Number(v) >= need ? c : 0), 0);
  const miss = tune(pm).miss;
  if (miss && rng() * 100 < miss) { const open = plinkoOpen(pm), k = open[randInt(rng, open.length)]; return { move: k, q: q(k), exp: plinkoExp(pm, k) }; }   // (now and then, the admin's mistake rate, any open slot)
  if (ctx && ctx.level === 'hard') { const k = plinkoHard(pm, me); return { move: k, q: q(k), exp: plinkoExp(pm, k) }; }
  let move = -1, top = -1, tq = -1;
  for (const k of plinkoOpen(pm)) { const e = plinkoExp(pm, k), qk = q(k); if (e > top + 1e-9 || (Math.abs(e - top) < 1e-9 && qk > tq)) { move = k; top = e; tq = qk; } }
  return { move, q: tq, exp: top };
}

// ---- Hard: the race ----
// The open slot with the best chance of winning the square: every outcome of my drop (plinkoDist: the bin and
// the bonus peg), then the other side's best reply over the slots still open (the one I use locks for them
// too; a bonus peg I hit moves, so their reply is reckoned without one), then the race from there (plinkoRace:
// each turn a typical drop, the mean of the seven slots, until one side reaches the target).
function drops(pm, k) {                                         // a drop's outcomes from slot k: [points, chance, the peg hit]
  const out = new Map(), b = pm.bonus, bonus = plinkoBonusPts(pm);
  for (const w of plinkoWays(k)) { const hit = !!b && plinkoTouches(k, w.path)[b.r - 1] === b.x, key = (pm.vals[w.bin] + (hit ? bonus : 0)) * 2 + (hit ? 1 : 0); out.set(key, (out.get(key) || 0) + w.p); }
  return [...out].map(([key, p]) => [key >> 1, p, key & 1]);
}
export function plinkoRace(T, D) {   // R[a * T + b]: the chance the player to move, a points to the other's b, wins
  const R = new Float64Array(T * T);
  for (let s = 2 * T - 2; s >= 0; s--) for (let a = Math.min(T - 1, s); a >= 0 && s - a < T; a--) {
    const b = s - a; let v = 0;
    for (const [x, p] of D) v += p * (a + x >= T ? 1 : 1 - R[b * T + a + x]);
    R[a * T + b] = v;
  }
  return R;
}
export function plinkoHard(pm, me) {
  const T = pm.target, a = Math.min(T - 1, pm.pts[me]), b = Math.min(T - 1, pm.pts[other(me)]);
  const open = plinkoOpen(pm), all = Array.from({ length: PLINKO.slots }, (_, k) => k);
  const withPeg = all.map(k => drops(pm, k)), noPeg = all.map(k => drops(Object.assign({}, pm, { bonus: null }), k));
  const mean = {}; for (const d of withPeg) for (const [v, p] of d) mean[v] = (mean[v] || 0) + p / PLINKO.slots;
  const R = plinkoRace(T, Object.entries(mean).map(([v, p]) => [Number(v), p]));
  const reply = (used, ds, a2) => {                               // the other side's best drop, then my chance
    let top = 0;
    for (let j = 0; j < PLINKO.slots; j++) { if (used[j]) continue; let v = 0; for (const [x, p] of ds[j]) v += p * (b + x >= T ? 1 : 1 - R[a2 * T + b + x]); if (v > top) top = v; }
    return 1 - top;
  };
  let move = open[0], best = -1, bq = -1, be = -1;
  for (const k of open) {
    const used = pm.used.slice(); used[k] = true;
    if (used.every(Boolean)) used.fill(false);
    let v = 0, q = 0, e = 0;
    for (const [x, p, hit] of withPeg[k]) { v += p * (a + x >= T ? 1 : reply(used, hit ? noPeg : withPeg, a + x)); e += p * x; if (a + x >= T) q += p; }
    if (v > best + 1e-9 || (v > best - 1e-9 && (q > bq + 1e-9 || (q > bq - 1e-9 && e > be)))) { best = v; bq = q; be = e; move = k; }   // (alike: the square now, then the points)
  }
  return move;
}
