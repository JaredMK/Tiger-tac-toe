// Claw Machine: the rules (pure: no page, no clock; the server runs the same code).
import { needRng } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';

// ---------- Claw Machine (November 2026; one shared machine from v 2) ----------
// One glass case for both players (`mini.case`: a row of prizes on its floor, dealt per square: `prizes` of them, each
// a kind with its own width and weight, at random places; public), a chute at the left. A grabbed prize is gone for
// both. The claw's carriage sweeps back and forth along the rail by itself (a triangle wave at `speed` case units a
// second over the floor's span, starting each turn at a fresh place, `mini.ph`, drawn as the move before is made), and
// the claw hangs from it as a damped pendulum (`swing`, `damp`): it lags behind its carriage as it goes and swings past
// it where the carriage turns, so lining it up takes judgement (clawPath: a fixed-step integration, the same on every
// phone and the server). A move is one tap, Drop: the moment of it, `{ k }`, steps of 1/CLAW.hz s since the sweep
// began, and the claw drops where the pendulum had it then (clawX). Like Bullseye's stop, the server cannot time a tap
// to better than a connection's slack, so it takes the phone's moment as said (the cheating risk accepted, as there).
// The prize under the claw (the one it is best centred on) is gripped with a chance falling from `gripMax` dead centre
// to `gripEdge` at its edge (none beyond); a gripped prize is carried to the chute and may slip on the way (`slip`,
// more for a poor grip, `slipPoor`, and for a heavy prize), falling back into the case where it slipped. A prize that
// reaches the chute is won and leaves the case; an empty case is filled again. All drawn with the move's rng (the
// server online). First to `goal` (3) prizes wins. With "Go again on success" on, a prize won keeps the turn.
// A square dealt before (v 1: a case for each player, a move `{ x }`) takes the mover's case as the shared one and the
// sweep from its next move on (clawUp).
export const CLAW = { W: 100, rest: 8, lo: 18, hi: 97, gap: 1, chute: 15, hz: 120, sweepLo: 12, sweepHi: 97, kMax: 120 * 75 };   // the case's width; the claw's rest (over the chute); the floor's span for prizes; the sweep's span; the steps a second; the longest wait a move may name
// The kinds: half width (case units) and weight (a slip's multiplier). Original drawings in view.js.
export const CLAW_KINDS = { ball: { w: 5, wt: 0.8 }, blob: { w: 6.5, wt: 1 }, star: { w: 6, wt: 1.1 }, box: { w: 7, wt: 1.3 } };
const KINDS = Object.keys(CLAW_KINDS);
export const CLAW_COLS = 6;                                       // colours to deal from (the view's palette)
export const CLAW_DEF = { goal: 3, prizes: 6, speed: 34, swing: 55, damp: 22, gripMax: 75, gripEdge: 15, slip: 20, slipPoor: 34, aiMs: 70, aiMsHard: 40, aiMsEasy: 140 };
export const clawCfg = mini => Object.assign({}, CLAW_DEF, tune(mini));
const r1 = v => Math.round(v * 10) / 10;
// A case of n prizes: kinds at random, packed left to right on the floor with the free room shared out at random.
export function clawDeal(rng, n, idStart) {
  let ks = Array.from({ length: n }, () => KINDS[Math.floor(rng() * KINDS.length)]);
  const room = () => CLAW.hi - CLAW.lo - ks.reduce((s, k) => s + 2 * CLAW_KINDS[k].w, 0) - CLAW.gap * (ks.length - 1);
  while (room() < 0 && ks.some(k => k !== 'ball')) { let wi = 0; ks.forEach((k, i) => { if (CLAW_KINDS[k].w > CLAW_KINDS[ks[wi]].w) wi = i; }); ks[wi] = 'ball'; }   // (too wide for the floor: the widest made a ball, until they fit)
  while (ks.length > 1 && room() < 0) ks.pop();                  // (more than fit even so: the case holds what it can)
  const free = room(), cuts = Array.from({ length: ks.length + 1 }, () => rng() + 0.05), tot = cuts.reduce((a, b) => a + b, 0);
  let x = CLAW.lo;
  return ks.map((k, i) => {
    x += free * cuts[i] / tot;
    const w = CLAW_KINDS[k].w, p = { id: (idStart || 0) + i, k, c: Math.floor(rng() * CLAW_COLS), x: r1(x + w), w };
    x += 2 * w + CLAW.gap;
    return p;
  });
}
// ---- the sweep ----
// The carriage at time t (s) from the sweep's start, its phase ph (0..1 of a full there-and-back): a triangle wave.
export function clawCarriage(ph, speed, t) {
  const span = CLAW.sweepHi - CLAW.sweepLo, s = (((ph * 2 * span + speed * t) % (2 * span)) + 2 * span) % (2 * span);
  return CLAW.sweepLo + (s <= span ? s : 2 * span - s);
}
// The claw's x at every step (1/hz s) of a turn's sweep: a damped pendulum under the carriage (it starts hanging still
// under it), semi-implicit Euler at a fixed step (the same numbers on every phone and the server). Kept per sweep.
const PATHS = new Map();
export function clawPath(c, ph, k) {
  const key = `${ph}|${c.speed}|${c.swing}|${c.damp}`;
  let P = PATHS.get(key);
  if (!P) {
    if (PATHS.size > 24) PATHS.clear();
    P = { xs: [clawCarriage(ph, c.speed, 0)], y: clawCarriage(ph, c.speed, 0), w: 0 };
    PATHS.set(key, P);
  }
  const K = Math.max(1, c.swing), C = 2 * (Math.max(0, c.damp) / 100) * Math.sqrt(K), dt = 1 / CLAW.hz;
  while (P.xs.length <= k) {
    const n = P.xs.length, xc = clawCarriage(ph, c.speed, n * dt);
    P.w += (K * (xc - P.y) - C * P.w) * dt; P.y += P.w * dt;
    P.xs.push(P.y);
  }
  return P.xs;
}
// Where the claw is at step k of this turn's sweep (case units, a tenth), and its carriage.
export const clawX = (mini, k) => { const c = clawCfg(mini); return r1(Math.max(0, Math.min(CLAW.W, clawPath(c, mini.ph || 0, k)[k]))); };
export const clawCarriageAt = (mini, k) => clawCarriage(mini.ph || 0, clawCfg(mini).speed, k / CLAW.hz);
// The prize the claw comes down on at x: of those it is over, the one it is best centred on (by its share of the width).
export function clawTarget(cs, x) {
  let best = null, bu = Infinity;
  cs.forEach((p, i) => { const u = Math.abs(x - p.x) / p.w; if (u <= 1 && u < bu) { bu = u; best = i; } });
  return best == null ? null : { i: best, u: bu };
}
// The chances at an offset u (0 centred, 1 the edge): the grip, then a slip on the way for that prize.
export const clawGrip = (c, u) => (u > 1 ? 0 : (c.gripMax - (c.gripMax - c.gripEdge) * u * u) / 100);
export const clawSlip = (c, u, k) => Math.min(0.95, ((c.slip + c.slipPoor * u * u) / 100) * (CLAW_KINDS[k] ? CLAW_KINDS[k].wt : 1));
export const clawWin = (c, u, k) => clawGrip(c, u) * (1 - clawSlip(c, u, k));
const nPrizes = c => Math.max(c.goal + 1, Math.round(c.prizes));
export function create(type, rng) {
  const r = needRng(rng), c = Object.assign({}, CLAW_DEF, tuneLive(type)), n = nPrizes(c);
  return { type, v: 2, won: { X: 0, O: 0 }, got: { X: [], O: [] }, case: clawDeal(r, n, 0), next: n, ph: Math.round(r() * 1000) / 1000, g: 0, last: null };
}
// A square from before (v 1, a case each): the shared case from the mover's own, the sweep from here on.
export function clawUp(mini, p, r) {
  if (mini.v >= 2) return;
  const own = mini.case && !Array.isArray(mini.case) ? (mini.case[p] || []) : [];
  mini.case = own.slice(); mini.v = 2; mini.g = mini.g || 0;
  if (mini.ph == null) mini.ph = Math.round(r() * 1000) / 1000;
}
export const clawCase = mini => (Array.isArray(mini.case) ? mini.case : (mini.case && mini.case.X) || []);
export function apply(mini, p, m, rng, idx) {
  const r = needRng(rng);
  if (!m || typeof m !== 'object' || !Number.isInteger(m.k) || m.k < 0 || m.k > CLAW.kMax) return { ok: false, reason: 'bad' };
  clawUp(mini, p, r);
  const c = clawCfg(mini);
  if (!mini.case.length) { mini.case = clawDeal(r, nPrizes(c), mini.next || 0); mini.next = (mini.next || 0) + mini.case.length; }
  const ph = mini.ph || 0, x = clawX(mini, m.k), cs = mini.case, tg = clawTarget(cs, x), a = r(), b = r(), t = 0.15 + 0.6 * r();
  let res = 'miss', pz = null, sx = null;
  if (tg && a < clawGrip(c, tg.u)) {
    pz = Object.assign({}, cs[tg.i]);
    if (b < clawSlip(c, tg.u, pz.k)) {                               // it slips on the way: back into the case where the claw was then
      res = 'slip';
      sx = r1(Math.max(CLAW.lo + pz.w, Math.min(CLAW.hi - pz.w, x + (CLAW.rest - x) * t)));
      cs[tg.i].x = sx;
    } else { res = 'win'; cs.splice(tg.i, 1); mini.won[p] += 1; mini.got[p].push({ k: pz.k, c: pz.c }); }
  } else if (tg) pz = Object.assign({}, cs[tg.i]);                  // (the claw closed on it and lost it at once)
  mini.g = (mini.g || 0) + 1;
  mini.ph = Math.round(r() * 1000) / 1000;                          // the next turn's sweep starts somewhere new
  mini.last = { by: p, k: m.k, ph, x, res, pz, sx, t: Math.round(t * 100) / 100, won: { X: mini.won.X, O: mini.won.O } };
  if (mini.won[p] >= c.goal) return { ok: true, outcome: 'win', note: 'won' };
  if (res === 'win' && goAgain(mini)) return { ok: true, outcome: 'continue', note: 'won', again: true };
  return { ok: true, outcome: 'continue', note: res };
}
export function publicView(mini) { return JSON.parse(JSON.stringify({ type: 'claw', v: mini.v, won: mini.won, got: mini.got, case: mini.case, next: mini.next, ph: mini.ph, g: mini.g, last: mini.last })); }
export function randomMove(mini, p, rng, from, empties) { return { k: Math.floor(needRng(rng)() * CLAW.hz * 6) }; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.claw = JSON.parse(JSON.stringify(mini.last)); }
// The move's moments (ms from the move): someone else's grab first shows the sweep's last stretch up to the tap (`pre`:
// the claw arriving exactly where it was dropped; none for this phone's own grab, already there), then the claw comes
// down, closes, rises, carries to the chute (a slip part way) and lets go. A prize won rattles down the chute into the
// door under it (`tray`: the result's word), then hops onto its winner's shelf (`score`: the pip fills); a slipped one
// falls back (`land`) and bounces; a miss rides back to the chute during its hold.
export const CLAWT = { pre: 1500, down: 560, close: 260, up: 520, carryBase: 180, carryPer: 8, open: 240, fall: 420, chute: 400, shelf: 520, hold: 520 };
export const clawPre = (f, own) => (own || f.k == null ? 0 : Math.min(CLAWT.pre, Math.round(f.k * 1000 / CLAW.hz)));
export function clawTimes(f, own) {
  const T = CLAWT, pre = clawPre(f, own);
  const down = pre, closed = down + T.down, up = closed + T.close, top = up + T.up;
  const carry = T.carryBase + T.carryPer * Math.abs(f.x - CLAW.rest), slipAt = top + carry * (f.t || 0.4);
  const atChute = top + carry, tray = atChute + T.open + T.chute, score = tray + T.shelf, land = slipAt + T.fall;
  const end = f.res === 'win' ? score + T.hold : f.res === 'slip' ? land + T.hold : top + T.hold;
  const say = f.res === 'win' ? tray : f.res === 'slip' ? slipAt + T.fall * 0.6 : top;
  return { pre, slide: pre, down, closed, up, top, carry, slipAt, atChute, tray, score, land, say, end };
}
export function flashMs(f, winLen, won) { return f.claw ? clawTimes(f.claw, false).end + (won ? 600 : 0) : 600; }
