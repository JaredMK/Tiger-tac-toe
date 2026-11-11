// Claw Machine: the screen, the miniature, the move's words and sounds, and the inputs.
import { CLAW, CLAW_KINDS, clawCarriage, clawCase, clawCfg, clawPath, clawTimes } from './rules.js';
import { ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { N, REDUCED, app, state, waitLine, zoomedType } from '../../ui/app.js';
import { fxAt } from '../../ui/fx.js';
import { ownMove } from '../../ui/haptics.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { repNote } from '../../ui/replay.js';
import { runCanvas, runColours } from '../../ui/runner.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';

// Claw Machine (November 2026; one shared machine from v 2): the case both players play drawn on a canvas (its frame,
// the rail across the top, the chute at the left, the prizes on the floor), the claw hanging on its cable from a
// carriage on the rail. On this phone's turn the carriage sweeps by itself from the turn's start (`sweep`, the moment
// this phone first showed the turn) and the claw swings under it as the rules' pendulum has it (clawPath: the same
// path the server works the grab from), the cable leaning as it lags and swings; a tap on the case (or Drop) drops it:
// the move is { k }, the steps since the sweep began. No guide line: lining it up is the skill. What the grab did is
// the move's (the server's draw online); the claw plays it from the move's event (fxAt('move')): someone else's grab
// first shows the sweep's last stretch arriving exactly where the tap was (clawTimes `pre`), then the claw comes down,
// closes, rises with the prize or without, carries it to the chute and lets go; a slip drops it back part way.
export const PRIZE_COL = ['#e5605a', '#4e9de0', '#7cc457', '#f2b33d', '#b07fe0', '#f08bb8'];
let sweep = null;              // this phone's turn's sweep: { key, t0 } (the square and the grabs made: a new turn, a new sweep)
let press = null;              // a finger down on the case: { id, x0, y0 }
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
    const pip = Array.from({ length: goal }, (_, k) => `<i ${lateAt(k < n ? 'on' : '', anim && fresh && k === n - 1 ? T.say : null, 'fillin')}></i>`).join('');
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
function schedule() { if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); }
function geom(W, H) {
  const pad = 6, s = (W - 2 * pad) / CLAW.W, Hu = (H - 2 * pad) / s;
  return { pad, s, Hu, floor: Hu - 4, rail: 4, top: 13, X: x => pad + x * s, Y: y => pad + y * s };
}
const prizeH = k => CLAW_KINDS[k].w * (k === 'ball' ? 2 : k === 'box' ? 1.5 : 1.7);
function drawPrize(c, G, p, x, yBot, P, alpha) {
  const w = p.w * G.s, h = prizeH(p.k) * G.s, cx = G.X(x), by = G.Y(yBot), col = PRIZE_COL[p.c % PRIZE_COL.length];
  c.save(); if (alpha != null) c.globalAlpha = alpha;
  c.lineWidth = Math.max(1.5, G.s * 0.5); c.strokeStyle = P.ink; c.fillStyle = col;
  c.beginPath();
  if (p.k === 'ball') { c.arc(cx, by - h / 2, w, 0, Math.PI * 2); c.fill(); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(cx, by - h / 2, w * 0.62, -2.4, -1.2); c.stroke(); }
  else if (p.k === 'box') {
    c.rect(cx - w, by - h, 2 * w, h); c.fill(); c.stroke();
    c.fillStyle = '#fff8e8'; c.fillRect(cx - w * 0.16, by - h, w * 0.32, h); c.strokeRect(cx - w * 0.16, by - h, w * 0.32, h);
    c.beginPath(); c.ellipse(cx - w * 0.3, by - h - w * 0.18, w * 0.3, w * 0.18, -0.4, 0, Math.PI * 2); c.ellipse(cx + w * 0.3, by - h - w * 0.18, w * 0.3, w * 0.18, 0.4, 0, Math.PI * 2); c.fill(); c.stroke();
  } else if (p.k === 'star') {
    const R = Math.min(w, h / 1.9), cy = by - h / 2;
    for (let i = 0; i < 10; i++) { const r = i % 2 ? R * 0.48 : R, an = -Math.PI / 2 + i * Math.PI / 5; const px = cx + Math.cos(an) * r * 1.05, py = cy + Math.sin(an) * r; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = P.ink; c.beginPath(); c.arc(cx - R * 0.18, cy - R * 0.05, R * 0.07, 0, 7); c.arc(cx + R * 0.18, cy - R * 0.05, R * 0.07, 0, 7); c.fill();
  } else {                                                          // a plush blob: a round body, two little ears, a face
    const cy = by - h * 0.45;
    c.ellipse(cx - w * 0.55, by - h * 0.92, w * 0.26, w * 0.26, 0, 0, 7); c.ellipse(cx + w * 0.55, by - h * 0.92, w * 0.26, w * 0.26, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(cx, cy, w, h * 0.46, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = P.ink; c.beginPath(); c.arc(cx - w * 0.32, cy - h * 0.06, w * 0.09, 0, 7); c.arc(cx + w * 0.32, cy - h * 0.06, w * 0.09, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(cx, cy + h * 0.16, w * 0.38, h * 0.13, 0, 0, 7); c.fill();
  }
  c.restore();
}
function drawClaw(c, G, x, y, shut, P, xc) {
  const cx = G.X(x), cy = G.Y(y), s = G.s, sp = lerp(4.2, 1.6, shut) * s, kx = G.X(xc == null ? x : xc);
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  c.fillStyle = '#8a919d'; c.strokeStyle = P.ink; c.lineWidth = Math.max(1.5, s * 0.5);
  c.beginPath(); c.roundRect(kx - 3.4 * s, G.Y(G.rail) - 1.8 * s, 6.8 * s, 3.6 * s, 1 * s); c.fill(); c.stroke();   // the carriage on the rail
  c.strokeStyle = '#7d8592'; c.lineWidth = Math.max(1.5, s * 0.5); c.beginPath(); c.moveTo(kx, G.Y(G.rail)); c.lineTo(cx, cy - 2.4 * s); c.stroke();   // the cable, leaning as the claw swings
  c.fillStyle = '#c8ccd4'; c.strokeStyle = P.ink; c.lineWidth = Math.max(1.5, s * 0.55);
  c.beginPath(); c.roundRect(cx - 3 * s, cy - 3.2 * s, 6 * s, 3.2 * s, 1.2 * s); c.fill(); c.stroke();   // the head
  c.lineWidth = Math.max(2, s * 0.85); c.strokeStyle = P.ink;
  for (const d of [-1, 1]) { c.beginPath(); c.moveTo(cx + d * 2 * s, cy); c.quadraticCurveTo(cx + d * (sp + 1.4 * s), cy + 3.4 * s, cx + d * sp * 0.55, cy + 6.4 * s); c.stroke(); }   // two arms
  c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, cy + 5.2 * s); c.stroke();                                                                      // a third, behind
  c.restore();
}
function frame(c, G, W, H, now) {
  const P = runColours(), s = src, mini = s.mini, f = s.f, cs = clawCase(mini);
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#dff1f8'; c.fillRect(G.pad, G.pad, W - 2 * G.pad, H - 2 * G.pad);                         // the glass
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(G.X(70), G.Y(G.rail)); c.lineTo(G.X(84), G.Y(G.rail)); c.lineTo(G.X(56), G.Y(G.floor)); c.lineTo(G.X(42), G.Y(G.floor)); c.fill();   // a gleam
  c.fillStyle = '#f2d6a8'; c.fillRect(G.pad, G.Y(G.floor), W - 2 * G.pad, H - G.pad - G.Y(G.floor));        // the floor
  c.fillStyle = '#3c4250'; c.fillRect(G.X(0), G.Y(G.floor - 7), G.X(CLAW.chute) - G.X(0), G.Y(G.Hu) - G.Y(G.floor - 7));   // the chute
  c.strokeStyle = P.ink; c.lineWidth = Math.max(2, G.s * 0.6); c.strokeRect(G.X(0), G.Y(G.floor - 7), G.X(CLAW.chute) - G.X(0), G.Y(G.Hu) - G.Y(G.floor - 7));
  c.fillStyle = '#ffd34d'; c.beginPath(); c.moveTo(G.X(3), G.Y(G.floor - 4.6)); c.lineTo(G.X(CLAW.chute - 3), G.Y(G.floor - 4.6)); c.lineTo(G.X(CLAW.rest), G.Y(G.floor - 1.6)); c.fill();   // an arrow into it
  c.fillStyle = '#b8bec8'; c.fillRect(G.pad, G.Y(G.rail - 1.4), W - 2 * G.pad, 2.8 * G.s); c.strokeRect(G.pad, G.Y(G.rail - 1.4), W - 2 * G.pad, 2.8 * G.s);   // the rail
  c.lineWidth = Math.max(3, G.s * 1.2); c.strokeRect(G.pad, G.pad, W - 2 * G.pad, H - 2 * G.pad);          // the frame
  let more = false;
  // the claw's place, its grip and the prize it holds, at this moment of the move (or at rest, or where this phone aims it)
  let cx = CLAW.rest, xc = CLAW.rest, cy = G.top, shut = 0, held = null, hide = null, falling = null;
  if (s.mine && !f) {                                               // this phone's turn: the sweep, live
    const cfg = clawCfg(mini), k = sweepStep(s.zoom, mini, now), ph = mini.ph || 0;
    cx = clawPath(cfg, ph, k)[k]; xc = clawCarriage(ph, cfg.speed, k / CLAW.hz); more = true;
  }
  if (f && !REDUCED) {
    const at = fxAt('move', s.a), t = at == null ? Infinity : now - at, T = s.T, pz = f.pz, cfg = clawCfg(mini), ph = f.ph || 0, kk = f.k || 0;
    const xcAt = kk2 => clawCarriage(ph, cfg.speed, kk2 / CLAW.hz), xcDrop = f.k == null ? f.x : xcAt(kk);
    const hPz = pz ? prizeH(pz.k) : 0, yGrab = G.floor - hPz - 4.6, under = y => y + 4.6 + hPz;   // (a held prize hangs under the claw's arms)
    if (t < T.end) more = true;
    xc = xcDrop;
    // the claw: the sweep's last stretch up to the tap (someone else's grab), down, shut, up; then (a grip) across to the chute and open
    if (t < T.down) { const k2 = Math.max(0, Math.round(kk - (T.down - Math.max(0, t)) * CLAW.hz / 1000)); cx = clawPath(cfg, ph, kk)[k2]; xc = xcAt(k2); }
    else if (t < T.top) {
      cx = f.x;
      cy = t < T.closed ? lerp(G.top, yGrab, ease((t - T.down) / (T.closed - T.down))) : t < T.up ? yGrab : lerp(yGrab, G.top, ease((t - T.up) / (T.top - T.up)));
      shut = t < T.closed ? 0 : clamp((t - T.closed) / (T.up - T.closed), 0, 1);
      if (f.res === 'miss' && t >= T.up) shut = Math.max(0, 1 - (t - T.up) / 200);   // (nothing held: it opens again as it rises)
    } else if (f.res === 'miss') cx = f.x;
    else {
      const u = clamp((t - T.top) / Math.max(1, T.carry), 0, 1);
      cx = lerp(f.x, CLAW.rest, ease(u)); xc = lerp(xcDrop, CLAW.rest, ease(u)); shut = 1;
      if (f.res === 'win' && t >= T.atChute) shut = 1 - clamp((t - T.atChute) / 240, 0, 1);
    }
    // the prize it went for: on the floor where it was, then in the claw, then into the chute or back down
    if (pz && f.res !== 'miss') {
      hide = pz.id;                                                   // (the case as it is now has it elsewhere, or not at all)
      if (t < T.up) falling = { p: pz, x: pz.x, y: G.floor };
      else if (f.res === 'win') {
        if (t < T.atChute) held = pz;
        else { const v = clamp((t - T.atChute) / 240, 0, 1); if (v < 1) falling = { p: pz, x: CLAW.rest, y: lerp(under(cy), G.floor + 4, v), a: 1 - v }; }
      } else if (t < T.slipAt) held = pz;
      else {
        const v = clamp((t - T.slipAt) / CLAWT_FALL, 0, 1), sx0 = lerp(f.x, CLAW.rest, ease(clamp(f.t || 0.4, 0, 1)));
        if (v < 1) falling = { p: pz, x: lerp(sx0, f.sx, v), y: lerp(under(G.top), G.floor, v * v) }; else hide = null;
      }
    }
  }
  for (const p of cs) if (p.id !== hide) drawPrize(c, G, p, p.x, G.floor, P);
  if (falling) drawPrize(c, G, falling.p, falling.x, falling.y, P, falling.a);
  if (held) drawPrize(c, G, held, cx, cy + 4.6 + prizeH(held.k), P);
  drawClaw(c, G, cx, cy, shut, P, xc);
  return more;
}
const CLAWT_FALL = 420;
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
  const k = sweepStep(state.zoom, src.mini, performance.now());
  repNote('claw', `k=${k}`);
  attemptMove({ k });
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
// ---- the miniature: the shared case with the prizes left on its floor, beside each player's prizes won ----
export function miniature(mini, final) {
  const goal = clawCfg(mini).goal, H = 40, fl = H - 2;
  const pz = z => {                                                // a prize on the floor: a ball, a box or a plush, in its colour
    const x = 4 + z.x * 0.92, w = z.w * 1.15, col = PRIZE_COL[z.c % PRIZE_COL.length];
    if (z.k === 'box') return `<rect x="${(x - w).toFixed(1)}" y="${(fl - w * 1.5).toFixed(1)}" width="${(2 * w).toFixed(1)}" height="${(w * 1.5).toFixed(1)}" fill="${col}"/>`;
    if (z.k === 'ball') return `<circle cx="${x.toFixed(1)}" cy="${(fl - w).toFixed(1)}" r="${w.toFixed(1)}" fill="${col}"/>`;
    return `<ellipse cx="${x.toFixed(1)}" cy="${(fl - w * 0.8).toFixed(1)}" rx="${w.toFixed(1)}" ry="${(w * 0.8).toFixed(1)}" fill="${col}"/>`;
  };
  const art = `<svg class="tclaw" viewBox="0 0 100 ${H + 1}" aria-hidden="true"><rect class="tclawg" x="1" y="1" width="98" height="${H - 1}" rx="2"/><rect class="tclawc" x="2" y="${fl - 12}" width="13" height="13"/><path class="tclawr" d="M1 6h98M${(4 + CLAW.rest * 0.92).toFixed(1)} 6v6"/>${clawCase(mini).map(pz).join('')}<rect class="tclawf" x="1" y="1" width="98" height="${H - 1}" rx="2"/></svg>`;
  return thumbArt(art, pipRows(mini.won, goal), 'tclaww', `Claw Machine: X ${mini.won.X}, O ${mini.won.O} of ${goal} prizes`);
}
export function moveText(f, who) {
  const s = f.claw;
  if (!s) return `${who} grabbed`;
  return s.res === 'win' ? `${who} won a prize` : s.res === 'slip' ? `${who}'s prize slipped` : `${who} missed`;
}
// The motor as the claw slides and drops, a clunk as it closes, then: a plop into the chute and a ding; a thud as a
// slipped prize lands; for a miss, the thud of nothing.
export function sounds(f, add, won, mini, last) {
  const s = f.claw;
  if (!s) return;
  const T = clawTimes(s, ownMove(f));
  if (T.pre) add('slide', 0);
  add('slide', T.down); add('thunk', T.closed);
  if (s.res === 'win') { add('plop', T.atChute); add('ding', T.say); }
  else if (s.res === 'slip') add('thud', T.slipAt + 380);
  else add('thud', T.top);
}
// The line under the game's name while the turn is held (Go again on success).
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> won a prize · goes again`; }
