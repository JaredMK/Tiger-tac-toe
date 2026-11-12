// Claw Machine: the screen, the miniature, the move's words and sounds, and the inputs.
import { CLAW, CLAWT, CLAW_KINDS, clawCarriage, clawCase, clawCfg, clawPath, clawTimes } from './rules.js';
import { ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { N, REDUCED, app, state, waitLine, zoomedType } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { repNote } from '../../ui/replay.js';
import { runCanvas, runColours } from '../../ui/runner.js';
import { markSvgG } from '../../ui/thumbs.js';

// Claw Machine (November 2026; one shared machine from v 2): the case both players play drawn on a canvas (its frame,
// the rail across the top, the chute at the left, the prizes on the floor), the claw hanging on its cable from a
// carriage on the rail. On this phone's turn the carriage sweeps by itself from the turn's start (`sweep`, the moment
// this phone first showed the turn) and the claw swings under it as the rules' pendulum has it (clawPath: the same
// path the server works the grab from), the cable leaning as it lags and swings; a tap on the case (or Drop) drops it:
// the move is { k }, the steps since the sweep began. No guide line: lining it up is the skill. What the grab did is
// the move's (the server's draw online); the claw plays it from the move's event (fxAt('move')): someone else's grab
// first shows the sweep's last stretch arriving exactly where the tap was (clawTimes `pre`), then the claw comes down,
// closes, rises with the prize or without, carries it to the chute (the prize swinging under it) and lets go: the
// prize rattles down the chute, drops out of the door in the machine's base and hops onto its winner's shelf there
// (each player's prizes won, beside their mark: `got`); a slip drops it back part way, with a bounce; a miss rides
// back to the chute empty. The moments are rules.js clawTimes (CLAWT); the machine itself is a kept layer (machineLayer).
export const PRIZE_COL = ['#e5605a', '#4e9de0', '#7cc457', '#f2b33d', '#b07fe0', '#f08bb8'];
let sweep = null;              // this phone's turn's sweep: { key, t0 } (the square and the grabs made: a new turn, a new sweep)
let press = null;              // a finger down on the case: { id, x0, y0 }
let sent = null;               // the grab just sent from here: { key, k, at } (the claw holds where it was dropped until the move's own play starts: online, the record's round trip)
let src = null, raf = 0;       // what the last render drew; the paint loop
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a) * u, ease = u => u * u * (3 - 2 * u);
const sweepKey = (sq, mini) => `${sq}:${mini.g || 0}`;
// The step of this phone's sweep at now (starting it on the turn's first look).
function sweepStep(sq, mini, now) {
  const key = sweepKey(sq, mini);
  if (!sweep || sweep.key !== key) sweep = { key, t0: now };
  return Math.max(0, Math.min(CLAW.kMax, Math.floor((now - sweep.t0) * CLAW.hz / 1000)));
}
function clawTable(mini, a, o) {
  const f = a && a.claw ? a.claw : null, by = f ? a.by : o.view && mini.last ? mini.last.by : o.turn, goal = clawCfg(mini).goal;
  const own = !!f && ownMove(a), T = f ? clawTimes(f, own) : null, anim = !!f && !REDUCED;
  const tal = p => {
    const n = Math.min(goal, mini.won[p]), fresh = f && f.res === 'win' && a.by === p;
    const pip = Array.from({ length: goal }, (_, k) => `<i ${lateAt(k < n ? 'on' : '', anim && fresh && k === n - 1 ? T.score : null, 'fillin')}></i>`).join('');
    return arcTally(p, o, `<span class="pips" aria-label="${mini.won[p]} of ${goal} prizes">${pip}</span>`);
  };
  const mine = !o.view && !f && !o.locked && !o.done;
  const word = s => (s.res === 'win' ? 'Got it!' : s.res === 'slip' ? 'Slipped!' : 'Missed');
  const l = mini.last;
  const res = f ? `<p ${lateAt('arcres ' + (f.res === 'win' ? 'ok' : 'no'), anim ? T.say : null)} role="status">${word(f)}</p>`
    : o.done && l ? `<p class="arcres ${l.res === 'win' ? 'ok' : 'no'}">${word(l)}</p>` : `<p class="arcnote">${mine || o.view ? '' : waitLine(o.turn)}</p>`;
  src = { mini, a: f ? a : null, f, by, own, T, mine, zoom: o.zoom, view: o.view };
  const left = clawCase(mini).length;
  return `<div class="g-arc g-claw"><div class="ctals">${tal('X')}${tal('O')}</div>
    <div class="claw${mine ? ' live' : ''}" data-claw="area"><canvas class="clawcv" data-claw="cv" aria-label="The claw machine: ${left} prizes"></canvas></div>
    ${res}<div class="cbtns one${mine ? '' : ' hold'}"><button class="big ${o.turn}" data-act="claw-drop"${mine ? '' : ' disabled tabindex="-1" aria-hidden="true"'}>Drop</button></div></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  hook();
  g = clawTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d });
  schedule();
  return g;
}
// ---- the drawing ----
// The machine is a designed picture, lit from the top left: the cabinet (its head with a row of bulbs, the glass case,
// the base with the prize door under the chute and a shelf for each player's prizes won), painted once into a layer
// (machineLayer: per size and goal); over it each frame the prizes on the floor with their shadows, the claw on its
// cable under its carriage (a lamp on it in the mover's colour), the prize it holds swaying as it is carried, and the
// glass's gleam in front of it all. Everything across the case keeps the rules' units (G.X: a prize's x and the claw's
// are the very numbers the grab is worked out from); only the heights are the picture's own.
function schedule() { if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); }
const FRAME = 3.5;                                                  // the cabinet's sides, in case units
function geom(W, H) {
  const m = 3, s = Math.max(0.5, Math.min((W - 2 * m) / (CLAW.W + 2 * FRAME), (H - 2 * m) / 74)), Hu = (H - 2 * m) / s;
  const base = clamp(Hu * 0.2, 15, 21), head = clamp(Hu - 100 - base, 5, 12), Hc = clamp(Hu - head - base, 50, 100);
  const ox = (W - CLAW.W * s) / 2, oy = m + Math.max(0, (Hu - head - Hc - base) * s / 2);
  const rail = head + 3.6, gb = head + Hc, floor = gb - 4.5;
  return { s, W, H, head, Hc, base, rail, top: rail + 8.5, gb, floor, bottom: head + Hc + base, X: x => ox + x * s, Y: y => oy + y * s };
}
const prizeH = k => CLAW_KINDS[k].w * (k === 'ball' ? 2 : k === 'box' ? 1.5 : 1.7);
const lw = (s, k) => Math.max(1.5, s * k);
// A prize about (0, 0), w and h in px (its half width and its height): flat colour, a bold outline, a shade on the
// side away from the light, a gleam towards it.
function prizeArt(c, k, w, h, col, P, s) {
  c.lineWidth = lw(s, 0.5); c.strokeStyle = P.ink; c.fillStyle = col; c.lineJoin = 'round';
  const shade = path => { c.save(); path(); c.clip(); c.fillStyle = 'rgba(22,18,16,.16)'; c.beginPath(); c.arc(w * 0.75, h * 0.42, Math.max(w, h * 0.5) * 1.02, 0, 7); c.fill(); c.restore(); };
  if (k === 'ball') {
    const path = () => { c.beginPath(); c.arc(0, 0, w, 0, 7); };
    path(); c.fill(); shade(path); path(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = lw(s, 0.55); c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, w * 0.62, -2.5, -1.5); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(-w * 0.2, -w * 0.62 + w * 0.42, w * 0.07, 0, 7); c.fill();
    c.strokeStyle = P.ink; c.lineWidth = lw(s, 0.3); c.beginPath(); c.ellipse(0, 0, w, w * 0.32, 0, 0.15, Math.PI - 0.15); c.stroke();   // a seam
  } else if (k === 'box') {
    const t = -h / 2, lid = h * 0.26;
    c.beginPath(); c.rect(-w, t, 2 * w, h); c.fill();
    c.fillStyle = 'rgba(22,18,16,.16)'; c.fillRect(w * 0.5, t, w * 0.5, h); c.fillRect(-w, t + lid, 2 * w, h * 0.06);
    c.fillStyle = '#fff8e8'; c.fillRect(-w * 0.17, t, w * 0.34, h);                                      // the ribbon
    c.beginPath(); c.rect(-w, t, 2 * w, h); c.moveTo(-w * 0.17, t); c.lineTo(-w * 0.17, t + h); c.moveTo(w * 0.17, t); c.lineTo(w * 0.17, t + h); c.moveTo(-w, t + lid); c.lineTo(w, t + lid); c.stroke();
    c.fillStyle = '#fff8e8'; c.beginPath(); c.ellipse(-w * 0.32, t - w * 0.17, w * 0.32, w * 0.19, -0.4, 0, 7); c.fill(); c.stroke(); c.beginPath(); c.ellipse(w * 0.32, t - w * 0.17, w * 0.32, w * 0.19, 0.4, 0, 7); c.fill(); c.stroke();   // its bow
    c.fillStyle = col; c.beginPath(); c.arc(0, t - w * 0.06, w * 0.13, 0, 7); c.fill(); c.stroke();
  } else if (k === 'star') {
    const R = Math.min(w, h / 1.9), path = () => { c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? R * 0.5 : R, an = -Math.PI / 2 + i * Math.PI / 5, px = Math.cos(an) * r * 1.05, py = Math.sin(an) * r; if (i) c.lineTo(px, py); else c.moveTo(px, py); } c.closePath(); };
    path(); c.fill(); shade(path); path(); c.stroke();
    c.fillStyle = P.ink; c.beginPath(); c.arc(-R * 0.2, -R * 0.06, R * 0.08, 0, 7); c.arc(R * 0.2, -R * 0.06, R * 0.08, 0, 7); c.fill();
    c.lineWidth = lw(s, 0.3); c.lineCap = 'round'; c.beginPath(); c.arc(0, R * 0.06, R * 0.16, 0.3, Math.PI - 0.3); c.stroke();
  } else {                                                          // a plush blob: a round body, two little ears, a face
    const cy = h * 0.05, body = () => { c.beginPath(); c.ellipse(0, cy, w, h * 0.46, 0, 0, 7); };
    for (const d of [-1, 1]) { c.beginPath(); c.arc(d * w * 0.56, -h * 0.4, w * 0.27, 0, 7); c.fill(); c.stroke(); }
    body(); c.fill(); shade(body); body(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.78)'; c.beginPath(); c.ellipse(0, cy + h * 0.16, w * 0.42, h * 0.15, 0, 0, 7); c.fill();
    c.fillStyle = P.ink; c.beginPath(); c.arc(-w * 0.32, cy - h * 0.08, w * 0.09, 0, 7); c.arc(w * 0.32, cy - h * 0.08, w * 0.09, 0, 7); c.fill();
    c.lineWidth = lw(s, 0.3); c.lineCap = 'round'; c.beginPath(); c.arc(0, cy + h * 0.02, w * 0.13, 0.3, Math.PI - 0.3); c.stroke();
  }
}
// A prize standing at (px x, px y of its foot), o: { rot, k (its size), sq (a squash: wider and lower), a (alpha) }.
function drawPrize(c, G, p, px, py, P, o) {
  o = o || {};
  const k = o.k == null ? 1 : o.k, w = p.w * G.s * k, h = prizeH(p.k) * G.s * k, sq = o.sq || 0;
  c.save(); if (o.a != null) c.globalAlpha = clamp(o.a, 0, 1);
  c.translate(px, py - h / 2); if (o.rot) c.rotate(o.rot);
  if (sq) { c.translate(0, h / 2); c.scale(1 + sq, 1 - sq); c.translate(0, -h / 2); }
  prizeArt(c, p.k, w, h, PRIZE_COL[p.c % PRIZE_COL.length], P, G.s * k);
  c.restore();
}
const shadow = (c, x, y, rx, ry, a) => { c.fillStyle = `rgba(22,18,16,${a})`; c.beginPath(); c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, 7); c.fill(); };
// A drawn X or O in its player's colour, outlined (a shelf's label).
function drawMark(c, p, x, y, r, P) {
  c.save(); c.lineCap = 'round';
  for (const [w, col] of [[r * 0.66, P.ink], [r * 0.36, p === 'X' ? P.X : P.O]]) {
    c.lineWidth = w; c.strokeStyle = col; c.beginPath();
    if (p === 'X') { c.moveTo(x - r * 0.62, y - r * 0.62); c.lineTo(x + r * 0.62, y + r * 0.62); c.moveTo(x + r * 0.62, y - r * 0.62); c.lineTo(x - r * 0.62, y + r * 0.62); }
    else c.arc(x, y, r * 0.66, 0, 7);
    c.stroke();
  }
  c.restore();
}
// The base's places: the prize door under the chute, and each player's shelf with a slot for every prize of the goal.
function basePlan(G, goal) {
  const y0 = G.gb + 2.4, h = G.base - 4.8, door = { x: 1.2, y: y0, w: CLAW.chute - 0.4, h }, x0 = CLAW.chute + 4.2, gap = 3, w = (CLAW.W - 1.2 - x0 - gap) / 2;
  const shelf = (p, i) => { const x = x0 + i * (w + gap), mk = Math.min(h * 0.4, 3.8), pitch = (w - 2 * mk - 3) / goal; return { p, x, y: y0, w, h, mk, pitch, k: z => Math.min(1, pitch * 0.94 / (2 * z.w), (h - 2) / (prizeH(z.k) + 2.6)), slot: n => ({ x: x + 2 * mk + 2.4 + pitch * (n + 0.5), y: y0 + h - 1.1 }) }; };
  return { door, X: shelf('X', 0), O: shelf('O', 1) };
}
const CAB = { body: '#5b4a8c', dark: '#3d3163', lite: '#7d6bb3', glass: '#d6edf7', glass2: '#eaf6fb', floor: '#f2d6a8', lip: '#d7b47c', metal: '#c9cdd6', metalD: '#8a919d', hole: '#262338' };
function chuteFront(c, G, P) {                                      // the chute's front panel (drawn again over a prize falling into it)
  const s = G.s, x = G.X(0.6), w = (CLAW.chute - 0.6) * s, y = G.Y(G.floor - 7.5), h = (G.gb - G.floor + 7.5) * s;
  c.fillStyle = '#4a5162'; c.strokeStyle = P.ink; c.lineWidth = lw(s, 0.55);
  c.beginPath(); c.roundRect(x, y, w, h, [1.2 * s, 1.2 * s, 0, 0]); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x + 0.6 * s, y + 0.6 * s, w - 1.2 * s, 1 * s);
  const ax = G.X(CLAW.rest), ay = y + h * 0.5; c.fillStyle = '#ffd34d'; c.lineWidth = lw(s, 0.4); c.lineJoin = 'round';
  c.beginPath(); c.moveTo(ax - 3.4 * s, ay - 1.8 * s); c.lineTo(ax + 3.4 * s, ay - 1.8 * s); c.lineTo(ax, ay + 2.2 * s); c.closePath(); c.fill(); c.stroke();
}
function paintMachine(c, G, P, goal) {
  const s = G.s, X = G.X, Y = G.Y, L = X(-FRAME), R = X(CLAW.W + FRAME), T = Y(0), B = Y(G.bottom), ink = lw(s, 0.7);
  // the cabinet
  c.fillStyle = 'rgba(22,18,16,.14)'; c.beginPath(); c.roundRect(L + 1.2 * s, T + 1.6 * s, R - L, B - T, 3 * s); c.fill();
  c.fillStyle = CAB.body; c.strokeStyle = P.ink; c.lineWidth = ink; c.beginPath(); c.roundRect(L, T, R - L, B - T - 0.6 * s, 3 * s); c.fill();
  c.fillStyle = CAB.dark; c.fillRect(X(CLAW.W) + 1.2 * s, Y(G.head), FRAME * s - 1.2 * s, (G.bottom - G.head - 2) * s);   // the side away from the light
  c.fillStyle = CAB.lite; c.fillRect(L + 0.9 * s, Y(1.6), 0.9 * s, (G.bottom - 4) * s);
  c.beginPath(); c.roundRect(L, T, R - L, B - T - 0.6 * s, 3 * s); c.stroke();
  // its head: a row of bulbs
  const n = 9, by = Y(G.head / 2 + 0.2), br = Math.min(1.5, G.head * 0.26) * s;
  for (let i = 0; i < n; i++) { const bx = X(6 + i * 88 / (n - 1)); c.fillStyle = i % 2 ? '#fff3c4' : '#ffd34d'; c.lineWidth = lw(s, 0.4); c.beginPath(); c.arc(bx, by, br, 0, 7); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(bx - br * 0.3, by - br * 0.3, br * 0.3, 0, 7); c.fill(); }
  // the case: its back wall, the floor seen from a little above, the shade under the head
  const gy = Y(G.head), gh = G.Hc * s, gx = X(0), gw = CLAW.W * s, fy = Y(G.floor - 5);
  const gr = c.createLinearGradient(0, gy, 0, fy); gr.addColorStop(0, CAB.glass); gr.addColorStop(1, CAB.glass2);
  c.fillStyle = gr; c.fillRect(gx, gy, gw, gh);
  c.fillStyle = CAB.floor; c.fillRect(gx, fy, gw, Y(G.gb) - fy);
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(gx, fy, gw, 0.7 * s);
  c.fillStyle = CAB.lip; c.fillRect(gx, Y(G.gb - 1.6), gw, 1.6 * s);
  c.fillStyle = 'rgba(22,18,16,.10)'; c.fillRect(gx, gy, gw, 2.2 * s); c.fillRect(X(CLAW.W) - 1.6 * s, gy, 1.6 * s, gh);
  // the chute: its mouth in the floor (the front panel goes over what falls in)
  c.fillStyle = CAB.hole; c.strokeStyle = P.ink; c.lineWidth = lw(s, 0.55);
  c.beginPath(); c.roundRect(X(0.6), Y(G.floor - 10.2), (CLAW.chute - 0.6) * s, (G.gb - G.floor + 10.2) * s, [1.4 * s, 1.4 * s, 0, 0]); c.fill(); c.stroke();
  chuteFront(c, G, P);
  // the rail
  c.fillStyle = CAB.metal; c.lineWidth = lw(s, 0.5); c.beginPath(); c.rect(gx, Y(G.rail - 1.3), gw, 2.6 * s); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(gx, Y(G.rail - 0.9), gw, 0.6 * s);
  c.fillStyle = 'rgba(22,18,16,.16)'; c.fillRect(gx, Y(G.rail + 0.5), gw, 0.6 * s);
  c.lineWidth = ink; c.strokeRect(gx, gy, gw, gh);
  // the base: the prize door and the two shelves
  const pl = basePlan(G, goal), d = pl.door;
  c.fillStyle = CAB.hole; c.lineWidth = lw(s, 0.55); c.beginPath(); c.roundRect(X(d.x), Y(d.y), d.w * s, d.h * s, 1.4 * s); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(X(d.x) + 0.7 * s, Y(d.y + d.h) - 1.6 * s, d.w * s - 1.4 * s, 0.9 * s);
  for (const p of ['X', 'O']) {
    const sh = pl[p];
    c.fillStyle = P.paper; c.strokeStyle = P.ink; c.lineWidth = lw(s, 0.55); c.beginPath(); c.roundRect(X(sh.x), Y(sh.y), sh.w * s, sh.h * s, 1.6 * s); c.fill(); c.stroke();
    c.fillStyle = p === 'X' ? P.X : P.O; c.globalAlpha = 0.16; c.beginPath(); c.roundRect(X(sh.x), Y(sh.y), (2 * sh.mk + 1.4) * s, sh.h * s, [1.6 * s, 0, 0, 1.6 * s]); c.fill(); c.globalAlpha = 1;
    drawMark(c, p, X(sh.x + sh.mk + 0.7), Y(sh.y + sh.h / 2), sh.mk * s, P);
    c.fillStyle = 'rgba(22,18,16,.10)'; c.fillRect(X(sh.x + 2 * sh.mk + 1.6), Y(sh.y + sh.h - 1.1), (sh.w - 2 * sh.mk - 2.4) * s, 0.5 * s);   // the shelf's board
    c.setLineDash([1.1 * s, 1.1 * s]); c.strokeStyle = 'rgba(22,18,16,.3)'; c.lineWidth = lw(s, 0.3);
    for (let i = 0; i < goal; i++) { const q = sh.slot(i), r = Math.min(sh.pitch * 0.42, (sh.h - 3) / 2); c.beginPath(); c.arc(X(q.x), Y(q.y - r - 0.3), r * s, 0, 7); c.stroke(); }
    c.setLineDash([]);
  }
}
let layer = null;
function machineLayer(c, G, P, goal) {
  const t = c.getTransform ? c.getTransform() : null, dpr = t && t.a > 0 ? t.a : 1, key = [G.W, G.H, goal, dpr].join('|');
  if (layer && layer.key === key) return layer.cv;
  layer = null;
  try {
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(G.W * dpr)); cv.height = Math.max(1, Math.round(G.H * dpr));
    const lc = cv.getContext('2d'); lc.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintMachine(lc, G, P, goal);
    layer = { key, cv };
  } catch (e) { layer = null; }                                     // (no canvas to keep it in: painted straight on, below)
  return layer ? layer.cv : null;
}
// The claw at (x, y: its head's foot, case units), shut 0..1 (held: the half width its arms close round), under its
// carriage at xc: the cable leaning as it lags and swings, the arms' tips coming together as it shuts.
function drawClaw(c, G, x, y, shut, P, xc, col, held) {
  const cx = G.X(x), cy = G.Y(y), s = G.s, open = 4.6 * s, tight = (held ? clamp(held * 0.62, 1.8, 4) : 1.5) * s, sp = lerp(open, tight, shut), kx = G.X(xc == null ? x : xc), ry = G.Y(G.rail);
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  // the carriage on the rail: its wheels, its lamp in the mover's colour
  c.fillStyle = CAB.metalD; c.strokeStyle = P.ink; c.lineWidth = lw(s, 0.5);
  for (const d of [-1, 1]) { c.beginPath(); c.arc(kx + d * 2.5 * s, ry - 1.5 * s, 1.1 * s, 0, 7); c.fill(); c.stroke(); }
  c.fillStyle = '#6f7785'; c.beginPath(); c.roundRect(kx - 4.2 * s, ry - 1.5 * s, 8.4 * s, 4.2 * s, 1.1 * s); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(kx - 3.4 * s, ry - 0.9 * s, 6.8 * s, 0.6 * s);
  if (col) { c.fillStyle = col; c.lineWidth = lw(s, 0.4); c.beginPath(); c.arc(kx, ry + 0.9 * s, 1.15 * s, 0, 7); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(kx - 0.35 * s, ry + 0.55 * s, 0.35 * s, 0, 7); c.fill(); }
  // the cable
  c.strokeStyle = P.ink; c.lineWidth = lw(s, 0.75); c.beginPath(); c.moveTo(kx, ry + 2.7 * s); c.lineTo(cx, cy - 3.4 * s); c.stroke();
  c.strokeStyle = '#aab0bb'; c.lineWidth = Math.max(0.8, s * 0.28); c.stroke();
  // the arm behind, the two at the sides (a tube: ink, then metal over it), the head
  const arm = (pts, w) => { for (const [k, colr] of [[w, P.ink], [w * 0.5, CAB.metal]]) { c.strokeStyle = colr; c.lineWidth = k; c.beginPath(); c.moveTo(pts[0], pts[1]); c.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]); c.stroke(); } };
  arm([cx, cy, cx, cy + 3 * s, cx, cy + 5.4 * s], lw(s, 1.25));
  for (const d of [-1, 1]) {
    arm([cx + d * 2.1 * s, cy - 0.4 * s, cx + d * (sp + 2.1 * s), cy + 3.3 * s, cx + d * sp * 0.62, cy + 6.6 * s], lw(s, 1.5));
    c.fillStyle = P.ink; c.beginPath(); c.arc(cx + d * sp * 0.62, cy + 6.6 * s, 0.85 * s, 0, 7); c.fill();
  }
  c.fillStyle = CAB.metal; c.strokeStyle = P.ink; c.lineWidth = lw(s, 0.55);
  c.beginPath(); c.roundRect(cx - 3.3 * s, cy - 3.4 * s, 6.6 * s, 3.6 * s, 1.3 * s); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.65)'; c.fillRect(cx - 2.4 * s, cy - 2.8 * s, 3 * s, 0.7 * s);
  c.fillStyle = CAB.metalD; c.beginPath(); c.arc(cx, cy - 1.3 * s, 0.75 * s, 0, 7); c.fill(); c.stroke();
  c.restore();
}
function sparkles(c, x, y, u, s, n, R) {                             // a burst of little four-point stars, u 0..1 of its life
  if (u <= 0 || u >= 1) return;
  c.save(); c.globalAlpha = 1 - u * u; c.fillStyle = '#ffd34d'; c.strokeStyle = 'rgba(22,18,16,.55)'; c.lineWidth = Math.max(0.8, s * 0.25);
  for (let i = 0; i < n; i++) {
    const an = -Math.PI / 2 + (i - (n - 1) / 2) * (Math.PI * 1.5 / n) + (i % 2) * 0.2, d = R * (0.35 + 0.65 * (1 - (1 - u) * (1 - u))), px = x + Math.cos(an) * d, py = y + Math.sin(an) * d - R * 0.1 * u, r = s * (i % 2 ? 1.3 : 1.9) * (1 - u * 0.5);
    c.beginPath(); for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.38 : r, a2 = k * Math.PI / 4 + u * 2; if (k) c.lineTo(px + Math.cos(a2) * rr, py + Math.sin(a2) * rr); else c.moveTo(px + Math.cos(a2) * rr, py + Math.sin(a2) * rr); }
    c.closePath(); c.fill(); c.stroke();
  }
  c.restore();
}
function dust(c, x, y, u, s) {                                        // a little puff where something landed
  if (u <= 0 || u >= 1) return;
  c.save(); c.fillStyle = `rgba(150,120,80,${0.38 * (1 - u)})`;
  for (const d of [-1, 1, 0]) { c.beginPath(); c.arc(x + d * (2 + 5 * u) * s, y - (d ? 0.6 : 1.6) * u * s, (1 + 1.6 * u) * s * (d ? 1 : 0.8), 0, 7); c.fill(); }
  c.restore();
}
const easeIn = u => u * u, easeOut = u => 1 - (1 - u) * (1 - u), unit = (t, a, b) => clamp((t - a) / Math.max(1, b - a), 0, 1);
function frame(c, G, W, H, now) {
  const P = runColours(), sc = src, mini = sc.mini, f = sc.f, cs = clawCase(mini), cfg = clawCfg(mini), goal = cfg.goal, s = G.s, X = G.X, Y = G.Y;
  c.clearRect(0, 0, W, H);
  const lay = machineLayer(c, G, P, goal);
  if (lay) c.drawImage(lay, 0, 0, W, H); else paintMachine(c, G, P, goal);
  let more = false;
  // the claw's place, its grip and the prize it holds, at this moment of the move (or at rest, or where the sweep has it)
  let cx = CLAW.rest, xc = CLAW.rest, cy = G.top, shut = 0, held = null, sway = 0, hide = null, loose = null, tumble = null, rock = null, hop = null, fxs = [], gotHide = false, inDoor = null;
  if (sc.mine && !f) {                                              // this phone's turn: the sweep, live
    const wait = sent && sent.key === sweepKey(sc.zoom, mini) && now - sent.at < 2500, k = wait ? sent.k : sweepStep(sc.zoom, mini, now), ph = mini.ph || 0;   // (dropped a moment ago, its record still on its way: it waits where it was dropped)
    cx = clawPath(cfg, ph, k)[k]; xc = clawCarriage(ph, cfg.speed, k / CLAW.hz); more = true;
  }
  if (f && !REDUCED) {
    const at = fxAt('move', sc.a), t = at == null ? Infinity : now - at, T = sc.T, pz = f.pz, ph = f.ph || 0, kk = f.k || 0;
    const xcAt = k2 => clawCarriage(ph, cfg.speed, k2 / CLAW.hz), xcDrop = f.k == null ? f.x : xcAt(kk);
    const hPz = pz ? prizeH(pz.k) : 0, yGrab = pz ? G.floor - hPz - 4.6 : G.floor - 7.4, dir = Math.sign(CLAW.rest - f.x) || -1;
    if (t < T.end) more = true;
    gotHide = f.res === 'win' && t < T.score;                         // (the prize being won is not on its shelf yet)
    xc = xcDrop;
    // the claw: the sweep's last stretch up to the tap (someone else's grab), down (gathering speed), shut, up; then
    // (a grip) across to the chute, the prize swinging behind, and open; (a miss) back to the chute, empty
    if (t < T.down) { const k2 = Math.max(0, Math.round(kk - (T.down - Math.max(0, t)) * CLAW.hz / 1000)); cx = clawPath(cfg, ph, kk)[k2]; xc = xcAt(k2); }
    else if (t < T.top) {
      cx = f.x;
      const ud = unit(t, T.down, T.closed), jolt = t >= T.closed ? Math.sin(unit(t, T.closed, T.closed + 180) * Math.PI) * 0.7 : 0;
      cy = t < T.closed ? lerp(G.top, yGrab, ud * ud * (2.2 - 1.2 * ud)) : t < T.up ? yGrab - jolt : lerp(yGrab, G.top, ease(unit(t, T.up, T.top)));
      shut = t < T.closed ? 0 : easeOut(unit(t, T.closed, T.closed + (T.up - T.closed) * 0.7));
      if (f.res === 'miss' && t >= T.up) shut = Math.max(0, 1 - (t - T.up) / 220);   // (nothing held: it opens again as it rises)
      if (t >= T.up && f.res !== 'miss') sway = 0.11 * Math.sin((t - T.up) / 95) * Math.exp(-(t - T.up) / 380);
    } else if (f.res === 'miss') { const u = ease(unit(t, T.top + 40, T.end - 60)); cx = lerp(f.x, CLAW.rest, u); xc = lerp(xcDrop, CLAW.rest, u); }
    else {
      const u = unit(t, T.top, T.top + T.carry), e = ease(u), lag = Math.sin(u * Math.PI * 2) * Math.min(2.2, T.carry / 320);
      xc = lerp(xcDrop, CLAW.rest, e); cx = lerp(f.x, CLAW.rest, e) - dir * lag; shut = 1;
      sway = dir * 0.2 * Math.sin(u * Math.PI * 2) * Math.min(1, T.carry / 500) + 0.05 * Math.sin((t - T.top) / 95) * Math.exp(-(t - T.top) / 500);
      if (f.res === 'win' && t >= T.atChute) shut = 1 - easeOut(unit(t, T.atChute, T.atChute + CLAWT.open));
      if (f.res === 'slip' && t >= T.slipAt) shut = 1 - 0.75 * easeOut(unit(t, T.slipAt, T.slipAt + 160));
    }
    // the prize it went for: on the floor where it was, then in the claw, then down the chute, out of the door and onto
    // its winner's shelf, or slipping back down to the floor
    if (pz && f.res === 'miss') {                                     // (the claw closed on it and lost it at once: it rocks)
      if (t >= T.closed && t < T.up + 420) { const u = unit(t, T.closed, T.up + 420); rock = { id: pz.id, rot: 0.2 * Math.sin(u * Math.PI * 3) * (1 - u), lift: t < T.up + 90 ? Math.sin(unit(t, T.closed, T.up + 90) * Math.PI) * 0.9 : 0 }; }
    } else if (pz) {
      hide = pz.id;                                                   // (the case as it is now has it elsewhere, or not at all)
      const hy = y0 => y0 + 4.6 + hPz;                                // (a held prize hangs under the claw's arms: its foot)
      if (t < T.up) loose = { p: pz, x: pz.x, y: G.floor, sq: t >= T.closed ? 0.07 * Math.sin(unit(t, T.closed, T.up) * Math.PI) : 0 };
      else if (f.res === 'win') {
        const rel = T.atChute + CLAWT.open * 0.5;
        if (t < rel) held = pz;
        else if (t < T.tray - 150) { const v = unit(t, rel, T.tray - 150); tumble = { p: pz, x: CLAW.rest, y: lerp(hy(cy), G.gb + 6, v * v), rot: dir * v * 1.4 }; }
        if (t >= T.tray - 150 && t < T.tray + CLAWT.shelf * 0.36) {      // out into the door: it drops in and bounces
          const v = unit(t, T.tray - 150, T.tray), b = t >= T.tray ? Math.sin(unit(t, T.tray, T.tray + 170) * Math.PI) : 0;
          inDoor = { p: pz, v, b };
        } else if (t >= T.tray + CLAWT.shelf * 0.36 && t < T.score) hop = { p: pz, u: unit(t, T.tray + CLAWT.shelf * 0.36, T.score) };
        if (t >= T.tray) fxs.push(['spark', 'door', unit(t, T.tray, T.tray + 520)]);
        if (t >= T.score) fxs.push(['spark', 'slot', unit(t, T.score, T.score + 460)]);
      } else if (t < T.slipAt) held = pz;
      else {
        const v = unit(t, T.slipAt, T.land), sx0 = lerp(f.x, CLAW.rest, ease(clamp(f.t || 0.4, 0, 1))), b = t >= T.land ? unit(t, T.land, T.land + 260) : 0;
        if (t < T.land + 260) loose = { p: pz, x: lerp(sx0, f.sx, easeOut(v)), y: lerp(hy(G.top), G.floor, v * v) - (b ? Math.sin(b * Math.PI) * 1.8 : 0), rot: t < T.land ? -dir * 0.5 * Math.sin(v * Math.PI) : 0, sq: b ? 0.1 * Math.sin(b * Math.PI * 2) * (1 - b) : 0 };
        else hide = null;
        if (t >= T.land) fxs.push(['dust', f.sx, unit(t, T.land, T.land + 420)]);
      }
    }
    if (f.res === 'miss' && !pz && t >= T.closed) fxs.push(['dust', f.x, unit(t, T.closed, T.closed + 420)]);
  }
  // inside the glass: the prizes on the floor with their shadows, what falls, the chute's front over it, the claw
  c.save(); c.beginPath(); c.rect(X(0), Y(G.head), CLAW.W * s, G.Hc * s); c.clip();
  const fy = Y(G.floor);
  for (const p of cs) if (p.id !== hide) shadow(c, X(p.x) + 0.9 * s, fy + 0.3 * s, p.w * s * 1.02, 1.5 * s, 0.2);
  if (loose) { const hgt = clamp((G.floor - loose.y) / 40, 0, 1); shadow(c, X(loose.x) + 0.9 * s, fy + 0.3 * s, loose.p.w * s * (1.02 - 0.4 * hgt), 1.5 * s * (1 - 0.4 * hgt), 0.2 * (1 - 0.6 * hgt)); }
  if (held) { const hgt = clamp((G.floor - cy - 12) / 40, 0, 1); shadow(c, X(cx) + 0.9 * s, fy + 0.3 * s, held.w * s * (1 - 0.45 * hgt), 1.4 * s * (1 - 0.45 * hgt), 0.16 * (1 - 0.6 * hgt)); }
  for (const p of cs) if (p.id !== hide) drawPrize(c, G, p, X(p.x), fy - (rock && rock.id === p.id ? rock.lift * s : 0), P, rock && rock.id === p.id ? { rot: rock.rot } : null);
  if (loose) drawPrize(c, G, loose.p, X(loose.x), Y(loose.y), P, { rot: loose.rot, sq: loose.sq });
  for (const e of fxs) if (e[0] === 'dust') dust(c, X(e[1]), fy, e[2], s);
  if (tumble) { drawPrize(c, G, tumble.p, X(tumble.x), Y(tumble.y), P, { rot: tumble.rot }); chuteFront(c, G, P); }
  if (held) {                                                          // hanging from the claw, swinging about it
    c.save(); c.translate(X(cx), Y(cy)); c.rotate(sway); c.translate(-X(cx), -Y(cy));
    drawPrize(c, G, held, X(cx), Y(cy + 4.6 + prizeH(held.k)), P);
    c.restore();
  }
  drawClaw(c, G, cx, cy, shut, P, xc, sc.by === 'O' ? P.O : sc.by === 'X' ? P.X : null, held ? held.w : loose && shut > 0.2 ? loose.p.w : rock && shut > 0.2 ? f.pz.w : 0);
  // the glass in front of it all: two gleams
  c.fillStyle = 'rgba(255,255,255,.2)';
  for (const [a, b] of [[58, 70], [74, 78]]) { c.beginPath(); c.moveTo(X(a + 14), Y(G.head)); c.lineTo(X(b + 14), Y(G.head)); c.lineTo(X(b - 16), Y(G.gb)); c.lineTo(X(a - 16), Y(G.gb)); c.fill(); }
  c.restore();
  // the base: the prize in the door, the prizes won on their shelves, the one just won hopping onto its own
  const pl = basePlan(G, goal), d = pl.door, doorK = pz => Math.min(1, (d.h - 1.2) / (prizeH(pz.k) + 2.6), (d.w - 1.5) / (2 * pz.w));
  if (inDoor) {
    const k = doorK(inDoor.p), restY = d.y + d.h - 0.7;
    c.save(); c.beginPath(); c.rect(X(d.x), Y(d.y), d.w * s, d.h * s); c.clip();
    drawPrize(c, G, inDoor.p, X(d.x + d.w / 2), Y(lerp(d.y - 1, restY, easeIn(inDoor.v)) - inDoor.b * 1.4), P, { k, rot: (1 - inDoor.v) * 0.9, sq: inDoor.b ? -0.06 * inDoor.b : 0 });
    c.restore();
  }
  for (const p of ['X', 'O']) {
    const sh = pl[p], got = (mini.got && mini.got[p]) || [], n = Math.min(goal, got.length) - (gotHide && f && sc.a.by === p ? 1 : 0);
    for (let i = 0; i < n; i++) { const g = got[got.length - Math.min(goal, got.length) + i], q = sh.slot(i); const z = { k: CLAW_KINDS[g.k] ? g.k : 'ball', c: g.c, w: CLAW_KINDS[g.k] ? CLAW_KINDS[g.k].w : 5 }; drawPrize(c, G, z, X(q.x), Y(q.y), P, { k: sh.k(z) }); }
    if (hop && f && sc.a.by === p) {
      const q = sh.slot(Math.max(0, Math.min(goal, got.length) - 1)), k0 = doorK(hop.p), u = hop.u, e = ease(u);
      const x = lerp(d.x + d.w / 2, q.x, e), y = lerp(d.y + d.h - 0.7, q.y, e) - Math.sin(u * Math.PI) * Math.min(G.base * 0.9, 12);
      drawPrize(c, G, hop.p, X(x), Y(y), P, { k: lerp(k0, sh.k(hop.p), e), rot: -Math.sin(u * Math.PI) * 0.35 });
    }
    for (const e of fxs) if (e[0] === 'spark' && e[1] === 'slot' && f && sc.a.by === p) { const q = sh.slot(Math.max(0, Math.min(goal, got.length) - 1)); sparkles(c, X(q.x), Y(q.y - 3), e[2], s * 0.8, 5, 7 * s); }
  }
  for (const e of fxs) if (e[0] === 'spark' && e[1] === 'door') sparkles(c, X(d.x + d.w / 2), Y(d.y + d.h * 0.4), e[2], s, 7, 11 * s);
  return more;
}
function paint(now) {
  raf = 0;
  const cv = app.querySelector('canvas[data-claw="cv"]');
  if (!cv || typeof cv.getContext !== 'function' || !src) return;
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return;
  if (frame(c, geom(W, H), W, H, now == null ? performance.now() : now)) raf = requestAnimationFrame(paint);
}
// ---- the inputs ----
// Drop: the moment of the tap in this turn's sweep (its step); the server works out where the claw was then.
function drop() {
  if (zoomedType() !== 'claw' || state.screen !== 'mini' || state.flash || state.done || blocked() || !src || !src.mine) return;
  const k = sweepStep(state.zoom, src.mini, performance.now()), key = sweepKey(state.zoom, src.mini);
  repNote('claw', `k=${k}`);
  attemptMove({ k });
  sent = { key, k, at: performance.now() };                          // (only what is drawn while the move goes in: the tap's moment is read above, as ever)
}
export const actions = { 'claw-drop': () => { ownPress(); drop(); } };
let hooked = false;
function hook() {                                                   // a tap anywhere on the case drops the claw too (once, the first time it is drawn)
  if (hooked || typeof app.addEventListener !== 'function') return;
  hooked = true;
  app.addEventListener('pointerdown', e => {
    const area = e.target.closest && e.target.closest('.claw.live[data-claw="area"]');
    if (!area || !src || !src.mine) return;
    press = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
    e.preventDefault();
  });
  app.addEventListener('pointerup', e => {
    if (!press || e.pointerId !== press.id) return;
    const d = press; press = null;
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 24) { ownPress(); drop(); }
  });
  app.addEventListener('pointercancel', e => { if (press && e.pointerId === press.id) press = null; });
}
// Someone else's grab: no inputs to press (the sweep up to their tap is in the move itself: clawTimes `pre`).
export const replay = { synth: () => [] };
// ---- the miniature: the machine (its cabinet, the shared case with the prizes left on its floor, the claw over the
// chute) over each player's mark and a pip for every prize of the goal (a picture: no figures) ----
export function miniature(mini, final) {
  const goal = clawCfg(mini).goal, k = 0.86, ox = 7, fl = 33, n1 = v => v.toFixed(1);
  const pz = z => {                                                // a prize on the floor: a ball, a box, a star or a plush, in its colour
    const x = ox + z.x * k, w = z.w * k * 1.12, col = PRIZE_COL[z.c % PRIZE_COL.length];
    if (z.k === 'box') return `<rect x="${n1(x - w)}" y="${n1(fl - w * 1.5)}" width="${n1(2 * w)}" height="${n1(w * 1.5)}" fill="${col}"/>`;
    if (z.k === 'ball') return `<circle cx="${n1(x)}" cy="${n1(fl - w)}" r="${n1(w)}" fill="${col}"/>`;
    if (z.k === 'star') { const cy = fl - w * 0.9, pts = Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? w * 0.5 : w, an = -Math.PI / 2 + i * Math.PI / 5; return `${n1(x + Math.cos(an) * r)},${n1(cy + Math.sin(an) * r * 0.95)}`; }).join(' '); return `<polygon points="${pts}" fill="${col}"/>`; }
    return `<ellipse cx="${n1(x)}" cy="${n1(fl - w * 0.8)}" rx="${n1(w)}" ry="${n1(w * 0.8)}" fill="${col}"/>`;
  };
  const kx = n1(ox + CLAW.rest * k), pitch = Math.min(9, 36 / goal), r = Math.min(3.5, pitch * 0.4);
  const row = (p, x0) => `<g class="tclawm ${p}"><g transform="translate(${x0 + 5} 52)">${markSvgG(p, 3.3)}</g>${Array.from({ length: goal }, (_, i) => `<circle class="tclawi${i < mini.won[p] ? ' on' : ''}" cx="${n1(x0 + 12 + pitch * (i + 0.5))}" cy="52" r="${n1(r)}"/>`).join('')}</g>`;
  return `<div class="tclaww" aria-label="Claw Machine: X ${mini.won.X}, O ${mini.won.O} of ${goal} prizes"><svg class="tclaw" viewBox="0 0 100 58" aria-hidden="true"><rect class="tclawb" x="3" y="1" width="94" height="42" rx="4"/><rect class="tclawg" x="${ox}" y="5" width="86" height="32"/><rect class="tclawfl" x="${ox}" y="${fl - 1.5}" width="86" height="${38.5 - fl}"/><rect class="tclawc" x="${ox}" y="${fl - 7}" width="12.5" height="${37 - fl + 7}"/><g class="tclawz">${clawCase(mini).map(pz).join('')}</g><path class="tclawr" d="M${ox} 8.6h86"/><path class="tclawa" d="M${kx} 8.6v6M${kx} 14.6l-3.3 3 1.1 3.5M${kx} 14.6l3.3 3-1.1 3.5"/><rect class="tclawf" x="${ox}" y="5" width="86" height="32"/>${row('X', 2)}${row('O', 52)}</svg></div>`;
}
export function moveText(f, who) {
  const s = f.claw;
  if (!s) return `${who} grabbed`;
  return s.res === 'win' ? `${who} won a prize` : s.res === 'slip' ? `${who}'s prize slipped` : `${who} missed`;
}
// The motor as the claw sweeps in (someone else's grab), lowers and lifts; the pincers' snap as it closes, a thunk when
// it has something; then: the prize rattling down the chute, a ding as it drops out of the door and a sparkle as it
// lands on its winner's shelf; a slipped prize whistles down and thuds; a miss thuds on the floor.
export function sounds(f, add, won, mini, last) {
  const s = f.claw;
  if (!s) return;
  const T = clawTimes(s, ownMove(f));
  if (T.pre > 350) add('clawMotor', Math.max(0, T.pre - 520), 1.15);
  add('clawMotor', T.down, 0.85);
  add('clawSnap', T.closed);
  if (s.res !== 'miss') { add('thunk', T.closed + 70); add('clawMotor', T.up, 1.1); }
  if (s.res === 'win') { add('clawChute', T.atChute + CLAWT.open * 0.5); add('ding', T.tray); add('sparkle', T.score); }
  else if (s.res === 'slip') { add('clawSlip', T.slipAt); add('thud', T.land); }
  else add('thud', T.closed + 40);
}
// The line under the game's name while the turn is held (Go again on success).
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> won a prize · goes again`; }
