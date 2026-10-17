// Flap: the screen, the miniature, the move's words and sounds, and the inputs.
import { FLAP } from './rules.js';
import { state } from '../../ui/app.js';
import { outlined, rr, runColours, runTable } from '../../ui/runner.js';
export { runnerMiniature as miniature } from '../../ui/runner.js';
export { runnerMoveText as moveText } from '../../ui/runner.js';
export { runnerSounds as sounds } from '../../ui/runner.js';

// Flap: the sky from the side, the posts with their gaps, the ground with its distance marks, and the
// bird (in the player's colour): its wing up just after a flap, nose up climbing and down falling; a bob
// while it holds its height before the first tap; a tumble to the ground when it crashes.
export function drawFlap(c, W, H, sim, rd, now) {
  const P = runColours(), gh = Math.max(16, H * 0.09), S = Math.min(W / 16, (H - gh) / FLAP.h), gy = H - gh;
  const bx = W * 0.27, toX = m => bx + (m - sim.d) * S, toY = y => gy - y * S;
  const sky = c.createLinearGradient(0, 0, 0, gy); sky.addColorStop(0, '#9fd3ef'); sky.addColorStop(1, '#e4f4fb');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  c.fillStyle = '#ffffff';                                                     // clouds drift by, slowly
  for (let k = 0; k < 5; k++) { const x = ((k * 151 - sim.d * S * 0.12) % (W + 140) + W + 140) % (W + 140) - 70, y = gy * (0.12 + (k % 3) * 0.16); c.beginPath(); c.ellipse(x, y, 30, 11, 0, 0, Math.PI * 2); c.ellipse(x + 20, y - 6, 20, 10, 0, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#bfe3c4'; c.beginPath(); c.moveTo(0, gy);                    // hills, a little faster
  for (let x = 0; x <= W; x += 8) c.lineTo(x, gy - S * 1.2 - S * 0.9 * (0.5 + 0.5 * Math.sin((x + sim.d * S * 0.3) / 60)));
  c.lineTo(W, gy); c.closePath(); c.fill();
  for (const o of sim.course) { const x = toX(o.at); if (x < W + 40 && x + FLAP.post * S > -40) drawPost(c, x, o, S, toY, gy, P); }
  c.fillStyle = '#e6c58a'; c.fillRect(0, gy, W, H - gy);
  c.strokeStyle = P.ink; c.lineWidth = 3; c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.stroke();
  c.textAlign = 'center';
  for (let m = Math.floor(sim.d / 5) * 5 - 10; m < sim.d + W / S; m += 5) {    // a tick every 5 m, the number every 100
    const x = toX(m);
    if (m > 0 && m % 100 === 0) { c.fillStyle = P.ink; c.font = `bold ${Math.round(Math.max(10, gh * 0.55))}px sans-serif`; c.fillText(String(m), x, gy + gh * 0.72); }
    else { c.fillStyle = '#c9a66b'; c.fillRect(x, gy + 4, 3, Math.max(3, gh * 0.35)); }
  }
  const fx = toX(sim.cfg.target);                                              // the finish: a chequered pole up to the sky
  if (fx < W + 40) for (let k = 0; k < 16; k++) { c.fillStyle = k % 2 ? P.ink : P.paper; c.fillRect(fx - 4, gy - (k + 1) * gy / 16, 8, gy / 16 + 1); }
  let y = sim.y;
  if (sim.crash && rd) { const k = Math.min(1, (now - rd.at) / 700); y = sim.y + (FLAP.box.h / 2 - sim.y) * k * k; }   // the fall after a post
  drawBird(c, bx, toY(y), S, sim, rd, now, P);
  if (sim.done) { c.fillStyle = P.paper; c.strokeStyle = P.ink; c.lineWidth = 2.5; c.font = `bold ${Math.round(S * 1.2)}px sans-serif`; c.strokeText('FINISH!', W / 2, H * 0.3); c.fillText('FINISH!', W / 2, H * 0.3); }
}
// A post: wooden, banded, with a teal cap on each side of the gap.
function drawPost(c, x, o, S, toY, gy, P) {
  const w = FLAP.post * S, top = toY(o.gy + o.gh / 2), bot = toY(o.gy - o.gh / 2), cap = Math.max(7, S * 0.42);
  for (const [y0, y1] of [[-12, top], [bot, gy + 2]]) {
    if (y1 - y0 < 1) continue;
    rr(c, x, y0, w, y1 - y0, 3); outlined(c, '#d9a066', P.ink, 2.5);
    c.fillStyle = 'rgba(140, 80, 35, .3)';
    for (let yy = y0 + 8; yy < y1 - 6; yy += 15) c.fillRect(x + 3, yy, w - 6, 4);
  }
  rr(c, x - 4, top - cap, w + 8, cap, 4); outlined(c, '#21b2a6', P.ink, 2.5);
  rr(c, x - 4, bot, w + 8, cap, 4); outlined(c, '#21b2a6', P.ink, 2.5);
}
function drawBird(c, x, y, S, sim, rd, now, P) {
  const R = FLAP.art * S / 2, col = sim.p === 'O' ? P.O : P.X;
  let ang = Math.max(-0.45, Math.min(1.0, -sim.vy / 10)), yy = y;
  if (!sim.flown && !sim.crash && !sim.done) yy += Math.sin(now / 160) * S * 0.12;
  if (sim.crash) ang = 1.2 + (rd ? Math.min(1, (now - rd.at) / 700) : 1) * 1.6;
  c.save(); c.translate(x, yy); c.rotate(ang);
  c.beginPath(); c.moveTo(-R * 0.8, 0); c.lineTo(-R * 1.45, -R * 0.45); c.lineTo(-R * 1.3, R * 0.08); c.lineTo(-R * 1.5, R * 0.45); c.closePath(); outlined(c, col, P.ink, 2);   // tail
  c.beginPath(); c.ellipse(0, 0, R, R * 0.86, 0, 0, Math.PI * 2); outlined(c, col, P.ink, 2.5);
  c.fillStyle = 'rgba(255, 255, 255, .55)'; c.beginPath(); c.ellipse(R * 0.1, R * 0.38, R * 0.55, R * 0.32, 0, 0, Math.PI * 2); c.fill();   // belly
  c.beginPath(); c.moveTo(R * 0.8, -R * 0.14); c.lineTo(R * 1.4, R * 0.08); c.lineTo(R * 0.8, R * 0.3); c.closePath(); outlined(c, '#f39a3b', P.ink, 2);   // beak
  if (sim.crash) { c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(R * 0.3, -R * 0.45); c.lineTo(R * 0.6, -R * 0.15); c.moveTo(R * 0.6, -R * 0.45); c.lineTo(R * 0.3, -R * 0.15); c.stroke(); }
  else { c.fillStyle = '#fff'; c.beginPath(); c.arc(R * 0.42, -R * 0.3, R * 0.26, 0, Math.PI * 2); c.fill(); c.strokeStyle = P.ink; c.lineWidth = 1.5; c.stroke(); c.fillStyle = P.ink; c.beginPath(); c.arc(R * 0.5, -R * 0.3, R * 0.12, 0, Math.PI * 2); c.fill(); }
  const up = sim.crash ? 0.2 : !sim.flown ? 0.5 + 0.5 * Math.sin(now / 60) : Math.max(0, Math.min(1, sim.vy / FLAP.vy));   // the wing: up after a flap
  c.beginPath(); c.moveTo(-R * 0.4, R * 0.05); c.quadraticCurveTo(-R * 0.15, -R * (0.25 + up * 1.15), R * 0.3, -R * 0.05 - up * R * 0.55); c.quadraticCurveTo(R * 0.05, R * 0.3, -R * 0.4, R * 0.05); c.closePath(); outlined(c, 'rgba(255, 255, 255, .9)', P.ink, 2);
  c.restore();
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = runTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
