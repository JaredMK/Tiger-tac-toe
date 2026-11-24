// The moment of a press (December 2026): every timed stop (Darts Cricket, Bullseye, Target Practice, Key Drop, Home Run
// Heroes, Barrel Launch) takes the moment the finger came down (or up, for a hold let go; the key for the keyboard):
// the event's own `timeStamp`, on the clock performance.now() reads, never the moment the page got round to handling it.
// On a busy phone (a frame being drawn, a long task) the handling comes tens of ms later, and a click only after the
// finger has lifted: measured in Chromium at 4x CPU with a 100 ms task, 115-165 ms late on the press and 240-285 ms
// on a button's click. A stop is handled on the press itself (pointerdown, or keydown for Space and Enter on its
// button); the click that follows a press already taken does nothing (`pressTaken`), so a tap counts once.
export const PRESS = { last: null, maxAge: 2000, clickMs: 1500 };
let taken = null;                                                  // the control whose press was taken: { key, at }
// The moment (performance.now()'s clock) of the press `e`: its timeStamp, where that is a moment on this clock in the
// last `maxAge` ms (an event without one, or an old browser's epoch timestamp: the moment now).
export function pressTime(e) {
  const now = performance.now(), ts = e && typeof e.timeStamp === 'number' ? e.timeStamp : NaN;
  const at = Number.isFinite(ts) && ts > 0 && ts <= now + 1 && now - ts <= PRESS.maxAge ? Math.min(ts, now) : now;
  PRESS.last = { ts, now, at };
  return at;
}
// A control's press taken (its stop made, or refused, on the press; `key` its data-act, since a redraw may put a new
// button in its place before the click): the click the browser sends once the finger lifts (or a key's activation) is
// not another tap.
export function pressTook(key) { taken = { key, at: performance.now() }; }
// The click on the control `key` after its press was already taken: true once, then forgotten. A click with no press
// before it (a screen reader's, a test's) is a tap.
export function pressTaken(key) {
  const t = taken; taken = null;
  return !!t && t.key === key && performance.now() - t.at < PRESS.clickMs;
}
