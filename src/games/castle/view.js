// Castle Smash: the screen, the miniature, the move's words and sounds, and this phone's drag.
// One wide scene on a canvas (ui/stage.js): X's castle at the left and O's at the right, each with its catapult standing
// before it and its banner behind it, under a sky with hills. A phone too narrow for the whole scene looks at the part
// that matters: from the shooter's catapult to the castle it throws at (the camera slides across as the turn passes).
// The rules keep a castle as its attacker sees it (sim.js: the shooter throws to the right), so everything of a shot
// (the catapult, the boulder, the castle struck, the dust) is drawn in the shooter's own frame, turned round for O
// (`frame`): x across, h up, in the scene's units.
// A SHOT is a drag back from anywhere on the scene: away from where the boulder should go, further for more power; the
// arm is drawn back with it and a short dotted arc shows the first part of the flight. Letting go flings: the arm
// swings (CST.swing), the boulder leaves and the shot's recording plays (the flash's `phys`: the boulder's path, each
// knocked block's, the events for the dust, the splinters and the crystal's burst). Online this phone works the shot
// out itself as it lets go (the same simulation on the castle as it has it) and plays that at once; the server's
// record then carries on from the same moment, and its result is the one shown. Someone else's shot (the other
// player's, the computer's) first draws the catapult back (CST.pull), then plays the same.
import { other } from '../../core/util.js';
import { CS, CST, KINDS, K, castleArc, castleCfg, castleCore, castleLib, castleMove, castleShot, unpack } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { app, state } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { runColours, runInputAt } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { tokSvg } from '../../ui/thumbs.js';
import { flashAnimating, skipFlash } from '../../ui/turns.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is the fling: played from the flash
// The picture's own numbers: the camera, the catapult (its axle's height, its arm from rest to full pull, in radians
// from straight ahead), the drag (a full pull as a share of the scene's smaller side, the least pull that is a shot),
// the dotted arc (steps of flight shown, a dot every `dot`), and how long each effect lasts (ms).
export const CSV = {
  px: 1, win: 346, pad: 8, ease: 170, ground: 0.085,
  axle: 26, rest: Math.PI - 0.2, back: 0.58, over: 0.28,
  pull: 0.36, least: 12, arc: 46, dot: 4,
  puff: 380, chips: 560, burst: CST.burst, crack: 260, trail: 5,
};
const FR = 1000 * CS.sub / CS.hz, STEP = 1000 / CS.hz;            // a recorded frame, a step (ms)
const ARM = Math.hypot(CS.rel[0] - CS.cat, CS.rel[1] - CSV.axle), REL = Math.atan2(CS.rel[1] - CSV.axle, CS.rel[0] - CS.cat);   // the arm's length and its angle as the boulder leaves it
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, u) => a + (b - a) * u;
const COL = { stone: '#d9d3c4', stone2: '#c7c0af', stoneHi: '#ece8dc', wood: '#cb9257', wood2: '#a8713c', gem: '#9a6cf0', gemHi: '#cdb6ff', rock: '#8f877b', rockHi: '#aaa296', sky0: '#9fd3ee', sky1: '#e8f4e2', hill0: '#b5d795', hill1: '#93c57a', grass: '#7db862', dirt: '#b99561', dust: '#cfc3a8' };

let src = null, pend = null, draft = null, cam = null, hooked = false, skipped = null;
const DEC = new WeakMap(), LEAD = new WeakMap();
// A shot's recording, unpacked once: the boulder's place in each frame and each knocked block's poses.
function decode(ph) {
  let d = DEC.get(ph);
  if (d) return d;
  const rec = ph.rec;
  d = { ball: rec ? unpack(rec.b, 2) : [], tr: new Map() };
  if (rec && Array.isArray(rec.t)) for (const [i, f0, str, gone] of rec.t) d.tr.set(i, { f0, v: unpack(str, 3), gone: gone == null ? Infinity : gone });
  DEC.set(ph, d);
  return d;
}
// A block's pose [x, h, angle] `fr` frames into the recording (null once it is gone).
export function poseAt(d, w, i, fr) {
  const t = d.tr.get(i);
  if (!t) return [w[1] / 10, w[2] / 10, w[3] / 1000];
  if (fr >= t.gone) return null;
  const n = t.v.length / 3, k = clamp(fr - t.f0, 0, n - 1), a = Math.floor(k), b = Math.min(n - 1, a + 1), u = k - a, v = t.v;
  return [lerp(v[a * 3], v[b * 3], u) / 2, lerp(v[a * 3 + 1], v[b * 3 + 1], u) / 2, lerp(v[a * 3 + 2], v[b * 3 + 2], u) / 50];
}
// How far this phone's own shot is ahead of its flash's clock (ms): it never shows the pull, and online it left the
// catapult before the record came back. Worked out once, as the flash first plays.
function leadOf(f) {
  if (!f || !f.phys || !ownMove(f)) return 0;
  let l = LEAD.get(f);
  if (l == null) { l = CST.pull + (pend && pend.m.aim === f.phys.aim && pend.m.power === f.phys.power ? Math.max(0, performance.now() - pend.t0) : 0); LEAD.set(f, l); }
  return l;
}

// ---------- the drag ----------
// The pull so far as a shot: back and down from where the finger went down, for the side that is shooting.
function pullOf(d, by) {
  const r = d.el.getBoundingClientRect(), full = Math.max(70, Math.min(r.width, r.height) * CSV.pull), dir = by === 'X' ? 1 : -1;
  const fwd = (d.x0 - d.x) * dir, up = d.y - d.y0, len = Math.hypot(fwd, up);
  if (len < CSV.least || (fwd <= 0 && up <= 0)) return null;
  return castleMove({ aim: clamp(Math.atan2(up, Math.max(0.0001, fwd)), CS.aimLo, CS.aimHi), power: clamp((len - CSV.least) / (full - CSV.least), 0, 1) });
}
const live = () => !!src && src.mine && !state.flash && !state.done && !blocked() && !pend && src.zoom === state.zoom;
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  app.addEventListener('pointerdown', e => {
    if (state.screen !== 'mini' || draft || !runInputAt(e.target) || !e.target.closest || e.target.closest('button')) return;
    const el = e.target.closest('.csfield.live');
    if (!el || !live()) return;
    draft = { id: e.pointerId, el, sq: state.zoom, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, creak: false };
    e.preventDefault(); ownPress();
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* no capture: the move and the up still reach the page */ }
    go();
  }, { passive: false });
  app.addEventListener('pointermove', e => {
    const d = draft;
    if (!d || e.pointerId !== d.id) return;
    d.x = e.clientX; d.y = e.clientY;
    if (!d.creak && Math.hypot(d.x - d.x0, d.y - d.y0) > CSV.least * 2) { d.creak = true; SND.play('csPull'); }
  });
  app.addEventListener('pointerup', e => {
    const d = draft;
    if (!d || e.pointerId !== d.id) return;
    d.x = e.clientX; d.y = e.clientY; draft = null;
    try { d.el.releasePointerCapture(e.pointerId); } catch (err) { /* released already */ }
    const m = d.sq === state.zoom && live() ? pullOf(d, src.by) : null;
    if (m) fling(m);
    go();
  });
  app.addEventListener('pointercancel', e => { if (draft && e.pointerId === draft.id) { draft = null; go(); } });
}
// The shot goes: the boulder leaves here at once. Online the same simulation is run here on the castle as this phone
// has it and played from now (the server's record carries on from it); in a local match the move itself comes back at once.
function fling(m) {
  const sq = state.squares && state.squares[state.zoom], mini = sq && sq.mini, by = src.by;
  if (!mini || mini.type !== 'castle') return;
  let ph = null;
  if (state.online) {
    const M = castleLib();
    try { if (M) { const was = mini.c[other(by)], r = castleShot(M, was, m, castleCfg(mini)); ph = { by, aim: m.aim, power: m.power, kind: r.kind, core: r.core, ms: r.ms, rec: r.rec, ev: r.events, was }; } } catch (err) { ph = null; }
  }
  pend = { sq: state.zoom, m, by, t0: performance.now(), ph, till: performance.now() + (ph ? ph.ms : 2500) + 6000 };
  ownPress(); SND.play('csFling', { rate: 0.9 + m.power * 0.25 }); haptic('tap');
  const r = attemptMove(m);
  if (r && r.ok === false) pend = null;
}

// ---------- the drawing ----------
// A side's frame on the canvas: its own units with x across (to the right for X's shot, to the left for O's) and h up.
function frame(c, s, k, x0, gy, fn) {
  c.save();
  c.translate((s === 'X' ? -x0 : CS.w - x0) * k, gy); c.scale(s === 'X' ? k : -k, -k);
  fn(1 / k);
  c.restore();
}
function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath(); }
// One block at its pose (the frame's units; px: a pixel in them). A cracked stone carries its cracks; `hot`: struck just now.
function drawBlock(c, P, b, pose, px, hot) {
  const Kd = KINDS[b[0]], w = Kd.w, h = Kd.h, lw = Math.max(1.5 * px, 1.3);
  c.save(); c.translate(pose[0], pose[1]); c.rotate(-pose[2]);
  c.lineJoin = 'round'; c.lineCap = 'round';
  if (Kd.m === 'c') {                                              // the crystal: a cut gem, a facet lit, a glint
    c.fillStyle = 'rgba(154,108,240,.22)'; c.beginPath(); c.arc(0, 0, 14, 0, 7); c.fill();
    const pts = [[0, 9], [7, 3.5], [7, -4], [3.2, -9], [-3.2, -9], [-7, -4], [-7, 3.5]];
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = COL.gem; c.fill();
    c.beginPath(); c.moveTo(0, 9); c.lineTo(-7, 3.5); c.lineTo(-7, -4); c.lineTo(-1.5, -1); c.closePath(); c.fillStyle = COL.gemHi; c.fill();
    c.strokeStyle = P.ink; c.lineWidth = lw; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke();
    c.lineWidth = lw * 0.6; c.beginPath(); c.moveTo(-7, 3.5); c.lineTo(-1.5, -1); c.lineTo(7, 3.5); c.moveTo(-1.5, -1); c.lineTo(0, -9); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-3.4, 4.2, 1.3, 0, 7); c.fill();
  } else if (Kd.m === 'w') {                                       // timber: the grain along it, darker ends
    const long = w >= h;
    rrect(c, -w / 2, -h / 2, w, h, 1.6); c.fillStyle = COL.wood; c.fill();
    c.fillStyle = COL.wood2; if (long) { c.fillRect(-w / 2 + 0.6, -h / 2 + 0.6, 4, h - 1.2); c.fillRect(w / 2 - 4.6, -h / 2 + 0.6, 4, h - 1.2); } else { c.fillRect(-w / 2 + 0.6, -h / 2 + 0.6, w - 1.2, 4); c.fillRect(-w / 2 + 0.6, h / 2 - 4.6, w - 1.2, 4); }
    c.strokeStyle = 'rgba(90,52,20,.55)'; c.lineWidth = lw * 0.55; c.beginPath();
    if (long) { c.moveTo(-w / 2 + 7, 1.6); c.lineTo(w / 2 - 12, 1.2); c.moveTo(-w / 2 + 16, -2); c.lineTo(w / 2 - 7, -1.7); } else { c.moveTo(1.6, -h / 2 + 7); c.lineTo(1.2, h / 2 - 9); c.moveTo(-2, -h / 2 + 11); c.lineTo(-1.7, h / 2 - 6); }
    c.stroke();
    rrect(c, -w / 2, -h / 2, w, h, 1.6); c.strokeStyle = P.ink; c.lineWidth = lw; c.stroke();
  } else {                                                         // stone: a lit top edge, a few pocks, its cracks
    rrect(c, -w / 2, -h / 2, w, h, 2.2); c.fillStyle = hot ? '#fff6dc' : w > h ? COL.stone : COL.stone2; c.fill();
    c.fillStyle = COL.stoneHi; c.fillRect(-w / 2 + 2, h / 2 - 4.4, w - 4, 2.4);
    c.fillStyle = 'rgba(60,52,40,.3)'; for (const [x, y] of w > h ? [[-9, -2.5], [5, 1], [10, -4]] : [[-3.5, -3], [3.5, 1]]) { c.beginPath(); c.arc(x, y, 1, 0, 7); c.fill(); }
    rrect(c, -w / 2, -h / 2, w, h, 2.2); c.strokeStyle = P.ink; c.lineWidth = lw; c.stroke();
    if (b[4] || hot) {
      c.lineWidth = lw * 0.75; c.beginPath();
      c.moveTo(-w * 0.14, h / 2); c.lineTo(w * 0.02, h * 0.12); c.lineTo(-w * 0.1, -h * 0.08); c.lineTo(w * 0.06, -h / 2);
      c.moveTo(w * 0.02, h * 0.12); c.lineTo(w * 0.24, h * 0.02);
      if (b[4] > 1) { c.moveTo(w * 0.3, h / 2); c.lineTo(w * 0.22, 0); c.lineTo(w * 0.34, -h / 2); }
      c.stroke();
    }
  }
  c.restore();
}
function drawBoulder(c, P, x, h, px, spin, alpha) {
  c.save(); c.globalAlpha = alpha == null ? 1 : alpha; c.translate(x, h); c.rotate(-spin);
  const r = CS.r, pts = [[1, 0.05], [0.72, 0.68], [0.1, 1], [-0.62, 0.78], [-1, 0.12], [-0.8, -0.6], [-0.15, -1], [0.66, -0.74]];
  c.beginPath(); pts.forEach(([a, b], i) => (i ? c.lineTo(a * r, b * r) : c.moveTo(a * r, b * r))); c.closePath();
  c.fillStyle = COL.rock; c.fill();
  c.fillStyle = COL.rockHi; c.beginPath(); c.moveTo(-0.62 * r, 0.78 * r); c.lineTo(0.1 * r, r); c.lineTo(0.2 * r, 0.3 * r); c.lineTo(-0.5 * r, 0.2 * r); c.closePath(); c.fill();
  c.lineJoin = 'round'; c.strokeStyle = P.ink; c.lineWidth = Math.max(1.6 * px, 1.4); c.beginPath(); pts.forEach(([a, b], i) => (i ? c.lineTo(a * r, b * r) : c.moveTo(a * r, b * r))); c.closePath(); c.stroke();
  c.lineWidth = Math.max(px, 0.9); c.beginPath(); c.moveTo(-0.3 * r, -0.2 * r); c.lineTo(0.25 * r, -0.45 * r); c.moveTo(0.3 * r, 0.1 * r); c.lineTo(0.55 * r, -0.1 * r); c.stroke();
  c.restore();
}
// The arm's end at an angle (from straight ahead, anticlockwise): where the spoon is.
const spoon = th => [CS.cat + Math.cos(th) * ARM, CSV.axle + Math.sin(th) * ARM];
// A catapult in its shooter's frame: a frame on wheels, the throwing arm on its axle with a spoon at the long end and
// a weight box (in its owner's colour) hanging from the short one.
function drawCatapult(c, P, col, th, px, loaded) {
  const X = CS.cat, lw = Math.max(1.5 * px, 1.3), ux = Math.cos(th), uy = Math.sin(th);
  const beam = (x1, y1, x2, y2, w, fill) => { c.lineCap = 'round'; c.strokeStyle = P.ink; c.lineWidth = w + 2 * lw; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = fill; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
  beam(X - 15, 11, X, CSV.axle, 3.2, COL.wood2); beam(X + 15, 11, X, CSV.axle, 3.2, COL.wood2);
  beam(X - 20, 10, X + 20, 10, 4, COL.wood);
  for (const wx of [X - 14, X + 14]) { c.fillStyle = '#6f4a2a'; c.strokeStyle = P.ink; c.lineWidth = lw; c.beginPath(); c.arc(wx, 6, 6, 0, 7); c.fill(); c.stroke(); c.fillStyle = P.ink; c.beginPath(); c.arc(wx, 6, 1.4, 0, 7); c.fill(); }
  const sx = X - ux * 12, sy = CSV.axle - uy * 12, [ex, ey] = spoon(th);
  c.strokeStyle = P.ink; c.lineWidth = lw; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx, sy - 5); c.stroke();
  c.fillStyle = col; rrect(c, sx - 6, sy - 16, 12, 11, 2); c.fill(); c.stroke();
  beam(sx, sy, ex, ey, 2.8, COL.wood);
  c.save(); c.translate(ex, ey); c.rotate(Math.atan2(uy, ux));       // the spoon: a cup across the arm's end
  c.fillStyle = '#6f4a2a'; c.strokeStyle = P.ink; c.lineWidth = lw; c.beginPath(); c.arc(0, 2.5, 5.5, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
  c.restore();
  c.fillStyle = P.ink; c.beginPath(); c.arc(X, CSV.axle, 2.2, 0, 7); c.fill();
  if (loaded) drawBoulder(c, P, ex - uy * 6, ey + ux * 6 + 2, px, 0.4);
}
// The dust, splinters, rubble and the crystal's burst: each a picture of the time since its event (never kept).
function puff(c, x, h, u, col, n, reach) {
  c.fillStyle = col;
  for (let k = 0; k < n; k++) { const a = k * 2.4 + 0.5, d = reach * (0.3 + 0.7 * u) * (0.6 + (k % 3) * 0.2); c.globalAlpha = 0.75 * (1 - u); c.beginPath(); c.arc(x + Math.cos(a) * d, Math.max(2, h + Math.abs(Math.sin(a)) * d * 0.8), (2.5 + (k % 2) * 1.5) * (0.6 + u), 0, 7); c.fill(); }
  c.globalAlpha = 1;
}
function chips(c, P, x, h, u, col, n, px, long) {
  c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = Math.max(px, 0.9);
  for (let k = 0; k < n; k++) {
    const a = k * 2.1 + 0.7, v = 20 + (k % 3) * 9, cx = x + Math.cos(a) * v * u, cy = Math.max(1.5, h + Math.sin(a) * v * u + 16 * u - 44 * u * u);
    c.globalAlpha = u < 0.7 ? 1 : (1 - u) / 0.3;
    c.save(); c.translate(cx, cy); c.rotate(a + u * 5 * (k % 2 ? 1 : -1)); c.beginPath();
    if (long) c.rect(-4.5, -1, 9, 2); else { c.moveTo(-2.4, -1.6); c.lineTo(2.2, -2); c.lineTo(2.6, 1.6); c.lineTo(-1.8, 2); c.closePath(); }
    c.fill(); c.stroke(); c.restore();
  }
  c.globalAlpha = 1;
}
function burst(c, P, x, h, u, px) {
  const r = 10 + 34 * Math.min(1, u * 3), n = 11;
  c.save(); c.translate(x, h); c.globalAlpha = u < 0.55 ? 1 : Math.max(0, (1 - u) / 0.45);
  c.beginPath(); for (let k = 0; k < n * 2; k++) { const a = k * Math.PI / n, d = k % 2 ? r * 0.55 : r * (0.86 + (k % 3) * 0.07); if (k) c.lineTo(Math.cos(a) * d, Math.sin(a) * d); else c.moveTo(Math.cos(a) * d, Math.sin(a) * d); } c.closePath();
  c.fillStyle = '#fff'; c.fill(); c.strokeStyle = P.ink; c.lineWidth = Math.max(2 * px, 1.6); c.lineJoin = 'round'; c.stroke();
  c.beginPath(); for (let k = 0; k < n * 2; k++) { const a = k * Math.PI / n + 0.2, d = (k % 2 ? r * 0.3 : r * 0.58); if (k) c.lineTo(Math.cos(a) * d, Math.sin(a) * d); else c.moveTo(Math.cos(a) * d, Math.sin(a) * d); } c.closePath();
  c.fillStyle = COL.gemHi; c.fill();
  c.restore();
  chips(c, P, x, h, u, COL.gem, 9, px, false);
}

const go = stage('canvas.cscv', (c, W, H, now) => {
  if (!src) return false;
  const P = runColours(), { mini, a } = src;
  if (pend && (now > pend.till || pend.sq !== src.zoom)) pend = null;
  // the shot on show: the flash's, or this phone's own on its way to the server; T: ms into it (its pull first)
  let ph = a ? a.phys : null, T = 0;
  if (a) { const at = fxAt('move', a); T = at == null ? Infinity : now - at + leadOf(a); }
  else if (pend) { ph = pend.ph || { by: pend.by, aim: pend.m.aim, power: pend.m.power, kind: 'fly', rec: null, ev: [], was: null, ms: 2500 }; T = now - pend.t0 + CST.pull; }
  const by = ph ? ph.by : src.by, tg = other(by), tr = ph ? T - CST.pull - CST.swing : -1, fr = tr / FR;
  const d = ph && ph.rec ? decode(ph) : null;
  // the camera: the whole scene where it fits, else from the shooter's catapult to the castle it throws at
  const winW = clamp(W / CSV.px, CSV.win, CS.w + 2 * CSV.pad), k = W / winW, gy = Math.round(H - Math.max(22, H * CSV.ground)), want = by === 'X' ? CS.w + CSV.pad - winW : -CSV.pad;
  if (!cam || cam.sq !== src.zoom || cam.w !== W) cam = { x: want, t: now, sq: src.zoom, w: W };
  else { cam.x += (want - cam.x) * Math.min(1, (now - cam.t) / CSV.ease); cam.t = now; if (Math.abs(want - cam.x) < 0.5) cam.x = want; }
  const x0 = cam.x;
  // the sky, the hills, the ground
  const sky = c.createLinearGradient(0, 0, 0, gy); sky.addColorStop(0, COL.sky0); sky.addColorStop(1, COL.sky1); c.fillStyle = sky; c.fillRect(0, 0, W, gy);
  c.lineJoin = 'round'; c.strokeStyle = P.ink;
  for (const [cx, cy, s] of [[70, 0.16, 1], [290, 0.3, 0.8], [470, 0.12, 1.1]]) {   // (clouds: a little slower than the ground as the camera slides)
    const X = (cx - x0 * 0.4) * k * 1.25, Y = gy * cy, r = 15 * s * Math.max(0.8, k);
    c.fillStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(X - r * 1.1, Y + r * 0.2, r * 0.8, Math.PI * 0.5, Math.PI * 1.5); c.arc(X - r * 0.2, Y - r * 0.45, r, Math.PI, Math.PI * 1.9); c.arc(X + r, Y, r * 0.75, Math.PI * 1.4, Math.PI * 0.5); c.closePath(); c.fill(); c.stroke();
  }
  for (const [hx, hw, hh, col, par] of [[120, 250, 70, COL.hill0, 0.6], [410, 290, 92, COL.hill0, 0.6], [260, 230, 46, COL.hill1, 0.8], [560, 210, 58, COL.hill1, 0.8]]) {
    const X = (hx - x0 * par) * k + (1 - par) * W * 0.3; c.fillStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(X - hw * k / 2, gy + 2); c.quadraticCurveTo(X, gy - hh * k * 2, X + hw * k / 2, gy + 2); c.closePath(); c.fill(); c.stroke();
  }
  c.fillStyle = COL.grass; c.fillRect(0, gy, W, H - gy);
  c.fillStyle = 'rgba(40,90,30,.18)'; for (let gx = -((x0 * k) % 26); gx < W; gx += 26) c.fillRect(gx, gy + 7 + ((Math.round(gx + x0 * k) / 26) % 2 ? 4 : 0), 9, 2.5);
  c.fillStyle = P.ink; c.fillRect(0, gy - 1.5, W, 3);
  // each side's own things, in its shooter's frame: the banner behind the castle it throws at, that castle, its catapult
  let more = false, hotAt = null;
  if (ph && d) for (const e of ph.ev) if (e.k === 'crack') { const te = tr - e.t * STEP; if (te >= 0 && te < CSV.crack) (hotAt = hotAt || new Set()).add(e.i); }
  for (const s of [tg, by]) {                                      // (the shooter's own frame last: its boulder and dust over everything)
    const def = other(s), shooting = s === by && !!ph;
    frame(c, s, k, x0, gy, px => {
      const lw = Math.max(1.5 * px, 1.3);
      // the banner of the castle's owner, on a pole behind it
      const bx = CS.foot[1] + 6, bh = 118;
      c.strokeStyle = P.ink; c.lineWidth = lw * 1.3; c.lineCap = 'round'; c.beginPath(); c.moveTo(bx, 0); c.lineTo(bx, bh); c.stroke();
      c.fillStyle = def === 'X' ? P.X : P.O; c.lineWidth = lw; c.beginPath(); c.moveTo(bx, bh); c.lineTo(bx - 24, bh - 7); c.lineTo(bx, bh - 15); c.closePath(); c.fill(); c.stroke();
      // the castle: as the recording has it while its shot plays, else as it lies
      const rec = shooting && d && ph.was;
      const list = rec ? ph.was : mini.c[def];
      for (let i = 0; i < list.length; i++) {
        const b = list[i], pose = rec ? poseAt(d, b, i, Math.max(0, fr)) : [b[1] / 10, b[2] / 10, b[3] / 1000];
        if (pose) drawBlock(c, P, b, pose, px, !!(rec && hotAt && hotAt.has(i)));
      }
      // the catapult: at rest, drawn back by the drag or the pull, swinging, or thrown
      let th = CSV.rest, loaded = false;
      const col = s === 'X' ? P.X : P.O;
      if (shooting) {
        const back = CSV.rest + CSV.back * ph.power;
        if (T < CST.pull) { const u = clamp(T / (CST.pull * 0.8), 0, 1); th = lerp(CSV.rest, back, 1 - (1 - u) * (1 - u)); loaded = true; }
        else if (tr < 0) { const u = clamp((T - CST.pull) / CST.swing, 0, 1); th = lerp(back, REL, u * u); loaded = true; }
        else { const u = clamp(tr / 260, 0, 1); th = REL - CSV.over * Math.sin(u * Math.PI) * (1 - u * 0.5); }
      } else if (s === src.by && !ph && src.mine) {
        const m = draft && draft.sq === src.zoom ? pullOf(draft, s) : null;
        th = m ? CSV.rest + CSV.back * m.power : CSV.rest; loaded = true;
        if (m) {                                                   // the first part of the flight, dotted
          const arc = castleArc(m, castleCfg(mini).vMax, CSV.arc);
          for (let q = CSV.dot - 1; q < arc.length; q += CSV.dot) { const u = q / arc.length; c.globalAlpha = 1 - u * 0.75; c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = Math.max(px, 0.9); c.beginPath(); c.arc(arc[q][0], arc[q][1], Math.max(2.4 * px, 2.2) * (1 - u * 0.35), 0, 7); c.fill(); c.stroke(); }
          c.globalAlpha = 1;
        }
      } else if (s === src.by && !ph && !src.view) loaded = true;
      drawCatapult(c, P, col, th, px, loaded);
      if (!shooting || tr < 0) return;
      // the boulder: along its recorded path (a streak behind it), then gone where it crumbled
      const end = ph.ev.find(e => e.k === 'end' || e.k === 'thud');
      if (d && d.ball.length) {
        const n = d.ball.length / 2, f2 = clamp(fr, 0, n - 1), i0 = Math.floor(f2), i1 = Math.min(n - 1, i0 + 1), u = f2 - i0;
        const bx2 = lerp(d.ball[i0 * 2], d.ball[i1 * 2], u) / 2, bh2 = lerp(d.ball[i0 * 2 + 1], d.ball[i1 * 2 + 1], u) / 2, flying = fr < n - 1;
        if (flying) for (let q = CSV.trail; q >= 1; q--) { const g = clamp(fr - q * 0.55, 0, n - 1), j0 = Math.floor(g), j1 = Math.min(n - 1, j0 + 1), v = g - j0; c.fillStyle = `rgba(255,255,255,${0.42 - q * 0.07})`; c.beginPath(); c.arc(lerp(d.ball[j0 * 2], d.ball[j1 * 2], v) / 2, lerp(d.ball[j0 * 2 + 1], d.ball[j1 * 2 + 1], v) / 2, CS.r * (1 - q * 0.13), 0, 7); c.fill(); }
        if (flying || ph.kind !== 'hit') drawBoulder(c, P, bx2, bh2, px, bx2 / CS.r, flying ? 1 : clamp(1 - (tr - n * FR) / 500, 0.35, 1));
      } else if (!d && ph.kind === 'fly') {                         // (no simulation here yet: along its plain arc until the record lands)
        const arc = castleArc(ph, castleCfg(mini).vMax, 150), q = Math.min(arc.length - 1, Math.floor(tr / STEP));
        if (q >= 0 && arc[q][1] > CS.r) drawBoulder(c, P, arc[q][0], arc[q][1], px, arc[q][0] / CS.r);
      }
      for (const e of ph.ev) {
        const te = tr - e.t * STEP;
        if (te < 0) continue;
        if (e.k === 'hit' && e.v >= 1.5 && te < CSV.puff) puff(c, e.x, e.h, te / CSV.puff, e.m === 'g' ? COL.dirt : COL.dust, 5, 8 + Math.min(10, e.v));
        else if (e.k === 'thud' && te < CSV.puff) puff(c, e.x, 0, te / CSV.puff, COL.dirt, 6, 16);
        else if (e.k === 'off' && te < CSV.puff) puff(c, e.x, e.h, te / CSV.puff, COL.dust, 6, 14);
        else if (e.k === 'break' && te < CSV.chips) { chips(c, P, e.x, e.h, te / CSV.chips, e.m === 'w' ? COL.wood : COL.stone2, e.m === 'w' ? 7 : 8, px, e.m === 'w'); if (te < CSV.puff) puff(c, e.x, e.h, te / CSV.puff, COL.dust, 5, 12); }
        else if (e.k === 'core' && te < CSV.burst) burst(c, P, e.x, e.h, te / CSV.burst, px);
        else if (e.k === 'end' && te < CSV.chips) { chips(c, P, e.x, e.h, te / CSV.chips, COL.rock, 6, px, false); if (te < CSV.puff) puff(c, e.x, e.h, te / CSV.puff, COL.dust, 5, 10); }
      }
      if (end && tr < (end.t * STEP) + CSV.chips) more = true;
    });
  }
  if (ph && T < CST.pull + CST.swing + (ph.ms || 0) + CSV.burst) more = true;
  // this phone's own shot is ahead of its flash by the pull it never shows: the flash ends as its picture does
  if (a && src.own && skipped !== a && T >= CST.pull + CST.swing + (ph.ms || 0) + 60 && Number.isFinite(T) && flashAnimating()) { skipped = a; setTimeout(() => { if (state.flash === a) skipFlash(); }, 0); }
  return more || !!draft || !!pend || cam.x !== want;
});

// ---------- the screen ----------
const words = l => (l.core ? 'Crystal smashed!' : l.kind === 'short' ? 'Fell short' : l.kind === 'long' ? 'Sailed past' : l.broke > 1 ? 'Smashed through!' : l.broke ? 'Smashed a block!' : l.off ? 'Knocked one out!' : l.cracked ? 'Cracked the stone!' : l.moved ? 'Shook the walls' : 'Just a thud');
const good = l => !!(l.core || l.broke || l.off || l.cracked);
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const ph = a && a.phys ? a.phys : null, own = !!ph && ownMove(a), o = { view, locked, turn };
  const rest = !ph && (view || d) && mini.last ? mini.last : null, l = ph || rest;
  const by = ph ? a.by : rest ? rest.by : turn, mine = !view && !locked && !ph && !d;
  const lead = ph ? leadOf(a) : 0, t0 = ph ? CST.pull + CST.swing - lead : null, land = ph ? Math.max(0, t0 + ph.ms) : null;
  if (pend && ((ph && own) || pend.sq !== state.zoom)) pend = null;   // (the record has come back: the flash carries the shot on)
  const tal = p => {
    const n = mini.n[p], was = ph && a.by === p ? n - 1 : n, lab = v => `<span>${v}</span><small>${v === 1 ? 'shot' : 'shots'}</small>`;
    return arcTally(p, o, `<b class="dbig cscnt" aria-label="${n} shot${n === 1 ? '' : 's'}">${was !== n ? `<i class="was" style="--t:${Math.max(0, Math.round(t0))}ms">${lab(was)}</i><i class="now" style="--t:${Math.max(0, Math.round(t0))}ms">${lab(n)}</i>` : `<i>${lab(n)}</i>`}</b>`);
  };
  const line = ph ? `<p ${lateAt('csline ' + (good(ph) ? 'ok' : 'no'), land)} role="status">${words(ph)}</p>` : `<p class="csline${l ? (good(l) ? ' ok' : ' no') : ''}">${l ? words(l) : ''}</p>`;
  src = { mini, a: ph ? a : null, by, own, mine, view: !!(view || d), zoom: state.zoom };
  go();
  const left = p => (castleCore(mini.c[p]) ? `${mini.c[p].length - 1} blocks and the crystal` : 'smashed');
  return `<div class="g-cs pc-${by}"><div class="ctals">${tal('X')}${tal('O')}</div><div class="csbox"><div class="csfield${mine ? ' live' : ''}"><canvas class="cscv" role="img" aria-label="Two castles and their catapults. X's castle: ${left('X')}. O's castle: ${left('O')}."></canvas></div></div>${line}</div>`;
}
// The miniature: the two castles as they stand, side by side, each under its owner's mark, the crystals in them.
export function miniature(mini, final) {
  const half = (p, dx) => mini.c[p].map(b => {
    const Kd = KINDS[b[0]], x = (p === 'O' ? b[1] / 10 - CS.foot[0] : CS.foot[1] - b[1] / 10) + dx, y = 122 - b[2] / 10, deg = ((p === 'O' ? 1 : -1) * b[3] / 1000 * 180 / Math.PI).toFixed(0);
    const tf = `transform="translate(${x.toFixed(1)} ${y.toFixed(1)})${deg === '0' || deg === '-0' ? '' : ` rotate(${deg})`}"`;
    return b[0] === K.core ? `<path class="tcsg" ${tf} d="M0-10 8-4 8 4 3.5 10-3.5 10-8 4-8-4z"/>` : `<rect class="${Kd.m === 'w' ? 'tcsw' : 'tcss'}" ${tf} x="${-Kd.w / 2}" y="${-Kd.h / 2}" width="${Kd.w}" height="${Kd.h}" rx="2"/>`;
  }).join('');
  const n = p => mini.c[p].length - (castleCore(mini.c[p]) ? 1 : 0);
  return `<div class="tcs" aria-label="Castle Smash: X's castle ${n('X')} blocks, O's castle ${n('O')} blocks"><svg viewBox="0 0 372 132" aria-hidden="true"><path class="tcsl" d="M40 122H332"/>${half('X', 44)}${half('O', 200)}${tokSvg('X', 20, 66, 19)}${tokSvg('O', 352, 66, 19)}</svg></div>`;
}
export function moveText(f, who) {
  const l = f.phys;
  return !l ? `${who} flung a boulder` : l.core ? `${who} smashed the crystal` : l.kind === 'short' ? `${who}'s boulder fell short` : l.kind === 'long' ? `${who}'s boulder sailed past` : l.broke ? `${who} smashed a block` : l.off ? `${who} knocked a block out` : l.cracked ? `${who} cracked a stone` : l.moved ? `${who} shook the castle` : `${who} hit the castle`;
}
// The shot's sounds, each once from the simulation's events: the rope and the fling (someone else's: a shot made here
// was heard as it was made), the whoosh of the flight, a knock for each of the boulder's hits by what it struck and how
// hard, the blocks' own knocks, a crack, a break, the crystal's end, a dull thud for a dud.
export function sounds(f, add, won, mini, last) {
  const ph = f.phys; if (!ph) return;
  const own = ownMove(f), lead = leadOf(f), base = CST.pull + CST.swing - lead, put = (n, ms, rate) => { if (base + ms >= -30) add(n, Math.max(0, base + ms), rate); };
  if (!own) { add('csPull', 0); add('csFling', CST.pull, 0.9 + ph.power * 0.25); }
  put('csWhoosh', 60, 0.85 + ph.power * 0.3);
  let knocks = 0, lastAt = -99;
  for (const e of ph.ev || []) {
    const ms = e.t * STEP;
    if (e.k === 'hit' || e.k === 'knock') {
      if (e.v < CS.knock || ms - lastAt < 70 || knocks >= 12) continue;
      knocks++; lastAt = ms;
      put(e.m === 'g' ? 'csThump' : e.m === 'w' ? 'csWood' : 'csKnock', ms, clamp(0.8 + e.v / 14, 0.8, 1.45));
    } else if (e.k === 'crack') put('csCrack', ms);
    else if (e.k === 'break') put(e.m === 'w' ? 'csBreak' : 'csCrumble', ms);
    else if (e.k === 'off') put('csOff', ms);
    else if (e.k === 'core') put('csSmash', ms);
    else if (e.k === 'thud') put('csDud', ms);
  }
}
