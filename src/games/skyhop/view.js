// Sky Hop: the screen, the miniature, the move's words and sounds, and the inputs.
import { clamp01 } from '../../core/util.js';
import { FING, HOP } from '../shared/finger.js';
import { hopCam, hopPx } from './rules.js';
import { state } from '../../ui/app.js';
import { hash01 } from '../../ui/art.js';
import { fingSounds, fingTable } from '../../ui/finger.js';
import { outlined, rr, runColours } from '../../ui/runner.js';
export { fingerMiniature as miniature } from '../../ui/finger.js';
export { fingerMoveText as moveText } from '../../ui/finger.js';

// Sky Hop: the sky from the side (deeper blue higher up), clouds drifting by at half the climb, a mark
// every 10 m, the bunting at the top, the platforms (leafy planks; blue cloud planks that slide to and
// fro; biscuits that crumble after one bounce), the burrs to keep clear of, and the hopper: a round
// sprout in the player's colour, stretched as it flies, its eyes on where it is going.
export function drawHop(c, W, H, v, now) {
  const P = runColours(), sim = v.sim, cfg = sim.cfg, Wm = HOP.w;
  const k = Math.min(W / Wm, H / 11), ox = (W - Wm * k) / 2, cam = hopCam(sim), top = cam + H / k;
  const Y = m => H - (m - cam) * k, f = clamp01(cam / cfg.target);
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, `hsl(${206 + 34 * f}, 68%, ${72 - 18 * f}%)`); sky.addColorStop(1, `hsl(${198 + 26 * f}, 72%, ${88 - 14 * f}%)`);
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  const pc = cam * 0.45;                                           // far clouds, at half the climb
  c.fillStyle = 'rgba(255,255,255,.75)';
  for (let j = Math.floor(pc / 4) - 1; j <= Math.floor((pc + H / k) / 4) + 1; j++) {
    const x = ox + hash01(j) * Wm * k, y = H - (j * 4 - pc) * k, s = 0.7 + hash01(j + 50) * 0.6;
    c.beginPath(); c.ellipse(x, y, k * 1.1 * s, k * 0.36 * s, 0, 0, Math.PI * 2); c.ellipse(x + k * 0.7 * s, y - k * 0.2 * s, k * 0.7 * s, k * 0.32 * s, 0, 0, Math.PI * 2); c.fill();
  }
  if (cam < 0.5) {                                                 // the meadow at the bottom
    const gy = Y(0);
    c.fillStyle = '#8fcf6a'; c.beginPath(); c.moveTo(0, gy + k * 0.3);
    for (let x = 0; x <= W; x += 10) c.lineTo(x, gy + k * 0.3 - Math.sin(x / 37) * k * 0.15);
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
  }
  c.font = `800 ${Math.max(9, Math.round(k * 0.3))}px Nunito, Arial, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle';
  for (let m = Math.max(10, Math.ceil(cam / 10) * 10); m <= top; m += 10) {   // a mark every 10 m, its height every 50
    const y = Y(m);
    c.fillStyle = 'rgba(22,18,16,.32)'; c.fillRect(ox, y - 1, m % 50 ? k * 0.25 : k * 0.55, 2);
    if (m % 50 === 0) c.fillText(`${m} m`, ox + k * 0.65, y);
  }
  const ty = Y(cfg.target);                                        // the top: bunting across the sky
  if (ty > -k && ty < H + k) {
    c.strokeStyle = P.ink; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, ty); c.quadraticCurveTo(W / 2, ty + k * 0.25, W, ty); c.stroke();
    for (let x = 6; x < W; x += Math.max(16, k * 0.7)) { const sag = k * 0.25 * (1 - Math.pow((x - W / 2) / (W / 2), 2)), y = ty + sag; c.beginPath(); c.moveTo(x - k * 0.22, y); c.lineTo(x + k * 0.22, y); c.lineTo(x, y + k * 0.42); c.closePath(); outlined(c, Math.round(x / Math.max(16, k * 0.7)) % 2 ? P.X : P.O, P.ink, 1.5); }
    c.font = `400 ${Math.max(14, Math.round(k * 0.55))}px 'Luckiest Guy', 'Arial Black', sans-serif`; c.textAlign = 'center'; c.fillStyle = P.paper; c.strokeStyle = P.ink; c.lineWidth = 3;
    c.strokeText('TOP', W / 2, ty - k * 0.45); c.fillText('TOP', W / 2, ty - k * 0.45);
  }
  const each = (x, fn) => fn(ox + x * k);                         // (the sides are walls: one of everything)
  if (sim.t <= FING.grace) {                                       // the start ledge: across the whole sky, gone once the grace is up
    const y = Y(sim.h0), a = v.still ? 1 : Math.min(1, (FING.grace - sim.t) / 0.5);
    c.save(); c.globalAlpha = a;
    rr(c, -4, y, W + 8, Math.max(7, k * 0.32), 4); outlined(c, P.paper, P.ink, 2.5);
    c.fillStyle = 'rgba(88,168,207,.45)'; for (let x = 6; x < W; x += 18) c.fillRect(x, y + 3, 8, Math.max(2, k * 0.32 - 6));
    c.restore();
  }
  for (let i = sim.lo; i < sim.plats.length; i++) {
    const q = sim.plats[i];
    if (q.y > top + 0.6) break;
    if (q.y < cam - 0.8) continue;
    const b = v.brk && v.brk[i], gone = sim.gone[i] ? (b != null ? (sim.t - b) / 0.45 : 2) : 0;
    if (gone > 1) continue;
    const x = hopPx(q, sim.t), y = Y(q.y), w = q.w * k, th = Math.max(6, 0.3 * k);
    each(x, X => hopPlat(c, X, y, w, th, q, gone, P));
  }
  for (const hz of sim.haz) { if (hz.y < cam - 1.2) continue; if (hz.y > top + 1.2) break; each(hz.x, X => hopBurr(c, X, Y(hz.y), HOP.haz * k, now, P)); }
  const hy = Y(sim.y + HOP.bodyY), R = Math.max(9, HOP.body * k * 1.2);
  each(sim.x, X => hopHopper(c, X, hy, R, sim, v, now, P));
  if (v.end === 'top' && v.endAt) { const u = Math.min(1, (now - v.endAt) / 600); c.strokeStyle = P.O; c.lineWidth = 3; for (let r = 0; r < 10; r++) { const a = r * Math.PI / 5; c.beginPath(); c.moveTo(ox + sim.x * k + Math.cos(a) * R * (1.2 + u), hy + Math.sin(a) * R * (1.2 + u)); c.lineTo(ox + sim.x * k + Math.cos(a) * R * (1.6 + 2 * u), hy + Math.sin(a) * R * (1.6 + 2 * u)); c.stroke(); } }
  const wall = Math.max(5, k * 0.2), wl = ox, wr = ox + Wm * k;      // the walls: a stone edge just inside either side of the sky, anything beyond shaded
  c.fillStyle = 'rgba(40,52,70,.30)'; if (wl > 0) c.fillRect(0, 0, wl, H); if (wr < W) c.fillRect(wr, 0, W - wr, H);
  const off = ((cam * k) % (k * 1.2) + k * 1.2) % (k * 1.2);
  for (const [x0, s] of [[wl, 1], [wr - wall, -1]]) {
    c.fillStyle = '#9aa3ad'; c.fillRect(x0, 0, wall, H);
    c.fillStyle = P.ink; c.fillRect(s > 0 ? x0 + wall - 1 : x0 - 1, 0, 2, H);   // its face, towards the sky
    c.fillStyle = 'rgba(22,18,16,.28)';
    for (let y = H + off; y > -k; y -= k * 1.2) c.fillRect(x0, y, wall, 2);   // the stones' joints, climbing with the camera
  }
}
function hopPlat(c, X, y, w, th, q, gone, P) {
  c.save();
  if (gone > 0) { c.globalAlpha = 1 - gone; c.translate(0, gone * th * 3); }
  if (q.k === 'b') {                                               // a biscuit: cracks, and in two halves once broken
    const halves = gone > 0 ? [[-1, -w / 2, 0], [1, 0, w / 2]] : [[0, -w / 2, w / 2]];
    for (const [s, a, b] of halves) { c.save(); c.translate(X + s * gone * th * 2, y); c.rotate(s * gone * 0.6); rr(c, a, 0, b - a, th, th / 2.5); outlined(c, '#e3b46b', P.ink, 2.2); c.restore(); }
    if (!gone) { c.strokeStyle = P.ink; c.lineWidth = 1.5; c.beginPath(); c.moveTo(X - w * 0.05, y + 1); c.lineTo(X + w * 0.04, y + th * 0.45); c.lineTo(X - w * 0.03, y + th - 1); c.stroke(); c.fillStyle = '#b07a3a'; for (const d of [-0.32, -0.16, 0.18, 0.33]) { c.beginPath(); c.arc(X + d * w, y + th * 0.5, 1.4, 0, Math.PI * 2); c.fill(); } }
  } else if (q.k === 'm') {                                        // a cloud plank that slides: arrows at its ends
    rr(c, X - w / 2, y, w, th, th / 2); outlined(c, '#bfe7fb', P.ink, 2.2);
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(X - w * 0.18, y + 1, w * 0.16, th * 0.45, 0, Math.PI, 0); c.ellipse(X + w * 0.14, y + 1, w * 0.2, th * 0.55, 0, Math.PI, 0); c.fill();
    c.fillStyle = P.ink; for (const s of [-1, 1]) { const ax = X + s * (w / 2 - th * 0.55); c.beginPath(); c.moveTo(ax + s * th * 0.32, y + th / 2); c.lineTo(ax - s * th * 0.12, y + th * 0.22); c.lineTo(ax - s * th * 0.12, y + th * 0.78); c.closePath(); c.fill(); }
  } else {                                                         // a leafy plank
    rr(c, X - w / 2, y, w, th, th / 2); outlined(c, '#7cc95a', P.ink, 2.2);
    c.fillStyle = '#5aa63e'; c.fillRect(X - w / 2 + 3, y + th * 0.6, w - 6, th * 0.25);
    c.fillStyle = '#9be27a'; for (const d of [-0.3, 0.05, 0.32]) { c.beginPath(); c.ellipse(X + d * w, y + 1, th * 0.45, th * 0.25, d, 0, Math.PI * 2); c.fill(); }
  }
  c.restore();
}
function hopBurr(c, X, y, r, now, P) {                           // a burr: a spiky purple seed ball with a cross look
  c.save(); c.translate(X, y); c.rotate(Math.sin(now / 380 + X) * 0.25);
  c.beginPath();
  for (let s = 0; s < 22; s++) { const a = (s * Math.PI) / 11, rr2 = s % 2 ? r * 0.72 : r * 1.12; c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
  c.closePath(); outlined(c, '#8d5bd8', P.ink, 2);
  c.beginPath(); c.arc(0, 0, r * 0.55, 0, Math.PI * 2); c.fillStyle = '#a77ff0'; c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(-r * 0.22, -r * 0.08, r * 0.17, 0, Math.PI * 2); c.arc(r * 0.22, -r * 0.08, r * 0.17, 0, Math.PI * 2); c.fill();
  c.fillStyle = P.ink; c.beginPath(); c.arc(-r * 0.2, -r * 0.04, r * 0.08, 0, Math.PI * 2); c.arc(r * 0.2, -r * 0.04, r * 0.08, 0, Math.PI * 2); c.fill();
  c.strokeStyle = P.ink; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-r * 0.38, -r * 0.32); c.lineTo(-r * 0.08, -r * 0.2); c.moveTo(r * 0.38, -r * 0.32); c.lineTo(r * 0.08, -r * 0.2); c.stroke();
  c.restore();
}
function hopHopper(c, X, y, R, sim, v, now, P) {
  const col = v.p === 'O' ? P.O : P.X, hit = v.end === 'hazard';
  const s = Math.min(0.2, (Math.abs(sim.vy) / sim.cfg.bounce) * 0.16), sy = 1 + s, sx = 1 - s * 0.6;
  const look = v.tx != null ? Math.max(-1, Math.min(1, (v.tx - sim.x) / 1.5)) : 0;
  c.save(); c.translate(X, y);
  if (hit && v.endAt) { const u = Math.min(1, (now - v.endAt) / 700); c.translate(0, u * u * R * 4); c.rotate(u * 5); }
  c.scale(sx, sy);
  c.fillStyle = P.ink; c.beginPath(); c.ellipse(-R * 0.42, R * 0.92, R * 0.3, R * 0.17, 0, 0, Math.PI * 2); c.ellipse(R * 0.42, R * 0.92, R * 0.3, R * 0.17, 0, 0, Math.PI * 2); c.fill();   // feet
  const sway = Math.max(-0.5, Math.min(0.5, -sim.vy / sim.cfg.bounce * 0.4));
  c.strokeStyle = P.ink; c.lineWidth = 2.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -R * 0.95); c.quadraticCurveTo(R * sway * 0.6, -R * 1.35, R * sway, -R * 1.55); c.stroke();   // the sprout
  c.save(); c.translate(R * sway, -R * 1.5); c.rotate(-0.6 + sway); c.beginPath(); c.ellipse(-R * 0.28, 0, R * 0.32, R * 0.15, 0, 0, Math.PI * 2); outlined(c, '#7cc95a', P.ink, 1.8); c.rotate(1.2); c.beginPath(); c.ellipse(R * 0.28, 0, R * 0.3, R * 0.14, 0, 0, Math.PI * 2); outlined(c, '#7cc95a', P.ink, 1.8); c.restore();
  c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); outlined(c, col, P.ink, 2.8);
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-R * 0.35, -R * 0.4, R * 0.28, R * 0.18, -0.5, 0, Math.PI * 2); c.fill();
  if (hit) { c.strokeStyle = P.ink; c.lineWidth = 2.2; for (const ex of [-0.32, 0.32]) { c.beginPath(); c.moveTo(R * (ex - 0.12), -R * 0.22); c.lineTo(R * (ex + 0.12), R * 0.02); c.moveTo(R * (ex + 0.12), -R * 0.22); c.lineTo(R * (ex - 0.12), R * 0.02); c.stroke(); } }
  else {
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(-R * 0.3, -R * 0.12, R * 0.22, R * 0.27, 0, 0, Math.PI * 2); c.ellipse(R * 0.3, -R * 0.12, R * 0.22, R * 0.27, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = P.ink; c.lineWidth = 1.6; c.stroke();
    c.fillStyle = P.ink; c.beginPath(); c.arc(-R * 0.3 + look * R * 0.1, -R * 0.08 + (sim.vy < 0 ? R * 0.06 : -R * 0.04), R * 0.11, 0, Math.PI * 2); c.arc(R * 0.3 + look * R * 0.1, -R * 0.08 + (sim.vy < 0 ? R * 0.06 : -R * 0.04), R * 0.11, 0, Math.PI * 2); c.fill();
    c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); c.arc(0, R * 0.28, R * 0.2, 0.25, Math.PI - 0.25); c.stroke();
  }
  c.restore();
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = fingTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function sounds(f, add, won, mini, last) {
  fingSounds(f, add); return;   // someone else's attempt as it replays (its bounces, catches, flips), then the result
}
