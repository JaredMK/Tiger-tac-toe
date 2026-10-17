// Dash: the screen, the miniature, the move's words and sounds, and the inputs.
import { DASH_OBS } from './rules.js';
import { state } from '../../ui/app.js';
import { outlined, rr, runColours, runTable } from '../../ui/runner.js';
export { runnerMiniature as miniature } from '../../ui/runner.js';
export { runnerMoveText as moveText } from '../../ui/runner.js';
export { runnerSounds as sounds } from '../../ui/runner.js';

export function drawDash(c, W, H, sim, rd, now) {
  const P = runColours(), S = H / 7.5, gy = H * 0.8, rx = W * 0.18, toX = m => rx + (m - sim.d) * S;   // zoomed out: more of the course ahead in view
  c.fillStyle = '#cfe9f7'; c.fillRect(0, 0, W, H);
  // clouds and hills drift by at a fraction of the speed; the ground at full speed
  c.fillStyle = '#ffffff';
  for (let k = 0; k < 4; k++) { const x = ((k * 173 - sim.d * S * 0.08) % (W + 120) + W + 120) % (W + 120) - 60, y = H * (0.12 + (k % 2) * 0.1); c.beginPath(); c.ellipse(x, y, 34, 13, 0, 0, Math.PI * 2); c.ellipse(x + 22, y - 6, 22, 12, 0, 0, Math.PI * 2); c.fill(); }
  const hills = (speed, amp, base, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, gy); for (let x = 0; x <= W; x += 8) c.lineTo(x, gy - base - amp * (0.5 + 0.5 * Math.sin((x + sim.d * S * speed) / 70)) - amp * 0.4 * Math.sin((x + sim.d * S * speed) / 23)); c.lineTo(W, gy); c.closePath(); c.fill(); };
  hills(0.18, 26, 46, '#b7dfbd'); hills(0.4, 18, 14, '#95cf9e');
  c.fillStyle = '#e6c58a'; c.fillRect(0, gy, W, H - gy);
  c.strokeStyle = P.ink; c.lineWidth = 3; c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.stroke();
  for (let m = Math.floor(sim.d / 5) * 5 - 10; m < sim.d + W / S; m += 5) {   // a tick every 5 m, a post every 100
    const x = toX(m);
    if (m > 0 && m % 100 === 0) { c.fillStyle = '#8a6a3a'; c.fillRect(x - 2, gy - S * 1.3, 4, S * 1.3); rr(c, x - 16, gy - S * 1.5, 32, 16, 4); outlined(c, P.paper, P.ink, 2); c.fillStyle = P.ink; c.font = `bold ${Math.max(9, S * 0.26)}px sans-serif`; c.textAlign = 'center'; c.fillText(String(m), x, gy - S * 1.5 + 12); }
    else { c.fillStyle = '#c9a66b'; c.fillRect(x, gy + 6, 3, 9); }
  }
  for (const o of sim.course) { const x = toX(o.at); if (x > -80 && x < W + 80) drawHazard(c, x, gy, S, o, now, P); }
  const fx = toX(sim.cfg.target);
  if (fx < W + 40) { for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? P.ink : P.paper; c.fillRect(fx - 4, gy - S * 2.4 + k * S * 0.3, 8, S * 0.3); } c.fillStyle = P.X; rr(c, fx + 4, gy - S * 2.4, S * 0.9, S * 0.5, 3); outlined(c, P.X, P.ink, 2); }
  drawRunner(c, rx, gy, S, sim, rd, now, P);
}
function drawHazard(c, x, gy, S, o, now, P) {
  const ob = DASH_OBS[o.k], w = ob.w * S, h = ob.h * S;
  if (o.k === 'rock') { c.beginPath(); c.moveTo(x, gy); c.quadraticCurveTo(x + w * 0.1, gy - h * 1.1, x + w * 0.55, gy - h); c.quadraticCurveTo(x + w * 1.05, gy - h * 0.8, x + w, gy); c.closePath(); outlined(c, '#9a9aa6', P.ink, 2.5); c.fillStyle = '#c4c4cf'; c.beginPath(); c.ellipse(x + w * 0.45, gy - h * 0.6, w * 0.18, h * 0.14, -0.4, 0, Math.PI * 2); c.fill(); }
  else if (o.k === 'crate') { rr(c, x, gy - h, w, h, 3); outlined(c, '#c98b4b', P.ink, 2.5); c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 4, gy - h + 4); c.lineTo(x + w - 4, gy - 4); c.moveTo(x + w - 4, gy - h + 4); c.lineTo(x + 4, gy - 4); c.stroke(); }
  else if (o.k === 'spike') { for (let k = 0; k < 3; k++) { const sx = x + (k * w) / 3; c.beginPath(); c.moveTo(sx, gy); c.lineTo(sx + w / 6, gy - h); c.lineTo(sx + w / 3, gy); c.closePath(); outlined(c, '#6fa86a', P.ink, 2); } }
  else {                                                         // a flyer: three birds, one above the other, wings flapping
    for (let k = 0; k < 3; k++) {
      const cy = gy - (ob.y + 0.3 + k * 0.7) * S, cx = x + w / 2, flap = Math.sin(now / 90 + k) * S * 0.18;
      c.beginPath(); c.ellipse(cx, cy, w * 0.26, S * 0.17, 0, 0, Math.PI * 2); outlined(c, '#5a4a9a', P.ink, 2);
      c.strokeStyle = P.ink; c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx - w * 0.2, cy); c.quadraticCurveTo(cx - w * 0.45, cy - S * 0.3 + flap, cx - w * 0.62, cy - S * 0.05 + flap); c.moveTo(cx + w * 0.2, cy); c.quadraticCurveTo(cx + w * 0.45, cy - S * 0.3 + flap, cx + w * 0.62, cy - S * 0.05 + flap); c.stroke();
      c.fillStyle = P.O; c.beginPath(); c.moveTo(cx + w * 0.26, cy); c.lineTo(cx + w * 0.38, cy + S * 0.04); c.lineTo(cx + w * 0.26, cy + S * 0.08); c.closePath(); c.fill();
    }
  }
}
// The Dasher: a round runner with a scarf, stubby legs pumping with the distance; tucked in a jump; a
// tumble when it crashes; a leap of joy at the finish.
function drawRunner(c, rx, gy, S, sim, rd, now, P) {
  const R = S * 0.42, y = gy - sim.y * S - R - S * 0.12;
  c.save();
  let ang = 0, drop = 0;
  if (sim.crash) { const k = rd ? Math.min(1, (now - rd.at) / 700) : 1; ang = k * 2.6; drop = k * R * 0.5;
    if (rd) for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(120, 90, 50, ' + (0.5 * (1 - k)) + ')'; c.beginPath(); c.arc(rx - R * 0.6 - i * R * 0.5 * k, gy - 4 - i * 3 * k, R * (0.25 + 0.15 * k), 0, Math.PI * 2); c.fill(); } }
  const hop = sim.done && rd ? -Math.abs(Math.sin((now - rd.at) / 160)) * S * 0.6 : 0;
  c.translate(rx, y + drop + hop); c.rotate(ang);
  const phase = sim.d * 2.4, onGround = !sim.air && !sim.crash, legA = onGround ? Math.sin(phase) : 0.5, legB = onGround ? Math.sin(phase + Math.PI) : 0.5;
  c.strokeStyle = P.ink; c.lineWidth = 3.5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-R * 0.3, R * 0.6); c.lineTo(-R * 0.3 + legA * R * 0.5, R * 1.15 - Math.max(0, legA) * R * 0.2); c.moveTo(R * 0.3, R * 0.6); c.lineTo(R * 0.3 + legB * R * 0.5, R * 1.15 - Math.max(0, legB) * R * 0.2); c.stroke();
  const cape = sim.p === 'O' ? P.O : P.X, wave = Math.sin(now / 70) * R * 0.25, flick = Math.sin(now / 55) * R * 0.3;   // the cape, in the runner's colour (X red, O yellow), streams behind
  c.beginPath(); c.moveTo(-R * 0.2, -R * 0.75); c.quadraticCurveTo(-R * 1.4, -R * 0.9 + wave, -R * 2.3, -R * 0.35 + flick);
  c.lineTo(-R * 2.1, R * 0.1 + flick * 0.6); c.lineTo(-R * 2.35, R * 0.45 + wave); c.quadraticCurveTo(-R * 1.3, R * 0.55 + wave * 0.5, -R * 0.35, R * 0.2); c.closePath();
  outlined(c, cape, P.ink, 2.5);
  c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); outlined(c, '#f39a3b', P.ink, 3);
  c.fillStyle = '#ffd39a'; c.beginPath(); c.arc(R * 0.15, R * 0.15, R * 0.6, 0, Math.PI * 2); c.fill();
  c.fillStyle = P.ink; c.beginPath(); c.arc(R * 0.3, -R * 0.15, R * 0.11, 0, Math.PI * 2); c.arc(R * 0.65, -R * 0.15, R * 0.11, 0, Math.PI * 2); c.fill();
  c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); c.arc(R * 0.5, R * 0.15, R * 0.22, 0.2, Math.PI - 0.2); c.stroke();
  c.beginPath(); c.moveTo(-R * 0.1, -R * 0.95); c.quadraticCurveTo(-R * 0.4, -R * 1.5, R * 0.1, -R * 1.35); c.lineWidth = 3; c.stroke();   // a tuft
  c.restore();
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = runTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
