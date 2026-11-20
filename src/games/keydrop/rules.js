// Key Drop: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own machine: a wall of `cols` by `rows` prizes, each on its own shelf behind a small keyhole
// (`wall[p][i]`: true while prize i is still on its shelf; i = row * cols + col, row 0 the lowest; the same wall for
// both). The machine's face is 100 across and 100 up; the key starts at its lower left (KEYD.x0, KEYD.y0). A move is
// one attempt, `{ x, y }`: where the key stopped after its one slide to the right and its one slide up. Then it
// pushes forward by itself: within `tol` of a keyhole both across and up, it goes in, and a prize still on that
// shelf drops into the prize box (a keyhole whose prize is gone scores nothing: note 'empty'); else it bumps the
// wall, a `near` miss where it scraped a keyhole's edge (within KEYD.near times the tolerance). First to `goal`
// prizes takes the square. Nothing is drawn by chance. Where the key stopped is the phone's word (the server cannot
// time a finger letting go, as with Bullseye's stops), so the game is held out of Find Match (core/games.js
// FIND_MATCH_HOLD).
import { tune, tuneLive } from '../../core/tune.js';

export const KEYD = { x0: 10, y0: 10, max: 92, lo: 26, span: 58, near: 2.6, rampCap: 2, ax: 420, ay: 420, push: 360, drop: 520, hold: 520, kinds: 6 };   // the key's start and its rails' end; the keyholes' first place and spread; a near miss's reach (tolerances); the most the speed grows; ms of someone else's attempt: the slide right, the slide up; the push, a prize's fall, the result; the prize drawings
export function keydCfg(mini) {
  const t = tune(mini), cols = mini.cols, rows = mini.rows;
  return { cols, rows, goal: Math.min(t.goal, cols * rows), vx: t.speedX, vy: t.speedY, tol: t.tol, ramp: t.ramp === 'on' ? t.rampPct / 100 : 0, ai: { easy: t.aiMsEasy, normal: t.aiMs, hard: t.aiMsHard } };
}
export function create(type, rng) {
  const t = tuneLive(type), n = t.cols * t.rows, set = () => Array.from({ length: n }, () => true);
  return { type, v: 1, cols: t.cols, rows: t.rows, wall: { X: set(), O: set() }, got: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null };
}
// A keyhole's middle on the machine's face; the key's speed on a player's next attempt (units a second: a little
// more with each attempt of theirs while the setting is on).
const spot = (k, n) => (n <= 1 ? KEYD.lo + KEYD.span / 2 : KEYD.lo + k * KEYD.span / (n - 1));
export const keydHole = (mini, i) => ({ x: spot(i % mini.cols, mini.cols), y: spot(Math.floor(i / mini.cols), mini.rows) });
export function keydSpeed(c, attempts) { const f = Math.min(KEYD.rampCap, 1 + c.ramp * attempts); return { x: c.vx * f, y: c.vy * f }; }
// Where a slide has the key t ms after it set off from `from` at v units a second (it stops at the rail's end).
export const keydAt = (from, v, t) => Math.min(KEYD.max, from + v * Math.max(0, t) / 1000);
// What the key meets at (x, y): { hole, in } the keyhole it goes into, or the one it scrapes (`near`), or neither.
export function keydMeet(mini, c, x, y) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < mini.cols * mini.rows; i++) { const h = keydHole(mini, i), d = Math.max(Math.abs(h.x - x), Math.abs(h.y - y)); if (d < bd) { bd = d; best = i; } }
  if (best < 0) return { hole: -1, in: false, near: false };
  return bd <= c.tol + 1e-9 ? { hole: best, in: true, near: false } : bd <= c.tol * KEYD.near ? { hole: best, in: false, near: true } : { hole: -1, in: false, near: false };
}
export function apply(mini, p, m, rng, idx) {
  const c = keydCfg(mini), num = v => typeof v === 'number' && Number.isFinite(v);
  if (!m || typeof m !== 'object' || !num(m.x) || !num(m.y) || m.x < KEYD.x0 || m.x > KEYD.max || m.y < KEYD.y0 || m.y > KEYD.max) return { ok: false, reason: 'bad' };
  const x = Math.round(m.x * 10) / 10, y = Math.round(m.y * 10) / 10, w = keydMeet(mini, c, x, y);
  const hit = w.in && mini.wall[p][w.hole] ? w.hole : -1, empty = w.in && hit < 0;
  if (hit >= 0) { mini.wall[p][hit] = false; mini.got[p]++; }
  mini.last = { by: p, n: mini.n[p], x, y, hit, hole: w.hole, near: w.near, empty };
  mini.n[p]++;
  if (mini.got[p] >= c.goal) return { ok: true, outcome: 'win', note: 'won' };
  return { ok: true, outcome: 'continue', note: hit >= 0 ? 'hit' : empty ? 'empty' : w.near ? 'near' : 'miss' };
}
export function timeoutClose(mini, p) { return null; }              // (an attempt not finished is not made: nothing is played for a player out of time)
export function publicView(mini) {
  return { type: 'keydrop', v: mini.v, cols: mini.cols, rows: mini.rows, wall: { X: mini.wall.X.slice(), O: mini.wall.O.slice() }, got: { X: mini.got.X, O: mini.got.O }, n: { X: mini.n.X, O: mini.n.O }, last: mini.last ? Object.assign({}, mini.last) : null };
}
export function randomMove(mini, p, rng, from, empties) {          // (the tests' stand-in: at a keyhole with its prize, a little off)
  const live = mini.wall[p].map((on, i) => (on ? i : -1)).filter(i => i >= 0), h = keydHole(mini, live.length ? from(live) : 0), cl = v => Math.max(KEYD.x0, Math.min(KEYD.max, v));
  return { x: cl(h.x + (rng() - 0.5) * 6), y: cl(h.y + (rng() - 0.5) * 6) };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.kd = Object.assign({}, mini.last); }
export const keydPre = () => KEYD.ax + KEYD.ay;                     // someone else's attempt: its two slides, before the push
export const keydMs = hit => keydPre() + KEYD.push + (hit ? KEYD.drop : 0);
export function flashMs(f, winLen, won) { return keydMs(!!(f && f.kd && f.kd.hit >= 0)) + KEYD.hold + (won ? 400 : 0); }
