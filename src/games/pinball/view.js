// Pinball: the screen, the miniature, the move's words and sounds, and the inputs.
import { fingAt } from '../shared/finger.js';
import { PHYSICS } from '../shared/physics.js';
import { state } from '../../ui/app.js';
import { fingSounds, fingTable } from '../../ui/finger.js';
import { outlined, rr, runColours } from '../../ui/runner.js';
export { fingerMoveText as moveText } from '../../ui/finger.js';

// Pinball: the table in portrait (its walls and rails in paper with ink outlines), the pop bumpers, the
// slingshots with their bands, the spinner's ring, the seven targets (lit ones in the player's colour,
// a star on them), the flippers, the plunger in its lane (pulled down as the finger pulls) and the ball.
export function drawPin(c, W, H, v, now) {
  const P = runColours(), L = PHYSICS.lib, T = L.PIN, cfg = v.cfg || {};
  const k = Math.min(W / T.w, H / T.h), ox = (W - T.w * k) / 2, oy = (H - T.h * k) / 2, X = x => ox + x * k, Y = y => oy + y * k;
  const col = v.p === 'O' ? P.O : P.X;
  c.fillStyle = '#241b38'; c.fillRect(0, 0, W, H);
  c.beginPath();                                                    // the playfield, inside the outside wall
  const outer = L.PIN_WALLS.slice(0, 8);
  c.moveTo(X(outer[0][0]), Y(outer[0][1])); for (const s of outer) c.lineTo(X(s[2]), Y(s[3])); c.closePath();
  const g = c.createLinearGradient(0, oy, 0, oy + T.h * k); g.addColorStop(0, '#3d3378'); g.addColorStop(1, '#2a6f8f');
  c.fillStyle = g; c.fill();
  c.fillStyle = 'rgba(255,255,255,.06)'; for (let y = 10; y < T.h; y += 16) { c.beginPath(); c.arc(X(45), Y(y), 1.2 * k, 0, Math.PI * 2); c.fill(); }
  const S = T.spin, [sx, sy] = L.pinSpinAt(v.t || 0, cfg);           // the spinner's ring
  c.setLineDash([4, 5]); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(X(S.cx), Y(S.cy), S.r * k, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
  c.beginPath(); c.arc(X(S.cx), Y(S.cy), 2 * k, 0, Math.PI * 2); outlined(c, '#58a8cf', P.ink, 2);
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(S.cx), Y(S.cy)); c.lineTo(X(sx), Y(sy)); c.stroke();
  c.lineCap = 'round';
  for (const [x1, y1, x2, y2, t] of L.PIN_WALLS) { c.strokeStyle = P.ink; c.lineWidth = (t + 0.9) * k; c.beginPath(); c.moveTo(X(x1), Y(y1)); c.lineTo(X(x2), Y(y2)); c.stroke(); }
  for (const [x1, y1, x2, y2, t] of L.PIN_WALLS) { c.strokeStyle = P.paper; c.lineWidth = Math.max(1, (t - 0.5) * k); c.beginPath(); c.moveTo(X(x1), Y(y1)); c.lineTo(X(x2), Y(y2)); c.stroke(); }
  for (const tri of L.PIN_SLINGS) {                                // the slingshots: a band on the face that kicks
    c.beginPath(); tri.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); c.closePath(); outlined(c, '#58a8cf', P.ink, 2.2);
    c.strokeStyle = '#fff'; c.lineWidth = Math.max(2, 0.9 * k); c.beginPath(); c.moveTo(X(tri[0][0]), Y(tri[0][1])); c.lineTo(X(tri[2][0]), Y(tri[2][1])); c.stroke();
  }
  const ball = v.ball, bR = T.ballR;
  for (const [x, y] of T.bump.at) {                                 // the pop bumpers: they glow as the ball is on them
    const on = ball && Math.hypot(ball[0] - x, ball[1] - y) < T.bump.r + bR + 1.5;
    c.beginPath(); c.arc(X(x), Y(y), T.bump.r * k, 0, Math.PI * 2); outlined(c, on ? P.O : '#4e9d3a', P.ink, 2.5);
    c.beginPath(); c.arc(X(x), Y(y), T.bump.r * k * 0.55, 0, Math.PI * 2); outlined(c, P.paper, P.ink, 1.8);
    c.fillStyle = P.X; c.beginPath(); for (let s = 0; s < 10; s++) { const a = -Math.PI / 2 + (s * Math.PI) / 5, r = (s % 2 ? 0.16 : 0.38) * T.bump.r * k; c.lineTo(X(x) + Math.cos(a) * r, Y(y) + Math.sin(a) * r); } c.closePath(); c.fill();
  }
  const fresh = v.flash && now - v.flash.at < 600 ? v.flash.id : -1;
  c.font = `800 ${Math.max(8, Math.round(2.4 * k))}px Nunito, Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const tg of T.targets) {                                     // the targets: lit for this player, or waiting
    const [x, y] = tg.spin ? [sx, sy] : [tg.x, tg.y], r = tg.r * (cfg.size || 1) * k, lit = !!(v.lit && v.lit[tg.id]);
    if (lit) { c.fillStyle = tg.id === fresh ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.22)'; c.beginPath(); c.arc(X(x), Y(y), r * (tg.id === fresh ? 2.1 : 1.5), 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.arc(X(x), Y(y), r, 0, Math.PI * 2); outlined(c, lit ? col : P.paper, P.ink, 2.2);
    if (lit) { c.fillStyle = P.paper; c.beginPath(); for (let s = 0; s < 10; s++) { const a = -Math.PI / 2 + (s * Math.PI) / 5, rs = (s % 2 ? 0.25 : 0.62) * r; c.lineTo(X(x) + Math.cos(a) * rs, Y(y) + Math.sin(a) * rs); } c.closePath(); c.fill(); }
    else { c.fillStyle = P.ink; c.fillText(String(tg.id + 1), X(x), Y(y) + 0.5); }
  }
  for (const side of ['L', 'R']) {                                  // the flippers
    const [x1, y1, x2, y2] = L.pinFlipLine(side, v.flips[side === 'L' ? 0 : 1]);
    c.strokeStyle = P.ink; c.lineWidth = (T.flip.thick + 1) * k; c.beginPath(); c.moveTo(X(x1), Y(y1)); c.lineTo(X(x2), Y(y2)); c.stroke();
    c.strokeStyle = col; c.lineWidth = Math.max(2, (T.flip.thick - 0.6) * k); c.stroke();
    c.beginPath(); c.arc(X(x1), Y(y1), 1.1 * k, 0, Math.PI * 2); outlined(c, P.paper, P.ink, 1.5);
  }
  const ln = T.lane, py = ln.serve[1] + bR + 0.6 + (v.pull || 0) * 8;   // the plunger
  c.fillStyle = '#b8b2c8'; c.fillRect(X(ln.serve[0] - 0.6), Y(py), 1.2 * k, Y(T.h) - Y(py));
  c.strokeStyle = P.ink; c.lineWidth = 1.5; c.beginPath(); for (let s = 0; s <= 6; s++) { const yy = py + 2 + s * ((T.h - py - 3) / 6); c.lineTo(X(ln.serve[0] + (s % 2 ? 2 : -2)), Y(yy)); } c.stroke();
  rr(c, X(ln.serve[0] - 3), Y(py), 6 * k, 2 * k, 0.8 * k); outlined(c, P.X, P.ink, 1.8);
  if (ball) {                                                       // the ball: steel, with a shine
    const bx = X(ball[0]), by = Y(ball[1]) - (v.waiting ? (v.pull || 0) * 8 * k * 0 : 0), R = bR * k;
    const bg = c.createRadialGradient(bx - R * 0.35, by - R * 0.35, R * 0.1, bx, by, R); bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.5, '#c9cdd6'); bg.addColorStop(1, '#7d8394');
    c.beginPath(); c.arc(bx, by + (v.waiting ? (v.pull || 0) * 8 * k : 0), R, 0, Math.PI * 2); c.fillStyle = bg; c.fill(); c.lineWidth = 1.6; c.strokeStyle = P.ink; c.stroke();
  }
  c.lineCap = 'butt';
  if (v.saved && now - v.saved < 1200) { c.font = `400 ${Math.max(16, Math.round(6 * k))}px 'Luckiest Guy', 'Arial Black', sans-serif`; c.fillStyle = P.paper; c.strokeStyle = P.ink; c.lineWidth = 3; c.strokeText('Ball saved!', X(45), Y(120)); c.fillText('Ball saved!', X(45), Y(120)); }
}
export function miniature(mini, final) {
  return `<div class="tpip t7" aria-label="X has lit ${fingAt(mini, 'X')}, O ${fingAt(mini, 'O')} of ${mini.lit.X.length}">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b>${mini.lit[p].map(on => `<i class="${on ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>`;   // each player's lit targets out of the seven
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = fingTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function sounds(f, add, won, mini, last) {
  fingSounds(f, add); return;   // someone else's attempt as it replays (its bounces, catches, flips), then the result
}
