// Key Drop: the screen, the miniature, the move's words and sounds, and this phone's two holds.
// The machine is a canvas (the face 100 across; its picture runs from the prize box under the rail to the top
// shelf's prize): the mover's wall of prizes, each on its shelf over its keyhole (a shelf whose prize is won stands
// empty, its keyhole plugged), the key on its carriage, and the prize box with what the mover has won. This phone's
// attempt: hold the button (or anywhere on the machine) and the key slides right, let go and it stops; hold again and
// it slides up, let go and it stops (one hold each way; a slide that reaches its rail's end stops there); the attempt
// goes in and the key pushes forward: into a keyhole (the prize rocks, drops into the box), a scrape along a
// keyhole's edge with sparks (a near miss), or a bump on the wall. The clocks are real time whatever the Animation
// setting. Someone else's attempt shows their two slides first, each run to where it stopped (KEYD.ax, .ay), then
// the push.
import { KEYD, keydAt, keydCfg, keydHole, keydMs, keydPre, keydSpeed } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { app, state } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { runColours, runInputAt } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';
import { flashAnimating, skipFlash } from '../../ui/turns.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is its two stops: shown from the flash
export const KEYV = { top: 102, bot: -14, tick: 85, stuck: 8000 };  // the picture's top and bottom on the machine's own scale (the canvas is 100 by top - bot = 116); ms between the ratchet's ticks; a sent attempt never answered is let go
let aim = null;                                                    // this phone's attempt under way: { sq, p, n, phase 0 ready, 1 sliding right, 2 stopped, 3 sliding up, 4 sent; t0, x, y, tick }
let src = null, hooked = false, skipped = null;
const r1 = v => Math.round(v * 10) / 10;
const live = () => {
  const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini;
  return aim && m && m.type === 'keydrop' && aim.sq === state.zoom && !state.flash && !state.done && !blocked() && src && src.mine ? m : null;
};
function label() {                                                 // the button follows the attempt without a redraw of the screen
  const b = app && app.querySelector ? app.querySelector('.kydbtn') : null; if (!b || !aim) return;
  b.classList.toggle('up', aim.phase >= 2); b.classList.toggle('held', aim.phase === 1 || aim.phase === 3); b.disabled = aim.phase >= 4;
}
function press() {
  const m = live(); if (!m || (aim.phase !== 0 && aim.phase !== 2)) return false;
  aim.phase++; aim.t0 = performance.now(); aim.tick = 0;
  haptic('tap'); label(); go();
  return true;
}
function release() {
  if (!aim || (aim.phase !== 1 && aim.phase !== 3)) return false;
  const m = live(); if (!m) { aim.phase--; label(); return false; }  // (the square was left mid-hold: that hold is not spent)
  const v = keydSpeed(keydCfg(m), m.n[aim.p]), t = performance.now() - aim.t0;
  SND.play('kyStop', { rate: aim.phase === 1 ? 1 : 1.18 }); haptic('tap');
  if (aim.phase === 1) { aim.x = r1(keydAt(KEYD.x0, v.x, t)); aim.phase = 2; label(); go(); return true; }
  aim.y = r1(keydAt(KEYD.y0, v.y, t)); aim.phase = 4; aim.t0 = performance.now(); label();
  attemptMove({ x: aim.x, y: aim.y });                             // (the move may redraw the screen at once and drop the aim: nothing of it is read after)
  go();
  return true;
}
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  app.addEventListener('pointerdown', e => {
    if (state.screen !== 'mini' || !runInputAt(e.target) || !(e.target.closest && e.target.closest('.kydfield.live, .kydbtn:not(:disabled)'))) return;
    if (press()) { e.preventDefault(); ownPress(); }
  }, { passive: false });
  const up = () => { release(); };
  if (typeof window !== 'undefined' && window.addEventListener) { ['pointerup', 'pointercancel', 'blur'].forEach(ev => window.addEventListener(ev, up)); }
  app.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && e.target.closest && e.target.closest('.kydbtn')) { e.preventDefault(); if (!e.repeat) press(); } });
  app.addEventListener('keyup', e => { if ((e.key === ' ' || e.key === 'Enter') && e.target.closest && e.target.closest('.kydbtn')) { e.preventDefault(); release(); } });
}
export const actions = { 'ky-hold': () => {} };                    // (the hold is the press and the release themselves, above: the click that ends it does nothing)

// ---- the drawing ----
const clamp = u => (u <= 0 ? 0 : u >= 1 ? 1 : u), ease = u => { const k = clamp(u); return 1 - (1 - k) * (1 - k); };
const kindOf = i => (i * 5 + 2) % KEYD.kinds;
const FILL = ['#b06cf0', '#31c6b4', '#6fcf5a', '#58a8cf', '#ff9f43', '#ff7ab8'];
function drawPrize(c, u, kind, x, y, r, P, rot) {                 // a prize about (x, y) in canvas units, r its half size: star, gem, ball, gift, crown, heart
  c.save(); c.translate(x, y); if (rot) c.rotate(rot);
  c.fillStyle = FILL[kind]; c.strokeStyle = P.ink; c.lineWidth = Math.max(1.2, u * 0.55); c.lineJoin = 'round';
  c.beginPath();
  if (kind === 0) { for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.48 : r * 1.05, an = -Math.PI / 2 + k * Math.PI / 5; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.stroke(); }
  else if (kind === 1) { c.moveTo(-r, -r * 0.25); c.lineTo(-r * 0.5, -r * 0.85); c.lineTo(r * 0.5, -r * 0.85); c.lineTo(r, -r * 0.25); c.lineTo(0, r); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-r, -r * 0.25); c.lineTo(r, -r * 0.25); c.moveTo(-r * 0.35, -r * 0.25); c.lineTo(0, r); c.lineTo(r * 0.35, -r * 0.25); c.stroke(); }
  else if (kind === 2) { c.arc(0, 0, r * 0.95, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -r * 0.95); c.quadraticCurveTo(r * 0.75, 0, 0, r * 0.95); c.quadraticCurveTo(-r * 0.2, 0, 0, -r * 0.95); c.fill(); c.stroke(); }
  else if (kind === 3) { c.rect(-r * 0.9, -r * 0.55, r * 1.8, r * 1.5); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.rect(-r * 0.2, -r * 0.55, r * 0.4, r * 1.5); c.fill(); c.stroke(); c.beginPath(); c.arc(-r * 0.32, -r * 0.75, r * 0.3, 0, 7); c.arc(r * 0.32, -r * 0.75, r * 0.3, 0, 7); c.fill(); c.stroke(); }
  else if (kind === 4) { c.moveTo(-r, r * 0.8); c.lineTo(-r, -r * 0.6); c.lineTo(-r * 0.45, 0); c.lineTo(0, -r * 0.9); c.lineTo(r * 0.45, 0); c.lineTo(r, -r * 0.6); c.lineTo(r, r * 0.8); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, r * 0.3, r * 0.2, 0, 7); c.fill(); c.stroke(); }
  else { c.moveTo(0, r * 0.95); c.bezierCurveTo(-r * 1.5, -r * 0.1, -r * 0.7, -r * 1.2, 0, -r * 0.4); c.bezierCurveTo(r * 0.7, -r * 1.2, r * 1.5, -r * 0.1, 0, r * 0.95); c.closePath(); c.fill(); c.stroke(); }
  c.restore();
}
function drawKey(c, u, x, y, P, k, col, turn) {                   // its tip at (x, y); k 0 held off the wall .. 1 pushed home (beyond 1: into a keyhole); turn: a quarter turn in the lock, 0..1
  const s = 1.25 * (1 - 0.28 * k) * u, off = Math.max(0, 1 - k) * 1.6 * u, sy = Math.cos((turn || 0) * Math.PI / 2) * 0.86 + 0.14;
  const shape = () => { c.beginPath(); c.rect(0, -0.85, 6.6, 1.7); c.rect(1, 0.85, 1.2, 1.6); c.rect(3, 0.85, 1.2, 1.1); c.moveTo(12, 0); c.arc(9.2, 0, 2.8, 0, 7); };
  c.save(); c.translate(x + off, y + off); c.rotate(Math.PI * 0.75); c.scale(s, s); c.fillStyle = 'rgba(22,18,16,.28)'; shape(); c.fill(); c.restore();
  c.save(); c.translate(x, y); c.rotate(Math.PI * 0.75); c.scale(s, s * sy);
  c.fillStyle = '#e9edf5'; c.strokeStyle = P.ink; c.lineWidth = 0.62; c.lineJoin = 'round'; shape(); c.fill(); c.stroke();
  c.fillStyle = col; c.beginPath(); c.arc(9.2, 0, 1.7, 0, 7); c.fill(); c.stroke(); c.fillStyle = P.paper; c.beginPath(); c.arc(9.2, 0, 0.65, 0, 7); c.fill(); c.stroke();
  c.restore();
}
const go = stage('canvas.kydcv', (c, W, H, now) => {
  if (!src) return false;
  const { mini, a, by } = src, P = runColours(), u = W / 100, cfg = keydCfg(mini), col = by === 'O' ? P.O : P.X, wall = mini.wall[by];
  const Y = y => (KEYV.top - y) * u, n = mini.cols * mini.rows;
  const sc = Math.min(1, mini.cols > 1 ? KEYD.span / (mini.cols - 1) / 29 : 1, mini.rows > 1 ? KEYD.span / (mini.rows - 1) / 29 : 1), pr = 5.2 * sc;
  const s = a ? a.kd : null, at = s ? fxAt('move', a) : null, own = !!(s && src.own), pre = keydPre();
  const t = s ? (at == null ? Infinity : now - at) + (own ? pre : 0) : 0, land = pre + KEYD.push, tk = t - land;
  // the cabinet, its wall and the prize box
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#2b3a6b'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#4f79c7'; c.strokeStyle = P.ink; c.lineWidth = u * 0.8; c.beginPath(); c.rect(3 * u, Y(KEYV.top - 1.5), 94 * u, (KEYV.top - 1.5 - 1) * u); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.09)'; for (let yy = 4; yy < KEYV.top - 2; yy += 4) for (let xx = 5 + (yy % 8 ? 2 : 0); xx < 96; xx += 4) { c.beginPath(); c.arc(xx * u, Y(yy), u * 0.55, 0, 7); c.fill(); }
  c.fillStyle = '#151c36'; c.strokeStyle = P.ink; c.beginPath(); c.rect(6 * u, Y(-2), 88 * u, 10.5 * u); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(8 * u, Y(-3), 84 * u, 1.4 * u);
  const hx = i => keydHole(mini, i).x * u, hy = i => Y(keydHole(mini, i).y), py = i => Y(keydHole(mini, i).y + 4.6 * sc + 1.6 + pr);
  const falling = s && s.hit >= 0 ? s.hit : -1, won = []; for (let i = 0; i < n; i++) if (!wall[i]) won.push(i);
  const slot = k => ({ x: (14 + (k + 0.5) * 72 / Math.max(4, won.length)) * u, y: Y(-7.6) });
  for (let i = 0; i < n; i++) {
    const X0 = hx(i), Y0 = hy(i), on = wall[i] || (i === falling && tk < 0), plugged = !wall[i] && !(i === falling && tk < KEYD.drop * 0.3);
    c.fillStyle = 'rgba(22,30,70,.42)'; c.beginPath(); c.rect(X0 - 10.5 * sc * u, py(i) - (pr + 1.6) * u, 21 * sc * u, (2 * pr + 3.2) * u); c.fill();
    c.fillStyle = '#c58a4a'; c.strokeStyle = P.ink; c.lineWidth = u * 0.55; c.beginPath(); c.rect(X0 - 11.5 * sc * u, Y0 - (4.6 * sc + 1.6) * u, 23 * sc * u, 1.6 * u); c.fill(); c.stroke();
    const near = s && s.hit < 0 && s.near && s.hole === i && tk >= 0 && tk < 520;
    const T = cfg.tol * u, plate = Math.max(3.9 * sc * u, T * 1.45);   // the opening is the hit zone itself: within `tol` both across and up of the middle goes in (rules.js keydMeet)
    c.fillStyle = plugged ? '#7f8696' : '#e3e7ef'; c.beginPath(); c.arc(X0, Y0, plate, 0, 7); c.fill(); c.stroke();
    if (near) { c.save(); c.globalAlpha = 1 - tk / 520; c.strokeStyle = '#ff9f43'; c.lineWidth = u * 1.1; c.beginPath(); c.arc(X0, Y0, plate + (0.7 + tk / 130) * u, 0, 7); c.stroke(); c.restore(); }
    c.fillStyle = plugged ? '#5b6170' : '#22283d'; c.strokeStyle = plugged ? '#4a4f5c' : P.ink; c.lineWidth = u * 0.4; c.beginPath(); c.roundRect(X0 - T, Y0 - T, 2 * T, 2 * T, T * 0.35); c.fill(); c.stroke();   // the opening, the hit zone's own size
    const hr = T * 0.42; c.fillStyle = plugged ? '#3b3f4a' : '#05060a'; c.beginPath(); c.arc(X0, Y0 - hr * 0.55, hr, 0, 7); c.fill(); c.beginPath(); c.moveTo(X0 - hr * 0.45, Y0 - hr * 0.3); c.lineTo(X0 + hr * 0.45, Y0 - hr * 0.3); c.lineTo(X0 + hr * 0.75, Y0 + hr * 1.55); c.lineTo(X0 - hr * 0.75, Y0 + hr * 1.55); c.closePath(); c.fill();
    if (on) { const rock = i === falling && t >= pre + KEYD.push * 0.7 ? Math.sin((t - pre) / 38) * 0.16 : 0; drawPrize(c, u, kindOf(i), X0, py(i), pr * u, P, rock); }
  }
  won.forEach((i, k) => { if (i !== falling || tk >= KEYD.drop) { const q = slot(k); drawPrize(c, u, kindOf(i), q.x, q.y, 3.6 * u, P, (k % 2 ? 0.25 : -0.2)); } });
  // the key on its rails: where it is now
  let kx = KEYD.x0, ky = KEYD.y0, push = 0, more = false, slide = 0;
  if (s) {
    kx = own ? s.x : KEYD.x0 + (s.x - KEYD.x0) * clamp(t / KEYD.ax); ky = own ? s.y : KEYD.y0 + (s.y - KEYD.y0) * clamp((t - KEYD.ax) / KEYD.ay);
    push = ease((t - pre) / KEYD.push); slide = t < KEYD.ax ? 1 : t < pre ? 2 : 0;
    more = t < keydMs(s.hit >= 0) + 500;
  } else if (aim && src.mine && aim.sq === src.zoom) {
    const v = keydSpeed(cfg, mini.n[by]), tt = now - aim.t0;
    kx = aim.phase === 1 ? keydAt(KEYD.x0, v.x, tt) : aim.phase >= 2 ? aim.x : KEYD.x0; ky = aim.phase === 3 ? keydAt(KEYD.y0, v.y, tt) : aim.phase >= 4 ? aim.y : KEYD.y0;
    slide = aim.phase === 1 ? 1 : aim.phase === 3 ? 2 : 0;
    if (slide) { const far = slide === 1 ? kx : ky; if (far >= KEYD.max) release(); else if (tt - aim.tick >= KEYV.tick) { aim.tick = tt; SND.play('kyTick', { rate: 0.9 + 0.5 * (far - KEYD.x0) / (KEYD.max - KEYD.x0) }); } }
    if (aim.phase === 4) push = 0.12 + 0.05 * Math.sin(tt / 90);
    more = true;
  }
  c.strokeStyle = '#151c36'; c.lineCap = 'round'; c.lineWidth = u * 2.2; c.beginPath(); c.moveTo(KEYD.x0 * u, Y(KEYD.y0)); c.lineTo(KEYD.max * u, Y(KEYD.y0)); c.stroke();
  c.strokeStyle = 'rgba(21,28,54,.34)'; c.lineWidth = u * 1.3; c.beginPath(); c.moveTo(kx * u, Y(KEYD.y0)); c.lineTo(kx * u, Y(KEYD.max)); c.stroke();
  c.fillStyle = '#9aa3b8'; c.strokeStyle = P.ink; c.lineWidth = u * 0.55; c.lineCap = 'butt'; c.beginPath(); c.rect((kx - 2.6) * u, Y(KEYD.y0) - 2 * u, 5.2 * u, 4 * u); c.fill(); c.stroke();
  if (!s && aim && src.mine && aim.sq === src.zoom && aim.phase < 4) {   // which way the next hold goes: chevrons along that rail, in the mover's colour
    const upw = aim.phase >= 2, ph = (now / 420) % 1;
    c.save(); c.strokeStyle = col; c.lineWidth = u * 1.5; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let k = 0; k < 3; k++) { const d = (7 + k * 4.2) * u, al = 0.25 + 0.75 * (1 - Math.abs(((ph * 3 - k) % 3 + 3) % 3 - 1) / 2); c.globalAlpha = slide ? 0.9 : al; const x = kx * u + (upw ? 0 : d), y = Y(ky) - (upw ? d : 0); c.beginPath(); if (upw) { c.moveTo(x - 1.7 * u, y + 1.5 * u); c.lineTo(x, y); c.lineTo(x + 1.7 * u, y + 1.5 * u); } else { c.moveTo(x - 1.5 * u, y - 1.7 * u); c.lineTo(x, y); c.lineTo(x - 1.5 * u, y + 1.7 * u); } c.stroke(); }
    c.restore();
  }
  // the push's end: in (the key stays home), a scrape with sparks, or a bump
  let ox = 0, oy = 0, pk = push;
  if (s && tk >= 0 && s.hit < 0 && !s.empty) {
    const h = s.near && s.hole >= 0 ? keydHole(mini, s.hole) : null, dx = h ? s.x - h.x : 0, dy = h ? s.y - h.y : 0, dl = Math.hypot(dx, dy) || 1, back = ease(tk / 260);
    pk = 1 - 0.3 * back;
    if (h) { const sl = 1.4 * ease(tk / 200); ox = dx / dl * sl * u; oy = -dy / dl * sl * u; } else ox = Math.sin(tk / 26) * Math.max(0, 1 - tk / 260) * 0.9 * u;
    if (tk < 380) {
      const k2 = tk / 380, ex = h ? (h.x + dx / dl * 2.2 * sc) * u : s.x * u, ey = h ? Y(h.y + dy / dl * 2.2 * sc) : Y(s.y);
      c.save(); c.globalAlpha = 1 - k2; c.lineCap = 'round';
      if (h) { c.strokeStyle = '#ffe14d'; c.lineWidth = u * 1.15; for (let k = 0; k < 7; k++) { const an = Math.atan2(-dy, dx) + (k - 3) * 0.42, r0 = (1 + k2 * 2.5) * u, r1b = (3 + k2 * 6 + (k % 2) * 1.5) * u; c.beginPath(); c.moveTo(ex + Math.cos(an) * r0, ey + Math.sin(an) * r0); c.lineTo(ex + Math.cos(an) * r1b, ey + Math.sin(an) * r1b); c.stroke(); } }
      else { c.fillStyle = '#fff'; c.strokeStyle = P.ink; c.lineWidth = u * 0.5; c.beginPath(); for (let k = 0; k < 16; k++) { const rr = (k % 2 ? 2 : 4.2) * (0.6 + k2 * 0.7) * u, an = k * Math.PI / 8; c.lineTo(ex + Math.cos(an) * rr, ey + Math.sin(an) * rr); } c.closePath(); c.fill(); c.stroke(); }
      c.restore();
    }
  }
  let turn = 0;
  if (s && s.hit >= 0) {                                           // a hit: the key's tip finds the keyhole's middle as it pushes, sinks in and turns
    const h = keydHole(mini, s.hit), g = ease(clamp(push * 1.25));
    kx += (h.x - kx) * g; ky += (h.y - ky) * g;
    if (tk >= 0) { pk = 1 + 0.4 * ease(clamp(tk / 220)); turn = ease(clamp((tk - 160) / 200)); }
  }
  drawKey(c, u, kx * u + ox, Y(ky) + oy, P, pk, col, turn);
  if (falling >= 0 && tk >= 0 && tk < KEYD.drop) {                 // the prize knocked off its shelf, into the box
    const k = tk / KEYD.drop, q = slot(won.indexOf(falling)), x0 = hx(falling), y0 = py(falling), f = k * k;
    drawPrize(c, u, kindOf(falling), x0 + (q.x - x0) * k, y0 + (q.y - y0) * f - Math.sin(k * Math.PI) * 3 * u * (1 - k), (pr + (3.6 - pr) * k) * u, P, k * 2.4);
  }
  return more;
});

// ---- the view's hooks ----
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const WORD = l => (l.hit >= 0 ? ['ok', 'Got it!'] : l.empty ? ['no', 'Empty shelf'] : l.near ? ['near', 'So close!'] : ['no', 'Missed']);
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = keydCfg(mini), s = a && a.kd ? a.kd : null, own = !!s && ownMove(a), o = { view, locked, turn };
  const by = s ? a.by : (view || d) && mini.last ? mini.last.by : turn, mine = !view && !locked && !s && !d;
  if (mine && aim && aim.phase === 4 && performance.now() - aim.t0 > KEYV.stuck) aim = null;
  if (mine && !(aim && aim.sq === state.zoom && aim.p === turn && aim.n === mini.n[turn])) aim = { sq: state.zoom, p: turn, n: mini.n[turn], phase: 0, t0: performance.now(), tick: 0 };
  if (!mine && aim && s) aim = null;
  // An attempt made here was aimed here: its flash starts at the push and ends with it (the slides are not played again).
  if (s && own && skipped !== a && flashAnimating()) { skipped = a; setTimeout(() => { if (state.flash === a) skipFlash(); }, KEYD.push + (s.hit >= 0 ? KEYD.drop : 0) + 520); }
  const land = (own ? 0 : keydPre()) + KEYD.push + (s && s.hit >= 0 ? KEYD.drop : 0);
  const tal = p => arcTally(p, o, pips(p, mini.got[p], c.goal, !!(s && s.hit >= 0 && a.by === p), land));
  const l = s || ((view || d) && mini.last ? mini.last : null), w = l ? WORD(l) : null;
  const line = l ? `<p ${s ? lateAt('kydline ' + w[0], land - (l.hit >= 0 ? KEYD.drop : 0)) : `class="kydline ${w[0]}"`} role="status">${w[1]}</p>` : '<p class="kydline"></p>';
  src = { mini, a: s ? a : null, by, own, mine, zoom: state.zoom };
  const ph = mine && aim ? aim.phase : 0;
  const btn = view ? '' : `<button class="big ${turn} kydbtn${ph >= 2 ? ' up' : ''}${ph === 1 || ph === 3 ? ' held' : ''}" data-act="ky-hold" aria-label="Hold to slide the key ${ph >= 2 ? 'up' : 'right'}; let go to stop it"${mine && ph < 4 ? '' : ' disabled'}><b>Hold</b>${ARROW}</button>`;
  go();
  return `<div class="g-kyd pc-${by}"><div class="ctals${c.goal > 4 ? ' two' : ''}">${tal('X')}${tal('O')}</div><div class="kydbox"><div class="kydfield${mine ? ' live' : ''}"><canvas class="kydcv" aria-label="The prize wall: ${mini.wall[by].filter(Boolean).length} prizes on their shelves"></canvas></div></div>${line}${btn}</div>`;
}
// The miniature: a keyhole with the key at it under a prize on its shelf, beside each player's prizes won as pips.
export function miniature(mini, final) {
  const goal = keydCfg(mini).goal;
  const art = '<svg class="tkyd" viewBox="0 0 60 60"><rect class="tkya" x="4" y="4" width="52" height="52" rx="5"/><path class="tkys" d="M14 27h32"/><path class="tkyp" d="M30 7l3.300 6.200 6.900 1-5 4.800 1.200 6.800-6.400-3.300-6.400 3.300 1.200-6.800-5-4.800 6.900-1z"/><circle class="tkyh" cx="30" cy="38" r="6.500"/><path class="tkyk" d="M30 36.500a2.200 2.200 0 1 1 .01 0zM28.900 38h2.200l1 4.500h-4.200z"/><path class="tkyd" d="M27 41 13 55"/><circle class="tkyb" cx="11" cy="53" r="4.500"/></svg>';
  return thumbArt(art, pipRows(mini.got, goal), 'tkydw', `Key Drop: X ${mini.got.X}, O ${mini.got.O} of ${goal} prizes`);
}
export function moveText(f, who) { const l = f.kd; return !l ? '' : l.hit >= 0 ? `${who} won a prize` : l.near ? `${who} just missed a keyhole` : `${who} missed`; }
// Someone else's attempt: the ratchet's ticks along each slide and a clunk at each stop, then the push and its end:
// the lock's click, the prize landing in the box and a chime; a scrape for a near miss; a thud on the wall. An
// attempt made here had its ticks and clunks as it was made.
export function sounds(f, add, won, mini, last) {
  const l = f.kd; if (!l) return;
  const own = ownMove(f), pre = own ? 0 : keydPre(), land = pre + KEYD.push;
  if (!own) { for (let k = 1; k < 4; k++) { add('kyTick', k * KEYD.ax / 4, 0.9 + k * 0.08); add('kyTick', KEYD.ax + k * KEYD.ay / 4, 1.1 + k * 0.08); } add('kyStop', KEYD.ax, 1); add('kyStop', pre, 1.18); }
  add('kyPush', pre);
  if (l.hit >= 0) { add('kyIn', land); add('ballDrop', land + KEYD.drop - 70); add('ding', land + KEYD.drop + 30); }
  else if (l.empty) add('kyIn', land);
  else if (l.near) add('kyScrape', land - 30);
  else add('thud', land);
}
