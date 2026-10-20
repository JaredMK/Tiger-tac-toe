// Bowling: the rules (pure: no page, no clock; the server runs the same code).
import { cfgKit } from '../../core/config.js';
import { physLast, physRandom, physRun, physShot } from '../shared/physics.js';
import { BOWL_DEFAULTS } from './meta.js';
export { physicsMoveFlash as moveFlash } from '../shared/physics.js';

export const BOWLG = { goal: 25, rack: 10, aiErr: [0.025, 0.04], hold: 800 };
// The two taps' speeds (config/bowling, from the admin's dashboard): the arrow's sweep and the power meter's rise, in ms.
export const BOWL_LIMITS = { aimMs: [300, 3000, 10], meterMs: [300, 3000, 10] };
export const BOWL_KIT = cfgKit(BOWL_DEFAULTS, BOWL_LIMITS);
export const setBowlConfig = BOWL_KIT.set, bowlConfig = BOWL_KIT.get;
export function create(type, rng) {
  return { type, pins: { X: 0, O: 0 }, rolls: { X: 0, O: 0 }, last: null };
}
export function apply(mini, p, m, rng, idx) {   // a roll at a fresh rack: the pins down go on the total; 25 takes the square
  const shot = physShot(m);
  if (!shot) return { ok: false, reason: 'bad' };
  const r = physRun(mini, p, shot);
  if (!r) return { ok: false, reason: 'nophys' };
  const n = r.result.knocked;
  mini.pins[p] += n; mini.rolls[p] += 1;
  mini.last = physLast(p, shot, r, { knocked: n, down: r.result.down.slice(), gutter: r.result.gutter, strike: n === BOWLG.rack });
  if (mini.pins[p] >= BOWLG.goal) return { ok: true, outcome: 'win', note: 'pins' };
  return { ok: true, outcome: 'continue', note: n === BOWLG.rack ? 'strike' : r.result.gutter ? 'gutter' : 'roll' };
}
export function publicView(mini) {
  const c = JSON.parse(JSON.stringify(mini)); if (c.last) delete c.last.rec; return c;
}
export function randomMove(mini, p, rng, from, empties) {
  return physRandom(mini, p, rng);   // a random gentle shot
}
export function flashMs(f, winLen, won) {
  return (f.phys ? f.phys.ms : 3000) + BOWLG.hold + (won ? 600 : 0) + (f.phys && f.phys.strike ? 500 : 0);
}
