// Bowling: the screen, the miniature, the move's words and sounds, and the inputs.
import { r3 } from '../../core/util.js';
import { PHYSICS, physShot, physicsReady } from '../shared/physics.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { app, state } from '../../ui/app.js';
import { physBall, physResult, physTable, physThumb } from '../../ui/physics.js';
import { render } from '../../ui/render.js';
import { outlined, rr, runColours } from '../../ui/runner.js';
export { physicsSounds as sounds } from '../../ui/physics.js';

// Bowling's aim, in two taps (as in Darts). Step 1: an arrow from the ball sweeps left and right across the
// lane, a tap locks its direction; step 2: the power meter beside the lane rises and falls, a tap locks the
// power and the ball rolls with exactly those two (the move: { aim, power }, the same as any shot). Both
// sweeps are drawn on the canvas from the moment their step began, back and forth at a steady speed; a tap
// takes what the last frame showed. The arrow covers the lane to the gutters (beyond about 0.1 either way
// the ball misses the pins); the meter runs from nothing to full (below about 0.35 the ball stops short).
const BOWL_AIM = { max: 0.2, per: 1100, perP: 900 };         // the arrow: ±0.2 rad, one side to the other in 1.1 s; the meter: empty to full in 0.9 s
export let bowlDraft = null;                                          // { sq, p, step, t0, aim, power, shown: { aim, power, at } }
const bowlWave = (t, per) => { const k = Math.floor(t / per), f = (t % per) / per; return k % 2 ? 1 - f : f; };
export function bowlNow(dr, now) {
  const t = Math.max(0, now - dr.t0);
  if (dr.step === 1) return { aim: r3((bowlWave(t, BOWL_AIM.per) * 2 - 1) * BOWL_AIM.max), power: null };
  if (dr.step === 2) return { aim: dr.aim, power: r3(bowlWave(t, BOWL_AIM.perP)) };
  return { aim: dr.aim, power: dr.power };
}
// At each render of the lane: the draft kept, begun (the player to move, a fresh arrow), or dropped.
export function bowlKeep(o, mine) {
  const dr = bowlDraft, same = dr && dr.sq === o.zoom && dr.p === o.turn;
  if (mine) { if (!same || dr.step === 3) bowlDraft = { sq: o.zoom, p: o.turn, step: 1, t0: performance.now(), aim: 0, power: 0, shown: null }; }   // (a roll refused comes back to a fresh aim)
  else if (!(same && dr.step === 3 && !o.view)) bowlDraft = null;   // the roll on its way: both stay locked until it plays
  return bowlDraft;
}
export function bowlTap() {
  const sq = state.squares && state.squares[state.zoom], dr = bowlDraft;
  if (!sq || sq.mini.type !== 'bowling' || sq.owner || state.flash || state.done || blocked() || !physicsReady()) return false;
  if (!dr || dr.sq !== state.zoom || dr.p !== state.turn || dr.step === 3) return false;
  const now = performance.now(), v = dr.shown && now - dr.shown.at < 120 ? dr.shown : bowlNow(dr, now);
  if (dr.step === 1) { dr.aim = v.aim; dr.step = 2; dr.t0 = now; dr.shown = null; SND.play('mark'); render(); return true; }
  dr.power = v.power; dr.step = 3; dr.shown = null;
  attemptMove(physShot({ aim: dr.aim, power: dr.power }));
  if (state.zoom === dr.sq && bowlDraft === dr && !state.flash) render();   // (online: the roll waits on the server, both locked)
  return true;
}
// The arrow from the ball (sweeping, or locked) and, from step 2, the meter up the side, filling to the power.
export function drawBowlAim(g, pos, dr, now) {
  const c = g.c, P = runColours(), S = PHYSICS.lib.BOWL, from = pos.ball || S.start, v = bowlNow(dr, now);
  if (dr.step < 3) dr.shown = { aim: v.aim, power: v.power, at: now };
  const X = g.X(from[0]), Y = g.Y(from[1]), len = 0.36 * S.h * g.k, ux = Math.sin(v.aim), uy = -Math.cos(v.aim);
  c.save();
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(X + ux * S.ballR * 1.6 * g.k, Y + uy * S.ballR * 1.6 * g.k); c.lineTo(X + ux * len, Y + uy * len);
  c.lineWidth = 7; c.strokeStyle = P.ink; c.stroke(); c.lineWidth = 3.5; c.strokeStyle = dr.step === 1 ? '#fff' : P[dr.p]; c.stroke();
  const hx = X + ux * (len + 8), hy = Y + uy * (len + 8), a = v.aim;                     // the head
  c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx - Math.sin(a + 2.6) * 14, hy + Math.cos(a + 2.6) * 14); c.lineTo(hx - Math.sin(a - 2.6) * 14, hy + Math.cos(a - 2.6) * 14); c.closePath();
  outlined(c, dr.step === 1 ? '#fff' : P[dr.p], P.ink, 2);
  if (dr.step >= 2) {
    const mw = 16, mh = Math.min(g.H * 0.6, 220), right = g.X(S.w), mx = right + 10 + mw <= g.W ? right + (g.W - right - mw) / 2 : g.W - mw - 8, my = (g.H - mh) / 2;
    rr(c, mx, my, mw, mh, 7); outlined(c, 'rgba(255,255,255,.55)', P.ink, 2.5);
    const fill = mh * v.power;
    if (fill > 3) { rr(c, mx + 3, my + mh - fill + 1.5, mw - 6, fill - 3, 4); c.fillStyle = `hsl(${120 - 120 * v.power} 80% 48%)`; c.fill(); }
    c.beginPath(); c.moveTo(mx - 5, my + mh - fill); c.lineTo(mx + mw + 5, my + mh - fill); c.lineWidth = 3; c.strokeStyle = P.ink; c.stroke();   // the level, plain to read
  }
  c.restore();
}
export function drawBowl(g, mini, pos) {
  const c = g.c, P = runColours(), L = PHYSICS.lib, S = L.BOWL;
  c.fillStyle = '#6b6f78'; c.fillRect(0, 0, g.W, g.H);                                   // the gutters and beyond
  c.fillStyle = '#e8c58c'; c.fillRect(g.X(S.gutter), g.Y(0), (S.w - 2 * S.gutter) * g.k, S.h * g.k);   // the lane
  c.strokeStyle = 'rgba(120,70,20,.22)'; c.lineWidth = 1;                                // the boards
  for (let x = S.gutter + 4; x < S.w - S.gutter; x += 4) { c.beginPath(); c.moveTo(g.X(x), g.Y(0)); c.lineTo(g.X(x), g.Y(S.h)); c.stroke(); }
  c.fillStyle = '#3b3f47'; c.fillRect(g.X(0), g.Y(0), S.gutter * g.k, S.h * g.k); c.fillRect(g.X(S.w - S.gutter), g.Y(0), S.gutter * g.k, S.h * g.k);   // the gutters
  c.fillStyle = '#1e1e1e'; c.fillRect(g.X(0), g.Y(0), S.w * g.k, 6 * g.k);              // the pit at the back
  c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 2; c.beginPath(); c.moveTo(g.X(S.gutter), g.Y(S.start[1] + 14)); c.lineTo(g.X(S.w - S.gutter), g.Y(S.start[1] + 14)); c.stroke();   // the foul line
  c.fillStyle = 'rgba(0,0,0,.35)';                                                        // the arrows
  for (let i = 0; i < 7; i++) { const x = 35 + i * 5, y = 150 - Math.abs(i - 3) * 5; c.beginPath(); c.moveTo(g.X(x), g.Y(y - 4)); c.lineTo(g.X(x + 1.6), g.Y(y)); c.lineTo(g.X(x - 1.6), g.Y(y)); c.closePath(); c.fill(); }
  for (const [x, y] of S.pins) { c.beginPath(); c.arc(g.X(x), g.Y(y), 0.9 * g.k, 0, Math.PI * 2); c.fill(); }   // the pin spots
  S.pins.forEach((pt, k) => {                                                            // the pins standing, from above: white with the red bands
    const p = pos['p' + k]; if (!p) return;
    const X = g.X(p[0]), Y = g.Y(p[1]), R = S.pinR * g.k;
    c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); outlined(c, '#fff', P.ink, 2);
    c.beginPath(); c.arc(X, Y, R * 0.62, 0, Math.PI * 2); c.lineWidth = Math.max(1.5, R * 0.22); c.strokeStyle = P.X; c.stroke();
    c.beginPath(); c.arc(X, Y, R * 0.22, 0, Math.PI * 2); c.fillStyle = P.ink; c.fill();
  });
  if (pos.ball) {                                                                         // the ball: dark, three finger holes
    const [x, y] = pos.ball, X = g.X(x), Y = g.Y(y), R = S.ballR * g.k;
    physBall(g, x, y, S.ballR, '#4a2a8a', '', P.ink);
    c.fillStyle = 'rgba(0,0,0,.6)';
    for (const [dx, dy] of [[-0.3, -0.1], [0.3, -0.1], [0, 0.35]]) { c.beginPath(); c.arc(X + dx * R, Y + dy * R, R * 0.14, 0, Math.PI * 2); c.fill(); }
  }
}
export function miniature(mini, final) {
  return physThumb(mini);
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = physTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return physResult(f, true).text;
}

// Its listeners: main.js calls this once, in the page's original order of listeners.
export function init() {
  app.addEventListener('pointerdown', e => {
    const t = e.target.closest && e.target.closest('.pscene.bowling[data-live], button[data-act="bowl"]:not(:disabled)');
    if (!t || state.screen !== 'mini') return;
    e.preventDefault(); ownPress();
    bowlTap();
  });
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setBowlDraft(v) { bowlDraft = v; }
export function setBowlNow(v) { bowlNow = v; }
