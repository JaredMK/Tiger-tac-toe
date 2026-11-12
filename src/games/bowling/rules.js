// Bowling: the rules (pure: no page, no clock; the server runs the same code).
import { cfgKit } from '../../core/config.js';
import { tune } from '../../core/tune.js';
import { PHYSICS, physLast, physRun, physShot } from '../shared/physics.js';
import { BOWL_DEFAULTS } from './meta.js';
export { physicsMoveFlash as moveFlash } from '../shared/physics.js';

// hold: once the pins have settled the sweep clears the deck (the view's BOWL_SWEEP, this long); strike: a strike's banner a little longer.
// powMin: the slowest roll's power (the ball always reaches the pins with something left: the power runs powMin to 1);
// aimMax: the widest aim a move may have (radians off straight); aimSweep: how far the aim meter sweeps either way;
// aimY: the depth on the lane where the aim marker is drawn (just in front of the head pin).
export const BOWLG = { rack: 10, aiErr: [0.03, 0.04], hold: 420, strike: 500, powMin: 0.7, aimMax: 0.3, aimSweep: 0.24, aimY: 62 };
export const bowlTarget = mini => tune(mini).target;   // the pins that take the square (the admin's setting, dealt into the square)
// The old two taps' speeds (config/bowling: the arrow's sweep and the power meter's rise, in ms). Nothing on the page
// reads these now (the three sweeps' periods are in the TUNE); the node, its rule and these names stay so a stored
// config still loads (and a client from before finds its speeds).
export const BOWL_LIMITS = { aimMs: [300, 3000, 10], meterMs: [300, 3000, 10] };
export const BOWL_KIT = cfgKit(BOWL_DEFAULTS, BOWL_LIMITS);
export const setBowlConfig = BOWL_KIT.set, bowlConfig = BOWL_KIT.get;
// A roll: { aim (radians off straight up the lane, + to the right), curve (-1..1: the spin, + hooks to the right; none in
// an older move), power (0..1) }, each rounded to thousandths. Anything else is no roll.
export function bowlShot(m) {
  const s = physShot(m);
  if (!s) return null;
  const c = m.curve == null ? 0 : Number(m.curve);
  if (!Number.isFinite(c) || c < -1 || c > 1) return null;
  return { aim: s.aim, curve: Math.round(c * 1000) / 1000 + 0, power: s.power };
}
export function create(type, rng) {
  return { type, pins: { X: 0, O: 0 }, rolls: { X: 0, O: 0 }, frames: { X: [], O: [] }, final: null, last: null };
}
// A turn is one roll, at a fresh rack. Every pin down goes on the total as it falls (no strike or spare
// bonus). Each roll is kept (frames[p]: { r: [pins], strike, total }) for the score boxes over the lane;
// knocking all ten is a strike (a banner, nothing more).
// The end (November 2026, "Equal rolls", the square's `even` setting, off by default: the rule as it was stays until the admin turns it on): the target takes the square
// outright only for a player who has not rolled more often than the other. Reached with a roll in hand (the
// first to roll there, in the usual race), the other player gets one roll to answer (`mini.final = { by }`):
// more pins than the leader's total takes the square, the same is a draw (the square resets), fewer leaves it
// to the leader. An answer that could not reach the leader's total (more than a rack behind) is not waited
// for: the square is the leader's at once. And the answer cannot be put off for ever: if the leader rolls
// there again first, the square is theirs (note 'unanswered'). First to the target outright gave whoever
// rolled first 67-78% of squares (four or five rolls each, little between them: tests/sim/bowling.sim.js).
// Off (and always in Super Chaos, where both roll every round: scApply): first to the target, as before.
function roll(mini, p, m, even) {
  const shot = bowlShot(m);
  if (!shot) return { ok: false, reason: 'bad' };
  if (!mini.frames) mini.frames = { X: [], O: [] };               // (a square dealt before the score boxes)
  const r = physRun(mini, p, shot);
  if (!r) return { ok: false, reason: 'nophys' };
  const n = r.result.knocked, down = r.result.down.slice(), strike = n === BOWLG.rack, o = p === 'X' ? 'O' : 'X';
  mini.pins[p] += n; mini.rolls[p] += 1;
  mini.frames[p].push({ r: [n], strike, total: n });
  mini.last = physLast(p, shot, r, { curve: shot.curve, knocked: n, down, gutter: r.result.gutter, strike });
  const goal = bowlTarget(mini), fin = even ? mini.final : null;
  if (fin && fin.by === p) { mini.final = null; return { ok: true, outcome: 'win', note: 'unanswered' }; }   // the leader, back before any answer: theirs
  if (fin) {                                                       // the answer: one roll at the leader's total
    const lead = mini.pins[fin.by], mine = mini.pins[p];
    mini.final = null;
    if (mine === lead) return { ok: true, outcome: 'draw', note: 'tie' };
    return mine > lead ? { ok: true, outcome: 'win', note: 'passed' } : { ok: true, outcome: 'win', winner: fin.by, note: 'held' };
  }
  if (mini.pins[p] >= goal) {
    if (even && mini.rolls[p] > mini.rolls[o] && mini.pins[o] + BOWLG.rack >= mini.pins[p]) { mini.final = { by: p }; return { ok: true, outcome: 'continue', note: 'reached' }; }   // the other player's roll to answer
    return { ok: true, outcome: 'win', note: 'pins' };
  }
  return { ok: true, outcome: 'continue', note: strike ? 'strike' : r.result.gutter ? 'gutter' : 'roll' };
}
export function apply(mini, p, m, rng, idx) {
  return roll(mini, p, m, tune(mini).even !== 'off');
}
export function scApply(mini, p, m, rng) {   // Super Chaos: both roll every round, so the target takes the square outright
  return roll(mini, p, m, false);
}
export function publicView(mini) {
  const c = JSON.parse(JSON.stringify(mini)); if (c.last) delete c.last.rec; return c;
}
export function randomMove(mini, p, rng, from, empties) {
  return bowlShot({ aim: (rng() - 0.5) * 0.2, curve: (rng() - 0.5) * 0.6, power: 0.75 + rng() * 0.2 });   // a random gentle roll
}
export function flashMs(f, winLen, won) {
  return (f.phys ? f.phys.ms : 3000) + BOWLG.hold + (won ? 600 : 0) + (f.phys && f.phys.strike ? BOWLG.strike : 0);
}

// ---- The lane in perspective, and the flick (pure geometry the view and its tests share) ----
// The lane is the physics' own (physics-sim.js BOWL: 100 across with a gutter each side, 240 long, y growing
// towards the bowler; the ball starts at BOWL.start, the pins stand near y 24-50, the pit lies past y 0). The
// camera stands behind the bowler, looking down the lane: a point (x, y) on the lane, z above it (lane units),
// is drawn at X = cx + (x - 50) * s(y), Y = Yh + (hC - z) * s(y), with s(y) = F / (dC + BLANE.near - y) the pixels
// a lane unit takes at that depth (dC: the camera's distance behind the near edge, hC: its height, F: its focal
// length, all from the canvas: the near edge fills the width and a little more, the far edge is RATIO of it,
// the lane is drawn from TOP to BOTTOM of the height). Everything shrinks with distance: the pins at the far
// end are small, the ball in the hand is big and shrinks as it rolls away.
export const BLANE = { w: 100, near: 240, far: -12, gutter: 7, start: [50, 214] };   // (near, far: the lane's ends as drawn: the foul line's side, and the back of the pit)
export const BOARD_H = 66;   // the score board's room at the top of the canvas, px (the view draws it; the back row's heads stay under it)
const RATIO = 0.56, NEARW = 1.03, TOP = 0.215, BOTTOM = 0.99, TALL = 1.5;   // (TALL: a canvas taller than this many widths keeps this shape, at the bottom of it: the view never goes top-down on a tall phone)
export function bowlGeom(W, H) {
  const len = BLANE.near - BLANE.far, sN = W * NEARW / BLANE.w, dC = RATIO * len / (1 - RATIO), F = sN * dC;
  const Hg = Math.min(H, W * TALL), oy = H - Hg;
  const Yn = oy + Hg * BOTTOM, Yf = Math.max(oy + Hg * TOP, Math.min(BOARD_H + 30, H * 0.45)), hC = (Yn - Yf) / (sN - F / (dC + len)), Yh = Yn - hC * sN;
  return { W, H, oy, Hg, cx: W / 2, dC, F, hC, Yh, s: y => F / (dC + BLANE.near - y) };
}
export function bowlProject(G, x, y, z = 0) { const s = G.s(y); return { X: G.cx + (x - BLANE.w / 2) * s, Y: G.Yh + (G.hC - z) * s, s }; }
// The angle a lane line from the ball is drawn at (radians off straight up the screen), and back: a straight
// line on the lane is a straight line on the screen, so the roll that goes where a swipe points is exact:
// tan(screen) = tan(aim) * (dC + the ball's depth) / hC.
const laneK = G => (G.dC + BLANE.near - BLANE.start[1]) / G.hC;
export const bowlScreenAngle = (G, aim) => Math.atan(Math.tan(aim) * laneK(G));
export const bowlAimOf = (G, screen) => Math.atan(Math.tan(screen) / laneK(G));
// ---- The three sweeps (pure: the view, the computer and the tests share them) ----
// A roll is three taps, each stopping a meter that sweeps back and forth on a steady period (TUNE aimMs, curveMs,
// powerMs: there and back): 0 the aim (a marker across the lane just in front of the pins), 1 the curve (left to right),
// 2 the power (up from the slowest roll). u, the meter's place, 0 to 1; bowlWave the triangle wave it follows, from
// where each meter starts (the aim and the curve in the middle, the power at the bottom); bowlMeter its value.
export const BOWL_PHASES = ['aim', 'curve', 'power'];
const START = [0.25, 0.25, 0];
export function bowlWave(ms, per, k) { const f = ((ms / Math.max(1, per) + START[k || 0]) % 1 + 1) % 1; return f < 0.5 ? 2 * f : 2 - 2 * f; }
export const bowlPeriods = t => [t && t.aimMs || 1700, t && t.curveMs || 1500, t && t.powerMs || 1300];
const r3 = v => Math.round(v * 1000) / 1000 + 0;
export function bowlMeter(k, u) {
  u = Math.max(0, Math.min(1, u));
  return r3(k === 0 ? (2 * u - 1) * BOWLG.aimSweep : k === 1 ? 2 * u - 1 : BOWLG.powMin + (1 - BOWLG.powMin) * u);
}
export function bowlMeterU(k, v) { return Math.max(0, Math.min(1, k === 0 ? (v / BOWLG.aimSweep + 1) / 2 : k === 1 ? (v + 1) / 2 : (v - BOWLG.powMin) / (1 - BOWLG.powMin))); }
// The way a roll takes as far as the pins (lane points [x, y], a point a unit rolled), by the hook's own law (physics-sim.js
// BOWL hook: the turn by the distance rolled, so the same at any power): the view's guide line, as it was aimed and curved.
export function bowlPath(aim, curve, hook) {
  const B = PHYSICS.lib ? PHYSICS.lib.BOWL : {}, S = { hook: hook != null ? hook : B.hook || 0.01, hookFrom: B.hookFrom || 50, hookLen: B.hookLen || 80 }, out = [];
  let x = BLANE.start[0], y = BLANE.start[1], a = aim, d = 0;
  out.push([x, y]);
  while (y > 40 && x > BLANE.gutter - 2 && x < BLANE.w - BLANE.gutter + 2 && d < 300) {
    const into = BLANE.start[1] - y - S.hookFrom, ramp = into <= 0 ? 0 : Math.min(1, into / S.hookLen);
    a += (curve || 0) * S.hook * ramp; x += Math.sin(a); y -= Math.cos(a); d++;
    out.push([x, y]);
  }
  return out;
}
