// Bowling: the rules (pure: no page, no clock; the server runs the same code).
import { cfgKit } from '../../core/config.js';
import { tune } from '../../core/tune.js';
import { physLast, physRandom, physRun, physShot } from '../shared/physics.js';
import { BOWL_DEFAULTS } from './meta.js';
export { physicsMoveFlash as moveFlash } from '../shared/physics.js';

export const BOWLG = { rack: 10, aiErr: [0.025, 0.04], hold: 800 };
export const bowlTarget = mini => tune(mini).target;   // the pins that take the square (the admin's setting, dealt into the square)
// A frame's second roll, if one is owed: the same player's first roll left pins standing, and nothing else has
// happened in the square since (a turn that ran out closes the frame as it stands).
export const bowlOpen = (mini, p) => (mini.open && mini.open.by === p && mini.last && mini.last.by === p && !mini.last.strike && mini.last.roll === 1 ? mini.open : null);
// The two taps' speeds (config/bowling, from the admin's dashboard): the arrow's sweep and the power meter's rise, in ms.
export const BOWL_LIMITS = { aimMs: [300, 3000, 10], meterMs: [300, 3000, 10] };
export const BOWL_KIT = cfgKit(BOWL_DEFAULTS, BOWL_LIMITS);
export const setBowlConfig = BOWL_KIT.set, bowlConfig = BOWL_KIT.get;
export function create(type, rng) {
  return { type, pins: { X: 0, O: 0 }, rolls: { X: 0, O: 0 }, frames: { X: [], O: [] }, open: null, last: null };
}
// A turn is a frame of up to two rolls. The first goes at a fresh rack; a strike ends the frame, else the
// same player rolls again (again: the core keeps them in the square) at the pins left standing. Every pin
// down goes on the total as it falls (no strike or spare bonus); the target takes the square. Each frame is
// kept (frames[p]: { r: [first, second], strike, spare, total }) for the score boxes beside the lane.
export function apply(mini, p, m, rng, idx) {
  const shot = physShot(m);
  if (!shot) return { ok: false, reason: 'bad' };
  if (!mini.frames) mini.frames = { X: [], O: [] };               // (a square dealt before frames)
  const open = bowlOpen(mini, p);
  if (!open) mini.open = null;
  const r = physRun(mini, p, shot);
  if (!r) return { ok: false, reason: 'nophys' };
  const n = r.result.knocked, down = r.result.down.slice(), frames = mini.frames[p];
  mini.pins[p] += n; mini.rolls[p] += 1;
  let strike = false, spare = false;
  if (open) {                                                    // the second roll: the frame closes
    const fr = frames[frames.length - 1];
    fr.r.push(n); fr.total = fr.r[0] + n; spare = fr.spare = down.every(Boolean);
    mini.open = null;
  } else {
    strike = n === BOWLG.rack;
    frames.push({ r: [n], strike, spare: false, total: n });
    mini.open = strike ? null : { by: p, down: down.slice() };
  }
  mini.last = physLast(p, shot, r, { knocked: n, down, gutter: r.result.gutter, strike, spare, roll: open ? 2 : 1 });
  if (mini.pins[p] >= bowlTarget(mini)) return { ok: true, outcome: 'win', note: 'pins' };
  return Object.assign({ ok: true, outcome: 'continue', note: strike ? 'strike' : spare ? 'spare' : r.result.gutter ? 'gutter' : 'roll' }, mini.open ? { again: true } : {});
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
