// Tank Duel: the screen, the miniature, the move's words and sounds, and this phone's turn in the making.
// The field is a canvas, 100 columns across (TANK.w) and TANK.top tall: sky with clouds drifting the way the wind
// blows, the wind's sign at the top (an arrow and its number), the hills with a grass edge, and two chunky tanks in
// the players' colours with their drawn marks. A turn is a draft, sent only with Fire: the two arrows drive the tank
// a column at a time (the fuel left a row of pips between them); a press or a drag anywhere on the field points the
// barrel at the finger, the further from the tank the more power (a dotted guide with a knob at the finger); the
// little minus and plus buttons step the angle a degree and the power a point (their numbers between them).
// The turn plays from the move, for everyone (this phone's too: the drive and the shot are new to the eye): the tank
// drives (TANKT.col a column), the barrel swings up (TANKT.aim), recoils and fires; the shell flies its path (the
// rules' own flight: tankTrail), dropping a dotted trail that stays until that player's next shot (each player's last
// trail stays on the field, the mover's own the stronger while they aim); then the blast: a comic burst, the crater
// cut, dirt thrown, the tanks settling, each tank's damage rising off it as a number while the health bars count down.
import { TANK, TANKT, tankCarve, tankCfg, tankDrive, tankHeights, tankTimes, tankTrail } from './rules.js';
import { goAgain } from '../../core/tune.js';
import { other } from '../../core/util.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { N, app, state } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { arcTally, gaugeBar, lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { runColours, runInputAt } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows } from '../../ui/tok.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the draft is never sent: the turn plays from the move
// (reach: the drag's length, field units, that is full power; every: a trail's dot every so many steps; settle: the
// tanks coming down onto the new ground; kick: the barrel's recoil; stuck: a turn sent and never answered is let go;
// held, again: a stepper held down steps again after `held` ms, then every `again`.)
export const TANKV = { reach: 46, every: 7, settle: 300, kick: 240, muzzle: 170, stuck: 8000, shake: 240, held: 380, again: 65 };
let draft = null;                                                  // this phone's turn in the making: { sq, p, n, d, a, pw, sent }
let src = null, hooked = false, drag = null, hold = null, swallow = 0;   // (hold: a stepper held down, stepping on; swallow: the click that ends such a hold is not one more step)
const clamp = u => (u <= 0 ? 0 : u >= 1 ? 1 : u), ease = u => { const k = clamp(u); return 1 - (1 - k) * (1 - k); };
const ix = p => (p === 'X' ? 0 : 1);
const restAng = (mini, p) => { const s = mini.sh && mini.sh[p]; return s ? s[2] : mini.at[other(p)] >= mini.at[p] ? 45 : 135; };
const live = () => {
  const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini;
  return draft && !draft.sent && m && m.type === 'tanks' && draft.sq === state.zoom && !state.flash && !state.done && !blocked() && src && src.mine ? m : null;
};
// The decoded ground and the trails are kept from frame to frame (a string or a shot in, the same arrays out).
const memo = (max => { const keys = [], vals = {}; return (k, make) => { if (!(k in vals)) { vals[k] = make(); keys.push(k); if (keys.length > max) delete vals[keys.shift()]; } return vals[k]; }; })(12);
const groundOf = h => memo('h' + h, () => tankHeights(h));
const trailOf = (c, wind, sh) => memo(`t${wind}|${c.gravity}|${c.speed}|${sh.slice(0, 5).join(',')}`, () => tankTrail(c, wind, sh[0], sh[1], sh[2], sh[3], sh[4], TANKV.every));
// Where the drafted drive ends.
const draftTo = (mini, c) => tankDrive(groundOf(mini.h), c, mini.at[draft.p], draft.d, mini.at[other(draft.p)]);
function show() {                                                  // the draft's numbers follow a drag without a redraw of the screen
  if (!app || !app.querySelector || !draft) return;
  const a = app.querySelector('.tkang b'), p = app.querySelector('.tkpow b'), bar = app.querySelector('.tkpow i');
  if (a) a.textContent = `${draft.a <= 90 ? draft.a : 180 - draft.a}°`; if (p) p.textContent = String(draft.pw); if (bar && bar.style) bar.style.setProperty('--w', `${draft.pw}%`);
}
function aimAt(e) {
  const mini = live(); if (!mini) return;
  const cv = app.querySelector('canvas.tkcv'); if (!cv) return;
  const r = cv.getBoundingClientRect(); if (!(r.width > 2)) return;
  const u = r.width / TANK.w, c = tankCfg(mini), to = draftTo(mini, c), H = groundOf(mini.h);
  const dx = (e.clientX - r.left) / u - 0.5 - to, dy = (r.bottom - e.clientY) / u - (H[to] + TANK.cy), len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return;
  const a = dy <= 0 ? (dx >= 0 ? 0 : 180) : Math.max(0, Math.min(180, Math.round(Math.atan2(dy, dx) * 180 / Math.PI)));
  const pw = Math.max(TANK.pmin, Math.min(TANK.pmax, Math.round(len / TANKV.reach * 100)));
  if (a === draft.a && pw === draft.pw) return;
  if (Math.abs(a - draft.a) + Math.abs(pw - draft.pw) >= 3 && performance.now() - (draft.tick || 0) > 70) { draft.tick = performance.now(); SND.play('tnTick', { rate: 0.8 + pw / 160 }); }
  draft.a = a; draft.pw = pw; show(); go();
}
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  app.addEventListener('pointerdown', e => {
    if (state.screen !== 'mini' || !runInputAt(e.target) || !e.target.closest || !e.target.closest('.tkfield.live') || e.target.closest('button') || !live()) return;
    drag = e.pointerId; e.preventDefault(); ownPress(); aimAt(e);
  }, { passive: false });
  app.addEventListener('pointermove', e => { if (drag != null && e.pointerId === drag) aimAt(e); });
  app.addEventListener('pointerdown', e => {                       // a stepper held down steps on and on
    const b = e.target.closest && e.target.closest('.tkstep'); if (!b || b.disabled || !live() || !actions[b.dataset.act]) return;
    const fn = actions[b.dataset.act]; if (hold) clearTimeout(hold.timer);
    const tick = () => { if (!hold || !live()) return; hold.n++; fn(); hold.timer = setTimeout(tick, TANKV.again); };
    hold = { n: 0, timer: setTimeout(tick, TANKV.held) };
  });
  const up = e => {
    if (drag != null && (!e || e.pointerId == null || e.pointerId === drag)) drag = null;
    if (hold) { clearTimeout(hold.timer); if (hold.n) swallow = performance.now() + 350; hold = null; }
  };
  if (typeof window !== 'undefined' && window.addEventListener) ['pointerup', 'pointercancel', 'blur'].forEach(ev => window.addEventListener(ev, up));
}
const step = (key, by, lo, hi) => () => { const mini = live(); if (!mini || (!hold && performance.now() < swallow)) return; const v = Math.max(lo, Math.min(hi, draft[key] + by)); if (v === draft[key]) return; draft[key] = v; ownPress(); SND.play('tnTick', { rate: key === 'a' ? 1 : 1.25 }); haptic('tap'); show(); go(); };   // (no redraw of the screen: the button stays under the finger)
const drive = by => () => {
  const mini = live(); if (!mini) return;
  const c = tankCfg(mini), d = draft.d + by, was = draftTo(mini, c);
  if (Math.abs(d) > c.fuel || tankDrive(groundOf(mini.h), c, mini.at[draft.p], d, mini.at[other(draft.p)]) === was) return;
  draft.d = d; ownPress(); SND.play('tnTrack'); haptic('tap'); render();
};
export const actions = {
  'tanks-l': drive(-1), 'tanks-r': drive(1),
  'tanks-am': () => step('a', draft && draft.a > 90 ? 1 : -1, 0, 180)(), 'tanks-ap': () => { if (draft && draft.a !== 90) step('a', draft.a > 90 ? -1 : 1, 0, 180)(); },   // (the number shown is the barrel's rise: plus lifts it, whichever way it points, up to straight up)
  'tanks-pm': step('pw', -1, TANK.pmin, TANK.pmax), 'tanks-pp': step('pw', 1, TANK.pmin, TANK.pmax),
  'tanks-fire': () => { const mini = live(); if (!mini) return; const m = { d: draft.d, a: draft.a, p: draft.pw }; draft.sent = performance.now(); ownPress(); SND.play('tnLoad'); haptic('tap'); attemptMove(m); },
};

// ---- the drawing ----
// The ground's top edge as a path (smoothed through the columns' middles), left to right.
function edge(c, H, X, Y) {
  c.moveTo(0, Y(H[0]));
  for (let i = 0; i < H.length - 1; i++) c.quadraticCurveTo(X(i), Y(H[i]), (X(i) + X(i + 1)) / 2, (Y(H[i]) + Y(H[i + 1])) / 2);
  c.lineTo(X(H.length - 1) + 4, Y(H[H.length - 1]));
}
const groundAt = (H, x) => { const i = Math.max(0, Math.min(H.length - 1, Math.floor(x))), j = Math.min(H.length - 1, i + 1), f = clamp(x - i); return H[i] + (H[j] - H[i]) * f; };
const tiltAt = (H, x) => { const i = Math.round(x), a = H[Math.max(0, i - 2)], b = H[Math.min(H.length - 1, i + 2)]; return Math.max(-0.32, Math.min(0.32, Math.atan2(b - a, 4))); };
// A tank about its middle (px, py: the hull's middle, TANK.cy above its ground), u px a field unit: tracks, hull, a
// domed turret with the player's drawn mark, the barrel at `ang` degrees (shortened by `kick` as it recoils).
function drawTank(c, u, P, px, py, tilt, p, ang, kick, wreck) {
  const col = wreck ? '#8a8f98' : p === 'O' ? P.O : P.X, dark = wreck ? '#5d626b' : p === 'O' ? '#c99400' : '#b02f1b', lw = Math.max(1.4, u * 0.42);
  const rad = ang * Math.PI / 180, bl = TANK.len * u * (1 - 0.28 * kick), bx = Math.cos(rad), by = -Math.sin(rad);
  c.save(); c.translate(px - bx * kick * 0.7 * u, py - by * kick * 0.7 * u); c.lineJoin = 'round'; c.lineCap = 'round';
  // the barrel (in the field's own frame: the shot's angle), behind the turret
  c.strokeStyle = P.ink; c.lineWidth = 1.5 * u + lw * 1.6; c.beginPath(); c.moveTo(bx * 1.2 * u, by * 1.2 * u); c.lineTo(bx * bl, by * bl); c.stroke();
  c.strokeStyle = dark; c.lineWidth = 1.5 * u; c.beginPath(); c.moveTo(bx * 1.2 * u, by * 1.2 * u); c.lineTo(bx * (bl - lw * 0.4), by * (bl - lw * 0.4)); c.stroke();
  c.strokeStyle = P.ink; c.lineWidth = lw; c.beginPath(); c.moveTo(bx * (bl - 1.1 * u) - by * 1.05 * u, by * (bl - 1.1 * u) + bx * 1.05 * u); c.lineTo(bx * (bl - 1.1 * u) + by * 1.05 * u, by * (bl - 1.1 * u) - bx * 1.05 * u); c.stroke();
  c.rotate(-tilt);
  const g = TANK.cy * u;                                           // the ground under the middle, in the tank's frame
  c.lineWidth = lw; c.strokeStyle = P.ink;
  c.fillStyle = '#3b4150'; c.beginPath(); c.roundRect(-4.7 * u, g - 2 * u, 9.4 * u, 2 * u, u); c.fill(); c.stroke();   // the tracks
  c.fillStyle = '#aab3c2'; for (let k = -3; k <= 3; k += 2) { c.beginPath(); c.arc(k * 1.1 * u, g - u, 0.55 * u, 0, 7); c.fill(); }
  c.fillStyle = col; c.beginPath(); c.moveTo(-4.2 * u, g - 1.9 * u); c.lineTo(-3.1 * u, g - 3.5 * u); c.lineTo(3.1 * u, g - 3.5 * u); c.lineTo(4.2 * u, g - 1.9 * u); c.closePath(); c.fill(); c.stroke();   // the hull
  c.beginPath(); c.arc(0, g - 3.4 * u, 2.25 * u, Math.PI, 0); c.closePath(); c.fill(); c.stroke();   // the turret
  c.strokeStyle = wreck ? '#3b3f47' : P.ink; c.lineWidth = Math.max(1.3, u * 0.5); const m = 0.78 * u, my = g - 4.35 * u;   // the mark
  c.beginPath(); if (p === 'X') { c.moveTo(-m, my - m); c.lineTo(m, my + m); c.moveTo(m, my - m); c.lineTo(-m, my + m); } else c.arc(0, my, m * 1.05, 0, 7); c.stroke();
  c.restore();
}
function burst(c, x, y, r, n, inner, rot) { c.beginPath(); for (let k = 0; k < n * 2; k++) { const rr = k % 2 ? r * inner : r, an = (rot || 0) + k * Math.PI / n; c.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } c.closePath(); }
function cloud(c, x, y, s, P) {                                 // three puffs on a flat base, outlined
  const parts = [[-0.9, 0, 0.5], [-0.25, -0.4, 0.64], [0.55, -0.22, 0.56], [1.1, 0.08, 0.4]], lw = Math.max(1.4, s * 0.1);
  for (const [col, g] of [[P.ink, lw], ['#fff', 0]]) {
    c.fillStyle = col;
    for (const [dx, dy, r] of parts) { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s + g, 0, 7); c.fill(); }
    c.beginPath(); c.roundRect(x - 1.3 * s - g, y - 0.05 * s - g, 2.75 * s + 2 * g, 0.52 * s + 2 * g, 0.26 * s + g); c.fill();
  }
}
const go = stage('canvas.tkcv', (c, W, H, now) => {
  if (!src) return false;
  const { mini, a } = src, P = runColours(), u = W / TANK.w, cfg = tankCfg(mini), X = x => (x + 0.5) * u, Y = y => H - y * u;
  const s = a ? a.tk : null, at = s ? fxAt('move', a) : null, t = s ? (at == null ? Infinity : now - at) : 0, T = s ? tankTimes(s) : null;
  const wind = s ? s.wind : mini.wind, by = s ? a.by : src.by, landed = !s || t >= T.land, out = !!s && s.hit === 'out';
  const H0 = s ? groundOf(s.h0) : null, G = !s ? groundOf(mini.h) : !landed || out ? H0 : memo(`c${s.h0}|${s.x}|${s.y}|${cfg.crater}`, () => tankCarve(H0, s.x, s.y, cfg.crater));
  // the blast shakes the field a moment
  const tb = s && !out ? t - T.land : -1, shake = tb >= 0 && tb < TANKV.shake ? (1 - tb / TANKV.shake) * 0.9 * u : 0;
  c.save(); c.clearRect(0, 0, W, H);
  if (shake) c.translate(Math.sin(tb / 17) * shake, Math.cos(tb / 13) * shake * 0.7);
  // the sky, its clouds drifting with the wind, the wind's sign
  const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#7cc6ea'); sky.addColorStop(1, '#e4f5fb'); c.fillStyle = sky; c.fillRect(-8, -8, W + 16, H + 16);
  for (let k = 0; k < 3; k++) { const sp = (0.4 + wind * 0.5) * (0.8 + k * 0.25), span = W + 120, x0 = ((k * 0.37 * span + now / 1000 * sp * u) % span + span) % span - 60; cloud(c, x0, (10 + k * 9 + (k === 1 ? 14 : 0)) * u * 0.9 + 26, (5.5 + k * 1.2) * u, P); }
  // the trails: each player's last shot, dotted; the mover's own the stronger; a shot in flight as far as it has flown
  const dots = (pts, col, alpha, upTo) => { c.save(); c.globalAlpha = alpha; c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = 1; const n = upTo == null ? pts.length : Math.min(pts.length, upTo); for (let k = 0; k < n; k++) { const q = pts[k], yy = Y(q[1]); if (yy < -4) continue; c.beginPath(); c.arc(X(q[0]), yy, Math.max(1.6, 0.5 * u), 0, 7); c.fill(); c.stroke(); } c.restore(); };
  const fl = s ? clamp((t - T.fire) / T.fly) : 1, trail = s ? trailOf(cfg, wind, [s.to, H0[s.to], s.a, s.p, s.n]) : null;
  for (const q of ['X', 'O']) {
    if (s && q === by) { if (t >= T.fire) dots(trail, q === 'O' ? P.O : P.X, 0.95, landed ? null : Math.floor(fl * trail.length)); continue; }
    const sh = mini.sh && mini.sh[q]; if (sh) dots(trailOf(cfg, mini.wind, sh), q === 'O' ? P.O : P.X, !s && src.mine && q === by ? 0.8 : 0.32);
  }
  // the hills: earth, a grass edge with an ink line over it
  const earth = c.createLinearGradient(0, H * 0.3, 0, H); earth.addColorStop(0, '#c08a52'); earth.addColorStop(1, '#8b5a33');
  c.fillStyle = earth; c.beginPath(); edge(c, G, X, Y); c.lineTo(W + 8, H + 8); c.lineTo(-8, H + 8); c.closePath(); c.fill();
  c.save(); c.beginPath(); edge(c, G, X, Y); c.lineTo(W + 8, H + 8); c.lineTo(-8, H + 8); c.closePath(); c.clip();
  c.fillStyle = 'rgba(70,40,18,.2)'; for (let yy = H - 3; yy > H * 0.2; yy -= 9) for (let xx = (Math.round((H - yy) / 9) % 2 ? 2 : 7); xx < W; xx += 11) { c.beginPath(); c.arc(xx, yy, 1.1, 0, 7); c.fill(); }   // (a light halftone in the earth)
  c.lineJoin = 'round'; c.lineCap = 'round'; c.translate(0, 1.1 * u);
  c.strokeStyle = P.ink; c.lineWidth = 2.4 * u + 3; c.beginPath(); edge(c, G, X, Y); c.stroke();
  c.strokeStyle = '#63b043'; c.lineWidth = 2.4 * u; c.beginPath(); edge(c, G, X, Y); c.stroke();
  c.restore();
  c.strokeStyle = P.ink; c.lineWidth = Math.max(1.6, 0.5 * u); c.lineJoin = 'round'; c.beginPath(); edge(c, G, X, Y); c.stroke();
  // the tanks
  const hpNow = q => (s ? (landed ? Math.max(0, s.hp0[ix(q)] - s.dmg[ix(q)]) : s.hp0[ix(q)]) : mini.hp[q]);
  const tank = {};
  for (const q of ['X', 'O']) {
    let x = mini.at[q], ang = restAng(mini, q), kick = 0, gy;
    if (s) {
      x = q === by ? (t < T.drive ? s.from + (s.to - s.from) * (t / T.drive) : s.to) : s.oc;
      if (q === by) { const a0 = s.oc >= s.to ? 30 : 150; ang = src.own ? s.a : a0 + (s.a - a0) * ease((t - T.drive) / (TANKT.aim - 60)); kick = t >= T.fire ? Math.max(0, 1 - (t - T.fire) / TANKV.kick) : 0; }
      const g0 = groundAt(H0, x); gy = landed && !out ? g0 + (groundAt(G, x) - g0) * ease((t - T.land) / TANKV.settle) : g0;
    } else {
      if (src.mine && draft && q === draft.p) { x = draftTo(mini, cfg); ang = draft.a; }
      gy = G[x];
    }
    tank[q] = { x, gy, ang, kick };
    const rumble = s && q === by && t < T.drive ? Math.sin(t / 28) * 0.12 * u : 0;
    drawTank(c, u, P, X(x), Y(gy + TANK.cy) + rumble, tiltAt(s && !landed ? H0 : G, x), q, ang, kick, hpNow(q) <= 0);
    if (hpNow(q) <= 0) { for (let k = 0; k < 3; k++) { const ph = ((now / 1400 + k / 3) % 1), sx = X(x) + Math.sin(ph * 5 + k) * u, sy = Y(gy + TANK.cy + 3 + ph * 9); c.fillStyle = `rgba(60,60,66,${0.5 * (1 - ph)})`; c.beginPath(); c.arc(sx, sy, (1 + ph * 2.2) * u, 0, 7); c.fill(); } }
  }
  // this phone's aim: a dotted guide out of the barrel, as long as the power, a knob at its end
  if (!s && src.mine && draft && !draft.sent) {
    const k = tank[draft.p], rad = draft.a * Math.PI / 180, L = draft.pw / 100 * TANKV.reach, x0 = X(k.x), y0 = Y(k.gy + TANK.cy), col = draft.p === 'O' ? P.O : P.X;
    const ex = x0 + Math.cos(rad) * L * u, ey = y0 - Math.sin(rad) * L * u;
    c.save(); c.strokeStyle = P.ink; c.lineWidth = Math.max(1.6, 0.5 * u); c.setLineDash([0.5 * u, 1.7 * u]); c.lineCap = 'round'; c.globalAlpha = 0.75;
    c.beginPath(); c.moveTo(x0 + Math.cos(rad) * (TANK.len + 1) * u, y0 - Math.sin(rad) * (TANK.len + 1) * u); c.lineTo(ex, ey); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    c.fillStyle = col; c.lineWidth = Math.max(1.6, 0.45 * u); c.beginPath(); c.arc(ex, ey, 1.5 * u, 0, 7); c.fill(); c.stroke(); c.restore();
  }
  let more = !s || t < T.end + 400;
  if (s && t >= T.fire) {
    const k = tank[by], rad = s.a * Math.PI / 180, mx = X(k.x) + Math.cos(rad) * (TANK.len + 0.6) * u, my = Y(k.gy + TANK.cy) - Math.sin(rad) * (TANK.len + 0.6) * u, tm = t - T.fire;
    if (tm < TANKV.muzzle) { const g = tm / TANKV.muzzle; c.save(); c.globalAlpha = 1 - g * g; c.fillStyle = '#ffd23f'; c.strokeStyle = P.ink; c.lineWidth = Math.max(1.2, 0.35 * u); burst(c, mx, my, (1.6 + g * 2.2) * u, 7, 0.5, rad); c.fill(); c.stroke(); c.restore(); }
    // the shell on its way (above the field's top: an arrow at the edge under it)
    if (!landed) {
      const f = fl * (trail.length - 1), i = Math.min(trail.length - 2, Math.floor(f)), q0 = trail[Math.max(0, i)], q1 = trail[Math.min(trail.length - 1, i + 1)], fr = f - i, sx = X(q0[0] + (q1[0] - q0[0]) * fr), sy = Y(q0[1] + (q1[1] - q0[1]) * fr);
      if (sy < -2) { c.fillStyle = P.ink; c.beginPath(); c.moveTo(sx, 3); c.lineTo(sx - 5, 11); c.lineTo(sx + 5, 11); c.closePath(); c.fill(); }
      else { c.fillStyle = P.ink; c.beginPath(); c.arc(sx, sy, Math.max(2.4, 0.85 * u), 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(sx - 0.25 * u, sy - 0.25 * u, Math.max(0.8, 0.28 * u), 0, 7); c.fill(); }
    }
  }
  // the blast: a comic burst, dirt thrown; then each tank's damage rising off it
  if (tb >= 0) {
    const ex = X(s.x), ey = Y(s.y), g = clamp(tb / TANKT.boom), R = Math.max(6, Math.min(16, cfg.blast)) * u;   // (the burst about as wide as the blast reaches)
    if (g < 1) {
      c.save(); c.globalAlpha = g < 0.6 ? 1 : 1 - (g - 0.6) / 0.4; c.lineJoin = 'round'; c.strokeStyle = P.ink; c.lineWidth = Math.max(1.6, 0.5 * u);
      c.fillStyle = '#ffd23f'; burst(c, ex, ey, R * (0.35 + 0.65 * ease(g * 1.8)), 11, 0.6, 0.2); c.fill(); c.stroke();
      c.fillStyle = '#ff8a1f'; burst(c, ex, ey, R * 0.55 * (0.35 + 0.65 * ease(g * 1.8)), 9, 0.58, 0.5); c.fill(); c.stroke();
      c.fillStyle = '#fff'; burst(c, ex, ey, R * 0.22 * (0.35 + 0.65 * ease(g * 1.8)), 7, 0.55, 0.1); c.fill();
      c.restore();
      c.fillStyle = '#8b5a33'; c.strokeStyle = P.ink; c.lineWidth = 1;
      for (let k = 0; k < 9; k++) { const an = Math.PI * (0.14 + 0.72 * (k + 0.5) / 9), v = (9 + (k * 7) % 5 * 2.2) * u, tt = g * 0.9, dxp = Math.cos(an) * v * tt, dyp = -Math.sin(an) * v * tt + 14 * u * tt * tt; c.globalAlpha = 1 - g; c.beginPath(); c.arc(ex + dxp, ey + dyp, (0.5 + (k % 3) * 0.22) * u, 0, 7); c.fill(); c.stroke(); }
      c.globalAlpha = 1;
    }
    const td = tb - 90;
    if (td >= 0 && td < TANKT.dmg) for (const q of ['X', 'O']) {
      const d = s.dmg[ix(q)]; if (!d) continue;
      const k = tank[q], g2 = td / TANKT.dmg, px = Math.max(26, Math.min(W - 26, X(k.x))), py = Y(k.gy + TANK.cy + 7 + 7 * ease(g2));
      c.save(); c.globalAlpha = g2 < 0.75 ? 1 : 1 - (g2 - 0.75) / 0.25; c.font = `400 ${Math.round(Math.max(20, 6.4 * u))}px Bangers, "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineJoin = 'round'; c.strokeStyle = P.ink; c.lineWidth = 5; c.strokeText(`−${d}`, px, py); c.fillStyle = '#fff'; c.fillText(`−${d}`, px, py); c.restore();
    }
  }
  c.restore();
  // the wind's sign (over everything, never shaken): an arrow the way it blows, as long as it is strong, and its number
  const str = Math.abs(wind), dir = wind < 0 ? -1 : 1, fs = Math.round(Math.max(17, 5.4 * u)), aw = str ? Math.max(14, Math.min(46, 10 + str * 3.2)) : 0;
  c.font = `400 ${fs}px Bangers, "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  const num = String(str), tw = c.measureText(num).width, bw = tw + aw + (str ? 30 : 20), bh = fs + 8, bxc = W / 2, byc = bh / 2 + 5;
  c.fillStyle = '#fff8dc'; c.strokeStyle = P.ink; c.lineWidth = 2; c.beginPath(); c.roundRect(bxc - bw / 2, byc - bh / 2, bw, bh, 6); c.fill(); c.stroke();
  if (str) {
    const ax0 = dir > 0 ? bxc - bw / 2 + 8 : bxc + bw / 2 - 8 - aw - 6;
    c.strokeStyle = '#2f6fb3'; c.fillStyle = '#2f6fb3'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax0 + (dir > 0 ? 0 : 6), byc); c.lineTo(ax0 + aw + (dir > 0 ? 0 : 6), byc); c.stroke();
    const tip = dir > 0 ? ax0 + aw + 6 : ax0; c.beginPath(); c.moveTo(tip, byc); c.lineTo(tip - dir * 9, byc - 7); c.lineTo(tip - dir * 9, byc + 7); c.closePath(); c.fill();
  }
  c.fillStyle = P.ink; c.fillText(num, str ? (dir > 0 ? bxc + bw / 2 - 9 - tw / 2 : bxc - bw / 2 + 9 + tw / 2) : bxc, byc + 1);
  return more;
});

// ---- the view's hooks ----
const ARW = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON = { l: ARW('M15 5l-7 7 7 7'), r: ARW('M9 5l7 7-7 7'), m: ARW('M6 12h12'), p: ARW('M6 12h12M12 6v12') };
// The move's words: what the blast did, in the reserved line.
export function tankWords(l) {
  const o = ix(other(l.by)), me = ix(l.by);
  if (l.dmg[o] > 0) return [l.hit === other(l.by) ? 'ok' : 'near', `${l.hit === other(l.by) ? 'Direct hit!' : 'Close!'} −${l.dmg[o]}`];
  if (l.dmg[me] > 0) return ['no', `Too close to home! −${l.dmg[me]}`];
  return ['no', l.hit === 'out' ? 'Off the field' : 'Missed'];
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = tankCfg(mini), s = a && a.tk ? a.tk : null, o = { view, locked, turn }, rest = !s && (view || d) && mini.last ? mini.last : null, l = s || rest;
  const by = s ? a.by : rest ? rest.by : turn, mine = !view && !locked && !s && !d, T = s ? tankTimes(s) : null;
  if (draft && draft.sent && (s || performance.now() - draft.sent > TANKV.stuck)) draft = s ? null : Object.assign(draft, { sent: 0 });
  if (mine && !(draft && draft.sq === state.zoom && draft.p === turn && draft.n === mini.n[turn])) {
    const sh = mini.sh && mini.sh[turn];
    draft = { sq: state.zoom, p: turn, n: mini.n[turn], d: 0, a: sh ? sh[2] : mini.at[other(turn)] >= mini.at[turn] ? 55 : 125, pw: sh ? sh[3] : 60, sent: 0 };
  }
  const tal = p => {
    const now = mini.hp[p], was = s ? s.hp0[ix(p)] : now, to = s ? Math.max(0, was - s.dmg[ix(p)]) : now, moved = was !== to;
    return arcTally(p, o, `<span class="wtal">${gaugeBar({ goal: c.health, now: to, was, at: T ? T.land : 0, ms: 420 })}<span class="npts tkhp" aria-label="Health ${to} of ${c.health}">${moved ? `<b class="cnt" data-from="${was}" data-delay="${Math.round(T.land)}">${to}</b>` : `<b>${to}</b>`}</span></span>`);
  };
  const w = l ? tankWords(l) : null;
  const line = l ? `<p ${s ? lateAt('tkline ' + w[0], T.land) : `class="tkline ${w[0]}"`} role="status">${w[1]}</p>` : '<p class="tkline"></p>';
  src = { mini, a: s ? a : null, by, mine, own: !!s && ownMove(a), zoom: state.zoom };   // (own: the barrel is already where this phone aimed it)
  let ctl = '';
  if (!view) {
    const on = mine && draft && !draft.sent, dr = on ? draft : null, H = on ? groundOf(mini.h) : null, to = on ? draftTo(mini, c) : 0, used = on ? Math.abs(to - mini.at[turn]) : 0;
    const can = by2 => on && Math.abs(dr.d + by2) <= c.fuel && tankDrive(H, c, mini.at[turn], dr.d + by2, mini.at[other(turn)]) !== to;
    const btn = (act, icon, label, ok, cls) => `<button class="btn tkb${cls ? ' ' + cls : ''}" data-act="${act}" aria-label="${label}"${ok ? '' : ' disabled'}>${icon}</button>`;
    const fuel = `<span class="tkfuel" aria-label="Fuel: ${c.fuel - used} of ${c.fuel}">${Array.from({ length: Math.min(12, c.fuel) }, (_, k) => `<i class="${k < c.fuel - used ? 'on' : ''}"></i>`).join('')}</span>`;
    const ang = dr ? dr.a : restAng(mini, turn), pw = dr ? dr.pw : (mini.sh && mini.sh[turn] ? mini.sh[turn][3] : 60);
    ctl = `<div class="tkrow"><span class="tkset tkang" aria-label="Angle">${btn('tanks-am', ICON.m, 'Lower the barrel', on, 'tkstep')}<b>${ang <= 90 ? ang : 180 - ang}°</b>${btn('tanks-ap', ICON.p, 'Raise the barrel', on, 'tkstep')}</span><span class="tkset tkpow" aria-label="Power">${btn('tanks-pm', ICON.m, 'Less power', on, 'tkstep')}<span class="tkbar"><i style="--w:${pw}%"></i><b>${pw}</b></span>${btn('tanks-pp', ICON.p, 'More power', on, 'tkstep')}</span></div>`
      + `<div class="tkrow"><span class="tkset tkdrv" aria-label="Drive">${btn('tanks-l', ICON.l, 'Drive left', can(-1))}${fuel}${btn('tanks-r', ICON.r, 'Drive right', can(1))}</span><button class="big ${turn} tkfire" data-act="tanks-fire"${on ? '' : ' disabled'}>Fire!</button></div>`;
  }
  go();
  const wd = mini.wind;
  return `<div class="g-tk pc-${by}"><div class="ctals two">${tal('X')}${tal('O')}</div><div class="tkbox"><div class="tkfield${mine && draft && !draft.sent ? ' live' : ''}"><canvas class="tkcv" aria-label="The field: wind ${Math.abs(wd)}${wd ? (wd > 0 ? ' to the right' : ' to the left') : ''}; X's tank on column ${mini.at.X}, O's on column ${mini.at.O}"></canvas></div></div>${line}${ctl}</div>`;
}
export function heldSub(mini, turn, f, a) { return !f && mini.last && mini.last.by === turn && mini.last.hit === other(turn) && goAgain(mini) ? `<b class="${turn}">${N(turn)}</b>: a direct hit, fire again` : ''; }
// The miniature: the hills' outline with the two tanks on them, beside each one's health as a bar.
export function miniature(mini, final) {
  const H = tankHeights(mini.h), c = tankCfg(mini), y = v => (55 - v * 0.8).toFixed(1), x = i => (2 + i * 0.566).toFixed(1);
  let d = `M2 ${y(H[0])}`; for (let i = 2; i < H.length; i += 2) d += `L${x(i)} ${y(H[i])}`; d += `L58 ${y(H[H.length - 1])}V58H2Z`;
  const tk = p => { const cx = 2 + mini.at[p] * 0.566, gy = 55 - H[mini.at[p]] * 0.8, r = mini.at[other(p)] >= mini.at[p] ? 1 : -1; return `<g class="ttkt ${p}${mini.hp[p] > 0 ? '' : ' out'}" transform="translate(${cx.toFixed(1)} ${gy.toFixed(1)})"><path class="ttkg" d="M0 -6.500L${7 * r} -12.500"/><path d="M-6.500 0v-3.500l2-3.500h9l2 3.500v3.500z"/></g>`; };
  const art = `<svg class="ttk" viewBox="0 0 60 60"><rect class="ttks" x="2" y="2" width="56" height="56" rx="5"/><path class="ttkh" d="${d}"/>${tk('X')}${tk('O')}</svg>`;
  return thumbArt(art, barRows(mini.hp, c.health), 'ttkw', `Tank Duel: X's health ${mini.hp.X}, O's ${mini.hp.O} of ${c.health}`);
}
export function moveText(f, who) {
  const l = f.tk; if (!l) return `${who} fired`;
  const o = ix(other(f.by));
  return l.hit === other(f.by) ? `${who} scored a direct hit` : l.dmg[o] > 0 ? `${who}'s blast caught the other tank` : l.dmg[ix(f.by)] > 0 ? `${who}'s blast caught their own tank` : `${who} missed`;
}
// The tracks' rumble a column driven, the gun, the shell's whistle as it comes down, then the blast (a clang with it
// on a direct hit), or a far whoosh as it leaves the field.
export function sounds(f, add, won, mini, last) {
  const l = f.tk; if (!l) return;
  const T = tankTimes(l), n = Math.abs(l.to - l.from);
  for (let k = 0; k < n; k++) add('tnTrack', k * TANKT.col, 0.95 + (k % 2) * 0.08);
  add('tnFire', T.fire, 0.9 + l.p / 500);
  if (T.fly > 900) add('tnWhistle', T.land - 520);
  if (l.hit === 'out') { add('tnOut', T.land); return; }
  if (l.hit === 'X' || l.hit === 'O') add('tnHit', T.land);
  add('tnBoom', T.land, l.dmg[0] + l.dmg[1] > 0 ? 1 : 1.15);
}
