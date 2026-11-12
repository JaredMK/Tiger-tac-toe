// Chopper: the screen, the miniature, the move's words and sounds, and the inputs.
import { runWalls } from '../shared/runner.js';
import { CHOP } from './rules.js';
import { state } from '../../ui/app.js';
import { clamp01, distSign, endK, finishFlag, hash, hitNow, impact, puff } from '../../ui/runfx.js';
import { outlined, rr, runColours, runTable } from '../../ui/runner.js';
export { runnerMiniature as miniature } from '../../ui/runner.js';
export { runnerMoveText as moveText } from '../../ui/runner.js';
export { runnerSounds as sounds } from '../../ui/runner.js';

// Chopper: the cave from the side, its rock above and below (closing in from the edges in the grace
// stretch; lit along its edge by the chopper's lamp), the blocks, a sign every 100 m, and the chopper (in
// the player's colour): rotor turning, tilted with the climb, its wash under it while it climbs; a burst,
// a spin and smoke when it crashes.
export function drawCave(c, W, H, sim, rd, now) {
  const P = runColours(), S = Math.min(W / 20, H / CHOP.h), Sx = S / CHOP.k, oy = (H - CHOP.h * S) / 2;   // (along the cave, Chopper's metres: CHOP.k to a metre on the screen)
  const bx = W * 0.25, toX = m => bx + (m - sim.d) * Sx, toY = y => oy + (CHOP.h - y) * S, cy = toY(sim.y);
  const back = c.createLinearGradient(0, 0, 0, H); back.addColorStop(0, '#e6d3b0'); back.addColorStop(0.5, '#f4e8cf'); back.addColorStop(1, '#e6d3b0');
  c.fillStyle = back; c.fillRect(-8, -8, W + 16, H + 16);
  c.fillStyle = 'rgba(138, 102, 72, .16)';                                    // far pillars drift by
  for (let k = 0; k < 6; k++) { const x = ((k * 97 - sim.d * Sx * 0.3) % (W + 80) + W + 80) % (W + 80) - 40; c.fillRect(x, -8, 16 + (k % 3) * 9, H + 16); }
  if (!sim.crash) { const beam = c.createLinearGradient(bx, 0, bx + S * 9, 0); beam.addColorStop(0, 'rgba(255, 250, 220, .75)'); beam.addColorStop(1, 'rgba(255, 250, 220, 0)'); c.fillStyle = beam; c.beginPath(); c.moveTo(bx + S * 0.5, cy); c.lineTo(bx + S * 9, cy - S * 2.4); c.lineTo(bx + S * 9, cy + S * 2.8); c.closePath(); c.fill(); }   // its lamp, lighting the way ahead
  const step = 4, roof = [], floor = [];
  for (let x = -step * 3; x <= W + step * 3; x += step) { const [f, cl] = runWalls(sim, sim.d + (x - bx) / Sx); roof.push([x, toY(cl)]); floor.push([x, toY(f)]); }
  for (const [edge, out] of [[roof, -14], [floor, H + 14]]) {
    const path = () => { c.beginPath(); c.moveTo(-step * 3, out); edge.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(W + step * 3, out); c.closePath(); };
    const line = () => { c.beginPath(); edge.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x, y)); };
    path(); c.fillStyle = '#74543a'; c.fill();
    c.save(); path(); c.clip(); c.lineJoin = 'round';
    line(); c.strokeStyle = '#8a6648'; c.lineWidth = S * 2.6; c.stroke();     // the rock nearer the cave, lighter
    line(); c.strokeStyle = '#a57f5c'; c.lineWidth = Math.max(8, S * 0.7); c.stroke();   // and its lit edge
    c.restore();
    path(); c.lineWidth = 3; c.strokeStyle = P.ink; c.stroke();
  }
  c.fillStyle = 'rgba(255, 240, 210, .22)';                                   // specks in the rock, going by with it
  for (let m = Math.floor(sim.d / (3 * CHOP.k)) * 3 * CHOP.k - 9 * CHOP.k; m < sim.d + W / Sx; m += 3 * CHOP.k) { const x = toX(m), j = Math.abs(Math.sin(m * 12.9898)); c.fillRect(x, toY(CHOP.h - 0.3 - j * 0.6), 4, 3); c.fillRect(x + 7, toY(0.3 + j * 0.6), 4, 3); }
  for (const o of sim.course) {                                               // a block: a boulder wedged in the cave, lit from the chopper's side
    const x = toX(o.at), w = CHOP.bw * Sx, h = o.bh * S, y = toY(o.y + o.bh); if (x > W + 40 || x + w < -40) continue;
    rr(c, x, y, w, h, Math.min(6, w * 0.3)); outlined(c, '#9a9aa6', P.ink, 2.5);
    c.save(); rr(c, x + 1.5, y + 1.5, w - 3, h - 3, Math.min(5, w * 0.25)); c.clip();
    c.fillStyle = '#7f7f8c'; c.fillRect(x + w * 0.62, y, w * 0.4, h); c.fillRect(x, y + h - Math.min(h * 0.22, 6), w, h);
    c.fillStyle = '#c4c4cf'; c.fillRect(x + 3, y + 3, w * 0.3, Math.min(h * 0.25, 9));
    c.strokeStyle = 'rgba(22, 18, 16, .45)'; c.lineWidth = 1.5; c.beginPath(); const q = hash(o.at); c.moveTo(x + w * (0.3 + 0.3 * q), y + h * 0.35); c.lineTo(x + w * 0.5, y + h * 0.55); c.lineTo(x + w * (0.35 + 0.3 * q), y + h * 0.8); c.stroke();   // a crack
    c.restore();
  }
  for (let m = Math.ceil(Math.max(1, sim.d - 10 * CHOP.k) / 100) * 100; m < Math.min(sim.cfg.target - 1, sim.d + W / Sx); m += 100) distSign(c, toX(m), toY(runWalls(sim, m)[0]) - 3, String(m), Math.max(9, S * 0.55), P);   // a sign on the floor every 100 m
  const fxn = toX(sim.cfg.target);
  if (fxn < W + 20) { for (let k = 0; k < 20; k++) { c.fillStyle = k % 2 ? P.ink : P.paper; c.fillRect(fxn - 4, k * H / 20, 8, H / 20 + 1); } c.strokeStyle = P.ink; c.lineWidth = 1.5; c.strokeRect(fxn - 4, -2, 8, H + 4); finishFlag(c, fxn + 4, toY(runWalls(sim, sim.cfg.target)[0]) + 2, S * 0.75, now, P); }
  drawChopper(c, bx, cy, S, sim, rd, now, P);
}
function drawChopper(c, x, y, S, sim, rd, now, P) {
  const L = CHOP.art * S, col = sim.p === 'O' ? P.O : P.X, k = sim.crash ? endK(rd, now, 700) : 0;
  let ang = 0.08 + Math.max(-0.3, Math.min(0.3, -sim.vy / 20)), yy = y;
  if (!sim.flown && !sim.crash && !sim.done) yy += Math.sin(now / 200) * S * 0.08;
  if (sim.held && !sim.crash && !sim.done) for (let i = 0; i < 3; i++) { const q = (now / 300 + i / 3) % 1; puff(c, x - L * 0.1 + (i - 1) * L * 0.22, yy + L * (0.5 + 0.75 * q), L * (0.07 + 0.07 * q), 0.5 * (1 - q), '255, 255, 255'); }   // the rotor's wash under it while it climbs
  if (sim.crash) {
    ang = k * 5.5;
    for (let i = 0; i < 4; i++) puff(c, x - L * 0.4 - i * L * 0.35 * k, yy - i * 5 * k, L * (0.18 + 0.12 * k), 0.45 * (1 - k * 0.6), '90, 80, 70');
    if (rd && hitNow(sim)) for (let i = 0; i < 4; i++) {                   // bits flung off it
      const a = -2.4 + i * 1.3, d = L * (0.4 + 1.9 * k);
      c.save(); c.translate(x + Math.cos(a) * d, yy + Math.sin(a) * d + k * k * L * 1.1); c.rotate(a + k * 9); c.globalAlpha = 1 - clamp01(k * 1.1) ** 2;
      c.strokeStyle = P.ink; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(-L * 0.16, 0); c.lineTo(L * 0.16, 0); c.stroke(); c.restore();
    }
  }
  c.save(); c.translate(x, yy); c.rotate(ang);
  c.strokeStyle = P.ink; c.lineCap = 'round'; c.lineWidth = Math.max(4, L * 0.14); c.beginPath(); c.moveTo(-L * 0.2, 0); c.lineTo(-L * 0.95, -L * 0.1); c.stroke();   // the tail boom
  c.strokeStyle = col; c.lineWidth = Math.max(2, L * 0.07); c.beginPath(); c.moveTo(-L * 0.2, 0); c.lineTo(-L * 0.95, -L * 0.1); c.stroke();
  const tr = now / 30; c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(-L * 0.95 + Math.cos(tr) * L * 0.15, -L * 0.1 + Math.sin(tr) * L * 0.15); c.lineTo(-L * 0.95 - Math.cos(tr) * L * 0.15, -L * 0.1 - Math.sin(tr) * L * 0.15); c.stroke();   // the tail rotor
  c.beginPath(); c.moveTo(-L * 0.3, L * 0.36); c.lineTo(L * 0.38, L * 0.36); c.moveTo(-L * 0.12, L * 0.2); c.lineTo(-L * 0.15, L * 0.36); c.moveTo(L * 0.18, L * 0.2); c.lineTo(L * 0.2, L * 0.36); c.stroke();   // the skids
  c.beginPath(); c.ellipse(0, 0, L * 0.42, L * 0.27, 0, 0, Math.PI * 2); outlined(c, col, P.ink, 2.5);
  c.fillStyle = 'rgba(22, 18, 16, .16)'; c.beginPath(); c.ellipse(-L * 0.04, L * 0.12, L * 0.34, L * 0.12, 0, 0, Math.PI); c.fill();   // its underside, in shade
  c.beginPath(); c.ellipse(L * 0.17, -L * 0.04, L * 0.18, L * 0.15, 0, 0, Math.PI * 2); outlined(c, '#cfe9f7', P.ink, 2);   // the window
  c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(L * 0.22, -L * 0.09, L * 0.05, L * 0.03, -0.5, 0, Math.PI * 2); c.fill();
  c.strokeStyle = P.ink; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -L * 0.27); c.lineTo(0, -L * 0.4); c.stroke();
  if (!sim.crash) { c.fillStyle = 'rgba(22, 18, 16, .13)'; c.beginPath(); c.ellipse(0, -L * 0.42, L * 0.74, L * 0.07, 0, 0, Math.PI * 2); c.fill(); }   // the rotor's blur
  const sw = Math.cos(now / (sim.held ? 18 : 30)); c.strokeStyle = P.ink; c.lineWidth = 3; c.beginPath(); c.moveTo(-L * 0.72 * sw, -L * 0.42); c.lineTo(L * 0.72 * sw, -L * 0.42); c.stroke();   // the main rotor, quicker while climbing
  c.restore();
  if (sim.crash && hitNow(sim)) impact(c, x + L * 0.2, y, L * 0.95, rd, now, P);
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = runTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
