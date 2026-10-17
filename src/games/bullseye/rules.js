// Bullseye: the rules (pure: no page, no clock; the server runs the same code).
import { needRng } from '../../core/random.js';
import { r3 } from '../../core/util.js';
import { BULL_DEFAULTS } from './meta.js';

// ---------- the arcade games: Bullseye, Echo, Plinko, Cup Pong, Trivia, Odd One Out ----------
// Bullseye: a small dartboard (with a bullseye in its middle) sits somewhere on a field 100 units across
// and 120 down, and moves to a new random spot after every throw. A throw is aimed in two steps: a
// vertical line sweeps left and right (a tap stops it), then a horizontal line sweeps up and down (a
// tap stops it); the dart lands where they cross. The bullseye scores 3, the rest of the board 1, off the
// board 0; first to 5 points. The lines cross the field in cfg.sweep ms at the start (the same speed in
// both directions), and a player's own lines get cfg.ramp times faster with every throw of theirs that
// scores. The board's size, the bullseye's and the two speeds come from config/bulls (the admin's
// dashboard), copied into each square as it is dealt. A move is { x, y }: where the lines stopped, as
// fractions of the field's width and height; the score is worked out where the move is made (the
// server online), as is the board's next spot.
export const BULLS = { goal: 5, w: 100, h: 120, bullPts: 3, boardPts: 1, edge: 4, minMove: 24, ai: { bull: 0.15, board: 0.45, worse: 0.4 } };
export const BULL_LIMITS = { board: [4, 30], bull: [0.5, 12], sweep: [400, 5000], ramp: [1, 2] };
export const BULL_CFG = { cfg: null };
export function bullsNorm(raw) {
  const out = {};
  for (const k of Object.keys(BULL_DEFAULTS)) {
    const v = raw && raw[k] != null ? Number(raw[k]) : NaN, [lo, hi] = BULL_LIMITS[k];
    out[k] = Number.isFinite(v) && v >= lo && v <= hi ? r3(v) : BULL_DEFAULTS[k];
  }
  if (out.bull >= out.board) out.bull = r3(out.board * 0.3);       // the bullseye always smaller than the board
  return out;
}
export function setBullsConfig(raw) { BULL_CFG.cfg = raw && typeof raw === 'object' ? bullsNorm(raw) : null; }
export const bullsConfig = () => Object.assign({}, BULL_CFG.cfg || BULL_DEFAULTS);
// The board's next spot: anywhere it fits whole on the field, a fair way from where it was.
export function bullsSpot(cfg, prev, rng) {
  const R = cfg.board + BULLS.edge, w = BULLS.w - 2 * R, h = BULLS.h - 2 * R;
  let best = null;
  for (let k = 0; k < 40; k++) {
    const pt = [r3(R + rng() * w), r3(R + rng() * h)];
    const d = prev ? Math.hypot(pt[0] - prev[0], pt[1] - prev[1]) : Infinity;
    if (d >= Math.min(BULLS.minMove, Math.hypot(w, h) * 0.4)) return pt;
    if (!best || d > best.d) best = { pt, d };
  }
  return best.pt;
}
// What a throw scores: where it landed (field units), how far from the board's middle, and the points.
export function bullsScore(cfg, pos, x, y) {
  const at = [r3(x * BULLS.w), r3(y * BULLS.h)], d = r3(Math.hypot(at[0] - pos[0], at[1] - pos[1]));
  return { at, d, pts: d <= cfg.bull ? BULLS.bullPts : d <= cfg.board ? BULLS.boardPts : 0 };
}
export const bullsPeriod = (cfg, speed) => cfg.sweep / speed;            // ms for the vertical line to cross the field (the horizontal one: as fast, so h/w as long)
// The computer: a bullseye, the board or a miss at its rates, slipping as its lines speed up.
export function bullsRates(speed) { const f = Math.pow(1 / Math.max(1, speed), BULLS.ai.worse); return { bull: BULLS.ai.bull * f, board: BULLS.ai.board * f }; }
export function create(type, rng) {
  const cfg = bullsConfig(); return { type, cfg, pts: { X: 0, O: 0 }, speed: { X: 1, O: 1 }, pos: bullsSpot(cfg, null, needRng(rng)), last: null };
}
export function apply(mini, p, m, rng, idx) {   // where the two lines stopped: scored against the board where it is; then the board moves on
  const x = m && typeof m === 'object' ? Number(m.x) : NaN, y = m && typeof m === 'object' ? Number(m.y) : NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return { ok: false, reason: 'bad' };
  const cfg = mini.cfg, pos = mini.pos, sc = bullsScore(cfg, pos, x, y), per = Math.round(bullsPeriod(cfg, mini.speed[p] || 1));   // per: the sweep these lines ran at
  mini.pts[p] += sc.pts;
  if (sc.pts) mini.speed[p] = r3(mini.speed[p] * cfg.ramp);
  mini.last = { by: p, x: r3(x), y: r3(y), at: sc.at, d: sc.d, pts: sc.pts, pos: pos.slice(), per };
  mini.pos = bullsSpot(cfg, pos, needRng(rng));
  if (mini.pts[p] >= BULLS.goal) return { ok: true, outcome: 'win', note: sc.pts === BULLS.bullPts ? 'bull' : 'board' };
  return { ok: true, outcome: 'continue', note: sc.pts === BULLS.bullPts ? 'bull' : sc.pts ? 'board' : 'miss' };
}
export function publicView(mini) {
  return { type: 'bullseye', cfg: Object.assign({}, mini.cfg), pts: { X: mini.pts.X, O: mini.pts.O }, speed: { X: mini.speed.X, O: mini.speed.O }, pos: mini.pos.slice() };
}
export function randomMove(mini, p, rng, from, empties) {
  return { x: r3(rng()), y: r3(rng()) };          // both lines stopped at random points
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.bull = { x: l.x, y: l.y, at: l.at.slice(), d: l.d, pts: l.pts, pos: l.pos.slice(), next: mini.pos.slice(), total: { X: mini.pts.X, O: mini.pts.O }, speed: mini.speed[p], per: l.per || Math.round(bullsPeriod(mini.cfg || BULL_DEFAULTS, 1)) }; return;
}
export function flashMs(f, winLen, won) {
  return (f.bull ? bullsAim(f.bull).fly : 0) + BULLT.fly + BULLT.hold + (won ? 600 : 0);   // (the phone that threw skips the aim: it has just watched its own lines)
}
// Bullseye: the dart flies in and lands where the lines crossed, then the points hold a moment.
export const BULLT = { fly: 380, hold: 800, slide: 450, gap: 280 };
// Someone else's throw, as their screen looked: the sideways line sweeps from the left edge and stops where
// they stopped it (straight there when that is past 40% across, else across and back), a beat, then the
// up-down line likewise from the top, a beat, then the dart. ms from the move: t1 and t2 where each stops, fly
// where the dart leaves.
export function bullsLeg(per, f) { const it = f >= 0.4 ? f : 2 - f; return { it: r3(Math.max(0.05, it)), ms: Math.round(per * Math.max(0.05, it)) }; }
export function bullsAim(b) {
  const per = b.per || BULL_DEFAULTS.sweep, perY = Math.round(per * BULLS.h / BULLS.w), vx = bullsLeg(per, b.x), vy = bullsLeg(perY, b.y);
  const t1 = vx.ms, h0 = t1 + BULLT.gap, t2 = h0 + vy.ms;
  return { per, perY, vx, vy, t1, h0, t2, fly: t2 + BULLT.gap };
}
// Super Chaos: both throws are at the board where it stood; then it moves on.
export function scMerge(m, c) {
  m.pos = c.forks[c.played[c.played.length - 1]].pos.slice();
}
