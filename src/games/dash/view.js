// Dash: the screen, the miniature, the move's words and sounds, and the inputs.
import { DASH_OBS } from './rules.js';
import { state } from '../../ui/app.js';
import { RUNFX, clamp01, cloud, dizzy, distSign, endK, finishFlag, hash, hitNow, impact, puff, shadow } from '../../ui/runfx.js';
import { outlined, rr, runColours, runTable } from '../../ui/runner.js';
export { runnerMiniature as miniature } from '../../ui/runner.js';
export { runnerMoveText as moveText } from '../../ui/runner.js';
export { runnerSounds as sounds } from '../../ui/runner.js';

// The view's own notes on a run (sim.fx; never the run's): when the Dasher last left the ground and landed (the dust
// there, the squash), from the frames as they are drawn.
function dashFx(sim, now) {
  const f = sim.fx || (sim.fx = { air: !!sim.air, landAt: -1e9, puffs: [] });
  if (!!sim.air !== f.air) { f.air = !!sim.air; if (!sim.crash) { f.puffs.push({ d: sim.d, at: now }); if (!sim.air) f.landAt = now; } }
  while (f.puffs.length && now - f.puffs[0].at > RUNFX.puff) f.puffs.shift();
  return f;
}
export function drawDash(c, W, H, sim, rd, now) {
  const P = runColours(), S = H / 10, gy = H * 0.82, rx = W * 0.13, toX = m => rx + (m - sim.d) * S;   // zoomed out (November 2026, again: H / 7.5 before): about 40% more of the course ahead in view
  const fx = dashFx(sim, now);
  const sky = c.createLinearGradient(0, 0, 0, gy); sky.addColorStop(0, '#bfe3f5'); sky.addColorStop(1, '#e9f6fb');
  c.fillStyle = sky; c.fillRect(-8, -8, W + 16, H + 16);
  puff(c, W * 0.82, H * 0.2, S * 1.55, 0.5, '255, 243, 176'); puff(c, W * 0.82, H * 0.2, S * 0.95, 1, '255, 243, 176');   // the sun, low on the right: the light comes from there
  // clouds and hills drift by at a fraction of the speed; the ground at full speed
  for (let k = 0; k < 4; k++) {
    const x = ((k * 173 - sim.d * S * 0.08) % (W + 120) + W + 120) % (W + 120) - 60, y = H * (0.12 + (k % 2) * 0.1);
    cloud(c, x, y, 1.06);
  }
  const hills = (speed, amp, base, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(-8, gy); for (let x = -8; x <= W + 8; x += 8) c.lineTo(x, gy - base - amp * (0.5 + 0.5 * Math.sin((x + sim.d * S * speed) / 70)) - amp * 0.4 * Math.sin((x + sim.d * S * speed) / 23)); c.lineTo(W + 8, gy); c.closePath(); c.fill(); };
  hills(0.18, 26, 46, '#b7dfbd'); hills(0.4, 18, 14, '#95cf9e');
  for (let m = Math.floor((sim.d * 0.7) / 6) * 6 - 6; m < sim.d * 0.7 + W / S + 6; m += 6) {   // bushes at the hills' foot, a little slower than the ground
    const x = rx + (m - sim.d * 0.7) * S + hash(m) * S * 2, r = S * (0.32 + 0.3 * hash(m + 0.5));
    c.fillStyle = '#7fbf8a'; c.beginPath(); c.arc(x, gy, r, Math.PI, 0); c.arc(x + r * 1.1, gy, r * 0.7, Math.PI, 0); c.fill();
  }
  c.fillStyle = '#e6c58a'; c.fillRect(-8, gy, W + 16, H - gy + 8);
  c.fillStyle = '#f0d6a3'; c.fillRect(-8, gy, W + 16, Math.max(3, S * 0.2));                         // the track's lit edge
  c.fillStyle = '#d9b574'; c.fillRect(-8, gy + (H - gy) * 0.62, W + 16, (H - gy) * 0.38 + 8);
  c.strokeStyle = P.ink; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, gy); c.lineTo(W + 8, gy); c.stroke();
  for (let m = Math.floor(sim.d / 5) * 5 - 10; m < sim.d + W / S; m += 5) {   // a tick every 5 m, a post every 100
    const x = toX(m);
    if (m > 0 && m % 100 === 0 && m < sim.cfg.target) { shadow(c, x, gy + 2, S * 0.5, S * 0.1, 0.18); c.fillStyle = '#8a6a3a'; c.fillRect(x - 2, gy - S * 1.3, 4, S * 1.3); c.strokeStyle = P.ink; c.lineWidth = 1.5; c.strokeRect(x - 2, gy - S * 1.3, 4, S * 1.3); distSign(c, x, gy - S * 1.15, String(m), Math.max(10, S * 0.5), P); }
    else { c.fillStyle = '#c9a66b'; c.fillRect(x, gy + 6, 3, 9); }
    const px = toX(m + 1.2 + hash(m) * 2.6); c.fillStyle = '#c9a66b'; c.beginPath(); c.ellipse(px, gy + (H - gy) * (0.5 + 0.3 * hash(m + 0.3)), S * 0.13, S * 0.07, 0, 0, Math.PI * 2); c.fill();   // pebbles
  }
  const fxn = toX(sim.cfg.target);
  if (fxn < W + 60) { const ch = (H - gy) / 3, cw = S * 0.3; for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { c.fillStyle = (i + j) % 2 ? P.ink : P.paper; c.fillRect(fxn - cw + i * cw, gy + 2 + j * ch, cw, ch); } finishFlag(c, fxn, gy, S * 0.9, now, P); }   // the finish: a chequered line across the track and its flag
  for (const o of sim.course) { const x = toX(o.at); if (x > -80 && x < W + 80) drawHazard(c, x, gy, S, o, now, P); }
  for (const p of fx.puffs) { const k = (now - p.at) / RUNFX.puff, x = toX(p.d); for (const s of [-1, 0, 1]) puff(c, x + s * k * S * 0.55 - S * 0.1, gy - 2 - k * S * (0.22 + 0.12 * Math.abs(s)), S * (0.11 + 0.16 * k), 0.5 * (1 - k), '150, 115, 70'); }   // dust where it took off or landed, left behind
  drawRunner(c, rx, gy, S, sim, rd, now, P, fx);
}
function drawHazard(c, x, gy, S, o, now, P) {
  const ob = DASH_OBS[o.k], w = ob.w * S, h = ob.h * S;
  if (o.k !== 'flyer') shadow(c, x + w * 0.45, gy + 2, w * 0.62, S * 0.11, 0.22);
  if (o.k === 'rock') {
    c.beginPath(); c.moveTo(x, gy); c.quadraticCurveTo(x + w * 0.1, gy - h * 1.1, x + w * 0.55, gy - h); c.quadraticCurveTo(x + w * 1.05, gy - h * 0.8, x + w, gy); c.closePath(); outlined(c, '#9a9aa6', P.ink, 2.5);
    c.fillStyle = '#7f7f8c'; c.beginPath(); c.moveTo(x + w * 0.12, gy - 1.5); c.quadraticCurveTo(x + w * 0.3, gy - h * 0.45, x + w * 0.5, gy - 1.5); c.closePath(); c.fill();   // its shaded side, away from the sun
    c.fillStyle = '#c4c4cf'; c.beginPath(); c.ellipse(x + w * 0.62, gy - h * 0.62, w * 0.17, h * 0.13, -0.4, 0, Math.PI * 2); c.fill();
  } else if (o.k === 'crate') {
    rr(c, x, gy - h, w, h, 3); outlined(c, '#c98b4b', P.ink, 2.5);
    c.fillStyle = '#a86f38'; c.fillRect(x + 2, gy - h + 2, w * 0.22, h - 4); c.fillStyle = '#dba562'; c.fillRect(x + w * 0.74, gy - h + 2, w * 0.2, h - 4);
    c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 4, gy - h + 4); c.lineTo(x + w - 4, gy - 4); c.moveTo(x + w - 4, gy - h + 4); c.lineTo(x + 4, gy - 4); c.stroke();
  } else if (o.k === 'spike') {
    for (let k = 0; k < 3; k++) { const sx = x + (k * w) / 3; c.beginPath(); c.moveTo(sx, gy); c.lineTo(sx + w / 6, gy - h); c.lineTo(sx + w / 3, gy); c.closePath(); outlined(c, '#6fa86a', P.ink, 2); c.fillStyle = '#4f8a52'; c.beginPath(); c.moveTo(sx + 1.5, gy - 1); c.lineTo(sx + w / 6, gy - h * 0.86); c.lineTo(sx + w / 6, gy - 1); c.closePath(); c.fill(); }
  } else {                                                         // a flyer: three birds, one above the other, wings flapping
    shadow(c, x + w / 2, gy + 2, w * 0.4, S * 0.07, 0.1);
    for (let k = 0; k < 3; k++) {
      const cy = gy - (ob.y + 0.3 + k * 0.7) * S, cx = x + w / 2, flap = Math.sin(now / 90 + k) * S * 0.18;
      c.strokeStyle = P.ink; c.lineWidth = 2.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - w * 0.2, cy); c.quadraticCurveTo(cx - w * 0.45, cy - S * 0.3 + flap, cx - w * 0.62, cy - S * 0.05 + flap); c.moveTo(cx + w * 0.2, cy); c.quadraticCurveTo(cx + w * 0.45, cy - S * 0.3 + flap, cx + w * 0.62, cy - S * 0.05 + flap); c.stroke();
      c.fillStyle = '#f39a3b'; c.beginPath(); c.moveTo(cx - w * 0.22, cy - S * 0.05); c.lineTo(cx - w * 0.42, cy + S * 0.02); c.lineTo(cx - w * 0.22, cy + S * 0.08); c.closePath(); c.fill(); c.lineWidth = 1.5; c.stroke();   // the beak, towards the Dasher (orange, as the Dasher's: a hazard never in a player's colour)
      c.beginPath(); c.ellipse(cx, cy, w * 0.26, S * 0.17, 0, 0, Math.PI * 2); outlined(c, '#5a4a9a', P.ink, 2);
      c.fillStyle = P.paper; c.beginPath(); c.arc(cx - w * 0.12, cy - S * 0.04, S * 0.05, 0, Math.PI * 2); c.fill();
    }
  }
}
// The Dasher: a round runner with a scarf, stubby legs pumping with the distance; stretched as it leaves the ground,
// tucked in a jump, squashed as it lands (its shadow on the track under it, smaller the higher it is); a tumble, a
// burst and stars round its head when it crashes; a leap of joy at the finish.
function drawRunner(c, rx, gy, S, sim, rd, now, P, fx) {
  const R = S * 0.42, y = gy - sim.y * S - R - S * 0.12;
  const hop = sim.done && rd ? -Math.abs(Math.sin((now - rd.at) / 160)) * S * 0.6 : 0, up = clamp01((sim.y - hop / S) / 3);
  shadow(c, rx, gy + 2, R * (1.15 - 0.5 * up), S * (0.11 - 0.04 * up), 0.24 - 0.1 * up);
  c.save();
  let ang = 0, drop = 0, k = 0;
  if (sim.crash) { k = endK(rd, now, 700); ang = k * 2.6; drop = k * R * 0.5;
    if (rd) for (let i = 0; i < 4; i++) puff(c, rx - R * 0.6 - i * R * 0.5 * k, gy - 4 - i * 3 * k, R * (0.25 + 0.15 * k), 0.5 * (1 - k), '120, 90, 50'); }
  const sq = sim.crash || sim.done ? 0 : (1 - clamp01((now - fx.landAt) / RUNFX.squash)) * 0.2 - (sim.air ? clamp01(Math.abs(sim.vy) / 8) * 0.12 : 0);   // squashed on landing, stretched in the air
  c.translate(rx, gy - sim.y * S + hop); c.scale(1 + sq, 1 - sq); c.translate(0, y - gy + sim.y * S + drop); c.rotate(ang);
  const phase = sim.d * 2.4, onGround = !sim.air && !sim.crash, legA = onGround ? Math.sin(phase) : 0.5, legB = onGround ? Math.sin(phase + Math.PI) : 0.5;
  c.strokeStyle = P.ink; c.lineWidth = 3.5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-R * 0.3, R * 0.6); c.lineTo(-R * 0.3 + legA * R * 0.5, R * 1.15 - Math.max(0, legA) * R * 0.2); c.moveTo(R * 0.3, R * 0.6); c.lineTo(R * 0.3 + legB * R * 0.5, R * 1.15 - Math.max(0, legB) * R * 0.2); c.stroke();
  const cape = sim.p === 'O' ? P.O : P.X, wave = Math.sin(now / 70) * R * 0.25, flick = Math.sin(now / 55) * R * 0.3;   // the cape, in the runner's colour (X red, O yellow), streams behind
  c.beginPath(); c.moveTo(-R * 0.2, -R * 0.75); c.quadraticCurveTo(-R * 1.4, -R * 0.9 + wave, -R * 2.3, -R * 0.35 + flick);
  c.lineTo(-R * 2.1, R * 0.1 + flick * 0.6); c.lineTo(-R * 2.35, R * 0.45 + wave); c.quadraticCurveTo(-R * 1.3, R * 0.55 + wave * 0.5, -R * 0.35, R * 0.2); c.closePath();
  outlined(c, cape, P.ink, 2.5);
  c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); outlined(c, '#f39a3b', P.ink, 3);
  c.fillStyle = '#ffd39a'; c.beginPath(); c.arc(R * 0.15, R * 0.15, R * 0.6, 0, Math.PI * 2); c.fill();
  if (sim.crash) { c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); for (const ex of [R * 0.3, R * 0.65]) { c.moveTo(ex - R * 0.1, -R * 0.25); c.lineTo(ex + R * 0.1, -R * 0.05); c.moveTo(ex + R * 0.1, -R * 0.25); c.lineTo(ex - R * 0.1, -R * 0.05); } c.stroke(); }   // crossed eyes
  else { c.fillStyle = P.ink; c.beginPath(); c.arc(R * 0.3, -R * 0.15, R * 0.11, 0, Math.PI * 2); c.arc(R * 0.65, -R * 0.15, R * 0.11, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); if (sim.crash) c.arc(R * 0.5, R * 0.38, R * 0.18, Math.PI + 0.3, -0.3); else c.arc(R * 0.5, R * 0.15, R * 0.22, 0.2, Math.PI - 0.2); c.stroke();
  c.beginPath(); c.moveTo(-R * 0.1, -R * 0.95); c.quadraticCurveTo(-R * 0.4, -R * 1.5, R * 0.1, -R * 1.35); c.lineWidth = 3; c.stroke();   // a tuft
  c.restore();
  if (sim.crash) { if (hitNow(sim)) impact(c, rx + R * 0.9, y, R * 1.7, rd, now, P); if (k > 0.55) dizzy(c, rx, y + drop - R * 1.5, R * 1.1, now, P); }
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = runTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
