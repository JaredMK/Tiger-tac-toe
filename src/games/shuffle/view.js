// Shuffleboard: the screen, the miniature, the move's words and sounds, and this phone's flick.
// The lane is a canvas seen from above: polished wood between two gutters, its three zones at the far end with their
// points, the mover's puck waiting below the launch line. A flick up the lane slides it (ui/flick.js): it leaves at
// once along its aim and, as the move comes back, runs on to where it stopped (rules.js: each puck's slide a segment
// with its own times; on a shared lane a struck puck goes on from the touch). A puck over the end or a side drops away.
import { tune } from '../../core/tune.js';
import { SHUF, shufAim, shufAt, shufCfg, shufEnd } from './rules.js';
import { flickMove } from '../shared/flick.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { state } from '../../ui/app.js';
import { flickPad } from '../../ui/flick.js';
import { fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { lateAt } from '../../ui/progress.js';
import { runColours } from '../../ui/runner.js';
import { stage } from '../../ui/stage.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows, ptsTally } from '../../ui/tok.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // the move is the flick: played from the flash
let src = null, pend = null;
const VIEW = { x0: -5, w: 60, y0: -15, h: 122 };                   // the lane's surroundings on the canvas (lane units)
const hook = flickPad('.sbfield.live', fl => {
  const sq = state.squares && state.squares[state.zoom], mini = sq && sq.mini;
  if (!mini || mini.type !== 'shuffle' || !src || !src.mine || state.flash || state.done || blocked()) return;
  const m = flickMove(fl.ang, fl.v, tune(mini));
  pend = { sq: state.zoom, m, t0: performance.now() };
  ownPress(); SND.play('mbFlick', { rate: 0.8 + m.p * 0.3 }); haptic('tap');
  attemptMove(m); go();
});
const ZCOL = ['#8fd3f4', '#ffd166', '#ff8a65'];
function puck(c, u, X, Y, x, y, col, P, k) {                       // k: 1 on the lane .. 0 gone (dropping away)
  const r = SHUF.r * u * (0.5 + 0.5 * k);
  c.save(); c.globalAlpha = Math.max(0, k);
  c.fillStyle = 'rgba(22,18,16,.25)'; c.beginPath(); c.arc(X(x) + 0.5 * u, Y(y) + 0.8 * u, r, 0, 7); c.fill();
  c.fillStyle = col; c.strokeStyle = P.ink; c.lineWidth = 0.7 * u; c.beginPath(); c.arc(X(x), Y(y), r, 0, 7); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 0.6 * u; c.beginPath(); c.arc(X(x), Y(y), r * 0.55, 0, 7); c.stroke();
  c.restore();
}
const go = stage('canvas.sbcv', (c, W, H, now) => {
  if (!src) return false;
  const { mini, a, by } = src, P = runColours(), u = W / VIEW.w, cfg = shufCfg(mini), X = x => (x - VIEW.x0) * u, Y = y => (VIEW.y0 + VIEW.h - 2 - y) * u, col = q => (q === 'O' ? P.O : P.X);
  c.clearRect(0, 0, W, H); c.fillStyle = '#3b4a5a'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#20262e'; c.fillRect(X(-4), Y(SHUF.len), 4 * u, Y(VIEW.y0) - Y(SHUF.len)); c.fillRect(X(SHUF.w), Y(SHUF.len), 4 * u, Y(VIEW.y0) - Y(SHUF.len));
  const g = c.createLinearGradient(X(0), 0, X(SHUF.w), 0); g.addColorStop(0, '#e2b06a'); g.addColorStop(0.5, '#f0c785'); g.addColorStop(1, '#dca85f'); c.fillStyle = g; c.fillRect(X(0), Y(SHUF.len), SHUF.w * u, Y(VIEW.y0) - Y(SHUF.len));
  for (let z = 0; z < 3; z++) {
    const lo = cfg.z0 + z * cfg.zl, hi = z === 2 ? SHUF.len : lo + cfg.zl;
    c.globalAlpha = 0.55; c.fillStyle = ZCOL[z]; c.fillRect(X(0), Y(hi), SHUF.w * u, Y(lo) - Y(hi)); c.globalAlpha = 1;
    c.strokeStyle = P.ink; c.lineWidth = 0.6 * u; c.beginPath(); c.moveTo(X(0), Y(lo)); c.lineTo(X(SHUF.w), Y(lo)); c.stroke();
    c.font = `400 ${Math.round(Math.max(13, Math.min(cfg.zl * 0.8, 9) * u))}px Bangers, "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(22,18,16,.55)'; c.fillText(String(cfg.vals[z]), X(6), Y((lo + hi) / 2) + 0.5 * u); c.fillText(String(cfg.vals[z]), X(SHUF.w - 6), Y((lo + hi) / 2) + 0.5 * u);
  }
  c.strokeStyle = P.ink; c.lineWidth = 0.9 * u; c.strokeRect(X(0), Y(SHUF.len), SHUF.w * u, Y(VIEW.y0) - Y(SHUF.len) + 4 * u);
  c.setLineDash([2 * u, 2 * u]); c.lineWidth = 0.6 * u; c.strokeStyle = 'rgba(22,18,16,.4)'; c.beginPath(); c.moveTo(X(0), Y(0)); c.lineTo(X(SHUF.w), Y(0)); c.stroke(); c.setLineDash([]);
  const s = a ? a.sb : null, at = s ? (src.own && pend && pend.sq === src.zoom ? pend.t0 : fxAt('move', a)) : null, t = s ? (at == null ? Infinity : now - at) : 0;
  let more = false;
  if (s && t < shufEnd(s) + 500) {                               // a flick playing: the lane as it was, each puck along its slide
    const drop = seg => (seg.out && t > seg.t1 ? Math.max(0, 1 - (t - seg.t1) / 260) : 1);
    s.was.forEach((q, i) => { const segs = s.segs.filter(g2 => g2.id === i), seg = segs[0]; if (!seg || t < seg.t0) puck(c, u, X, Y, q.x, q.y, col(q.by), P, 1); else { const e = shufAt(seg, t); puck(c, u, X, Y, seg.x0 + (seg.x1 - seg.x0) * e, seg.y0 + (seg.y1 - seg.y0) * e, col(q.by), P, drop(seg)); } });
    const m0 = s.segs[0], e0 = shufAt(m0, t); puck(c, u, X, Y, m0.x0 + (m0.x1 - m0.x0) * e0, -7 * (1 - Math.min(1, e0 * 12)) + m0.y0 + (m0.y1 - m0.y0) * e0, col(s.by), P, drop(m0));
    more = true;
  } else {
    if (mini.shared) mini.pucks.forEach(q => puck(c, u, X, Y, q.x, q.y, col(q.by), P, 1));
    else if (src.rest && !src.rest.out) puck(c, u, X, Y, src.rest.segs[0].x1, src.rest.segs[0].y1, col(src.rest.by), P, 1);
    if (pend && pend.sq === src.zoom && !s) { const [ax, ay] = shufAim(cfg, pend.m), e = Math.min(0.85, 1 - (1 - Math.min(1, (now - pend.t0) / SHUF.slide)) ** 2); puck(c, u, X, Y, SHUF.w / 2 + (ax - SHUF.w / 2) * e, -7 + (ay + 7) * e, col(by), P, 1); more = now - pend.t0 < 6000; }
    else if (src.mine) puck(c, u, X, Y, SHUF.w / 2, -7, col(by), P, 1);
  }
  return more;
});
const words = l => (l.pts > 0 ? `+${l.pts}!` : l.out === 'end' ? 'Off the end' : l.out === 'side' ? 'In the gutter' : 'Too short') + (l.segs.length > 1 ? ' Knock!' : '');
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  const c = shufCfg(mini), s = a && a.sb ? a.sb : null, own = !!s && ownMove(a), o = { view, locked, turn }, rest = !s && (view || d) && mini.last ? mini.last : null, l = s || rest;
  const by = s ? a.by : rest ? rest.by : turn, mine = !view && !locked && !s && !d, end = s ? shufEnd(s) : 0;
  if (pend && (s || pend.sq !== state.zoom) && !(s && own)) pend = null;
  const tal = p => ptsTally(p, o, c.target, mini.score[p], s ? s.from[p] : null, end);
  const line = s ? `<p ${lateAt('sbline ' + (s.pts > 0 ? 'ok' : 'no'), end)} role="status">${words(s)}</p>` : `<p class="sbline${l ? (l.pts > 0 ? ' ok' : ' no') : ''}">${l ? words(l) : ''}</p>`;
  src = { mini, a: s ? a : null, by, own, mine, zoom: state.zoom, rest };
  if (s && own) setTimeout(() => { if (pend && state.flash !== a) pend = null; }, 0);
  go();
  return `<div class="g-sb pc-${by}"><div class="ctals two">${tal('X')}${tal('O')}</div><div class="sbbox"><div class="sbfield${mine ? ' live' : ''}"><canvas class="sbcv" aria-label="The lane: zones worth ${c.vals.join(', ')}"></canvas></div></div>${line}</div>`;
}
// The miniature: the lane with its three zones and the pucks on it (the last one, with a lane each), beside each player's points as a bar.
export function miniature(mini, final) {
  const c = shufCfg(mini), l = mini.last, pk = mini.shared ? mini.pucks : l && !l.out ? [{ by: l.by, x: l.segs[0].x1, y: l.segs[0].y1 }] : [];
  const Y = y => 118 - y * 1.12, zone = z => { const lo = c.z0 + z * c.zl, hi = z === 2 ? SHUF.len : lo + c.zl; return `<rect class="tsbz z${z}" x="3" y="${Y(hi).toFixed(1)}" width="50" height="${(Y(lo) - Y(hi)).toFixed(1)}"/>`; };
  const art = `<svg class="tsb" viewBox="0 0 56 124"><rect class="tsbl" x="3" y="3" width="50" height="118" rx="3"/>${zone(0)}${zone(1)}${zone(2)}<rect class="tsbo" x="3" y="3" width="50" height="118" rx="3"/>${pk.map(q => `<circle class="tsbp ${q.by}" cx="${(3 + q.x).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="5.500"/>`).join('')}</svg>`;
  return thumbArt(art, barRows(mini.score, c.target), 'tsbw', `Shuffleboard: X ${mini.score.X}, O ${mini.score.O} of ${c.target} points`);
}
export function moveText(f, who) { const s = f.sb; return !s ? `${who} flicked` : s.pts > 0 ? `${who} scored ${s.pts}` : `${who} scored nothing`; }
// The flick (someone else's), the puck's slide, a clack at each puck it or another strikes, then where it ends: a soft
// knock and a chime in a zone, a thud over the end or a side, the knock alone short of the zones.
export function sounds(f, add, won, mini, last) {
  const s = f.sb; if (!s) return;
  if (!ownMove(f)) add('mbFlick', 0, 0.8 + s.p * 0.3);
  add('sbSlide', 30);
  s.segs.forEach((g, k) => { if (g.hit) add('sbClack', g.t1); if (g.out) add('thud', g.t1 + 120); else if (!g.hit) add('mbStop', g.t1); });
  if (s.pts > 0) add('ding', shufEnd(s));
}
