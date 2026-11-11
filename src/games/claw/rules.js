// Claw Machine: the rules (pure: no page, no clock; the server runs the same code).
import { needRng } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';

// ---------- Claw Machine (November 2026) ----------
// Each player has a glass case of their own, a row of prizes on its floor (dealt per square: `prizes` of them, each a
// kind with its own width and weight, at random places; public), and a chute at the left. A move is one grab: the
// claw is aimed across the case (x, 0 to 100) and dropped there. The prize under the claw (the one it is best centred
// on) is gripped with a chance falling from `gripMax` dead centre to `gripEdge` at its edge (none beyond); a gripped
// prize is carried to the chute and may slip on the way (`slip`, more for a poor grip, `slipPoor`, and for a heavy
// prize), falling back into the case where it slipped (it lands where the claw was then, kept inside the case). A
// prize that reaches the chute is won and leaves the case. All of it drawn with the move's rng (the server online).
// First to `goal` (3) prizes wins. With "Go again on success" on, a prize won keeps the turn.
export const CLAW = { W: 100, rest: 8, lo: 18, hi: 97, gap: 1, chute: 15 };   // the case's width; the claw's rest (over the chute); the floor's span for prizes
// The kinds: half width (case units) and weight (a slip's multiplier). Original drawings in view.js.
export const CLAW_KINDS = { ball: { w: 5, wt: 0.8 }, blob: { w: 6.5, wt: 1 }, star: { w: 6, wt: 1.1 }, box: { w: 7, wt: 1.3 } };
const KINDS = Object.keys(CLAW_KINDS);
export const CLAW_COLS = 6;                                       // colours to deal from (the view's palette)
export const CLAW_DEF = { goal: 3, prizes: 6, gripMax: 85, gripEdge: 15, slip: 20, slipPoor: 34, aiAim: 4, aiAimHard: 2.4, aiAimEasy: 8 };
export const clawCfg = mini => Object.assign({}, CLAW_DEF, tune(mini));
const r1 = v => Math.round(v * 10) / 10;
// The aim: a drag moves the claw by the finger's travel (px), at the case's scale on the screen (px per case unit).
export const clawAim = (x0, dx, pxPerUnit) => r1(Math.max(0, Math.min(CLAW.W, x0 + dx / Math.max(0.1, pxPerUnit))));
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
export function create(type, rng) {
  const r = needRng(rng), c = Object.assign({}, CLAW_DEF, tuneLive(type));
  const n = Math.max(c.goal + 1, Math.round(c.prizes));
  return { type, won: { X: 0, O: 0 }, got: { X: [], O: [] }, case: { X: clawDeal(r, n, 0), O: clawDeal(r, n, 0) }, next: n, last: null };
}
export function apply(mini, p, m, rng, idx) {
  if (!m || typeof m !== 'object' || !Number.isFinite(m.x)) return { ok: false, reason: 'bad' };
  const r = needRng(rng), c = clawCfg(mini), x = r1(Math.max(0, Math.min(CLAW.W, m.x)));
  if (!mini.case[p].length) { mini.case[p] = clawDeal(r, Math.max(c.goal + 1, Math.round(c.prizes)), mini.next || 0); mini.next = (mini.next || 0) + mini.case[p].length; }
  const cs = mini.case[p], tg = clawTarget(cs, x), a = r(), b = r(), t = 0.15 + 0.6 * r();
  let res = 'miss', pz = null, sx = null;
  if (tg && a < clawGrip(c, tg.u)) {
    pz = Object.assign({}, cs[tg.i]);
    if (b < clawSlip(c, tg.u, pz.k)) {                               // it slips on the way: back into the case where the claw was then
      res = 'slip';
      sx = r1(Math.max(CLAW.lo + pz.w, Math.min(CLAW.hi - pz.w, x + (CLAW.rest - x) * t)));
      cs[tg.i].x = sx;
    } else { res = 'win'; cs.splice(tg.i, 1); mini.won[p] += 1; mini.got[p].push({ k: pz.k, c: pz.c }); }
  } else if (tg) pz = Object.assign({}, cs[tg.i]);                  // (the claw closed on it and lost it at once)
  mini.last = { by: p, x, res, pz, sx, t: Math.round(t * 100) / 100, won: { X: mini.won.X, O: mini.won.O } };
  if (mini.won[p] >= c.goal) return { ok: true, outcome: 'win', note: 'won' };
  if (res === 'win' && goAgain(mini)) return { ok: true, outcome: 'continue', note: 'won', again: true };
  return { ok: true, outcome: 'continue', note: res };
}
export function publicView(mini) { return JSON.parse(JSON.stringify({ type: 'claw', won: mini.won, got: mini.got, case: mini.case, next: mini.next, last: mini.last })); }
export function randomMove(mini, p, rng, from, empties) { return { x: r1(CLAW.lo + needRng(rng)() * (CLAW.hi - CLAW.lo)) }; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.claw = JSON.parse(JSON.stringify(mini.last)); }
// The move's moments (ms from the move): the claw slides from where it rests (over the chute) to its spot (`from`: none
// for this phone's own grab, already there), comes down, closes, rises, carries to the chute (a slip part way), lets go.
export const CLAWT = { slideBase: 220, slidePer: 7, down: 560, close: 260, up: 520, carryBase: 180, carryPer: 8, open: 240, fall: 420, hold: 520 };
export function clawTimes(f, own) {
  const T = CLAWT, slide = own ? 0 : T.slideBase + T.slidePer * Math.abs(f.x - CLAW.rest);
  const down = slide, closed = down + T.down, up = closed + T.close, top = up + T.up;
  const carry = T.carryBase + T.carryPer * Math.abs(f.x - CLAW.rest), slipAt = top + carry * (f.t || 0.4);
  const atChute = top + carry, end = f.res === 'win' ? atChute + T.open + T.hold : f.res === 'slip' ? slipAt + T.fall + T.hold : top + T.hold;
  const say = f.res === 'win' ? atChute + T.open : f.res === 'slip' ? slipAt + T.fall * 0.6 : top;
  return { slide, down, closed, up, top, carry, slipAt, atChute, say, end };
}
export function flashMs(f, winLen, won) { return f.claw ? clawTimes(f.claw, false).end + (won ? 600 : 0) : 600; }
