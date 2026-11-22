// Bin Shot: the screen, the miniature, the move's words and sounds, and this phone's flick.
// The room seen from behind the thrower (December 2026): a wooden floor running away to the back wall, the bin across
// the room, a desk fan beside it on the side it blows from, a sign over the bin with an arrow (which way) and a number
// (how many bin-widths it carries a throw), its streaks drifting across. The paper ball waits low in the middle. A swipe
// up throws it (ui/flick.js): it leaves at once and, as the move comes back, arcs up the room in perspective (smaller
// as it goes, its shadow on the floor), bending with the fan (TOSS.fly); then it drops into the bin, hits the rim and
// drops in or bounces out onto the floor, or lands on the floor and rolls (TOSS.drop). Anyone else's throw plays the
// same from the move. The projection: `proj(x, y, z)`, floor units, x across, y up the room, z height.
import { tune } from '../../core/tune.js';
import { TOSS, tossAim, tossCfg } from './rules.js';
import { flickMove } from '../shared/flick.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { state } from '../../ui/app.js';
import { flickPad } from '../../ui/flick.js';
import { fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { runColours } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is the flick: played from the flash
let src = null, pend = null;
const hook = flickPad('.tsfield.live', fl => {
  const sq = state.squares && state.squares[state.zoom], mini = sq && sq.mini;
  if (!mini || mini.type !== 'toss' || !src || !src.mine || state.flash || state.done || blocked()) return;
  const m = flickMove(fl.ang, fl.v, tune(mini));
  pend = { sq: state.zoom, m, t0: performance.now() };
  ownPress(); SND.play('pongThrow', { rate: 0.9 + m.p * 0.25 }); haptic('tap');
  attemptMove(m); go();
});
const clamp = u => (u <= 0 ? 0 : u >= 1 ? 1 : u);
// The camera: behind the thrower (y -CAM.back), CAM.h up, looking up the room; the floor at y 0 fills the canvas's width.
// Chosen so the ball waits near the bottom (y 3, z 9 at 92% down), the bin's base sits at 62% and its rim at 42%, the
// horizon at 30%: the camera 35.7 behind the line and 25.6 up, its focal length 1.446 canvas heights.
const CAM = { back: 35.7, h: 25.6, f: 1.446, hor: 0.3 };
function camera(W, H) {
  const F = H * CAM.f, hy = H * CAM.hor;
  return (x, y, z) => { const d = Math.max(4, y + CAM.back), k = F / d; return [W / 2 + (x - TOSS.w / 2) * k, hy + (CAM.h - z) * k, k]; };
}
function paper(c, P, X, Y, k, rot, alpha) {                        // a crumpled ball at (X, Y), k its scale (px a floor unit)
  const r = TOSS.r * k;
  c.save(); c.globalAlpha = alpha == null ? 1 : alpha; c.translate(X, Y); c.rotate(rot || 0);
  c.fillStyle = '#fbfbf6'; c.strokeStyle = P.ink; c.lineWidth = Math.max(1, 0.55 * k); c.lineJoin = 'round'; c.beginPath();
  [[1, 0.1], [0.62, 0.72], [-0.1, 1], [-0.8, 0.62], [-1, -0.12], [-0.55, -0.82], [0.2, -1], [0.82, -0.6]].forEach(([a, b], i) => (i ? c.lineTo(a * r, b * r) : c.moveTo(a * r, b * r))); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(22,18,16,.3)'; c.lineWidth = Math.max(0.6, 0.35 * k); c.beginPath(); c.moveTo(-r * 0.5, -r * 0.2); c.lineTo(r * 0.1, r * 0.1); c.lineTo(r * 0.5, -r * 0.3); c.moveTo(-r * 0.1, r * 0.6); c.lineTo(r * 0.1, r * 0.1); c.stroke();
  c.restore();
}
// Where the ball is t ms into a throw: { x, y, z, spin } (the flight, then what came of it).
export function tossPath(s, D, t) {
  const x0 = TOSS.w / 2, y0 = 3, z0 = 9, drift = s.x - s.ax, zL = s.kind === 'miss' ? 0 : TOSS.binH, apex = 9 + 9 * (s.p == null ? 0.5 : s.p);
  if (t < TOSS.fly) {
    const e = t / TOSS.fly, lin = x0 + (s.ax - x0) * e;
    return { x: lin + drift * e * e, y: y0 + (s.y - y0) * e, z: z0 + (zL - z0) * e + 4 * apex * e * (1 - e), spin: e * 9 };
  }
  const k = clamp((t - TOSS.fly) / TOSS.drop), bx = TOSS.w / 2;
  if (s.kind === 'in' || (s.in && !s.kind)) return { x: s.x + (bx - s.x) * k * 0.6, y: s.y + (D - s.y) * k * 0.6, z: TOSS.binH * (1 - k * k) + 2 * k, spin: 9 + k, inBin: true };
  if (s.kind === 'rimin') { const h = k < 0.55 ? k / 0.55 : 1, f = k < 0.55 ? 0 : (k - 0.55) / 0.45; return { x: s.x + (bx - s.x) * h * 0.85, y: s.y + (D - s.y) * h * 0.85, z: k < 0.55 ? TOSS.binH + 7 * Math.sin(h * Math.PI) : TOSS.binH * (1 - f * f) + 2 * f, spin: 9 + k * 4, inBin: k >= 0.55, rim: k < 0.2 };
  }
  if (s.kind === 'rimout' || (s.rim && !s.kind)) { const ex = s.bx == null ? s.x + (s.x - bx) * 0.6 : s.bx, ey = s.by2 == null ? s.y + (s.y - D) * 0.6 : s.by2; return { x: s.x + (ex - s.x) * k, y: s.y + (ey - s.y) * k, z: TOSS.binH * (1 - k) + 9 * Math.sin(k * Math.PI) * (1 - k * 0.3), spin: 9 + k * 5, rim: k < 0.2 }; }
  const roll = 4 * (1 - (1 - k) * (1 - k));                           // on the floor: a little bounce and a roll on
  return { x: s.x + (s.x - s.ax) * 0.05 * k, y: s.y + roll, z: 3 * Math.abs(Math.sin(k * Math.PI * 1.5)) * (1 - k), spin: 9 + k * 3 };
}
const go = stage('canvas.tscv', (c, W, H, now) => {
  if (!src) return false;
  const { mini, a, by } = src, P = runColours(), proj = camera(W, H), col = by === 'O' ? P.O : P.X;
  const s = a ? a.ts : null, at = s ? (src.own && pend && pend.sq === src.zoom ? pend.t0 : fxAt('move', a)) : null, t = s ? (at == null ? Infinity : now - at) : 0;
  const wind = s && t < TOSS.fly + TOSS.drop + 200 ? s.wind : mini.wind[by], D = mini.dist, R = mini.bin, bx = TOSS.w / 2, back = D + 34;
  c.clearRect(0, 0, W, H);
  // the back wall and the floor (planks running away), the skirting
  const [, wallY] = proj(0, back, 0), [lx0, by0] = proj(-200, 0, 0), [rx0] = proj(300, 0, 0), [lxB] = proj(-200, back, 0), [rxB] = proj(300, back, 0);
  c.fillStyle = '#f3e6c9'; c.fillRect(0, 0, W, wallY);
  c.fillStyle = 'rgba(214, 120, 140, .12)'; for (let x = 0; x < W; x += 14) c.fillRect(x, 0, 7, wallY);
  c.fillStyle = '#d6a96a'; c.beginPath(); c.moveTo(lxB, wallY); c.lineTo(rxB, wallY); c.lineTo(rx0, by0); c.lineTo(lx0, by0); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(120, 72, 30, .45)'; c.lineWidth = 1;
  for (let x = -160; x <= 260; x += 12) { const [a1, b1] = proj(x, 0, 0), [a2, b2] = proj(x, back, 0); c.beginPath(); c.moveTo(a1, Math.min(H, b1)); c.lineTo(a2, b2); c.stroke(); }
  for (const y of [8, 20, 36, 52, 70, 92]) { if (y >= back) continue; const [, yy] = proj(0, y, 0); c.globalAlpha = 0.5; c.beginPath(); c.moveTo(0, yy); c.lineTo(W, yy); c.stroke(); c.globalAlpha = 1; }
  c.fillStyle = '#8d5a33'; c.fillRect(0, wallY - 3, W, 4); c.fillStyle = P.ink; c.fillRect(0, wallY + 1, W, 1.5);
  // the fan's streaks across the room near the bin: drifting the way it blows (faster for a stronger fan)
  const dir = Math.sign(wind) || 1, str = Math.abs(wind), n = Math.round(4 + str / 3), [, kB] = [0, proj(bx, D, 0)[2]];
  c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineCap = 'round';
  for (let k = 0; k < n; k++) { const ph = ((now / 1000) * (0.3 + str / 40) + k * 0.37) % 1, wx = dir > 0 ? -20 + ph * 140 : 120 - ph * 140, wy = D - 18 + ((k * 23) % 30), wz = 6 + ((k * 13) % 26), [sx, sy, sk] = proj(wx, wy, wz), len = (4 + str * 0.3) * sk; c.globalAlpha = Math.sin(ph * Math.PI) * 0.85; c.lineWidth = Math.max(1, 0.5 * sk); c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - dir * len, sy); c.stroke(); }
  c.globalAlpha = 1;
  // the ball and its place in the drawing order: behind the bin (further up the room, or inside it) or in front
  let ball = null;
  if (s) { const q = tossPath(s, D, t); ball = q; }
  else if (pend && pend.sq === src.zoom) { const [ax, ay] = tossAim(pend.m), e = Math.min(0.85, (now - pend.t0) / TOSS.fly), lin = bx + (ax - bx) * e; ball = { x: lin + wind * ay / D * e * e, y: 3 + (ay - 3) * e, z: 9 + 4 * 13 * e * (1 - e), spin: e * 9 }; }
  else if (src.rest && !src.rest.in) ball = { x: src.rest.kind === 'rimout' && src.rest.bx != null ? src.rest.bx : src.rest.x, y: src.rest.kind === 'rimout' && src.rest.by2 != null ? src.rest.by2 : src.rest.y + (src.rest.kind === 'miss' ? 4 : 0), z: 0, spin: 10, rest: true };
  const drawBall = q => {
    const [gx, gy, gk] = proj(q.x, q.y, 0), [px, py, pk] = proj(q.x, q.y, q.z + TOSS.r);
    if (!q.inBin) { c.fillStyle = 'rgba(22,18,16,.22)'; c.beginPath(); c.ellipse(gx, gy, TOSS.r * gk * Math.max(0.4, 1 - q.z / 60), TOSS.r * gk * 0.35, 0, 0, 7); c.fill(); }
    paper(c, P, px, py, pk, q.spin || 0, q.rest ? 0.85 : 1);
  };
  if (ball && (ball.y > D + R + 1 || ball.inBin)) { if (!ball.inBin) drawBall(ball); }
  // the fan: on its stand beside the bin, on the side it blows from, its blades turning
  const fx = bx - dir * (R + 13), [fbx, fby, fk] = proj(fx, D, 0), [fhx, fhy] = proj(fx, D, 20), fr = 8 * fk;
  c.fillStyle = 'rgba(22,18,16,.2)'; c.beginPath(); c.ellipse(fbx, fby, 7 * fk, 2.2 * fk, 0, 0, 7); c.fill();
  c.fillStyle = '#5c6b7a'; c.strokeStyle = P.ink; c.lineWidth = Math.max(1.2, 0.7 * fk); c.beginPath(); c.ellipse(fbx, fby - fk, 6 * fk, 2 * fk, 0, 0, 7); c.fill(); c.stroke();
  c.fillRect(fbx - 0.9 * fk, fhy, 1.8 * fk, fby - fhy - fk); c.strokeRect(fbx - 0.9 * fk, fhy, 1.8 * fk, fby - fhy - fk);
  c.save(); c.translate(fhx, fhy); c.scale(0.55, 1); c.fillStyle = '#dfe7ee'; c.beginPath(); c.arc(0, 0, fr, 0, 7); c.fill(); c.stroke();
  c.rotate(now / 1000 * (4 + str / 3) * dir); c.fillStyle = '#7fa6c9'; for (let k = 0; k < 3; k++) { c.rotate(Math.PI * 2 / 3); c.beginPath(); c.ellipse(fr * 0.45, 0, fr * 0.42, fr * 0.2, 0.4, 0, 7); c.fill(); c.stroke(); }
  c.rotate(0); c.fillStyle = P.ink; c.beginPath(); c.arc(0, 0, fr * 0.14, 0, 7); c.fill(); c.restore();
  c.strokeStyle = 'rgba(22,18,16,.45)'; c.lineWidth = 1; c.save(); c.translate(fhx, fhy); c.scale(0.55, 1); for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(k * fr / 3.5, -Math.sqrt(Math.max(0, fr * fr - (k * fr / 3.5) ** 2))); c.lineTo(k * fr / 3.5, Math.sqrt(Math.max(0, fr * fr - (k * fr / 3.5) ** 2))); c.stroke(); } c.restore();
  // the bin: a slightly tapered cylinder, its back rim, dark inside, the paper already in it, the ball going in, then its front
  const ring = z => { const [ex, ey] = proj(bx, D, z), [lx] = proj(bx - R, D, z), [, ty] = proj(bx, D + R, z), [, ny] = proj(bx, D - R, z); return { x: ex, y: (ty + ny) / 2, rx: ex - lx, ry: Math.max(1.5, (ny - ty) / 2) }; };
  const top = ring(TOSS.binH), base = ring(0), bottom = { x: base.x, y: base.y, rx: base.rx * 0.8, ry: base.ry * 0.8 };
  c.fillStyle = 'rgba(22,18,16,.22)'; c.beginPath(); c.ellipse(base.x + 2, base.y + 1, base.rx * 0.95, base.ry * 1.1, 0, 0, 7); c.fill();
  c.fillStyle = '#2a323a'; c.beginPath(); c.ellipse(top.x, top.y, top.rx, top.ry, 0, 0, 7); c.fill();
  const got = s ? (t >= TOSS.fly + TOSS.drop ? s.to : s.from) : mini.in[by];
  for (let k = 0; k < Math.min(got, 4); k++) { const [px, py, pk] = proj(bx + [-2.4, 2.6, 0.4, -0.6][k], D + [1.2, -0.4, 2, -1.6][k], TOSS.binH - 3); paper(c, P, px, py, pk * 0.85, k * 1.3, 0.95); }
  if (ball && ball.inBin) { c.save(); c.beginPath(); c.ellipse(top.x, top.y, top.rx, top.ry, 0, 0, 7); c.rect(0, 0, W, top.y); c.clip(); drawBall(ball); c.restore(); }
  c.fillStyle = '#7d8a96'; c.strokeStyle = P.ink; c.lineWidth = 2;
  c.beginPath(); c.ellipse(top.x, top.y, top.rx, top.ry, 0, 0, Math.PI); c.lineTo(bottom.x - bottom.rx, bottom.y); c.ellipse(bottom.x, bottom.y, bottom.rx, bottom.ry, 0, Math.PI, 0, true); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 3; c.beginPath(); c.moveTo(top.x - top.rx * 0.55, top.y + top.ry); c.lineTo(bottom.x - bottom.rx * 0.5, bottom.y + bottom.ry * 0.6); c.stroke();
  const hit = ball && ball.rim;   // the rim: knocked as a ball hits it
  c.strokeStyle = hit ? col : P.ink; c.lineWidth = hit ? 3.4 : 2.4; c.fillStyle = 'transparent'; c.beginPath(); c.ellipse(top.x, top.y, top.rx, top.ry, 0, 0, 7); c.stroke();
  // the fan's sign over the bin: an arrow which way, the number how many bin-widths
  const num = (str / (2 * R)).toFixed(1), [sx, sy, sk] = proj(bx, D, TOSS.binH + 22), aw = Math.max(26, Math.min(70, 16 + str * 1.6)) * Math.min(1.4, sk / 2.2);
  c.font = `400 ${Math.round(Math.max(16, 7 * sk))}px Bangers, "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  const tw = c.measureText(num).width, boxW = tw + aw + 22, bh = Math.max(26, 10 * sk);
  c.fillStyle = '#fff8dc'; c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); c.roundRect(sx - boxW / 2, sy - bh / 2, boxW, bh, 6); c.fill(); c.stroke();
  const ax0 = dir > 0 ? sx - boxW / 2 + 8 : sx + boxW / 2 - 8 - aw, ay0 = sy;
  c.strokeStyle = '#2f6fb3'; c.fillStyle = '#2f6fb3'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax0, ay0); c.lineTo(ax0 + aw, ay0); c.stroke();
  const tip = dir > 0 ? ax0 + aw + 3 : ax0 - 3; c.beginPath(); c.moveTo(tip, ay0); c.lineTo(tip - dir * 9, ay0 - 7); c.lineTo(tip - dir * 9, ay0 + 7); c.closePath(); c.fill();
  c.fillStyle = P.ink; c.fillText(num, dir > 0 ? sx + boxW / 2 - 8 - tw / 2 : sx - boxW / 2 + 8 + tw / 2, sy + 1);
  if (ball && !ball.inBin && ball.y <= D + R + 1) drawBall(ball);   // (over the sign: it is nearer)
  // the ball waiting to be thrown: low in the middle, ringed in the thrower's colour
  if (!s && !(pend && pend.sq === src.zoom) && src.mine) { const [px, py, pk] = proj(bx, 3, 9); c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.arc(px, py, TOSS.r * pk * 1.8, 0, 7); c.stroke(); paper(c, P, px, py, pk, 0.3); }
  return true;                                                     // (the fan never stops)
});
const words = l => (l.kind === 'rimin' ? 'Off the rim… and in!' : l.in ? 'In the bin!' : l.kind === 'rimout' || l.rim ? 'Rimmed out' : 'Missed');
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = tossCfg(mini), s = a && a.ts ? a.ts : null, own = !!s && ownMove(a), o = { view, locked, turn }, rest = !s && (view || d) && mini.last ? mini.last : null, l = s || rest;
  const by = s ? a.by : rest ? rest.by : turn, mine = !view && !locked && !s && !d, land = TOSS.fly + (s && (s.in || s.kind === 'rimout') ? TOSS.drop : 0);
  if (pend && (s || pend.sq !== state.zoom) && !(s && own)) pend = null;
  const tal = p => arcTally(p, o, pips(p, mini.in[p], c.goal, !!(s && s.in && a.by === p), land));
  const line = s ? `<p ${lateAt('tsline ' + (s.in ? 'ok' : 'no'), land)} role="status">${words(s)}</p>` : `<p class="tsline${l ? (l.in ? ' ok' : ' no') : ''}">${l ? words(l) : ''}</p>`;
  src = { mini, a: s ? a : null, by, own, mine, zoom: state.zoom, rest };
  if (s && own) setTimeout(() => { if (pend && state.flash !== a) pend = null; }, 0);
  go();
  const w = mini.wind[by];
  return `<div class="g-ts pc-${by}"><div class="ctals${c.goal > 5 ? ' two' : ''}">${tal('X')}${tal('O')}</div><div class="tsbox"><div class="tsfield${mine ? ' live' : ''}"><canvas class="tscv" aria-label="The bin, and a fan blowing ${w > 0 ? 'right' : 'left'}: ${(Math.abs(w) / (2 * mini.bin)).toFixed(1)} bin widths"></canvas></div></div>${line}</div>`;
}
// The miniature: the bin from above with a paper ball going in and the fan's streaks, beside each player's baskets as pips.
export function miniature(mini, final) {
  const c = tossCfg(mini);
  const art = '<svg class="tts" viewBox="0 0 60 60"><path class="ttsw" d="M4 14h13M8 26h9M4 38h12"/><circle class="ttsr" cx="36" cy="30" r="20"/><circle class="ttsb" cx="36" cy="30" r="15"/><path class="ttsp" d="M41 22l5 2 1 6-4 5-6-1-3-5 2-5z"/></svg>';
  return thumbArt(art, pipRows(mini.in, c.goal), 'ttsw2', `Bin Shot: X ${mini.in.X}, O ${mini.in.O} of ${c.goal} baskets`);
}
export function moveText(f, who) { const s = f.ts; return !s ? `${who} threw` : s.kind === 'rimin' ? `${who} got it in off the rim` : s.in ? `${who} got it in the bin` : s.kind === 'rimout' ? `${who} rimmed out` : `${who} missed the bin`; }
// The throw's whoosh (someone else's: a throw made here was heard as it was made), then its landing: a rustle and a
// thump with a chime in the bin, a knock on the rim, a soft tap on the floor.
export function sounds(f, add, won, mini, last) {
  const s = f.ts; if (!s) return;
  if (!ownMove(f)) add('pongThrow', 0, 0.9 + s.p * 0.25);
  if (s.rim || s.kind === 'rimin' || s.kind === 'rimout') add('tsRim', TOSS.fly);
  if (s.in) { add('tsIn', TOSS.fly + TOSS.drop * (s.kind === 'rimin' ? 0.75 : 0.5)); add('ding', TOSS.fly + TOSS.drop); } else if (!s.rim && s.kind !== 'rimout') add('mbStop', TOSS.fly); else add('mbStop', TOSS.fly + TOSS.drop * 0.9, 0.8);
}
