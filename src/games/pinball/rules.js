// Pinball: the rules (pure: no page, no clock; the server runs the same code).
import { cfgKit } from '../../core/config.js';
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
// (tests/games/pinball.test.js, tests/sim/pinball.sim.js). A move is one ball: { hits: [[target,
// seconds]...] (the targets lit, when), ms (the ball's time), rec (the recording), end }. The server
// cannot play a ball through again (Matter.js on another phone need not land on the same fraction), so
// it checks the recording instead: no longer than the time allows, the ball never moving faster than
// the table lets it (or anywhere but back to the plunger), and the ball at each target it claims, at
// that moment.
export const PINB = { hold: 900, targets: 7 };
export const PINB_LIMITS = { size: [0.6, 2, 0.05], save: [0, 10, 0.5], maxBall: [20, 300, 5], g: [0.5, 2, 0.05], bump: [0.5, 2, 0.05], spin: [0, 3, 0.05] };
export const PINB_KIT = cfgKit(PINB_DEFAULTS, PINB_LIMITS);
export const setPinConfig = PINB_KIT.set, pinConfig = PINB_KIT.get;
export const pinCount = () => PINB.targets;
// The table of a square (its layout and its seven targets, built by the physics), for the check, the
// screen and the computer: pinTable falls back to the classic table for a square dealt before the layouts.
export const pinTableOf = mini => (PHYSICS.lib && PHYSICS.lib.PIN ? PHYSICS.lib.pinTable(mini) : null);
// A square's table dealt: a layout at random, then seven of its spots at random (each spot at most once).
export function pinDeal(rng) {
  const L = PHYSICS.lib, lays = L && L.PIN_LAYOUTS;
  if (!lays || !lays.length) return null;
  const k = Math.min(lays.length - 1, Math.floor(rng() * lays.length)), pool = lays[k].spots.map((_, i) => i), t = [];
  while (t.length < PINB.targets && pool.length) t.push(pool.splice(Math.min(pool.length - 1, Math.floor(rng() * pool.length)), 1)[0]);
  return { k, t };
}
export function pinCheck(mini, p, m) {
  const L = PHYSICS.lib;
  if (!L || !L.PIN) return 'physics';
  if (!m || typeof m !== 'object' || !Array.isArray(m.hits)) return 'bad';
  const T = L.PIN, TB = L.pinTable(mini), ms = Number(m.ms), fps = T.fps;
  if (!Number.isFinite(ms) || ms < 0 || ms > (mini.cfg.maxBall + 90) * 1000) return 'bad';
  const fr = L.pinUnpack(m.rec);
  if (!fr) return 'bad';
  if (Math.abs(fr.length - (ms / 1000) * fps) > 3 + fr.length * 0.03) return 'time';
  const jump = (T.vmax / fps) * 1.3 + 2, [sx, sy] = T.lane.serve;
  for (let k = 0; k < fr.length; k++) {
    const [x, y] = fr[k];
    if (x < 0 || x > T.w || y < 0 || y > T.h + 10) return 'table';
    if (k && Math.hypot(x - fr[k - 1][0], y - fr[k - 1][1]) > jump && !(x >= T.lane.x0 && Math.abs(x - sx) < 3 && y >= sy - jump)) return 'jump';   // (faster than any ball moves, unless back at the plunger: served again, perhaps launched already)
  }
  const seen = {};
  for (const h of m.hits) {
    if (!Array.isArray(h) || h.length !== 2) return 'bad';
    const id = h[0], t = Number(h[1]), tg = TB.targets[id];
    if (!Number.isInteger(id) || !tg || seen[id] || mini.lit[p][id] || !Number.isFinite(t) || t < 0 || t > ms / 1000 + 0.05) return 'hit';
    seen[id] = 1;
    const [tx, ty] = tg.spin ? L.pinSpinAt(tg, t, mini.cfg) : [tg.x, tg.y], reach = tg.r + T.ballR + (T.vmax / fps) + 1.5, f = Math.round(t * fps);   // (tg.r: the target at the square's size setting)
    let near = false;
    for (let k = Math.max(0, f - 1); k <= Math.min(fr.length - 1, f + 1); k++) if (Math.hypot(fr[k][0] - tx, fr[k][1] - ty) <= reach) near = true;
    if (!near) return 'hit';
  }
  return null;
}
export function create(type, rng) {
  const table = pinDeal(rng), n = table ? table.t.length : pinCount();
  return Object.assign({ type, cfg: pinConfig() }, table ? { table } : {}, { lit: { X: new Array(n).fill(0), O: new Array(n).fill(0) }, balls: { X: 0, O: 0 }, last: null });
}
export function publicView(mini) {
  const c = JSON.parse(JSON.stringify(mini)); if (c.last) { delete c.last.rec; delete c.last.log; } return c;
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';       // the attempt ends where it stands: no progress from it
}
