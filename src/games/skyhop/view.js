// Sky Hop: the screen, the miniature, the move's words and sounds, and the inputs.
import { clamp01 } from '../../core/util.js';
import { FING, HOP, fingAt } from '../shared/finger.js';
import { hopCam, hopPx } from './rules.js';
import { REDUCED, state } from '../../ui/app.js';
import { hash01 } from '../../ui/art.js';
import { fingSounds, fingTable } from '../../ui/finger.js';
import { banner, easeOut, impact, jolt, puff, starPath } from '../../ui/runfx.js';
import { drawTimeBar, outlined, rr, runColours } from '../../ui/runner.js';
import { markSvgG } from '../../ui/thumbs.js';
export { fingerMoveText as moveText } from '../../ui/finger.js';

// The miniature: the shaft between its two stone walls with the bunting at the top, and each player's hopper (a ball
// in their colour with their drawn mark) at the height they have climbed, on its own side, over a column of that colour
// (the climb so far): the picture is the progress.
const HOP_MINI = { y0: 55, y1: 13 };                                // the picture's y at the bottom and at the top
export function miniature(mini, final) {
  const label = `X at ${fingAt(mini, 'X')}, O at ${fingAt(mini, 'O')} of ${mini.cfg.target}`;
  const at = p => HOP_MINI.y0 - (HOP_MINI.y0 - HOP_MINI.y1) * Math.min(1, fingAt(mini, p) / mini.cfg.target);
  const col = (p, x) => { const y = at(p); return `<path class="hcol ${p}" d="M${x} ${HOP_MINI.y0 + 3}V${y.toFixed(1)}"/><rect class="hplank" x="${x - 11}" y="${(y + 7).toFixed(1)}" width="22" height="4.4" rx="2.2"/><g class="hhop ${p}" transform="translate(${x} ${y.toFixed(1)})"><circle class="hb" r="7.4"/>${markSvgG(p, 4.2)}</g>`; };
  const bricks = x => [10, 22, 34, 46].map(y => `<path class="hjoint" d="M${x} ${y}h9"/>`).join('');
  const flags = [18, 28, 38, 50, 62, 72, 82].map((x, j) => `<path class="hflag f${j % 2}" d="M${x - 3} ${(6.4 + 1.6 * (1 - ((x - 50) / 40) ** 2)).toFixed(1)}h6l-3 5.4z"/>`).join('');
  return `<div class="thop" aria-label="${label}"><svg viewBox="0 0 100 62" aria-hidden="true"><rect class="hsky" x="9" y="1.5" width="82" height="59"/><path class="hcloud" d="M16 30q1-5 6-4q3-5 8-1q5 0 4 5zM62 44q1-4 5-3q3-4 7-1q4 0 3 4z"/>`
    + `<path class="hgoal" d="M9 6q41 4 82 0"/>${flags}<rect class="hgrass" x="9" y="56" width="82" height="4.5"/>${col('X', 32)}${col('O', 68)}`
    + `<rect class="hwall" x="1" y="1.5" width="9" height="59"/><rect class="hwall" x="90" y="1.5" width="9" height="59"/>${bricks(1)}${bricks(90)}<rect class="hframe" x="1" y="1.5" width="98" height="59" rx="3"/></svg></div>`;
}

// Sky Hop: the shaft between two stone towers, the sky behind it deeper blue the higher the climb (the sun sinking
// away below, stars coming out near the top), far and near clouds drifting by at their own pace, a tag on the wall
// every 10 m, the bunting at the top, the platforms (grassy planks; puffy cloud planks that slide to and fro; biscuits
// that crumble after one bounce), the burrs to keep clear of, the other player's height as a pennant on the right
// wall, and the hopper: a round sprout in the player's colour, squashed as it lands and stretched as it flies, its
// eyes on where it is going. What a bounce kicks up (dust, leaves, crumbs, the platform's dip) is read from the
// attempt's own notes (v.ev: ui/finger.js fingStep) against the attempt's clock, so a replay shows what the player saw.
// Nothing here moves a platform's top or ends, a burr or the hopper from where the rules have them.
export const HOPV = { squash: 0.15, dip: 0.28, dust: 0.4, crumb: 0.55, confetti: 1100, poof: 480 };   // squash, dip, dust, crumb: seconds of the attempt's clock; confetti, poof: ms after the attempt's end
const HOP_STONE = '#a7afba', HOP_STONE_LIT = '#c6ccd4';
export function drawHop(c, W, H, v, now) {
  const P = runColours(), sim = v.sim, cfg = sim.cfg, Wm = HOP.w;
  const k = Math.min(W / Wm, H / 11), ox = (W - Wm * k) / 2, cam = hopCam(sim), top = cam + H / k;
  const Y = m => H - (m - cam) * k, f = clamp01(cam / cfg.target);
  const endMs = v.end && v.endAt ? Math.max(0, now - v.endAt) : 0, te = sim.t + Math.min(2000, endMs) / 1000;   // the scene's clock: the attempt's own, running on a little past its end (the dust settles)
  const ev = v.still ? [] : v.ev || [], faceL = Math.max(ox, 4), faceR = Math.min(ox + Wm * k, W - 4);
  c.save();
  if (v.end === 'hazard') jolt(c, W, H, { crash: true }, { at: v.endAt }, now);   // (hitting a burr kicks the scene; the words and the time bar over it stay still)
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, `hsl(${206 + 34 * f}, 68%, ${72 - 18 * f}%)`); sky.addColorStop(1, `hsl(${198 + 26 * f}, 72%, ${88 - 14 * f}%)`);
  c.fillStyle = sky; c.fillRect(-10, -10, W + 20, H + 20);
  const sx = ox + Wm * k * 0.86, sy = H * 0.2 + cam * k * 0.1;   // the sun by the right tower, left behind below as the climb goes on (pale: the planks read over it)
  if (sy < H + 2 * k) { puff(c, sx, sy, k * 1.35, 0.22, '255, 246, 205'); puff(c, sx, sy, k * 0.9, 0.32, '255, 246, 205'); puff(c, sx, sy, k * 0.55, 0.8, '255, 250, 228'); }
  if (f > 0.45) {                                                  // the first stars, near the top
    c.fillStyle = P.paper; c.globalAlpha = clamp01((f - 0.45) / 0.35) * 0.9;
    for (let j = 0; j < 14; j++) { const x = ox + hash01(j + 300) * Wm * k, y = (hash01(j + 340) * H + cam * k * 0.03) % H; starPath(c, x, y, k * (0.09 + 0.07 * hash01(j + 380)), 4, 0, 0.35); c.fill(); }
    c.globalAlpha = 1;
  }
  const hillY = H - k * 0.7 + (cam + 2) * k * 0.3;                 // far hills, sinking away at a third of the climb
  if (hillY < H + k * 2) for (const [dy, amp, per, col] of [[0, 0.9, 61, '#b4dccb'], [k * 0.75, 0.6, 43, '#9ed0a7']]) {
    c.fillStyle = col; c.beginPath(); c.moveTo(-10, H + 10);
    for (let x = -10; x <= W + 10; x += 8) c.lineTo(x, hillY + dy - (Math.sin(x / per + dy) + Math.sin(x / (per * 0.37) + 1)) * k * amp * 0.5);
    c.lineTo(W + 10, H + 10); c.closePath(); c.fill();
  }
  for (const [par, gap, size, alpha, seed] of [[0.22, 5, 0.6, 0.55, 700], [0.45, 4, 1, 0.8, 0]]) {   // clouds: a far layer and a near one, each at its own share of the climb
    const pc = cam * par;
    for (let j = Math.floor(pc / gap) - 1; j <= Math.floor((pc + H / k) / gap) + 1; j++) {
      const x = ox + hash01(j + seed) * Wm * k, y = H - (j * gap - pc) * k, s = (0.7 + hash01(j + seed + 50) * 0.6) * size * k;
      hopCloud(c, x, y, s, alpha);
    }
  }
  if (cam < 0.5) {                                                 // the meadow at the bottom
    const gy = Y(0);
    c.beginPath(); c.moveTo(-10, gy + k * 0.3);
    for (let x = -10; x <= W + 10; x += 10) c.lineTo(x, gy + k * 0.3 - Math.sin(x / 37) * k * 0.15);
    c.lineTo(W + 10, H + 10); c.lineTo(-10, H + 10); c.closePath(); outlined(c, '#8fcf6a', P.ink, 2.5);
    c.strokeStyle = '#6fb551'; c.lineWidth = 2; c.lineCap = 'round';
    for (let j = 0; j < 12; j++) { const x = hash01(j + 90) * W, y = gy + k * (0.75 + hash01(j + 120) * 1.1); c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x - 1, y - k * 0.22); c.moveTo(x + 2, y); c.lineTo(x + 4, y - k * 0.18); c.stroke(); }
  }
  const ty = Y(cfg.target);                                        // the top: bunting across the sky
  if (ty > -k && ty < H + k) {
    c.strokeStyle = P.ink; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, ty); c.quadraticCurveTo(W / 2, ty + k * 0.25, W, ty); c.stroke();
    for (let x = 6; x < W; x += Math.max(16, k * 0.7)) { const sag = k * 0.25 * (1 - Math.pow((x - W / 2) / (W / 2), 2)), y = ty + sag; c.beginPath(); c.moveTo(x - k * 0.22, y); c.lineTo(x + k * 0.22, y); c.lineTo(x, y + k * 0.42); c.closePath(); outlined(c, Math.round(x / Math.max(16, k * 0.7)) % 2 ? P.X : P.O, P.ink, 1.5); }
    c.font = `400 ${Math.max(14, Math.round(k * 0.55))}px 'Luckiest Guy', 'Arial Black', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.fillStyle = P.paper; c.strokeStyle = P.ink; c.lineWidth = 4;
    c.strokeText('TOP', W / 2, ty - k * 0.45); c.fillText('TOP', W / 2, ty - k * 0.45);
  }
  if (v.rival && v.rival.h > 0.5) {                                // the other player's height: a dashed line across the sky (its pennant on the wall is drawn with the walls)
    const ry = Y(v.rival.h);
    if (ry > -4 && ry < H + 4) { c.save(); c.strokeStyle = 'rgba(22, 18, 16, .3)'; c.lineWidth = 2; c.setLineDash([6, 7]); c.beginPath(); c.moveTo(faceL, ry); c.lineTo(faceR, ry); c.stroke(); c.restore(); }
  }
  const dips = {};                                                 // the platforms just bounced on: each dips under the hopper and springs back
  if (!REDUCED) for (const e of ev) { const a = te - e.t; if (e.on >= 0 && a >= 0 && a < HOPV.dip) dips[e.on] = a / HOPV.dip; }
  if (sim.t <= FING.grace) {                                       // the start ledge: a stone bridge across the whole sky, gone once the grace is up
    const y = Y(sim.h0), a = v.still ? 1 : Math.min(1, (FING.grace - sim.t) / 0.5), th = Math.max(8, k * 0.36);
    c.save(); c.globalAlpha = a;
    rr(c, -6, y, W + 12, th, 4); outlined(c, HOP_STONE_LIT, P.ink, 2.5);
    c.fillStyle = HOP_STONE; c.fillRect(-4, y + th * 0.55, W + 8, th * 0.45 - 1.5);
    c.fillStyle = 'rgba(22, 18, 16, .3)'; for (let x = 10; x < W; x += k * 1.3) c.fillRect(x, y + 2, 2, th - 4);
    c.restore();
  }
  for (let i = sim.lo; i < sim.plats.length; i++) {
    const q = sim.plats[i];
    if (q.y > top + 0.6) break;
    if (q.y < cam - 0.8) continue;
    const b = v.brk && v.brk[i], gone = sim.gone[i] ? (b != null ? (te - b) / HOPV.crumb : 2) : 0;
    if (gone > 1) continue;
    const u = dips[i], dip = u == null ? 0 : k * 0.16 * Math.sin(Math.PI * Math.min(1, u * 1.6)) * (1 - u);
    hopPlat(c, ox + hopPx(q, sim.t) * k, Y(q.y) + dip, q.w * k, Math.max(8, 0.36 * k), q, gone, P, i);
  }
  for (const e of ev) {                                            // what each bounce kicked up: dust either side of the feet, and a few leaves off a grassy plank
    const a = te - e.t;
    if (a < 0 || a >= HOPV.dust || REDUCED) continue;
    const u = a / HOPV.dust, X = ox + e.x * k, yy = Y(e.y), kind = e.on >= 0 && sim.plats[e.on] ? sim.plats[e.on].k : 'base';
    for (const s of [-1, 1]) for (let j = 0; j < 3; j++) puff(c, X + s * (0.3 + easeOut(u) * (0.45 + 0.28 * j)) * k, yy - (0.04 + 0.16 * j) * k * easeOut(u), k * (0.13 + 0.05 * j) * (1 - 0.35 * u), 0.8 * (1 - u) * (1 - u));
    if (kind === 'n') { c.fillStyle = '#6fb551'; for (let j = 0; j < 4; j++) { const s = j % 2 ? 1 : -1, lx = X + s * (0.2 + u * (0.5 + 0.2 * j)) * k, ly = yy - (1.1 + 0.3 * j) * k * u * (1 - u) * 1.6; c.save(); c.globalAlpha = 1 - u; c.translate(lx, ly); c.rotate(s * u * 4 + j); c.beginPath(); c.ellipse(0, 0, k * 0.11, k * 0.05, 0, 0, Math.PI * 2); c.fill(); c.restore(); } }
  }
  for (const hz of sim.haz) { if (hz.y < cam - 1.2) continue; if (hz.y > top + 1.2) break; hopBurr(c, ox + hz.x * k, Y(hz.y), HOP.haz * k, now, P); }
  const hx = ox + sim.x * k, hy = Y(sim.y + HOP.bodyY), R = Math.max(9, HOP.body * k * 1.2);
  if (!v.end) hopShade(c, sim, k, ox, Y, R);
  hopHopper(c, hx, hy, R, sim, v, now, P, k);
  if (v.end === 'hazard') impact(c, hx, hy, R * 2.3, { at: v.endAt }, now, P, '#a77ff0');   // the burr's burst, once, as the hopper tumbles
  if (v.end === 'fall' && endMs < HOPV.poof && !REDUCED) { const u = endMs / HOPV.poof; for (let j = -2; j <= 2; j++) puff(c, hx + j * k * 0.4 * (0.6 + u), H - k * (0.1 + 0.5 * u) * (1 - Math.abs(j) * 0.25), k * (0.42 - 0.07 * Math.abs(j)) * (0.6 + 0.7 * u), 0.85 * (1 - u)); }   // gone off the bottom: a puff where it went
  if (v.end === 'top' && v.endAt) {                                // the top: rays, and confetti in the game's colours
    const u = Math.min(1, endMs / 600);
    c.strokeStyle = P.paper; c.lineWidth = 3; c.lineCap = 'round';
    for (let r = 0; r < 10; r++) { const a = r * Math.PI / 5; c.beginPath(); c.moveTo(hx + Math.cos(a) * R * (1.2 + u), hy + Math.sin(a) * R * (1.2 + u)); c.lineTo(hx + Math.cos(a) * R * (1.6 + 2 * u), hy + Math.sin(a) * R * (1.6 + 2 * u)); c.stroke(); }
    hopConfetti(c, hx, hy, k, endMs / HOPV.confetti, P);
  }
  // the walls: a stone tower either side of the sky (the sides are walls), its courses climbing with the camera, its shade on the sky beside it
  const bh = 0.62, bw = k * 1.25;
  for (const [x0, x1, face, s] of [[-10, faceL, faceL, 1], [faceR, W + 10, faceR, -1]]) {
    c.fillStyle = HOP_STONE; c.fillRect(x0, -10, x1 - x0, H + 20);
    c.save(); c.beginPath(); c.rect(x0, -10, x1 - x0, H + 20); c.clip();
    c.fillStyle = 'rgba(22, 18, 16, .26)';
    for (let m = Math.floor(cam / bh) - 1; m * bh <= top + bh; m++) {
      const y = Y(m * bh);
      c.fillRect(x0, y - 1, x1 - x0, 2);
      for (let x = face - s * (bw * ((m & 1) ? 0.5 : 1)); s > 0 ? x > x0 : x < x1; x -= s * bw) c.fillRect(x - 1, y - bh * k, 2, bh * k);
    }
    c.restore();
    c.fillStyle = HOP_STONE_LIT; c.fillRect(s > 0 ? face - 3 : face, -10, 3, H + 20);
    c.fillStyle = P.ink; c.fillRect(face - 1, -10, 2, H + 20);                // its face, towards the sky
    const g = c.createLinearGradient(face, 0, face + s * k * 0.55, 0); g.addColorStop(0, 'rgba(22, 18, 16, .2)'); g.addColorStop(1, 'rgba(22, 18, 16, 0)');
    c.fillStyle = g; c.fillRect(s > 0 ? face + 1 : face - 1 - k * 0.55, -10, k * 0.55, H + 20);
  }
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  const px = Math.max(10, Math.round(k * 0.34));                   // a tag every 10 m: on the left tower where it is wide enough, else on its face, in the sky
  c.font = `800 ${px}px Nunito, Arial, sans-serif`;
  for (let m = Math.max(10, Math.ceil((cam - 1) / 10) * 10); m <= top + 1; m += 10) {
    if (m >= cfg.target) break;
    const y = Y(m), tw = Math.max(px * 2.1, c.measureText(String(m)).width + 9), th = px + 6, x0 = faceL >= tw + 7 ? faceL - tw - 5 : faceL + 4;
    c.fillStyle = P.ink; c.fillRect(Math.min(x0 + tw, faceL), y - 1, Math.abs(faceL - (x0 + tw)) + (x0 > faceL ? 0 : 5), 2);
    rr(c, x0, y - th / 2, tw, th, 4); outlined(c, P.paper, P.ink, 1.8);
    c.fillStyle = P.ink; c.fillText(String(m), x0 + tw / 2, y + 0.5);
  }
  if (v.rival && v.rival.h > 0.5) {                                // the other player's pennant, on the right tower's face at their height
    const ry = Y(v.rival.h), s = Math.max(9, k * 0.42), wv = REDUCED ? 0 : Math.sin(now / 260) * s * 0.12;
    if (ry > -s && ry < H + s) { c.beginPath(); c.moveTo(faceR, ry - s * 0.62); c.quadraticCurveTo(faceR - s * 0.8, ry - s * 0.3 + wv, faceR - s * 1.5, ry + wv); c.quadraticCurveTo(faceR - s * 0.8, ry + s * 0.3 + wv, faceR, ry + s * 0.62); c.closePath(); c.lineJoin = 'round'; outlined(c, v.rival.p === 'O' ? P.O : P.X, P.ink, 2.2); }
  }
  c.restore();
  if (!v.still && !v.end && sim.n > 0 && sim.t < 0.7) { c.save(); c.translate(W * 0.17, 0); banner(c, W * 0.66, H * 0.66, 'GO!', { at: now - sim.t * 1000 }, now, P, 0.3, (sim.t * 1000 - 580) / 120); c.restore(); }   // the start's word, small and high (clear of the hopper's first bounce), as it leaves the ledge
  if (v.end === 'time') banner(c, W, H, 'TIME!', { at: v.endAt }, now, P);
  if (!v.still && sim.n > 0 && sim.cap) drawTimeBar(c, W, H, 1 - sim.t / sim.cap, P);   // the attempt's time limit: its countdown bar (live and in a replay, from the attempt's own clock)
}
function hopCloud(c, x, y, s, alpha) {                           // a cloud: three lobes over a flat foot, a pale shade under it
  c.save(); c.globalAlpha = alpha;
  for (const [fill, dy] of [['#cfe3f4', s * 0.1], ['#ffffff', 0]]) {
    c.fillStyle = fill;
    for (const [dx, ddy, rx, ry] of [[0, 0, 1.1, 0.36], [0.72, -0.2, 0.7, 0.33], [-0.6, -0.1, 0.52, 0.27]]) { c.beginPath(); c.ellipse(x + dx * s, y + ddy * s + dy, rx * s, ry * s, 0, 0, Math.PI * 2); c.fill(); }
  }
  c.restore();
}
// A platform: its top edge at y and its ends w apart are where the rules have them; all its body hangs below.
function hopPlat(c, X, y, w, th, q, gone, P, i) {
  c.save();
  if (gone > 0) c.globalAlpha = 1 - gone * gone;
  else { c.fillStyle = 'rgba(22, 18, 16, .1)'; c.beginPath(); c.ellipse(X + 2, y + th + 3, w * 0.45, th * 0.26, 0, 0, Math.PI * 2); c.fill(); }   // its soft shade on the air below
  if (q.k === 'b') {                                               // a biscuit: cracked, and in two halves with crumbs once broken
    const halves = gone > 0 ? [[-1, -w / 2, 0], [1, 0, w / 2]] : [[0, -w / 2, w / 2]];
    for (const [s, a, b] of halves) {
      c.save(); c.translate(X + s * gone * th * 2, y + gone * gone * th * 5); c.rotate(s * gone * 0.9);
      rr(c, a, 0, b - a, th, th / 2.6); outlined(c, '#e9bd76', P.ink, 2.2);
      c.save(); c.clip(); c.fillStyle = '#c9934c'; c.fillRect(a, th * 0.62, b - a, th * 0.4); c.fillStyle = 'rgba(255, 255, 255, .4)'; c.fillRect(a + 3, 2.2, b - a - 6, 1.8); c.restore();
      c.fillStyle = '#7a4a22'; for (const d of [-0.34, -0.17, 0.16, 0.33]) { if (d * w < a + 3 || d * w > b - 3) continue; c.beginPath(); c.arc(d * w, th * 0.42, Math.max(1.4, th * 0.13), 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
    if (!gone) { c.strokeStyle = P.ink; c.lineWidth = 1.6; c.lineJoin = 'round'; c.beginPath(); c.moveTo(X - w * 0.05, y + 1); c.lineTo(X + w * 0.04, y + th * 0.45); c.lineTo(X - w * 0.03, y + th - 1); c.stroke(); }
    else if (!REDUCED) { c.fillStyle = '#c9934c'; for (let j = 0; j < 7; j++) { const hx = (hash01(i * 7 + j) - 0.5) * w, vx = (hash01(i * 7 + j + 40) - 0.5) * th * 6; c.fillRect(X + hx + vx * gone - 1.5, y + th * 0.5 - th * 1.5 * gone + gone * gone * th * (5 + 3 * hash01(j + 9)), 3, 3); } }
  } else if (q.k === 'm') {                                        // a cloud plank that slides: puffs along its top, arrows at its ends
    rr(c, X - w / 2, y, w, th, th / 2); outlined(c, '#eaf6ff', P.ink, 2.2);
    c.save(); c.clip(); c.fillStyle = '#b5dcf5'; c.fillRect(X - w / 2, y + th * 0.6, w, th * 0.5); c.restore();
    c.fillStyle = '#ffffff'; c.strokeStyle = P.ink; c.lineWidth = 2;
    for (const [d, r] of [[-0.2, 0.2], [0.13, 0.24]]) { c.beginPath(); c.ellipse(X + d * w, y + 1, w * r * 0.8, th * 0.5, 0, Math.PI, 0); c.fill(); c.stroke(); }
    c.fillStyle = P.ink; for (const s of [-1, 1]) { const ax = X + s * (w / 2 - th * 0.5); c.beginPath(); c.moveTo(ax + s * th * 0.3, y + th * 0.52); c.lineTo(ax - s * th * 0.14, y + th * 0.24); c.lineTo(ax - s * th * 0.14, y + th * 0.8); c.closePath(); c.fill(); }
  } else {                                                         // a plank of wood under a cap of grass
    rr(c, X - w / 2, y, w, th, th / 2.4); outlined(c, '#b98549', P.ink, 2.2);
    c.save(); c.clip();
    c.fillStyle = '#8a5a2b'; c.fillRect(X - w / 2, y + th * 0.8, w, th * 0.3);
    c.fillStyle = '#7cc95a'; c.beginPath(); c.moveTo(X - w / 2 - 2, y - 2); c.lineTo(X + w / 2 + 2, y - 2); c.lineTo(X + w / 2 + 2, y + th * 0.5);
    for (let j = 6; j >= 0; j--) c.lineTo(X - w / 2 + (w * j) / 6, y + th * (j % 2 ? 0.62 : 0.42));
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(255, 255, 255, .38)'; c.fillRect(X - w / 2 + 4, y + 2, w - 8, 1.8);
    c.restore();
    rr(c, X - w / 2, y, w, th, th / 2.4); c.lineWidth = 2.2; c.strokeStyle = P.ink; c.stroke();
  }
  c.restore();
}
function hopBurr(c, X, y, r, now, P) {                           // a burr: a spiky purple seed ball with a cross look
  c.save(); c.translate(X, y); c.rotate(REDUCED ? 0 : Math.sin(now / 380 + X) * 0.25);
  c.beginPath();
  for (let s = 0; s < 22; s++) { const a = (s * Math.PI) / 11, rr2 = s % 2 ? r * 0.72 : r * 1.12; c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
  c.closePath(); c.lineJoin = 'round'; outlined(c, '#8d5bd8', P.ink, 2);
  c.beginPath(); c.arc(0, 0, r * 0.55, 0, Math.PI * 2); c.fillStyle = '#a77ff0'; c.fill();
  c.fillStyle = 'rgba(255, 255, 255, .3)'; c.beginPath(); c.ellipse(-r * 0.2, -r * 0.34, r * 0.2, r * 0.09, -0.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(-r * 0.22, -r * 0.08, r * 0.17, 0, Math.PI * 2); c.arc(r * 0.22, -r * 0.08, r * 0.17, 0, Math.PI * 2); c.fill();
  c.fillStyle = P.ink; c.beginPath(); c.arc(-r * 0.2, -r * 0.04, r * 0.08, 0, Math.PI * 2); c.arc(r * 0.2, -r * 0.04, r * 0.08, 0, Math.PI * 2); c.fill();
  c.strokeStyle = P.ink; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-r * 0.38, -r * 0.32); c.lineTo(-r * 0.08, -r * 0.2); c.moveTo(r * 0.38, -r * 0.32); c.lineTo(r * 0.08, -r * 0.2); c.stroke();
  c.restore();
}
// The hopper's shade on what is right under it (a platform, the start ledge) once it is close: it lands with weight.
function hopShade(c, sim, k, ox, Y, R) {
  const near = 1.7;
  let py = null, a = 0, b = 0;
  if (sim.t <= FING.grace && sim.y >= sim.h0 && sim.y - sim.h0 < near) { py = sim.h0; a = -1e4; b = 1e4; }
  for (let i = sim.lo; i < sim.plats.length; i++) {
    const q = sim.plats[i];
    if (q.y > sim.y + 0.02) break;
    if (sim.gone[i] || sim.y - q.y > near) continue;
    const px = hopPx(q, sim.t);
    if (Math.abs(sim.x - px) <= q.w / 2 + HOP.foot) { py = q.y; a = ox + (px - q.w / 2) * k; b = ox + (px + q.w / 2) * k; }
  }
  if (py == null) return;
  const d = Math.max(0, sim.y - py) / near, y = Y(py);
  c.save(); c.beginPath(); c.rect(a + 2, y - 3, b - a - 4, 8); c.clip();
  c.fillStyle = `rgba(22, 18, 16, ${(0.3 * (1 - d)).toFixed(3)})`; c.beginPath(); c.ellipse(ox + sim.x * k, y + 2.5, R * (1 - 0.45 * d), Math.max(2, R * 0.2), 0, 0, Math.PI * 2); c.fill();
  c.restore();
}
function hopConfetti(c, x, y, k, u, P) {
  if (u >= 1 || REDUCED) return;
  const cols = [P.X, P.O, P.green, P.sky, P.paper];
  c.save(); c.globalAlpha = 1 - u * u * u;
  for (let j = 0; j < 18; j++) {
    const a = hash01(j + 11) * Math.PI * 2, sp = (2.2 + 3.4 * hash01(j + 31)) * k, e = easeOut(u);
    c.save(); c.translate(x + Math.cos(a) * sp * e, y + Math.sin(a) * sp * e * 0.8 - k * 0.8 * e + u * u * k * 3.2); c.rotate(a + u * (6 + j));
    c.fillStyle = cols[j % cols.length]; c.strokeStyle = P.ink; c.lineWidth = 1.2; c.beginPath(); c.rect(-k * 0.11, -k * 0.07, k * 0.22, k * 0.14); c.fill(); c.stroke();
    c.restore();
  }
  c.restore();
}
function hopHopper(c, X, y, R, sim, v, now, P, k) {
  const col = v.p === 'O' ? P.O : P.X, hit = v.end === 'hazard' || v.end === 'time';   // (the time limit ends it as a crash would)
  const b = sim.cfg.bounce, moving = !v.still && !v.end && !REDUCED;
  const tb = Math.max(0, (b - sim.vy) / HOP.g), q = moving ? Math.max(0, 1 - tb / HOPV.squash) : 0;   // tb: seconds since the last bounce (its speed tells: up at the bounce speed, slowing at g); q: 1 as it lands, 0 once it has sprung back
  const s = v.still ? 0 : Math.min(0.2, (Math.abs(sim.vy) / b) * 0.16), sy = 1 + s * (1 - q) - 0.3 * q * q, sx = 1 - s * 0.6 * (1 - q) + 0.24 * q * q;
  const look = v.tx != null ? Math.max(-1, Math.min(1, (v.tx - sim.x) / 1.5)) : 0, fast = Math.abs(sim.vy) / b;
  if (moving && fast > 0.5) {                                      // streaks of air behind it while it is fast
    const dir = sim.vy > 0 ? 1 : -1;
    c.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.75, (fast - 0.5) * 1.6).toFixed(3)})`; c.lineWidth = 2; c.lineCap = 'round';
    for (const dx of [-0.55, 0, 0.55]) { c.beginPath(); c.moveTo(X + dx * R, y + dir * R * (1.35 + Math.abs(dx) * 0.2)); c.lineTo(X + dx * R, y + dir * R * (1.5 + fast * (dx ? 0.7 : 1.1))); c.stroke(); }
  }
  c.save(); c.translate(X, y);
  if (hit && v.endAt) { const u = Math.min(1, (now - v.endAt) / 700); c.translate(0, u * u * R * 4); c.rotate(u * 5); }
  else if (v.end === 'fall' && v.endAt) { const u = Math.min(1.2, (now - v.endAt) / 1000); c.translate(0, (Math.max(0, -sim.vy) * u + 0.5 * HOP.g * u * u) * k); }   // gone off the bottom: it falls on out of sight
  else if (moving) c.rotate(look * 0.14);                          // leaning the way it is steered
  c.translate(0, R); c.scale(sx, sy); c.translate(0, -R);          // squashed and stretched about its feet
  c.fillStyle = P.ink; c.beginPath(); c.ellipse(-R * 0.42, R * 0.92, R * 0.3, R * 0.17, 0, 0, Math.PI * 2); c.ellipse(R * 0.42, R * 0.92, R * 0.3, R * 0.17, 0, 0, Math.PI * 2); c.fill();   // feet
  const sway = v.still ? 0 : Math.max(-0.5, Math.min(0.5, -sim.vy / b * 0.4));
  c.strokeStyle = P.ink; c.lineWidth = 2.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -R * 0.95); c.quadraticCurveTo(R * sway * 0.6, -R * 1.35, R * sway, -R * 1.55); c.stroke();   // the sprout
  c.save(); c.translate(R * sway, -R * 1.5); c.rotate(-0.6 + sway); c.beginPath(); c.ellipse(-R * 0.28, 0, R * 0.32, R * 0.15, 0, 0, Math.PI * 2); outlined(c, '#7cc95a', P.ink, 1.8); c.rotate(1.2); c.beginPath(); c.ellipse(R * 0.28, 0, R * 0.3, R * 0.14, 0, 0, Math.PI * 2); outlined(c, '#7cc95a', P.ink, 1.8); c.restore();
  c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); outlined(c, col, P.ink, 2.8);
  c.save(); c.clip(); c.fillStyle = 'rgba(22, 18, 16, .16)'; c.beginPath(); c.arc(R * 0.3, -R * 0.3, R * 1.02, 0, Math.PI * 2); c.rect(R * 2, -R * 2, -R * 4, R * 4); c.fill('evenodd'); c.restore();   // its shaded side (the light from the upper right: the sun)
  c.fillStyle = 'rgba(255, 255, 255, .4)'; c.beginPath(); c.ellipse(R * 0.35, -R * 0.5, R * 0.26, R * 0.15, 0.5, 0, Math.PI * 2); c.fill();
  if (hit) { c.strokeStyle = P.ink; c.lineWidth = 2.2; for (const ex of [-0.32, 0.32]) { c.beginPath(); c.moveTo(R * (ex - 0.12), -R * 0.22); c.lineTo(R * (ex + 0.12), R * 0.02); c.moveTo(R * (ex + 0.12), -R * 0.22); c.lineTo(R * (ex - 0.12), R * 0.02); c.stroke(); } }
  else {
    const ey = v.still ? 0 : sim.vy < 0 ? R * 0.06 : -R * 0.04;
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(-R * 0.3, -R * 0.12, R * 0.22, R * 0.27, 0, 0, Math.PI * 2); c.ellipse(R * 0.3, -R * 0.12, R * 0.22, R * 0.27, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = P.ink; c.lineWidth = 1.6; c.stroke();
    c.fillStyle = P.ink; c.beginPath(); c.arc(-R * 0.3 + look * R * 0.1, -R * 0.08 + ey, R * 0.11, 0, Math.PI * 2); c.arc(R * 0.3 + look * R * 0.1, -R * 0.08 + ey, R * 0.11, 0, Math.PI * 2); c.fill();
    c.strokeStyle = P.ink; c.lineWidth = 2;
    if (!v.still && sim.vy < -b * 0.35) { c.beginPath(); c.ellipse(0, R * 0.38, R * 0.11, R * 0.14, 0, 0, Math.PI * 2); c.fillStyle = P.ink; c.fill(); }   // an "o" on the way down
    else { c.beginPath(); c.arc(0, R * 0.28, R * 0.2, 0.25, Math.PI - 0.25); c.stroke(); }
  }
  c.restore();
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = fingTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function sounds(f, add, won, mini, last) {
  fingSounds(f, add); return;   // someone else's attempt as it replays (its bounces, catches, flips), then the result
}
