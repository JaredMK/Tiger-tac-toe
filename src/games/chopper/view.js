// Chopper: the screen, the miniature, the move's words and sounds, and the inputs.
import { runWalls } from '../shared/runner.js';
import { CHOP } from './rules.js';
import { state } from '../../ui/app.js';
import { outlined, rr, runColours, runTable } from '../../ui/runner.js';
export { runnerMiniature as miniature } from '../../ui/runner.js';
export { runnerMoveText as moveText } from '../../ui/runner.js';
export { runnerSounds as sounds } from '../../ui/runner.js';

// Chopper: the cave from the side, its rock above and below (closing in from the edges in the grace
// stretch), the blocks, a sign every 100 m, and the chopper (in the player's colour): rotor turning,
// tilted with the climb; a spin and smoke when it crashes.
export function drawCave(c, W, H, sim, rd, now) {
  const P = runColours(), S = Math.min(W / 20, H / CHOP.h), Sx = S / CHOP.k, oy = (H - CHOP.h * S) / 2;   // (along the cave, Chopper's metres: CHOP.k to a metre on the screen)
  const bx = W * 0.25, toX = m => bx + (m - sim.d) * Sx, toY = y => oy + (CHOP.h - y) * S;
  c.fillStyle = '#f1e3c6'; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(138, 102, 72, .16)';                                    // far pillars drift by
  for (let k = 0; k < 6; k++) { const x = ((k * 97 - sim.d * Sx * 0.3) % (W + 80) + W + 80) % (W + 80) - 40; c.fillRect(x, 0, 16 + (k % 3) * 9, H); }
  const step = 4, roof = [], floor = [];
  for (let x = -step; x <= W + step; x += step) { const [f, cl] = runWalls(sim, sim.d + (x - bx) / Sx); roof.push([x, toY(cl)]); floor.push([x, toY(f)]); }
  for (const [edge, out] of [[roof, -6], [floor, H + 6]]) {
    c.beginPath(); c.moveTo(-step, out); edge.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(W + step, out); c.closePath(); outlined(c, '#8a6648', P.ink, 3);
  }
  c.fillStyle = 'rgba(255, 240, 210, .22)';                                   // specks in the rock, going by with it
  for (let m = Math.floor(sim.d / (3 * CHOP.k)) * 3 * CHOP.k - 9 * CHOP.k; m < sim.d + W / Sx; m += 3 * CHOP.k) { const x = toX(m), j = Math.abs(Math.sin(m * 12.9898)) ; c.fillRect(x, toY(CHOP.h - 0.3 - j * 0.6), 4, 3); c.fillRect(x + 7, toY(0.3 + j * 0.6), 4, 3); }
  for (const o of sim.course) {
    const x = toX(o.at); if (x > W + 40 || x + CHOP.bw * Sx < -40) continue;
    rr(c, x, toY(o.y + o.bh), CHOP.bw * Sx, o.bh * S, 5); outlined(c, '#9a9aa6', P.ink, 2.5);
    c.fillStyle = '#c4c4cf'; c.fillRect(x + 4, toY(o.y + o.bh) + 4, CHOP.bw * Sx * 0.3, o.bh * S * 0.25);
  }
  c.textAlign = 'center'; c.font = `bold ${Math.round(Math.max(9, S * 0.55))}px sans-serif`;
  for (let m = Math.ceil(Math.max(1, sim.d - 10 * CHOP.k) / 100) * 100; m < sim.d + W / Sx; m += 100) {   // a sign on the floor every 100 m
    const x = toX(m), y = toY(runWalls(sim, m)[0]);
    rr(c, x - 15, y - 17, 30, 14, 3); outlined(c, P.paper, P.ink, 1.5); c.fillStyle = P.ink; c.fillText(String(m), x, y - 6);
  }
  const fx = toX(sim.cfg.target);
  if (fx < W + 20) for (let k = 0; k < 20; k++) { c.fillStyle = k % 2 ? P.ink : P.paper; c.fillRect(fx - 4, k * H / 20, 8, H / 20 + 1); }
  drawChopper(c, bx, toY(sim.y), S, sim, rd, now, P);
  if (sim.done) { c.fillStyle = P.paper; c.strokeStyle = P.ink; c.lineWidth = 2.5; c.font = `bold ${Math.round(S * 1.4)}px sans-serif`; c.strokeText('FINISH!', W / 2, H * 0.3); c.fillText('FINISH!', W / 2, H * 0.3); }
}
function drawChopper(c, x, y, S, sim, rd, now, P) {
  const L = CHOP.art * S, col = sim.p === 'O' ? P.O : P.X;
  let ang = 0.08 + Math.max(-0.3, Math.min(0.3, -sim.vy / 20)), yy = y;
  if (!sim.flown && !sim.crash && !sim.done) yy += Math.sin(now / 200) * S * 0.08;
  if (sim.crash) {
    const k = rd ? Math.min(1, (now - rd.at) / 700) : 1; ang = k * 5.5;
    for (let i = 0; i < 4; i++) { c.fillStyle = `rgba(90, 80, 70, ${0.45 * (1 - k * 0.6)})`; c.beginPath(); c.arc(x - L * 0.4 - i * L * 0.35 * k, yy - i * 5 * k, L * (0.18 + 0.12 * k), 0, Math.PI * 2); c.fill(); }
  }
  c.save(); c.translate(x, yy); c.rotate(ang);
  c.strokeStyle = P.ink; c.lineCap = 'round'; c.lineWidth = Math.max(4, L * 0.14); c.beginPath(); c.moveTo(-L * 0.2, 0); c.lineTo(-L * 0.95, -L * 0.1); c.stroke();   // the tail boom
  c.strokeStyle = col; c.lineWidth = Math.max(2, L * 0.07); c.beginPath(); c.moveTo(-L * 0.2, 0); c.lineTo(-L * 0.95, -L * 0.1); c.stroke();
  const tr = now / 30; c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(-L * 0.95 + Math.cos(tr) * L * 0.15, -L * 0.1 + Math.sin(tr) * L * 0.15); c.lineTo(-L * 0.95 - Math.cos(tr) * L * 0.15, -L * 0.1 - Math.sin(tr) * L * 0.15); c.stroke();   // the tail rotor
  c.beginPath(); c.moveTo(-L * 0.3, L * 0.36); c.lineTo(L * 0.38, L * 0.36); c.moveTo(-L * 0.12, L * 0.2); c.lineTo(-L * 0.15, L * 0.36); c.moveTo(L * 0.18, L * 0.2); c.lineTo(L * 0.2, L * 0.36); c.stroke();   // the skids
  c.beginPath(); c.ellipse(0, 0, L * 0.42, L * 0.27, 0, 0, Math.PI * 2); outlined(c, col, P.ink, 2.5);
  c.beginPath(); c.ellipse(L * 0.17, -L * 0.04, L * 0.18, L * 0.15, 0, 0, Math.PI * 2); outlined(c, '#cfe9f7', P.ink, 2);   // the window
  c.strokeStyle = P.ink; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -L * 0.27); c.lineTo(0, -L * 0.4); c.stroke();
  const sw = Math.cos(now / (sim.held ? 18 : 30)); c.lineWidth = 3; c.beginPath(); c.moveTo(-L * 0.72 * sw, -L * 0.42); c.lineTo(L * 0.72 * sw, -L * 0.42); c.stroke();   // the main rotor, quicker while climbing
  c.restore();
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = runTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
