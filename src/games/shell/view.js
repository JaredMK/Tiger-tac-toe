// Shell Game: the screen, the miniature, the move's words and sounds, and the inputs.
// The cups are drawn on a canvas at 60 fps from the round's own clock (rules.js shellAt: where every cup is at a
// moment of the round), never from a render: this phone's own round from the moment of Start in real time (the Normal
// | Speed setting never touches the shuffle: it is the challenge), someone else's from the move's event (ui/fx.js
// fxAt('move')), a result as it stands. The table is seen from a little above: a cup swinging round the back of a
// swap is drawn higher up the table and one round the front lower down, so the one behind always shows over the one
// in front (rules.js SHELL.arc: most of a cup's height apart where two cross) and no cup is ever hidden.
// A round: the ball's cup lifts (the ball on show), comes down over it, a beat, the swaps (each cup leaning into its
// slide, a streak behind a fast one, a little squash as it lands), the cups settle; then a cup is tapped (each cup's
// place is a button over the canvas). The pick: a ring in the picker's colour, the cup trembling for a beat
// (SHELL.tense), then it lifts: the ball on a comic burst, or nothing, and the ball's own cup lifts to show where it was.
import { ATT } from '../shared/attention.js';
import { SHELL, shellArc, shellAt, shellEase, shellLift, shellOk, shellPlan } from './rules.js';
import { attGoal } from '../shared/attention.js';
import { REDUCED, app, mv, state } from '../../ui/app.js';
import { ATT_T, attStartAct, attTable } from '../../ui/attention.js';
import { fxAt } from '../../ui/fx.js';
import { qPick } from '../../ui/quiz.js';
import { runCanvas, runColours } from '../../ui/runner.js';
import { thumbArt } from '../../ui/thumbs.js';
export { attentionSounds as sounds, attentionWonAt as wonAt } from '../../ui/attention.js';

// The picture's own figures: the cups' blue (the table's, never a player's colour), the ball, the mat; a cup's shape
// (its height to its width, how far it lifts and tips, how much it leans and squashes); the moments after the verdict
// (the ball's own cup lifting after a wrong pick, the burst's pop).
export const SHELLV = { cup: '#3b87c7', cupDark: '#2c6aa0', band: '#fffaf0', ball: '#3fb950', mat: '#f3e3bd', matEdge: '#d9c493', burst: '#ffd84a', tall: 1.12, wide: 0.84, lift: 0.74, tip: 0.13, lean: 0.009, squash: 0.07, other: 360, pop: 620 };
// Where things are on a canvas of W by H for n cups: S the distance between two places, cw and ch a cup's size, y0
// the row's base line, x(place). The size leaves room for the furthest arc both ways (the size is the same whatever
// the level allows, so nothing changes size between the cups at rest and the shuffle).
export function shellGeom(W, H, n) {
  const S = W / (n + 0.6), arc = shellArc(Math.max(1, Math.min(SHELL.span, n - 1))), up = Math.max(arc, SHELLV.lift + 0.05);
  const ch = Math.min(S * SHELLV.wide * SHELLV.tall, (H - 10) / (1 + up + arc + 0.12)), cw = ch / SHELLV.tall;
  const y0 = (H - ch * (1 + up + arc)) / 2 + ch * (1 + up);
  return { S, cw, ch, y0, x: p => S * (0.8 + p) };
}

let src = null, raf = 0;
function schedulePaint() { if (typeof requestAnimationFrame !== 'function') return; if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(shellPaint); }
// After every render of the square (and every frame while a round or a result plays): the table as it is now.
export function shellPaint(now) {
  raf = 0;
  const cv = app.querySelector('canvas[data-shell="cv"]');
  if (!cv || !src || typeof cv.getContext !== 'function') return;
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return;
  if (shellFrame(c, W, H, now)) raf = requestAnimationFrame(shellPaint);
}
// What the table shows at this moment (pure: the tests read it): { cups: [{ x, z, v, u, lift, rot }] by cup, ball:
// { cup, show }, pick: { cup, ring }, burst (0 to 1, or null), more }.
//   s: { r, n, mode, t (the round's time, ms), tm (the move's time), pre, T, pick, correct }
export function shellScene(s) {
  const n = s.n, r = s.r, still = Array.from({ length: n }, (_, i) => ({ x: i, z: 0, v: 0, u: 0, lift: 0, rot: 0 }));
  if (!r) return { cups: still, ball: null, pick: null, burst: null, more: false };
  const plan = shellPlan(r), len = plan.ms, bc = r.ball;         // (the ball stays under its cup: the cup that began at its place)
  if (s.mode === 'idle') return { cups: still, ball: null, pick: null, burst: null, more: false };
  const live = s.mode === 'live' || (s.mode === 'res' && s.pre);
  const t = s.mode === 'live' ? s.t : s.mode === 'res' && s.pre ? Math.min(s.tm, len) : len;
  const cups = shellAt(r, Math.min(t, len)).map(q => ({ x: q.x, z: q.z, v: q.v, u: q.u, lift: 0, rot: 0 }));
  const out = { cups, ball: null, pick: null, burst: null, more: live && t < len };
  if (live && t < r.show + 40) { const l = shellLift(r, t); cups[bc].lift = l; cups[bc].rot = -SHELLV.tip * l; if (l > 0.01) out.ball = { cup: bc, show: l }; }
  if (s.mode === 'ans') return out;
  if (s.mode === 'live') return out;
  const pc = s.pick == null ? null : plan.at.indexOf(s.pick);   // the cup at the place picked
  const open = (cup, from, tm) => { const l = shellEase((tm - from) / SHELL.open); if (l > 0) { cups[cup].lift = Math.max(cups[cup].lift, l); cups[cup].rot = -SHELLV.tip * l; } return l; };
  if (s.mode === 'done') {
    if (pc != null) open(pc, 0, 1e9);
    open(bc, 0, 1e9);
    return Object.assign(out, { ball: { cup: bc, show: 1 }, pick: pc == null ? null : { cup: pc, ring: 1 } });
  }
  const tm = s.tm, pickAt = s.pre ? len + ATT_T.pick : 0, T = s.T, late = pc != null && pc !== bc ? SHELLV.other : 0;   // (a wrong pick: its cup first, then the ball's)
  if (pc != null && tm >= pickAt) {
    out.pick = { cup: pc, ring: Math.min(1, (tm - pickAt) / 140) };
    if (tm < T) { const w = Math.min(1, (tm - pickAt) / Math.max(1, T - pickAt)); cups[pc].rot = Math.sin(tm * 0.05) * 0.075 * w; cups[pc].lift = 0.04 * w; }
    else open(pc, T, tm);
  }
  if (tm >= T + late) { const l = open(bc, T + late, tm); if (l > 0.01) out.ball = { cup: bc, show: l }; }
  if (s.correct && tm >= T + SHELL.open * 0.5) { const b = (tm - T - SHELL.open * 0.5) / SHELLV.pop; if (b < 1.6) out.burst = b; }
  out.more = tm < T + late + SHELL.open + SHELLV.pop * 1.6 + 60;
  return out;
}
const CUP_PATH = (c, bw, tw, ch, rim) => { c.beginPath(); c.moveTo(-bw, -rim * 0.4); c.lineTo(-tw, -ch + tw * 0.3); c.quadraticCurveTo(-tw, -ch, -tw * 0.62, -ch); c.lineTo(tw * 0.62, -ch); c.quadraticCurveTo(tw, -ch, tw, -ch + tw * 0.3); c.lineTo(bw, -rim * 0.4); c.quadraticCurveTo(0, rim, -bw, -rim * 0.4); c.closePath(); };
function drawCup(c, x, y, cw, ch, q, Pal) {
  const bw = cw / 2, tw = cw * 0.33, rim = ch * 0.1, lw = Math.max(2.6, cw * 0.07), sq = q.sq || 0;
  c.save(); c.translate(x, y); c.rotate(q.rot || 0); c.scale(1 + sq * 0.6, 1 - sq);
  CUP_PATH(c, bw, tw, ch, rim);
  c.fillStyle = SHELLV.cup; c.fill();
  c.save(); c.clip();
  c.fillStyle = SHELLV.cupDark; c.fillRect(bw * 0.34, -ch - 2, bw, ch + rim + 4);                 // its shaded side
  c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-bw * 0.6, -ch - 2, bw * 0.2, ch + rim + 4);   // a strip of light
  c.fillStyle = SHELLV.band; c.fillRect(-bw - 2, -ch * 0.34, cw + 4, ch * 0.12);                  // the band round it
  c.fillStyle = Pal.ink; c.fillRect(-bw - 2, -ch * 0.34 - 1.2, cw + 4, 2.2); c.fillRect(-bw - 2, -ch * 0.22 - 1, cw + 4, 2.2);
  c.restore();
  CUP_PATH(c, bw, tw, ch, rim);
  c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = Pal.ink; c.stroke();
  c.restore();
}
function burstPath(c, x, y, r, k) { c.beginPath(); for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2 + k, rr = i % 2 ? r * 0.62 : r; if (i) c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); }
// One frame; true when another is wanted.
function shellFrame(c, W, H, now) {
  const Pal = runColours(), s = src, n = s.n, G = shellGeom(W, H, n);
  const at = s.mode === 'res' && s.a ? fxAt('move', s.a) : null;
  const sc = shellScene(Object.assign({}, s, { t: s.mode === 'live' ? now - s.at : 0, tm: s.mode === 'res' ? (at == null ? 1e9 : now - at) : 0 }));
  c.clearRect(0, 0, W, H);
  c.fillStyle = SHELLV.mat; c.strokeStyle = SHELLV.matEdge; c.lineWidth = 2;                       // the mat
  c.beginPath(); if (c.roundRect) c.roundRect(1, 1, W - 2, H - 2, 14); else c.rect(1, 1, W - 2, H - 2); c.fill(); c.stroke();
  const pos = sc.cups.map((q, i) => { const k = 1 + 0.07 * q.z; return { i, q, x: G.x(q.x), y: G.y0 + q.z * G.ch, k, cw: G.cw * k, ch: G.ch * k }; });
  for (const p of pos) {                                                                           // each cup's shadow on the mat (smaller under a lifted one)
    const l = p.q.lift || 0;
    c.fillStyle = `rgba(22,18,16,${0.2 - 0.1 * l})`;
    c.beginPath(); c.ellipse(p.x + p.cw * 0.06, p.y + p.ch * 0.03, p.cw * (0.56 - 0.12 * l), p.ch * (0.11 - 0.03 * l), 0, 0, Math.PI * 2); c.fill();
  }
  if (sc.pick) {                                                                                   // the pick: a ring in the picker's colour under its cup
    const p = pos[sc.pick.cup], col = s.who === 'O' ? Pal.O : Pal.X;
    c.save(); c.globalAlpha = sc.pick.ring;
    c.beginPath(); c.ellipse(p.x, p.y + p.ch * 0.02, p.cw * 0.7, p.ch * 0.2, 0, 0, Math.PI * 2);
    c.lineWidth = Math.max(4, p.cw * 0.1) + 3; c.strokeStyle = Pal.ink; c.stroke(); c.lineWidth = Math.max(4, p.cw * 0.1); c.strokeStyle = col; c.stroke();
    c.restore();
  }
  if (sc.burst != null && sc.ball) {                                                               // the ball found: a comic burst pops behind it
    const p = pos[sc.ball.cup], b = sc.burst, e = b < 0.25 ? b / 0.25 * 1.18 : b < 0.4 ? 1.18 - (b - 0.25) / 0.15 * 0.18 : 1, al = b > 1.2 ? Math.max(0, 1 - (b - 1.2) / 0.4) : 1;
    c.save(); c.globalAlpha = al;
    burstPath(c, p.x, p.y - p.ch * 0.16, p.cw * 0.86 * e, b * 0.5);
    c.fillStyle = SHELLV.burst; c.fill(); c.lineJoin = 'round'; c.lineWidth = Math.max(2.4, p.cw * 0.055); c.strokeStyle = Pal.ink; c.stroke();
    c.restore();
  }
  for (const p of pos.slice().sort((a, b) => a.q.z - b.q.z || a.i - b.i)) {                      // from the back of the table to the front
    const q = p.q, l = q.lift || 0;
    if (sc.ball && sc.ball.cup === p.i) {                                                          // the ball, on the mat under its lifted cup
      const rad = p.cw * 0.2;
      c.beginPath(); c.arc(p.x, p.y - rad * 0.95, rad, 0, Math.PI * 2); c.fillStyle = SHELLV.ball; c.fill(); c.lineWidth = Math.max(2.2, p.cw * 0.055); c.strokeStyle = Pal.ink; c.stroke();
      c.beginPath(); c.arc(p.x - rad * 0.32, p.y - rad * 1.3, rad * 0.26, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.75)'; c.fill();
    }
    const fast = Math.abs(q.v);
    if (fast > 2.2 && !REDUCED) {                                                                  // a fast slide: two streaks behind the cup
      const dir = q.v > 0 ? -1 : 1, a = Math.min(0.34, (fast - 2.2) * 0.05);
      c.save(); c.strokeStyle = `rgba(22,18,16,${a})`; c.lineCap = 'round'; c.lineWidth = Math.max(2, p.cw * 0.05);
      for (const [h, len] of [[0.3, 0.5], [0.62, 0.34]]) { c.beginPath(); c.moveTo(p.x + dir * p.cw * 0.62, p.y - p.ch * h); c.lineTo(p.x + dir * p.cw * (0.62 + len * Math.min(1.4, fast / 5)), p.y - p.ch * h); c.stroke(); }
      c.restore();
    }
    const land = q.u > 0.84 ? Math.sin(Math.PI * (q.u - 0.84) / 0.16) : 0;                          // the little squash as it lands
    drawCup(c, p.x, p.y - l * p.ch * SHELLV.lift, p.cw, p.ch, { rot: (q.rot || 0) + Math.max(-0.08, Math.min(0.08, q.v * SHELLV.lean)), sq: land * SHELLV.squash }, Pal);
  }
  return sc.more;
}

// The stage: the canvas, and a button over each cup's place (they answer only once the cups have settled, on this
// phone's own round).
export function shellView(c) {
  const r = c.round, s = c.shown, ok = shellOk(r), n = r && Number.isInteger(r.n) ? Math.min(7, Math.max(2, r.n)) : 3;
  src = { r: ok ? r : null, n, who: c.who, mode: !ok ? 'idle' : s ? (c.fresh ? 'res' : 'done') : c.playing ? 'live' : c.answering ? 'ans' : 'idle',
    at: c.playing ? c.startPerf : null, a: c.a || null, pre: c.pre, T: c.T, pick: s ? s.answer : null, correct: !!(s && s.correct) };
  schedulePaint();
  const on = c.answering && c.live;
  const taps = Array.from({ length: n }, (_, k) => `<button class="shtap" data-act="move" ${mv(k)} aria-label="Cup ${k + 1} of ${n}"${s && c.fresh && s.correct && k === s.truth ? qPick() : ''}${on ? '' : ' disabled'}></button>`).join('');
  const stage = `<div class="shbox${on ? ' live' : ''}" style="--n:${n}"><canvas class="shcv" data-shell="cv" aria-label="${n} cups on the table"></canvas><div class="shtaps">${taps}</div></div>`;
  return { stage, input: '', watch: '', ask: '', plain: true, say: () => '' };
}
// A round's own sounds, each from its moment (add(name, ms, rate)): the cup up, the cup down over the ball, a whoosh
// for each step of the shuffle, played faster as the tempo rises, and the cups settling.
export function shellRoundSounds(r, add) {
  if (!shellOk(r)) return;
  const plan = shellPlan(r);
  add('shLift', 0); add('shDown', Math.max(0, r.show - SHELL.drop * 0.4));
  for (const s of plan.steps) add('shSlide', s.t0, Math.max(0.8, Math.min(2.4, 300 / s.d)));
  add('shSet', plan.end);
}
// ---- the miniature: three cups and the ball, and each player's level as cups filling in ----
const MCUP = 'M2.6 12.6L4.4 2.4h5.2l1.8 10.2z';
const SHELL_ART = '<div class="tatt shm"><svg viewBox="0 0 52 40" aria-hidden="true"><g stroke="#161210" stroke-width="2.4" stroke-linejoin="round"><path d="M3 30l3-19h9l3 19z" fill="#3b87c7"/><path d="M34 30l3-19h9l3 19z" fill="#3b87c7"/><path d="M19 22l3-19h9l3 19z" fill="#3b87c7" transform="rotate(-9 26 12)"/><circle cx="26.5" cy="31" r="4.6" fill="#3fb950"/></g></svg></div>';
export function miniature(mini, final) {
  const goal = attGoal(mini), label = `X level ${Math.min(goal, mini.right.X)} and O level ${Math.min(goal, mini.right.O)} of ${goal}`;
  const rows = ['X', 'O'].map(p => `<div class="tr ${p}" style="--n:${goal}"><b class="${p}">${p}</b>${Array.from({ length: goal }, (_, k) => `<u class="shmc${k < mini.right[p] ? ' on' : ''}"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="${MCUP}"/></svg></u>`).join('')}</div>`).join('');
  return thumbArt(SHELL_ART, rows, 'tshellw', label);
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = attTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d, won: !!fresh }); return g;
}
export function moveText(f, who) {
  return f.att ? `${who} ${f.att.correct ? 'found the ball' : f.att.answer == null ? 'ran out of time' : 'picked the wrong cup'}` : `${who} played a round`;
}
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { 'att-start': attStartAct };
export const SHELL_SHOW = ATT.show;   // (the result's time on show: games/shared/attention.js attShow adds the cup's lift)
