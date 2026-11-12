// The runners' shared effects (Dash, Lane Rush, Flap, Chopper; November 2026's polish): small things every runner's
// scene draws on its canvas, each a plain function of the run as it stands (the sim, the frame's time, the moment the
// run ended), and what a run's events sound like. Nothing here changes a run: the sim is only read (its view's own
// notes are kept beside it, on sim.fx).
import { ANIM } from '../core/timer.js';
import { CHOP } from '../games/chopper/rules.js';
import { DASH, DASH_OBS } from '../games/dash/rules.js';
import { FLAP } from '../games/flap/rules.js';
import { LANE } from '../games/lane/rules.js';
import { REDUCED } from './app.js';

export const clamp01 = k => Math.max(0, Math.min(1, k));
export const easeOut = k => 1 - (1 - clamp01(k)) ** 3;
export const backOut = k => { const t = clamp01(k) - 1; return t * t * (2.70158 * t + 1.70158) + 1; };   // a pop: past its size, then back
export const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // 0..1 from a number: scenery placed along a course, the same wherever it is drawn
export const FONT = px => `400 ${Math.round(px)}px 'Luckiest Guy', 'Arial Black', sans-serif`;
export const SMALL = px => `800 ${Math.round(px)}px Nunito, Arial, sans-serif`;
// The timings of a run's end on its scene (ms from the moment it ended): the impact's burst, the scene's jolt, the
// banner's pop. (The tumble or the spin-out itself plays 700 ms, the finish's flourish 500: ui/runner.js.)
export const RUNFX = { burst: 340, jolt: 280, pop: 380, puff: 420, squash: 170 };

export function shadow(c, x, y, rx, ry, a = 0.2) { if (rx <= 0 || ry <= 0) return; c.fillStyle = `rgba(22, 18, 16, ${a})`; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
export function starPath(c, x, y, r, n = 5, rot = 0, inner = 0.45) {
  c.beginPath();
  for (let k = 0; k < n * 2; k++) { const a = rot + (k * Math.PI) / n, q = k % 2 ? r * inner : r; c[k ? 'lineTo' : 'moveTo'](x + Math.sin(a) * q, y - Math.cos(a) * q); }
  c.closePath();
}
// How far into the end of a run the scene is, 0 to 1 over `ms` (rd: the run's end as it plays: { at }; none: a scene
// at rest, the end long over).
export const endK = (rd, now, ms) => (rd && rd.at != null ? clamp01((now - rd.at) / ms) : 1);
export const hitNow = sim => !!sim.crash && !(sim.crash.ob && sim.crash.ob.k === 'time');   // a crash into something (not the time limit's end)
// The burst where a runner hit something: a spiky paper star that pops and fades, once, as the crash plays.
export function impact(c, x, y, r, rd, now, P, col) {
  const k = endK(rd, now, RUNFX.burst);
  if (k >= 1 || REDUCED) return;
  c.save(); c.globalAlpha = 1 - k * k; c.lineJoin = 'round';
  starPath(c, x, y, r * (0.5 + 0.9 * easeOut(k)), 9, k * 0.5, 0.55); c.fillStyle = P.paper; c.fill(); c.lineWidth = 2.5; c.strokeStyle = P.ink; c.stroke();
  starPath(c, x, y, r * (0.25 + 0.5 * easeOut(k)), 9, -k * 0.4, 0.55); c.fillStyle = col || '#f39a3b'; c.fill();
  c.restore();
}
// Three little stars going round a head that has just hit something (still, on a scene at rest).
export function dizzy(c, x, y, r, now, P) {
  for (let i = 0; i < 3; i++) { const a = (REDUCED ? 0 : now / 260) + (i * Math.PI * 2) / 3; starPath(c, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.35, r * 0.34, 5, a); c.fillStyle = P.paper; c.fill(); c.lineWidth = 1.5; c.strokeStyle = P.ink; c.stroke(); }
}
// A cloud: three white lobes (each its own shape: no stray corner where one ellipse's path runs on into the next).
export function cloud(c, x, y, s = 1) {
  c.fillStyle = '#ffffff';
  for (const [dx, dy, rx, ry] of [[0, 0, 32, 12], [21, -6, 21, 11], [-17, -3, 15, 8.5]]) { c.beginPath(); c.ellipse(x + dx * s, y + dy * s, rx * s, ry * s, 0, 0, Math.PI * 2); c.fill(); }
}
// A soft round puff (dust, smoke, a wing's air): rgb its colour, a its strength.
export function puff(c, x, y, r, a, rgb = '255, 255, 255') { if (a <= 0 || r <= 0) return; c.fillStyle = `rgba(${rgb}, ${a})`; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
// The crash's jolt: the whole scene kicks and settles (a little in Normal, more in Speed by its effects setting; none
// with reduced motion). Call inside a save/restore, before the scene is drawn.
export function jolt(c, W, H, sim, rd, now) {
  if (!sim.crash || !rd || rd.at == null || REDUCED) return;
  const k = (now - rd.at) / RUNFX.jolt;
  if (k < 0 || k >= 1) return;
  const amp = (ANIM.mode === 'speed' ? 3 + 2.5 * Math.min(2, ANIM.fx) : 3) * (1 - k) * (1 - k);
  c.translate(W / 2, H / 2); c.scale(1 + (2.6 * amp) / Math.min(W, H), 1 + (2.6 * amp) / Math.min(W, H)); c.translate(-W / 2 + amp * Math.sin(k * 31), -H / 2 + amp * Math.cos(k * 27));
}
// A word over the scene (GO!, FINISH!, TIME!): paper letters with the ink outline of the count, popping in as the run
// starts or ends (never faded: see-through letters over their own outline go grey); out: 0 to 1, shrinking away again.
export function banner(c, W, H, text, rd, now, P, at = 0.3, out = 0) {
  const k = REDUCED ? 1 : endK(rd, now, RUNFX.pop), s = (0.5 + 0.5 * backOut(k)) * (1 - clamp01(out)), px = Math.min(W * 0.17, H * 0.24);
  if (s <= 0.02) return;
  c.save(); c.translate(W / 2, H * at); c.scale(s, s);
  c.font = FONT(px); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.fillStyle = P.ink; c.fillText(text, 0, px * 0.09); c.lineWidth = Math.max(5, px * 0.2); c.strokeStyle = P.ink; c.strokeText(text, 0, px * 0.09); c.strokeText(text, 0, 0);
  c.fillStyle = P.paper; c.fillText(text, 0, 0);
  c.restore();
}
// What goes over every runner's scene once it is drawn: the finish's word, or the time limit's.
export function runOverlay(c, W, H, sim, rd, now, P) {
  if (sim.done) banner(c, W, H, 'FINISH!', rd, now, P);
  else if (sim.crash && sim.crash.ob && sim.crash.ob.k === 'time') banner(c, W, H, 'TIME!', rd, now, P);
}
// A chequered flag on a pole, waving (the finish, in every runner): its foot at (x, y), s its size.
export function finishFlag(c, x, y, s, now, P) {
  c.strokeStyle = P.ink; c.lineWidth = Math.max(3, s * 0.14); c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - s * 2.6); c.stroke();
  const fw = s * 1.5, fh = s, n = 4, wv = q => (REDUCED ? 0 : Math.sin(now / 170 + q * 2.2) * s * 0.07);
  for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) {
    const x0 = x + (i * fw) / n, x1 = x + ((i + 1) * fw) / n, y0 = y - s * 2.6 + (j * fh) / 3, y1 = y0 + fh / 3;
    c.fillStyle = (i + j) % 2 ? P.ink : P.paper; c.beginPath(); c.moveTo(x0, y0 + wv(i / n)); c.lineTo(x1, y0 + wv((i + 1) / n)); c.lineTo(x1, y1 + wv((i + 1) / n)); c.lineTo(x0, y1 + wv(i / n)); c.closePath(); c.fill();
  }
  c.strokeStyle = P.ink; c.lineWidth = 2; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x, y - s * 2.6 + wv(0));
  for (let i = 1; i <= n; i++) c.lineTo(x + (i * fw) / n, y - s * 2.6 + wv(i / n));
  for (let i = n; i >= 0; i--) c.lineTo(x + (i * fw) / n, y - s * 2.6 + fh + wv(i / n));
  c.closePath(); c.stroke();
}
// A round sign with a distance on it (every 100 m): a paper plate, the number in the game's small type.
export function distSign(c, x, y, text, px, P) {
  c.font = SMALL(px); const w = Math.max(px * 2.3, c.measureText(text).width + px * 0.9), h = px * 1.5;
  c.beginPath(); c.roundRect(x - w / 2, y - h, w, h, h * 0.3); c.fillStyle = P.paper; c.fill(); c.lineWidth = 2; c.strokeStyle = P.ink; c.stroke();
  c.fillStyle = P.ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y - h / 2 + px * 0.06); c.textBaseline = 'alphabetic';
}

// ---- a run's events, for its sounds: a landing (Dash), an obstacle cleared (Flap's post, Lane Rush's row, Chopper's
// block). The same reading for a run played here (ui/runner.js runFrame, a frame at a time) and for someone else's
// (runnerSounds plays the log through and schedules them from the move's event). ----
export const RUN_EVENT_SND = { land: 'runLand', pass: { flap: 'runPass', lane: 'runWhoosh', chopper: 'runWhoosh' } };
// Where the runner is clear of an obstacle (metres along the course).
export const clearAt = (type, o) => (type === 'dash' ? o.at + DASH_OBS[o.k].w + DASH.box.w / 2 : type === 'flap' ? o.at + FLAP.post + FLAP.box.w / 2 : type === 'chopper' ? o.at + CHOP.bw + CHOP.box.w / 2 : o.at + LANE.box);
// st: { air, k } kept by the caller across calls (start it as {}); returns the sounds of what has happened since.
export function runEvents(sim, st) {
  const out = [];
  if (st.k == null) { st.k = 0; st.air = !!sim.air; }
  if (sim.type === 'dash') { if (st.air && !sim.air && !sim.crash) out.push(RUN_EVENT_SND.land); st.air = !!sim.air; return out; }
  const snd = RUN_EVENT_SND.pass[sim.type];
  while (st.k < sim.course.length && clearAt(sim.type, sim.course[st.k]) <= sim.d) { st.k++; if (!sim.crash && out.length < 1) out.push(snd); }
  return out;
}
