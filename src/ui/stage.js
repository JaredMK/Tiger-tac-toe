// A canvas a view repaints frame by frame while something on it moves (the December 2026 games): `stage(selector,
// paint)` gives a function that starts the loop (again, from the latest render); paint(c, W, H, now) draws one frame and
// returns false once nothing more will move. The canvas is looked up each frame, so a redraw of the page carries on.
import { app } from './app.js';
import { runCanvas } from './runner.js';
export function stage(sel, paint) {
  let raf = 0;
  const loop = now => {
    raf = 0;
    const cv = app && app.querySelector ? app.querySelector(sel) : null;
    if (!cv || typeof cv.getContext !== 'function') return;
    const { c, W, H } = runCanvas(cv);
    if (W < 2 || H < 2) return;
    if (paint(c, W, H, now == null ? performance.now() : now) !== false) raf = requestAnimationFrame(loop);
  };
  return () => { if (typeof requestAnimationFrame !== 'function') return; if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); };
}
