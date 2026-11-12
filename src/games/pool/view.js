// Pool: the screen, the miniature, the move's words and sounds, and the inputs.
import { tune } from '../../core/tune.js';
import { PHYSICS } from '../shared/physics.js';
import { poolIds, poolLeft, poolRank, poolReach, poolSight } from './rules.js';
import { REDUCED, state } from '../../ui/app.js';
import { physResult, physTable } from '../../ui/physics.js';
export { physReplay as replay } from '../../ui/physics.js';
import { outlined, rr, runColours } from '../../ui/runner.js';
export { physicsSounds as sounds } from '../../ui/physics.js';

// The table (November 2026, the polish pass): seen from straight above, as a pool table is aimed on (a camera at an
// angle would bend every line a shot is judged by), with its depth in the light: one lamp up and to the left, so the
// rails shade the cloth along the top and the left, every ball has a soft shadow down and to the right and a shine
// up and to the left, and the cue lies over its own shadow. The table itself (floor, rails, sights, cushions, cloth,
// pockets) is painted once into a layer and copied each frame; the balls, the cue and the sight line are drawn over
// it 60 times a second from the move's event (ui/physics.js physDrawNow).
export const POOL_RAIL = 7;                                             // the pool table's rail, in table units, the same on all four sides (its cushion and its wood)
const POOLV = {
  cushion: 2.3,                 // the cushion's part of the rail
  hole: 6.2, set: 0.6,          // a pocket's hole as drawn (the ball drops into it once its centre is on the pocket's slope, the table's own reach, drawn as the darker cloth round the hole), set back into the rail this far
  light: [0.22, 0.3],           // where a shadow falls, in ball radii across and down
  drop: 0.26,                   // a pocketed ball's roll down into the hole, in s
  stroke: 0.05, follow: 0.13, fade: 0.2,   // the cue's stroke at the shot: up to the ball, on through it, gone (s)
  stick: 66, pull: 15,          // the cue's length, and how far a full pull draws it back from the ball (table units)
};
const COL = { floor: '#3a2716', wood: '#8f5a2b', woodLo: '#6f4320', cushion: '#1f6f40', cloth: '#2d8a4e', hole: '#0c0a09', cue: '#fdfaf0', black: '#1b1b1b' };
// The table's sizes before the physics library has loaded (the miniature draws at once): physics-sim.js POOL's, which takes over once it is in.
const POOL_TABLE = { w: 100, h: 180, ballR: 3.9, pockets: [[0, 0, 8.4], [100, 0, 8.4], [0, 90, 8.4], [100, 90, 8.4], [0, 180, 8.4], [100, 180, 8.4]] };
const sizes = () => (PHYSICS.lib && PHYSICS.lib.POOL) || POOL_TABLE;
// A pocket's hole as drawn: its centre set back from the cloth's edge into the rail (a corner's along the diagonal).
function holeAt([x, y], S) {
  const sx = x <= 0 ? -1 : x >= S.w ? 1 : 0, sy = y <= 0 ? -1 : y >= S.h ? 1 : 0, d = POOLV.set / (sx && sy ? Math.SQRT2 : 1);
  return [x + sx * d * (sx && sy ? 1.2 : 1), y + sy * d * (sx && sy ? 1.2 : 1)];
}

// ---- the table, painted once ----
let layer = null;                                                 // { key, cv }: the table as painted for a canvas of this size
function paintTable(g) {
  const c = g.c, P = runColours(), S = sizes(), k = g.k, M = g.M || POOL_RAIL, X = g.X, Y = g.Y, CU = POOLV.cushion, ink = Math.max(2, 0.7 * k);
  const outer = () => rr(c, X(-M), Y(-M), (S.w + 2 * M) * k, (S.h + 2 * M) * k, M * k * 0.9);
  c.fillStyle = COL.floor; c.fillRect(0, 0, g.W, g.H);                                   // the floor round the table, and the table's shadow on it
  c.fillStyle = 'rgba(0,0,0,.3)'; rr(c, X(-M) + 0.7 * k, Y(-M) + 1.1 * k, (S.w + 2 * M) * k, (S.h + 2 * M) * k, M * k * 0.9); c.fill();
  outer(); outlined(c, COL.wood, P.ink, ink);                                           // the rail: wood, outlined like the rest of the game
  c.save(); outer(); c.clip();
  c.strokeStyle = COL.woodLo; c.lineWidth = Math.max(1, 0.5 * k);                       // a groove round the wood
  rr(c, X(-M + 1.2), Y(-M + 1.2), (S.w + 2 * M - 2.4) * k, (S.h + 2 * M - 2.4) * k, (M - 1.2) * k * 0.9); c.stroke();
  c.fillStyle = COL.cushion; c.fillRect(X(-CU), Y(-CU), (S.w + 2 * CU) * k, (S.h + 2 * CU) * k);   // the cushions: a band of darker cloth inside the wood
  c.strokeStyle = P.ink; c.lineWidth = Math.max(1.5, 0.45 * k); c.strokeRect(X(-CU), Y(-CU), (S.w + 2 * CU) * k, (S.h + 2 * CU) * k);
  c.fillStyle = COL.cloth; c.fillRect(X(0), Y(0), S.w * k, S.h * k);                    // the cloth: lighter under the lamp, darker towards the rails
  const lamp = c.createRadialGradient(X(S.w * 0.42), Y(S.h * 0.4), 8 * k, X(S.w / 2), Y(S.h / 2), 118 * k);
  lamp.addColorStop(0, 'rgba(255,255,255,.09)'); lamp.addColorStop(0.55, 'rgba(255,255,255,0)'); lamp.addColorStop(1, 'rgba(0,0,0,.16)');
  c.fillStyle = lamp; c.fillRect(X(0), Y(0), S.w * k, S.h * k);
  const shade = (x0, y0, x1, y1, x, y, w, h) => { const sg = c.createLinearGradient(X(x0), Y(y0), X(x1), Y(y1)); sg.addColorStop(0, 'rgba(0,0,0,.3)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.fillRect(X(x), Y(y), w * k, h * k); };
  shade(0, 0, 0, 3.2, 0, 0, S.w, 3.2); shade(0, 0, 2.6, 0, 0, 0, 2.6, S.h);            // the top and left cushions' shadows on the cloth
  c.strokeStyle = 'rgba(255,255,255,.13)'; c.lineWidth = Math.max(1, 0.3 * k);          // the line the white is spotted on, and the two spots
  const cue = S.start ? S.start.cue : [50, 140], black = S.start ? S.start.black : [50, 50];
  c.beginPath(); c.moveTo(X(0), Y(cue[1])); c.lineTo(X(S.w), Y(cue[1])); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.4)';
  for (const [x, y] of [cue, black]) { c.beginPath(); c.arc(X(x), Y(y), 0.9 * k, 0, Math.PI * 2); c.fill(); }
  for (const pk of S.pockets) {                                                          // the pockets: the wood rounds the mouth (the cushions end there), the cloth slopes down, the hole
    const [x, y, r] = pk, [hx, hy] = holeAt(pk, S);
    c.save();
    c.beginPath(); c.rect(0, 0, g.W, g.H); c.rect(X(0), Y(0), S.w * k, S.h * k); c.clip('evenodd');   // (off the cloth: the rail's side of the mouth)
    c.beginPath(); c.arc(X(x), Y(y), r * k, 0, Math.PI * 2); c.fillStyle = COL.wood; c.fill(); c.strokeStyle = P.ink; c.lineWidth = Math.max(1.5, 0.45 * k); c.stroke();
    c.restore();
    c.save();
    c.beginPath(); c.rect(X(0), Y(0), S.w * k, S.h * k); c.clip();                       // (on the cloth: the slope a ball drops down)
    const sl = c.createRadialGradient(X(hx), Y(hy), POOLV.hole * k * 0.7, X(x), Y(y), r * k);
    sl.addColorStop(0, 'rgba(0,0,0,.5)'); sl.addColorStop(1, 'rgba(0,0,0,.2)');
    c.beginPath(); c.arc(X(x), Y(y), r * k, 0, Math.PI * 2); c.fillStyle = sl; c.fill();
    c.restore();
    c.beginPath(); c.arc(X(hx), Y(hy), POOLV.hole * k, 0, Math.PI * 2);
    const hg = c.createRadialGradient(X(hx) + 0.8 * k, Y(hy) + 1.1 * k, POOLV.hole * k * 0.2, X(hx), Y(hy), POOLV.hole * k);
    hg.addColorStop(0, '#2a211a'); hg.addColorStop(0.7, COL.hole); hg.addColorStop(1, '#000');
    c.fillStyle = hg; c.fill(); c.strokeStyle = P.ink; c.lineWidth = ink; c.stroke();
  }
  const mid = -(M + CU) / 2 - 0.2, sight = (x, y, along) => {                           // the sights on the wood: three between each pair of pockets
    const a = 1.15 * k, b = 0.62 * k, w = along ? a : b, h = along ? b : a;
    c.beginPath(); c.moveTo(X(x) - w, Y(y)); c.lineTo(X(x), Y(y) - h); c.lineTo(X(x) + w, Y(y)); c.lineTo(X(x), Y(y) + h); c.closePath();
    c.fillStyle = P.paper; c.fill(); c.strokeStyle = P.ink; c.lineWidth = Math.max(1, 0.25 * k); c.stroke();
  };
  for (const f of [0.25, 0.5, 0.75]) {
    sight(S.w * f, mid, true); sight(S.w * f, S.h - mid, true);
    for (const half of [0, 1]) { const y = (half + f) * S.h / 2; sight(mid, y, false); sight(S.w - mid, y, false); }
  }
  c.restore();
  outer(); c.strokeStyle = P.ink; c.lineWidth = ink; c.stroke();                         // (the outline again, over what the pockets and the cushions drew up to it)
}
function tableLayer(g) {
  const t = g.c.getTransform ? g.c.getTransform() : null, dpr = t && typeof t.a === 'number' && t.a > 0 ? t.a : 1;
  const key = [g.W, g.H, typeof g.k === 'number' ? g.k.toFixed(4) : '', dpr].join('|');
  if (layer && layer.key === key) return layer.cv;
  layer = null;
  try {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(g.W * dpr)); cv.height = Math.max(1, Math.round(g.H * dpr));
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintTable(Object.assign({}, g, { c }));
    layer = { key, cv };
  } catch (e) { layer = null; }                                   // (no canvas to keep it in: painted straight on, below)
  return layer ? layer.cv : null;
}

// ---- the balls ----
// A ball rolls: the mark on it (its X or O, the black's skull, the white's ring) is carried round by the way the ball
// travels, a full turn for every circumference rolled, and every ball has the same mark on its other side. A ball
// starts with its mark straight up (as the table at rest draws it) and must end with it straight up (a ball that has
// stopped can always be read): so the mark is rolled forwards from where the ball starts and backwards from where it
// ends, and shown between the two, by how far along its way the ball is (rollOf). The difference is a slow drift over
// the whole roll, never a jump. m: where the mark's centre points, a unit vector (z towards the eye).
const ROLLS = new WeakMap(), UP = [0, 0, 1];
function turn(m, dx, dy, R) {                                     // the mark after the ball has rolled (dx, dy)
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return m;
  const ux = dx / d, uy = dy / d, a = d / R, ca = Math.cos(a), sa = Math.sin(a), along = m[0] * ux + m[1] * uy;
  const al = along * ca + m[2] * sa, z = m[2] * ca - along * sa;
  return [m[0] + (al - along) * ux, m[1] + (al - along) * uy, z];
}
function mix(a, b, u) {                                           // between two marks (either side of a ball is the same mark: the nearer one)
  const s = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < 0 ? -1 : 1, x = a[0] + (s * b[0] - a[0]) * u, y = a[1] + (s * b[1] - a[1]) * u, z = a[2] + (s * b[2] - a[2]) * u, d = Math.hypot(x, y, z);
  return d < 1e-6 ? a : [x / d, y / d, z / d];
}
function rollOf(rec, R) {
  let r = ROLLS.get(rec);
  if (r) return r;
  r = {};
  const F = rec.frames, n = F.length;
  rec.ids.forEach((id, i) => {
    const at = new Array(n), fwd = new Array(n), far = new Array(n), step = k => [F[k + 1][2 * i] - F[k][2 * i], F[k + 1][2 * i + 1] - F[k][2 * i + 1]];
    let last = n - 1;
    while (last > 0 && F[last][2 * i] == null) last--;
    let m = UP, s = 0;
    for (let k = 0; k < n; k++) { fwd[k] = m; far[k] = s; if (k < last && F[k][2 * i] != null) { const [dx, dy] = step(k); m = turn(m, dx, dy, R); s += Math.hypot(dx, dy); } }
    m = UP;
    for (let k = n - 1; k >= 0; k--) {
      if (k < last && F[k][2 * i] != null) { const [dx, dy] = step(k); m = turn(m, -dx, -dy, R); }   // (a step back along its roll)
      const u = s > 0 ? far[k] / s : 1;
      at[k] = mix(fwd[k], m, u * u * (3 - 2 * u));
    }
    r[id] = { at, last };
  });
  ROLLS.set(rec, r);
  return r;
}
function markNow(roll, rec, id, f, pos, R) {                      // the mark at frame f (a fraction: between two frames, as the ball is drawn)
  const r = roll[id], i = rec.ids.indexOf(id);
  if (!r || i < 0 || !pos) return UP;
  const k = Math.max(0, Math.min(rec.frames.length - 1, Math.floor(f)));
  if (k >= r.last) return r.at[Math.min(k, r.at.length - 1)];
  const a = rec.frames[k], b = rec.frames[k + 1];
  return mix(turn(r.at[k], pos[0] - a[2 * i], pos[1] - a[2 * i + 1], R), turn(r.at[k + 1], pos[0] - b[2 * i], pos[1] - b[2 * i + 1], R), f - k);   // (rolled on from the frame before and back from the one after)
}
// One ball: its shadow is drawn before any ball (ballShadow), then the ball: its colour, the shade away from the lamp,
// its mark where the roll has carried it, the ink outline, the shine.
function ballShadow(c, X, Y, R) {
  c.beginPath(); c.ellipse(X + R * POOLV.light[0], Y + R * POOLV.light[1], R * 1.04, R * 1.0, 0, 0, Math.PI * 2); c.fill();
}
function ballMark(c, id, R, P) {                                  // the mark itself, about (0, 0)
  if (id === 'cue') { c.beginPath(); c.arc(0, 0, R * 0.26, 0, Math.PI * 2); c.strokeStyle = 'rgba(22,18,16,.42)'; c.lineWidth = Math.max(1, R * 0.12); c.stroke(); return; }
  if (id === 'black') {                                           // a little skull
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -R * 0.12, R * 0.42, 0, Math.PI * 2); c.fill(); c.fillRect(-R * 0.26, R * 0.1, R * 0.52, R * 0.3);
    c.fillStyle = '#111'; c.beginPath(); c.arc(-R * 0.16, -R * 0.16, R * 0.11, 0, Math.PI * 2); c.arc(R * 0.16, -R * 0.16, R * 0.11, 0, Math.PI * 2); c.fill();
    return;
  }
  c.strokeStyle = P.ink; c.lineCap = 'round'; c.lineWidth = Math.max(1.6, R * 0.24);
  if (id[0] === 'x') { const s = R * 0.36; c.beginPath(); c.moveTo(-s, -s); c.lineTo(s, s); c.moveTo(s, -s); c.lineTo(-s, s); c.stroke(); }
  else { c.beginPath(); c.arc(0, 0, R * 0.36, 0, Math.PI * 2); c.stroke(); }
}
function ball(c, X, Y, R, id, P, m, dim) {
  if (R <= 0.5) return;
  const fill = id === 'cue' ? COL.cue : id === 'black' ? COL.black : id[0] === 'x' ? P.X : P.O;
  c.save();
  c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); c.clip();
  c.beginPath(); c.rect(X - R * 2, Y - R * 2, R * 4, R * 4); c.arc(X - R * 0.3, Y - R * 0.38, R * 1.04, 0, Math.PI * 2); c.fillStyle = id === 'black' ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.17)'; c.fill('evenodd');   // the side away from the lamp
  const n = m && m[2] < 0 ? [-m[0], -m[1], -m[2]] : m || [0, 0, 1];   // (the mark on the side that shows)
  if (n[2] > 0.06) {
    const a = Math.atan2(n[1], n[0]);
    c.translate(X + n[0] * R, Y + n[1] * R); c.rotate(a); c.scale(n[2], 1); c.rotate(-a);   // (squashed towards the rim as it turns away)
    ballMark(c, id, R, P);
  }
  c.restore();
  if (dim > 0) { c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); c.fillStyle = `rgba(0,0,0,${dim.toFixed(3)})`; c.fill(); }   // (down in the hole: in its dark)
  c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); c.lineWidth = Math.max(1.5, R * 0.19); c.strokeStyle = P.ink; c.stroke();
  if (!(dim > 0.3)) { c.beginPath(); c.arc(X - R * 0.38, Y - R * 0.4, R * 0.2, 0, Math.PI * 2); c.fillStyle = id === 'black' ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.7)'; c.fill(); }
}
// The table and everything on it. pos: where each ball is now (null: off the table); pop: { id, s, cue } a ball popping
// onto the table at scale s after a scratch, the white with it (ui/physics.js poolPop); play: { ph, el } the shot being
// played, el seconds into it (the roll of the marks, a pocketed ball's drop into its hole, the cue's stroke). Returns
// true while something of its own is still moving after the recording's last frame (a drop, the cue).
export function drawPool(g, mini, pos, pop, play) {
  const c = g.c, P = runColours(), S = sizes(), R = S.ballR, k = g.k;
  const cv = tableLayer(g);
  if (cv) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(cv, 0, 0); c.restore(); } else paintTable(g);
  const rec = play && play.ph && play.ph.rec && Array.isArray(play.ph.rec.frames) && play.ph.rec.frames.length && !REDUCED ? play.ph.rec : null;
  const el = rec ? Math.max(0, play.el) : 0, f = rec ? Math.min(rec.frames.length - 1, el * rec.fps) : 0, roll = rec ? rollOf(rec, R) : null;
  let busy = false;
  const ids = Object.keys(pos).sort((a, b) => poolRank(a) - poolRank(b)), size = id => (pop && (id === pop.id || (id === 'cue' && pop.cue)) ? Math.max(0, pop.s) : 1);
  const drops = [];                                                // the balls on their way down a pocket
  if (rec) rec.ids.forEach((id, i) => {
    const r = roll[id];
    if (!r || r.last >= rec.frames.length - 1 || pos[id]) return;
    const t = el - (r.last + 1) / rec.fps;
    if (t < 0) return;
    if (t >= POOLV.drop) return;
    busy = true;
    const from = [rec.frames[r.last][2 * i], rec.frames[r.last][2 * i + 1]], pk = S.pockets.reduce((a, b) => (Math.hypot(b[0] - from[0], b[1] - from[1]) < Math.hypot(a[0] - from[0], a[1] - from[1]) ? b : a));
    const to = holeAt(pk, S), u = t / POOLV.drop, e = 1 - (1 - u) * (1 - u);
    drops.push({ id, x: from[0] + (to[0] - from[0]) * e, y: from[1] + (to[1] - from[1]) * e, s: 1 - 0.42 * u * u, dim: 0.85 * u, m: r.at[r.last] });
  });
  c.fillStyle = 'rgba(0,0,0,.26)';                                 // every shadow first: no shadow ever lies over a ball
  for (const id of ids) if (pos[id] && size(id) > 0.05) ballShadow(c, g.X(pos[id][0]), g.Y(pos[id][1]), R * k * Math.min(1, size(id)));
  for (const d of drops) ball(c, g.X(d.x), g.Y(d.y), R * k * d.s, d.id, P, d.m, d.dim);
  for (const id of ids) {
    if (!pos[id]) continue;
    const s = size(id);
    ball(c, g.X(pos[id][0]), g.Y(pos[id][1]), R * k * s, id, P, s < 0.6 ? [1, 0, 0] : roll && !(pop && s !== 1) ? markNow(roll, rec, id, f, pos[id], R) : UP, 0);   // (a ball still popping on: its mark comes with its size)
  }
  if (rec && Number.isFinite(play.ph.aim)) {                       // the cue's stroke: drawn back as it was let go, up to the ball, on through where it stood, and away
    const T = POOLV.stroke + POOLV.follow + POOLV.fade, i = rec.ids.indexOf('cue');
    if (el < T && i >= 0 && rec.frames[0][2 * i] != null) {
      busy = true;
      const pw = Math.max(0, Math.min(1, Number(play.ph.power) || 0)), back = 0.9 + pw * POOLV.pull, thru = -(1.5 + 5 * pw);
      const gap = el < POOLV.stroke ? back * (1 - Math.pow(el / POOLV.stroke, 2)) : thru * (1 - Math.pow(1 - Math.min(1, (el - POOLV.stroke) / POOLV.follow), 2));
      const alpha = el < POOLV.stroke + POOLV.follow ? 1 : Math.max(0, 1 - (el - POOLV.stroke - POOLV.follow) / POOLV.fade);
      drawCue(g, [rec.frames[0][2 * i], rec.frames[0][2 * i + 1]], play.ph.aim, gap, alpha, P);
    }
  }
  return busy;
}
// The cue: its tip `gap` table units behind the ball's edge (less than nothing: through where the ball stood), lying
// along the aim, over its own shadow.
function drawCue(g, from, aim, gap, alpha, P) {
  const c = g.c, S = sizes(), k = g.k, ux = Math.sin(aim), uy = -Math.cos(aim), px = -uy, py = ux;
  const at = d => [g.X(from[0] - ux * d), g.Y(from[1] - uy * d)], d0 = S.ballR + gap, L = POOLV.stick;
  const shape = (a, b, wa, wb) => {                                // a length of the cue from a to b along it, wa wide at a and wb at b
    const A = at(d0 + a), B = at(d0 + b);
    c.beginPath(); c.moveTo(A[0] + px * wa * k, A[1] + py * wa * k); c.lineTo(B[0] + px * wb * k, B[1] + py * wb * k); c.lineTo(B[0] - px * wb * k, B[1] - py * wb * k); c.lineTo(A[0] - px * wa * k, A[1] - py * wa * k); c.closePath();
  };
  const w = d => 0.8 + (1.9 - 0.8) * (d / L);                   // half its width along its length: slim at the tip, stout at the butt
  c.save(); c.globalAlpha = alpha; c.lineJoin = 'round';
  c.save(); c.translate(1.3 * k, 1.8 * k); shape(0, L, w(0), w(L)); c.fillStyle = 'rgba(0,0,0,.22)'; c.fill(); c.restore();   // its shadow
  shape(0, L, w(0), w(L)); c.strokeStyle = P.ink; c.lineWidth = Math.max(3.5, 1.3 * k); c.stroke();   // the ink round it
  shape(0, 1.1, w(0), w(1.1)); c.fillStyle = '#58a8cf'; c.fill();                      // the chalked tip
  shape(1.1, 3.4, w(1.1), w(3.4)); c.fillStyle = P.paper; c.fill();                    // the ferrule
  shape(3.4, L * 0.6, w(3.4), w(L * 0.6)); c.fillStyle = '#ecd29c'; c.fill();          // the shaft
  shape(L * 0.6, L, w(L * 0.6), w(L)); c.fillStyle = '#4b2b15'; c.fill();              // the butt, with its rings
  for (const d of [L * 0.6, L * 0.63, L * 0.96]) { shape(d, d + 0.9, w(d), w(d + 0.9)); c.fillStyle = P.paper; c.fill(); }
  c.strokeStyle = P.ink; c.lineWidth = Math.max(1, 0.3 * k);
  for (const d of [1.1, 3.4]) { const A = at(d0 + d); c.beginPath(); c.moveTo(A[0] + px * w(d) * k, A[1] + py * w(d) * k); c.lineTo(A[0] - px * w(d) * k, A[1] - py * w(d) * k); c.stroke(); }
  c.restore();
}
// A shot being lined up (this phone's pull, or someone else's in their replay): the cue behind the white, drawn back
// with the power; the sight line from the white to the first thing in its way (rules.js poolSight: exactly where the
// simulation will take it): a ghost of the white where it first touches a ball or a rail, and nothing after it (December
// 2026: the struck ball's way, the white's way on and its way off a rail are not shown); a pocket: the white is going down. A shot too soft to get there
// (poolReach) stops short, with no ghost. The power is the meter at the side.
export function drawPoolAim(g, mini, pos, shot, p) {
  const c = g.c, P = runColours(), S = sizes(), k = g.k, R = S.ballR, from = pos.cue;
  if (!from) return;
  const sight = poolSight(pos, shot.aim, S), reach = poolReach(shot.power, tune(mini).vMax), short = reach < sight.t, t = short ? reach : sight.t;
  const [ux, uy] = sight.dir, X = g.X, Y = g.Y, end = [from[0] + ux * t, from[1] + uy * t];
  const line = (a, b, dash, w, alpha) => {                         // a guide line: white over a dark edge, so it reads on the cloth and on a ball
    for (const [col, lw] of [['rgba(0,0,0,.4)', w + 2.2], [`rgba(255,255,255,${alpha})`, w]]) { c.beginPath(); c.setLineDash(dash || []); c.moveTo(X(a[0]), Y(a[1])); c.lineTo(X(b[0]), Y(b[1])); c.strokeStyle = col; c.lineWidth = lw; c.stroke(); }
    c.setLineDash([]);
  };
  const ring = (at, alpha, dash) => { c.beginPath(); c.setLineDash(dash || []); c.arc(X(at[0]), Y(at[1]), R * k, 0, Math.PI * 2); c.fillStyle = `rgba(255,255,255,${(alpha * 0.2).toFixed(2)})`; c.fill(); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 4; c.stroke(); c.strokeStyle = `rgba(255,255,255,${alpha})`; c.lineWidth = 2; c.stroke(); c.setLineDash([]); };
  c.save(); c.lineCap = 'round';
  if (shot.power < 0.02) { drawCue(g, from, shot.aim, 0.9, 1, P); c.restore(); return; }   // (a replayed pull not yet begun, or let go of: the cue at the ball, nothing to sight)
  const lead = Math.min(t, R + 1.2);
  if (t > lead) line([from[0] + ux * lead, from[1] + uy * lead], short ? end : [from[0] + ux * Math.max(lead, t - R), from[1] + uy * Math.max(lead, t - R)], [6, 6], 2.5, 0.95);
  if (short) { const a = [end[0] - uy * 1.6, end[1] + ux * 1.6], b = [end[0] + uy * 1.6, end[1] - ux * 1.6]; line(a, b, null, 2.5, 0.95); }   // as far as it rolls: a bar across the line
  else if (sight.kind === 'ball') ring(end, 0.95);              // only the white's path to its first touch: a ghost of it there (December 2026: no struck ball's way, no white's way on)
  else if (sight.kind === 'rail') ring(end, 0.9);
  else ring(end, 0.9, [4, 4]);                                   // into a pocket: the white goes down
  drawCue(g, from, shot.aim, 0.9 + shot.power * POOLV.pull, 1, P);
  // the power: a meter beside the table where there is room, else lying in the right rail between its top two pockets (never over the cloth)
  const M = g.M || POOL_RAIL, right = X(S.w + M), room = g.W - right, rail = M * k;
  const mw = room >= 26 ? 14 : Math.max(8, Math.min(14, rail - 5)), top = Y(S.pockets[1][2] + 3), bot = Y(S.h / 2 - S.pockets[3][2] - 3);
  const mh = Math.min(bot - top, 190), mx = room >= 26 ? right + (room - mw) / 2 : X(S.w + M / 2) - mw / 2 + 0.6 * k, my = top + (bot - top - mh) / 2;
  rr(c, mx, my, mw, mh, mw / 2); outlined(c, 'rgba(255,248,232,.95)', P.ink, 2.5);
  const fill = (mh - 6) * shot.power;
  if (fill > 2) { rr(c, mx + 3, my + mh - 3 - fill, mw - 6, fill, Math.min(4, (mw - 6) / 2)); c.fillStyle = `hsl(${Math.round(120 - 120 * shot.power)} 78% 46%)`; c.fill(); }
  c.strokeStyle = 'rgba(22,18,16,.55)'; c.lineWidth = 1.5;
  for (const q of [0.25, 0.5, 0.75]) { c.beginPath(); c.moveTo(mx + 2, my + mh - 3 - (mh - 6) * q); c.lineTo(mx + mw * 0.45, my + mh - 3 - (mh - 6) * q); c.stroke(); }
  c.restore();
}
// The miniature: the table as it stands (the pockets and the balls left, each in its side's colour, no numbers on them)
// and beside it each side's balls still to sink, its mark and the count. Drawn from this file's own copy of the table's
// sizes before the physics library has loaded (the board shows Pool at once, its felt, rails, pockets and balls).
export function miniature(mini, final) {
  const S = sizes(), cls = id => (id === 'cue' ? 'cue' : id === 'black' ? 'black' : id[0].toUpperCase());
  const balls = poolIds(mini).map(id => (mini.down[id] ? '' : `<circle cx="${mini.balls[id][0]}" cy="${mini.balls[id][1]}" r="${S.ballR * 1.6}" class="${cls(id)}"/>`)).join('');
  return `<div class="tpool" aria-label="Pool: X has ${poolLeft('X', mini)} balls left, O has ${poolLeft('O', mini)}"><svg class="tphys" viewBox="-4 -4 ${S.w + 8} ${S.h + 8}" aria-hidden="true">
      <rect x="-4" y="-4" width="${S.w + 8}" height="${S.h + 8}" rx="4" class="rail"/><rect x="0" y="0" width="${S.w}" height="${S.h}" class="cloth"/>
      ${S.pockets.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" class="pocket"/>`).join('')}${balls}</svg>`
    + `<div class="tpcnt">${['X', 'O'].map(p => `<div class="${p}"><b class="${p}">${p}</b><span>${poolLeft(p, mini)}</span></div>`).join('')}</div></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = physTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return physResult(f, true).text;
}
