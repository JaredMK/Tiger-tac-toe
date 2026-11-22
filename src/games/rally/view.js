// Road Race: the screen, the miniature, the move's words and sounds, and this phone's attempt.
// The circuit is one canvas seen from straight above, the whole lap on it at once, never scrolling or zooming: the
// still parts painted once into a kept layer (`circuitLayer`: mown grass, the road with its striped kerbs, the
// chequered line, a pond, trees, a stand and tyre stacks, all placed from the circuit itself), and over it each
// frame the way driven so far as a faint line, the car's short streak and the car in the mover's colour. Under it
// the steering wheel (`.rrwheel`, an SVG turned by the frame loop; a mark at its top, a pointer over it). This phone's
// attempt is live from GO, the wheel's hub (ui/round.js): after a moment's READY the car sets off by itself, and a
// finger dragged left and right anywhere on the game turns the wheel (`travel` % of the game's width to full lock,
// from wherever the wheel stood when it was taken); let go, it springs back to straight; the arrow keys turn it too.
// The attempt is worked out in the rules' own steps from the wheel as it stood at each (rules.js rallyStep), noted
// whenever it changes, and that steering is what is sent (the server drives it again). Off the road: CRASH! Round to
// the line: LAP! Anyone else's attempt is driven again here from the steering on its flash, at the replay's speed:
// their car round the circuit, the wheel turning as they turned it, to the place it left the road or to the line.
// An attempt driven here was watched live: its own flash goes straight to its result.
import { RALLY, rallyCfg, rallyLogOk, rallyShowMs, rallyStart, rallyStep, rallySteps, rallyTrack } from './rules.js';
import { makeRng } from '../../core/random.js';
import { SND, ownPress } from '../../audio/sound.js';
import { haptic } from '../../net/platform.js';
import { app, state } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { makeRound } from '../../ui/round.js';
import { runColours, runInputAt } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';
import { flashAnimating, skipFlash } from '../../ui/turns.js';

// (lockDeg: the wheel's drawing at full lock; spring: what is left of the wheel's angle one step after it is let
// go; key: an arrow key's share of the lock a step; hard: the share of the lock at which the tyres squeal, no more
// often than every `squeal` ms; trail: the car's streak, steps; purr: the engine's beat, ms; back: the wheel
// straightening once a replayed attempt is over, ms)
export const RRV = { lockDeg: 100, spring: 0.8, key: 0.1, hard: 0.75, squeal: 500, trail: 18, purr: 240, back: 220 };
export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is an attempt's steering: it is driven again from the flash
let src = null, hooked = false, skipped = null, wheelAt = 0, rep = null, layer = null, sent = null;   // (sent: the attempt just driven here, kept on show until the square has taken it: online, the server's answer)
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const round = makeRound('rally', {
  mine: () => !!src && src.mine,
  begin: mini => { const tr = rallyTrack(mini), S = rallyStart(tr); return { c: rallyCfg(mini), tr, S, log: [], w: 0, a: 0, aim: 0, held: false, key: 0, over: null, res: null, path: [S.x, S.y], purr: -1, sqAt: -1e9 }; },
  step(L, ms) {
    if (L.over != null) return ms < L.over + RALLY.end;
    const due = Math.floor((ms - RALLY.wait) * RALLY.hz / 1000), max = rallySteps(L.c, L.tr);
    if (due <= 0) turnWheel(L);                                    // (not off yet: the wheel still answers the hand)
    while (L.S.k < due && L.over == null) {                        // the rules' own steps (rallyRun), driven by this phone's wheel
      turnWheel(L);
      const w = Math.round(L.a * RALLY.lock);
      if (w !== L.w && L.log.length < RALLY.maxLog) { L.w = w; L.log.push([L.S.k, w]); }
      const end = rallyStep(L.c, L.tr, L.S, L.w);
      if (L.S.k % 2 === 0 || end) L.path.push(L.S.x, L.S.y);
      if (end === 'lap') { L.res = 'lap'; L.over = ms; SND.play('rrLap'); haptic('success'); }
      else if (end === 'crash') { L.res = 'crash'; L.over = ms; SND.play('crash'); haptic('error'); }
      else if (L.S.k >= max) { L.res = 'time'; L.over = ms; }
      else if (Math.abs(L.w) >= RRV.hard * RALLY.lock && ms - L.sqAt > RRV.squeal) { L.sqAt = ms; SND.play('rrSqueal', { rate: 0.94 + (L.S.k % 3) * 0.06 }); }
    }
    const beat = Math.floor(ms / RRV.purr); if (beat !== L.purr && L.over == null && ms > RALLY.wait) { L.purr = beat; SND.play('rrPurr', { rate: 0.94 + (beat % 3) * 0.05 }); }
    return true;
  },
  move: L => { sent = { zoom: L.sq, p: L.p, n: L.mini.n[L.p], at: [L.S.x, L.S.y, L.S.hx, L.S.hy], crash: L.res === 'crash', path: L.path }; return { log: L.log, steps: L.S.k }; },
  go: () => go(),
});
// The wheel for the step to come: where the hand has it, an arrow key turning it on, or springing back to straight.
function turnWheel(L) {
  if (L.held) L.a = L.aim;
  else if (L.key) L.a = clamp(L.a + L.key * RRV.key, -1, 1);
  else { L.a *= RRV.spring; if (Math.abs(L.a) < 0.03) L.a = 0; }
}
function start() { if (round.live) return false; SND.play('fsGo'); haptic('tap'); return round.start(); }
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  let id = null, x0 = 0, a0 = 0, span = 60;
  const grab = e => {                                              // the wheel is taken where it stands: the drag turns it on from there
    const L = round.live, g = app.querySelector('.g-rr'), w = g ? g.getBoundingClientRect().width : 0;
    id = e.pointerId; x0 = e.clientX; a0 = L.a; span = Math.max(24, (w || 340) * L.c.travel / 100); L.held = true; L.aim = L.a;
    try { app.setPointerCapture(e.pointerId); } catch (err) { /* (no capture: the window's listeners still follow it) */ }   // (GO, pressed, is redrawn away under the finger: the drag is held by the page itself)
  };
  app.addEventListener('pointerdown', e => {
    if (state.screen !== 'mini' || !runInputAt(e.target) || !e.target.closest) return;
    if (!round.live) { if (!e.target.closest('.rrgo:not(:disabled)')) return; ownPress(); if (!start()) return; }   // GO: the same press holds the wheel
    else if (!e.target.closest('.g-rr')) return;
    grab(e); e.preventDefault(); ownPress();
  }, { passive: false });
  const win = typeof window !== 'undefined' && window.addEventListener ? window : app;
  win.addEventListener('pointermove', e => { const L = round.live; if (L && L.held && e.pointerId === id) L.aim = clamp(a0 + (e.clientX - x0) / span, -1, 1); });
  const up = e => { if (e.pointerId !== id) return; id = null; if (round.live) round.live.held = false; };
  win.addEventListener('pointerup', up); win.addEventListener('pointercancel', up);
  if (typeof document !== 'undefined' && document.addEventListener) {
    const dir = e => (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0);   // a keyboard: the arrows turn the wheel while held
    document.addEventListener('keydown', e => { const L = round.live, d = dir(e); if (!L || !d || state.screen !== 'mini') return; e.preventDefault(); L.key = d; });
    document.addEventListener('keyup', e => { const L = round.live, d = dir(e); if (L && d && L.key === d) L.key = 0; });
  }
}
export const actions = { 'rr-go': () => { ownPress(); start(); } };   // (a press on GO has begun already, above: this is the keyboard's)

// ---- the drawing (in the circuit's own units: the frame RALLY.W by RALLY.H) ----
const box = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const disc = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, 6.2832); };
function loop(c, tr) { c.beginPath(); for (let i = 0; i < tr.n; i += 2) (i ? c.lineTo(tr.x[i], tr.y[i]) : c.moveTo(tr.x[i], tr.y[i])); c.closePath(); }
// How far a place is from the middle of the road, and whether it lies inside the loop.
function away(tr, x, y) { let m = Infinity; for (let i = 0; i < tr.n; i += 2) { const dx = tr.x[i] - x, dy = tr.y[i] - y, d = dx * dx + dy * dy; if (d < m) m = d; } return Math.sqrt(m); }
function inside(tr, x, y) { let inn = false; for (let i = 0, j = tr.n - 3; i < tr.n; j = i, i += 3) if ((tr.y[i] > y) !== (tr.y[j] > y) && x < (tr.x[j] - tr.x[i]) * (y - tr.y[i]) / (tr.y[j] - tr.y[i]) + tr.x[i]) inn = !inn; return inn; }
// What stands beside the road (the picture's alone: nothing here is ever read by the rules): a pond where the
// infield is widest, a stand by the line, tyres outside the tightest bends, trees wherever there is grass enough.
function scenery(tr) {
  if (tr.scn) return tr.scn;
  const r = makeRng('rally-scene:' + tr.key), h = tr.half, s = { pond: null, stand: null, tyres: [], trees: [] }, taken = [];
  const free = (x, y, rad) => x > rad + 1 && y > rad + 3 && x < RALLY.W - rad - 1 && y < RALLY.H - rad - 1 && away(tr, x, y) > h + rad + 1.6 && taken.every(t => (t[0] - x) * (t[0] - x) + (t[1] - y) * (t[1] - y) > (t[2] + rad + 1) * (t[2] + rad + 1));
  let best = null;
  for (let k = 0; k < 70; k++) { const x = 12 + r() * (RALLY.W - 24), y = 14 + r() * (RALLY.H - 28); if (!inside(tr, x, y)) continue; const d = away(tr, x, y); if (!best || d > best[2]) best = [x, y, d]; }
  if (best && best[2] > h + 9) { const rad = Math.min(9, best[2] - h - 4); s.pond = [best[0], best[1], rad, 0.72 + r() * 0.2, r() * 3]; taken.push([best[0], best[1], rad]); }
  const n = tr.n, tan = i => { const a = (i + 2) % n, b = (i - 2 + n) % n, dx = tr.x[a] - tr.x[b], dy = tr.y[a] - tr.y[b], d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
  for (const side of [1, -1]) {                                   // the stand: beside the line, on whichever side has the room
    const [tx, ty] = tan(0), x = tr.x[0] - ty * side * (h + 5.2), y = tr.y[0] + tx * side * (h + 5.2);
    if (!s.stand && free(x, y, 3.2) && free(x + tx * 5, y + ty * 5, 2.4) && free(x - tx * 5, y - ty * 5, 2.4)) { s.stand = [x, y, Math.atan2(ty, tx)]; taken.push([x, y, 6.5]); }
  }
  const bends = []; for (let i = 0; i < n; i += 4) { const a = (i + 4) % n, b = (i - 4 + n) % n, cr = (tr.x[i] - tr.x[b]) * (tr.y[a] - tr.y[i]) - (tr.y[i] - tr.y[b]) * (tr.x[a] - tr.x[i]); bends.push([Math.abs(cr), i, cr > 0 ? -1 : 1]); }
  bends.sort((p, q) => q[0] - p[0]);
  for (const [, i, side] of bends) {                               // tyre stacks on the outside of the sharpest bends
    if (s.tyres.length >= 3) break;
    const [tx, ty] = tan(i), x = tr.x[i] - ty * side * (h + 2.9), y = tr.y[i] + tx * side * (h + 2.9);
    if (free(x, y, 1.4) && s.tyres.every(t => Math.hypot(t[0] - x, t[1] - y) > 22)) { s.tyres.push([x, y, Math.atan2(ty, tx)]); taken.push([x, y, 2.6]); }
  }
  for (let k = 0; k < 160 && s.trees.length < 11; k++) { const rad = 2 + r() * 1.5, x = r() * RALLY.W, y = r() * RALLY.H; if (free(x, y, rad)) { s.trees.push([x, y, rad]); taken.push([x, y, rad + 1.5]); } }
  return tr.scn = s;
}
function paintCircuit(c, tr, P) {
  const W = RALLY.W, H = RALLY.H, h = tr.half, s = scenery(tr), n = tr.n;
  c.fillStyle = '#6cbf62'; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,.08)'; for (let k = -8; k < 14; k += 2) { c.beginPath(); c.moveTo(k * 11, 0); c.lineTo(k * 11 + 11, 0); c.lineTo(k * 11 + 11 - 56, H); c.lineTo(k * 11 - 56, H); c.fill(); }   // the mower's stripes
  if (s.pond) { const [x, y, r, sq, rot] = s.pond; c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, sq); c.fillStyle = '#e8d9a8'; disc(c, 0, 0, r + 1.1); c.fill(); c.fillStyle = P.sky; c.strokeStyle = P.ink; c.lineWidth = 0.45; disc(c, 0, 0, r); c.fill(); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 0.5; c.beginPath(); c.arc(0, 0, r * 0.62, 3.5, 4.6); c.stroke(); c.beginPath(); c.arc(0, 0, r * 0.35, 0.4, 1.3); c.stroke(); c.restore(); }
  c.lineJoin = 'round'; c.lineCap = 'butt'; loop(c, tr);
  c.strokeStyle = P.ink; c.lineWidth = 2 * h + 3; c.stroke();
  c.strokeStyle = '#fff'; c.lineWidth = 2 * h + 2; c.stroke();
  c.strokeStyle = '#3f8fbf'; c.setLineDash([2.4, 2.4]); c.stroke(); c.setLineDash([]);   // the kerbs: blue and white (red and yellow are the players')
  c.strokeStyle = '#5c616e'; c.lineWidth = 2 * h; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.42)'; c.lineWidth = 0.4; c.setLineDash([2, 3.2]); c.stroke(); c.setLineDash([]);
  const at = (i, f) => { const a = (i + 2) % n, b = (i - 2 + n) % n; c.save(); c.translate(tr.x[i], tr.y[i]); c.rotate(Math.atan2(tr.y[a] - tr.y[b], tr.x[a] - tr.x[b])); f(); c.restore(); };
  for (const q of [0.14, 0.38, 0.62, 0.86]) at(Math.round(n * q), () => { c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 0.7; c.lineCap = 'round'; c.beginPath(); c.moveTo(-1.6, -2.2); c.lineTo(0.6, 0); c.lineTo(-1.6, 2.2); c.stroke(); });   // which way round
  at(0, () => { const m = 8, cw = 2 * h / m; for (let a = 0; a < m; a++) for (let b = 0; b < 2; b++) { c.fillStyle = (a + b) % 2 ? '#fff' : P.ink; c.fillRect(-1.3 + b * 1.3, -h + a * cw, 1.32, cw + 0.02); } });
  if (s.stand) { const [x, y, a] = s.stand; c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = 'rgba(22,18,16,.22)'; box(c, -6.1, -1.9, 13, 4.6, 0.8); c.fill(); c.fillStyle = '#f4e6c8'; c.strokeStyle = P.ink; c.lineWidth = 0.45; box(c, -6.5, -2.3, 13, 4.6, 0.8); c.fill(); c.stroke(); c.fillStyle = '#3f8fbf'; for (let k = 0; k < 5; k++) c.fillRect(-5.6 + k * 2.4, -1.6, 1.2, 3.2); c.restore(); }
  for (const [x, y, a] of s.tyres) { c.save(); c.translate(x, y); c.rotate(a); for (const k of [-1.9, 0, 1.9]) { c.fillStyle = '#2b2b33'; c.strokeStyle = P.ink; c.lineWidth = 0.35; disc(c, k, 0, 0.95); c.fill(); c.stroke(); c.fillStyle = '#8a8d98'; disc(c, k, 0, 0.3); c.fill(); } c.restore(); }
  for (const [x, y, r] of s.trees) { c.fillStyle = 'rgba(22,18,16,.2)'; disc(c, x + 0.7, y + 0.9, r); c.fill(); c.fillStyle = '#2f8f46'; c.strokeStyle = P.ink; c.lineWidth = 0.45; disc(c, x, y, r); c.fill(); c.stroke(); c.fillStyle = '#58b86a'; disc(c, x - r * 0.28, y - r * 0.3, r * 0.42); c.fill(); }
}
// The still parts, painted once for a circuit at a size (the canvas's own pixels).
function circuitLayer(tr, cw, ch, P) {
  if (layer && layer.key === tr.key && layer.w === cw && layer.h === ch) return layer.cv;
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const c = cv.getContext('2d'); c.scale(cw / RALLY.W, ch / RALLY.H); paintCircuit(c, tr, P);
  layer = { key: tr.key, w: cw, h: ch, cv };
  return cv;
}
function car(c, x, y, ang, col, P) {                                // (drawn pointing along +x, then turned to its heading)
  c.save(); c.translate(x, y); c.rotate(ang);
  c.fillStyle = 'rgba(22,18,16,.3)'; box(c, -2.6, -1.25, 6, 3.3, 1.1); c.fill();
  c.fillStyle = '#23232b'; for (const [a, b] of [[-2.3, -2.1], [0.9, -2.1], [-2.3, 1.35], [0.9, 1.35]]) c.fillRect(a, b, 1.45, 0.75);
  c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = 0.45; box(c, -3, -1.65, 6, 3.3, 1.15); c.fill(); c.stroke();
  c.fillStyle = '#cfeaff'; c.lineWidth = 0.32; box(c, 0, -1.15, 1.45, 2.3, 0.45); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(-2.6, -0.3, 2.3, 0.6); c.fillRect(1.75, -0.3, 0.95, 0.6);
  c.restore();
}
function burst(c, x, y, k, size, col, P, word) {
  const g = 0.4 + 0.6 * Math.min(1, Math.max(0, k) * 3);
  c.save(); c.translate(clamp(x, size + 1, RALLY.W - size - 1), clamp(y, size + 3, RALLY.H - size - 1)); c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = 0.7; c.lineJoin = 'round';
  c.beginPath(); for (let a = 0; a < 20; a++) { const rr = (a % 2 ? size * 0.58 : size) * g, an = a * Math.PI / 10; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.stroke();
  c.font = `400 ${size * 0.5}px Bangers, "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = P.ink; c.fillText(word, 0, size * 0.03); c.restore();
}
// Where a crash's burst goes: beside the car, towards the middle of the frame, so the car stays on show.
function beside(x, y) { const dx = RALLY.W / 2 - x, dy = RALLY.H / 2 - y, d = Math.hypot(dx, dy) || 1; return [x + dx / d * 17, y + dy / d * 17]; }
// The way driven (a faint line) and the car's streak: `pts` flat [x, y, ...], its last `tail` points the streak.
function trace(c, pts, upto, tail, col) {
  if (upto < 4) return;
  c.lineJoin = c.lineCap = 'round';
  c.strokeStyle = 'rgba(255,255,255,.34)'; c.lineWidth = 0.7; c.beginPath(); for (let i = 0; i < upto; i += 2) (i ? c.lineTo(pts[i], pts[i + 1]) : c.moveTo(pts[i], pts[i + 1])); c.stroke();
  const from = Math.max(0, upto - 2 * tail);
  for (let i = from; i + 3 < upto; i += 2) { c.globalAlpha = 0.55 * (i - from) / (upto - from); c.strokeStyle = col; c.lineWidth = 1.7; c.beginPath(); c.moveTo(pts[i], pts[i + 1]); c.lineTo(pts[i + 2], pts[i + 3]); c.stroke(); }
  c.globalAlpha = 1;
}
// Someone else's attempt, driven again from its steering (once for a flash): the car's place and heading and the
// wheel at every step.
function replayOf(f, mini) {
  if (rep && rep.f === f) return rep;
  const c = rallyCfg(mini), tr = rallyTrack(mini), S = rallyStart(tr), ok = rallyLogOk(f.log, f.steps), log = ok ? f.log : [], n = ok ? Math.min(f.steps, rallySteps(c, tr)) : 0, pts = [S.x, S.y], hd = [S.hx, S.hy], ws = [0];
  let w = 0, li = 0;
  while (S.k < n && !S.end) { while (li < log.length && log[li][0] <= S.k) w = log[li++][1]; rallyStep(c, tr, S, w); pts.push(S.x, S.y); hd.push(S.hx, S.hy); ws.push(w); }
  return rep = { f, tr, n: S.k, pts, hd, ws, end: S.end };
}
function setWheel(fr) {
  wheelAt = fr;
  const el = app && app.querySelector ? app.querySelector('.rrwheel') : null;
  if (el) el.style.transform = `rotate(${(fr * RRV.lockDeg).toFixed(1)}deg)`;
}
const go = stage('canvas.rrcv', (c, W, H, now) => {
  round.tick(now);
  if (!src) return false;
  const P = runColours(), tr = src.tr, L = round.live && round.on(src.zoom) ? round.live : null, col = p => (p === 'O' ? P.O : P.X), cv = c.canvas;
  c.clearRect(0, 0, W, H); c.drawImage(circuitLayer(tr, cv.width, cv.height, P), 0, 0, W, H);
  c.save(); c.scale(W / RALLY.W, H / RALLY.H);
  let more = false, wheel = 0;
  const ang = (hx, hy) => Math.atan2(hy, hx);
  if (L) {
    const ms = now - L.t0, S = L.S, k = L.over != null ? (ms - L.over) / RALLY.end : 0;
    trace(c, L.path, L.path.length, RRV.trail / 2, col(L.p));
    car(c, S.x, S.y, ang(S.hx, S.hy) + (L.res === 'crash' ? k * 5 : 0), col(L.p), P);
    if (ms < RALLY.wait) burst(c, RALLY.W / 2, RALLY.H / 2, 1, 17, '#fff', P, 'READY');
    if (L.res === 'lap') burst(c, RALLY.W / 2, RALLY.H / 2, k, 19, '#ffd23f', P, 'LAP!');
    else if (L.res === 'crash') burst(c, ...beside(S.x, S.y), k, 14, '#ff8a75', P, 'CRASH!');
    wheel = L.a; more = true;
  } else if (src.a) {                                             // someone else's attempt, from its flash
    const f = src.a.rr, at = fxAt('move', src.a), t = at == null ? Infinity : now - at, R = replayOf(f, src.mini), run = R.n * 1000 / RALLY.hz;
    const k = clamp(Math.floor((t - RALLY.pre) * RALLY.hz / 1000), 0, R.n), te = t - RALLY.pre - run, e = clamp(te / RALLY.end, 0, 1);
    trace(c, R.pts, 2 * (k + 1), RRV.trail, col(src.by));
    car(c, R.pts[2 * k], R.pts[2 * k + 1], ang(R.hd[2 * k], R.hd[2 * k + 1]) + (R.end === 'crash' ? e * 5 : 0), col(src.by), P);
    if (te >= 0 && R.end === 'lap') burst(c, RALLY.W / 2, RALLY.H / 2, e, 19, '#ffd23f', P, 'LAP!');
    else if (te >= 0 && R.end === 'crash') burst(c, ...beside(R.pts[2 * k], R.pts[2 * k + 1]), e, 14, '#ff8a75', P, 'CRASH!');
    wheel = R.ws[k] / RALLY.lock * (te > 0 ? Math.max(0, 1 - te / RRV.back) : 1);
    more = t < rallyShowMs(f) + 300;
  } else if (src.rest && src.rest.at) {                           // a result left on show: the car where it ended
    const [x, y, hx, hy] = src.rest.at;
    car(c, x, y, ang(hx, hy) + (src.rest.crash ? 0.9 : 0), col(src.by), P);
  } else if (sent && sent.zoom === src.zoom && sent.p === src.by && src.mini.n[sent.p] === sent.n && src.wait) {   // this phone's attempt, on its way to the server: as it ended
    trace(c, sent.path, sent.path.length, 0, col(sent.p));
    car(c, sent.at[0], sent.at[1], ang(sent.at[2], sent.at[3]) + (sent.crash ? 0.9 : 0), col(sent.p), P);
  } else { const S = rallyStart(tr); car(c, S.x, S.y, ang(S.hx, S.hy), col(src.by), P); }
  c.restore();
  setWheel(wheel);
  return more;
});
const words = l => (l.done ? 'Lap done!' : l.crash ? `Crashed at ${l.pct}%` : `Stopped at ${l.pct}%`);
// The steering wheel: a rim with a mark at its top, three spokes and a hub (GO sits on the hub while an attempt may begin).
const WHEEL = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="rwk" cx="50" cy="50" r="41"/><circle class="rwr" cx="50" cy="50" r="41"/><path class="rwsk" d="M50 50 12 43M50 50 88 43M50 50V90"/><path class="rws" d="M50 50 12 43M50 50 88 43M50 50V90"/><path class="rwm" d="M39.400 10.400A41 41 0 0 1 60.600 10.400"/><path class="rwe" d="M38.100 6.200l2.600 8.400M61.900 6.200l-2.600 8.400"/><circle class="rwh" cx="50" cy="50" r="15"/></svg>';
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = rallyCfg(mini), s = a && a.rr ? a.rr : null, own = !!s && ownMove(a), o = { view, locked, turn }, on = round.on(state.zoom);
  if (s && own && skipped !== a && flashAnimating()) { skipped = a; setTimeout(() => { if (state.flash === a) skipFlash(); }, 0); }   // (an attempt driven here was watched live: straight to its result)
  const rest = !s && (view || d) && mini.last ? mini.last : s && own ? s : null, l = s || rest, by = s ? a.by : rest ? rest.by : turn, mine = !view && !s && !locked && !d, end = s && !own ? rallyShowMs(s) : 0;
  const tal = p => arcTally(p, o, pips(p, mini.laps[p], c.laps, !!(s && !own && s.done && a.by === p), end - RALLY.end));
  const line = s && !own ? `<p ${lateAt('rrline ' + (s.done ? 'ok' : 'no'), end - RALLY.end)} role="status">${words(s)}</p>` : `<p class="rrline${l && !on ? (l.done ? ' ok' : ' no') : ''}">${l && !on ? words(l) : ''}</p>`;
  src = { mini, a: s && !own ? a : null, rest: on ? null : rest, by, mine, wait: !!locked && !view && !s, zoom: state.zoom, tr: rallyTrack(mini) };
  if (!on && !src.a) wheelAt = 0;
  const hub = !view && mine && !on ? `<button class="rrgo ${turn}" data-act="rr-go" aria-label="Go">GO</button>` : '';
  go();
  return `<div class="g-rr pc-${by}"><div class="ctals${c.laps > 5 ? ' two' : ''}">${tal('X')}${tal('O')}</div><div class="rrbox"><div class="rrfield${on ? ' live' : ''}"><canvas class="rrcv" aria-label="The circuit"></canvas></div></div>${line}<div class="rrstrip${on ? ' live' : ''}"><i class="rrptr" aria-hidden="true"></i><div class="rrwh"><div class="rrwheel" style="transform:rotate(${(wheelAt * RRV.lockDeg).toFixed(1)}deg)">${WHEEL}</div>${hub}</div></div></div>`;
}
// The miniature: the square's own circuit from above, tiny, with a car on its line, beside each player's laps as pips.
export function miniature(mini, final) {
  const c = rallyCfg(mini), tr = rallyTrack(mini), q = v => Math.round(v * 10) / 10, S = rallyStart(tr);
  let dp = ''; for (let i = 0; i < tr.n; i += 6) dp += `${i ? 'L' : 'M'}${q(tr.x[i])} ${q(tr.y[i])}`;
  const deg = Math.round(Math.atan2(S.hy, S.hx) * 180 / Math.PI), w = q(2 * tr.half + 1);
  const art = `<svg class="trc" viewBox="0 0 ${RALLY.W} ${RALLY.H}"><rect class="trcg" x="1.500" y="1.500" width="${RALLY.W - 3}" height="${RALLY.H - 3}" rx="12"/><path class="trck" d="${dp}Z" stroke-width="${q(w + 5)}"/><path class="trct" d="${dp}Z" stroke-width="${w}"/><g transform="translate(${q(S.x)} ${q(S.y)}) rotate(${deg})"><path class="trcl" d="M0 ${-q(w / 2)}V${q(w / 2)}"/><rect class="trcc" x="-8" y="-5" width="16" height="10" rx="3.500"/></g></svg>`;
  return thumbArt(art, pipRows(mini.laps, c.laps), 'trcw', `Road Race: X ${mini.laps.X}, O ${mini.laps.O} of ${c.laps} laps`);
}
export function moveText(f, who) { const s = f.rr; return !s ? `${who} drove` : s.done ? `${who} finished a lap` : s.crash ? `${who} crashed at ${s.pct}%` : `${who} stopped at ${s.pct}%`; }
// Someone else's attempt, as it is driven again: the engine all the way, the tyres at each hard lock, then the
// fanfare of a lap done or the crash. An attempt driven here was heard live.
export function sounds(f, add, won, mini, last) {
  const s = f.rr; if (!s || ownMove(f)) return;
  const run = (s.steps || 0) * 1000 / RALLY.hz, at = k => RALLY.pre + k * 1000 / RALLY.hz;
  for (let t = 0, b = 0; t < run; t += RRV.purr, b++) add('rrPurr', RALLY.pre + t, 0.94 + (b % 3) * 0.05);
  let sq = -1e9; for (const e of Array.isArray(s.log) ? s.log : []) if (Math.abs(e[1]) >= RRV.hard * RALLY.lock && at(e[0]) - sq > RRV.squeal && at(e[0]) < RALLY.pre + run) { sq = at(e[0]); add('rrSqueal', sq, 0.94 + (e[0] % 3) * 0.06); }
  if (s.done || s.crash) add(s.done ? 'rrLap' : 'crash', RALLY.pre + run);
}
export const rallyLive = () => round.live;                         // (the attempt under way on this phone: for the browser checks)
