// Star Swarm: the rules (pure: no page, no clock; the server runs the same code).
// A move is one run: the ship flies along the bottom of the sky (a drag steers it towards the finger's place,
// up to vx units a second) and fires by itself, a shot every 1/shotRate seconds straight up; the swarm comes
// down in waves (drifters that sway as they sink, darts that dive at where the ship was when they appeared,
// saucers that hang in the middle of the sky, slide over the ship and drop a bolt now and then). Every enemy
// shot down adds one to the player's total, which carries over from run to run; the run ends when anything
// touches the ship (an enemy, a bolt), when the total reaches the target, or when the run's time is up.
// Everything is worked out here in fixed steps of plain arithmetic (no trigonometry: the sway is a triangle
// wave), so the same inputs give the same run everywhere: the phone sends its inputs (where the finger
// steered, step by step) with the result, and the server plays them through again and takes the result
// only when it is the same. The waves of a run are drawn from the square's seed and the run's number, so
// the server has them too. The computer flies the same steps with an autopilot (rules below), its inputs
// recorded, so its run replays through the same view.
import { courseSeed, gaussOf, makeRng } from '../../core/random.js';
import { clamp01, r2 } from '../../core/util.js';
import { tune } from '../../core/tune.js';
import { fingLog, fingRecorder, fingUnlog } from '../shared/finger.js';

// Units: the sky is w across and h tall; the ship flies at shipY; everything appears at `top` and is gone
// below the bottom. step: the simulation step; every: the finger is read every 2 steps; q: the finger's place
// is kept to 1/50 of a unit; grace: nothing appears for this long; hold: how long the end of a run shows on
// another phone before the result; replayMax: a longer run replays faster, in this long (ms).
export const SW = { w: 11, h: 12, step: 1 / 120, every: 2, q: 50, edge: 0.6, shipY: 1.3, shipR: 0.42, foeR: 0.5, shotR: 0.12, boltR: 0.17, vx: 12, shotV: 16, grace: 1, top: 12.6, hoverY: 7.4, trackV: 1.6, boltV: 4.7, swoopK: 1.7, diveK: 1.6, hover: 5, hold: 650, replayMax: 30000 };
export const SW_WORTH = { drift: 1, swoop: 2, shooter: 3 };   // what shooting each kind down adds to the total: the darts and saucers of the later waves are worth more
export const swClampX = x => Math.max(SW.edge, Math.min(SW.w - SW.edge, x));
const tri = u => 4 * Math.abs(u - Math.floor(u) - 0.5) - 1;        // a triangle wave, -1 to 1 over one period
// The waves of one run (from the square's seed and the run's number): [{ T (seconds: when it appears), k:
// 'drift' | 'swoop' | 'shooter', x0, v (its speed), ... }]. The gap between enemies shrinks from spawn0 to
// spawn1 over ramp seconds, their speed rises from v0 to v1, and the darts and saucers come in later on.
export function swarmWaves(cfg, seed, tries) {
  const rng = makeRng(`swarm:${seed}:${tries}`), out = [], lo = SW.edge + 0.5, hi = SW.w - SW.edge - 0.5;
  let T = SW.grace + 0.3;
  for (let i = 0; i < 400 && T < cfg.maxSecs + 2; i++) {
    const f = clamp01(T / cfg.ramp), v = r2(cfg.v0 + (cfg.v1 - cfg.v0) * f);
    const pSh = T < 6 ? 0 : 0.22 * f, pSw = T < 2 ? 0 : 0.38 * f, u = rng();   // (jellies alone for the first 2 s, no saucer before 6)
    const k = u < pSh ? 'shooter' : u < pSh + pSw ? 'swoop' : 'drift';
    const e = { T: r2(T), k, x0: r2(lo + rng() * (hi - lo)), v };
    if (k === 'drift') { e.amp = r2(0.6 + rng() * 1.6); e.P = r2(2 + rng() * 1.5); e.ph = r2(rng()); }
    else if (k === 'shooter') e.gap = r2(Math.max(0.5, cfg.fireGap * (1 - 0.35 * f)));
    out.push(e);
    T += (cfg.spawn0 + (cfg.spawn1 - cfg.spawn0) * f) * (0.75 + 0.5 * rng());
  }
  return out;
}
// A run from the saved total: the ship in the middle, the sky empty, the waves to come.
export function swarmStart(mini, p) {
  const cfg = tune(mini);
  return { type: 'swarm', cfg, n0: mini.score[p], waves: swarmWaves(cfg, mini.seed[p], mini.tries[p]), wi: 0, x: SW.w / 2, tx: SW.w / 2, foes: [], shots: [], bolts: [], kills: 0, downed: 0, n: 0, t: 0, fireAt: 0, end: null, last: null, ev: [], hit: null };
}
function swSpawn(w, sim) {
  const f = { k: w.k, x: w.x0, y: SW.top, v: w.v, T: w.T, id: sim.wi };
  if (w.k === 'drift') { f.cx = w.x0; f.amp = w.amp; f.P = w.P; f.ph = w.ph; }
  else if (w.k === 'swoop') {                                     // a dart: straight at where the ship is now
    const dx = sim.x - w.x0, dy = -1.2 - SW.top, len = Math.sqrt(dx * dx + dy * dy), s = w.v * SW.swoopK;
    f.vx = (s * dx) / len; f.vy = (s * dy) / len;
  } else { f.gap = w.gap; f.fireAt = w.T + 0.8; f.phase = 'down'; f.until = 0; }
  return f;
}
function swMoveFoe(f, sim, h) {
  if (f.k === 'drift') { f.y -= f.v * h; f.x = swClampX(f.cx + f.amp * tri((sim.t - f.T) / f.P + f.ph)); return; }
  if (f.k === 'swoop') { f.x += f.vx * h; f.y += f.vy * h; return; }
  if (f.phase === 'down') { f.y -= f.v * 0.8 * h; if (f.y <= SW.hoverY) { f.y = SW.hoverY; f.phase = 'hover'; f.until = sim.t + SW.hover; } return; }
  if (f.phase === 'hover') {                                     // a saucer: slides over the ship and drops a bolt now and then
    const d = sim.x - f.x, m = SW.trackV * h;
    f.x += d > m ? m : d < -m ? -m : d;
    if (sim.t >= f.fireAt) { sim.bolts.push({ x: f.x, y: f.y - 0.5 }); f.fireAt = sim.t + f.gap; sim.last = sim.last || 'zap'; }
    if (sim.t >= f.until) f.phase = 'dive';
    return;
  }
  f.y -= f.v * SW.diveK * h;
}
// One step: steer towards the finger's place, fire, move everything, settle the hits.
export function swarmStep(sim, tx) {
  if (sim.end) return sim;
  const h = SW.step, cfg = sim.cfg;
  if (tx != null) sim.tx = swClampX(tx);
  const d = sim.tx - sim.x, m = SW.vx * h;
  sim.x = swClampX(sim.x + (d > m ? m : d < -m ? -m : d));
  sim.t = ++sim.n * h;
  sim.last = null;
  if (sim.t >= sim.fireAt) { sim.shots.push({ x: sim.x, y: SW.shipY + 0.55 }); sim.fireAt = sim.t + 1 / cfg.shotRate; sim.last = 'pew'; }
  for (const s of sim.shots) s.y += SW.shotV * h;
  while (sim.wi < sim.waves.length && sim.waves[sim.wi].T <= sim.t) sim.foes.push(swSpawn(sim.waves[sim.wi++], sim));
  for (const f of sim.foes) swMoveFoe(f, sim, h);
  for (const b of sim.bolts) b.y -= SW.boltV * h;
  const rr = (SW.foeR + SW.shotR) * (SW.foeR + SW.shotR);
  for (const f of sim.foes) {
    if (f.dead) continue;
    for (const s of sim.shots) {
      if (s.dead) continue;
      const dx = s.x - f.x, dy = s.y - f.y;
      if (dx * dx + dy * dy < rr) { f.dead = true; s.dead = true; sim.kills += SW_WORTH[f.k]; sim.downed++; sim.ev.push({ x: r2(f.x), y: r2(f.y), t: sim.t, k: f.k, w: SW_WORTH[f.k] }); sim.last = 'kill'; break; }
    }
  }
  sim.foes = sim.foes.filter(f => !f.dead && f.y > -1); sim.shots = sim.shots.filter(s => !s.dead && s.y < SW.h + 1); sim.bolts = sim.bolts.filter(b => b.y > -0.6);
  const rf = (SW.foeR + SW.shipR) * (SW.foeR + SW.shipR), rb = (SW.boltR + SW.shipR) * (SW.boltR + SW.shipR);
  for (const f of sim.foes) { const dx = f.x - sim.x, dy = f.y - SW.shipY; if (dx * dx + dy * dy < rf) { sim.end = 'hit'; sim.hit = { x: r2(f.x), y: r2(f.y), k: f.k }; return sim; } }
  for (const b of sim.bolts) { const dx = b.x - sim.x, dy = b.y - SW.shipY; if (dx * dx + dy * dy < rb) { sim.end = 'hit'; sim.hit = { x: r2(b.x), y: r2(b.y), k: 'bolt' }; return sim; } }
  if (sim.n0 + sim.kills >= cfg.target) { sim.end = 'top'; return sim; }
  if (sim.t >= cfg.maxSecs - 1e-9) sim.end = 'out';
  return sim;
}
export const swarmResult = sim => ({ n: sim.kills, end: sim.end || 'out', steps: sim.n });
// A run played through from its inputs (the phone's, the computer's): the same steps the phone took.
export function swarmReplay(mini, p, log, steps) {
  const sim = swarmStart(mini, p);
  let k = 0;
  while (sim.n < steps && !sim.end) {
    let tx = null;
    if (k < log.length && log[k][0] === sim.n) tx = log[k++][1] / SW.q;
    swarmStep(sim, tx);
  }
  return sim;
}
export const swarmMaxSteps = cfg => Math.round(cfg.maxSecs / SW.step);
// The move checked: played through again from its inputs; { why } or { why: null, sim }.
export function swarmCheck(mini, p, m) {
  if (!m || typeof m !== 'object') return { why: 'bad' };
  const steps = Number(m.steps);
  if (!Number.isInteger(steps) || steps < 1 || steps > swarmMaxSteps(tune(mini))) return { why: 'bad' };
  const log = fingUnlog(m.log, steps, Math.ceil(SW.w * SW.q));
  if (!log) return { why: 'bad' };
  const sim = swarmReplay(mini, p, log, steps), end = sim.end || 'out';
  if (sim.n !== steps || String(m.end) !== end || Number(m.n) !== sim.kills) return { why: 'replay' };   // (ended sooner, or not as said)
  return { why: null, sim };
}
// How long a run lasted, and how long it takes to play through on another phone (as it was, or faster for
// a run longer than replayMax), in ms.
export const swarmRaw = s => (!s || s.auto ? 0 : Math.round(Number(s.steps) * SW.step * 1000));
export const swarmMs = s => Math.min(swarmRaw(s), SW.replayMax);

// ---------- the computer's autopilot ----------
// Every few steps it looks at what is coming: anything that will reach the ship's height within `look`
// seconds is a threat (unless it did not notice it: lapse), and every enemy is a target, at the place a shot
// fired now would meet it (a little off: aim). It picks the place across the sky that keeps clear of the
// threats and sits under the lowest target it can, and what it decides takes react seconds to reach the
// finger. Normal's hand is the square's settings (TUNE); Hard's is quicker, surer and looks further ahead.
export const SW_HAND = { normal: { react: [0.2, 0.3], aim: 0.4, lapse: 0.15, look: 0.55, sway: false }, hard: { react: [0.06, 0.1], aim: 0.08, lapse: 0, look: 0.8, sway: true } };   // sway: it reads a drifter's sway and meets it where it will be
export function swarmHand(mini, level) {
  if (level === 'hard') return SW_HAND.hard;
  const t = tune(mini);
  return { react: [t.aiReact0 / 1000, t.aiReact1 / 1000], aim: t.aiAim / 100, lapse: t.aiLapse / 100, look: SW_HAND.normal.look, sway: false };
}
const driftX = (f, t) => swClampX(f.cx + f.amp * tri((t - f.T) / f.P + f.ph));   // where a drifter is at time t
export function swarmPlan(sim, hand, rng, memo) {
  const band = SW.shipY + SW.foeR + SW.shipR, threats = [], targets = [];
  for (const f of sim.foes) {
    if (!memo.has(f)) memo.set(f, { blind: rng() < hand.lapse, off: gaussOf(rng) * hand.aim });
    const m = memo.get(f);
    const vy = f.k === 'drift' ? -f.v : f.k === 'swoop' ? f.vy : f.phase === 'dive' ? -f.v * SW.diveK : f.phase === 'down' ? -f.v * 0.8 : 0, vx = f.k === 'swoop' ? f.vx : 0;
    const ta = vy < 0 ? (f.y - band) / -vy : Infinity;
    const at = dt => (f.k === 'drift' && hand.sway ? driftX(f, sim.t + dt) : f.x + vx * dt);
    if (!m.blind && ta < hand.look) threats.push({ x: at(ta), w: SW.foeR + SW.shipR + (f.k === 'drift' && !hand.sway ? 0.8 : 0.35) });   // (a drifter it cannot read: a wider berth)
    const ts = Math.max(0, f.y - SW.shipY - 0.55) / (SW.shotV - vy);
    targets.push({ x: at(ts) + m.off, y: f.y });
  }
  for (const b of sim.bolts) { const ta = (b.y - SW.shipY - SW.boltR - SW.shipR) / SW.boltV; if (ta < hand.look) threats.push({ x: b.x, w: SW.boltR + SW.shipR + 0.3 }); }
  let best = null;
  for (let xc = SW.edge; xc <= SW.w - SW.edge + 1e-9; xc += 0.2) {
    let sc = -Math.abs(xc - sim.x) * 0.4, tb = 0;
    for (const th of threats) { const d = Math.abs(xc - th.x); if (d < th.w) sc -= 40 * (1 - d / th.w); }
    for (const tg of targets) { const d = Math.abs(xc - tg.x), worth = 6 - tg.y * 0.3; if (d < 0.3) tb = Math.max(tb, worth); else if (d < 1.2) tb = Math.max(tb, worth * (1 - (d - 0.3) / 0.9) * 0.5); }
    sc += tb;
    if (!best || sc > best.sc) best = { x: xc, sc };
  }
  return best;
}
export function swarmAi(mini, p, rng, level, hand) {
  hand = hand || swarmHand(mini, level);
  const sim = swarmStart(mini, p), rec = fingRecorder(), memo = new Map(), lag = Math.round((hand.react[0] + (hand.react[1] - hand.react[0]) * rng()) / SW.step), queue = [];
  let aim = sim.x;
  while (!sim.end) {
    if (sim.n % SW.every === 0) { const plan = swarmPlan(sim, hand, rng, memo); if (plan) queue.push([sim.n + lag, plan.x]); }
    while (queue.length && queue[0][0] <= sim.n) aim = queue.shift()[1];
    swarmStep(sim, rec.at(sim.n, aim));
  }
  const r = swarmResult(sim);
  return { move: { log: fingLog(rec.pairs), steps: r.steps, n: r.n, end: r.end }, sim };
}

// ---------- the square ----------
export function create(type, rng) {
  return { type, seed: courseSeed(rng), score: { X: 0, O: 0 }, tries: { X: 0, O: 0 }, last: null };   // seed: the waves (one for both); score: each player's total; tries: each player's runs so far
}
export const swarmGoal = mini => tune(mini).target;
// One run: checked (played through again from its inputs), then its kills added to the total; a timed-out one
// ('auto': the server's, at the deadline) changes nothing but counts as a run.
export function apply(mini, p, m, rng, idx) {
  const goal = swarmGoal(mini), from = mini.score[p];
  let to = from, last;
  if (m === 'auto') last = { by: p, auto: true, from, to };
  else {
    const c = swarmCheck(mini, p, m);
    if (c.why) return { ok: false, reason: c.why };
    to = Math.min(goal, from + c.sim.kills); mini.score[p] = to;
    last = { by: p, from, to, n: c.sim.kills, log: m.log, steps: Number(m.steps), end: String(m.end), try: mini.tries[p] };
  }
  mini.tries[p] += 1;
  mini.last = last;
  if (to >= goal) return { ok: true, outcome: 'win', note: 'top' };
  return { ok: true, outcome: 'continue', note: last.auto ? 'out' : to > from ? 'up' : 'none' };
}
export function publicView(mini) {
  const c = JSON.parse(JSON.stringify(mini)); if (c.last) delete c.last.log; return c;   // (the computer's view: the run's inputs are no use to it)
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';       // the run ends where it stands: no progress from it
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.swarm = Object.assign({ goal: swarmGoal(mini), at: { X: mini.score.X, O: mini.score.O } }, JSON.parse(JSON.stringify(mini.last)));
}
export function flashMs(f, winLen, won) {
  return (f.swarm && !f.timeout && !f.swarm.auto ? swarmMs(f.swarm) : 0) + SW.hold + (won ? 600 : 0);   // someone else's run plays through first, then the result (the phone that flew it skips that)
}
