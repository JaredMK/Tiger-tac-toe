// Lane Rush: the screen, the miniature, the move's words and sounds, and the inputs.
import { runLaneX, runSpeed } from '../shared/runner.js';
import { LANE } from './rules.js';
import { state } from '../../ui/app.js';
import { endK, hash, hitNow, impact, puff, shadow } from '../../ui/runfx.js';
import { outlined, rr, runColours, runTable } from '../../ui/runner.js';
export { runnerMiniature as miniature } from '../../ui/runner.js';
export { runnerMoveText as moveText } from '../../ui/runner.js';
export { runnerSounds as sounds } from '../../ui/runner.js';

const TRAFFIC = ['#7fc8f0', '#a9b4c4', '#f7f3e6', '#9ad88a', '#d8a0e8'];   // (no yellow or red: those are the players' cars)
const SKID_MS = 900;                                                         // how long a lane change's tyre marks stay on the road
// The view's own notes on a run (sim.fx; never the run's): where the car was while it changed lanes (its tyre marks,
// left on the road behind it), from the frames as they are drawn.
function laneFx(sim, now) {
  const f = sim.fx || (sim.fx = { trail: [] });
  if (sim.laneT < 1 && !sim.crash) f.trail.push({ d: sim.d, x: runLaneX(sim), at: now });
  while (f.trail.length && (now - f.trail[0].at > SKID_MS || f.trail.length > 80)) f.trail.shift();
  return f;
}
// The road from behind and above: the verges and their trees going by, the kerbs, the three lanes, the traffic (seen
// from behind, as it is overtaken) and the player's car (in their colour, a stripe down its back), each standing on
// its own stretch of road (its shadow: where it is, and how long).
export function drawLane(c, W, H, sim, rd, now) {
  const P = runColours(), road = { x: W * 0.1, w: W * 0.8 }, laneW = road.w / 3, S = H / 40, cy = H * 0.87, toY = m => cy - (m - sim.d) * S;   // the car low in a tall scene: about 35 m of road ahead in sight
  const fx = laneFx(sim, now), L = LANE.art * S, moving = sim.t > 0 && !sim.crash && !sim.done, laneX = l => road.x + (l + 0.5) * laneW;
  c.fillStyle = '#95cf9e'; c.fillRect(-8, -8, W + 16, H + 16);
  for (let k = -1; k < 12; k++) {                                              // trees along the verges, going by (lit from the right)
    const yy = ((k * H) / 9 + sim.d * S) % (H + 40) - 20, r = W * 0.035;
    for (const tx of [W * 0.04, W * 0.96]) { puff(c, tx - r * 0.25, yy + r * 0.3, r, 0.18, '22, 18, 16'); puff(c, tx, yy, r, 1, '109, 138, 90'); puff(c, tx + r * 0.28, yy - r * 0.28, r * 0.5, 1, '138, 168, 112'); }
  }
  c.fillStyle = '#5b5b66'; c.fillRect(road.x, -8, road.w, H + 16);
  c.fillStyle = 'rgba(255, 255, 255, .05)'; for (let l = 0; l < 3; l++) c.fillRect(road.x + l * laneW + laneW * 0.22, -8, laneW * 0.56, H + 16);   // the lanes' worn middles
  for (let k = -1; k < 20; k++) { const yy = ((k * S * 4 + sim.d * S) % (H + S * 4)) - S * 2; c.fillStyle = k % 2 ? '#3a3a44' : P.paper; c.fillRect(road.x - 7, yy, 7, S * 4 + 1); c.fillRect(road.x + road.w, yy, 7, S * 4 + 1); }   // the kerbs, in neither player's colour
  c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); for (const x of [road.x - 7, road.x, road.x + road.w, road.x + road.w + 7]) { c.moveTo(x, -8); c.lineTo(x, H + 8); } c.stroke();
  c.strokeStyle = '#f7f3e6'; c.lineWidth = 3; c.setLineDash([S * 2, S * 2]); c.lineDashOffset = -((sim.d * S) % (S * 4));
  for (let l = 1; l < 3; l++) { c.beginPath(); c.moveTo(road.x + l * laneW, -8); c.lineTo(road.x + l * laneW, H + 8); c.stroke(); }
  c.setLineDash([]);
  if (moving) { const v = runSpeed(sim.cfg, sim.d); c.fillStyle = 'rgba(255, 255, 255, .1)'; for (let k = 0; k < 7; k++) { const yy = ((k * H) / 5 + sim.d * S * 1.5) % (H + 80) - 40; c.fillRect(road.x + 6 + hash(k) * (road.w - 12), yy, 2, S * v * 0.05); } }   // the road rushing by, longer the faster
  const fy = toY(sim.cfg.target);
  if (fy > -S * 2) for (let k = 0; k < 12; k++) for (let j = 0; j < 2; j++) { c.fillStyle = (k + j) % 2 ? P.ink : P.paper; c.fillRect(road.x + (k * road.w) / 12, fy - S * 1.2 + j * S * 0.6, road.w / 12 + 0.5, S * 0.6 + 0.5); }
  c.lineWidth = 3; c.lineCap = 'round';                                        // the tyre marks of a lane change, fading
  for (let i = 1; i < fx.trail.length; i++) { const a = fx.trail[i - 1], b = fx.trail[i]; if (b.d - a.d > 3 || b.d < a.d) continue; c.strokeStyle = `rgba(22, 18, 16, ${(0.4 * (1 - (now - b.at) / SKID_MS)).toFixed(3)})`; for (const off of [-laneW * 0.17, laneW * 0.17]) { c.beginPath(); c.moveTo(laneX(a.x) + off, toY(a.d) + L / 2); c.lineTo(laneX(b.x) + off, toY(b.d) + L / 2); c.stroke(); } }
  const x = laneX(runLaneX(sim)), k = sim.crash ? endK(rd, now, 700) : 0, spin = k * Math.PI * 1.75, lean = sim.laneT < 1 && !sim.crash ? Math.sign(sim.lane - sim.laneFrom) * Math.sin(Math.PI * sim.laneT) * 0.13 : 0;
  const traffic = far => { for (let i = sim.course.length - 1; i >= 0; i--) { const o = sim.course[i], y = toY(o.at); if ((o.at > sim.d) !== far || y < -S * 6 || y > H + S * 6) continue; o.cars.forEach((car, l) => { if (car) drawCar(c, laneX(l), y, laneW, S, TRAFFIC[Math.floor(o.at * 7 + l) % TRAFFIC.length], 0, P, false); }); } };
  traffic(true);                                                               // the traffic ahead, then the car, then what it has passed: nearer over further
  if (sim.crash && rd) { c.strokeStyle = 'rgba(30, 30, 30, .55)'; c.lineWidth = 4; for (const dx of [-laneW * 0.2, laneW * 0.2]) { c.beginPath(); c.moveTo(x + dx, cy + S * 1.2); c.lineTo(x + dx - spin * 6, cy + S * 1.2 + spin * S * 3); c.stroke(); } }
  if (moving) for (let i = 0; i < 3; i++) { const q = (sim.d / 4 + i / 3) % 1; puff(c, x - laneW * 0.16, cy + L / 2 + 2 + q * S * 2.2, 2 + 3.5 * q, 0.34 * (1 - q), '235, 235, 240'); }   // its exhaust
  if (sim.crash) for (let i = 0; i < 4; i++) puff(c, x + (i - 1.5) * laneW * 0.16 * (1 + k), cy - L * 0.6 - i * 4 * k - k * S * 2, laneW * (0.07 + 0.07 * k), 0.4 * (1 - k * 0.6), '90, 80, 70');   // smoke off the bonnet
  drawCar(c, x, cy, laneW, S, sim.p === 'O' ? P.O : P.X, spin + lean, P, true);
  if (sim.crash && hitNow(sim)) impact(c, x, cy - L * 0.5, laneW * 0.42, rd, now, P);
  traffic(false);
}
// A car from behind and a little above: its roof and back window, its boot with the lights and the plate, the wheels
// just showing; (x, y) the middle of the stretch of road it stands on (LANE.art long), which its shadow marks.
function drawCar(c, x, y, laneW, S, col, ang, P, own) {
  const w = laneW * 0.56, L = LANE.art * S, hv = Math.max(L * 1.15, w * 0.6), ww = w * 0.15;
  shadow(c, x, y + L * 0.1, w * 0.6, Math.max(4, L * 0.5), 0.26);
  c.save(); c.translate(x, y + L / 2 - hv / 2); c.rotate(ang); c.translate(0, -hv / 2);   // (drawn down from its roof's top edge; its wheels end at the back of its stretch of road)
  c.fillStyle = P.ink; for (const s of [-1, 1]) { rr(c, s * (w / 2 - ww * 0.45) - ww / 2, hv * 0.72, ww, hv * 0.28, 2); c.fill(); }
  rr(c, -w * 0.37, 0, w * 0.74, hv * 0.62, Math.min(8, w * 0.17)); outlined(c, col, P.ink, 2.5);                  // the roof
  rr(c, -w * 0.28, hv * 0.24, w * 0.56, hv * 0.24, 3); outlined(c, '#cfe9f7', P.ink, 2);                           // the back window
  c.fillStyle = 'rgba(255, 255, 255, .7)'; c.fillRect(w * 0.08, hv * 0.28, w * 0.1, hv * 0.07);
  rr(c, -w / 2, hv * 0.47, w, hv * 0.46, Math.min(7, w * 0.14)); outlined(c, col, P.ink, 2.5);                    // the boot
  c.fillStyle = 'rgba(22, 18, 16, .16)'; c.fillRect(-w / 2 + 2.5, hv * 0.79, w - 5, hv * 0.1);                     // the bumper, in shade
  if (own) { c.fillStyle = P.paper; for (const s of [-1, 1]) c.fillRect(s * w * 0.07 - w * 0.035, 2.5, w * 0.07, hv * 0.2); }   // the player's car: two stripes over its roof
  for (const s of [-1, 1]) { rr(c, s * w * 0.34 - w * 0.085, hv * 0.56, w * 0.17, hv * 0.13, 2); outlined(c, '#fff3b0', P.ink, 1.5); }   // the lights
  rr(c, -w * 0.1, hv * 0.64, w * 0.2, hv * 0.11, 1.5); c.fillStyle = P.paper; c.fill(); c.lineWidth = 1.2; c.strokeStyle = P.ink; c.stroke();   // the plate
  c.restore();
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = runTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
