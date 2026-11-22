// Fruit Slice: the screen, the miniature, the move's words and sounds, and this phone's round.
// The field is a canvas: a market awning and sky, the fruit thrown up from below and turning as it flies (original
// drawings: a melon, an orange, an apple, a lemon, a plum-coloured berry), the bombs black with a lit fuse (never a
// fruit's colour). This phone's round is live from Go (ui/round.js): a swipe leaves a white trail and whatever fruit
// it passes through falls in two halves with a splash; a bomb goes off and the round ends there. The time bar runs
// along the top. Anyone else's round is never streamed: its result is laid out on a tray, the fruit sliced landing
// one by one, a bang if a bomb ended it, then the points.
import { SLICE, sliceAt, sliceCfg, sliceRound, sliceShowMs } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { haptic } from '../../net/platform.js';
import { app, state } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { lateAt } from '../../ui/progress.js';
import { makeRound } from '../../ui/round.js';
import { drawTimeBar, runColours, runInputAt } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows, ptsTally } from '../../ui/tok.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is a round's result: shown from the flash
let src = null, hooked = false, drag = null, outro = null;   // outro: this phone's round just ended, kept to ease it out under its result: { L, sq, end (its ms) }
const round = makeRound('slice', {
  mine: () => !!src && src.mine,
  begin: (mini, p) => ({ c: sliceCfg(mini), items: sliceRound(mini, p), hit: new Set(), cuts: [], trail: [], boom: null, pts: 0 }),
  step: (L, ms) => !(L.boom != null ? ms > L.boom + SLICE.boom : ms > L.c.secs * 1000),
  move: L => { outro = { L, sq: L.sq, end: performance.now() - L.t0 }; return { hit: Array.from(L.hit).sort((a, b) => a - b) }; },
  go: () => go(),
});
// A swipe on the field: each stretch of it is tried against everything in the air.
function swipe(e, down) {
  const L = round.live, cv = app && app.querySelector ? app.querySelector('canvas.fscv') : null;
  if (!L || !cv || L.boom != null) return;
  const b = cv.getBoundingClientRect(), x = (e.clientX - b.left) / b.width * SLICE.w, y = (e.clientY - b.top) / b.height * SLICE.h, now = performance.now(), ms = now - L.t0;
  if (down || !drag) { drag = { x, y }; L.trail.push({ x, y, t: now, gap: true }); return; }
  const ax = drag.x, ay = drag.y, dx = x - ax, dy = y - ay, len2 = dx * dx + dy * dy; drag = { x, y }; L.trail.push({ x, y, t: now });
  if (len2 < 0.5) return;
  L.items.forEach((it, i) => {
    if (L.hit.has(i) || L.boom != null) return;
    const q = sliceAt(it, ms); if (!q) return;
    const u = Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - ay) * dy) / len2)), d = Math.hypot(q[0] - ax - dx * u, q[1] - ay - dy * u);
    if (d > (it.k < 0 ? SLICE.br : SLICE.fr) + 2) return;
    L.hit.add(i); L.cuts.push({ i, t: ms, x: q[0], y: q[1], a: Math.atan2(dy, dx) });
    if (it.k < 0) { L.boom = ms; SND.play('fsBoom'); haptic('error'); } else { L.pts++; SND.play('fsSlice', { rate: 0.9 + (L.pts % 5) * 0.06 }); haptic('tap'); }
  });
}
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  const on = e => !!round.live && state.screen === 'mini' && runInputAt(e.target) && e.target.closest && !!e.target.closest('.fsfield');
  app.addEventListener('pointerdown', e => { if (on(e)) { swipe(e, true); e.preventDefault(); } }, { passive: false });
  app.addEventListener('pointermove', e => { if (round.live && drag && (e.buttons || e.pointerType === 'touch')) swipe(e, false); });
  app.addEventListener('pointerup', () => { drag = null; }); app.addEventListener('pointercancel', () => { drag = null; });
}
export const actions = { 'fs-go': () => { ownPress(); if (!round.live) { SND.play('fsGo'); round.start(); } } };

// ---- the drawing ----
// The five fruit (k: 0 watermelon, 1 orange, 2 apple, 3 banana, 4 pineapple), original drawings, each its own outline
// (`body`), skin details, and the face a cut shows (`face`); juice in its own colour (JUICE).
const JUICE = ['#ff4d5e', '#ffa424', '#fff3c8', '#fff1a6', '#ffe14d'];
function body(c, k, R) {                                          // the fruit's outline, as a path (filled and stroked by the caller)
  c.beginPath();
  if (k === 0) c.ellipse(0, 0, R * 1.18, R * 0.9, 0, 0, 7);
  else if (k === 2) { c.moveTo(0, -R * 0.62); c.bezierCurveTo(R * 0.55, -R * 1.08, R * 1.2, -R * 0.55, R * 0.98, R * 0.25); c.bezierCurveTo(R * 0.82, R * 0.9, R * 0.3, R * 1.08, 0, R * 0.86); c.bezierCurveTo(-R * 0.3, R * 1.08, -R * 0.82, R * 0.9, -R * 0.98, R * 0.25); c.bezierCurveTo(-R * 1.2, -R * 0.55, -R * 0.55, -R * 1.08, 0, -R * 0.62); c.closePath(); }
  else if (k === 3) { c.moveTo(-R * 1.25, -R * 0.55); c.quadraticCurveTo(0, R * 1.55, R * 1.25, -R * 0.55); c.quadraticCurveTo(R * 1.12, -R * 0.3, R * 0.98, -R * 0.32); c.quadraticCurveTo(0, R * 0.25, -R * 0.98, -R * 0.32); c.quadraticCurveTo(-R * 1.12, -R * 0.3, -R * 1.25, -R * 0.55); c.closePath(); }
  else if (k === 4) c.ellipse(0, R * 0.15, R * 0.78, R * 0.98, 0, 0, 7);
  else c.arc(0, 0, R, 0, 7);
}
const SKIN = ['#2e8b3a', '#f7941d', '#e53935', '#f9d71c', '#e0a526'];
function skin(c, k, R, u) {                                       // the details on the skin, inside the outline (clipped by the caller)
  if (k === 0) { c.strokeStyle = '#1a5c25'; c.lineWidth = R * 0.16; for (const x of [-0.75, -0.25, 0.25, 0.75]) { c.beginPath(); c.moveTo(x * R, -R); for (let j = 1; j <= 6; j++) c.lineTo((x + (j % 2 ? 0.07 : -0.07)) * R, -R + j * R / 3); c.stroke(); } }
  if (k === 1) { c.fillStyle = 'rgba(160, 80, 0, .35)'; for (let j = 0; j < 9; j++) { c.beginPath(); c.arc(Math.cos(j * 2.4) * R * (0.25 + (j % 3) * 0.22), Math.sin(j * 2.4) * R * (0.25 + (j % 3) * 0.22), R * 0.05, 0, 7); c.fill(); } }
  if (k === 3) { c.fillStyle = '#6d4c1f'; c.beginPath(); c.arc(-R * 1.18, -R * 0.48, R * 0.13, 0, 7); c.arc(R * 1.18, -R * 0.48, R * 0.13, 0, 7); c.fill(); c.strokeStyle = 'rgba(150, 110, 20, .45)'; c.lineWidth = R * 0.07; c.beginPath(); c.moveTo(-R * 1.05, -R * 0.38); c.quadraticCurveTo(0, R * 1.05, R * 1.05, -R * 0.38); c.stroke(); }
  if (k === 4) { c.strokeStyle = 'rgba(120, 70, 0, .55)'; c.lineWidth = R * 0.07; for (let d = -2; d <= 2; d++) { c.beginPath(); c.moveTo(-R, d * R * 0.45 - R * 0.6); c.lineTo(R, d * R * 0.45 + R * 0.9); c.stroke(); c.beginPath(); c.moveTo(R, d * R * 0.45 - R * 0.6); c.lineTo(-R, d * R * 0.45 + R * 0.9); c.stroke(); } }
}
function top(c, k, R, P) {                                        // what grows out of the top (outside the outline)
  c.strokeStyle = P.ink; c.lineWidth = R * 0.08;
  if (k === 1 || k === 2) { c.strokeStyle = '#5b3a1e'; c.lineWidth = R * 0.12; c.beginPath(); c.moveTo(0, -R * (k === 2 ? 0.6 : 0.95)); c.lineTo(R * 0.1, -R * 1.25); c.stroke(); c.fillStyle = '#43a047'; c.strokeStyle = P.ink; c.lineWidth = R * 0.06; c.beginPath(); c.ellipse(R * 0.42, -R * 1.12, R * 0.34, R * 0.15, -0.5, 0, 7); c.fill(); c.stroke(); }
  if (k === 4) { c.fillStyle = '#3f9b3f'; c.strokeStyle = P.ink; c.lineWidth = R * 0.06; c.beginPath(); c.moveTo(-R * 0.45, -R * 0.72); for (const [x, y] of [[-0.55, -1.5], [-0.2, -1.0], [0, -1.75], [0.2, -1.0], [0.55, -1.5], [0.45, -0.72]]) c.lineTo(x * R, y * R); c.closePath(); c.fill(); c.stroke(); }
}
function fruit(c, u, x, y, k, rot, P, r) {
  c.save(); c.translate(x * u, y * u); c.rotate(rot); const R = (r || SLICE.fr) * u;
  top(c, k, R, P);
  c.fillStyle = SKIN[k]; c.strokeStyle = P.ink; c.lineWidth = 0.7 * u; body(c, k, R); c.fill();
  c.save(); body(c, k, R); c.clip(); skin(c, k, R, u); c.restore();
  body(c, k, R); c.stroke();
  if (k !== 3) { c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(-R * 0.38, -R * 0.38, R * 0.24, R * 0.13, -0.6, 0, 7); c.fill(); }
  c.restore();
}
function face(c, k, R, u, P) {                                    // the cut face, along the cut (y 0), an ellipse R wide
  const w = k === 0 ? R * 1.1 : k === 3 ? R * 0.5 : k === 4 ? R * 0.74 : R * 0.9, h = R * 0.24, x0 = k === 3 ? R * 0.0 : 0;
  c.fillStyle = k === 0 ? '#2e8b3a' : SKIN[k]; c.beginPath(); c.ellipse(x0, 0, w, h, 0, 0, 7); c.fill();
  c.fillStyle = k === 0 ? '#f8f3e0' : k === 1 ? '#ffd38a' : k === 2 ? '#fff6dc' : k === 3 ? '#fff4c6' : '#ffe56b';
  c.beginPath(); c.ellipse(x0, 0, w * 0.9, h * 0.8, 0, 0, 7); c.fill();
  if (k === 0) { c.fillStyle = '#ff4d5e'; c.beginPath(); c.ellipse(0, 0, w * 0.78, h * 0.68, 0, 0, 7); c.fill(); c.fillStyle = P.ink; for (const sx of [-0.5, -0.2, 0.15, 0.45]) { c.beginPath(); c.ellipse(sx * w, 0, R * 0.05, R * 0.03, 0, 0, 7); c.fill(); } }
  if (k === 1) { c.strokeStyle = '#f0a33c'; c.lineWidth = R * 0.05; for (let j = 0; j < 6; j++) { const an = j * Math.PI / 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(an) * w * 0.85, Math.sin(an) * h * 0.7); c.stroke(); } }
  if (k === 2) { c.fillStyle = '#5b3a1e'; c.beginPath(); c.ellipse(-R * 0.1, 0, R * 0.06, R * 0.035, 0, 0, 7); c.ellipse(R * 0.1, 0, R * 0.06, R * 0.035, 0, 0, 7); c.fill(); }
  if (k === 4) { c.fillStyle = '#f6c23e'; c.beginPath(); c.ellipse(0, 0, w * 0.25, h * 0.3, 0, 0, 7); c.fill(); }
  c.strokeStyle = P.ink; c.lineWidth = 0.6 * u; c.beginPath(); c.ellipse(x0, 0, w, h, 0, 0, 7); c.stroke();
}
function half(c, u, x, y, k, rot, side, P, r) {                   // one half of a sliced fruit: its skin cut along the middle, the face it shows
  c.save(); c.translate(x * u, y * u); c.rotate(rot); const R = (r || SLICE.fr) * u;
  c.save(); c.beginPath(); c.rect(-R * 2, side > 0 ? 0 : -R * 2.2, R * 4, R * 2.2); c.clip();
  if (side < 0) top(c, k, R, P);
  c.fillStyle = SKIN[k]; c.strokeStyle = P.ink; c.lineWidth = 0.7 * u; body(c, k, R); c.fill();
  c.save(); body(c, k, R); c.clip(); skin(c, k, R, u); c.restore(); body(c, k, R); c.stroke();
  c.restore();
  face(c, k, R, u, P);
  c.restore();
}
function bomb(c, u, x, y, rot, P, now) {
  c.save(); c.translate(x * u, y * u); c.rotate(rot); const R = SLICE.br * u;
  c.fillStyle = '#23232b'; c.strokeStyle = P.ink; c.lineWidth = 0.7 * u; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#4b4b58'; c.fillRect(-R * 0.28, -R * 1.2, R * 0.56, R * 0.4);
  c.strokeStyle = '#c9a36b'; c.lineWidth = 0.8 * u; c.beginPath(); c.moveTo(0, -R * 1.2); c.quadraticCurveTo(R * 0.5, -R * 1.7, R * 0.8, -R * 1.45); c.stroke();
  c.fillStyle = Math.floor(now / 90) % 2 ? '#fff' : '#ffb300'; c.beginPath(); c.arc(R * 0.8, -R * 1.45, R * 0.2, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(-R * 0.35, -R * 0.35, R * 0.24, R * 0.14, -0.6, 0, 7); c.fill();
  c.restore();
}
function backdrop(c, W, H, u, P) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9fdcf5'); g.addColorStop(1, '#e9f7d6'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#fff' : '#ef6f6c'; c.beginPath(); c.moveTo(k * W / 8, 0); c.lineTo((k + 1) * W / 8, 0); c.lineTo((k + 1) * W / 8, 7 * u); c.arc((k + 0.5) * W / 8, 7 * u, W / 16, 0, Math.PI); c.closePath(); c.fill(); }
  c.fillStyle = P.ink; c.fillRect(0, 0, W, 0.8 * u);
  c.fillStyle = '#b98952'; c.fillRect(0, H - 7 * u, W, 7 * u); c.fillStyle = P.ink; c.fillRect(0, H - 7.6 * u, W, 0.8 * u);
}
function burst(c, u, x, y, k, col, P, word) {                     // k: 0..1
  c.save(); c.translate(x * u, y * u); c.globalAlpha = Math.max(0, 1 - k * 0.9); c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = 0.7 * u;
  c.beginPath(); for (let a = 0; a < 20; a++) { const rr = (a % 2 ? 9 : 18) * u * (0.4 + k * 0.9), an = a * Math.PI / 10; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.stroke();
  if (word) { c.font = `400 ${Math.round(11 * u)}px Bangers, "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = P.ink; c.fillText(word, 0, 0.5 * u); }
  c.restore();
}
const go = stage('canvas.fscv', (c, W, H, now) => {
  round.tick(now);
  if (!src) return false;
  const P = runColours(), u = W / SLICE.w, L = round.live && round.on(src.zoom) ? round.live : null;
  c.clearRect(0, 0, W, H); backdrop(c, W, H, u, P);
  const scene = (L, ms) => {                                      // a round's things in the air and its cuts at `ms`
    L.items.forEach((it, i) => { if (L.hit.has(i)) return; const q = sliceAt(it, ms); if (!q) return; const rot = (ms - it.t) / 260 * (i % 2 ? 1 : -1); if (it.k < 0) bomb(c, u, q[0], q[1], rot, P, now); else fruit(c, u, q[0], q[1], it.k, rot, P); });
    L.cuts.forEach(q => { const it = L.items[q.i], dt = ms - q.t; if (dt > 900) return; if (it.k < 0) { burst(c, u, q.x, q.y, Math.min(1, dt / SLICE.boom), '#ffb300', P, 'BOOM!'); return; } const f = dt / 1000, off = 4 + f * 26, drop = f * f * 150; c.globalAlpha = Math.max(0, 1 - dt / 900); c.fillStyle = JUICE[it.k]; for (let s = 0; s < 9; s++) { const sp = 0.6 + (s % 3) * 0.3; c.beginPath(); c.arc((q.x + Math.cos(s * 0.7 + q.i) * f * 34 * sp) * u, (q.y + Math.sin(s * 0.7 + q.i) * f * 30 * sp + drop * 0.5) * u, Math.max(0.3, (1.9 - f * 1.6) * (1.2 - (s % 3) * 0.25)) * u, 0, 7); c.fill(); } if (dt < 260) { c.globalAlpha = 0.55 * (1 - dt / 260); c.beginPath(); c.ellipse(q.x * u, q.y * u, (6 + dt / 18) * u, (3 + dt / 40) * u, q.a, 0, 7); c.fill(); } c.globalAlpha = 1; half(c, u, q.x - Math.sin(q.a) * off, q.y + Math.cos(q.a) * off + drop, it.k, q.a + f * 3, 1, P); half(c, u, q.x + Math.sin(q.a) * off, q.y - Math.cos(q.a) * off + drop, it.k, q.a - f * 3, -1, P); });
    while (L.trail.length && now - L.trail[0].t > 220) L.trail.shift();
    c.strokeStyle = '#fff'; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let k = 1; k < L.trail.length; k++) { const a = L.trail[k - 1], b = L.trail[k]; if (b.gap) continue; c.globalAlpha = Math.max(0, 1 - (now - b.t) / 220); c.lineWidth = (1 + 2.2 * (1 - (now - b.t) / 220)) * u; c.beginPath(); c.moveTo(a.x * u, a.y * u); c.lineTo(b.x * u, b.y * u); c.stroke(); }
  };
  if (L) {                                                        // this phone's round
    const ms = now - L.t0, T = L.c.secs * 1000;
    scene(L, ms);
    c.globalAlpha = 1;
    c.font = `400 ${Math.round(13 * u)}px Bangers, "Arial Black", sans-serif`; c.textAlign = 'left'; c.textBaseline = 'top'; c.lineJoin = 'round'; c.lineWidth = 2 * u; c.strokeStyle = P.ink; c.fillStyle = '#fff'; c.strokeText(String(L.pts), 5 * u, 13 * u); c.fillText(String(L.pts), 5 * u, 13 * u);
    drawTimeBar(c, W, H, 1 - ms / T, P);
    return true;
  }
  const l = src.show;                                             // a result on show: the tray of what was sliced
  if (l) {
    const at = src.a ? fxAt('move', src.a) : null, t = src.a ? (at == null ? Infinity : now - at) : Infinity, cols = 5, cell = 16, x0 = 50 - (cols - 1) * cell / 2, n = Math.min(l.fr, 20);
    const O = src.own && outro && outro.sq === src.zoom ? outro : null, fade = O ? Math.min(1, t / SLICE.pre) : 1;
    if (O && fade < 1) {                                          // this phone's round easing out under its result: slowing to a stop as it fades
      const e = 1 - (1 - fade) * (1 - fade);
      c.globalAlpha = 1 - fade; scene(O.L, O.end + SLICE.pre * 0.5 * e); c.globalAlpha = 1;
    }
    c.globalAlpha = fade;
    c.fillStyle = 'rgba(255,255,255,.75)'; c.strokeStyle = P.ink; c.lineWidth = 0.8 * u; c.beginPath(); c.roundRect(8 * u, 22 * u, 84 * u, 74 * u, 4 * u); c.fill(); c.stroke();
    c.globalAlpha = 1;
    for (let k = 0; k < n; k++) { const due = SLICE.pre + k * SLICE.show; if (t < due) break; const pop = Math.min(1, (t - due) / 140), x = x0 + (k % cols) * cell, y = 34 + Math.floor(k / cols) * 15; half(c, u, x - 2.4, y + (1 - pop) * -8, l.got[k], -0.5, 1, P, 5.4 * (0.6 + 0.4 * pop)); half(c, u, x + 2.4, y + 1.5 + (1 - pop) * -8, l.got[k], 0.4, -1, P, 5.4 * (0.6 + 0.4 * pop)); }
    const after = SLICE.pre + l.fr * SLICE.show;
    if (!l.fr && t >= SLICE.pre) { c.font = `400 ${Math.round(9 * u)}px Bangers, "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(22,18,16,.4)'; c.fillText('NOTHING SLICED', 50 * u, 58 * u); }
    if (l.bomb && t >= after) burst(c, u, 50, 84, Math.min(0.45, (t - after) / SLICE.boom * 0.45), '#ffb300', P, 'BOOM!');
    return t < sliceShowMs(l) + 200;
  }
  // idle: a few fruit at rest on the counter
  [0, 1, 2, 3, 4].forEach(k => fruit(c, u, 18 + k * 16, 105 - (k % 2) * 3, k, [-0.2, 0.1, 0.15, -0.25, 0.05][k], P));
  return false;
});
const words = l => (l.bomb ? `Bomb! ${l.pts ? '+' + l.pts : 'Nothing'}` : `${l.fr} sliced! +${l.pts}`);
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = sliceCfg(mini), s = a && a.fs ? a.fs : null, own = !!s && ownMove(a), o = { view, locked, turn }, on = round.on(state.zoom);
  const rest = !s && (view || d) && mini.last ? mini.last : null, l = s || rest, by = s ? a.by : rest ? rest.by : turn, mine = !view && !s && !locked && !d, end = s ? sliceShowMs(s) : 0;   // (this phone's own round too: it eases out, its fruit land on the tray, then the points count on)
  const tal = p => ptsTally(p, o, c.target, mini.score[p], s && a.by === p ? s.from : null, end);
  const line = s ? `<p ${lateAt('fsline ' + (s.pts ? 'ok' : 'no'), end)} role="status">${words(s)}</p>` : `<p class="fsline${l && !on ? (l.pts ? ' ok' : ' no') : ''}">${l && !on ? words(l) : ''}</p>`;
  src = { mini, a: s ? a : null, own, show: on ? null : l, by, mine, zoom: state.zoom };
  const btn = view ? '' : `<button class="big ${turn} fsbtn" data-act="fs-go"${mine && !on ? '' : ' disabled'}>${on ? 'Slice!' : 'Go'}</button>`;
  go();
  return `<div class="g-fs pc-${by}"><div class="ctals two">${tal('X')}${tal('O')}</div><div class="fsbox"><div class="fsfield${on ? ' live' : ''}"><canvas class="fscv" aria-label="The fruit stall"></canvas></div></div>${line}${btn}</div>`;
}
// The miniature: a fruit sliced in two with a swipe through it, over each player's points as a bar.
export function miniature(mini, final) {
  const c = sliceCfg(mini);
  const art = '<svg class="tfs" viewBox="0 0 60 44"><path class="tfsa" d="M9 20a12 12 0 0 1 24 0z"/><path class="tfsf" d="M9 20h24"/><path class="tfsa" d="M27 31a12 12 0 0 0 24 0z" transform="rotate(14 39 31)"/><path class="tfsf" d="M27 31h24" transform="rotate(14 39 31)"/><path class="tfss" d="M4 38 56 8"/></svg>';
  return thumbArt(art, barRows(mini.score, c.target), 'tfsw col', `Fruit Slice: X ${mini.score.X}, O ${mini.score.O} of ${c.target} points`);
}
export function moveText(f, who) { const s = f.fs; return !s ? `${who} played a round` : `${who} sliced ${s.fr} fruit${s.bomb ? ' and a bomb' : ''} for ${s.pts}`; }
// Someone else's round, as its result is laid out: a pop for each fruit landing on the tray (thinned for a big
// round), the bang if a bomb ended it, then a chime for points or a thud for none. A round played here had its
// slices and its bang live: its tray lands quietly (a soft tick a fruit), then the chime or the thud as its points count on.
export function sounds(f, add, won, mini, last) {
  const s = f.fs; if (!s) return;
  const own = ownMove(f);
  for (let k = 0; k < s.fr; k += s.fr > 10 ? 2 : 1) add(own ? 'rtTick' : 'fsSlice', SLICE.pre + k * SLICE.show, 0.9 + (k % 5) * 0.06);
  const after = SLICE.pre + s.fr * SLICE.show;
  if (s.bomb && !own) add('fsBoom', after);
  add(s.pts ? 'ding' : 'thud', sliceShowMs(s));
}
