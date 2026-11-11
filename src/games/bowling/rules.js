// Bowling: the rules (pure: no page, no clock; the server runs the same code).
import { cfgKit } from '../../core/config.js';
import { tune } from '../../core/tune.js';
import { physLast, physRandom, physRun, physShot } from '../shared/physics.js';
import { BOWL_DEFAULTS } from './meta.js';
export { physicsMoveFlash as moveFlash } from '../shared/physics.js';

// hold: once the pins have settled the sweep clears the deck (the view's BOWL_SWEEP, this long); strike: a strike's banner a little longer.
// powMin: the slowest flick's power (the ball always reaches the pins with something left: the power runs powMin to 1);
// aimMax: the widest aim a flick gives (radians off straight: past the gutter either way).
export const BOWLG = { rack: 10, aiErr: [0.03, 0.04], hold: 420, strike: 500, powMin: 0.7, aimMax: 0.3 };
export const bowlTarget = mini => tune(mini).target;   // the pins that take the square (the admin's setting, dealt into the square)
// The old two taps' speeds (config/bowling: the arrow's sweep and the power meter's rise, in ms). The flick replaced the
// taps in November 2026 and nothing on the page reads these now; the node, its rule and these names stay so a stored
// config still loads (and a client from before, which still has the taps, finds its speeds).
export const BOWL_LIMITS = { aimMs: [300, 3000, 10], meterMs: [300, 3000, 10] };
export const BOWL_KIT = cfgKit(BOWL_DEFAULTS, BOWL_LIMITS);
export const setBowlConfig = BOWL_KIT.set, bowlConfig = BOWL_KIT.get;
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
  const shot = physShot(m);
  if (!shot) return { ok: false, reason: 'bad' };
  if (!mini.frames) mini.frames = { X: [], O: [] };               // (a square dealt before the score boxes)
  const r = physRun(mini, p, shot);
  if (!r) return { ok: false, reason: 'nophys' };
  const n = r.result.knocked, down = r.result.down.slice(), strike = n === BOWLG.rack, o = p === 'X' ? 'O' : 'X';
  mini.pins[p] += n; mini.rolls[p] += 1;
  mini.frames[p].push({ r: [n], strike, total: n });
  mini.last = physLast(p, shot, r, { knocked: n, down, gutter: r.result.gutter, strike });
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
  return physRandom(mini, p, rng);   // a random gentle shot
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
// The flick, exactly and predictably (the view reads the swipe, this maps it; the same on every phone):
//   direction: the swipe's angle on the screen (dx right, dy up, in pixels, from first touch to release) is the
//     line the ball rolls along as the lane is drawn (bowlAimOf): a swipe that points at a drawn pin rolls at
//     that pin, perspective and all. angleGain (TUNE) scales dx first. Clamped to BOWLG.aimMax either way.
//   speed: the finger's speed v (CSS px/ms over the last ~80 ms of the swipe, not its length) maps straight onto
//     the power: flickMin rolls at BOWLG.powMin (a slow ball that still reaches the pins), flickMax at full power.
// Returns { aim, power } (the move), or null for a swipe that is not a roll (too short, or sideways).
export function bowlFlick(G, dx, dy, v, t) {
  if (!(dy >= 14) || Math.abs(dx) > dy * 1.2) return null;
  const gain = t && t.angleGain != null ? t.angleGain : 1, lo = t && t.flickMin != null ? t.flickMin : 0.4, hi = t && t.flickMax != null ? t.flickMax : 1.7;
  const u = Math.max(0, Math.min(1, (v - lo) / Math.max(0.05, hi - lo)));
  const aim = Math.max(-BOWLG.aimMax, Math.min(BOWLG.aimMax, bowlAimOf(G, Math.atan2(dx * gain, dy))));
  return { aim: Math.round(aim * 1000) / 1000 + 0, power: Math.round((BOWLG.powMin + (1 - BOWLG.powMin) * u) * 1000) / 1000 + 0 };
}
