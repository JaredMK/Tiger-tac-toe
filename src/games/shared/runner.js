// Dash, Lane Rush, Flap and Chopper: what the runners share (courses, the run itself, the checks, the
// computer's runs).
import { gaussOf, makeRng, needRng, randInt } from '../../core/random.js';
import { r2 } from '../../core/util.js';
import { CHOP, chopPilot } from '../chopper/rules.js';
import { DASH, DASH_OBS, dashPilot } from '../dash/rules.js';
import { FLAP, flapPilot } from '../flap/rules.js';
import { LANE, laneNeed, laneRow, lanePilot } from '../lane/rules.js';

// ---------- Dash and Lane Rush: runs along a seeded course to 1,000 m ----------
// A move is one run: from the player's saved distance until they crash (or finish), at the speed of
// that distance (the further along, the faster); the crash point is the new saved distance. Each
// player's course (where the obstacles are) is fixed per square from a seed, so what crashed you is
// still there on the retry; every run opens with a grace stretch (two seconds at that speed) where the
// course's obstacles are left out. The page runs the run in real time, with the step function here;
// the engine knows the course, the speeds and what a result may be: a crash at an obstacle past the
// grace stretch (or the finish), in no less time than the course allows. The difficulty is one config
// per game (RUN_CFG: the admin's values from the database, set with setRunConfig), copied into each
// square when it is dealt, so a change applies to new squares and a square under way keeps its own.
export const RUN_TYPES = ['dash', 'lane', 'flap', 'chopper'];
export const RUN_DEFAULTS = {
  dash: { target: 550, v0: 13, ramp: 3, gapMin: 18, gapMax: 32, mix: { rock: 30, crate: 20, spike: 20, flyer: 20, pair: 10 } },   // mix: the obstacles' weights (a clean run of the course in about 27 s, 13 to 29.5 m/s; a typical player about 4 runs: tests/sim/dash.sim.js)
  lane: { target: 1000, v0: 27, ramp: 2.7, gapMin: 10, gapMax: 18, mix: { one: 50, two: 50 } },                                          // rows with one car or two (half as fast again; rows closer: about a third more cars a course than at first; laneRow keeps a way through, a lane over at most)
  flap: { target: 450, v0: 6, ramp: 1.5, gapMin: 9, gapMax: 12, mix: { wide: 10, mid: 40, narrow: 50 } },                                // posts every 9-12 m; the size of each one's gap (half of them narrow; the speed climbing fast: 6 to about 13 m/s, a course of some 50 s and 40 posts)
  chopper: { target: 1000, v0: 14.4, ramp: 1.6, gapMin: 22, gapMax: 40, mix: { none: 10, small: 50, big: 40 }, cave0: 5.6, cave1: 3.4 },                       // a block in the cave every 22-40 m (or none there); its size (in Chopper's metres: CHOP.k); the cave's height at the start and the finish
};
export const RUN_LIMITS = { target: [200, 5000], v0: [3, 30], ramp: [0, 10], gapMin: [8, 200], gapMax: [10, 400] };
export const RUN_EXTRA = { chopper: { cave0: [3, 9.5], cave1: [2.5, 9.5] } };   // a runner's own settings: Chopper's cave height at the start and at the finish (the sky is 10)
// grace: seconds with no obstacles at the start of a run; countdown: the 3-2-1 before it; aiRuns: how many
// runs the computer takes to finish, about; aiSlow: how much shorter its runs get with speed; aiSpread:
// the spread of its run lengths (log-normal); tolerance and slackMs: how much faster than the course's
// own time a reported run may be (frame rounding); hit: how far from an obstacle's place a crash may be
// reported (before, after: a move from a page before the input log, checked by its distance alone);
// crashBin: the metres per bin in the crash stats; maxSecs: the longest run the server will play through
// from its log; logMax: the longest log it will read.
export const RUN = { grace: 2, countdown: 3, aiRuns: 4.5, aiSlow: 0.3, aiSpread: 0.45, tolerance: 0.85, slackMs: 200, hit: { dash: [1.5, 2.2], lane: [3.6, 3.6], flap: [1.0, 1.8] }, crashBin: 50, maxCrashes: 40, maxSecs: 600, logMax: 60000 };
export const RUNT = { bar: 900, hold: 700 };                          // the result: the bar fills, then holds
export const RUN_CFG = { dash: null, lane: null, flap: null, chopper: null };
// A config checked value by value: anything off, or missing, is the default.
export function runNorm(type, raw) {
  const d = RUN_DEFAULTS[type], out = {};
  for (const k of ['target', 'v0', 'ramp', 'gapMin', 'gapMax']) {
    const v = raw && raw[k] != null ? Number(raw[k]) : NaN, [lo, hi] = RUN_LIMITS[k];
    out[k] = Number.isFinite(v) && v >= lo && v <= hi ? r2(v) : d[k];
  }
  if (out.gapMax < out.gapMin + 2) out.gapMax = out.gapMin + 2;
  for (const [k, [lo, hi]] of Object.entries(RUN_EXTRA[type] || {})) { const v = raw && raw[k] != null ? Number(raw[k]) : NaN; out[k] = Number.isFinite(v) && v >= lo && v <= hi ? r2(v) : d[k]; }
  out.mix = {};
  let tot = 0;
  for (const k of Object.keys(d.mix)) {
    const v = raw && raw.mix && raw.mix[k] != null ? Number(raw.mix[k]) : NaN;
    out.mix[k] = Number.isFinite(v) && v >= 0 && v <= 1000 ? Math.round(v) : d.mix[k];
    tot += out.mix[k];
  }
  if (!tot) out.mix = Object.assign({}, d.mix);
  return out;
}
export function setRunConfig(cfg) { for (const t of RUN_TYPES) RUN_CFG[t] = runNorm(t, cfg && cfg[t]); }
export function runConfig(type) { if (!RUN_CFG[type]) RUN_CFG[type] = runNorm(type, null); return JSON.parse(JSON.stringify(RUN_CFG[type])); }
export const runSpeed = (cfg, d) => cfg.v0 + cfg.ramp * Math.max(0, d) / 100;                     // m/s at a distance along the course
// Seconds to run from a to b at the course's speeds (the speed grows with the distance).
export function runSecs(cfg, a, b) { if (b <= a) return 0; return cfg.ramp > 0 ? (100 / cfg.ramp) * Math.log(runSpeed(cfg, b) / runSpeed(cfg, a)) : (b - a) / cfg.v0; }
// Where a run from a is after t seconds.
export function runAfter(cfg, a, t) { if (t <= 0) return a; return cfg.ramp > 0 ? (runSpeed(cfg, a) * Math.exp(cfg.ramp * t / 100) - cfg.v0) * 100 / cfg.ramp : a + cfg.v0 * t; }
export const runGrace = (cfg, a) => runAfter(cfg, a, RUN.grace) - a;                               // the obstacle-free stretch at the start of a run from a
export function weightedPick(mix, rng) {
  const ks = Object.keys(mix), tot = ks.reduce((s, k) => s + mix[k], 0);
  let r = rng() * tot;
  for (const k of ks) { r -= mix[k]; if (r < 0) return k; }
  return ks[ks.length - 1];
}
// A player's course: the obstacles in order, from the seed. Dash: { at, k } (a pair: two ground
// hazards a jump's length apart); Lane Rush: { at, cars: [lane 0, 1, 2] }.
export function runCourse(mini, p) {
  const cfg = mini.cfg, rng = makeRng(`run:${mini.type}:${mini.seed[p]}`), out = [];
  let d = Math.max(cfg.gapMin, runGrace(cfg, 0) + 6);
  const cave = mini.type === 'chopper' ? runCave(mini, p) : null;
  let gy = FLAP.h / 2;
  while (d < cfg.target - 4) {
    const k = weightedPick(cfg.mix, rng);
    if (mini.type === 'flap') {                                       // a post: the gap's middle within reach of the last one
      const gh = FLAP.gaps[k], lo = FLAP.margin + gh / 2, hi = FLAP.h - FLAP.margin - gh / 2;
      gy = Math.max(lo, Math.min(hi, gy + (rng() * 2 - 1) * FLAP.shift));
      out.push({ at: r2(d), k, gy: r2(gy), gh });
    } else if (mini.type === 'chopper') {                             // a block, or none here; room to pass on one side at least
      if (k !== 'none') {
        let floor = -Infinity, ceil = Infinity;                       // the walls over the way in and past it: the room is there all along
        for (let x = d - 4 * CHOP.k; x <= d + CHOP.bw + 1.5 * CHOP.k; x += 0.5 * CHOP.k) { const [f, c] = caveWalls(cave, cfg, x); floor = Math.max(floor, f); ceil = Math.min(ceil, c); }
        const space = ceil - floor;
        const bh = Math.min(CHOP.blocks[k], space - CHOP.room - 0.3);
        if (bh >= 0.6) {
          const free = space - bh, side = rng() < 0.5;               // the room above, or below
          const under = side ? CHOP.room + rng() * (free - CHOP.room) : rng() * (free - CHOP.room);
          out.push({ at: r2(d), k, y: r2(floor + under), bh: r2(bh) });
        }
      }
    } else if (mini.type === 'dash') {
      if (k === 'pair') {                                            // two hazards: one long jump clears both, or two quick ones
        const gap = 1.0 + 0.15 * runSpeed(cfg, d), kinds = ['rock', 'spike'];
        out.push({ at: r2(d), k: kinds[randInt(rng, 2)], pair: 1 });
        out.push({ at: r2(d + DASH_OBS.rock.w + gap), k: kinds[randInt(rng, 2)], pair: 2 });
        d += DASH_OBS.rock.w + gap;
      } else out.push({ at: r2(d), k });
    } else {                                                         // a row of cars; moved on if the car needs longer to reach an open lane
      const last = out.length ? out[out.length - 1] : null, cars = laneRow(k, last && last.cars, rng), need = last ? laneNeed(last.cars, cars) : 0;
      if (need && runSecs(cfg, last.at, d) < need) d = runAfter(cfg, last.at, need) + 0.01;   // (+1 cm: the position is kept to the centimetre)
      out.push({ at: r2(d), cars });
    }
    d += cfg.gapMin + rng() * (cfg.gapMax - cfg.gapMin);
  }
  return out;
}
// Chopper's cave: the middle every CHOP.seg metres, from its own seed (the blocks are placed in it).
export function runCave(mini, p) {
  const cfg = mini.cfg, rng = makeRng(`cave:${mini.seed[p]}`), pts = [];
  let c = CHOP.h / 2;
  for (let d = 0; d <= cfg.target + CHOP.seg * 2; d += CHOP.seg) {
    const half = caveHeight(cfg, d) / 2 + CHOP.wave + 0.3;
    pts.push(r2(c));
    c = Math.max(half, Math.min(CHOP.h - half, c + (rng() * 2 - 1) * CHOP.wander));
  }
  return pts;
}
export const caveHeight = (cfg, d) => { const c0 = cfg.cave0 || CHOP.cave0, c1 = cfg.cave1 || CHOP.cave1; return c0 + (c1 - c0) * Math.max(0, Math.min(1, d / cfg.target)); };   // (the config's cave; a square dealt before it: CHOP's)
// The cave's floor and ceiling at d: the middle eased from point to point, the height, and the waves.
export function caveWalls(cave, cfg, d) {
  const u = Math.max(0, d) / CHOP.seg, k = Math.min(cave.length - 2, Math.floor(u)), t = Math.min(1, u - k), e = (1 - Math.cos(Math.PI * t)) / 2;
  const mid = cave[k] + (cave[k + 1] - cave[k]) * e, half = caveHeight(cfg, d) / 2;
  return [mid - half + CHOP.wave * Math.sin(d / (2.3 * CHOP.k)), mid + half + CHOP.wave * Math.sin(d / (1.9 * CHOP.k) + 1.7)];
}
// What a run's result must be: from the saved distance to a crash at an obstacle past the grace stretch
// (or to the finish), in no less time than the course allows. `out`: the turn's time ran out mid-run
// (the run ends wherever it was: no obstacle needed; the time must still allow the distance). A move
// with its input log (`log`, `steps`: every run made on a page since the log) is played through again
// here, step for step, and must end just as it claims: at the same step, at the same distance (to the
// centimetre), finished if and only if it says so, and at a crash unless finished or out of time. A move
// without one (a page from before the log) is checked by its distance alone, as it always was.
export function runCheck(mini, p, m) {
  if (!m || typeof m !== 'object') return 'bad';
  const cfg = mini.cfg, from = mini.dist[p], dist = Number(m.dist), ms = Number(m.ms);
  if (!Number.isFinite(dist) || !Number.isFinite(ms) || ms < 0 || dist < from || dist > cfg.target + 0.01) return 'bad';
  if (ms < runSecs(cfg, from, dist) * 1000 * RUN.tolerance - RUN.slackMs) return 'fast';   // more distance than the time allows at the course's speeds
  if (m.log != null) {
    const steps = Number(m.steps);
    if (typeof m.log !== 'string' || !Number.isInteger(steps) || steps < 0 || steps * runStepOf(mini.type) > RUN.maxSecs) return 'bad';
    const log = runUnlog(m.log, steps);
    if (!log) return 'bad';
    const sim = runReplay(mini, p, log, steps), done = dist >= cfg.target;
    if (sim.n !== steps || Math.abs(r2(Math.min(cfg.target, sim.d)) - dist) > 1e-9 || sim.done !== done || (!done && !m.out && !sim.crash)) return 'replay';   // (ended sooner, elsewhere, or not as said)
    return null;
  }
  if (dist >= cfg.target || m.out) return null;
  if (mini.type === 'chopper' || mini.type === 'flap') return dist >= from + runGrace(cfg, from) - 0.5 ? null : 'course';   // the walls (or the ground) are everywhere past the grace stretch
  const g = from + runGrace(cfg, from), [before, after] = RUN.hit[mini.type];
  return runCourse(mini, p).some(o => o.at >= g - 0.5 && dist >= o.at - before && dist <= o.at + after) ? null : 'course';   // a crash where there is nothing to crash into
}
// A timed-out player who never started: a run that crashes after a short random distance (at the first
// obstacle past the grace stretch and a few metres more; past the last obstacle, it finishes).
export function runAuto(mini, p, rng) {
  const cfg = mini.cfg, from = mini.dist[p], want = from + runGrace(cfg, from) + 4 + rng() * 70;
  if (mini.type === 'chopper') { const dist = Math.min(cfg.target, r2(want)); return { dist, ms: Math.round(runSecs(cfg, from, dist) * 1000) + 60 }; }   // into a wall
  const ob = runCourse(mini, p).find(o => o.at >= want);
  const dist = ob ? Math.min(cfg.target, r2(ob.at + 0.2)) : cfg.target;
  return { dist, ms: Math.round(runSecs(cfg, from, dist) * 1000) + 60 };
}
export const normCdf = x => 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
export function runAiMean(cfg, from) { return (cfg.target / RUN.aiRuns) * Math.pow(cfg.v0 / runSpeed(cfg, from), RUN.aiSlow); }
// The computer's run: a length drawn so that it finishes in about aiRuns runs (log-normal about
// runAiMean, shorter the faster it is going), then actually run, with its inputs logged like anyone's:
// an autopilot (each game's own, runPilot) drives the course well until the first obstacle past that
// length and fails there on purpose (Chopper: dives into the wall there), or finishes when there is
// none. The move is the run's result (its end wherever the crash was, so the check plays it through and
// agrees), and q the chance it finishes.
export function runAi(mini, p, rng) {
  const cfg = mini.cfg, from = mini.dist[p], g = runGrace(cfg, from), mean = runAiMean(cfg, from), s = RUN.aiSpread;
  const len = Math.max(6, mean * Math.exp(s * gaussOf(rng) - s * s / 2));
  const need = cfg.target - from - g;                            // the chance this run finishes
  const q = need <= 0 ? 1 : 1 - normCdf((Math.log(need / mean) + s * s / 2) / s);
  const sim = runStart(mini, p), at = from + g + len;
  const plan = mini.type === 'chopper' ? at : sim.course.find(o => o.at >= at) || null;
  runPilot(sim, plan, rng);
  return { move: runResult(sim, !sim.crash && !sim.done), q };   // (a run that somehow never ended goes in as cut short by the clock)
}
// The autopilot drives the sim to its end: the game's hand (dashPilot, lanePilot, flapPilot, chopPilot:
// a function called before every step that makes the inputs) and the steps, up to maxSecs.
export function runPilot(sim, plan, rng) {
  const hand = (sim.type === 'dash' ? dashPilot : sim.type === 'lane' ? lanePilot : sim.type === 'flap' ? flapPilot : chopPilot)(sim, plan, rng), max = Math.round(RUN.maxSecs / runStepOf(sim.type));
  while (!sim.crash && !sim.done && sim.n < max) { hand(); runTick(sim); }
  return sim;
}
export const runNeeds = (cfg, from) => Math.max(1, (cfg.target - from) / (runAiMean(cfg, from) + runGrace(cfg, from)));
// The run data a square carries to the stats (the admin's tuning): runs, distances and the crashes.
export const runLog = mini => ({ run: { runs: { X: mini.runs.X, O: mini.runs.O }, dist: { X: Math.round(mini.dist.X), O: Math.round(mini.dist.O) }, crashes: { X: (mini.crashes.X || []).slice(), O: (mini.crashes.O || []).slice() } } });

// ----- the run itself: the page drives it in real time (one frame at a time), the tests step by step -----
// The run is worked out in fixed steps (DASH.step and the others: 1/240 s) of plain arithmetic, the
// inputs taken between steps, so the same inputs at the same steps give the same run on every phone and
// on the server. A sim counts its steps (n) and records the inputs it took (rec: [step, code] pairs, the
// code 'j' a jump, a flap or the chopper's press, 'r' a release, 'l' and 'L' a lane change left and
// right); the move carries them as its log (runLogOf), and anyone can play the run through again from it
// (runReplay): the server to check it, the other phone to show it.
// A fresh run from the player's saved distance: the course past the grace stretch, the runner on the
// ground (Dash) or in the middle lane (Lane Rush).
export function runStart(mini, p) {
  const cfg = mini.cfg, from = mini.dist[p], g = runGrace(cfg, from);
  const cave = mini.type === 'chopper' ? runCave(mini, p) : null;
  const y = mini.type === 'flap' ? FLAP.h / 2 : cave ? r2(caveWalls(cave, cfg, from + g).reduce((a, b) => a + b) / 2) : 0;   // the bird mid-sky; the chopper at the middle of the cave where the grace stretch ends
  return { type: mini.type, cfg, from, d: from, t: 0, n: 0, acc: 0, rec: [], grace: g, course: runCourse(mini, p).filter(o => o.at >= from + g + (mini.type === 'flap' ? FLAP.box.w / 2 : 0)), i: 0, cave,   // (Flap: a post the bird would touch before the grace stretch ends is left out too)
    y, vy: 0, air: false, held: false, holdT: 0, flown: false, lane: 1, laneFrom: 1, laneT: 1, crash: null, done: false };
}
export const runStepOf = type => (type === 'dash' ? DASH.step : type === 'flap' ? FLAP.step : type === 'chopper' ? CHOP.step : LANE.step);
const runNote = (sim, code) => { if (sim.rec) sim.rec.push([sim.n, code]); };   // an input the sim took, at the step it came before
export function runJump(sim) {                                          // Dash: a jump; Flap: a flap; Chopper: the press (it climbs while held)
  if (sim.crash || sim.done) return false;
  if (sim.type === 'flap') { sim.vy = FLAP.vy; sim.flown = true; runNote(sim, 'j'); return true; }
  if (sim.type === 'chopper') { sim.held = true; sim.flown = true; runNote(sim, 'j'); return true; }
  if (sim.type !== 'dash' || sim.air) return false;
  sim.air = true; sim.vy = DASH.vy; sim.held = true; sim.holdT = 0; runNote(sim, 'j'); return true;
}
export function runRelease(sim) {                                       // let go: recorded when it lets go of something (a press held; not after the run has ended)
  const took = sim.held && !sim.crash && !sim.done;
  sim.held = false;
  if (took) runNote(sim, 'r');
  return took;
}
export function runLane(sim, dir) {
  if (sim.type !== 'lane' || sim.crash || sim.done) return false;
  const to = Math.max(0, Math.min(LANE.lanes - 1, Math.round(sim.lane) + dir));
  if (to === Math.round(sim.lane) && sim.laneT >= 1) return false;
  sim.laneFrom = runLaneX(sim); sim.lane = to; sim.laneT = 0;                 // (a change mid-change starts from where the car is)
  runNote(sim, dir < 0 ? 'l' : 'L');
  return true;
}
export function runInput(sim, code) { return code === 'j' ? runJump(sim) : code === 'r' ? runRelease(sim) : code === 'l' ? runLane(sim, -1) : code === 'L' ? runLane(sim, 1) : false; }
// The log: the pairs as base-36 step gaps and the code ("a:j,3:r,1k:j"); read back with the steps in
// order (two inputs can share a step: a tap and its release in one frame), none past maxSteps, or null
// for anything else.
export function runLogOf(pairs) { let s = 0; return pairs.map(([k, c]) => { const d = k - s; s = k; return d.toString(36) + ':' + c; }).join(','); }   // (runLog is the stats' name)
export function runUnlog(str, maxSteps) {
  if (typeof str !== 'string' || str.length > RUN.logMax) return null;
  if (!str) return [];
  const out = [];
  let s = 0;
  for (const part of str.split(',')) {
    const m = /^([0-9a-z]{1,6}):([jrlL])$/.exec(part);
    if (!m) return null;
    s += parseInt(m[1], 36);
    if (s > maxSteps) return null;
    out.push([s, m[2]]);
  }
  return out;
}
// A run played through again from its log: a replay (runReplayer: the sim, the inputs and how far along
// them it is) stepped on to a step (runReplayTo: each input goes in before the step it was logged at),
// or all the way (runReplay: steps steps, or until the crash or the finish before that).
export function runReplayer(mini, p, log, steps) { const sim = runStart(mini, p); sim.rec = null; return { sim, log, k: 0, steps }; }
export function runReplayTo(rep, n) {
  const { sim, log } = rep, to = Math.min(n, rep.steps);
  while (sim.n < to && !sim.crash && !sim.done) {
    while (rep.k < log.length && log[rep.k][0] === sim.n) runInput(sim, log[rep.k++][1]);
    runTick(sim);
  }
  return sim;
}
export function runReplay(mini, p, log, steps) { return runReplayTo(runReplayer(mini, p, log, steps), steps); }
export const runLaneX = sim => (sim.laneT >= 1 ? sim.lane : sim.laneFrom + (sim.lane - sim.laneFrom) * sim.laneT);   // the car's lane, as a number, mid-change
export const overlap = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
// Chopper: the walls at d on this run: in the grace stretch they close in from the edges of the sky.
export function runWalls(sim, d) {
  const [f, c] = caveWalls(sim.cave, sim.cfg, d), k = sim.grace > 0 ? Math.max(0, Math.min(1, (d - sim.from) / sim.grace)) : 1, e = k * k * (3 - 2 * k);
  return [f * e, CHOP.h + (c - CHOP.h) * e];
}
export function runHit(sim) {                                            // the obstacle the runner is touching, if any
  const d = sim.d;
  if (sim.type === 'dash') {
    const x0 = d - DASH.box.w / 2, x1 = d + DASH.box.w / 2, y0 = sim.y, y1 = sim.y + DASH.box.h, s = DASH.shave;
    for (let k = sim.i; k < sim.course.length; k++) {
      const o = sim.course[k], ob = DASH_OBS[o.k];
      if (o.at > d + 4) break;
      if (o.at + ob.w < d - 4) { if (k === sim.i) sim.i++; continue; }
      const oy = ob.y || 0;
      if (overlap(x0, x1, o.at + s, o.at + ob.w - s) && overlap(y0, y1, oy + s, oy + ob.h - s)) return o;
    }
  } else if (sim.type === 'flap') {
    const x0 = d - FLAP.box.w / 2, x1 = d + FLAP.box.w / 2, y0 = sim.y - FLAP.box.h / 2, y1 = sim.y + FLAP.box.h / 2;
    for (let k = sim.i; k < sim.course.length; k++) {
      const o = sim.course[k];
      if (o.at > d + 3) break;
      if (o.at + FLAP.post < d - 3) { if (k === sim.i) sim.i++; continue; }
      if (overlap(x0, x1, o.at, o.at + FLAP.post) && (y0 < o.gy - o.gh / 2 || y1 > o.gy + o.gh / 2)) return o;
    }
  } else if (sim.type === 'chopper') {
    if (d < sim.from + sim.grace) return null;                     // the grace stretch: nothing to touch
    const hw = CHOP.box.w / 2, y0 = sim.y - CHOP.box.h / 2, y1 = sim.y + CHOP.box.h / 2;
    for (const x of [d - hw, d, d + hw]) { const [f, c] = runWalls(sim, x); if (y0 < f) return { k: 'floor' }; if (y1 > c) return { k: 'roof' }; }
    for (let k = sim.i; k < sim.course.length; k++) {
      const o = sim.course[k];
      if (o.at > d + 3) break;
      if (o.at + CHOP.bw < d - 3 * CHOP.k) { if (k === sim.i) sim.i++; continue; }
      if (overlap(d - hw, d + hw, o.at, o.at + CHOP.bw) && overlap(y0, y1, o.y, o.y + o.bh)) return o;
    }
  } else {
    const x = runLaneX(sim);
    for (let k = sim.i; k < sim.course.length; k++) {
      const o = sim.course[k];
      if (o.at > d + 6) break;
      if (o.at < d - 6) { if (k === sim.i) sim.i++; continue; }
      if (Math.abs(o.at - d) < LANE.box && o.cars.some((c, l) => c && Math.abs(l - x) < LANE.laneHit)) return o;
    }
  }
  return null;
}
// One frame of dt seconds: as many whole steps as the time adds up to (the rest waits in acc for the
// next frame; a frame longer than 0.1 s, the page away, counts as 0.1).
export function runStep(sim, dt) {
  if (sim.crash || sim.done) return sim;
  const step = runStepOf(sim.type);
  sim.acc = (sim.acc || 0) + Math.max(0, Math.min(0.1, dt));
  while (sim.acc >= step - 1e-9 && !sim.crash && !sim.done) { sim.acc -= step; runTick(sim); }
  return sim;
}
// One step: the distance grows at the course's speed, the jump or the lane change plays out, a touch is a
// crash (the run ends there), the target is the finish.
export function runTick(sim) {
  if (sim.crash || sim.done) return sim;
  const h = runStepOf(sim.type);
  sim.n = (sim.n || 0) + 1;
  {
    sim.d += runSpeed(sim.cfg, sim.d) * h; sim.t += h;
    if (sim.type === 'dash' && sim.air) {
      const g = sim.held && sim.holdT < DASH.holdMax ? DASH.gHold : DASH.g;
      sim.holdT += h; sim.vy -= g * h; sim.y += sim.vy * h;
      if (sim.y <= 0) { sim.y = 0; sim.vy = 0; sim.air = false; sim.held = false; }
    }
    if (sim.type === 'lane' && sim.laneT < 1) sim.laneT = Math.min(1, sim.laneT + h / LANE.switchSecs);
    const past = sim.d >= sim.from + sim.grace;
    if (sim.type === 'flap') {
      const hh = FLAP.box.h / 2;
      if (sim.flown || past) { sim.vy -= FLAP.g * h; sim.y += sim.vy * h; }
      if (sim.y > FLAP.h - hh) { sim.y = FLAP.h - hh; if (sim.vy > 0) sim.vy = 0; }   // the sky stops it
      if (sim.y < hh) {
        if (past) { sim.y = hh; sim.crash = { at: r2(sim.d), ob: { k: 'ground' } }; return sim; }
        sim.y = hh; sim.vy = 0;                                       // the grace stretch: it lands, unhurt
      }
    }
    if (sim.type === 'chopper') {
      const hh = CHOP.box.h / 2;
      if (sim.flown || past) { sim.vy = Math.max(-CHOP.vmax, Math.min(CHOP.vmax, sim.vy + (sim.held ? CHOP.up : -CHOP.down) * h)); sim.y += sim.vy * h; }
      if (sim.y > CHOP.h - hh) { sim.y = CHOP.h - hh; sim.vy = Math.min(0, sim.vy); }
      if (sim.y < hh) { sim.y = hh; sim.vy = Math.max(0, sim.vy); }
    }
    if (sim.d >= sim.cfg.target) { sim.d = sim.cfg.target; sim.done = true; return sim; }
    const hit = runHit(sim);
    if (hit) sim.crash = { at: r2(sim.d), ob: hit };
  }
  return sim;
}
// The move a run makes: its end (the crash, the finish, or where the time ran out), its time, and its
// inputs (the log) with the steps it took, for the check and the replays.
export const runResult = (sim, out) => ({ dist: r2(Math.min(sim.cfg.target, sim.d)), ms: Math.round(sim.t * 1000), out: !!out && !sim.done, log: runLogOf(sim.rec || []), steps: sim.n });
export function runnerCreate(type, rng) {
  return { type, cfg: runConfig(type), seed: { X: randInt(needRng(rng), 1e9), O: randInt(rng, 1e9) }, dist: { X: 0, O: 0 }, runs: { X: 0, O: 0 }, crashes: { X: [], O: [] }, last: null };   // cfg: the difficulty this square was dealt with; seed: each player's course
}
export function runnerApply(mini, p, m, rng, idx) {   // a run: its end and its time, checked against the course
  const mv = m === 'auto' ? runAuto(mini, p, needRng(rng)) : m;
  const why = runCheck(mini, p, mv);
  if (why) return { ok: false, reason: why };
  const from = mini.dist[p], to = Math.min(mini.cfg.target, r2(Number(mv.dist))), done = to >= mini.cfg.target;
  mini.dist[p] = to; mini.runs[p] += 1;
  if (!done) mini.crashes[p] = (mini.crashes[p] || []).concat(Math.round(to)).slice(-RUN.maxCrashes);
  mini.last = Object.assign({ by: p, from, to, ms: Math.round(Number(mv.ms)), out: !!mv.out && !done, done }, typeof mv.log === 'string' ? { log: mv.log, steps: Number(mv.steps) } : {});   // (the log: the other phone replays the run from it)
  if (done) return { ok: true, outcome: 'win', note: 'finish' };
  return { ok: true, outcome: 'continue', note: mv.out ? 'out' : 'crash' };
}
export function runnerPublicView(mini) {
  return { type: mini.type, cfg: mini.cfg, seed: { X: mini.seed.X, O: mini.seed.O }, dist: { X: mini.dist.X, O: mini.dist.O }, runs: { X: mini.runs.X, O: mini.runs.O } };
}
export function runnerMoveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.run = Object.assign({ from: l.from, to: l.to, ms: l.ms, out: l.out, done: l.done, dist: { X: mini.dist.X, O: mini.dist.O }, runs: { X: mini.runs.X, O: mini.runs.O }, target: mini.cfg.target }, typeof l.log === 'string' ? { log: l.log, steps: l.steps } : {}); return;
}
