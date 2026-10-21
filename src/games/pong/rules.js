// Cup Pong: the rules (pure: no page, no clock; the server runs the same code).
import { needRng } from '../../core/random.js';
import { tune } from '../../core/tune.js';

// Cup Pong: the table is one unit long (the thrower at y 0, the far end at y 1) and one wide (x from
// -0.5 to 0.5). Each player's rack is three cups in a triangle at the far end. A throw is an aim
// (-1 to 1, the angle) and a power (0 to 1, the distance); the ball lands where the throw sends it,
// plus a little scatter either way. Inside a cup it sinks; within the rim it bounces, and drops in a
// quarter of the time; otherwise it misses.
export const PONG = { cups: [[0, 0.825], [-0.085, 0.93], [0.085, 0.93]], r: 0.055, rim: 0.03, rimIn: 0.25, spread: 0.068, angle: 0.35, near: 0.5, far: 1.1, goal: 3, fly: 900, hold: 500, aiErr: [0.012, 0.018] };
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
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.pong = { aim: l.aim, power: l.power, x: l.x, y: l.y, cup: l.cup, rim: l.rim, sunk: l.sunk, cups: { X: mini.cups.X.slice(), O: mini.cups.O.slice() } }; return;
}
export function flashMs(f, winLen, won) {
  return PONG.fly + PONG.hold + (won ? 600 : 0);
}
