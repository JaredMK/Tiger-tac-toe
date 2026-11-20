// A flick on a play area (Marble Toss, Shuffleboard, Bin Shot): `flickPad(selector, fn)` gives a function that hooks
// the page once; from then on a swipe that starts on an element matching the selector and goes up the screen calls
// fn({ ang, v, len }): `ang` its angle from straight up (radians, positive to the right), `v` the finger's speed over
// its last 80 ms (CSS px a ms, not scaled by the screen), `len` its length in px. A swipe too short or more sideways
// than up is nothing. The view decides whether a flick may be made (its selector matches only a live pad).
import { app, state } from './app.js';
import { FLICK } from '../games/shared/flick.js';
import { runInputAt } from './runner.js';

const pads = [];
let drag = null, hooked = false;
function hook() {
  if (hooked || !app || typeof app.addEventListener !== 'function') return;
  hooked = true;
  app.addEventListener('pointerdown', e => {
    if (state.screen !== 'mini' || !runInputAt(e.target) || !e.target.closest || e.target.closest('button')) return;
    const pad = pads.find(q => e.target.closest(q.sel)); if (!pad) return;
    drag = { id: e.pointerId, pad, x0: e.clientX, y0: e.clientY, pts: [[performance.now(), e.clientX, e.clientY]] };
    e.preventDefault();
  }, { passive: false });
  app.addEventListener('pointermove', e => {
    const d = drag; if (!d || e.pointerId !== d.id) return;
    const now = performance.now(); d.pts.push([now, e.clientX, e.clientY]);
    while (d.pts.length > 2 && now - d.pts[1][0] > 160) d.pts.shift();
  });
  app.addEventListener('pointerup', e => {
    const d = drag; if (!d || e.pointerId !== d.id) return;
    drag = null;
    const now = performance.now(), dx = e.clientX - d.x0, dy = d.y0 - e.clientY;
    if (!(dy >= FLICK.minLen) || Math.abs(dx) > dy * FLICK.wide) return;
    let b = d.pts[0]; for (const q of d.pts) if (now - q[0] >= 80) b = q; else break;
    const v = Math.hypot(e.clientX - b[1], e.clientY - b[2]) / Math.max(16, now - b[0]);
    d.pad.fn({ ang: Math.atan2(dx, dy), v, len: Math.hypot(dx, dy) });
  });
  app.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.id) drag = null; });
}
export function flickPad(sel, fn) { pads.push({ sel, fn }); return hook; }
