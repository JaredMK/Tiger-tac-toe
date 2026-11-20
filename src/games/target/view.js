// Target Practice: the screen, the miniature, the move's words and sounds, and this phone's three taps.
// The field is a canvas: a board with the mover's targets (rings round a spot in the mover's colour; one knocked out
// is a splintered ring). This phone's throw: a line sweeps across and a tap stops it, a second line sweeps up and
// down from that moment and a tap stops it, then a circle about their crossing shrinks and grows and a tap stops it
// (the clocks are real time whatever the Animation setting; a tap anywhere on the field or the Stop button). The
// throw goes in with the third tap; the dart flies in from below and sticks where the server drew it inside the
// circle: a burst for a hit, a puff for a miss. Someone else's throw shows their three stops first, each run straight
// to where it was made (TARGET.ax, .ay, .ac), then the dart.
import { TARGET, targetCfg, targetLine, targetMs, targetRing } from './rules.js';
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
export const replay = { synth: () => [] };                         // the move is its three stops: shown from the flash
let aim = null;                                                    // this phone's throw under way: { sq, p, n, phase 0-3, t0, x, y, r }
let src = null, hooked = false, skipped = null;
const r1 = v => Math.round(v * 10) / 10;
function stop() {
  const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini;
  if (!aim || !m || m.type !== 'target' || aim.sq !== state.zoom || aim.phase > 2 || state.flash || state.done || blocked() || !src || !src.mine) return false;
  const c = targetCfg(m), now = performance.now(), t = now - aim.t0;
  const ph = aim.phase;
  SND.play('tpTick', { rate: 1.12 + ph * 0.12 }); haptic('tap');
  if (ph === 0) { aim.x = r1(targetLine(c, t)); aim.phase = 1; aim.t0 = now; }
  else if (ph === 1) { aim.y = r1(targetLine(c, t)); aim.phase = 2; aim.t0 = now; }
  else { const mv = { x: aim.x, y: aim.y, r: r1(targetRing(c, t)) }; aim.r = mv.r; aim.phase = 3; attemptMove(mv); }   // (the move may redraw the screen at once and drop the aim: nothing of it is read after)
  go();
  return true;
}
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  app.addEventListener('pointerdown', e => {
    if (state.screen !== 'mini' || !runInputAt(e.target) || !(e.target.closest && e.target.closest('.tpfield.live'))) return;
    if (stop()) { e.preventDefault(); ownPress(); }
  }, { passive: false });
}
export const actions = { 'tp-stop': () => { ownPress(); stop(); } };

// ---- the drawing ----
const ease = u => (u <= 0 ? 0 : u >= 1 ? 1 : 1 - (1 - u) * (1 - u));
function drawTarget(c, u, t, size, col, P, state2) {              // state2: 'on', 'off', or a number 0..1 (just knocked out: its burst)
  const x = t.x * u, y = t.y * u, R = size * u;
  if (state2 === 'off' || typeof state2 === 'number') {
    c.save(); c.setLineDash([u * 2, u * 1.6]); c.strokeStyle = 'rgba(22,18,16,.35)'; c.lineWidth = u * 0.7; c.beginPath(); c.arc(x, y, R * 0.92, 0, 7); c.stroke(); c.restore();
    if (typeof state2 === 'number' && state2 < 1) { c.save(); c.translate(x, y); c.globalAlpha = 1 - state2 * 0.8; c.fillStyle = '#ffd23f'; c.strokeStyle = P.ink; c.lineWidth = u * 0.5; c.beginPath(); for (let k = 0; k < 18; k++) { const rr = (k % 2 ? 0.55 : 1.25) * R * (0.5 + state2 * 0.7), an = k * Math.PI / 9; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.stroke(); c.restore(); }
    return;
  }
  c.fillStyle = 'rgba(22,18,16,.18)'; c.beginPath(); c.arc(x + u * 0.8, y + u * 1.1, R, 0, 7); c.fill();
  [[1, '#fff'], [0.68, '#3a3a4a'], [0.4, '#fff'], [0.18, col]].forEach(([k, fill]) => { c.fillStyle = fill; c.strokeStyle = P.ink; c.lineWidth = u * 0.6; c.beginPath(); c.arc(x, y, R * k, 0, 7); c.fill(); c.stroke(); });
}
function drawDart(c, u, x, y, col, P, k) {                        // k: 0 in the hand (large, low) .. 1 stuck in the board
  const s = (2.6 - 1.6 * k) * u;
  c.save(); c.translate(x * u, y * u);
  c.fillStyle = 'rgba(22,18,16,.25)'; c.beginPath(); c.ellipse(s * 0.5, s * 0.7, s * 1.1, s * 0.45, 0, 0, 7); c.fill();
  c.rotate(-0.7); c.strokeStyle = P.ink; c.lineWidth = u * 0.5; c.lineJoin = 'round';
  c.fillStyle = '#c9c9d4'; c.beginPath(); c.moveTo(0, 0); c.lineTo(s * 0.5, -s * 0.28); c.lineTo(s * 2.2, -s * 0.28); c.lineTo(s * 2.2, s * 0.28); c.lineTo(s * 0.5, s * 0.28); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(s * 2.2, 0); c.lineTo(s * 3.4, -s * 0.9); c.lineTo(s * 3.9, -s * 0.9); c.lineTo(s * 3.2, 0); c.lineTo(s * 3.9, s * 0.9); c.lineTo(s * 3.4, s * 0.9); c.closePath(); c.fill(); c.stroke();
  c.restore();
}
const go = stage('canvas.tpcv', (c, W, H, now) => {
  if (!src) return false;
  const { mini, a, by } = src, P = runColours(), u = W / 100, cfg = targetCfg(mini), col = by === 'O' ? P.O : P.X, tg = mini.tg[by];
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#e7d3ae'; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(22,18,16,.07)'; c.lineWidth = Math.max(1, u * 0.35); for (let k = 1; k < 6; k++) { c.beginPath(); c.moveTo(0, k * H / 6 + (k % 2) * u); c.lineTo(W, k * H / 6 - (k % 2) * u); c.stroke(); }
  const s = a ? a.tp : null, at = s ? fxAt('move', a) : null, own = !!(s && src.own), pre = TARGET.ax + TARGET.ay + TARGET.ac;
  const t = s ? (at == null ? Infinity : now - at) + (own ? pre : 0) : 0, land = pre + TARGET.fly;
  tg.forEach((q, i) => drawTarget(c, u, q, mini.tsize, col, P, q.on ? 'on' : s && s.hit === i ? (t < land ? 'on' : Math.min(1, (t - land) / 420)) : 'off'));
  const line = (x0, y0, x1, y1, w, dash) => { c.save(); c.strokeStyle = P.ink; c.lineWidth = w * u; if (dash) c.setLineDash([u * 2, u * 1.6]); c.beginPath(); c.moveTo(x0 * u, y0 * u); c.lineTo(x1 * u, y1 * u); c.stroke(); c.restore(); };
  const ring = (x, y, r, w) => { c.save(); c.fillStyle = by === 'O' ? 'rgba(246,194,27,.22)' : 'rgba(229,67,42,.18)'; c.strokeStyle = P.ink; c.lineWidth = w * u; c.beginPath(); c.arc(x * u, y * u, Math.max(0.5, r) * u, 0, 7); c.fill(); c.stroke(); c.restore(); };
  let more = false;
  if (s) {                                                        // a throw playing: its stops (someone else's), then the dart
    const fade = t < land ? 1 : Math.max(0, 1 - (t - land) / 300);
    c.save(); c.globalAlpha = fade;
    if (fade > 0) {
      const x = own ? s.x : TARGET.lo + (s.x - TARGET.lo) * ease(t / TARGET.ax), y = own ? s.y : TARGET.lo + (s.y - TARGET.lo) * ease((t - TARGET.ax) / TARGET.ay), r = own ? s.r : cfg.rmax + (s.r - cfg.rmax) * ease((t - TARGET.ax - TARGET.ay) / TARGET.ac);
      line(x, 0, x, 100, 0.7, t >= TARGET.ax); if (t >= TARGET.ax) line(0, y, 100, y, 0.7, t >= TARGET.ax + TARGET.ay); if (t >= TARGET.ax + TARGET.ay) ring(s.x, s.y, r, 0.8);
    }
    c.restore();
    if (t >= pre) { const k = ease((t - pre) / TARGET.fly); drawDart(c, u, 50 + (s.lx - 50) * k, 104 + (s.ly - 104) * k - Math.sin(k * Math.PI) * 10, col, P, k); }
    if (t >= land && s.hit < 0 && t < land + 320) { const k2 = (t - land) / 320; c.save(); c.globalAlpha = 1 - k2; c.strokeStyle = P.ink; c.lineWidth = u * 0.6; c.beginPath(); c.arc(s.lx * u, s.ly * u, (2 + k2 * 5) * u, 0, 7); c.stroke(); c.restore(); }
    more = t < land + 450;
  } else if (aim && src.mine && aim.sq === src.zoom) {            // this phone's aim
    const tt = now - aim.t0;
    if (aim.phase === 0) line(targetLine(cfg, tt), 0, targetLine(cfg, tt), 100, 0.9);
    else { line(aim.x, 0, aim.x, 100, 0.7, true); if (aim.phase === 1) line(0, targetLine(cfg, tt), 100, targetLine(cfg, tt), 0.9); else { line(0, aim.y, 100, aim.y, 0.7, true); ring(aim.x, aim.y, aim.phase === 2 ? targetRing(cfg, tt) : aim.r, 0.9); } }
    more = true;
  } else if (src.rest && src.rest.by === by) drawDart(c, u, src.rest.lx, src.rest.ly, col, P, 1);   // at rest: the last dart where it stuck
  return more;
});

// ---- the view's hooks ----
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = targetCfg(mini), s = a && a.tp ? a.tp : null, own = !!s && ownMove(a), o = { view, locked, turn }, n = mini.tg.X.length;
  const by = s ? a.by : (view || d) && mini.last ? mini.last.by : turn, mine = !view && !locked && !s && !d;
  if (mine && !(aim && aim.sq === state.zoom && aim.p === turn && aim.n === mini.n[turn])) aim = { sq: state.zoom, p: turn, n: mini.n[turn], phase: 0, t0: performance.now() };
  if (!mine && aim && s) aim = null;
  // A throw made here was aimed here: its flash starts at the dart and ends with it (the stops are not played again).
  if (s && own && skipped !== a && flashAnimating()) { skipped = a; setTimeout(() => { if (state.flash === a) skipFlash(); }, TARGET.fly + 480); }
  const land = (own ? 0 : targetMs() - TARGET.fly) + TARGET.fly;
  const tal = p => arcTally(p, o, pips(p, mini.hits[p], n, !!(s && s.hit >= 0 && a.by === p), land));
  const l = s || ((view || d) && mini.last ? mini.last : null);
  const line = l ? `<p ${s ? lateAt('tpline ' + (l.hit >= 0 ? 'ok' : 'no'), land) : `class="tpline ${l.hit >= 0 ? 'ok' : 'no'}"`} role="status">${l.hit >= 0 ? 'Hit!' : 'Missed'}</p>` : '<p class="tpline"></p>';
  src = { mini, a: s ? a : null, by, own, mine, zoom: state.zoom, rest: !s && l ? l : null };
  const btn = view ? '' : `<button class="big ${turn} tpbtn" data-act="tp-stop"${mine && (!aim || aim.phase < 3) ? '' : ' disabled'}>Stop</button>`;
  go();
  return `<div class="g-tp pc-${by}"><div class="ctals${n > 4 ? ' two' : ''}">${tal('X')}${tal('O')}</div><div class="tpbox"><div class="tpfield${mine ? ' live' : ''}"><canvas class="tpcv" aria-label="The targets: ${mini.tg[by].filter(q => q.on).length} standing"></canvas></div></div>${line}${btn}</div>`;
}
// The miniature: a target with a dart in it, beside each player's targets knocked out as pips.
export function miniature(mini, final) {
  const n = mini.tg.X.length;
  const art = '<svg class="ttp" viewBox="0 0 60 60"><circle class="ttpa" cx="28" cy="32" r="24"/><circle class="ttpb" cx="28" cy="32" r="16"/><circle class="ttpa" cx="28" cy="32" r="9"/><circle class="ttpc" cx="28" cy="32" r="3.600"/><path class="ttpd" d="M30 30 48 12"/><path class="ttpf" d="M45 9l6 0 0 6-4 0z"/></svg>';
  return thumbArt(art, pipRows(mini.hits, n), 'ttpw', `Target Practice: X ${mini.hits.X}, O ${mini.hits.O} of ${n} targets`);
}
export function moveText(f, who) { const l = f.tp; return l && l.hit >= 0 ? `${who} hit a target` : `${who} missed`; }
// Someone else's throw: a tick at each of their three stops, then the dart's whoosh and where it lands: a crack and a
// chime for a hit, a thud for a miss. A throw made here had its ticks as it was aimed.
export function sounds(f, add, won, mini, last) {
  const l = f.tp; if (!l) return;
  const own = ownMove(f), pre = own ? 0 : TARGET.ax + TARGET.ay + TARGET.ac;
  if (!own) { add('tpTick', TARGET.ax, 1.12); add('tpTick', TARGET.ax + TARGET.ay, 1.24); add('tpTick', pre, 1.36); }
  add('tpThrow', pre);
  if (l.hit >= 0) { add('tpHit', pre + TARGET.fly); add('ding', pre + TARGET.fly + 90); } else add('thud', pre + TARGET.fly);
}
