// Lane Rush: the screen, the miniature, the move's words and sounds, and the inputs.
import { runLaneX } from '../shared/runner.js';
import { LANE } from './rules.js';
import { state } from '../../ui/app.js';
import { outlined, rr, runColours, runTable } from '../../ui/runner.js';
export { runnerMiniature as miniature } from '../../ui/runner.js';
export { runnerMoveText as moveText } from '../../ui/runner.js';
export { runnerSounds as sounds } from '../../ui/runner.js';

const TRAFFIC = ['#7fc8f0', '#a9b4c4', '#f7f3e6', '#9ad88a', '#d8a0e8'];   // (no yellow or red: those are the players' cars)
export function drawLane(c, W, H, sim, rd, now) {
  const P = runColours(), road = { x: W * 0.1, w: W * 0.8 }, laneW = road.w / 3, S = H / 40, cy = H * 0.87, toY = m => cy - (m - sim.d) * S;   // the car low in a tall scene: about 35 m of road ahead in sight
  c.fillStyle = '#95cf9e'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#6d8a5a';                                                     // trees along the verges, going by
  for (let k = -1; k < 12; k++) { const yy = ((k * H) / 9 + sim.d * S) % (H + 40) - 20; for (const tx of [W * 0.04, W * 0.96]) { c.beginPath(); c.arc(tx, yy, W * 0.035, 0, Math.PI * 2); c.fill(); } }
  c.fillStyle = '#5b5b66'; c.fillRect(road.x, 0, road.w, H);
  c.fillStyle = P.O; for (let k = -1; k < 20; k++) { const yy = ((k * S * 4 + sim.d * S) % (H + S * 4)) - S * 2; if (k % 2) continue; c.fillRect(road.x - 7, yy, 7, S * 4); c.fillRect(road.x + road.w, yy, 7, S * 4); }
  c.fillStyle = P.X; for (let k = -1; k < 20; k++) { const yy = ((k * S * 4 + sim.d * S) % (H + S * 4)) - S * 2; if (!(k % 2)) continue; c.fillRect(road.x - 7, yy, 7, S * 4); c.fillRect(road.x + road.w, yy, 7, S * 4); }
  c.strokeStyle = '#f7f3e6'; c.lineWidth = 3; c.setLineDash([S * 2, S * 2]); c.lineDashOffset = -((sim.d * S) % (S * 4));
  for (let l = 1; l < 3; l++) { c.beginPath(); c.moveTo(road.x + l * laneW, 0); c.lineTo(road.x + l * laneW, H); c.stroke(); }
  c.setLineDash([]);
  const fy = toY(sim.cfg.target);
  if (fy > -S * 2) for (let k = 0; k < 12; k++) for (let j = 0; j < 2; j++) { c.fillStyle = (k + j) % 2 ? P.ink : P.paper; c.fillRect(road.x + (k * road.w) / 12, fy - S * 1.2 + j * S * 0.6, road.w / 12, S * 0.6); }
  for (const o of sim.course) { const y = toY(o.at); if (y < -S * 3 || y > H + S * 3) continue; o.cars.forEach((car, l) => { if (car) drawCar(c, road.x + (l + 0.5) * laneW, y, laneW, S, TRAFFIC[Math.floor(o.at * 7 + l) % TRAFFIC.length], 0, P); }); }
  const x = road.x + (runLaneX(sim) + 0.5) * laneW, spin = sim.crash ? (rd ? Math.min(1, (now - rd.at) / 700) : 1) * Math.PI * 1.75 : 0;
  if (sim.crash && rd) { c.strokeStyle = 'rgba(30, 30, 30, .55)'; c.lineWidth = 4; for (const dx of [-laneW * 0.2, laneW * 0.2]) { c.beginPath(); c.moveTo(x + dx, cy + S * 1.2); c.lineTo(x + dx - spin * 6, cy + S * 1.2 + spin * S * 3); c.stroke(); } }
  drawCar(c, x, cy, laneW, S, sim.p === 'O' ? P.O : P.X, spin, P);
  if (sim.done) { c.fillStyle = P.paper; c.strokeStyle = P.ink; c.lineWidth = 2.5; c.font = `bold ${Math.round(S * 1.6)}px sans-serif`; c.textAlign = 'center'; c.strokeText('FINISH!', W / 2, H * 0.3); c.fillText('FINISH!', W / 2, H * 0.3); }
}
function drawCar(c, x, y, laneW, S, col, ang, P) {
  const w = laneW * 0.56, h = LANE.art * S;
  c.save(); c.translate(x, y); c.rotate(ang);
  c.fillStyle = P.ink; for (const [dx, dy] of [[-1, -0.3], [1, -0.3], [-1, 0.32], [1, 0.32]]) rr(c, dx * w * 0.5 - 4, dy * h - h * 0.1, 8, h * 0.2, 2), c.fill();
  rr(c, -w / 2, -h / 2, w, h, w * 0.25); outlined(c, col, P.ink, 2.5);
  rr(c, -w * 0.34, -h * 0.28, w * 0.68, h * 0.22, 4); outlined(c, '#cfe9f7', P.ink, 2);
  rr(c, -w * 0.34, h * 0.08, w * 0.68, h * 0.16, 4); outlined(c, '#cfe9f7', P.ink, 2);
  c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(-w * 0.3, -h / 2 + 3, 3.5, 0, Math.PI * 2); c.arc(w * 0.3, -h / 2 + 3, 3.5, 0, Math.PI * 2); c.fill();
  c.restore();
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = runTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
