// Road Race: the screen, the miniature, the move's words and sounds, and this phone's attempt.
// The road is a canvas seen from above: grass, the tarmac winding up the screen between striped kerbs, the car in the
// mover's colour near the foot. This phone's attempt is live from Go (ui/round.js): after a moment's READY the car
// sets off and the road comes down the screen; a finger held or dragged anywhere on it is where the car makes for (a
// ring under it shows the spot), and the attempt is worked out in the rules' own steps from that steering, which is what is sent
// (rules.js rallyRun: the server drives it again). Off the road: CRASH! Over the chequered line: LAP! Anyone else's
// attempt is never streamed: its result is shown on a straight strip of road, their car driving up it as far as they
// got, to a crash or the flag.
import { RALLY, rallyCentre, rallyCfg, rallyShowMs, rallyTrack } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { haptic } from '../../net/platform.js';
import { app, state } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { makeRound } from '../../ui/round.js';
import { drawTimeBar, runColours, runInputAt } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';
import { flashAnimating, skipFlash } from '../../ui/turns.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is an attempt's steering: its result is shown from the flash
let src = null, hooked = false, skipped = null;
const CAR_Y = 92, H_ = 120;
const round = makeRound('rally', {
  mine: () => !!src && src.mine,
  begin: (mini, p) => ({ c: rallyCfg(mini), tr: rallyTrack(mini, p), log: [], to: 50, want: 50, k: 0, x: 50, s: 0, over: null, res: null, lean: 0, purr: -1 }),
  step(L, ms) {
    if (L.over != null) return ms < L.over + RALLY.end;
    const due = Math.floor((ms - RALLY.wait) * RALLY.hz / 1000);
    while (L.k <= due && L.over == null) {                         // the rules' own steps (rallyRun), driven by this phone's steering
      L.s = L.k * L.c.speed / RALLY.hz;
      if (L.s >= RALLY.len) { L.res = 'lap'; L.over = ms; SND.play('rrLap'); haptic('success'); break; }
      if (Math.abs(L.x - rallyCentre(L.tr, L.s)) > L.c.half - RALLY.car) { L.res = 'crash'; L.over = ms; SND.play('crash'); haptic('error'); break; }
      if (L.want !== L.to && L.log.length < RALLY.maxLog) { L.to = L.want; L.log.push([L.k, L.to]); }
      const dx = Math.max(-L.c.steer / RALLY.hz, Math.min(L.c.steer / RALLY.hz, L.to - L.x)); L.x += dx; L.lean = dx * RALLY.hz / L.c.steer; L.k++;
    }
    const beat = Math.floor(ms / 240); if (beat !== L.purr && L.over == null && ms > RALLY.wait) { L.purr = beat; SND.play('rrPurr', { rate: 0.94 + (beat % 3) * 0.05 }); }
    return true;
  },
  move: L => ({ log: L.log, steps: L.k }),
  go: () => go(),
});
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  let id = null;
  const at = e => { const L = round.live, f = app.querySelector('.rrfield'); if (!L || !f) return; const b = f.getBoundingClientRect(); L.want = Math.max(0, Math.min(100, Math.round((e.clientX - b.left) / b.width * RALLY.w))); };
  app.addEventListener('pointerdown', e => {
    if (!round.live || state.screen !== 'mini' || !runInputAt(e.target) || !e.target.closest || !e.target.closest('.rrfield')) return;
    id = e.pointerId; at(e); e.preventDefault(); ownPress();
  }, { passive: false });
  app.addEventListener('pointermove', e => { if (round.live && e.pointerId === id) at(e); });
  const up = e => { if (e.pointerId === id) id = null; };
  app.addEventListener('pointerup', up); app.addEventListener('pointercancel', up);
}
export const actions = { 'rr-go': () => { ownPress(); if (!round.live) { SND.play('fsGo'); round.start(); } } };

// ---- the drawing ----
function car(c, u, x, y, col, P, rot) {
  c.save(); c.translate(x * u, y * u); c.rotate(rot || 0);
  c.fillStyle = 'rgba(22,18,16,.25)'; c.beginPath(); c.roundRect(-3.2 * u, -4.6 * u, 7.4 * u, 10.4 * u, 2 * u); c.fill();
  c.fillStyle = '#23232b'; [[-4.1, -3.6], [2.7, -3.6], [-4.1, 2], [2.7, 2]].forEach(([a, b]) => c.fillRect(a * u, b * u, 1.4 * u, 2.6 * u));
  c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = 0.6 * u; c.beginPath(); c.roundRect(-3.4 * u, -5.2 * u, 6.8 * u, 10.4 * u, 2.2 * u); c.fill(); c.stroke();
  c.fillStyle = '#cfeaff'; c.beginPath(); c.roundRect(-2.3 * u, -2.6 * u, 4.6 * u, 2.4 * u, 0.8 * u); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-0.5 * u, -5 * u, 1 * u, 2.2 * u); c.fillRect(-0.5 * u, 0.6 * u, 1 * u, 4.2 * u);
  c.restore();
}
function burst(c, u, x, y, k, col, P, word) {
  c.save(); c.translate(x * u, y * u); c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = 0.7 * u;
  c.beginPath(); for (let a = 0; a < 20; a++) { const rr = (a % 2 ? 11 : 20) * u * (0.4 + 0.6 * Math.min(1, k * 3)), an = a * Math.PI / 10; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.stroke();
  c.font = `400 ${Math.round(10 * u)}px Bangers, "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = P.ink; c.fillText(word, 0, 0.5 * u); c.restore();
}
// The road as the driver sees it at `s` along the lap: centre(sWorld) gives its middle, half its half width.
function road(c, W, H, u, P, s, centre, half) {
  c.fillStyle = '#62b85c'; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,.1)'; for (let k = Math.floor((s - 40) / 24); k * 24 < s + 130; k++) if (k % 2) c.fillRect(0, (CAR_Y - (k * 24 - s) - 24) * u, W, 24 * u);
  const pts = []; for (let y = -6; y <= H_ + 6; y += 3) { const sw = s + (CAR_Y - y); pts.push([y, centre(sw), sw]); }
  c.fillStyle = '#5a5f6b'; c.beginPath(); pts.forEach(([y, m], i) => (i ? c.lineTo((m - half) * u, y * u) : c.moveTo((m - half) * u, y * u))); for (let i = pts.length - 1; i >= 0; i--) c.lineTo((pts[i][1] + half) * u, pts[i][0] * u); c.closePath(); c.fill();
  for (const side of [-1, 1]) for (let i = 1; i < pts.length; i++) { const [y0, m0, sw] = pts[i - 1], [y1, m1] = pts[i]; c.strokeStyle = Math.floor(sw / 9) % 2 ? '#fff' : '#e5484d'; c.lineWidth = 2.2 * u; c.beginPath(); c.moveTo((m0 + side * half) * u, y0 * u); c.lineTo((m1 + side * half) * u, y1 * u); c.stroke(); }
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 0.9 * u; for (let i = 1; i < pts.length; i++) { if (Math.floor(pts[i][2] / 12) % 2) continue; c.beginPath(); c.moveTo(pts[i - 1][1] * u, pts[i - 1][0] * u); c.lineTo(pts[i][1] * u, pts[i][0] * u); c.stroke(); }
  for (const [at, kind] of [[0, 0], [RALLY.len, 1]]) {              // the start line, and the chequered line at the lap's end
    const y = CAR_Y - (at - s) - 5.2; if (y < -8 || y > H_ + 4) continue; const m = centre(at);
    if (!kind) { c.fillStyle = '#fff'; c.fillRect((m - half) * u, (y + 5) * u, 2 * half * u, 1.2 * u); continue; }
    const n = 8, cw = 2 * half / n; for (let a = 0; a < n; a++) for (let b = 0; b < 2; b++) { c.fillStyle = (a + b) % 2 ? '#fff' : '#161210'; c.fillRect((m - half + a * cw) * u, (y + b * 3) * u, cw * u + 1, 3 * u + 1); }
  }
}
function spot(c, u, P, x) {                                         // where the finger asks the car to be
  c.save(); c.globalAlpha = 0.8; c.strokeStyle = '#fff'; c.lineWidth = 1 * u; c.setLineDash([2 * u, 1.6 * u]); c.beginPath(); c.arc(x * u, CAR_Y * u, 8 * u, 0, 7); c.stroke(); c.restore();
}
const go = stage('canvas.rrcv', (c, W, H, now) => {
  round.tick(now);
  if (!src) return false;
  const P = runColours(), u = W / RALLY.w, L = round.live && round.on(src.zoom) ? round.live : null, col = src.by === 'O' ? P.O : P.X;
  c.clearRect(0, 0, W, H);
  if (L) {
    const ms = now - L.t0;
    road(c, W, H, u, P, L.s, sw => rallyCentre(L.tr, Math.max(0, Math.min(RALLY.len, sw))), L.c.half);
    const k = L.over != null ? (ms - L.over) / RALLY.end : 0;
    if (L.over == null) spot(c, u, P, L.want);
    car(c, u, L.x, CAR_Y, L.p === 'O' ? P.O : P.X, P, L.res === 'crash' ? k * 5 : L.lean * 0.2);
    if (ms < RALLY.wait) burst(c, u, 50, 50, 1, '#fff', P, 'READY');
    if (L.res) burst(c, u, 50, 50, k, L.res === 'lap' ? '#ffd23f' : '#ff8a75', P, L.res === 'lap' ? 'LAP!' : 'CRASH!');
    drawTimeBar(c, W, H, 1 - L.s / RALLY.len, P);
    return true;
  }
  const l = src.show, at = src.a ? fxAt('move', src.a) : null, t = src.a ? (at == null ? Infinity : now - at) : Infinity;
  if (l) {                                                        // a result on show: a straight strip, the car as far up it as it got
    const e = Math.max(0, Math.min(1, (t - RALLY.pre) / RALLY.drive)), far = l.pct / 100 * (1 - (1 - e) * (1 - e)), len = 96;
    road(c, W, H, u, P, 0, () => 50, 16);
    for (let a = 0; a < 8; a++) for (let b = 0; b < 2; b++) { c.fillStyle = (a + b) % 2 ? '#fff' : '#161210'; c.fillRect((34 + a * 4) * u, (CAR_Y - len - 6 + b * 3) * u, 4 * u + 1, 3 * u + 1); }
    car(c, u, 50, CAR_Y - far * len, col, P, !l.done && e >= 1 ? 0.9 : 0);
    if (e >= 1) burst(c, u, 50, 56, Math.min(1, (t - RALLY.pre - RALLY.drive) / 300), l.done ? '#ffd23f' : '#ff8a75', P, l.done ? 'LAP!' : `${l.pct}%`);
    return t < rallyShowMs() + 300;
  }
  road(c, W, H, u, P, 0, sw => rallyCentre(src.tr, Math.max(0, Math.min(RALLY.len, sw))), src.half);
  car(c, u, 50, CAR_Y, col, P, 0);
  return false;
});
const words = l => (l.done ? 'Lap done!' : l.crash ? `Crashed at ${l.pct}%` : `Stopped at ${l.pct}%`);
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = rallyCfg(mini), s = a && a.rr ? a.rr : null, own = !!s && ownMove(a), o = { view, locked, turn }, on = round.on(state.zoom);
  if (s && own && skipped !== a && flashAnimating()) { skipped = a; setTimeout(() => { if (state.flash === a) skipFlash(); }, 0); }   // (an attempt driven here was watched live: straight to its result)
  const rest = !s && (view || d) && mini.last ? mini.last : null, l = s || rest, by = s ? a.by : rest ? rest.by : turn, mine = !view && !s && !locked && !d, end = s && !own ? rallyShowMs() : 0;
  const tal = p => arcTally(p, o, pips(p, mini.laps[p], c.laps, !!(s && !own && s.done && a.by === p), end));
  const line = s && !own ? `<p ${lateAt('rrline ' + (s.done ? 'ok' : 'no'), end)} role="status">${words(s)}</p>` : `<p class="rrline${l && !on ? (l.done ? ' ok' : ' no') : ''}">${l && !on ? words(l) : ''}</p>`;
  src = { mini, a: s && !own ? a : null, show: on ? null : l, by, mine, zoom: state.zoom, tr: rallyTrack(mini, turn), half: c.half };
  const btn = view ? '' : `<button class="big ${turn} rrbtn" data-act="rr-go"${mine && !on ? '' : ' disabled'}>${on ? 'Steer!' : 'Go'}</button>`;
  go();
  return `<div class="g-rr pc-${by}"><div class="ctals${c.laps > 5 ? ' two' : ''}">${tal('X')}${tal('O')}</div><div class="rrbox"><div class="rrfield${on ? ' live' : ''}"><canvas class="rrcv" aria-label="The road"></canvas></div></div>${line}${btn}</div>`;
}
// The miniature: a winding road from above with a car on it, beside each player's laps as pips.
export function miniature(mini, final) {
  const c = rallyCfg(mini);
  const art = '<svg class="trr" viewBox="0 0 60 60"><rect class="trrg" x="1.500" y="1.500" width="57" height="57" rx="8"/><path class="trrk" d="M24 60C24 44 40 42 40 30S22 18 26 0"/><path class="trrt" d="M24 60C24 44 40 42 40 30S22 18 26 0"/><path class="trrd" d="M24 60C24 44 40 42 40 30S22 18 26 0"/><rect class="trrc" x="33" y="27" width="9" height="13" rx="3" transform="rotate(-12 37.500 33.500)"/></svg>';
  return thumbArt(art, pipRows(mini.laps, c.laps), 'trrw', `Road Race: X ${mini.laps.X}, O ${mini.laps.O} of ${c.laps} laps`);
}
export function moveText(f, who) { const s = f.rr; return !s ? `${who} drove` : s.done ? `${who} finished a lap` : `${who} crashed at ${s.pct}%`; }
// Someone else's attempt, as its result is shown: the engine as their car drives up the strip, then the fanfare of a
// lap done or the crash. An attempt driven here was heard live.
export function sounds(f, add, won, mini, last) {
  const s = f.rr; if (!s || ownMove(f)) return;
  for (let t = 0; t < RALLY.drive; t += 240) add('rrPurr', RALLY.pre + t, 0.94 + ((t / 240) % 3) * 0.05);
  add(s.done ? 'rrLap' : 'crash', RALLY.pre + RALLY.drive);
}
