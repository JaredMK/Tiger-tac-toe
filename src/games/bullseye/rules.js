// Bullseye: the rules (pure: no page, no clock; the server runs the same code).
import { needRng } from '../../core/random.js';
import { r3 } from '../../core/util.js';
import { BULL_DEFAULTS } from './meta.js';
import { tune } from '../../core/tune.js';

// ---------- the arcade games: Bullseye, Echo, Peg Drop, Cup Pong, Trivia, Odd One Out ----------
// Bullseye (darts; reworked November 2026, `v: 2`, CLIENT_VERSION 1.13.0): a dartboard hangs on a wall, the
// same for both players, and stays where it is. The scene is 100 units across: the wall from y 0 (its top)
// down to BULLS.wall, the floor below it, the board's middle at BULLS.at, the thrower's hand at BULLS.hand.
// A throw is a flick, { aim, power } (as Cup Pong's): the aim is the angle off straight up (-1 to 1, in
// units of BULLS.angle radians), the power the distance up the wall from the hand (0 to 1: BULLS.near to
// BULLS.far units: the weakest falls short at the thrower's feet, the hardest flies over the wall's top), so
// the dart is thrown at the wall point hand + distance along that angle, and lands
// there plus a little scatter either way (the square's `spread`, drawn with the move's rng: the server's
// online, so a phone can claim no better dart than it threw). The board has three rings (config/bulls,
// the admin's dashboard, copied into each square as it is dealt: board, mid and bull, their radii): the
// bullseye scores bullPts (3), the inner ring 2, the outer ring 1, off the board 0; first to goal (7)
// takes the square (at 3 a dart at most, never in two throws). Every dart stays where it landed (darts:
// [player, x, y], the last BULLS.keep of them; n: how many have been thrown in all).
// A square dealt before the rework (no v: the small board that moved about a field, two sweeping lines
// stopped by taps) carries its points over and plays on by these rules (bullUp, from core/minis.js
// upgradeMini and from apply).
export const BULLS = { goal: 7, w: 100, h: 114, wall: 84, at: [50, 38], hand: [50, 91], angle: 0.75, near: 0, far: 140, bullPts: 3, midPts: 2, boardPts: 1, keep: 10 };   // (the board fills the wall: 64 of its 100 across by default; far is past the wall's top: the hardest flicks fly over it)
export const BULL_LIMITS = { board: [16, 35], mid: [5, 28], bull: [1, 14] };
export const BULL_CFG = { cfg: null };
export function bullsNorm(raw) {
  const out = {};
  for (const k of Object.keys(BULL_DEFAULTS)) {
    const v = raw && raw[k] != null ? Number(raw[k]) : NaN, [lo, hi] = BULL_LIMITS[k];
    out[k] = Number.isFinite(v) && v >= lo && v <= hi ? r3(v) : BULL_DEFAULTS[k];
  }
  if (out.mid >= out.board) out.mid = r3(out.board * 0.55);        // each ring inside the one round it
  if (out.bull >= out.mid) out.bull = r3(out.mid * 0.35);
  return out;
}
// (A stored config without `mid` is from before the rework, a small board with its sweep and ramp: ignored.)
export function setBullsConfig(raw) { BULL_CFG.cfg = raw && typeof raw === 'object' && raw.mid != null ? bullsNorm(raw) : null; }
export const bullsConfig = () => Object.assign({}, BULL_CFG.cfg || BULL_DEFAULTS);
const r2 = v => Math.round(v * 100) / 100 + 0;                          // (+ 0: never a -0, which is not plain JSON)
const gauss = rng => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };   // (Box-Muller)
export const bullsDist = power => BULLS.near + (BULLS.far - BULLS.near) * power;
// Where a throw is aimed (no scatter): the wall point at its distance from the hand along its angle.
export function bullsPoint(aim, power) { const th = aim * BULLS.angle, d = bullsDist(power); return [BULLS.hand[0] + Math.sin(th) * d, BULLS.hand[1] - Math.cos(th) * d]; }
// The throw aimed at a wall point (the computer's aim, before its own error; the tests'), each part kept to its range.
export function bullsAimAt(x, y) {
  const dx = x - BULLS.hand[0], dy = BULLS.hand[1] - y;
  return { aim: r3(Math.max(-1, Math.min(1, Math.atan2(dx, dy) / BULLS.angle))), power: r3(Math.max(0, Math.min(1, (Math.hypot(dx, dy) - BULLS.near) / (BULLS.far - BULLS.near)))) };
}
// Where a throw lands: where it is aimed, plus the scatter (t: the square's settings).
export function bullsThrow(aim, power, rng, t) {
  const spread = t && t.spread != null ? t.spread : 5, [x, y] = bullsPoint(aim, power);
  return [r2(x + gauss(rng) * spread), r2(y + gauss(rng) * spread)];
}
// What a dart scores where it landed: how far from the board's middle, its ring and the points.
export function bullsScore(cfg, x, y, bullPts) {
  const d = r2(Math.hypot(x - BULLS.at[0], y - BULLS.at[1]));
  const zone = d <= cfg.bull ? 'bull' : d <= cfg.mid ? 'mid' : d <= cfg.board ? 'board' : 'miss';
  return { d, zone, pts: zone === 'bull' ? bullPts || BULLS.bullPts : zone === 'mid' ? BULLS.midPts : zone === 'board' ? BULLS.boardPts : 0 };
}
export const bullIs = pts => pts > BULLS.midPts;                        // a bullseye (whatever it scores)
// A square from before the rework (no v): its points stay, the rest becomes the board on the wall.
export function bullUp(mini) {
  if (!mini || mini.type !== 'bullseye' || mini.v === 2) return mini;
  mini.v = 2; mini.cfg = bullsConfig(); mini.darts = []; mini.n = 0; mini.last = null;
  if (!mini.pts) mini.pts = { X: 0, O: 0 };
  delete mini.speed; delete mini.pos;
  return mini;
}
export function create(type, rng) {
  return { type, v: 2, cfg: bullsConfig(), pts: { X: 0, O: 0 }, darts: [], n: 0, last: null };
}
export function apply(mini, p, m, rng, idx) {   // a flick: the dart lands where it was thrown, give or take the scatter, and scores by its ring
  bullUp(mini);
  let aim, power;
  rng = needRng(rng);
  if (m === 'auto') { const a = bullsAimAt(BULLS.at[0] + (rng() - 0.5) * 90, BULLS.at[1] + (rng() - 0.5) * 90); aim = a.aim; power = a.power; }
  else if (m && typeof m === 'object' && Number.isFinite(m.aim) && Number.isFinite(m.power)) { aim = r3(Math.max(-1, Math.min(1, m.aim))); power = r3(Math.max(0, Math.min(1, m.power))); }
  else return { ok: false, reason: 'bad' };
  const t = tune(mini), [x, y] = bullsThrow(aim, power, rng, t), sc = bullsScore(mini.cfg, x, y, t.bullPts);
  mini.pts[p] += sc.pts;
  mini.darts.push([p, x, y]); while (mini.darts.length > BULLS.keep) mini.darts.shift();
  mini.n = (mini.n || 0) + 1;
  mini.last = { by: p, aim, power, x, y, d: sc.d, zone: sc.zone, pts: sc.pts };
  const note = sc.zone === 'bull' ? 'bull' : sc.pts ? 'board' : 'miss';
  if (mini.pts[p] >= t.goal) return { ok: true, outcome: 'win', note: note === 'miss' ? 'board' : note };
  return { ok: true, outcome: 'continue', note };
}
export function publicView(mini) {
  if (mini.v !== 2) return { type: 'bullseye', v: 2, cfg: bullsConfig(), pts: { X: (mini.pts && mini.pts.X) || 0, O: (mini.pts && mini.pts.O) || 0 }, darts: [], n: 0 };   // (a square from before, not yet thrown at)
  return { type: 'bullseye', v: 2, cfg: Object.assign({}, mini.cfg), pts: { X: mini.pts.X, O: mini.pts.O }, darts: mini.darts.map(d => d.slice()), n: mini.n };
}
// A random throw: at the board, roughly (the tests' and the sandbox's stand-in for a flick; a phone never sends
// 'auto', core/verify.js, so this is a real move everywhere).
export function randomMove(mini, p, rng, from, empties) {
  return bullsAimAt(BULLS.at[0] + (rng() - 0.5) * 80, BULLS.at[1] + (rng() - 0.5) * 80);
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.bull = { aim: l.aim, power: l.power, x: l.x, y: l.y, d: l.d, zone: l.zone, pts: l.pts, k: mini.n, total: { X: mini.pts.X, O: mini.pts.O } }; return;   // (k: this dart's number: the darts before it are the ones in the board as it flies)
}
// The throw as drawn (ms, from the move): someone else's flick shows first (pre: the view's bullsPre; this
// phone's own throw skips it), the dart flies (fly) and sticks, quivering (stick); the points count on as it lands.
export const BULLT = { pre: 280, fly: 460, stick: 300 };
export function bullsPlan(pre = 0) { const hit = pre + BULLT.fly; return { pre, hit, end: hit + BULLT.stick }; }
export function flashMs(f, winLen, won) {
  return BULLT.pre + BULLT.fly + BULLT.stick + (won ? 600 : 0);   // (the phone that threw skips the pre: ui/fx.js animMs)
}
// Super Chaos: both darts are thrown at the same board; both stay in it.
export function scMerge(m, c) {
  if (c.played.length < 2) return;
  const base = c.base && Array.isArray(c.base.darts) ? c.base.darts.map(d => d.slice()) : [];
  for (const p of c.played) { const l = c.forks[p].last; if (l && l.by === p) base.push([p, l.x, l.y]); }
  while (base.length > BULLS.keep) base.shift();
  m.darts = base; m.n = ((c.base && c.base.n) || 0) + c.played.length;
}

// ---- The scene on the screen, and the flick (pure geometry the view and its tests share) ----
// The wall is seen face on, so the scene is drawn at one scale: a wall point (x, y) is at X = ox + x * k,
// Y = oy + y * k (k: pixels a unit, the scene fitted whole in the canvas).
export function bullsGeom(W, H) { const k = Math.min(W / BULLS.w, H / BULLS.h); return { W, H, k, ox: (W - BULLS.w * k) / 2, oy: (H - BULLS.h * k) * 0.7 }; }   // (on a tall canvas the spare height goes mostly to the wall: the hand stays near the bottom)
// The flick, exactly and predictably (the view reads the swipe, this maps it; the same on every phone):
//   direction: the swipe's angle on the screen (dx right, dy up, in pixels, from first touch to release) is the
//     throw's angle from the hand, so the dart is thrown along the line the finger drew, at whatever on the
//     wall that line passes through. angleGain (TUNE) scales dx first.
//   distance: the finger's speed v (CSS px/ms over the last ~80 ms of the swipe, not its length: a short quick
//     flick is a hard throw, a long slow push a soft one; not scaled by the screen) maps straight onto power:
//     power = (v - flickMin) / (flickMax - flickMin), clamped to 0..1 (flickMin drops the dart at the thrower's
//     feet; flickMax sends it over the wall's top; the bullseye a little under half way, the board from about a
//     sixth to two thirds of the way).
// Returns { aim, power } (the move), or null for a swipe that is not a throw (too short, or sideways).
export function bullsFlick(dx, dy, v, t) {
  if (!(dy >= 14) || Math.abs(dx) > dy * 1.8) return null;
  const gain = t && t.angleGain != null ? t.angleGain : 1, lo = t && t.flickMin != null ? t.flickMin : 0.4, hi = t && t.flickMax != null ? t.flickMax : 1.7;
  const power = Math.max(0, Math.min(1, (v - lo) / Math.max(0.05, hi - lo)));
  const th = Math.max(-BULLS.angle, Math.min(BULLS.angle, Math.atan2(dx * gain, dy)));
  return { aim: r3(th / BULLS.angle), power: r3(power) };
}
