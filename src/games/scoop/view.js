// Scoop Stack: the screen, the miniature, the move's words and sounds, and the inputs.
import { SCOOP, SCOOP_VIEW } from './rules.js';
import { state } from '../../ui/app.js';
import { fingSounds, fingTable, fingThing } from '../../ui/finger.js';
import { outlined, runColours } from '../../ui/runner.js';
export { fingerMiniature as miniature } from '../../ui/finger.js';
export { fingerMoveText as moveText } from '../../ui/finger.js';

// Scoop Stack: a parlour wall, the counter, the cone (a paper sleeve in the player's colour) with the stack
// leaning with its sway, the scoops and the bad things falling to the top of it (pebbles; burnt scoops,
// charred and smoking), a scoop that lands off-centre sliding off, and the three misses allowed.
const SCOOP_FLAV = ['#f59ab5', '#8fe0b5', '#fff1c9', '#e8b06a', '#b3a4f5'];   // strawberry, mint, vanilla, caramel, blueberry
export function drawScoop(c, W, H, v, now) {
  const P = runColours(), sim = v.sim, cfg = sim.cfg, Wu = SCOOP.w;
  const k = Math.min(W / Wu, H / 15.5), ox = (W - Wu * k) / 2, X = x => ox + x * k;
  c.fillStyle = '#fff4f5'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#fbd9de'; for (let x = 0; x < W; x += k * 1.2) c.fillRect(x, 0, k * 0.6, H);
  const counterY = H - 0.45 * k;
  const stack = v.stack || [], n = stack.length, coneH = 1.7, rim0 = counterY - coneH * k, top0 = rim0 - n * SCOOP.piece * k;
  const sh = Math.max(0, H - SCOOP_VIEW.top * k - top0), rimY = rim0 + sh, tipY = counterY + sh, topY = top0 + sh;   // a tall stack: the view follows its top
  if (sh < 0.45 * k) { c.fillStyle = '#c98b4b'; c.fillRect(0, counterY + sh, W, H); c.fillStyle = P.ink; c.fillRect(0, counterY + sh, W, 3); }
  const cx = X(sim.x), s = sim.s, R = SCOOP.r * 1.14 * k;
  if (rimY < H + 2 * k) {                                          // the cone
    c.beginPath(); c.moveTo(cx - 0.66 * k, rimY); c.lineTo(cx + 0.66 * k, rimY); c.lineTo(cx, tipY); c.closePath(); outlined(c, '#e7b56f', P.ink, 2.5);
    c.save(); c.clip(); c.strokeStyle = '#c98b4b'; c.lineWidth = 1.4;
    for (let d = -2; d <= 2; d++) { c.beginPath(); c.moveTo(cx + d * 0.32 * k - k, rimY); c.lineTo(cx + d * 0.32 * k + k, tipY); c.moveTo(cx + d * 0.32 * k + k, rimY); c.lineTo(cx + d * 0.32 * k - k, tipY); c.stroke(); }
    c.fillStyle = v.p === 'O' ? P.O : P.X; c.fillRect(cx - k, rimY + coneH * k * 0.45, 2 * k, coneH * k * 0.3);
    c.restore();
    c.beginPath(); c.moveTo(cx - 0.66 * k, rimY); c.lineTo(cx + 0.66 * k, rimY); c.lineTo(cx, tipY); c.closePath(); c.lineWidth = 2.5; c.strokeStyle = P.ink; c.stroke();
  }
  for (let i = 0; i < n; i++) {                                     // the stack, leaning with the sway
    const y = rimY - (i + 0.55) * SCOOP.piece * k;
    if (y > H + R || y < -R) continue;
    scoopBall(c, cx + s * k * Math.pow((i + 1) / Math.max(1, n), 1.6), y, R, stack[i], P);
  }
  const t = sim.t;
  for (let j = Math.max(0, sim.i - 10); j < sim.items.length; j++) {   // the falling things (and what came of those that got to the top)
    const it = sim.items[j], yu = (it.T - t) * it.v;
    if (yu > SCOOP.spawn) break;
    const o = v.out && v.out[j];
    if (j < sim.i) {
      if (!o || o.o === 'catch') continue;
      if (o.o === 'slide') { const u = (t - o.t) / SCOOP_VIEW.slideT, yy = topY - R + u * u * SCOOP_VIEW.slide * k; if (yy > H + R) continue; const dir = it.x >= o.top ? 1 : -1; c.save(); c.globalAlpha = 1 - Math.min(1, u) * 0.3; c.translate(X(o.top) + dir * (0.5 + u * 1.6) * k, yy); c.rotate(dir * u * 3); scoopBall(c, 0, 0, R, it.f, P); c.restore(); continue; }   // slid off: it tumbles away and falls off the bottom of the screen (where the miss counts: rules.js)
      if (o.o === 'hit') { fingThing(c, X(it.x), topY - R * 0.8, R, it, P, now, true); continue; }
    }
    const y = topY - R - yu * k;
    if (y > H + R) continue;
    fingThing(c, X(it.x), y, R, it, P, now, false);
  }
  for (let m = 0; m < SCOOP.misses; m++) {                          // the misses allowed: a cone each, crossed out once used
    const x = W - 14 - m * 22, y = 16, used = m >= SCOOP.misses - sim.miss;
    c.save(); c.globalAlpha = used ? 0.35 : 1;
    c.beginPath(); c.moveTo(x - 6, y - 2); c.lineTo(x + 6, y - 2); c.lineTo(x, y + 11); c.closePath(); outlined(c, '#e7b56f', P.ink, 1.8);
    c.beginPath(); c.arc(x, y - 4, 6, 0, Math.PI * 2); outlined(c, SCOOP_FLAV[0], P.ink, 1.8);
    c.restore();
    if (used) { c.strokeStyle = P.X; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - 7, y - 9); c.lineTo(x + 7, y + 9); c.moveTo(x + 7, y - 9); c.lineTo(x - 7, y + 9); c.stroke(); }
  }
  if (v.end === 'top' && v.endAt) { const u = Math.min(1, (now - v.endAt) / 600); c.fillStyle = P.O; for (let r = 0; r < 12; r++) { const a = r * Math.PI / 6; c.beginPath(); c.arc(cx + s * k + Math.cos(a) * k * (0.8 + 2 * u), topY - R + Math.sin(a) * k * (0.8 + 2 * u), 3, 0, Math.PI * 2); c.fill(); } }
}
export function scoopBall(c, x, y, R, f, P) {                            // a scoop: a round top over a wavy, drippy edge
  const col = SCOOP_FLAV[f] || SCOOP_FLAV[0];
  c.beginPath(); c.arc(x, y, R, Math.PI * 0.92, Math.PI * 0.08);
  for (let d = 0; d <= 6; d++) { const a = d / 6, px = x + R * Math.cos(Math.PI * 0.08) - a * 2 * R * Math.cos(Math.PI * 0.08), py = y + R * 0.38 + (d % 2 ? R * 0.2 : 0); c.lineTo(px, py); }
  c.closePath(); outlined(c, col, P.ink, 2.2);
  c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(x - R * 0.35, y - R * 0.38, R * 0.24, R * 0.13, -0.5, 0, Math.PI * 2); c.fill();
  if (f === 4 || f === 0) { c.fillStyle = f === 4 ? '#5a4aa8' : '#c2185b'; for (const [dx, dy] of [[-0.3, 0.05], [0.25, -0.15], [0.05, 0.2]]) { c.beginPath(); c.arc(x + dx * R, y + dy * R, R * 0.07, 0, Math.PI * 2); c.fill(); } }
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = fingTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function sounds(f, add, won, mini, last) {
  fingSounds(f, add); return;   // someone else's attempt as it replays (its bounces, catches, flips), then the result
}
