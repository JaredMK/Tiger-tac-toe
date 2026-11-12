// Bullseye: the rules (pure: no page, no clock; the server runs the same code).
import { needRng } from '../../core/random.js';
import { r3 } from '../../core/util.js';
import { BULL_DEFAULTS } from './meta.js';
import { tune } from '../../core/tune.js';

// ---------- the arcade games: Bullseye, Echo, Peg Drop, Cup Pong, Trivia, Odd One Out ----------
// Bullseye (a dartboard on a wall, `v: 3`, CLIENT_VERSION 1.14.0; the throw is aimed in two taps): the board hangs
// on a wall, the same for both players, and stays where it is. The scene is 100 units across: the wall from y 0
// (its top) down to BULLS.wall, the floor below it, the board's middle at BULLS.at, the thrower's hand at
// BULLS.hand. A throw is aimed in two steps: a vertical line sweeps left and right across the wall (a tap stops
// it), then a horizontal line sweeps up and down (a tap stops it); the dart lands where they cross, exactly
// there (no scatter: the skill is the two taps). The move is { x, y }: where the lines stopped, as fractions of the
// wall's width and height. The board has three rings (config/bulls, the admin's dashboard, copied into each square as it is dealt:
// board, mid and bull, their radii, and the lines' speed): the bullseye scores bullPts (3), the inner ring 2, the
// outer ring 1, off the board 0; first to goal (7) takes the square (at 3 a dart at most, never in two throws).
// The lines cross the wall in cfg.sweep ms at the start (the same speed either way), and a player's own lines get
// cfg.ramp times faster with every throw of theirs that scores (mini.speed). Every dart stays where it landed
// (darts: [player, x, y], the last BULLS.keep of them; n: how many have been thrown in all).
// A square dealt as the flick (v 2: { aim, power }) or before that (the small board that moved about a field, no v)
// carries its points over and plays on by these rules (bullUp, from core/minis.js upgradeMini and from apply).
export const BULLS = { goal: 7, w: 100, h: 114, wall: 84, at: [50, 38], hand: [50, 91], bullPts: 3, midPts: 2, boardPts: 1, keep: 10, ai: { mid: 0.45, worse: 0.4 } };   // (the board fills the wall: 64 of its 100 across by default; ai.mid: of the computer's hits outside the bullseye, the share that is the inner ring; ai.worse: how much its hits slip as its lines speed up)
export const BULL_LIMITS = { board: [16, 35], mid: [5, 28], bull: [1, 14], sweep: [400, 5000], ramp: [1, 2] };
export const BULL_CFG = { cfg: null };
export function bullsNorm(raw) {
  const out = {}, rings = raw && raw.mid != null;     // (a config without the inner ring is from the small moving board: its radii are not this board's)
  for (const k of Object.keys(BULL_DEFAULTS)) {
    const v = raw && raw[k] != null && (rings || k === 'sweep' || k === 'ramp') ? Number(raw[k]) : NaN, [lo, hi] = BULL_LIMITS[k];
    out[k] = Number.isFinite(v) && v >= lo && v <= hi ? r3(v) : BULL_DEFAULTS[k];
  }
  if (out.mid >= out.board) out.mid = r3(out.board * 0.55);        // each ring inside the one round it
  if (out.bull >= out.mid) out.bull = r3(out.mid * 0.35);
  return out;
}
export function setBullsConfig(raw) { BULL_CFG.cfg = raw && typeof raw === 'object' ? bullsNorm(raw) : null; }
export const bullsConfig = () => Object.assign({}, BULL_CFG.cfg || BULL_DEFAULTS);
const r2 = v => Math.round(v * 100) / 100 + 0;                          // (+ 0: never a -0, which is not plain JSON)
const unitOf = v => r3(Math.max(0, Math.min(1, v)));
export const bullsPeriod = (cfg, speed) => cfg.sweep / speed;            // ms for the vertical line to cross the wall (the horizontal one: as fast, so wall/w as long)
export const bullsPeriodY = per => Math.round(per * BULLS.wall / BULLS.w);
// Where the two lines cross: the wall point of a move (fractions of the wall's width and height).
export function bullsPoint(x, y) { return [r3(x * BULLS.w), r3(y * BULLS.wall)]; }
// The move that stops the lines at a wall point (the computer's aim, the tests'), each part kept to the wall.
export function bullsAimAt(x, y) { return { x: unitOf(x / BULLS.w), y: unitOf(y / BULLS.wall) }; }
// What a dart scores where it landed: how far from the board's middle, its ring and the points.
export function bullsScore(cfg, x, y, bullPts) {
  const d = r2(Math.hypot(x - BULLS.at[0], y - BULLS.at[1]));
  const zone = d <= cfg.bull ? 'bull' : d <= cfg.mid ? 'mid' : d <= cfg.board ? 'board' : 'miss';
  return { d, zone, pts: zone === 'bull' ? bullPts || BULLS.bullPts : zone === 'mid' ? BULLS.midPts : zone === 'board' ? BULLS.boardPts : 0 };
}
export const bullIs = pts => pts > BULLS.midPts;                        // a bullseye (whatever it scores)
// A square from before (the flick, v 2, or the small moving board, no v): its points stay, the rest becomes this.
export function bullUp(mini) {
  if (!mini || mini.type !== 'bullseye' || mini.v === 3) return mini;
  const flick = mini.v === 2, old = mini.cfg || {}, keep = {};
  for (const k of flick && old.mid != null ? ['board', 'mid', 'bull', 'sweep', 'ramp'] : ['sweep', 'ramp']) if (old[k] != null) keep[k] = old[k];
  mini.cfg = bullsNorm(Object.assign({}, bullsConfig(), keep));
  mini.v = 3;
  if (!mini.pts) mini.pts = { X: 0, O: 0 };
  if (!mini.speed) mini.speed = { X: 1, O: 1 };
  if (!flick || !Array.isArray(mini.darts)) { mini.darts = []; mini.n = 0; }
  mini.last = null; delete mini.pos;
  return mini;
}
export function create(type, rng) {
  return { type, v: 3, cfg: bullsConfig(), pts: { X: 0, O: 0 }, speed: { X: 1, O: 1 }, darts: [], n: 0, last: null };
}
export function apply(mini, p, m, rng, idx) {   // where the two lines stopped: the dart lands at their crossing and scores by its ring
  bullUp(mini);
  let x, y;
  if (m === 'auto') { rng = needRng(rng); x = unitOf(rng()); y = unitOf(rng()); }
  else {
    x = m && typeof m === 'object' ? Number(m.x) : NaN; y = m && typeof m === 'object' ? Number(m.y) : NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return { ok: false, reason: 'bad' };
    x = r3(x); y = r3(y);
  }
  const t = tune(mini), [px, py] = bullsPoint(x, y), sc = bullsScore(mini.cfg, px, py, t.bullPts), per = Math.round(bullsPeriod(mini.cfg, mini.speed[p] || 1));   // per: the sweep these lines ran at
  mini.pts[p] += sc.pts;
  if (sc.pts) mini.speed[p] = r3((mini.speed[p] || 1) * mini.cfg.ramp);
  mini.darts.push([p, px, py]); while (mini.darts.length > BULLS.keep) mini.darts.shift();
  mini.n = (mini.n || 0) + 1;
  mini.last = { by: p, fx: x, fy: y, x: px, y: py, d: sc.d, zone: sc.zone, pts: sc.pts, per };
  const note = sc.zone === 'bull' ? 'bull' : sc.pts ? 'board' : 'miss';
  if (mini.pts[p] >= t.goal) return { ok: true, outcome: 'win', note: note === 'miss' ? 'board' : note };
  return { ok: true, outcome: 'continue', note };
}
export function publicView(mini) {
  if (mini.v !== 3) return { type: 'bullseye', v: 3, cfg: bullsConfig(), pts: { X: (mini.pts && mini.pts.X) || 0, O: (mini.pts && mini.pts.O) || 0 }, speed: { X: 1, O: 1 }, darts: [], n: 0 };   // (a square from before, not yet thrown at)
  return { type: 'bullseye', v: 3, cfg: Object.assign({}, mini.cfg), pts: { X: mini.pts.X, O: mini.pts.O }, speed: { X: mini.speed.X, O: mini.speed.O }, darts: mini.darts.map(d => d.slice()), n: mini.n };
}
// A random throw: both lines stopped at random points on the wall, roughly at the board (the tests' and the
// sandbox's stand-in for two taps; a phone never sends 'auto', core/verify.js, so this is a real move everywhere).
export function randomMove(mini, p, rng, from, empties) {
  return bullsAimAt(BULLS.at[0] + (rng() - 0.5) * 80, BULLS.at[1] + (rng() - 0.5) * 80);
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.bull = { fx: l.fx, fy: l.fy, x: l.x, y: l.y, d: l.d, zone: l.zone, pts: l.pts, k: mini.n, per: l.per || Math.round(bullsPeriod(mini.cfg || bullsConfig(), (mini.speed && mini.speed[p]) || 1)), total: { X: mini.pts.X, O: mini.pts.O } }; return;   // (k: this dart's number: the darts before it are the ones in the board as it flies)
}
// The throw as drawn (ms, from the move): someone else's two taps show first (the lines sweep from their edges and
// stop where they stopped: bullsAim), then the dart flies (fly) and sticks, quivering (stick); the points count on as it lands.
export const BULLT = { fly: 460, stick: 300, gap: 280 };
// Someone else's throw, as their screen looked: the sideways line sweeps from the left edge straight to where
// they stopped it and stays there (never past it and back: the marker stops exactly where it was tapped), a beat,
// then the up-down line likewise from the top, a beat, then the dart. ms from the move: t1 and t2 where each
// stops, fly where the dart leaves.
export function bullsLeg(per, f) { const it = r3(Math.max(0.05, Math.min(1, f))); return { it, ms: Math.round(per * it) }; }
export function bullsAim(b) {
  const per = b.per || BULL_DEFAULTS.sweep, perY = bullsPeriodY(per), vx = bullsLeg(per, b.fx), vy = bullsLeg(perY, b.fy);
  const t1 = vx.ms, h0 = t1 + BULLT.gap, t2 = h0 + vy.ms;
  return { per, perY, vx, vy, t1, h0, t2, fly: t2 + BULLT.gap };
}
export function bullsPlan(pre = 0) { const hit = pre + BULLT.fly; return { pre, hit, end: hit + BULLT.stick }; }
export function flashMs(f, winLen, won) {
  return (f.bull ? bullsAim(f.bull).fly : 0) + BULLT.fly + BULLT.stick + (won ? 600 : 0);   // (the phone that threw skips the aim: it has just watched its own lines: ui/fx.js animMs)
}
// Where a sweeping line is: 0 to 1 across, back and forth once per period `per` (ms since it began).
export function bullsWave(ms, per) { const t = Math.max(0, ms) / Math.max(1, per), k = Math.floor(t), f = t - k; return k % 2 ? 1 - f : f; }
// Super Chaos: both darts are thrown at the same board; both stay in it.
export function scMerge(m, c) {
  if (c.played.length < 2) return;
  const base = c.base && Array.isArray(c.base.darts) ? c.base.darts.map(d => d.slice()) : [];
  for (const p of c.played) { const l = c.forks[p].last; if (l && l.by === p) base.push([p, l.x, l.y]); }
  while (base.length > BULLS.keep) base.shift();
  m.darts = base; m.n = ((c.base && c.base.n) || 0) + c.played.length;
}

// ---- The scene on the screen (pure geometry the view and its tests share) ----
// The wall is seen face on, so the scene is drawn at one scale: a wall point (x, y) is at X = ox + x * k,
// Y = oy + y * k (k: pixels a unit, the scene fitted whole in the canvas).
export function bullsGeom(W, H) { const k = Math.min(W / BULLS.w, H / BULLS.h); return { W, H, k, ox: (W - BULLS.w * k) / 2, oy: (H - BULLS.h * k) * 0.7 }; }   // (on a tall canvas the spare height goes mostly to the wall: the hand stays near the bottom)
