// Mini Golf: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { PHYSICS, physLast, physRandom, physRun, physRunBoth, physShot } from '../shared/physics.js';
export { physicsMoveFlash as moveFlash } from '../shared/physics.js';

export const GOLF = { goal: 1, aiErr: [0.035, 0.04], hold: 700 };
// Mini Golf's hole for a new square: a page may choose it (a local game: one this device has not had lately);
// otherwise (the server, online) any hole at random.
export let golfPick = null;
export const setGolfPick = fn => { golfPick = typeof fn === 'function' ? fn : null; };
// A hole's path (the way round its walls, ending at the cup): the next point to make for from a place,
// and how far there is still to go along it.
export function golfClear(hole, a, b) {                              // a straight roll from a to b: clear of the hole's walls and bumpers?
  const R = PHYSICS.lib.GOLF.ballR + 0.6, n = 24;
  for (let i = 1; i < n; i++) {
    const x = a[0] + (b[0] - a[0]) * i / n, y = a[1] + (b[1] - a[1]) * i / n;
    for (const [cx, cy, w, h, ang] of hole.walls) {
      const c = Math.cos(ang || 0), s = Math.sin(ang || 0), dx = x - cx, dy = y - cy;
      if (Math.abs(dx * c + dy * s) < w / 2 + R && Math.abs(dy * c - dx * s) < h / 2 + R) return false;
    }
    for (const [cx, cy, r] of hole.bumpers) if (Math.hypot(x - cx, y - cy) < r + R) return false;
  }
  return true;
}
export function golfNext(hole, pos) {                                 // the path point in sight with the least way still to go (any point, if none is)
  let best = -1, bd = Infinity;
  const pick = (pt, i) => { const d = Math.hypot(pt[0] - pos[0], pt[1] - pos[1]) + golfAhead(hole, i); if (d < bd) { bd = d; best = i; } };
  hole.path.forEach((pt, i) => { if (golfClear(hole, pos, pt)) pick(pt, i); });
  if (best < 0) hole.path.forEach(pick);
  return best;
}
export function golfAhead(hole, i) { let s = 0; for (let k = i; k < hole.path.length - 1; k++) s += Math.hypot(hole.path[k + 1][0] - hole.path[k][0], hole.path[k + 1][1] - hole.path[k][1]); return s; }
export function golfLeft(hole, pos) { const i = golfNext(hole, pos); return Math.hypot(hole.path[i][0] - pos[0], hole.path[i][1] - pos[1]) + golfAhead(hole, i); }
export function create(type, rng) {   // a hole (any of them, or the page's own choice: golfPick); both balls side by side on the tee
  const L = PHYSICS.lib, n = L ? L.HOLES.length : 6, r = needRng(rng), own = golfPick && L ? golfPick(r, L.HOLES) : null;
  const hole = Number.isInteger(own) && own >= 0 && own < n ? own : randInt(r, n), tee = L ? L.HOLES[hole].tee : [50, 140];
  return { type, hole, balls: { X: [tee[0] - 3, tee[1]], O: [tee[0] + 3, tee[1]] }, holed: { X: false, O: false }, shots: { X: 0, O: 0 }, last: null };
}
export function apply(mini, p, m, rng, idx) {   // a shot: the balls play out; the first in the cup takes the square (even knocked in by the other)
  const shot = physShot(m);
  if (!shot) return { ok: false, reason: 'bad' };
  if (mini.holed[p]) return { ok: false, reason: 'done' };
  const r = physRun(mini, p, shot);
  if (!r) return { ok: false, reason: 'nophys' };
  mini.shots[p] += 1;
  for (const q of ['X', 'O']) if (r.final[q] !== undefined) { if (r.final[q] === null) mini.holed[q] = true; else mini.balls[q] = r.final[q]; }
  mini.last = physLast(p, shot, r, { holed: r.result.holed, first: r.result.first, lip: r.events.some(e => e.k === 'lip') });
  if (r.result.first) return { ok: true, outcome: 'win', note: r.result.first === p ? 'holed' : 'knockedIn', winner: r.result.first };
  return { ok: true, outcome: 'continue', note: mini.last.lip ? 'lip' : 'shot' };
}
export function publicView(mini) {
  const c = JSON.parse(JSON.stringify(mini)); if (c.last) delete c.last.rec; return c;
}
export function randomMove(mini, p, rng, from, empties) {
  return physRandom(mini, p, rng);   // a random gentle shot
}
export function flashMs(f, winLen, won) {
  if (f.phys && f.phys.locked) return 500;                         // Super Chaos: a shot locked in (it plays at the round's end)
  return (f.phys ? f.phys.ms : 3000) + GOLF.hold + (won ? 600 : 0);
}
// Super Chaos: each player locks in an aim and a power (scApply); once the round ends, the shots locked in
// play out together from where the balls stood, so both balls roll at once and can collide. A ball that
// drops this round wins the square; both dropping resets it.
export function scApply(mini, p, m, rng) {
  const shot = physShot(m);
  if (!shot) return { ok: false, reason: 'bad' };
  if (mini.holed[p]) return { ok: false, reason: 'done' };
  if (mini.aim && mini.aim[p]) return { ok: false, reason: 'locked' };
  mini.aim = Object.assign({}, mini.aim, { [p]: shot });
  mini.last = { by: p, aim: shot.aim, power: shot.power, locked: true };
  return { ok: true, outcome: 'continue', note: 'locked', waits: true };
}
export function scMerge(m, c) {
  const b = c.base, shots = {};
  for (const p of c.played) { const a = c.forks[p].aim; if (a && a[p]) shots[p] = a[p]; }
  m.balls = JSON.parse(JSON.stringify(b.balls)); m.holed = Object.assign({}, b.holed); m.shots = Object.assign({}, b.shots); delete m.aim;
  const r = Object.keys(shots).length ? physRunBoth(b, shots) : null;
  if (!r) { m.last = b.last; return { win: { X: false, O: false } }; }
  for (const p of Object.keys(shots)) m.shots[p] += 1;
  for (const q of ['X', 'O']) if (r.final[q] !== undefined) { if (r.final[q] === null) m.holed[q] = true; else m.balls[q] = r.final[q]; }
  m.last = { by: c.cpu in shots ? c.cpu : c.me, both: shots, aim: (shots[c.me] || shots[c.cpu]).aim, power: (shots[c.me] || shots[c.cpu]).power, ms: r.ms, events: r.events, rec: r.rec, holed: r.result.holed, first: r.result.first, lip: r.events.some(e => e.k === 'lip') };
  return { win: { X: !b.holed.X && m.holed.X, O: !b.holed.O && m.holed.O }, replay: true };
}
