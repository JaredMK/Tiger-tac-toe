// Pinball: the screen, the miniature, the move's words and sounds, and the inputs.
import { fingAt } from '../shared/finger.js';
import { PHYSICS } from '../shared/physics.js';
import { state } from '../../ui/app.js';
import { fingSounds, fingTable } from '../../ui/finger.js';
import { outlined, rr, runColours } from '../../ui/runner.js';
export { fingerMoveText as moveText } from '../../ui/finger.js';

// Pinball: the square's table in portrait (its outline, its rails and lanes in paper with ink outlines,
// every line at one weight), the one-way gate at the lane's top (shut once the ball is out), the pop
// bumpers, the slingshots with their bands, the spinner's ring, the seven targets (lit ones in the
// player's colour, a star on them), the flippers, the plunger in its lane (pulled down as the finger
// pulls) and the ball. v.table is the square's table (physics-sim.js pinTable).
export function drawPin(c, W, H, v, now) {
  const P = runColours(), L = PHYSICS.lib, T = L.PIN, TB = v.table || L.pinTable(null), cfg = v.cfg || {};
  const k = Math.min(W / T.w, H / T.h), ox = (W - T.w * k) / 2, oy = (H - T.h * k) / 2, X = x => ox + x * k, Y = y => oy + y * k;
  const col = v.p === 'O' ? P.O : P.X, ink = Math.max(1.5, 1.1 * k), ball = v.ball, bR = T.ballR;
  c.fillStyle = '#241b38'; c.fillRect(0, 0, W, H);
  c.beginPath();                                                    // the playfield, inside the outline
  TB.outer.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); c.closePath();
  const g = c.createLinearGradient(0, oy, 0, oy + T.h * k); g.addColorStop(0, '#3d3378'); g.addColorStop(1, '#2a6f8f');
  c.fillStyle = g; c.fill();
  c.fillStyle = 'rgba(255,255,255,.06)'; for (let y = 10; y < T.h; y += 16) { c.beginPath(); c.arc(X(45), Y(y), 1.2 * k, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(X(TB.lane.x0), Y(TB.lane.top), (TB.lane.x1 - TB.lane.x0) * k, (T.h - TB.lane.top) * k);   // the lane, a shade darker
  const spinners = TB.targets.filter(t => t.spin);
  for (const tg of spinners) {                                      // a spinner's ring, and its arm
    const S = tg.spin, [sx, sy] = L.pinSpinAt(tg, v.t || 0, cfg);
    c.setLineDash([4, 5]); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(X(S.cx), Y(S.cy), S.r * k, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.arc(X(S.cx), Y(S.cy), 2 * k, 0, Math.PI * 2); outlined(c, '#58a8cf', P.ink, 2);
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(S.cx), Y(S.cy)); c.lineTo(X(sx), Y(sy)); c.stroke();
  }
  c.lineCap = 'round'; c.lineJoin = 'round';
  const rails = TB.walls.concat(v.gate ? [TB.gate] : []);           // the walls and rails (capsules: round ends), the gate once shut
  for (const [x1, y1, x2, y2, t] of rails) { c.strokeStyle = P.ink; c.lineWidth = t * k + 2 * ink; c.beginPath(); c.moveTo(X(x1), Y(y1)); c.lineTo(X(x2), Y(y2)); c.stroke(); }
  for (const [x1, y1, x2, y2, t] of rails) { c.strokeStyle = P.paper; c.lineWidth = t * k; c.beginPath(); c.moveTo(X(x1), Y(y1)); c.lineTo(X(x2), Y(y2)); c.stroke(); }
  if (!v.gate) {                                                    // the gate open: a flap hinged at the outside wall, swung up out of the way
    const [gx1, gy1, gx2, gy2, gt] = TB.gate, len = Math.hypot(gx2 - gx1, gy2 - gy1), a = Math.atan2(gy2 - gy1, gx2 - gx1) - 1.1;
    c.strokeStyle = P.ink; c.lineWidth = gt * k + 2 * ink; c.beginPath(); c.moveTo(X(gx2), Y(gy2)); c.lineTo(X(gx2 - Math.cos(a) * len * 0.8), Y(gy2 - Math.sin(a) * len * 0.8)); c.stroke();
    c.strokeStyle = '#d9d2e8'; c.lineWidth = gt * k; c.stroke();
  }
  for (const tri of TB.slings) {                                    // the slingshots: a band on the face that kicks
    c.beginPath(); tri.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); c.closePath(); outlined(c, '#58a8cf', P.ink, ink * 1.4);
    c.strokeStyle = '#fff'; c.lineWidth = Math.max(2, 0.9 * k); c.beginPath(); c.moveTo(X(tri[1][0]), Y(tri[1][1])); c.lineTo(X(tri[2][0]), Y(tri[2][1])); c.stroke();
  }
  for (const [x, y, r] of TB.bumpers) {                            // the pop bumpers: they glow as the ball is on them
    const on = ball && Math.hypot(ball[0] - x, ball[1] - y) < r + bR + 1.5;
    c.beginPath(); c.arc(X(x), Y(y), r * k, 0, Math.PI * 2); outlined(c, on ? P.O : '#4e9d3a', P.ink, ink * 1.4);
    c.beginPath(); c.arc(X(x), Y(y), r * k * 0.55, 0, Math.PI * 2); outlined(c, P.paper, P.ink, ink);
    c.fillStyle = P.X; c.beginPath(); for (let s = 0; s < 10; s++) { const a = -Math.PI / 2 + (s * Math.PI) / 5, rs = (s % 2 ? 0.16 : 0.38) * r * k; c.lineTo(X(x) + Math.cos(a) * rs, Y(y) + Math.sin(a) * rs); } c.closePath(); c.fill();
  }
  const fresh = v.flash && now - v.flash.at < 600 ? v.flash.id : -1;
  c.font = `800 ${Math.max(8, Math.round(2.4 * k))}px Nunito, Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const tg of TB.targets) {                                    // the targets: lit for this player (a glow, a star), or waiting with their number
    const [x, y] = tg.spin ? L.pinSpinAt(tg, v.t || 0, cfg) : [tg.x, tg.y], r = tg.r * k, lit = !!(v.lit && v.lit[tg.id]);
    if (lit) { c.fillStyle = tg.id === fresh ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.22)'; c.beginPath(); c.arc(X(x), Y(y), r * (tg.id === fresh ? 2.1 : 1.5), 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.arc(X(x), Y(y), r, 0, Math.PI * 2); outlined(c, lit ? col : P.paper, P.ink, ink * 1.4);
    if (lit) { c.fillStyle = P.paper; c.beginPath(); for (let s = 0; s < 10; s++) { const a = -Math.PI / 2 + (s * Math.PI) / 5, rs = (s % 2 ? 0.25 : 0.62) * r; c.lineTo(X(x) + Math.cos(a) * rs, Y(y) + Math.sin(a) * rs); } c.closePath(); c.fill(); }
    else { c.fillStyle = P.ink; c.fillText(String(tg.id + 1), X(x), Y(y) + 0.5); }
  }
  for (const side of ['L', 'R']) {                                  // the flippers, on their pivots
    const [x1, y1, x2, y2] = L.pinFlipLine(TB, side, v.flips[side === 'L' ? 0 : 1]);
    c.strokeStyle = P.ink; c.lineWidth = TB.flip.thick * k + 2 * ink; c.beginPath(); c.moveTo(X(x1), Y(y1)); c.lineTo(X(x2), Y(y2)); c.stroke();
    c.strokeStyle = col; c.lineWidth = Math.max(2, TB.flip.thick * k); c.stroke();
    c.beginPath(); c.arc(X(x1), Y(y1), 1.3 * k, 0, Math.PI * 2); outlined(c, P.paper, P.ink, ink);
  }
  const ln = TB.lane, py = ln.serve[1] + bR + 0.6 + (v.pull || 0) * 8;   // the plunger
  c.fillStyle = '#b8b2c8'; c.fillRect(X(ln.serve[0] - 0.6), Y(py), 1.2 * k, Y(T.h) - Y(py));
  c.strokeStyle = P.ink; c.lineWidth = 1.5; c.beginPath(); for (let s = 0; s <= 6; s++) { const yy = py + 2 + s * ((T.h - py - 3) / 6); c.lineTo(X(ln.serve[0] + (s % 2 ? 2 : -2)), Y(yy)); } c.stroke();
  rr(c, X(ln.serve[0] - 3), Y(py), 6 * k, 2 * k, 0.8 * k); outlined(c, P.X, P.ink, ink);
  if (ball) {                                                       // the ball: steel, with a shine
    const bx = X(ball[0]), by = Y(ball[1]) + (v.waiting ? (v.pull || 0) * 8 * k : 0), R = bR * k;
    const bg = c.createRadialGradient(bx - R * 0.35, by - R * 0.35, R * 0.1, bx, by, R); bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.5, '#c9cdd6'); bg.addColorStop(1, '#7d8394');
    c.beginPath(); c.arc(bx, by, R, 0, Math.PI * 2); c.fillStyle = bg; c.fill(); c.lineWidth = ink; c.strokeStyle = P.ink; c.stroke();
  }
  c.lineCap = 'butt'; c.lineJoin = 'miter';
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
