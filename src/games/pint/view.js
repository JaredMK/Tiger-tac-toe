// Split It: the screen, the miniature, the move's words and sounds, and this phone's one hold.
// The scene is a canvas (PINV.w across, PINV.h up, scaled to its box and stood on the box's foot): an original comic
// fellow in a bobble hat, seen from the side, holding a pint glass out in front of him; the mover's drawn X or O is
// printed on the glass's front at its height, on a thin ring round the glass. The glass is seen from a little above
// (GLASS.k: a level circle shows as a flat ellipse), so the drink's surface is an ellipse that stays level while the
// glass, its ring and its mark tip: the surface is worked out from the glass's own shape (the same share of the
// glass's side view under a level line, `surface`), and the glass tips just as far as brings the drink to the lip
// (`pour`), so what shows is where the level really is, and it is honestly hard to read against the mark.
// This phone's attempt: hold the button (or anywhere on the scene) and the glass goes to the mouth and tips, the
// level falling by the rules' own clock (rules.js pintLevel), a gulp ticking; let go and that is the attempt: it goes
// in as the level left. Then, from the release: the glass comes back upright and the drink sloshes and settles
// (PINT.up, PINT.settle); the verdict (PINT.say): a pointer at the level against the bracket of what counted about
// the mark, the words in the reserved line, the points filling in; and a fresh pint slides up for whoever goes next
// (PINT.next). The clocks are real time whatever the Animation setting. Someone else's attempt plays the same hold
// first, for the time their level took (the move's `ms`).
import { PINT, pintCfg, pintLevel, pintPre } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { N, app, state } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { runColours, runInputAt } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { markSvgG, pipRows, thumbArt } from '../../ui/thumbs.js';
import { flashAnimating, skipFlash } from '../../ui/turns.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is where the drink stopped: shown from the flash
// The scene's size; ms: the glass's way to the mouth, between gulps, the verdict's pointer coming in, the points'
// pips after the verdict, a sent attempt never answered let go; the fresh pint's way up from under the scene; the
// slosh: its swing (radians), its fade and its period (ms).
export const PINV = { w: 100, h: 92, lift: 230, gulp: 190, point: 220, pip: 160, stuck: 8000, rise: 74, swing: 0.3, fade: 170, wave: 250 };
// The glass on its own scale (its base's middle at 0, 0; y up its axis): its height, the rim's and the base's half
// widths, the thick base's top (the drink's floor), the wall's thickness, how flat a level circle shows from the
// camera's height, the foam's depth, the most it tips (radians), and its mark's half size.
const GLASS = { H: 50, R: 11.5, r0: 8.4, f: 3.2, wall: 0.9, k: 0.27, head: 2.4, max: 1.37, mark: 3.3 };
const HIN = GLASS.H - GLASS.f, TAPER = (GLASS.R - GLASS.r0) / GLASS.H;
const radO = y => GLASS.r0 + TAPER * y, radI = y => radO(y) - GLASS.wall, yOf = L => GLASS.f + Math.max(0, Math.min(1, L)) * HIN;
const INNER = [[-radI(GLASS.f), GLASS.f], [radI(GLASS.f), GLASS.f], [radI(GLASS.H), GLASS.H], [-radI(GLASS.H), GLASS.H]];
const REST = { x: 67, y: 86 }, NECK = { x: 21, y: 44 }, HEAD = { x: 22, y: 27, r: 14 }, MOUTH = { x: 35.4, y: 37.2 }, SHOULDER = { x: 33, y: 61 };
const INK_DRINK = '#231512', FOAM = '#f3e3bf', FOAM_TOP = '#fff4d8', WALL = '#58a8cf', SKIN = '#f2c9a0', NOSE = '#eeb08a', SHIRT = '#7a5cc2', HAT = '#2b3a6b', TASH = '#5a3a26';
let aim = null;                                                    // this phone's attempt under way: { sq, p, n, phase 0 ready, 1 holding, 4 sent; t0, lv, tick }
let src = null, hooked = false, skipped = null;
const r3 = v => Math.round(v * 1000) / 1000;
const clamp = v => (v <= 0 ? 0 : v >= 1 ? 1 : v), easeOut = v => { const k = clamp(v); return 1 - (1 - k) * (1 - k); }, easeIn = v => { const k = clamp(v); return k * k; }, easeIO = v => { const k = clamp(v); return k * k * (3 - 2 * k); };
const live = () => {
  const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini;
  return aim && m && m.type === 'pint' && aim.sq === state.zoom && !state.flash && !state.done && !blocked() && src && src.mine ? m : null;
};
function label() {                                                 // the button follows the hold without a redraw of the screen
  const b = app && app.querySelector ? app.querySelector('.pntbtn') : null; if (!b || !aim) return;
  b.classList.toggle('held', aim.phase === 1); b.disabled = aim.phase >= 4;
}
function press() {
  const m = live(); if (!m || aim.phase !== 0) return false;
  aim.phase = 1; aim.t0 = performance.now(); aim.tick = 0;
  SND.play('pnGulp', { rate: 0.9 }); haptic('tap'); label(); go();
  return true;
}
function release() {
  if (!aim || aim.phase !== 1) return false;
  const m = live(); if (!m) { aim.phase = 0; label(); return false; }   // (the square was left mid-hold: that hold is not spent)
  aim.lv = r3(pintLevel(pintCfg(m), performance.now() - aim.t0)); aim.phase = 4; aim.t0 = performance.now();
  SND.play('pnStop'); haptic('tap'); label();
  attemptMove({ lv: aim.lv });                                     // (the move may redraw the screen at once and drop the aim: nothing of it is read after)
  go();
  return true;
}
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  app.addEventListener('pointerdown', e => {
    if (state.screen !== 'mini' || !runInputAt(e.target) || !(e.target.closest && e.target.closest('.pntfield.live, .pntbtn:not(:disabled)'))) return;
    if (press()) { e.preventDefault(); ownPress(); }
  }, { passive: false });
  const up = () => { release(); };
  if (typeof window !== 'undefined' && window.addEventListener) { ['pointerup', 'pointercancel', 'blur'].forEach(ev => window.addEventListener(ev, up)); }
  app.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && e.target.closest && e.target.closest('.pntbtn')) { e.preventDefault(); if (!e.repeat) press(); } });
  app.addEventListener('keyup', e => { if ((e.key === ' ' || e.key === 'Enter') && e.target.closest && e.target.closest('.pntbtn')) { e.preventDefault(); release(); } });
}
export const actions = { 'pint-hold': () => {} };                  // (the hold is the press and the release themselves, above: the click that ends it does nothing)

// ---- the drink in the glass ----
// The glass's side view is a four-cornered shape; tipped by `psi` against the drink's surface, the drink is the part of
// it under a level line, and it keeps its share of the shape whatever the tip. `surface` finds that line.
const turned = (pts, a) => { const cs = Math.cos(a), sn = Math.sin(a); return pts.map(p => [p[0] * cs - p[1] * sn, p[0] * sn + p[1] * cs]); };
function under(poly, w) {                                          // the part of a shape at or under height w
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ia = a[1] <= w, ib = b[1] <= w;
    if (ia) out.push(a);
    if (ia !== ib) { const k = (w - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * k, w]); }
  }
  return out;
}
const areaOf = p => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
const shareArea = L => { const h = yOf(L) - GLASS.f; return 2 * (radI(GLASS.f) * h + TAPER * h * h / 2); };
export function surface(psi, L) {                                  // → { P: the glass's inside, tipped; w: the surface's height }
  const P = turned(INNER, psi), A = shareArea(L);
  let lo = Infinity, hi = -Infinity; for (const p of P) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }
  for (let k = 0; k < 26; k++) { const mid = (lo + hi) / 2; if (areaOf(under(P, mid)) < A) lo = mid; else hi = mid; }
  return { P, w: (lo + hi) / 2 };
}
// How far the glass tips to bring a level of drink to its lip (radians; no further than GLASS.max).
export function pour(L) {
  if (L >= 1) return 0;
  const gap = th => surface(th, L).w - (GLASS.H * Math.cos(th) - radI(GLASS.H) * Math.sin(th));
  if (gap(GLASS.max) < 0) return GLASS.max;
  let lo = 0, hi = GLASS.max;
  for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (gap(mid) < 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

// ---- the drawing (all in the scene's own units) ----
const frame = (B, a) => { const cs = Math.cos(a), sn = Math.sin(a); return (x, y) => [B.x + x * cs - y * sn, B.y - (x * sn + y * cs)]; };
const trace = (c, F, pts, open) => { pts.forEach((p, i) => { const q = F(p[0], p[1]); if (i || open) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); };
const arcPts = (cx, cy, rx, ry, a0, a1, n = 16) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
const PI = Math.PI;
function drawMark(c, F, p, x, y, hs, col, ink, ang) {             // a drawn X or O printed on the glass
  const q = F(x, y);
  c.save(); c.translate(q[0], q[1]); c.rotate(-ang); c.lineCap = 'round';
  const shape = () => { c.beginPath(); if (p === 'O') c.arc(0, 0, hs * 0.95, 0, 7); else { c.moveTo(-hs, -hs); c.lineTo(hs, hs); c.moveTo(hs, -hs); c.lineTo(-hs, hs); } };
  c.strokeStyle = ink; c.lineWidth = 2.5; shape(); c.stroke();
  c.strokeStyle = '#fff'; c.lineWidth = 1.9; shape(); c.stroke();
  c.strokeStyle = col; c.lineWidth = 1.35; shape(); c.stroke();
  c.restore();
}
// The glass: its base's middle at B, tipped by th; the drink's surface off level by phi (the slosh); L the share left.
function drawGlass(c, B, th, phi, L, o, P) {
  const G = frame(B, th), S = frame(B, phi), H = GLASS.H, R = GLASS.R, r0 = GLASS.r0, k = GLASS.k;
  const body = () => { c.beginPath(); trace(c, G, arcPts(0, 0, r0, r0 * k, PI, 2 * PI)); trace(c, G, arcPts(0, H, R, R * k, 0, PI), true); c.closePath(); };
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.fillStyle = 'rgba(255,255,255,.26)'; body(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); trace(c, G, arcPts(0, 0, r0, r0 * k, PI, 2 * PI)); trace(c, G, [[radO(GLASS.f), GLASS.f], [-radO(GLASS.f), GLASS.f]], true); c.closePath(); c.fill();   // the thick base
  c.strokeStyle = 'rgba(22,18,16,.45)'; c.lineWidth = 0.45; c.beginPath(); trace(c, G, arcPts(0, H, R, R * k, 0, PI)); c.stroke();   // the rim's far side
  if (L > 0.0005) {
    const { P: Q, w } = surface(th - phi, L), hd = GLASS.head * Math.min(1, L / 0.15), all = under(Q, w), dark = under(Q, w - hd);
    const span = (pts, y) => { let a = Infinity, b = -Infinity; for (const p of pts) if (Math.abs(p[1] - y) < 1e-6) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); } return b > a ? [a, b] : null; };
    c.save();
    c.beginPath(); trace(c, G, INNER); c.closePath(); trace(c, G, arcPts(0, H, radI(H), radI(H) * k, 0, 2 * PI)); c.clip();
    c.fillStyle = FOAM; c.beginPath(); trace(c, S, all); c.closePath(); c.fill();
    if (dark.length > 2) {
      c.fillStyle = INK_DRINK; c.beginPath(); trace(c, S, dark); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,190,150,.1)'; c.beginPath(); trace(c, S, dark.map(p => [p[0] * 0.55 - 1.2, p[1]])); c.closePath(); c.fill();   // (a little light through the drink)
      const sd = span(dark, w - hd); if (sd) { c.fillStyle = FOAM; c.beginPath(); trace(c, S, arcPts((sd[0] + sd[1]) / 2, w - hd, (sd[1] - sd[0]) / 2, Math.min((sd[1] - sd[0]) / 2, R) * k, PI, 2 * PI)); c.closePath(); c.fill(); }
    }
    const st = span(all, w);
    if (st) {
      const top = arcPts((st[0] + st[1]) / 2, w, (st[1] - st[0]) / 2, Math.min((st[1] - st[0]) / 2, R) * k, 0, 2 * PI, 28);
      c.fillStyle = FOAM_TOP; c.beginPath(); trace(c, S, top); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(120,90,50,.55)'; c.lineWidth = 0.35; c.beginPath(); trace(c, S, top); c.closePath(); c.stroke();
    }
    c.restore();
  }
  // the glass's own lines, its shine, and the mark printed on its front
  c.strokeStyle = P.ink; c.lineWidth = 0.95; body(); c.stroke();
  c.lineWidth = 0.6; c.beginPath(); trace(c, G, arcPts(0, H, R, R * k, PI, 2 * PI)); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.3; c.beginPath(); trace(c, G, [[-radO(H * 0.86) + 2.6, H * 0.86], [-radO(H * 0.34) + 2.4, H * 0.34]]); c.stroke();
  c.lineWidth = 0.8; c.beginPath(); trace(c, G, [[-radO(H * 0.24) + 2.4, H * 0.24], [-radO(H * 0.16) + 2.3, H * 0.16]]); c.stroke();
  if (o.mark != null) {
    const ym = yOf(o.mark), rm = radI(ym), col = o.by === 'O' ? P.O : P.X;
    c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 0.55; c.beginPath(); trace(c, G, arcPts(0, ym, radO(ym), rm * k, PI, 2 * PI)); c.stroke();
    if (o.burst > 0) { c.save(); c.globalAlpha = Math.min(1, 2.2 - o.burst * 2.2); c.strokeStyle = '#fff'; c.lineWidth = 1; for (let i = 0; i < 10; i++) { const an = i * PI / 5 + 0.3, a0 = 5.2 + o.burst * 4, a1 = a0 + 2.2 + (i % 2) * 1.6; c.beginPath(); trace(c, G, [[Math.cos(an) * a0, ym - rm * k + Math.sin(an) * a0], [Math.cos(an) * a1, ym - rm * k + Math.sin(an) * a1]]); c.stroke(); } c.restore(); }
    drawMark(c, G, o.by, 0, ym - rm * k, GLASS.mark, col, P.ink, th);
  }
  // the verdict: what counted about the mark as a bracket beside the glass, and a pointer at the level
  if (o.verdict && o.vk > 0) {
    const v = o.verdict, ym = yOf(v.mark), yl = yOf(v.lv), x0 = Math.max(radO(ym), radO(yl)) + 1.5, good = v.pts > 0, col = good ? P.green : '#8b8377';
    c.save(); c.globalAlpha = clamp(o.vk * 1.6);
    const band = (h, w) => { c.beginPath(); trace(c, G, [[x0, ym - h], [x0 + w, ym - h], [x0 + w, ym + h], [x0, ym + h]]); c.closePath(); };
    c.fillStyle = '#fff'; c.strokeStyle = P.ink; c.lineWidth = 0.6; band(v.tol * HIN, 3.4); c.fill(); c.stroke();
    c.fillStyle = P.green; band(Math.max(0.45, v.perfect * HIN), 3.4); c.fill();
    if (v.lv > 0) { c.strokeStyle = good ? '#b9f29a' : '#fff'; c.lineWidth = 0.6; c.setLineDash([1.3, 1.1]); c.beginPath(); trace(c, G, arcPts(0, yl, radI(yl), radI(yl) * k, PI, 2 * PI)); c.stroke(); c.setLineDash([]); }
    c.restore();
    const px = x0 + 4.4 + (1 - easeOut(o.vk)) * 14;
    c.save(); c.globalAlpha = clamp(o.vk * 2); c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = 0.7; c.beginPath(); trace(c, G, [[px, yl], [px + 6.2, yl + 3.5], [px + 6.2, yl - 3.5]]); c.closePath(); c.fill(); c.stroke(); c.restore();
  }
  return G;
}
// The fellow: `tilt` his head thrown back (radians); eye 'open' | 'shut' | 'joy'; mouth 'idle' | 'sip' | 'oh' | 'grin' | 'smile' | 'glum'.
function drawFellow(c, P, f, foot) {
  const ink = P.ink;
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = ink;
  c.fillStyle = SKIN; c.lineWidth = 0.9; c.beginPath(); c.rect(15.5, 36, 10.5, 12); c.fill(); c.stroke();   // the neck
  c.fillStyle = SHIRT; c.beginPath(); c.moveTo(1.5, foot + 4); c.lineTo(1.5, 66); c.quadraticCurveTo(2, 49, 14, 46.5); c.lineTo(28, 46.5); c.quadraticCurveTo(40, 49, 41, 66); c.lineTo(41, foot + 4); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1.1; for (let y = 56; y < foot + 2; y += 7) { c.beginPath(); c.moveTo(3.5, y); c.lineTo(39, y); c.stroke(); }   // his jumper's stripes
  c.strokeStyle = ink; c.lineWidth = 0.9; c.fillStyle = '#fff'; c.beginPath(); c.moveTo(14.5, 46.3); c.lineTo(21, 52.5); c.lineTo(27.5, 46.3); c.closePath(); c.fill(); c.stroke();
  c.save(); c.translate(NECK.x, NECK.y); c.rotate(-f.tilt); c.translate(-NECK.x, -NECK.y);
  const hx = HEAD.x, hy = HEAD.y, r = HEAD.r;
  c.fillStyle = SKIN; c.beginPath(); c.arc(hx, hy, r, 0, 7); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(hx - 4, hy + 2.5, 2.6, 3.6, 0, 0, 7); c.fill(); c.stroke(); c.lineWidth = 0.6; c.beginPath(); c.arc(hx - 3.6, hy + 2.6, 1.5, 0.6, 4.2); c.stroke(); c.lineWidth = 0.9;   // the ear
  c.fillStyle = HAT; c.beginPath(); c.arc(hx, hy, r + 0.7, PI * 1.03, PI * 1.9); c.closePath(); c.fill(); c.stroke();   // the bobble hat, its band and its bobble
  const b0 = [hx + (r + 0.7) * Math.cos(PI * 1.03), hy + (r + 0.7) * Math.sin(PI * 1.03)], b1 = [hx + (r + 0.7) * Math.cos(PI * 1.9), hy + (r + 0.7) * Math.sin(PI * 1.9)];
  c.strokeStyle = ink; c.lineWidth = 4.4; c.beginPath(); c.moveTo(b0[0], b0[1]); c.lineTo(b1[0], b1[1]); c.stroke(); c.strokeStyle = '#9fd3e8'; c.lineWidth = 2.8; c.beginPath(); c.moveTo(b0[0], b0[1]); c.lineTo(b1[0], b1[1]); c.stroke();
  c.strokeStyle = ink; c.lineWidth = 0.9; c.fillStyle = '#9fd3e8'; c.beginPath(); c.arc(hx - 2.5, hy - r - 2.6, 3.2, 0, 7); c.fill(); c.stroke();
  const ex = hx + 7.2, ey = hy - 0.6;                              // the eye and its brow
  if (f.eye === 'open') { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, ey, 2.5, 3, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = ink; c.beginPath(); c.arc(ex + 0.9, ey + 0.3, 1.15, 0, 7); c.fill(); }
  else { c.lineWidth = 1.1; c.beginPath(); if (f.eye === 'joy') c.arc(ex, ey + 1.2, 2.4, PI * 1.12, PI * 1.88); else c.arc(ex, ey - 1.2, 2.4, PI * 0.12, PI * 0.88); c.stroke(); c.lineWidth = 0.9; }
  c.lineWidth = 1.1; c.beginPath(); const bw = f.mouth === 'glum' ? 1.4 : f.mouth === 'oh' || f.mouth === 'grin' ? -1.6 : 0; c.moveTo(ex - 2.8, ey - 5.2 - bw * 0.5); c.lineTo(ex + 2.6, ey - 5.2 + bw - (f.eye === 'shut' ? 0.8 : 0)); c.stroke(); c.lineWidth = 0.9;
  const mx = hx + 9.6, my = hy + 9.2;                              // the mouth, under the moustache
  c.beginPath();
  if (f.mouth === 'grin') { c.fillStyle = '#7a2b22'; c.moveTo(mx - 3.2, my - 0.4); c.quadraticCurveTo(mx, my + 4.6, mx + 3.4, my - 1); c.closePath(); c.fill(); c.stroke(); }
  else if (f.mouth === 'smile') { c.moveTo(mx - 3, my); c.quadraticCurveTo(mx, my + 2.8, mx + 3.2, my - 0.8); c.stroke(); }
  else if (f.mouth === 'glum') { c.moveTo(mx - 3, my + 1.6); c.quadraticCurveTo(mx, my - 1, mx + 3, my + 1.2); c.stroke(); }
  else if (f.mouth === 'oh') { c.fillStyle = '#7a2b22'; c.ellipse(mx + 0.8, my + 0.6, 1.5, 1.9, 0, 0, 7); c.fill(); c.stroke(); }
  else if (f.mouth === 'idle') { c.moveTo(mx - 2.4, my + 0.3); c.quadraticCurveTo(mx, my + 1.6, mx + 2.6, my); c.stroke(); }
  c.fillStyle = f.foam ? FOAM_TOP : TASH; c.beginPath(); c.moveTo(hx + 5.2, hy + 6.1); c.quadraticCurveTo(hx + 10, hy + 3.6, hx + 14.6, hy + 5.6); c.quadraticCurveTo(hx + 15.6, hy + 8.2, hx + 13.4, hy + 8.4); c.quadraticCurveTo(hx + 9.6, hy + 6.6, hx + 5.6, hy + 8.6); c.quadraticCurveTo(hx + 3.9, hy + 7.6, hx + 5.2, hy + 6.1); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = NOSE; c.beginPath(); c.ellipse(hx + 14.4, hy + 2.6, 4.3, 3.4, 0.1, 0, 7); c.fill(); c.stroke();
  c.restore();
}
function drawArm(c, P, to) {                                       // his sleeve, from the shoulder round under to the hand on the glass
  const s = SHOULDER, mx = (s.x + to[0]) / 2, my = (s.y + to[1]) / 2 + 9 + Math.abs(to[0] - s.x) * 0.12;
  const path = () => { c.beginPath(); c.moveTo(s.x, s.y); c.quadraticCurveTo(mx, my, to[0], to[1]); };
  c.lineCap = 'round'; c.strokeStyle = P.ink; c.lineWidth = 8.2; path(); c.stroke(); c.strokeStyle = SHIRT; c.lineWidth = 6.4; path(); c.stroke();
}
function drawHand(c, P, G) {                                       // his hand round the glass's foot, fingers across its front
  const y0 = 2.9, y1 = 10.4, xl = -radO(6.5) - 1.6, xr = radO(6.5) * 0.52;
  c.lineJoin = 'round'; c.lineCap = 'round'; c.fillStyle = SKIN; c.strokeStyle = P.ink; c.lineWidth = 0.9;
  c.beginPath(); trace(c, G, [[xl, y0 + 0.6], [xl + 1.4, y0 - 0.4], [xr - 1, y0 - 0.2], [xr + 0.6, y0 + 1.4], [xr + 0.6, y1 - 1.4], [xr - 1, y1 + 0.2], [xl + 1.4, y1 + 0.4], [xl, y1 - 0.6]]); c.closePath(); c.fill(); c.stroke();
  c.lineWidth = 0.6; for (let i = 1; i < 4; i++) { const y = y0 + (y1 - y0) * i / 4; c.beginPath(); trace(c, G, [[xr + 0.4, y], [xr - 6.2, y + 0.2]]); c.stroke(); }
}
const lift = t => easeOut(t / PINV.lift);
const go = stage('canvas.pntcv', (c, W, H, now) => {
  if (!src) return false;
  const { mini, a, mine } = src, P = runColours(), cfg = pintCfg(mini), u = Math.min(W / PINV.w, H / PINV.h), foot = PINV.h + 2;
  // what the picture shows now: the level, how far to the mouth (g), the pour, the slosh, the pint's way off or on (drop), the face
  let L = 1, g = 0, pr = 0, phi = 0, drop = 0, mark = mini.mark[src.who], by = src.who, more = false, foam = false, eye = 'open', mouth = 'idle', verdict = null, vk = 0, burst = 0, bob = 0;
  if (a) {
    const s = a.pn, at = fxAt('move', a), pre = pintPre(s), t = (at == null ? Infinity : now - at) + (src.own ? pre : 0), tr = t - pre;
    const tv = PINT.settle, tn = tv + PINT.say + PINT.hold, half = PINT.next / 2;
    mark = s.mark; by = s.by;
    if (tr < 0) { L = Math.max(s.lv, pintLevel(cfg, t)); g = lift(t); pr = pour(L); eye = 'shut'; mouth = 'sip'; }
    else if (src.won || tr < tn + half) {
      L = s.lv; g = 1 - easeIO(tr / PINT.up); pr = pour(L); foam = true;
      phi = PINV.swing * Math.min(1, pr / 1.2) * Math.exp(-tr / PINV.fade) * Math.sin(2 * PI * tr / PINV.wave);
      vk = clamp((tr - tv) / PINV.point); if (vk > 0) { verdict = Object.assign({ tol: cfg.tol, perfect: cfg.perfect }, s); eye = s.pts === 2 ? 'joy' : 'open'; mouth = s.pts === 2 ? 'grin' : s.pts === 1 ? 'smile' : 'glum'; if (s.pts === 2) burst = clamp((tr - tv) / 520); } else mouth = 'oh';
      if (!src.won && tr >= tn) drop = easeIn((tr - tn) / half);
    } else { L = 1; mark = mini.mark[s.next]; by = s.next; drop = 1 - easeOut((tr - tn - half) / half); }
    more = tr < (src.won ? tv + PINT.say : tn + PINT.next) + 300;
  } else if (src.fin) {
    const l = mini.last; L = l.lv; mark = l.mark; by = l.by; foam = true; verdict = Object.assign({ tol: cfg.tol, perfect: cfg.perfect }, l); vk = 1;
    eye = l.pts === 2 ? 'joy' : 'open'; mouth = l.pts === 2 ? 'grin' : l.pts === 1 ? 'smile' : 'glum';
  } else if (aim && mine && aim.sq === src.zoom) {
    const t = now - aim.t0;
    if (aim.phase === 1) {
      L = pintLevel(cfg, t); g = lift(t); pr = pour(L); eye = 'shut'; mouth = 'sip';
      if (L <= 0) release(); else if (t - aim.tick >= PINV.gulp) { aim.tick = t; SND.play('pnGulp', { rate: 0.88 + 0.3 * (1 - L) }); }
    } else if (aim.phase === 4) { L = aim.lv; g = 1; pr = pour(L); eye = 'shut'; mouth = 'sip'; }
    else { bob = Math.sin(now / 520) * 0.5; if (now % 3400 < 130) eye = 'shut'; }
    more = true;
  }
  // the pose: the head back with the glass, the glass's lip to the mouth
  const th = g * pr, tilt = 0.3 * th, ca = Math.cos(-tilt), sa = Math.sin(-tilt), dx = MOUTH.x - NECK.x, dy = MOUTH.y - NECK.y;
  const M = { x: NECK.x + dx * ca - dy * sa, y: NECK.y + dx * sa + dy * ca }, cs = Math.cos(th), sn = Math.sin(th);
  const at = { x: M.x + GLASS.R * cs + GLASS.H * sn, y: M.y - GLASS.R * sn + GLASS.H * cs };
  const B = { x: REST.x + (at.x - REST.x) * g, y: REST.y + bob + (at.y - REST.y - bob) * g + drop * PINV.rise };
  c.clearRect(0, 0, W, H);
  c.fillStyle = WALL; c.fillRect(0, 0, W, H);
  c.save(); c.translate((W - PINV.w * u) / 2, H - PINV.h * u); c.scale(u, u);
  c.fillStyle = 'rgba(255,255,255,.1)'; for (let y = -40; y < PINV.h; y += 5) for (let x = -20 + (y % 10 ? 2.5 : 0); x < PINV.w + 20; x += 5) { c.beginPath(); c.arc(x, y, 0.62, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(22,30,70,.16)'; c.fillRect(-40, PINV.h - 9, PINV.w + 80, 14); c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(-40, PINV.h - 9.6, PINV.w + 80, 0.9);   // a skirting along the wall's foot
  drawFellow(c, P, { tilt, eye, mouth, foam }, foot);
  const G0 = frame(B, th), wrist = G0(-radO(6.5) - 1.2, 6.5);
  drawArm(c, P, wrist);
  const G = drawGlass(c, B, th, phi, L, { mark, by, verdict, vk, burst }, P);
  drawHand(c, P, G);
  c.restore();
  return more;
});

// ---- the view's hooks ----
const GLASS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.500 3.500h11l-1.500 17.500h-8z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M7.600 10.500h8.800l-.900 9.500h-7z" fill="currentColor"/></svg>';
const WORD = l => (l.pts === 2 ? ['ok best', 'Perfect split!'] : l.pts === 1 ? ['ok', 'Split!'] : l.lv > 0 && l.d > 0 ? ['no', 'Too soon'] : ['no', 'Too far']);
const tally = (p, n, goal, from, t) => `<span class="pips" aria-label="${n} of ${goal}">${Array.from({ length: goal }, (_, k) => `<i ${lateAt(k < n ? 'on' : '', t != null && k >= from && k < n ? t + (k - from) * PINV.pip : null, 'fillin')}></i>`).join('')}</span>`;
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = pintCfg(mini), s = a && a.pn ? a.pn : null, own = !!s && ownMove(a), o = { view, locked, turn };
  const fin = !s && view && !!mini.last, who = d && !view && mini.last ? mini.last.next : turn, by = s ? s.by : fin ? mini.last.by : who, mine = !view && !locked && !s && !d;
  if (mine && aim && aim.phase === 4 && performance.now() - aim.t0 > PINV.stuck) aim = null;
  if (mine && !(aim && aim.sq === state.zoom && aim.p === turn && aim.n === mini.n[turn])) aim = { sq: state.zoom, p: turn, n: mini.n[turn], phase: 0, t0: performance.now(), tick: 0, lv: 1 };
  if (!mine && aim && s) aim = null;
  // An attempt made here was seen here: its flash starts at the release and ends with the fresh pint (the hold is not played again).
  const base = s && !own ? pintPre(s) : 0, said = base + PINT.settle;
  if (s && own && skipped !== a && flashAnimating()) { skipped = a; setTimeout(() => { if (state.flash === a) skipFlash(); }, PINT.settle + PINT.say + PINT.hold + (fresh ? 0 : PINT.next)); }
  const tal = p => arcTally(p, o, tally(p, mini.pts[p], c.goal, s && s.by === p ? s.from : 0, s && s.by === p && s.pts > 0 ? said + PINV.point : null));
  const l = s || ((view || d) && mini.last ? mini.last : null), w = l ? WORD(l) : null;
  const line = l ? `<p ${s ? lateAt('pntline ' + w[0], said) : `class="pntline ${w[0]}"`} role="status">${w[1]}</p>` : '<p class="pntline"></p>';
  src = { mini, a: s ? a : null, who, own, mine, fin, won: !!fresh, zoom: state.zoom };
  const ph = mine && aim ? aim.phase : 0;
  const btn = view ? '' : `<button class="big ${turn} pntbtn${ph === 1 ? ' held' : ''}" data-act="pint-hold" aria-label="Hold to drink; let go to stop"${mine && ph < 4 ? '' : ' disabled'}>${GLASS_ICON}<b>Hold to drink</b></button>`;
  go();
  return `<div class="g-pnt pc-${by}"><div class="ctals${c.goal > 4 ? ' two' : ''}">${tal('X')}${tal('O')}</div><div class="pntbox"><div class="pntfield${mine ? ' live' : ''}"><canvas class="pntcv" aria-label="A pint glass with ${by}'s mark on it"></canvas></div></div>${line}${btn}</div>`;
}
// The title bar's line while a split keeps the turn (ui/mini.js heldSub; "Go again on success").
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> goes again`; }
// The miniature: the glass as the last attempt left it (a full one before any), its mark on its ring, beside each
// player's points as pips.
export function miniature(mini, final) {
  const goal = pintCfg(mini).goal, l = mini.last, lv = l ? l.lv : 1, mk = l ? l.mark : 0.5;
  const y = v => 53 - v * 44, hw = yy => 13 - 3.6 * (yy - 7) / 48 - 1.3, yl = y(lv), yf = Math.min(53, yl + 3.4), ym = y(mk);
  const fill = (y0, y1, cls) => (y1 - y0 < 0.2 ? '' : `<path class="${cls}" d="M${(30 - hw(y0)).toFixed(1)} ${y0.toFixed(1)}H${(30 + hw(y0)).toFixed(1)}L${(30 + hw(y1)).toFixed(1)} ${y1.toFixed(1)}H${(30 - hw(y1)).toFixed(1)}z"/>`);
  const art = `<svg class="tpnt" viewBox="12 3 36 56"><path class="tpng" d="M17 7h26l-3.600 48h-18.800z"/>${fill(yf, 53, 'tpnd')}${fill(yl, yf, 'tpnf')}<path class="tpno" d="M17 7h26l-3.600 48h-18.800z"/><path class="tpnr" d="M${(30 - hw(ym) - 1.3).toFixed(1)} ${ym.toFixed(1)}H${(30 + hw(ym) + 1.3).toFixed(1)}"/>${l ? `<g class="tpnm ${l.by}" transform="translate(30 ${ym.toFixed(1)})"><circle class="tpnb" r="6.800"/>${markSvgG(l.by, 3.6)}</g>` : ''}</svg>`;
  return thumbArt(art, pipRows(mini.pts, goal), 'tpntw', `Split It: X ${mini.pts.X}, O ${mini.pts.O} of ${goal} points`);
}
export function moveText(f, who) { const l = f.pn; return !l ? '' : l.pts === 2 ? `${who} split it perfectly` : l.pts === 1 ? `${who} split it` : l.lv > 0 && l.d > 0 ? `${who} stopped too soon` : `${who} went too far`; }
// Someone else's attempt: the gulps through their hold and the gasp as they let go; then, for everyone, the drink
// sloshing as the glass comes upright, the verdict's sound (a chime for a split, a brighter run for a perfect one, a
// low note for a miss), and the fresh pint sliding up. An attempt made here had its gulps and its gasp as it was made.
export function sounds(f, add, won, mini, last) {
  const l = f.pn; if (!l) return;
  const own = ownMove(f), pre = own ? 0 : pintPre(l), said = pre + PINT.settle;
  if (!own) { for (let t = 0, k = 0; t < pre - 60; t += PINV.gulp, k++) add('pnGulp', t, 0.88 + 0.3 * Math.min(1, t / 1800)); add('pnStop', pre, 1); }
  add('pnSlosh', pre + 40);
  add(l.pts === 2 ? 'pnPerfect' : l.pts === 1 ? 'pnSplit' : 'pnMiss', said);
  if (!won) add('pnSlide', said + PINT.say + PINT.hold + PINT.next / 2 - 60);
}
