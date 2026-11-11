// Pinball: the rules (pure: no page, no clock; the server runs the same code).
import { cfgKit } from '../../core/config.js';
import { tuneLive } from '../../core/tune.js';
import { PHYSICS } from '../shared/physics.js';
import { PINB_DEFAULTS } from './meta.js';
export { fingerApply as apply } from '../shared/finger.js';
export { fingerMoveFlash as moveFlash } from '../shared/finger.js';
export { fingerFlashMs as flashMs } from '../shared/finger.js';

// Pinball: the tables are physics-sim.js's (PIN, PIN_LAYOUTS); here are the settings (the admin's,
// config/pinball), the deal of a square's table, the check a phone's ball must pass online, and the ball
// the computer plays. A square's table (mini.table: { k, t }) is one of the layouts, picked at random,
// with seven of its target spots dealt at random; every layout is held to the layout check (no two
// elements overlapping or closer than a unit, no pocket a ball can rest in, room for the ball at every
// spot) and every spot to the computer's hand lighting it in the simulations, so any seven can be dealt
// (tests/games/pinball.test.js, tests/sim/pinball.sim.js). A move is one ball, as its inputs: { log (the
// flippers as they change, each launch and its power, at their steps), steps, and what the phone says
// came of it: hits [[target, seconds]...], ms, end }. The ball is plain arithmetic in fixed steps
// (physics-sim.js), the same everywhere, so whoever checks the move plays it through again from the log
// and takes its own ball's result (pinReplayCheck); a ball without its inputs is refused.
export const PINB = { hold: 900, targets: 7 };
export const PINB_LIMITS = { size: [0.6, 2, 0.05], save: [0, 10, 0.5], maxBall: [20, 300, 5], g: [0.5, 2, 0.05], bump: [0.5, 2, 0.05], spin: [0, 3, 0.05] };
export const PINB_KIT = cfgKit(PINB_DEFAULTS, PINB_LIMITS);
export const setPinConfig = PINB_KIT.set, pinConfig = PINB_KIT.get;
export const pinCount = () => PINB.targets;
// The table of a square (its layout and its seven targets, built by the physics), for the check, the
// screen and the computer: pinTable falls back to the classic table for a square dealt before the layouts.
export const pinTableOf = mini => (PHYSICS.lib && PHYSICS.lib.PIN ? PHYSICS.lib.pinTable(mini) : null);
// A square's table dealt: a layout at random, then seven of its spots at random (each spot at most once;
// n: how many, the square's setting, seven by default).
export function pinDeal(rng, n) {
  n = n || PINB.targets;
  const L = PHYSICS.lib, lays = L && L.PIN_LAYOUTS;
  if (!lays || !lays.length) return null;
  const k = Math.min(lays.length - 1, Math.floor(rng() * lays.length)), pool = lays[k].spots.map((_, i) => i), t = [];
  while (t.length < n && pool.length) t.push(pool.splice(Math.min(pool.length - 1, Math.floor(rng() * pool.length)), 1)[0]);
  return { k, t };
}
// Security review F3: a ball is its inputs (m.log, m.steps: physics-sim.js pinLogPack), and the server (or, in
// local play, this phone) plays it through again on a fresh table (pinReplay) and takes its own ball's result (the
// targets lit, the time, the end), never the phone's; the other phone replays the ball from the same inputs. The phone's claim (hits, end) is only compared,
// for the record (diff). The same ball is simulated at most once here (PIN_MEMO: a transaction tried again).
export const PIN_MEMO = new Map();
export function pinReplayCheck(mini, p, m) {
  const L = PHYSICS.lib;
  if (!L || !L.PIN) return { why: 'physics' };
  const steps = Number(m.steps), max = Math.ceil(((mini.cfg && mini.cfg.maxBall) || 120) * L.PIN.hz) + 90 * L.PIN.hz;
  if (typeof m.log !== 'string' || !Number.isInteger(steps) || steps < 1 || steps > max) return { why: 'bad' };
  const log = L.pinLogUnpack(m.log, steps);
  if (!log) return { why: 'bad' };
  const key = JSON.stringify([mini.table || null, mini.cfg, mini.lit[p], m.log, steps]);
  let sim = PIN_MEMO.get(key);
  if (!sim) {
    sim = L.pinResult(L.pinReplay(L.pinTable(mini), mini.cfg, mini.lit[p], log, steps));
    if (PIN_MEMO.size >= 40) PIN_MEMO.clear();
    PIN_MEMO.set(key, sim);
  }
  const same = Array.isArray(m.hits) && m.hits.length === sim.hits.length && m.hits.every((h, k) => Array.isArray(h) && h[0] === sim.hits[k][0]) && String(m.end) === sim.end;
  return { why: null, sim, diff: !same };
}
export function create(type, rng) {
  const table = pinDeal(rng, tuneLive(type).targets), n = table ? table.t.length : pinCount();   // (targets: the admin's setting; a square without physics plays the classic seven)
  return Object.assign({ type, cfg: pinConfig() }, table ? { table } : {}, { lit: { X: new Array(n).fill(0), O: new Array(n).fill(0) }, balls: { X: 0, O: 0 }, started: { X: null, O: null }, last: null });   // started: when each pressed Start (online: server time, the attempt timed from it)
}
export function publicView(mini) {
  const c = JSON.parse(JSON.stringify(mini)); if (c.last) { delete c.last.rec; delete c.last.log; } return c;
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';       // the attempt ends where it stands: no progress from it
}
