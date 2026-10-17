// Lane Rush: the screen, the miniature, the move's words and sounds, and the inputs.
import { runLane, runLaneX, runStep } from '../shared/runner.js';
import { LANE, laneDrive } from './rules.js';
import { REDUCED, app, cpuPlays, state } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { fmtM, outlined, rr, runCanvas, runColours, runPaint, runTable } from '../../ui/runner.js';
export { runnerMiniature as miniature } from '../../ui/runner.js';
export { runnerMoveText as moveText } from '../../ui/runner.js';
export { runnerSounds as sounds } from '../../ui/runner.js';

// Lane Rush: the computer's run is driven on the road before its result shows (the engine's laneDrive: a
// drive that ends where the run did; it has no recording). A long run plays faster, so the replay takes
// LANE_REPLAY_MAX at most. Only here, for the computer: another phone's run shows its result, as before.
const LANE_REPLAY_MAX = 9000, laneReps = new WeakMap();
export let laneShow = null;                                             // the replay on screen: { f, sim, i, crashAt, raf }
export function laneRep(f) {
  if (!f || f.type !== 'lane' || !f.run || f.timeout || REDUCED || state.online || !cpuPlays(f.by)) return null;
  if (laneReps.has(f)) return laneReps.get(f);
  const sq = state.squares && state.squares[f.square], plan = sq ? laneDrive(sq.mini, f.by, f.run.from, f.run.to, !!f.run.done) : null;
  let rep = null;
  if (plan) { const speed = Math.max(1, (plan.secs * 1000) / (LANE_REPLAY_MAX - 700)); rep = { plan, speed, drive: Math.round((plan.secs * 1000) / speed), ms: Math.round((plan.secs * 1000) / speed) + (f.run.done ? 500 : 700) }; }
  laneReps.set(f, rep);
  return rep;
}
export const lanePre = f => { const r = laneRep(f); return r ? r.ms : 0; };
export function laneShowFrame(now) {
  const ls = laneShow, f = state.flash;
  if (!ls || ls.f !== f || state.screen !== 'mini' || state.zoom !== f.square) { if (ls) cancelAnimationFrame(ls.raf); laneShow = null; return; }
  const rep = laneRep(f), start = fxAt('move', f);
  if (!rep || start == null || now - start >= rep.ms) { cancelAnimationFrame(ls.raf); laneShow = null; runPaint(); return; }
  const T = Math.max(0, (now - start) * rep.speed / 1000), steps = rep.plan.steps;
  while (!ls.sim.crash && !ls.sim.done && ls.sim.t + LANE.step <= T + 1e-9) {
    while (ls.i < steps.length && steps[ls.i].t <= ls.sim.t + 1e-9) runLane(ls.sim, steps[ls.i++].dir);
    runStep(ls.sim, LANE.step);
  }
  if ((ls.sim.crash || ls.sim.done) && ls.crashAt == null) ls.crashAt = now;
  const cv = app.querySelector('canvas[data-run="cv"]'), hud = app.querySelector('[data-run="hud"]');
  if (cv) { const { c, W, H } = runCanvas(cv); if (W > 1 && H > 1) drawLane(c, W, H, ls.sim, ls.sim.crash ? { at: ls.crashAt } : null, now); }
  if (hud) hud.textContent = fmtM(Math.min(ls.sim.d, f.run.to)) + ' m';
  ls.raf = requestAnimationFrame(laneShowFrame);
}
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

// Setters for the names other modules reassign (an imported name is read-only there).
export function setLaneShow(v) { laneShow = v; }
