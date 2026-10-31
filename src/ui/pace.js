// The player's Animation setting: Normal (the game as designed) or Speed (core/timer.js ANIM.mode: everything at
// ANIM.fast times the pace, overlaps, a tap finishing what plays, the shake and confetti of ui/fx.js). It is this
// screen's alone: never the rules, the timers or what the other player sees. Kept on the device (KEY + '.anim')
// and, logged in, on the account (prefs/{uid}/anim: net/accounts.js), which wins when it says something.
import { ANIM, setAnimMode } from '../core/timer.js';
import { saveAnimPref } from '../net/accounts.js';
import { KEY } from './config.js';
import { render } from './render.js';

const LKEY = KEY + '.anim';
function apply(m) {
  setAnimMode(m);
  try { document.documentElement.classList.toggle('spd', ANIM.mode === 'speed'); } catch (e) { /* (no page: the tests) */ }
}
// At boot: the device's choice (Normal by default).
export function paceInit() {
  let m = 'normal';
  try { m = localStorage.getItem(LKEY) || 'normal'; } catch (e) { /* no storage: Normal */ }
  apply(m);
}
// A choice: made here (saved to the account too), or the account's arriving (fromAccount).
export function setPace(m, fromAccount) {
  apply(m);
  try { localStorage.setItem(LKEY, ANIM.mode); } catch (e) { /* no storage: this visit */ }
  if (!fromAccount) saveAnimPref(ANIM.mode);
  render();
}
