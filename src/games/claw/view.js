// Claw Machine: the screen, the miniature, the move's words and sounds, and the inputs.
import { CLAW, CLAW_KINDS, clawAim, clawCfg, clawTimes } from './rules.js';
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

// Claw Machine (November 2026): the mover's glass case drawn on a canvas (its frame, the rail across the top, the
// chute at the left, the prizes on the floor), the claw hanging from the rail. On this phone's turn a drag anywhere on
// the case moves the claw across (by the finger's travel: clawAim, pure), and a tap (or Drop) drops it there: the move
// is { x }. What the grab did is the move's (the server's draw online); the claw plays it from the move's event
// (fxAt('move')): it slides out from over the chute (not for this phone's own grab: the claw is already there), comes
// down, closes, rises with the prize or without, carries it to the chute and lets go; a slip drops it back into the
// case part way. The result in the reserved line under the case.
export const PRIZE_COL = ['#e5605a', '#4e9de0', '#7cc457', '#f2b33d', '#b07fe0', '#f08bb8'];
let draft = null;              // this phone's aim: { sq, x }
let drag = null;               // a finger on the case: { id, x0, cx0, moved, px }
let src = null, raf = 0;       // what the last render drew; the paint loop
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a) * u, ease = u => u * u * (3 - 2 * u);
const aimOf = sq => (draft && draft.sq === sq ? draft.x : CLAW.rest);
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
  const left = (mini.case[by] || []).length;
  return `<div class="g-arc g-claw"><div class="ctals">${tal('X')}${tal('O')}</div>
    <div class="claw${mine ? ' live' : ''}" data-claw="area"><span class="clawlab">Machine · <b class="${by}">${N(by)}</b></span><canvas class="clawcv" data-claw="cv" aria-label="${N(by)}'s case: ${left} prizes"></canvas></div>
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
function drawClaw(c, G, x, y, shut, P) {
  const cx = G.X(x), cy = G.Y(y), s = G.s, sp = lerp(4.2, 1.6, shut) * s;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = '#7d8592'; c.lineWidth = Math.max(1.5, s * 0.5); c.beginPath(); c.moveTo(cx, G.Y(G.rail)); c.lineTo(cx, cy - 2.4 * s); c.stroke();   // the cable
  c.fillStyle = '#c8ccd4'; c.strokeStyle = P.ink; c.lineWidth = Math.max(1.5, s * 0.55);
  c.beginPath(); c.roundRect(cx - 3 * s, cy - 3.2 * s, 6 * s, 3.2 * s, 1.2 * s); c.fill(); c.stroke();   // the head
  c.lineWidth = Math.max(2, s * 0.85); c.strokeStyle = P.ink;
  for (const d of [-1, 1]) { c.beginPath(); c.moveTo(cx + d * 2 * s, cy); c.quadraticCurveTo(cx + d * (sp + 1.4 * s), cy + 3.4 * s, cx + d * sp * 0.55, cy + 6.4 * s); c.stroke(); }   // two arms
  c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, cy + 5.2 * s); c.stroke();                                                                      // a third, behind
  c.restore();
}
function frame(c, G, W, H, now) {
  const P = runColours(), s = src, mini = s.mini, f = s.f, cs = (mini.case[s.by] || []);
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
  let cx = s.mine ? aimOf(s.zoom) : CLAW.rest, cy = G.top, shut = 0, held = null, hide = null, falling = null;
  if (f && !REDUCED) {
    const at = fxAt('move', s.a), t = at == null ? Infinity : now - at, T = s.T, pz = f.pz, from = s.own ? f.x : CLAW.rest;
    const hPz = pz ? prizeH(pz.k) : 0, yGrab = G.floor - hPz - 4.6, under = y => y + 4.6 + hPz;   // (a held prize hangs under the claw's arms)
    if (t < T.end) more = true;
    // the claw: out over its spot, down, shut, up; then (a grip) across to the chute and open
    if (t < T.down) cx = lerp(from, f.x, ease(clamp(t / Math.max(1, T.down), 0, 1)));
    else if (t < T.top) {
      cx = f.x;
      cy = t < T.closed ? lerp(G.top, yGrab, ease((t - T.down) / (T.closed - T.down))) : t < T.up ? yGrab : lerp(yGrab, G.top, ease((t - T.up) / (T.top - T.up)));
      shut = t < T.closed ? 0 : clamp((t - T.closed) / (T.up - T.closed), 0, 1);
      if (f.res === 'miss' && t >= T.up) shut = Math.max(0, 1 - (t - T.up) / 200);   // (nothing held: it opens again as it rises)
    } else if (f.res === 'miss') cx = f.x;
    else {
      const u = clamp((t - T.top) / Math.max(1, T.carry), 0, 1);
      cx = lerp(f.x, CLAW.rest, ease(u)); shut = 1;
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
  drawClaw(c, G, cx, cy, shut, P);
  if (s.mine && !f) {                                               // this phone's aim: a dashed line down to the floor
    c.save(); c.setLineDash([3, 4]); c.strokeStyle = 'rgba(22,18,16,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(G.X(cx), G.Y(cy + 7)); c.lineTo(G.X(cx), G.Y(G.floor)); c.stroke(); c.restore();
  }
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
function drop() {
  if (zoomedType() !== 'claw' || state.screen !== 'mini' || state.flash || state.done || blocked() || !src || !src.mine) return;
  const x = aimOf(state.zoom);
  repNote('claw', `x=${x}`);
  attemptMove({ x });
}
export const actions = { 'claw-drop': () => { ownPress(); drop(); } };
let hooked = false;
function hook() {                                                   // the case's own pointer handling (once, the first time it is drawn)
  if (hooked || typeof app.addEventListener !== 'function') return;
  hooked = true;
  app.addEventListener('pointerdown', e => {
    const area = e.target.closest && e.target.closest('.claw.live[data-claw="area"]');
    if (!area || drag || !src || !src.mine) return;
    const cv = area.querySelector('canvas'), w = cv ? cv.getBoundingClientRect().width : 0;
    drag = { id: e.pointerId, x0: e.clientX, cx0: aimOf(state.zoom), moved: false, ppu: w > 0 ? (w - 12) / CLAW.W : 3 };
    try { area.setPointerCapture(e.pointerId); } catch (err) { /* the move and up still reach the page */ }
    e.preventDefault();
  });
  app.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    if (Math.abs(dx) > 6) drag.moved = true;
    if (!drag.moved) return;
    draft = { sq: state.zoom, x: clawAim(drag.cx0, dx, drag.ppu) };
    schedule();
  });
  app.addEventListener('pointerup', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.moved) { ownPress(); drop(); }                            // a tap: drop the claw where it is
  });
  app.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.id) drag = null; });
}
// Someone else's grab: no inputs to press (their aim is the claw's slide in the move itself).
export const replay = { synth: () => [] };
// ---- the miniature: each player's case, the prizes left on its floor, beside the prizes won ----
export function miniature(mini, final) {
  const goal = clawCfg(mini).goal, H = 34, fl = H - 2;
  const pz = z => {                                                // a prize on the floor: a ball, a box or a plush, in its colour
    const x = 4 + z.x * 0.92, w = z.w * 1.05, col = PRIZE_COL[z.c % PRIZE_COL.length];
    if (z.k === 'box') return `<rect x="${(x - w).toFixed(1)}" y="${(fl - w * 1.5).toFixed(1)}" width="${(2 * w).toFixed(1)}" height="${(w * 1.5).toFixed(1)}" fill="${col}"/>`;
    if (z.k === 'ball') return `<circle cx="${x.toFixed(1)}" cy="${(fl - w).toFixed(1)}" r="${w.toFixed(1)}" fill="${col}"/>`;
    return `<ellipse cx="${x.toFixed(1)}" cy="${(fl - w * 0.8).toFixed(1)}" rx="${w.toFixed(1)}" ry="${(w * 0.8).toFixed(1)}" fill="${col}"/>`;
  };
  const box = (p, y) => `<g transform="translate(0 ${y})"><rect class="tclawg" x="1" y="1" width="98" height="${H - 1}" rx="2"/><rect class="tclawc" x="2" y="${fl - 10}" width="13" height="11"/><path class="tclawr" d="M1 5h98M${(4 + CLAW.rest * 0.92).toFixed(1)} 5v5"/>${(mini.case[p] || []).map(pz).join('')}<rect class="tclawf" x="1" y="1" width="98" height="${H - 1}" rx="2"/></g>`;
  const art = `<svg class="tclaw" viewBox="0 0 100 ${2 * H + 6}" aria-hidden="true">${box('X', 0)}${box('O', H + 6)}</svg>`;
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
  if (T.slide) add('slide', 0);
  add('slide', T.down); add('thunk', T.closed);
  if (s.res === 'win') { add('plop', T.atChute); add('ding', T.say); }
  else if (s.res === 'slip') add('thud', T.slipAt + 380);
  else add('thud', T.top);
}
// The line under the game's name while the turn is held (Go again on success).
export function heldSub(mini, turn, f, a) { return f ? '' : `<b class="${turn}">${N(turn)}</b> won a prize · goes again`; }
