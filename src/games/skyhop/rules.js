// Sky Hop: the rules (pure: no page, no clock; the server runs the same code).
import { cfgKit } from '../../core/config.js';
import { courseSeed, gaussOf, makeRng } from '../../core/random.js';
import { clamp01, r2 } from '../../core/util.js';
import { FING, HOP, HOP_MEMO, fingHand, fingLog, fingRecorder } from '../shared/finger.js';
import { HOP_DEFAULTS } from './meta.js';
export { fingerApply as apply } from '../shared/finger.js';
export { fingerMoveFlash as moveFlash } from '../shared/finger.js';
export { fingerFlashMs as flashMs } from '../shared/finger.js';

export const HOP_LIMITS = { target: [50, 3000, 10], bounce: [12, 30, 0.1], gap0: [0.6, 6, 0.05], gap1: [0.6, 6, 0.05], wide0: [0.8, 6, 0.05], wide1: [0.8, 6, 0.05], moveAt: [0, 3000, 1], move: [0, 90, 1], moveV: [0.2, 4, 0.05], breakAt: [0, 3000, 1], brk0: [0, 90, 1], brk: [0, 90, 1], hazAt: [0, 3000, 1], hazGap: [5, 500, 1], fill0: [0, 4, 0.05], fill1: [0, 4, 0.05] };
export const HOP_KIT = cfgKit(HOP_DEFAULTS, HOP_LIMITS);
export const setHopConfig = HOP_KIT.set, hopConfig = HOP_KIT.get;
export const hopPeak = cfg => (cfg.bounce * cfg.bounce) / (2 * HOP.g);   // how high one bounce goes
// The sky is 9 m across and its sides are walls (nothing wraps round): every platform lies wholly inside it,
// a moving one's whole swing too.
export const hopClampX = x => Math.max(HOP.edge, Math.min(HOP.w - HOP.edge, x));
export function hopCourse(cfg, seed) {
  const key = seed + ':' + JSON.stringify(cfg);
  if (HOP_MEMO.has(key)) return HOP_MEMO.get(key);
  const rng = makeRng('hop:' + seed), W = HOP.w, gmax = HOP.gapK * hopPeak(cfg), top = cfg.target + HOP.view, plats = [], haz = [];
  const share = (y, at, pct, pct0) => (y < at ? 0 : (pct0 || 0) / 100 + ((pct - (pct0 || 0)) / 100) * clamp01((y - at) / Math.max(1, cfg.target - at)));   // from pct0 where it starts to pct at the top
  const inside = (want, half, amp) => Math.max(half + amp, Math.min(W - half - amp, want));   // a middle that keeps the platform (and its swing) inside the walls
  let y = 0, x = W / 2;
  while (y < top) {
    const f = clamp01(y / cfg.target), gap = Math.min(gmax, Math.max(0.5, (cfg.gap0 + (cfg.gap1 - cfg.gap0) * f) * (0.7 + 0.6 * rng())));
    const y1 = y + gap, w = cfg.wide0 + (cfg.wide1 - cfg.wide0) * f;
    const air = (cfg.bounce + Math.sqrt(Math.max(0, cfg.bounce * cfg.bounce - 2 * HOP.g * gap))) / HOP.g;   // a bounce's time until it falls back through y1
    const moving = rng() < share(y1, cfg.moveAt, cfg.move), breaks = !moving && rng() < share(y1, cfg.breakAt, cfg.brk, cfg.brk0);
    const amp = moving ? r2(Math.min(0.5 + 1.1 * rng(), (W - w) / 2 - 0.3)) : 0, reach = Math.max(0, Math.min(W / 2, HOP.vx * air * HOP.reachK - amp));
    const lo = inside(x - reach, w / 2, amp), hi = inside(x + reach, w / 2, amp), x1 = lo + rng() * (hi - lo);   // within reach of the last one, inside the walls
    plats.push({ y: r2(y1), x: r2(x1), w: r2(w), k: moving ? 'm' : breaks ? 'b' : 'n', amp, sp: moving ? r2(cfg.moveV * (0.7 + 0.6 * rng())) : 0, ph: moving ? r2(rng()) : 0, c: 1 });
    const fill = cfg.fill0 + (cfg.fill1 - cfg.fill0) * f;                   // more platforms between, fewer higher up (more of them break)
    for (let n = Math.floor(fill + rng()); n > 0; n--) {
      const fy = y + gap * (0.2 + 0.6 * rng()), fm = rng() < share(fy, cfg.moveAt, cfg.move), fb = !fm && rng() < 0.25 + 0.45 * f && fy >= cfg.breakAt;   // (none break below breakAt)
      const famp = fm ? r2(Math.min(0.5 + 1.1 * rng(), (W - w * 0.9) / 2 - 0.3)) : 0, fx = inside(rng() * W, w * 0.45, famp);
      if (Math.abs(fx - x) < w && Math.abs(fy - y) < 0.6) continue;   // (not right on top of the last one)
      plats.push({ y: r2(fy), x: r2(fx), w: r2(w * 0.9), k: fm ? 'm' : fb ? 'b' : 'n', amp: famp, sp: fm ? r2(cfg.moveV * (0.7 + 0.6 * rng())) : 0, ph: fm ? r2(rng()) : 0, c: 0 });
    }
    if (y1 > cfg.hazAt && y > 3 && rng() < gap / cfg.hazGap) {              // a hazard beside the way from this platform to the next, clear of it, inside the walls
      const a = Math.min(x, x1) - HOP.clear, b = Math.max(x, x1) + HOP.clear, left = a - HOP.haz, right = W - HOP.haz - b;
      if (left > 0 || right > 0) {
        const pick = rng() * (Math.max(0, left) + Math.max(0, right)), hx = pick < Math.max(0, left) ? HOP.haz + pick : b + (pick - Math.max(0, left)), hy = y + gap * (0.3 + 0.4 * rng());
        haz.push({ y: r2(hy), x: r2(hx) });
      }
    }
    x = x1; y = y1;
  }
  const peak = hopPeak(cfg), under = (p, h) => p.y > h.y - peak - 0.6 && p.y < h.y + 1.2 && Math.abs(p.x - h.x) < p.w / 2 + p.amp + 1.2;   // a bounce off p could rise into h
  for (let k = haz.length - 1; k >= 0; k--) if (plats.some(p => p.c && under(p, haz[k]))) haz.splice(k, 1);   // never over the way up
  for (const h of haz) for (let k = plats.length - 1; k >= 0; k--) if (!plats[k].c && under(plats[k], h)) plats.splice(k, 1);   // nor anything else to bounce into it from
  plats.sort((a, b) => a.y - b.y); haz.sort((a, b) => a.y - b.y);
  const out = { plats, haz };
  if (HOP_MEMO.size > 40) HOP_MEMO.clear();
  HOP_MEMO.set(key, out);
  return out;
}
// A moving platform's middle t seconds into the attempt: to and fro amp either way at sp (a triangle wave).
export function hopPx(p, t) {
  if (p.k !== 'm' || !p.amp) return p.x;
  const u = p.ph + (t * p.sp) / (4 * p.amp), fr = u - Math.floor(u);
  return p.x + p.amp * (4 * Math.abs(fr - 0.5) - 1);
}
// An attempt from the saved height: the course from there up, the start platform, the hopper on it, bouncing
// (nothing hazardous, and nothing that breaks, within the first bounce's reach).
export function hopStart(mini, p) {
  const cfg = mini.cfg, c = hopCourse(cfg, mini.seed[p]), h0 = mini.height[p], safe = h0 + hopPeak(cfg) + 0.5;
  const plats = c.plats.filter(q => q.y > h0 - HOP.view && Math.abs(q.y - h0) > 0.25).map(q => (q.k === 'b' && q.y <= safe ? Object.assign({}, q, { k: 'n' }) : q));   // nothing breaks within the first bounce either
  const haz = c.haz.filter(q => q.y > h0 - HOP.view && q.y > safe);
  return { type: 'skyhop', cfg, h0, plats, haz, gone: {}, x: HOP.w / 2, tx: HOP.w / 2, y: h0, vy: cfg.bounce, top: h0, t: 0, n: 0, lo: 0, end: null, bounces: 0, last: null };
}
export const hopCam = sim => Math.max(sim.h0 - 2, sim.top - HOP.fall);   // the screen's bottom edge, in metres: fall metres below the highest point (below it, the attempt is over)
// One step: steer towards the finger's place, fall, bounce off a platform fallen onto, touch a hazard, fall off the bottom.
export function hopStep(sim, tx) {
  if (sim.end) return sim;
  const h = FING.step, W = HOP.w, cfg = sim.cfg;
  if (tx != null) sim.tx = hopClampX(tx);
  const d = sim.tx - sim.x, m = HOP.vx * h;
  sim.x = hopClampX(sim.x + (d > m ? m : d < -m ? -m : d));   // the walls: no further than the sides
  const y0 = sim.y;
  sim.vy -= HOP.g * h; sim.y += sim.vy * h; sim.t = ++sim.n * h;
  sim.last = null;
  if (sim.vy < 0) {
    if (sim.t <= FING.grace && y0 >= sim.h0 && sim.y <= sim.h0) { sim.y = sim.h0; sim.vy = cfg.bounce; sim.bounces++; sim.last = 'base'; }
    else {
      while (sim.lo < sim.plats.length && sim.plats[sim.lo].y < sim.y - HOP.view) sim.lo++;
      let hit = -1;
      for (let k = sim.lo; k < sim.plats.length; k++) {               // the highest platform passed through in this step, under the hopper
        const q = sim.plats[k];
        if (q.y > y0) break;
        if (q.y < sim.y || sim.gone[k]) continue;
        if (Math.abs(sim.x - hopPx(q, sim.t)) <= q.w / 2 + HOP.foot) hit = k;
      }
      if (hit >= 0) {
        const q = sim.plats[hit];
        sim.y = q.y; sim.vy = cfg.bounce; sim.bounces++; sim.last = q.k === 'b' ? 'break' : 'bounce'; sim.on = hit;
        if (q.k === 'b') sim.gone[hit] = 1;
      }
    }
  }
  if (sim.y > sim.top) sim.top = sim.y;
  const cy = sim.y + HOP.bodyY;
  for (const q of sim.haz) {
    if (q.y > cy + 1) break;
    if (q.y < cy - 1) continue;
    const dx = sim.x - q.x, dy = cy - q.y;
    if (dx * dx + dy * dy < (HOP.body + HOP.haz) * (HOP.body + HOP.haz)) { sim.end = 'hazard'; return sim; }
  }
  if (sim.top >= cfg.target) { sim.end = 'top'; return sim; }
  if (sim.y < hopCam(sim) - HOP.below) sim.end = 'fall';
  else if (sim.t >= FING.maxSecs - 1e-9) sim.end = 'out';           // (an attempt can't last for ever: bouncing on one platform, say)
  return sim;
}
export const hopResult = sim => ({ h: r2(Math.min(sim.cfg.target, sim.top)), end: sim.end || 'out', steps: sim.n });
// Sky Hop: all the way it looks for the highest platform it can still come down on (the hopper's flight is
// known: up at the bounce speed, gravity bringing it back), steering for where that platform will be when
// it gets there, a little off; what it decides takes react seconds to reach the finger. It shies from a
// breaking platform and one by a hazard unless it doesn't notice (lapse), and sometimes takes a moving one
// to stay where it is (misjudge).
export function hopPlan(sim, hand, rng, memo) {
  const b = sim.vy, G = HOP.g, W = HOP.w, apex = sim.y + (b > 0 ? (b * b) / (2 * G) : 0);
  let best = null;
  for (let k = sim.lo; k < sim.plats.length; k++) {
    const q = sim.plats[k];
    if (q.y > apex - 0.05) break;
    if (sim.gone[k] || q.y < sim.y - 6) continue;
    const disc = b * b - 2 * G * (q.y - sim.y);
    if (disc < 0) continue;
    const tq = (b + Math.sqrt(disc)) / G;                              // when it comes down through q's height
    if (tq < 0.02) continue;
    if (!memo.has(q)) memo.set(q, { stale: q.k === 'm' && rng() < hand.misjudge, off: gaussOf(rng) * hand.aim, blind: rng() < hand.lapse });   // (judged afresh at every bounce)
    const m = memo.get(q), x = m.stale ? hopPx(q, sim.t) : hopPx(q, sim.t + tq);
    if (Math.abs(x - sim.x) > HOP.vx * tq * 0.92) continue;
    const d = x - sim.x, lo = Math.min(0, d) - 1.1, hi = Math.max(0, d) + 1.1, ylo = Math.min(sim.y, q.y) - 1.2;
    const risky = !m.blind && sim.haz.some(h => h.y > ylo && h.y < apex + 1.2 && h.x - sim.x > lo && h.x - sim.x < hi);   // a hazard across the way there
    const up = q.y > sim.y + 0.3, bored = sim.on != null && (memo.stuck.get(sim.on) || 0) >= 2;
    const score = (up ? 100 : 0) + q.y - (risky ? (bored ? 3 : 60) : 0) - (q.k === 'b' && !m.blind && !bored ? 1.5 : 0);
    if (!best || score > best.score) best = { q, x: hopClampX(x + m.off), score };
  }
  return best;
}
export function hopAi(mini, p, rng, hand) {
  hand = hand || fingHand(mini);   // (FHAND.skyhop, with the square's settings)
  const sim = hopStart(mini, p), rec = fingRecorder(), memo = Object.assign(new Map(), { stuck: new Map() }), lag = Math.round((hand.react[0] + (hand.react[1] - hand.react[0]) * rng()) / FING.step), queue = [];
  let aim = sim.x;
  while (!sim.end && sim.t < FING.maxSecs - 1) {
    if (sim.last) { memo.clear(); if (sim.on != null && sim.last !== 'base') memo.stuck.set(sim.on, (memo.stuck.get(sim.on) || 0) + 1); }   // a bounce: everything judged again
    if (sim.n % FING.every === 0) { const plan = hopPlan(sim, hand, rng, memo); if (plan) queue.push([sim.n + lag, plan.x]); }
    while (queue.length && queue[0][0] <= sim.n) aim = queue.shift()[1];
    hopStep(sim, rec.at(sim.n, aim));
  }
  const r = hopResult(sim);
  return { move: { log: fingLog(rec.pairs), steps: r.steps, h: r.h, end: r.end }, sim };
}
export function create(type, rng) {
  return { type, cfg: hopConfig(), seed: courseSeed(rng), height: { X: 0, O: 0 }, tries: { X: 0, O: 0 }, started: { X: null, O: null }, last: null };   // cfg: as dealt; seed: the course, one for both; started: when each pressed Start (online: server time, the attempt timed from it)
}
export function publicView(mini) {
  const c = JSON.parse(JSON.stringify(mini)); if (c.last) { delete c.last.rec; delete c.last.log; } return c;
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';       // the attempt ends where it stands: no progress from it
}
