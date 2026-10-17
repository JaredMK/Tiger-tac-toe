// Scoop Stack: the rules (pure: no page, no clock; the server runs the same code).
import { cfgKit } from '../../core/config.js';
import { gaussOf, makeRng, needRng, randInt } from '../../core/random.js';
import { clamp01, r2 } from '../../core/util.js';
import { FHAND, FING, fingLog, fingRecorder } from '../shared/finger.js';
import { SCOOP_DEFAULTS } from './meta.js';
export { fingerApply as apply } from '../shared/finger.js';
export { fingerMoveFlash as moveFlash } from '../shared/finger.js';
export { fingerFlashMs as flashMs } from '../shared/finger.js';

// Scoop Stack: the cone at the bottom moves towards the finger's place (up to cone units a second); scoops
// and hazards (pebbles, burnt scoops) fall at the top of the stack. A scoop stacks when it lands within
// slide of the stack's top; further off but still touching, it slides off; that, or no touch, is a miss.
// A hazard touching the top ends the attempt, as do three misses. The stack's top sways a little behind
// fast moves (more as it grows). Everything falls towards the stack's top (the screen follows it), at a
// speed and a rate that rise with the stack (counted as if every scoop so far had been caught, so an
// attempt is worked out before it starts), with a hazard now and then, more of them higher up. Before
// any item is placed, the attempt is checked to be catchable: a cone that moves at most fair of its speed
// can catch every scoop and keep clear of every hazard. Nothing falls for the grace seconds. Units: the
// screen is w across; the stack's top is 0 and items fall from spawn above it.
export const SCOOP = { w: 10, r: 0.5, piece: 0.56, spawn: 11, edge: 0.7, slide: 0.5, touch: 0.98, hit: 0.85, misses: 3, fair: 0.72, pad: 0.35, swayK: 55, swayC: 8, swayA: 0.12, swayMax: 0.6, kinds: 5 };
export const SCOOP_LIMITS = { target: [5, 200, 1], v0: [1, 15, 0.1], v1: [1, 15, 0.1], gap0: [0.3, 4, 0.05], gap1: [0.3, 4, 0.05], haz0: [0, 70, 1], haz1: [0, 70, 1], sway: [0, 3, 0.05], cone: [5, 40, 0.5] };
export const SCOOP_KIT = cfgKit(SCOOP_DEFAULTS, SCOOP_LIMITS);
export const setScoopConfig = SCOOP_KIT.set, scoopConfig = SCOOP_KIT.get;
// The items of one attempt (seeded by the player's square seed and the attempt's number): [{ T (seconds:
// when it reaches the top), x, k: 'scoop' | 'pebble' | 'burnt', f (a scoop's flavour), v (its speed) }].
export function scoopItems(cfg, seed, tries, n0) {
  const rng = makeRng(`scoop:${seed}:${tries}`), W = SCOOP.w, lo = SCOOP.edge, hi = W - SCOOP.edge, vfair = cfg.cone * SCOOP.fair, out = [];
  let R = [[W / 2, W / 2]], tPrev = 0, T = FING.grace + 0.4, n = n0;   // R: where a perfect cone could be (the catchable set)
  const grow = dt => { const e = vfair * dt; R = R.map(([a, b]) => [Math.max(lo, a - e), Math.min(hi, b + e)]); const m = []; for (const iv of R) { if (m.length && iv[0] <= m[m.length - 1][1]) m[m.length - 1][1] = Math.max(m[m.length - 1][1], iv[1]); else m.push(iv.slice()); } R = m; };
  const total = cfg.target - n0 + 12;
  for (let i = 0; i < 400 && (out.filter(o => o.k === 'scoop').length < total) && T < FING.maxSecs - 5; i++) {
    const f = clamp01(n / cfg.target), v = r2(cfg.v0 + (cfg.v1 - cfg.v0) * f), hz = (cfg.haz0 + (cfg.haz1 - cfg.haz0) * f) / 100;
    grow(T - tPrev); tPrev = T;
    if (rng() < hz && i > 0) {                                          // a hazard: anywhere that leaves the cone a way round it
      const bad = rng() < 0.5 ? 'pebble' : 'burnt';
      for (let k = 0; k < 8; k++) {
        const x = lo + rng() * (hi - lo), cut = [x - SCOOP.hit - SCOOP.pad, x + SCOOP.hit + SCOOP.pad];
        const left = []; for (const [a, b] of R) { if (b <= cut[0] || a >= cut[1]) left.push([a, b]); else { if (a < cut[0]) left.push([a, cut[0]]); if (b > cut[1]) left.push([cut[1], b]); } }
        if (left.length) { R = left; out.push({ T: r2(T), x: r2(x), k: bad, v }); break; }
      }
    } else {                                                            // a scoop: somewhere a perfect cone can be by then
      const tot = R.reduce((s, [a, b]) => s + (b - a), 0);
      let u = rng() * tot, x = R[0][0];
      for (const [a, b] of R) { if (u <= b - a) { x = a + u; break; } u -= b - a; }
      out.push({ T: r2(T), x: r2(x), k: 'scoop', f: randInt(rng, SCOOP.kinds), v });
      R = [[x - 0.2, x + 0.2]]; n++;
    }
    T += (cfg.gap0 + (cfg.gap1 - cfg.gap0) * clamp01(n / cfg.target)) * (0.7 + 0.6 * rng());
  }
  return out;
}
export function scoopStart(mini, p) {
  const cfg = mini.cfg, n0 = mini.stack[p].length;
  return { type: 'scoop', cfg, n0, items: scoopItems(cfg, mini.seed[p], mini.tries[p], n0), i: 0, x: SCOOP.w / 2, tx: SCOOP.w / 2, vx: 0, s: 0, sv: 0, n: 0, t: 0, got: [], miss: 0, end: null, last: null };
}
export const scoopTop = sim => sim.x + sim.s;                            // where the stack's top is (the cone, plus the sway)
export const scoopSize = sim => sim.n0 + sim.got.length;
// One step: the cone moves, the stack sways, any item reaching the top lands, slides off, misses or hits.
export function scoopStep(sim, tx) {
  if (sim.end) return sim;
  const h = FING.step, cfg = sim.cfg;
  if (tx != null) sim.tx = Math.max(SCOOP.edge, Math.min(SCOOP.w - SCOOP.edge, tx));
  const d = sim.tx - sim.x, m = cfg.cone * h, dx = d > m ? m : d < -m ? -m : d, vx = dx / h, ax = (vx - sim.vx) / h;
  sim.x += dx; sim.vx = vx;
  const tall = Math.min(1, scoopSize(sim) / 12) * cfg.sway;
  sim.sv += (-SCOOP.swayK * sim.s - SCOOP.swayC * sim.sv - ax * SCOOP.swayA * tall) * h;
  sim.s += sim.sv * h;
  if (sim.s > SCOOP.swayMax) { sim.s = SCOOP.swayMax; sim.sv = 0; } else if (sim.s < -SCOOP.swayMax) { sim.s = -SCOOP.swayMax; sim.sv = 0; }
  sim.t = ++sim.n * h;
  sim.last = null;
  while (sim.i < sim.items.length && sim.items[sim.i].T <= sim.t) {
    const it = sim.items[sim.i++], off = Math.abs(it.x - scoopTop(sim));
    if (it.k === 'scoop') {
      if (off <= SCOOP.slide) { sim.got.push(it.f); sim.last = 'catch'; }
      else { sim.miss++; sim.last = off <= SCOOP.touch ? 'slide' : 'miss'; }
      if (scoopSize(sim) >= cfg.target) { sim.end = 'top'; return sim; }
      if (sim.miss >= SCOOP.misses) { sim.end = 'miss'; return sim; }
    } else if (off <= SCOOP.hit) { sim.end = 'hazard'; sim.last = 'hit'; return sim; }
  }
  if (sim.i >= sim.items.length || sim.t >= FING.maxSecs - 1e-9) sim.end = 'out';
  return sim;
}
export const scoopResult = sim => ({ n: scoopSize(sim), end: sim.end || 'out', steps: sim.n });
// Where an item is t seconds in: its height above the stack's top (it falls at its own speed), or null before it falls.
export const scoopY = (it, t) => { const y = (it.T - t) * it.v; return y > SCOOP.spawn ? null : y; };
// Scoop Stack: it goes for the next scoop it has seen falling (aiming a little off), keeping clear of the
// hazards it has noticed that land first.
export function scoopAi(mini, p, rng, hand) {
  hand = hand || FHAND.scoop;
  const sim = scoopStart(mini, p), rec = fingRecorder();
  const react = hand.react[0] + (hand.react[1] - hand.react[0]) * rng(), err = new Map(), seen = new Map();
  let aim = sim.x;
  while (!sim.end && sim.t < FING.maxSecs - 1) {
    if (sim.n % FING.every === 0) {
      const t = sim.t, vis = [];
      for (let k = sim.i; k < sim.items.length && vis.length < 6; k++) { const it = sim.items[k]; if (scoopY(it, t - react) == null) break; vis.push(it); }
      const next = vis.find(it => it.k === 'scoop');
      if (next) {
        if (!err.has(next)) err.set(next, gaussOf(rng) * hand.aim);
        let want = next.x + err.get(next);
        for (const hz of vis) {
          if (hz.k === 'scoop' || hz.T > next.T + 0.05) continue;
          if (!seen.has(hz)) seen.set(hz, rng() > hand.lapse);
          if (!seen.get(hz)) continue;
          const dt = Math.max(0, hz.T - t), at = sim.x + Math.max(-sim.cfg.cone * dt, Math.min(sim.cfg.cone * dt, want - sim.x));   // where it would be when the hazard lands
          if (Math.abs(at - hz.x) < SCOOP.hit + 0.35) want = hz.x + (want >= hz.x ? 1 : -1) * (SCOOP.hit + 0.6);
        }
        aim = Math.max(SCOOP.edge, Math.min(SCOOP.w - SCOOP.edge, want));
      }
    }
    scoopStep(sim, rec.at(sim.n, aim));
  }
  return { move: { log: fingLog(rec.pairs), steps: sim.n, n: scoopResult(sim).n, end: scoopResult(sim).end }, sim };
}
export function create(type, rng) {
  return { type, cfg: scoopConfig(), seed: { X: randInt(needRng(rng), 1e9), O: randInt(rng, 1e9) }, stack: { X: [], O: [] }, tries: { X: 0, O: 0 }, last: null };   // stack: each player's scoops (their flavours)
}
export function publicView(mini) {
  const c = JSON.parse(JSON.stringify(mini)); if (c.last) { delete c.last.rec; delete c.last.log; } return c;
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';       // the attempt ends where it stands: no progress from it
}
