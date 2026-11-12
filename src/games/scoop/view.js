// Scoop Stack: the screen, the miniature, the move's words and sounds, and the inputs.
import { SCOOP, SCOOP_VIEW } from './rules.js';
import { REDUCED, state } from '../../ui/app.js';
import { hash01 } from '../../ui/art.js';
import { fingSounds, fingTable, fingThing } from '../../ui/finger.js';
import { banner, easeOut, impact, jolt, puff, starPath } from '../../ui/runfx.js';
import { drawTimeBar, outlined, rr, runColours } from '../../ui/runner.js';
import { fingAt } from '../shared/finger.js';
// The miniature: the counter with each player's cone (a sleeve in their colour) and their scoops stacked on it, the
// stack as tall as their share of the target (the dashed line across the top is the target: a full stack reaches it),
// and under the counter each player's count (in the page, as large as the board's other text; inside the drawing it
// would shrink with it).
const SCOOP_FLAVS = 5;   // (the flavours' colours: styles.css .tscoop .f0-.f4)
const SCOOP_MINI = { rim: 40, top: 1, r: 6.6 };                     // the cone's rim and the target's line (the picture's y), a scoop's radius
export function miniature(mini, final) {
  const label = `X at ${fingAt(mini, 'X')}, O at ${fingAt(mini, 'O')} of ${mini.cfg.target}`;
  const M = SCOOP_MINI, step = Math.min(5.4, (M.rim - 3.4 - M.r - M.top) / Math.max(1, mini.cfg.target - 1));   // a scoop's rise: a full stack's top is at the line
  const cone = (p, cx) => {
    const n = fingAt(mini, p), fl = mini.stack[p], f = j => (fl[j] == null ? j : fl[j]) % SCOOP_FLAVS, g = Math.max(1, Math.ceil(2.6 / step)), top = M.rim - 3.4 - (n - 1) * step;
    let stack = '';                                                 // the stack: one outline round it all (scoop on scoop, their outlines would run into one black bar), a band of its flavour for every g scoops, the top one's dome
    if (n > 0) {
      for (let j = 0; j + g < n; j += g) stack += `<rect class="sb f${f(j)}" x="${cx - M.r}" y="${(M.rim - 3.4 - (j + g) * step + step / 2).toFixed(1)}" width="${2 * M.r}" height="${(g * step + (j ? 0 : 3.4 - step / 2) + 0.2).toFixed(1)}"/>`;
      stack = `<path class="sc f${f(n - 1)}" d="M${cx - M.r} ${M.rim}V${top.toFixed(1)}a${M.r} ${M.r} 0 0 1 ${2 * M.r} 0V${M.rim}z"/>${stack}<path class="so" d="M${cx - M.r} ${M.rim}V${top.toFixed(1)}a${M.r} ${M.r} 0 0 1 ${2 * M.r} 0V${M.rim}"/><path class="sgl" d="M${cx - 3.6} ${(top - 1.6).toFixed(1)}q1.2 -2.4 3.6 -2.6"/>`;
    }
    return `${stack}<path class="cone" d="M${cx - 8.5} ${M.rim}h17l-8.5 16z"/><path class="slv ${p}" d="M${cx - 5.6} ${M.rim + 5.4}h11.2l-2.9 5.4h-5.4z"/>`;
  };
  return `<div class="tscoop" aria-label="${label}"><svg viewBox="0 -5 100 67" aria-hidden="true"><rect class="swall" x="1" y="-4" width="98" height="60" rx="3"/><path class="sstripe" d="M17 -4v60M33 -4v60M50 -4v60M67 -4v60M83 -4v60"/><path class="sgoal" d="M6 ${M.top}h88"/>`
    + `<rect class="ctr" x="1" y="56" width="98" height="5.5" rx="1.5"/>${cone('X', 28)}${cone('O', 72)}</svg>`
    + `<div class="tswn" aria-hidden="true"><span class="X">${fingAt(mini, 'X')}</span><span class="O">${fingAt(mini, 'O')}</span></div></div>`;
}
export { fingerMoveText as moveText } from '../../ui/finger.js';

// Scoop Stack: a parlour wall under a scalloped awning, the counter, the cone (a waffle in a paper sleeve of the
// player's colour) with the stack leaning with its sway, the scoops and the bad things falling to the top of it
// (pebbles; burnt scoops, charred and smoking), a scoop that lands off-centre sliding off, and the misses allowed.
// What a landing does (the caught scoop's squash, its drops, the splat of a missed one at the bottom edge, a miss's
// cone crossed out) is read from the attempt's own notes (v.out, v.ev: ui/finger.js fingStep) against the attempt's
// clock, so a replay shows what the player saw. Nothing here moves a falling thing, the cone or the stack's top
// sideways from where the rules have them; a catch only squashes the scoop down onto the stack for a moment.
const SCOOP_FLAV = ['#f59ab5', '#8fe0b5', '#fff1c9', '#e8b06a', '#b3a4f5'];   // strawberry, mint, vanilla, caramel, blueberry
const SCOOP_DARK = ['#d9698c', '#58b98a', '#e6cf93', '#c0823f', '#8474d6'];   // each one's shaded side
export const SCOOPV = { squash: 0.3, settle: 0.15, drops: 0.34, splat: 0.42, lost: 0.4, cherry: 520, confetti: 1000 };   // squash, settle, drops, splat, lost: seconds of the attempt's clock; cherry, confetti: ms after the attempt's end
export function drawScoop(c, W, H, v, now) {
  const P = runColours(), sim = v.sim, Wu = SCOOP.w;
  const k = Math.min(W / Wu, H / 15.5), ox = (W - Wu * k) / 2, X = x => ox + x * k;
  const endMs = v.end && v.endAt ? Math.max(0, now - v.endAt) : 0, te = sim.t + Math.min(2000, endMs) / 1000;   // the scene's clock: the attempt's own, running on a little past its end
  const stack = v.stack || [], n = stack.length, live = !v.still && !REDUCED;
  const sq = {};                                                    // the scoops just caught: each squashes onto the stack and springs back
  let settle = 1;                                                   // and the view follows the stack's new top over a moment, not at a jump
  if (live && v.out) for (let j = Math.max(0, sim.i - 6); j < sim.i; j++) { const o = v.out[j]; if (!o || o.o !== 'catch' || o.n == null) continue; const a = te - o.t; if (a >= 0 && a < SCOOPV.squash) sq[o.n] = a / SCOOPV.squash; if (a >= 0 && a < SCOOPV.settle) settle = Math.min(settle, a / SCOOPV.settle); }
  const nEff = n - (1 - easeOut(settle));
  c.save();
  if (v.end === 'hazard' || v.end === 'miss') jolt(c, W, H, { crash: true }, { at: v.endAt }, now);   // (a nasty catch or the last miss kicks the scene; the words and the time bar over it stay still)
  c.fillStyle = '#fff6f1'; c.fillRect(-10, -10, W + 20, H + 20);
  c.fillStyle = '#fbdde1'; for (let x = ox + k * 0.2; x < ox + Wu * k; x += k * 1.2) c.fillRect(x, -10, k * 0.6, H + 20);
  const counterY = H - 0.45 * k, coneH = 1.7, rim0 = counterY - coneH * k, top0 = rim0 - nEff * SCOOP.piece * k;
  const sh = Math.max(0, H - SCOOP_VIEW.top * k - top0), rimY = rim0 + sh, tipY = counterY + sh, topY = top0 + sh;   // a tall stack: the view follows its top
  const dado = counterY + sh - 3.1 * k;                             // the wall's lower panel and its rail
  if (dado < H + 10) { c.fillStyle = 'rgba(214, 120, 140, .16)'; c.fillRect(-10, dado, W + 20, H + 20 - dado); c.fillStyle = '#e9a9b5'; c.fillRect(-10, dado - 2, W + 20, 4); }
  if (ox > 5) for (const [x0, x1, face, s] of [[-10, ox, ox, 1], [ox + Wu * k, W + 10, ox + Wu * k, -1]]) {   // a phone wider than the play area: a painted pilaster either side of it (the cone and the scoops keep between them)
    c.fillStyle = '#bfe3ee'; c.fillRect(x0, -10, x1 - x0, H + 20);
    c.fillStyle = '#d9f0f6'; c.fillRect(s > 0 ? face - Math.min(ox * 0.5, k * 0.9) : face + Math.min(ox * 0.5, k * 0.9) - Math.min(ox * 0.22, k * 0.4), -10, Math.min(ox * 0.22, k * 0.4), H + 20);
    c.fillStyle = P.ink; c.fillRect(face - 1.25, -10, 2.5, H + 20);
    const g = c.createLinearGradient(face, 0, face + s * k * 0.5, 0); g.addColorStop(0, 'rgba(22, 18, 16, .14)'); g.addColorStop(1, 'rgba(22, 18, 16, 0)');
    c.fillStyle = g; c.fillRect(s > 0 ? face + 1 : face - 1 - k * 0.5, -10, k * 0.5, H + 20);
  }
  const aw = k * 0.35, sc = Math.max(12, k * 0.95);                  // the awning: a scalloped valance across the top (shallow: the counter and the misses sit under it)
  for (let j = 0, x = ox % sc - sc; x < W + 10; x += sc, j++) { c.beginPath(); c.moveTo(x, -10); c.lineTo(x + sc, -10); c.lineTo(x + sc, aw); c.arc(x + sc / 2, aw, sc / 2, 0, Math.PI); c.closePath(); c.fillStyle = j % 2 ? '#bfe3ee' : '#ffffff'; c.fill(); c.lineWidth = 2; c.strokeStyle = P.ink; c.stroke(); }
  if (sh < 0.45 * k + 12) {                                         // the counter: its top's lit edge, its front
    const y = counterY + sh;
    c.fillStyle = '#c98b4b'; c.fillRect(-10, y, W + 20, H + 20); c.fillStyle = '#e3aa68'; c.fillRect(-10, y, W + 20, Math.max(3, k * 0.16)); c.fillStyle = P.ink; c.fillRect(-10, y - 1.5, W + 20, 3);
  }
  const cx = X(sim.x), s = sim.s, R = SCOOP.r * 1.14 * k, lean = i => s * k * Math.pow((i + 1) / Math.max(1, n), 1.6);
  if (rimY < H + 2 * k) {                                          // the cone: a waffle in a paper sleeve of the player's colour
    if (tipY < H + 4) { c.fillStyle = 'rgba(22, 18, 16, .2)'; c.beginPath(); c.ellipse(cx, tipY, k * 0.55, Math.max(2, k * 0.1), 0, 0, Math.PI * 2); c.fill(); }
    const path = () => { c.beginPath(); c.moveTo(cx - 0.66 * k, rimY); c.lineTo(cx + 0.66 * k, rimY); c.lineTo(cx, tipY); c.closePath(); };
    path(); c.lineJoin = 'round'; outlined(c, '#ecbd78', P.ink, 2.5);
    c.save(); c.clip();
    c.fillStyle = 'rgba(150, 90, 30, .22)'; c.beginPath(); c.moveTo(cx - k, rimY); c.lineTo(cx - 0.1 * k, rimY); c.lineTo(cx - 0.02 * k, tipY); c.lineTo(cx - k, tipY); c.closePath(); c.fill();   // its shaded side
    c.strokeStyle = '#c98b4b'; c.lineWidth = 1.4;
    for (let d = -2; d <= 2; d++) { c.beginPath(); c.moveTo(cx + d * 0.32 * k - k, rimY); c.lineTo(cx + d * 0.32 * k + k, tipY); c.moveTo(cx + d * 0.32 * k + k, rimY); c.lineTo(cx + d * 0.32 * k - k, tipY); c.stroke(); }
    c.fillStyle = v.p === 'O' ? P.O : P.X; c.fillRect(cx - k, rimY + coneH * k * 0.42, 2 * k, coneH * k * 0.36);
    c.fillStyle = P.ink; c.fillRect(cx - k, rimY + coneH * k * 0.42 - 1, 2 * k, 2); c.fillRect(cx - k, rimY + coneH * k * 0.78 - 1, 2 * k, 2);
    c.fillStyle = 'rgba(255, 255, 255, .35)'; c.fillRect(cx + 0.12 * k, rimY + coneH * k * 0.42 + 1, 0.12 * k, coneH * k * 0.36 - 2);
    c.restore();
    path(); c.lineWidth = 2.5; c.strokeStyle = P.ink; c.stroke();
    rr(c, cx - 0.74 * k, rimY - 0.13 * k, 1.48 * k, 0.26 * k, 0.13 * k); outlined(c, '#f3cd92', P.ink, 2.2);   // its rim
  }
  for (let i = 0; i < n; i++) {                                     // the stack, leaning with the sway (each scoop's shade on the one under it)
    const y = rimY - (i + 0.55) * SCOOP.piece * k;
    if (y > H + R || y < -R * 2) continue;
    const x = cx + lean(i), u = sq[i];
    if (u == null) { scoopBall(c, x, y, R, stack[i], P); continue; }
    const q = (1 - u) * (1 - u), w = Math.cos(u * 8.5), sy = 1 - 0.34 * q * w, sx = 1 + 0.2 * q * w;   // just landed: down and wide, then up, then still
    c.save(); c.translate(x, y + R * 0.5); c.scale(sx, sy); scoopBall(c, 0, -R * 0.5, R, stack[i], P); c.restore();
  }
  if (live && v.out) for (let j = Math.max(0, sim.i - 6); j < sim.i; j++) {   // a catch's drops: a few beads of its flavour thrown up and out, and a ring
    const o = v.out[j], a = o ? te - o.t : -1;
    if (!o || o.o !== 'catch' || a < 0 || a >= SCOOPV.drops) continue;
    const u = a / SCOOPV.drops, it = sim.items[j], px = X(o.top), py = topY - R * 0.2;
    c.save(); c.globalAlpha = 1 - u * u; c.fillStyle = SCOOP_FLAV[it.f] || SCOOP_FLAV[0]; c.strokeStyle = P.ink; c.lineWidth = 1.3;
    for (let d = 0; d < 6; d++) { const ang = -Math.PI * (0.12 + 0.76 * (d / 5)), sp = k * (1.1 + 0.5 * hash01(j * 6 + d)); c.beginPath(); c.arc(px + Math.cos(ang) * sp * easeOut(u), py + Math.sin(ang) * sp * easeOut(u) + u * u * k * 0.9, Math.max(1.6, k * 0.1 * (1 - u * 0.5)), 0, Math.PI * 2); c.fill(); c.stroke(); }
    c.strokeStyle = 'rgba(255, 255, 255, .9)'; c.lineWidth = 2.5 * (1 - u); c.beginPath(); c.ellipse(px, py, R * (0.9 + 0.9 * easeOut(u)), R * (0.35 + 0.3 * easeOut(u)), 0, 0, Math.PI * 2); c.stroke();
    c.restore();
  }
  const t = sim.t;
  for (let j = Math.max(0, sim.i - 10); j < sim.items.length; j++) {   // the falling things (and what came of those that got to the top)
    const it = sim.items[j], yu = (it.T - t) * it.v;
    if (yu > SCOOP.spawn) break;
    const o = v.out && v.out[j];
    if (j < sim.i) {
      if (!o || o.o === 'catch') continue;
      if (o.gone != null && live && te >= o.gone && te - o.gone < SCOOPV.splat) scoopSplat(c, o.o === 'slide' ? X(o.top) + (it.x >= o.top ? 1 : -1) * (0.5 + ((o.gone - o.t) / SCOOP_VIEW.slideT) * 1.6) * k : X(it.x), H, k, (te - o.gone) / SCOOPV.splat, it.f, P);   // a missed scoop gone off the bottom: its splat on the edge, as the miss counts
      if (o.o === 'slide') { const u = (t - o.t) / SCOOP_VIEW.slideT, yy = topY - R + u * u * SCOOP_VIEW.slide * k; if (yy > H + R) continue; const dir = it.x >= o.top ? 1 : -1; c.save(); c.globalAlpha = 1 - Math.min(1, u) * 0.3; c.translate(X(o.top) + dir * (0.5 + u * 1.6) * k, yy); c.rotate(dir * u * 3); scoopBall(c, 0, 0, R, it.f, P); c.restore(); continue; }   // slid off: it tumbles away and falls off the bottom of the screen (where the miss counts: rules.js)
      if (o.o === 'hit') { fingThing(c, X(it.x), topY - R * 0.8, R, it, P, now, true); continue; }
    }
    const y = topY - R - yu * k;
    if (y > H + R) continue;
    if (live && y > -R) { c.strokeStyle = 'rgba(22, 18, 16, .16)'; c.lineWidth = 2; c.lineCap = 'round'; for (const dx of [-0.45, 0, 0.45]) { c.beginPath(); c.moveTo(X(it.x) + dx * R, y - R * (1.25 + (dx ? 0 : 0.15))); c.lineTo(X(it.x) + dx * R, y - R * (1.25 + it.v * (dx ? 0.07 : 0.1))); c.stroke(); } }   // the air behind it: longer the faster it falls
    fingThing(c, X(it.x), y, R, it, P, now, false);
  }
  if (v.end === 'hazard') impact(c, cx + s * k, topY - R * 0.8, R * 2.4, { at: v.endAt }, now, P);   // the nasty catch's burst, once
  if (v.end === 'top' && v.endAt) {                                  // the target: a cherry drops onto the top, sprinkles fly
    const u = REDUCED ? 1 : Math.min(1, endMs / SCOOPV.cherry), px = cx + s * k, py = topY - R * 0.9 - (1 - easeOut(u)) * k * 2.2, r = R * 0.42;
    c.strokeStyle = P.ink; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(px, py - r * 0.6); c.quadraticCurveTo(px + r * 0.3, py - r * 2, px + r * 1.3, py - r * 2.3); c.stroke();
    c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); outlined(c, '#d7263d', P.ink, 2);
    c.fillStyle = 'rgba(255, 255, 255, .55)'; c.beginPath(); c.ellipse(px - r * 0.3, py - r * 0.35, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2); c.fill();
    scoopConfetti(c, px, topY - R, k, endMs / SCOOPV.confetti, P);
  }
  c.restore();
  const ms = sim.misses || SCOOP.misses, lost = {};                   // the misses allowed (the square's setting): a little cone each, crossed out once used (it pops as its miss counts)
  if (live) for (const e of v.ev || []) { const a = te - e.t; if (e.k === 'gone' && a >= 0 && a < SCOOPV.lost) lost[e.m] = a / SCOOPV.lost; }
  for (let m = 0; m < ms; m++) {
    const x = W - 15 - m * 23, y = 31, used = m >= ms - sim.miss, u = used ? lost[ms - m] : null, z = u == null ? 1 : 1 + 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.4)) * (1 - u);
    c.save(); c.translate(x, y); c.scale(z, z);
    c.save(); c.globalAlpha = used ? 0.4 : 1;
    c.beginPath(); c.moveTo(-6.5, -2); c.lineTo(6.5, -2); c.lineTo(0, 11.5); c.closePath(); c.lineJoin = 'round'; outlined(c, '#ecbd78', P.ink, 1.8);
    c.beginPath(); c.arc(0, -4.5, 6.5, 0, Math.PI * 2); outlined(c, SCOOP_FLAV[0], P.ink, 1.8);
    c.fillStyle = 'rgba(255, 255, 255, .55)'; c.beginPath(); c.ellipse(-2.2, -6.6, 2, 1.1, -0.5, 0, Math.PI * 2); c.fill();
    c.restore();
    if (used) { c.lineCap = 'round'; for (const [col, lw] of [[P.paper, 5.5], [P.ink, 2.8]]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(-7, -10); c.lineTo(7, 10); c.moveTo(7, -10); c.lineTo(-7, 10); c.stroke(); } }
    c.restore();
  }
  if (!v.still && !v.end && sim.n > 0 && sim.t < 0.7) { c.save(); c.translate(W * 0.17, 0); banner(c, W * 0.66, H * 0.66, 'GO!', { at: now - sim.t * 1000 }, now, P, 0.3, (sim.t * 1000 - 580) / 120); c.restore(); }   // the start's word, small and high (nothing falls yet)
  if (v.end === 'time') banner(c, W, H, 'TIME!', { at: v.endAt }, now, P);
  if (!v.still && sim.n > 0 && sim.cap) drawTimeBar(c, W, H, 1 - sim.t / sim.cap, P);   // the attempt's time limit: its countdown bar (live and in a replay, from the attempt's own clock)
}
function scoopSplat(c, x, H, k, u, f, P) {                           // a scoop gone off the bottom: a flat splash of its flavour on the edge, a few drops thrown up
  c.save(); c.globalAlpha = 1 - u * u; c.fillStyle = SCOOP_FLAV[f] || SCOOP_FLAV[0]; c.strokeStyle = P.ink; c.lineWidth = 1.6;
  c.beginPath(); c.ellipse(x, H + 1, k * (0.5 + 0.7 * easeOut(u)), k * (0.34 - 0.16 * u), 0, Math.PI, 0); c.fill(); c.stroke();
  for (let d = 0; d < 5; d++) { const ang = -Math.PI * (0.2 + 0.6 * (d / 4)), sp = k * (1.3 + 0.5 * hash01(d + 3)); c.beginPath(); c.arc(x + Math.cos(ang) * sp * easeOut(u), H - 2 + Math.sin(ang) * sp * easeOut(u) + u * u * k * 1.4, Math.max(1.6, k * 0.1), 0, Math.PI * 2); c.fill(); c.stroke(); }
  c.restore();
}
function scoopConfetti(c, x, y, k, u, P) {                           // sprinkles in the flavours' colours (never a player's)
  if (u >= 1 || REDUCED) return;
  c.save(); c.globalAlpha = 1 - u * u * u;
  for (let j = 0; j < 18; j++) {
    const a = hash01(j + 17) * Math.PI * 2, sp = (2 + 3.2 * hash01(j + 37)) * k, e = easeOut(u);
    c.save(); c.translate(x + Math.cos(a) * sp * e, y + Math.sin(a) * sp * e * 0.8 - k * 0.8 * e + u * u * k * 3); c.rotate(a + u * (5 + j));
    if (j % 3 === 0) { starPath(c, 0, 0, k * 0.2, 5, 0); c.fillStyle = P.paper; c.fill(); c.lineWidth = 1.3; c.strokeStyle = P.ink; c.stroke(); }
    else { rr(c, -k * 0.16, -k * 0.055, k * 0.32, k * 0.11, k * 0.055); c.fillStyle = SCOOP_FLAV[j % 5]; c.fill(); c.lineWidth = 1.2; c.strokeStyle = P.ink; c.stroke(); }
    c.restore();
  }
  c.restore();
}
export function scoopBall(c, x, y, R, f, P) {                            // a scoop: a round top over a wavy, drippy edge, lit from the upper left
  const col = SCOOP_FLAV[f] || SCOOP_FLAV[0], dark = SCOOP_DARK[f] || SCOOP_DARK[0];
  c.beginPath(); c.arc(x, y, R, Math.PI * 0.92, Math.PI * 0.08);
  for (let d = 0; d <= 6; d++) { const a = d / 6, px = x + R * Math.cos(Math.PI * 0.08) - a * 2 * R * Math.cos(Math.PI * 0.08), py = y + R * 0.38 + (d % 2 ? R * 0.2 : 0); c.lineTo(px, py); }
  c.closePath(); c.lineJoin = 'round'; outlined(c, col, P.ink, 2.2);
  c.save(); c.clip();
  c.fillStyle = dark; c.globalAlpha = 0.55; c.beginPath(); c.arc(x - R * 0.28, y - R * 0.34, R * 1.08, 0, Math.PI * 2); c.rect(x + R * 2, y - R * 2, -R * 4, R * 4); c.fill('evenodd');   // its shaded side, lower right
  c.restore();
  c.fillStyle = 'rgba(255, 255, 255, .62)'; c.beginPath(); c.ellipse(x - R * 0.36, y - R * 0.42, R * 0.26, R * 0.14, -0.5, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(x - R * 0.02, y - R * 0.62, R * 0.07, 0, Math.PI * 2); c.fill();
  if (f === 4 || f === 0 || f === 1) { c.fillStyle = f === 4 ? '#5a4aa8' : f === 0 ? '#c2185b' : '#4a3426'; for (const [dx, dy] of [[-0.3, 0.05], [0.25, -0.15], [0.05, 0.2]]) { c.beginPath(); c.arc(x + dx * R, y + dy * R, R * 0.07, 0, Math.PI * 2); c.fill(); } }
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = fingTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function sounds(f, add, won, mini, last) {
  fingSounds(f, add); return;   // someone else's attempt as it replays (its bounces, catches, flips), then the result
}
