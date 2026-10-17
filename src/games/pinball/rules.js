// Pinball: the rules (pure: no page, no clock; the server runs the same code).
import { cfgKit } from '../../core/config.js';
import { PHYSICS } from '../shared/physics.js';
import { PINB_DEFAULTS } from './meta.js';
export { fingerApply as apply } from '../shared/finger.js';
export { fingerMoveFlash as moveFlash } from '../shared/finger.js';
export { fingerFlashMs as flashMs } from '../shared/finger.js';

// Pinball: the table is physics.js's (PIN); here are its settings (the admin's, config/pinball), the
// check a phone's ball must pass online, and the ball the computer plays. A move is one ball: { hits:
// [[target, seconds]...] (the targets lit, when), ms (the ball's time), rec (the recording), end }. The
// server cannot play a ball through again (Matter.js on another phone need not land on the same
// fraction), so it checks the recording instead: no longer than the time allows, the ball never moving
// faster than the table lets it (or anywhere but back to the plunger), and the ball at each target it
// claims, at that moment.
export const PINB = { hold: 900 };
export const PINB_LIMITS = { size: [0.6, 2, 0.05], save: [0, 10, 0.5], maxBall: [20, 300, 5], g: [0.5, 2, 0.05], bump: [0.5, 2, 0.05], spin: [0, 3, 0.05] };
export const PINB_KIT = cfgKit(PINB_DEFAULTS, PINB_LIMITS);
export const setPinConfig = PINB_KIT.set, pinConfig = PINB_KIT.get;
export const pinCount = () => (PHYSICS.lib && PHYSICS.lib.PIN ? PHYSICS.lib.PIN.targets.length : 7);
export function pinCheck(mini, p, m) {
  const L = PHYSICS.lib;
  if (!L || !L.PIN) return 'physics';
  if (!m || typeof m !== 'object' || !Array.isArray(m.hits)) return 'bad';
  const T = L.PIN, ms = Number(m.ms), fps = T.fps;
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
    const id = h[0], t = Number(h[1]), tg = T.targets[id];
    if (!Number.isInteger(id) || !tg || seen[id] || mini.lit[p][id] || !Number.isFinite(t) || t < 0 || t > ms / 1000 + 0.05) return 'hit';
    seen[id] = 1;
    const [tx, ty] = tg.spin ? L.pinSpinAt(t, mini.cfg) : [tg.x, tg.y], reach = tg.r * mini.cfg.size + T.ballR + (T.vmax / fps) + 1.5, f = Math.round(t * fps);
    let near = false;
    for (let k = Math.max(0, f - 1); k <= Math.min(fr.length - 1, f + 1); k++) if (Math.hypot(fr[k][0] - tx, fr[k][1] - ty) <= reach) near = true;
    if (!near) return 'hit';
  }
  return null;
}
export function create(type, rng) {
  return { type, cfg: pinConfig(), lit: { X: new Array(pinCount()).fill(0), O: new Array(pinCount()).fill(0) }, balls: { X: 0, O: 0 }, last: null };
}
export function publicView(mini) {
  const c = JSON.parse(JSON.stringify(mini)); if (c.last) { delete c.last.rec; delete c.last.log; } return c;
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';       // the attempt ends where it stands: no progress from it
}
