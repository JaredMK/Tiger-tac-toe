// Cup Pong: the rules (pure: no page, no clock; the server runs the same code).
import { needRng } from '../../core/random.js';
import { tune } from '../../core/tune.js';

// Cup Pong: the table is one unit long (the thrower at y 0, the far end at y 1) and one wide (x from
// -0.5 to 0.5). Each player's rack is three cups in a triangle at the far end. A throw is an aim
// (-1 to 1, the angle) and a power (0 to 1, the distance); the ball lands where the throw sends it,
// plus a little scatter either way. Inside a cup it sinks; within the rim it bounces, and drops in a
// quarter of the time; otherwise it misses.
// The throw as drawn (ms): the flight; a make drops into the cup, a rim ball pops off the rim; the splash, then the
// cup lifted off the table; a ball on the table rolls to the edge and off it (rollPer ms a table length).
export const PONG = { cups: [[0, 0.825], [-0.085, 0.93], [0.085, 0.93]], r: 0.055, rim: 0.03, rimIn: 0.25, spread: 0.068, angle: 0.35, near: 0.5, far: 1.1, goal: 3, fly: 900, drop: 220, hop: 420, splash: 320, lift: 450, rollPer: 1300, rollMin: 320, rollMax: 900, settle: 120, aiErr: [0.012, 0.018] };
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
// The throw that lands on a cup's centre with no scatter: the computer's aim, before its own error.
export function pongAimAt(k) { const [cx, cy] = PONG.cups[k]; return { aim: Math.atan2(cx, cy) / PONG.angle, power: (Math.hypot(cx, cy) - PONG.near) / (PONG.far - PONG.near) }; }
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
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';                                        // a random throw
}
// Where the ball goes after it lands, worked out from the throw alone (no randomness): a rim ball touches the
// rim at angle ra (from the cup's centre, towards where it came down: atan2(dx, dy)), pops off it and comes
// down at (bx, by), clear of the cups; a ball on the table (or off it) rolls from there, or from where it
// landed, to (ox, oy), just past the table's edge. Its way clear of the cups still standing: the throw's own
// direction first, else the nearest one that is.
const r3 = v => Math.round(v * 1000) / 1000 + 0;   // (+ 0: never a -0)
const CLEAR = 0.14;                                  // (a cup's rim and the ball's size: the ball as drawn never touches a cup it rolls past)
function pongExit(px, py, dx, dy) {                  // where a ball rolling from (px, py) along (dx, dy) is wholly off the table
  const X = 0.56, Y0 = -0.05, Y1 = 1.05;
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
// on the table), when it splashes into the cup and the cup is lifted off, when it lands off the rim, how long
// it rolls, when the result's word shows, and when it is all over.
export function pongPlan(g) {
  const T = PONG.fly;
  if (g.sunk) {
    const splash = T + (g.rim ? PONG.hop : PONG.drop), lift = splash + PONG.splash;
    return { hit: T, splash, lift, res: splash, end: lift + PONG.lift };
  }
  const bounce = g.rim ? T + PONG.hop : T;
  const fx = g.rim ? g.bx : g.x, fy = g.rim ? g.by : g.y;
  const roll = g.ox == null ? 0 : Math.round(Math.max(PONG.rollMin, Math.min(PONG.rollMax, Math.hypot(g.ox - fx, g.oy - fy) * PONG.rollPer)));
  return { hit: T, bounce, roll, res: bounce, end: bounce + roll };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last, up = mini.cups[l.by].slice();
  flash.pong = Object.assign({ aim: l.aim, power: l.power, x: l.x, y: l.y, cup: l.cup, rim: l.rim, sunk: l.sunk }, pongPath(l, up), { cups: { X: mini.cups.X.slice(), O: mini.cups.O.slice() } }); return;
}
export function flashMs(f, winLen, won) {
  return (f.pong ? pongPlan(f.pong).end : PONG.fly) + PONG.settle + (won ? 600 : 0);
}
