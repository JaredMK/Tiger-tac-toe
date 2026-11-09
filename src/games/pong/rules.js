// Cup Pong: the rules (pure: no page, no clock; the server runs the same code).
import { needRng } from '../../core/random.js';
import { tune } from '../../core/tune.js';

// Cup Pong: the table is one unit long (the thrower at y 0, the far end at y 1) and one wide (x from
// -0.5 to 0.5). Each player's rack is three cups in a triangle at the far end. A throw is an aim
// (-1 to 1: the angle, in units of PONG.angle radians off straight ahead) and a power (0 to 1: the
// distance, PONG.near to PONG.far table lengths); the ball lands where the throw sends it, plus a little
// scatter either way (the server's rng online). Inside a cup (within PONG.r of its centre) it sinks;
// within the rim (r to r + rim) it bounces, and drops in rimIn % of the time; otherwise it misses.
// The throw as drawn (ms, from the move): the flight (fly); a make drops into the cup (drop) and splashes
// (splash), then the cup is lifted off (lift); a rim ball hops off the rim (hop) into the cup or onto the
// table; a ball on the table rolls to the edge and off it (rollPer ms a table length, rollMin to rollMax),
// then settle. pre: someone else's throw shows their flick first (the view's pongPre), outside flashMs.
export const PONG = { cups: [[0, 0.825], [-0.085, 0.93], [0.085, 0.93]], r: 0.055, rim: 0.03, rimIn: 0.25, spread: 0.06, angle: 0.35, near: 0.5, far: 1.1, goal: 3, fly: 820, drop: 190, hop: 380, splash: 300, lift: 400, rollPer: 1200, rollMin: 320, rollMax: 820, bounce: 170, settle: 110, pre: 280, cupH: 0.12, ballR: 0.034, hand: [0, 0.06, 0.05] };
export const pongDist = power => PONG.near + (PONG.far - PONG.near) * power;
export function pongThrow(cups, aim, power, rng, t) {   // (t: the square's settings: spread, rimIn)
  const spread = t ? t.spread : PONG.spread, rimIn = t ? t.rimIn / 100 : PONG.rimIn;
  const g = () => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };   // (Box-Muller)
  const th = aim * PONG.angle, d = pongDist(power);
  const x = Math.sin(th) * d + g() * spread, y = Math.cos(th) * d + g() * spread;
  let cup = null, best = Infinity;
  cups.forEach((up, k) => { if (!up) return; const dd = Math.hypot(x - PONG.cups[k][0], y - PONG.cups[k][1]); if (dd < best) { best = dd; cup = k; } });
  if (cup == null || best > PONG.r + PONG.rim) return { x, y, cup: null, rim: false, sunk: false };
  if (best <= PONG.r) return { x, y, cup, rim: false, sunk: true };
  return { x, y, cup, rim: true, sunk: rng() < rimIn };
}
// The throw that lands on a table point with no scatter (the computer's aim, before its own error), and on a cup's centre.
export const pongAimXY = (x, y) => ({ aim: Math.max(-1, Math.min(1, Math.atan2(x, y) / PONG.angle)), power: Math.max(0, Math.min(1, (Math.hypot(x, y) - PONG.near) / (PONG.far - PONG.near))) });
export function pongAimAt(k) { const [cx, cy] = PONG.cups[k]; return pongAimXY(cx, cy); }
export function create(type, rng) {
  return { type, cups: { X: [true, true, true], O: [true, true, true] }, last: null };
}
export function apply(mini, p, m, rng, idx) {
  let aim, power;
  if (m === 'auto') { aim = rng() * 2 - 1; power = rng(); }
  else if (m && typeof m === 'object' && Number.isFinite(m.aim) && Number.isFinite(m.power)) { aim = Math.max(-1, Math.min(1, m.aim)); power = Math.max(0, Math.min(1, m.power)); }
  else return { ok: false, reason: 'bad' };
  const t = pongThrow(mini.cups[p], aim, power, needRng(rng), tune(mini));
  if (t.sunk) mini.cups[p][t.cup] = false;
  mini.last = { by: p, aim, power, x: Math.round(t.x * 1000) / 1000 + 0, y: Math.round(t.y * 1000) / 1000 + 0, cup: t.cup, rim: t.rim, sunk: t.sunk };   // (+ 0: never a -0, which is not plain JSON)
  if (mini.cups[p].every(c => !c)) return { ok: true, outcome: 'win', note: 'sunk' };
  return { ok: true, outcome: 'continue', note: t.sunk ? 'sunk' : t.rim ? 'rim' : 'miss' };
}
export function publicView(mini) {
  return { type: 'pong', cups: { X: mini.cups.X.slice(), O: mini.cups.O.slice() } };
}
// A random throw: at a cup still standing, roughly (the tests' and the sandbox's stand-in for a flick; a phone never
// sends 'auto', core/verify.js, so this is a real move everywhere).
export function randomMove(mini, p, rng, from, empties) {
  const up = mini.cups[p].map((c, k) => (c ? k : -1)).filter(k => k >= 0), a = pongAimAt(up.length ? up[Math.floor(rng() * up.length)] : 0);
  return { aim: Math.round(Math.max(-1, Math.min(1, a.aim + (rng() - 0.5) * 0.3)) * 1000) / 1000 + 0, power: Math.round(Math.max(0, Math.min(1, a.power + (rng() - 0.5) * 0.2)) * 1000) / 1000 + 0 };
}
// Where the ball goes after it lands, worked out from the throw alone (no randomness): a rim ball touches the
// rim at angle ra (from the cup's centre, towards where it came down: atan2(dx, dy)), pops off it and comes
// down at (bx, by), clear of the cups; a ball on the table (or off it) rolls from there, or from where it
// landed, to (ox, oy), just past the table's edge. Its way clear of the cups still standing: the throw's own
// direction first, else the nearest one that is.
const r3 = v => Math.round(v * 1000) / 1000 + 0;   // (+ 0: never a -0)
const CLEAR = 0.14;                                  // (a cup's rim and the ball's size: the ball as drawn never touches a cup it rolls past)
export const TABLE = { x: 0.56, y0: -0.05, y1: 1.06 };   // the table top's edges (table units): what the ball rolls off, and what is drawn
function pongExit(px, py, dx, dy) {                  // where a ball rolling from (px, py) along (dx, dy) is wholly off the table
  const X = TABLE.x, Y0 = TABLE.y0, Y1 = TABLE.y1;
  if (px > X || px < -X || py > Y1 || py < Y0) return [px + dx * 0.08, py + dy * 0.08];
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (X - px) / dx); else if (dx < -1e-9) t = Math.min(t, (-X - px) / dx);
  if (dy > 1e-9) t = Math.min(t, (Y1 - py) / dy); else if (dy < -1e-9) t = Math.min(t, (Y0 - py) / dy);
  return [px + dx * t, py + dy * t];
}
function pongClear(up, px, py, ex, ey) {             // the roll from (px, py) to (ex, ey) passes no standing cup (one it starts beside, it rolls away from)
  return PONG.cups.every(([cx, cy], k) => {
    if (!up[k]) return true;
    const vx = ex - px, vy = ey - py, L = vx * vx + vy * vy, u = L ? Math.max(0, Math.min(1, ((cx - px) * vx + (cy - py) * vy) / L)) : 0;
    const seg = Math.hypot(px + vx * u - cx, py + vy * u - cy), here = Math.hypot(px - cx, py - cy);
    return seg >= Math.min(CLEAR, here) - 1e-9;
  });
}
const TURNS = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.75, -1.75, Math.PI];
export function pongPath(l, up) {                    // l: the throw (mini.last); up: the thrower's cups standing for it
  if (l.sunk && !l.rim) return {};
  if (l.rim) {
    const [cx, cy] = PONG.cups[l.cup], ra = Math.atan2(l.x - cx, l.y - cy);
    if (l.sunk) return { ra: r3(ra) };
    let pick = null;
    for (const o of TURNS.slice(0, 9)) for (const d of [0.2, 0.26, 0.32]) {
      if (pick) break;
      const a = ra + o, dx = Math.sin(a), dy = Math.cos(a), bx = cx + dx * d, by = cy + dy * d;
      if (PONG.cups.some(([qx, qy], k) => up[k] && Math.hypot(bx - qx, by - qy) < CLEAR)) continue;   // (it comes down on the table, not on a cup)
      const [ox, oy] = pongExit(bx, by, dx, dy);
      if (pongClear(up, bx, by, ox, oy)) pick = { bx, by, ox, oy };
    }
    if (!pick) { const dx = Math.sin(ra), dy = Math.cos(ra), bx = cx + dx * 0.26, by = cy + dy * 0.26, [ox, oy] = pongExit(bx, by, dx, dy); pick = { bx, by, ox, oy }; }
    return { ra: r3(ra), bx: r3(pick.bx), by: r3(pick.by), ox: r3(pick.ox), oy: r3(pick.oy) };
  }
  const th = l.aim * PONG.angle;
  let pick = null;
  for (const o of TURNS) {
    const dx = Math.sin(th + o), dy = Math.cos(th + o), [ox, oy] = pongExit(l.x, l.y, dx, dy);
    if (pongClear(up, l.x, l.y, ox, oy)) { pick = [ox, oy]; break; }
  }
  if (!pick) pick = pongExit(l.x, l.y, Math.sin(th), Math.cos(th));
  return { ox: r3(pick[0]), oy: r3(pick[1]) };
}
// The throw's timeline (ms from the move), from its flash: when the ball comes down (hit: in a cup, on the rim,
// on the table), when it splashes into the cup and the cup is lifted off, when it lands off the rim (bounce), how
// long it rolls, when the result's word shows (res), and when it is all over (end). pre: ms of someone else's
// flick shown first (the view's: everything after it comes that much later).
export function pongPlan(g, pre = 0) {
  const T = pre + PONG.fly;
  if (g.sunk) {
    const splash = T + (g.rim ? PONG.hop : PONG.drop), lift = splash + PONG.splash;
    return { pre, hit: T, splash, lift, res: splash, end: lift + PONG.lift };
  }
  const bounce = g.rim ? T + PONG.hop : T;
  const fx = g.rim ? g.bx : g.x, fy = g.rim ? g.by : g.y;
  const roll = g.ox == null ? 0 : Math.round(Math.max(PONG.rollMin, Math.min(PONG.rollMax, Math.hypot(g.ox - fx, g.oy - fy) * PONG.rollPer)));
  return { pre, hit: T, bounce, roll, res: bounce, end: bounce + roll };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last, up = mini.cups[l.by].slice();
  flash.pong = Object.assign({ aim: l.aim, power: l.power, x: l.x, y: l.y, cup: l.cup, rim: l.rim, sunk: l.sunk }, pongPath(l, up), { cups: { X: mini.cups.X.slice(), O: mini.cups.O.slice() } }); return;
}
export function flashMs(f, winLen, won) {
  return (f.pong ? pongPlan(f.pong).end : PONG.fly) + PONG.settle + (won ? 600 : 0);
}

// ---- The table in perspective, and the flick (pure geometry the view and its tests share) ----
// The camera stands behind the thrower, looking down the table: a point (x, y) on the table, z above it (table
// units), is drawn at X = cx + x * s(y), Y = Yh + (hC - z) * s(y), with s(y) = F / (dC + y) the pixels one table
// width takes at that depth (dC: the camera's distance behind the near edge, hC: its height, F: its focal length,
// all from the canvas: the near edge fills the width and a little more, the far edge is RATIO of it, the top is
// drawn from TOP to BOTTOM of the height). Everything shrinks with distance, so the far cups are smaller than
// the ball in the hand, and a ball on its arc rises on the screen and shrinks as it goes.
const RATIO = 0.6, NEARW = 1.1, TOP = 0.36, BOTTOM = 0.97, TALL = 1.3;   // (TALL: a canvas taller than this many widths keeps this shape, centred: the view never goes top-down on a tall phone)
export function pongGeom(W, H) {
  const sN = W * NEARW / (2 * TABLE.x), dC = (RATIO * TABLE.y1 - TABLE.y0) / (1 - RATIO), F = sN * (dC + TABLE.y0);
  const Hg = Math.min(H, W * TALL), oy = (H - Hg) / 2;
  const Yn = oy + Hg * BOTTOM, Yf = oy + Hg * TOP, hC = (Yn - Yf) / (sN - F / (dC + TABLE.y1)), Yh = Yn - hC * sN;
  return { W, H, cx: W / 2, dC, F, hC, Yh, s: y => F / (dC + y) };
}
export function pongProject(G, x, y, z = 0) { const s = G.s(y); return { X: G.cx + x * s, Y: G.Yh + (G.hC - z) * s, s }; }
// The flick, exactly and predictably (the view reads the swipe, this maps it; the same on every phone):
//   direction: the swipe's angle on the screen (dx right, dy up, in pixels, from first touch to release) is
//     taken as a ray from the ball in the hand; the ball lands on the table point at the throw's distance whose
//     drawing lies on that ray (so a swipe towards a drawn cup goes at that cup, perspective and all). Solved
//     for the table angle th by bisection (the screen angle grows with th). angleGain (TUNE) scales dx first.
//   distance: the finger's speed v (CSS px/ms over the last ~80 ms of the swipe, not its length: a short quick
//     flick is a hard throw, a long slow push a soft one; a thumb's speed in CSS pixels is much the same on any
//     phone, so it is not scaled by the screen) maps straight onto power: power = (v - flickMin) / (flickMax -
//     flickMin), clamped to 0..1 (flickMin lands at PONG.near, mid-table; flickMax at PONG.far, past the back cups).
// Returns { aim, power } (the move), or null for a swipe that is not a throw (too short, or sideways).
export function pongFlick(G, dx, dy, v, t) {
  if (!(dy >= 14) || Math.abs(dx) > dy * 1.8) return null;
  const gain = t && t.angleGain != null ? t.angleGain : 1, lo = t && t.flickMin != null ? t.flickMin : 0.4, hi = t && t.flickMax != null ? t.flickMax : 1.7;
  const power = Math.max(0, Math.min(1, (v - lo) / Math.max(0.05, hi - lo)));
  const d = pongDist(power), want = Math.atan2(dx * gain, dy), [hx, hy, hz] = PONG.hand, Hs = pongProject(G, hx, hy, hz);
  const screenAngle = th => { const P = pongProject(G, Math.sin(th) * d, Math.cos(th) * d, 0); return Math.atan2(P.X - Hs.X, Hs.Y - P.Y); };   // (the throw's distance is from the table's origin, as the rules reckon it)
  let a = -PONG.angle, b = PONG.angle;
  const pw = Math.round(power * 1000) / 1000 + 0;
  if (want <= screenAngle(a)) return { aim: -1, power: pw };
  if (want >= screenAngle(b)) return { aim: 1, power: pw };
  for (let k = 0; k < 24; k++) { const m = (a + b) / 2; if (screenAngle(m) < want) a = m; else b = m; }
  return { aim: Math.round(((a + b) / 2) / PONG.angle * 1000) / 1000 + 0, power: pw };
}
