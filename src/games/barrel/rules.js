// Barrel Launch: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own column of barrels (the same column for both, dealt from the square's rng: `xs[i]` barrel i's
// place across the column, -BARREL.colW..BARREL.colW, `ph[i]` its swing's phase, 0..1; barrel 0 at the foot, barrel
// `top` the top). Barrel i stands i x `gap` up the column. Every barrel swings back and forth about its pivot on the
// player's own column clock: its aim at clock tau (ms) is amp x sin(2 pi (tau / its period + ph[i])) degrees from
// straight up (positive to the right). The player sits in barrel `at[p]`; the column's clock stood at `c[p]` when it
// was last ready to fire. A move is one shot, `{ t }`: ms since then when the tap fired it. The rules work out the
// aim at that moment and fire along it: the shot is caught when its line passes within `win` units of the next
// barrel's pivot (the barrel above's middle), and the player is in that barrel and fires again (`again`); else it
// drops back into the barrel it came from and the turn ends. Reaching the top barrel takes the square. The clock runs
// on by the shot's moment and its flight (BARREL.fly, and .land or .fall), so the next shot's barrel carries on its
// swing where it was: a column's clock never stops or steps, on the screen neither (view.js keeps one running clock a
// column, through every shot and every redraw of the page). With `ramp` on, each barrel up swings `rampPct` faster (to twice at most). Nothing hidden and
// nothing drawn by chance but the column. The tap's moment is the phone's word (the server cannot time a finger, as
// with Key Drop's stops), so the game is held out of Find Match (core/games.js FIND_MATCH_HOLD).
import { needRng } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

// colW: how far across a barrel may stand; reach: the most of the swing a next barrel may need (a share of amp);
// ms of a move's picture: `pre` someone else's swing up to their tap, `fly` the shot to the next barrel, `land` a
// catch (the barrel dips and springs back, the player peeks out, the camera climbs: the next shot is ready as it
// ends), `fall` a miss hanging at the top of its flight and tumbling back, `top` the win's celebration on the top
// barrel. (November 2026, with the wider spacing: a longer flight and landing; no hold of its own after them.)
export const BARREL = { colW: 30, reach: 0.6, maxT: 600000, pre: 800, fly: 440, land: 520, fall: 760, top: 900 };
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000, z = v => (v === 0 ? 0 : v);
const DEG = Math.PI / 180;
export function barrelCfg(mini) {
  const t = tune(mini);
  return { top: mini.top, amp: t.amp, period: t.period, gap: mini.gap || t.gap, win: t.win, ramp: t.ramp === 'on' ? t.rampPct / 100 : 0, ai: { easy: t.aiMsEasy, normal: t.aiMs, hard: t.aiMsHard } };
}
// Barrel i's swing: its period (ms there and back), its aim at column clock tau (degrees), and its turn rate there.
export const barrelPeriod = (c, i) => c.period / Math.min(2, 1 + c.ramp * i);
export const barrelAim = (mini, c, i, tau) => c.amp * Math.sin(2 * Math.PI * (tau / barrelPeriod(c, i) + (mini.ph[i] || 0)));
// What barrel i must aim at: the direction to barrel i + 1's pivot (degrees) and how far it is (units).
export function barrelTarget(mini, c, i) {
  const dx = (mini.xs[i + 1] || 0) - (mini.xs[i] || 0);
  return { phi: Math.atan2(dx, c.gap) / DEG, dist: Math.hypot(dx, c.gap), dx };
}
// A shot fired from barrel i along th (degrees): how far its line passes from the next pivot (units) and whether that
// is a catch.
export function barrelJudge(mini, c, i, th) {
  const g = barrelTarget(mini, c, i), d = Math.abs(th - g.phi) >= 90 ? Infinity : g.dist * Math.sin(Math.abs(th - g.phi) * DEG);
  return { off: d, hit: d <= c.win + 1e-9, phi: g.phi, dist: g.dist };
}
export function create(type, rng) {
  const t = tuneLive(type), R = needRng(rng), top = t.top, xs = [0], ph = [];
  const dm = t.gap * Math.tan(BARREL.reach * t.amp * DEG);
  for (let i = 1; i <= top; i++) {
    const d = (R() * 2 - 1) * Math.min(dm, BARREL.colW), prev = xs[i - 1];
    let x = prev + d; if (x > BARREL.colW || x < -BARREL.colW) x = prev - d;
    xs.push(z(r1(Math.max(-BARREL.colW, Math.min(BARREL.colW, x)))));
  }
  for (let i = 0; i <= top; i++) ph.push(z(r3(R())));
  return { type, v: 1, top, gap: t.gap, xs, ph, at: { X: 0, O: 0 }, c: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null };
}
export function apply(mini, p, m, rng, idx) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.t !== 'number' || !Number.isFinite(m.t) || m.t < 0 || m.t > BARREL.maxT) return { ok: false, reason: 'bad' };
  const c = barrelCfg(mini), i = mini.at[p];
  if (i >= c.top) return { ok: false, reason: 'done' };
  const t = Math.round(m.t), c0 = mini.c[p], th = barrelAim(mini, c, i, c0 + t), j = barrelJudge(mini, c, i, th);
  if (j.hit) mini.at[p] = i + 1;
  mini.c[p] = c0 + t + BARREL.fly + (j.hit ? BARREL.land : BARREL.fall);
  mini.last = { by: p, n: mini.n[p], from: i, t, c: c0, th: z(r2(th)), phi: z(r2(j.phi)), off: Number.isFinite(j.off) ? r2(j.off) : 999, hit: j.hit };
  mini.n[p]++;
  if (mini.at[p] >= c.top) return { ok: true, outcome: 'win', note: 'won' };
  return j.hit ? { ok: true, outcome: 'continue', note: 'catch', again: true } : { ok: true, outcome: 'continue', note: 'miss' };
}
export function timeoutClose(mini, p) { return null; }              // (a shot not fired is no shot: nothing is played for a player out of time; the turn passes and they stay where they are)
export function publicView(mini) {
  return { type: 'barrel', v: mini.v, top: mini.top, gap: mini.gap, xs: mini.xs.slice(), ph: mini.ph.slice(), at: { X: mini.at.X, O: mini.at.O }, c: { X: mini.c.X, O: mini.c.O }, n: { X: mini.n.X, O: mini.n.O }, last: mini.last ? Object.assign({}, mini.last) : null };
}
export function randomMove(mini, p, rng, from, empties) {          // (the tests' stand-in: a tap at some moment of the swing)
  return { t: Math.floor(rng() * 3000) };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.br = Object.assign({}, mini.last); }
// A move's picture, from its start: someone else's swing up to their tap (BARREL.pre), then the shot's flight and
// its catch (or its fall back); the top barrel reached: its celebration too.
export const barrelMs = (hit, own) => (own ? 0 : BARREL.pre) + BARREL.fly + (hit ? BARREL.land : BARREL.fall);
export function flashMs(f, winLen, won) { return barrelMs(!!(f && f.br && f.br.hit)) + (won ? BARREL.top : 0); }
