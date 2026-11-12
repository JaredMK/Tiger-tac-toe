// Flap: the screen, the miniature, the move's words and sounds, and the inputs.
import { FLAP } from './rules.js';
import { state } from '../../ui/app.js';
import { RUNFX, SMALL, clamp01, cloud, dizzy, endK, finishFlag, hash, hitNow, impact, puff, shadow } from '../../ui/runfx.js';
import { outlined, rr, runColours, runTable } from '../../ui/runner.js';
export { runnerMiniature as miniature } from '../../ui/runner.js';
export { runnerMoveText as moveText } from '../../ui/runner.js';
export { runnerSounds as sounds } from '../../ui/runner.js';

// The view's own notes on a run (sim.fx; never the run's): where each flap was made (a puff of air left there), from
// the frames as they are drawn.
function flapFx(sim, now) {
  const f = sim.fx || (sim.fx = { vy: sim.vy, puffs: [] });
  if (sim.vy > f.vy + 3 && !sim.crash) f.puffs.push({ d: sim.d, y: sim.y, at: now });   // (a flap: the speed jumps up)
  f.vy = sim.vy;
  while (f.puffs.length && now - f.puffs[0].at > RUNFX.puff) f.puffs.shift();
  return f;
}
// Flap: the sky from the side, the posts with their gaps, the ground with its distance marks, and the
// bird (in the player's colour): its wing up just after a flap, nose up climbing and down falling; a bob
// while it holds its height before the first tap; a burst of feathers and a tumble to the ground when it crashes.
export function drawFlap(c, W, H, sim, rd, now) {
  const P = runColours(), gh = Math.max(16, H * 0.09), S = Math.min(W / 16, (H - gh) / FLAP.h), gy = H - gh;
  const bx = W * 0.27, toX = m => bx + (m - sim.d) * S, toY = y => gy - y * S, fx = flapFx(sim, now);
  const sky = c.createLinearGradient(0, 0, 0, gy); sky.addColorStop(0, '#9fd3ef'); sky.addColorStop(1, '#e4f4fb');
  c.fillStyle = sky; c.fillRect(-8, -8, W + 16, H + 16);
  puff(c, W * 0.84, gy * 0.2, S * 1.7, 0.45, '255, 243, 176'); puff(c, W * 0.84, gy * 0.2, S * 1.05, 1, '255, 243, 176');   // the sun, on the right: the light comes from there
  for (let k = 0; k < 5; k++) {                                                // clouds drift by, slowly
    const x = ((k * 151 - sim.d * S * 0.12) % (W + 140) + W + 140) % (W + 140) - 70, y = gy * (0.12 + (k % 3) * 0.16);
    cloud(c, x, y, 0.94);
  }
  c.fillStyle = '#cfead2'; c.beginPath(); c.moveTo(-8, gy);                   // far hills, then nearer ones a little faster
  for (let x = -8; x <= W + 8; x += 8) c.lineTo(x, gy - S * 2.1 - S * 0.8 * (0.5 + 0.5 * Math.sin((x + sim.d * S * 0.16) / 85 + 2)));
  c.lineTo(W + 8, gy); c.closePath(); c.fill();
  c.fillStyle = '#b3dcb9'; c.beginPath(); c.moveTo(-8, gy);
  for (let x = -8; x <= W + 8; x += 8) c.lineTo(x, gy - S * 1.2 - S * 0.9 * (0.5 + 0.5 * Math.sin((x + sim.d * S * 0.3) / 60)));
  c.lineTo(W + 8, gy); c.closePath(); c.fill();
  for (let m = Math.floor((sim.d * 0.6) / 5) * 5 - 5; m < sim.d * 0.6 + W / S + 5; m += 5) {   // bushes along the ground, behind the posts
    const x = bx + (m - sim.d * 0.6) * S + hash(m) * S * 2, r = S * (0.4 + 0.35 * hash(m + 0.5));
    c.fillStyle = '#8fc79a'; c.beginPath(); c.arc(x, gy, r, Math.PI, 0); c.arc(x + r * 1.1, gy, r * 0.7, Math.PI, 0); c.fill();
  }
  const by = sim.crash && rd ? sim.y + (FLAP.box.h / 2 - sim.y) * endK(rd, now, 700) ** 2 : sim.y;   // the fall after a post
  for (const o of sim.course) { const x = toX(o.at); if (x < W + 40 && x + FLAP.post * S > -40) drawPost(c, x, o, S, toY, gy, gh, P); }
  const fxn = toX(sim.cfg.target);                                             // the finish: a chequered pole up to the sky, its flag at the top of the ground
  if (fxn < W + 40) { for (let k = 0; k < 16; k++) { c.fillStyle = k % 2 ? P.ink : P.paper; c.fillRect(fxn - 4, gy - (k + 1) * gy / 16, 8, gy / 16 + 1); } c.strokeStyle = P.ink; c.lineWidth = 1.5; c.strokeRect(fxn - 4, -2, 8, gy + 2); }
  c.fillStyle = '#e6c58a'; c.fillRect(-8, gy, W + 16, H - gy + 8);
  c.fillStyle = '#9ccf7a'; c.fillRect(-8, gy, W + 16, Math.max(4, gh * 0.24));                       // a strip of grass along the top of the ground
  c.strokeStyle = P.ink; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, gy); c.lineTo(W + 8, gy); c.stroke();
  c.textAlign = 'center';
  for (let m = Math.floor(sim.d / 5) * 5 - 10; m < sim.d + W / S; m += 5) {    // a tick every 5 m, the number every 100
    const x = toX(m);
    if (m > 0 && m % 100 === 0 && m < sim.cfg.target) { c.fillStyle = P.ink; c.font = SMALL(Math.max(10, gh * 0.55)); c.fillText(String(m), x, gy + gh * 0.78); }
    else { c.fillStyle = '#c9a66b'; c.fillRect(x, gy + Math.max(6, gh * 0.36), 3, Math.max(3, gh * 0.3)); }
  }
  for (const o of sim.course) { const x = toX(o.at); if (x < W + 40 && x + FLAP.post * S > -40) shadow(c, x + FLAP.post * S * 0.4, gy + gh * 0.34, FLAP.post * S * 0.7, Math.max(1.5, gh * 0.1), 0.2); }   // the posts' shadows on the ground, and the bird's, fainter the higher it flies
  shadow(c, bx, gy + gh * 0.34, S * (0.5 - 0.022 * by), Math.max(1.5, gh * 0.1), 0.26 - 0.016 * by);
  if (fxn < W + 40) finishFlag(c, fxn + 4, gy - S * 0.2, S * 0.8, now, P);
  for (const p of fx.puffs) { const k = (now - p.at) / RUNFX.puff, x = toX(p.d), y = toY(p.y); for (const s of [-1, 1]) puff(c, x - S * 0.2 + s * k * S * 0.35, y + S * (0.45 + 0.5 * k), S * (0.1 + 0.13 * k), 0.75 * (1 - k)); }   // the air a flap pushed down, left behind
  drawBird(c, bx, toY(by), S, sim, rd, now, P, toY(sim.y));
}
// A post: wooden, banded, lit from the right, with a teal cap on each side of the gap.
function drawPost(c, x, o, S, toY, gy, gh, P) {
  const w = FLAP.post * S, top = toY(o.gy + o.gh / 2), bot = toY(o.gy - o.gh / 2), cap = Math.max(7, S * 0.42);
  for (const [y0, y1] of [[-12, top], [bot, gy + 2]]) {
    if (y1 - y0 < 1) continue;
    rr(c, x, y0, w, y1 - y0, 3); outlined(c, '#d9a066', P.ink, 2.5);
    c.fillStyle = 'rgba(140, 80, 35, .3)';
    for (let yy = y0 + 8; yy < y1 - 6; yy += 15) c.fillRect(x + 3, yy, w - 6, 4);
    c.fillStyle = 'rgba(110, 60, 25, .28)'; c.fillRect(x + 1.5, y0 + 1.5, w * 0.24, y1 - y0 - 3);            // its shaded side
    c.fillStyle = 'rgba(255, 236, 200, .5)'; c.fillRect(x + w * 0.7, y0 + 1.5, w * 0.14, y1 - y0 - 3);        // its lit side
  }
  for (const y of [top - cap, bot]) { rr(c, x - 4, y, w + 8, cap, 4); outlined(c, '#21b2a6', P.ink, 2.5); c.fillStyle = 'rgba(255, 255, 255, .45)'; c.fillRect(x + w * 0.62, y + 2.5, w * 0.22, Math.max(2, cap * 0.28)); }
}
function drawBird(c, x, y, S, sim, rd, now, P, hy) {   // hy: where it hit (the burst and the feathers stay there as it falls)
  const R = FLAP.art * S / 2, col = sim.p === 'O' ? P.O : P.X, k = sim.crash ? endK(rd, now, 700) : 0;
  let ang = Math.max(-0.45, Math.min(1.0, -sim.vy / 10)), yy = y;
  if (!sim.flown && !sim.crash && !sim.done) yy += Math.sin(now / 160) * S * 0.12;
  if (sim.crash) ang = 1.2 + k * 1.6;
  if (sim.crash && rd && hitNow(sim)) for (let i = 0; i < 5; i++) {         // feathers knocked loose where it hit, fluttering down
    const a = -2.6 + i * 0.55;
    c.save(); c.translate(x + Math.cos(a) * R * (0.8 + 3.2 * k) - R * k, hy + Math.sin(a) * R * (0.8 + 2.2 * k) + k * k * R * 3.5); c.rotate(a + k * 5 + i); c.globalAlpha = 1 - clamp01(k * 1.15) ** 2;
    c.beginPath(); c.ellipse(0, 0, R * 0.42, R * 0.16, 0, 0, Math.PI * 2); outlined(c, col, P.ink, 1.5); c.restore();
  }
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
  if (sim.crash) { if (hitNow(sim)) impact(c, x + R * 0.9, hy, R * 1.8, rd, now, P); if (k > 0.6) dizzy(c, x, yy - R * 1.7, R * 1.1, now, P); }
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = runTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
