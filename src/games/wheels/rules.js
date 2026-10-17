// Risk Wheels: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt, shuffle } from '../../core/random.js';
import { r3 } from '../../core/util.js';
import { WHEEL_DEFAULTS } from './meta.js';

// ---------- Risk Wheels ----------
// Each player has their own points; first to the target wins. Each square deals three wheels of 10 equal
// segments, drawn afresh (and drawn again until every rule holds):
//   high: one or two 10s; the rest 0s, but for at most two small values (1-2); the lowest average;
//   mid:  no 10s; at least two 5s; a top value above the low wheel's top; its average between the other two;
//   low:  every value 1-4, at least two different; the highest average;
// and the three averages at least 0.4 apart. A move: one wheel spun once (by the server online), its
// segment's points added. The target and the generation's ranges are the admin's (config/wheels); the
// wheels and the target are copied into each square as dealt.
export const WHEELS = ['high', 'mid', 'low'];
export const WHEEL_SEGS = 10;
export const WHEEL_LIMITS = { target: [6, 60], tensMin: [1, 3], tensMax: [1, 3], smallMax: [0, 4], smallTop: [1, 3], midLo: [0, 3], midHi: [5, 9], lowLo: [1, 3], lowHi: [2, 6], gap: [0.1, 1.5] };
export const WHEELT = { spin: 1900, hold: 700 };                            // the spin, then the result held
export const WHEEL_CFG = { cfg: null };
export function wheelsNorm(raw) {
  const out = {};
  for (const k of Object.keys(WHEEL_DEFAULTS)) {
    const [lo, hi] = WHEEL_LIMITS[k], x = raw && raw[k] != null ? Number(raw[k]) : NaN;
    out[k] = Number.isFinite(x) && x >= lo && x <= hi ? (k === 'gap' ? Math.round(x * 100) / 100 : Math.round(x)) : WHEEL_DEFAULTS[k];
  }
  if (out.tensMax < out.tensMin) out.tensMax = out.tensMin;
  if (out.lowHi <= out.lowLo) out.lowHi = out.lowLo + 1;
  return out;
}
export function setWheelsConfig(raw) { WHEEL_CFG.cfg = raw && typeof raw === 'object' ? wheelsNorm(raw) : null; }
export const wheelsConfig = () => Object.assign({}, WHEEL_CFG.cfg || WHEEL_DEFAULTS);
export const wheelAvg = v => v.reduce((t, x) => t + x, 0) / v.length;
// Every rule a wheel set must keep (for the generator, and the tests): the reasons it fails, none if it holds.
export function wheelsCheck(w, g) {
  g = g || WHEEL_DEFAULTS;
  const bad = [], { high, mid, low } = w, ok = v => Array.isArray(v) && v.length === WHEEL_SEGS && v.every(x => Number.isInteger(x) && x >= 0 && x <= 10);
  if (!ok(high) || !ok(mid) || !ok(low)) return ['shape'];
  const tens = high.filter(x => x === 10).length, small = high.filter(x => x !== 0 && x !== 10);
  if (tens < g.tensMin || tens > g.tensMax) bad.push('high: its 10s');
  if (small.length > g.smallMax || small.some(x => x > g.smallTop)) bad.push('high: the small values');
  if (mid.includes(10)) bad.push('mid: a 10');
  if (mid.filter(x => x === 5).length < 2) bad.push('mid: two 5s');
  if (Math.max(...mid) <= Math.max(...low)) bad.push('mid: its top not above low\'s');
  if (low.some(x => x < g.lowLo || x > g.lowHi) || new Set(low).size < 2) bad.push('low: its values');
  if (mid.some(x => x < g.midLo || x > g.midHi)) bad.push('mid: its values');
  const h = wheelAvg(high), m = wheelAvg(mid), l = wheelAvg(low);
  if (!(m - h >= g.gap - 1e-9 && l - m >= g.gap - 1e-9)) bad.push('the averages: high < mid < low, ' + g.gap + ' apart');
  return bad;
}
// A square's wheels, drawn until every rule holds (a known-good set if the admin's ranges allow none).
export function wheelsDeal(rng, g) {
  g = g || wheelsConfig();
  const pick = (lo, hi) => lo + randInt(rng, hi - lo + 1), place = (n, vals) => { const out = new Array(WHEEL_SEGS).fill(n.fill); const slots = shuffle(Array.from({ length: WHEEL_SEGS }, (_, k) => k), rng); vals.forEach((v, k) => { out[slots[k]] = v; }); return out; };
  for (let tries = 0; tries < 4000; tries++) {
    const tens = pick(g.tensMin, g.tensMax), nSmall = pick(0, g.smallMax);
    const high = place({ fill: 0 }, Array(tens).fill(10).concat(Array.from({ length: nSmall }, () => pick(1, g.smallTop))));
    const low = Array.from({ length: WHEEL_SEGS }, () => pick(g.lowLo, g.lowHi));
    const top = Math.max(...low);
    if (top + 1 > g.midHi) continue;
    const nBig = top >= 5 ? 1 : pick(0, 1), rest = Array.from({ length: WHEEL_SEGS - 2 - nBig }, () => pick(g.midLo, Math.min(3, g.midHi)));   // two 5s, and perhaps one more big value (always, if 5 is not above low's top)
    const mid = place({ fill: 0 }, [5, 5].concat(Array.from({ length: nBig }, () => pick(Math.max(5, top + 1), g.midHi)), rest));
    const w = { high, mid, low };
    if (!wheelsCheck(w, g).length) return w;
  }
  return { high: [10, 0, 0, 1, 0, 0, 0, 0, 0, 0], mid: [5, 0, 1, 0, 5, 2, 0, 1, 0, 3], low: [3, 2, 3, 2, 3, 3, 2, 3, 3, 2] };   // (the admin's ranges allow no set: this one keeps the default rules)
}
// The chance the player to move wins, with a points to the other's b, both choosing their best wheel every
// spin (moves taking turns): worked out once per square's wheels (value iteration: a spin of 0 comes back
// round to the same place), and the best wheel at each; and alone, the fewest spins expected to the target.
export const WHEEL_MEMO = {};
export const WHEELS_SAFE = ['low', 'mid', 'high'];
export function wheelsTable(target, wheels) {
  const key = target + ':' + JSON.stringify(wheels);
  if (WHEEL_MEMO[key]) return WHEEL_MEMO[key];
  const T = target, V = Array.from({ length: T }, () => new Array(T).fill(0.5)), best = Array.from({ length: T }, () => new Array(T).fill('low'));
  const dist = {}; for (const w of WHEELS) { const d = {}; for (const v of wheels[w]) d[v] = (d[v] || 0) + 1 / wheels[w].length; dist[w] = Object.entries(d).map(([v, p]) => [Number(v), p]); }
  const after = (a, b, v) => (a + v >= T ? 1 : 1 - V[b][a + v]);
  for (let it = 0; it < 600; it++) {
    let moved = 0;
    for (let a = T - 1; a >= 0; a--) for (let b = T - 1; b >= 0; b--) {
      let top = -1, pick = 'low';
      for (const w of a < b ? WHEELS : WHEELS_SAFE) { let x = 0; for (const [v, p] of dist[w]) x += p * after(a, b, v); if (x > top + 1e-9) { top = x; pick = w; } }   // (a tie: behind, the riskier wheel; level or ahead, the safer)
      moved = Math.max(moved, Math.abs(top - V[a][b])); V[a][b] = top; best[a][b] = pick;
    }
    if (moved < 1e-10) break;
  }
  const E = new Array(T + 11).fill(0);
  for (let a = T - 1; a >= 0; a--) {
    let lo = Infinity;
    for (const w of WHEELS) { let stay = 0, e = 1; for (const [v, p] of dist[w]) { if (v === 0) stay += p; else e += p * E[Math.min(T, a + v)]; } if (stay < 1) lo = Math.min(lo, e / (1 - stay)); }
    E[a] = lo;
  }
  return (WHEEL_MEMO[key] = { V, best, E });
}
// The spin: a segment at random (all ten the same size), its points, and where in it the pointer stops
// (0-1 round the wheel from the top of segment 0, well inside the segment), so both phones show the same landing.
export function wheelSpin(vals, rng) { const k = randInt(rng, vals.length), at = (k + 0.15 + 0.7 * rng()) / vals.length; return { v: vals[k], seg: k, at: r3(at) }; }
export function create(type, rng) {
  const g = wheelsConfig(); return { type, target: g.target, wheels: wheelsDeal(needRng(rng), g), pts: { X: 0, O: 0 }, spins: { X: 0, O: 0 }, rest: { high: 0, mid: 0, low: 0 }, last: null };
}
export function apply(mini, p, m, rng, idx) {   // a wheel spun once: its points added; the target wins
  if (!WHEELS.includes(m)) return { ok: false, reason: 'bad' };
  const s2 = wheelSpin(mini.wheels[m], needRng(rng));
  const from = (mini.rest && mini.rest[m]) || 0;
  mini.pts[p] += s2.v; mini.spins[p] += 1; mini.rest = Object.assign({ high: 0, mid: 0, low: 0 }, mini.rest, { [m]: s2.at });
  mini.last = { by: p, w: m, v: s2.v, seg: s2.seg, at: s2.at, from };
  if (mini.pts[p] >= mini.target) return { ok: true, outcome: 'win', note: 'target' };
  return { ok: true, outcome: 'continue', note: s2.v ? 'points' : 'nothing' };
}
export function publicView(mini) {
  return { type: 'wheels', target: mini.target, wheels: mini.wheels, pts: { X: mini.pts.X, O: mini.pts.O }, spins: { X: mini.spins.X, O: mini.spins.O } };
}
export function randomMove(mini, p, rng, from, empties) {
  return 'low';                                        // the low-risk wheel
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.wheel = { w: l.w, v: l.v, seg: l.seg, at: l.at, from: l.from || 0, pts: { X: mini.pts.X, O: mini.pts.O }, target: mini.target }; return;
}
export function flashMs(f, winLen, won) {
  return WHEELT.spin + WHEELT.hold + (won ? 600 : 0);
}
