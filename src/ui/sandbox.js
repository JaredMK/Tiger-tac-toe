// Admin test play (November 2026): the Games page's "Test play" opens the page in a new tab as
// ?sandbox=<type>&cfg=<the editor's settings, JSON in base64url>. A standalone game of that mini-game against the
// computer on Hard, played as How to Play's Practice is (core/match.js startPractice: the centre square alone, never
// leaving it; claiming it ends the match), with the settings from the editor, saved or not: they are set in this tab
// only (the live config is never read or written, nothing is saved, no stats or device events go out). Admin only: the
// page checks the signed-in account first. When the game ends, its result shows a moment, then the page goes back to
// the admin page (the tab closes, back to the dashboard it came from; else it opens the game's page there). The header's
// "Back to admin" does so at any moment; a bar at the bottom: Restart.
import { setTune } from '../core/tune.js';
import { dealable, newState, startPractice } from '../core/match.js';
import { setBowlConfig } from '../games/bowling/rules.js';
import { setBullsConfig } from '../games/bullseye/rules.js';
import { setFlashConfig } from '../games/flash/rules.js';
import { setHeadConfig } from '../games/headcount/rules.js';
import { INFO, SC_ONLY, TYPES } from '../games/index.js';
import { setOddConfig } from '../games/oddone/rules.js';
import { setPigConfig } from '../games/pig/rules.js';
import { setPinConfig } from '../games/pinball/rules.js';
import { setPlinkoConfig } from '../games/plinko/rules.js';
import { setRoadsConfig } from '../games/roads/rules.js';
import { setScoopConfig } from '../games/scoop/rules.js';
import { RUN_TYPES, setRunConfig } from '../games/shared/runner.js';
import { setHopConfig } from '../games/skyhop/rules.js';
import { setSnapConfig } from '../games/snapshot/rules.js';
import { setWheelsConfig } from '../games/wheels/rules.js';
import { acct, connectQuiet } from '../net/accounts.js';
import { RNG, commit, cpuTimer, esc, flashTimer, holdTimer, sbx, setCpuPlan, setCpuTimer, setFlashTimer, setHoldTimer, setSpotTimer, spotTimer, state } from './app.js';
import { repStop } from './replay.js';
import { render } from './render.js';

// Each tuned game's setter (the admin's cards: config/<name>); a game without settings plays as dealt.
const APPLY = Object.assign(Object.fromEntries(RUN_TYPES.map(t => [t, c => setRunConfig({ [t]: c })])), {
  bullseye: setBullsConfig, plinko: setPlinkoConfig, pig: setPigConfig, roads: setRoadsConfig, oddone: setOddConfig, wheels: setWheelsConfig,
  headcount: setHeadConfig, flash: setFlashConfig, snapshot: setSnapConfig, skyhop: setHopConfig, scoop: setScoopConfig, pinball: setPinConfig, bowling: setBowlConfig,
});
const b64 = raw => { try { return JSON.parse(decodeURIComponent(escape(atob(raw.replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return null; } };

// The address asks for a test play: read it (the type must be a game). Returns whether this is one.
export function sandboxParams() {
  const q = new URLSearchParams(location.search), t = q.get('sandbox');
  if (t == null) return false;
  sbx.on = true;
  sbx.type = TYPES.includes(t) ? t : null;
  sbx.cfg = q.get('cfg') ? b64(q.get('cfg')) : null;
  return true;
}
// The page's start in a test play: the settings, then the admin check, then the game.
export async function sandboxBoot() {
  document.body.classList.add('sbx');
  mountBar();
  if (!sbx.type) return halt('bad', 'No such mini-game.');
  if (SC_ONLY.includes(sbx.type)) return halt('bad', 'This mini-game is Super Chaos only, and Super Chaos is off.');
  sbx.back = leave; sbx.again = restart;
  if (sbx.cfg && APPLY[sbx.type]) APPLY[sbx.type](sbx.cfg);
  if (sbx.cfg && sbx.cfg.tune) setTune(sbx.type, sbx.cfg.tune);   // the game's Mini-game Settings, as the editor has them
  state.screen = 'sandbox'; render();
  await connectQuiet();
  for (let k = 0; k < 40 && !acct.admin; k++) await new Promise(r => setTimeout(r, 250));   // (the admin flag comes with the sign-in's token)
  if (!acct.admin) return halt('denied', 'Test play is for the admin only. Sign in as the admin on this device, then open it again from the dashboard.');
  for (let k = 0; k < 60 && !dealable(sbx.type); k++) await new Promise(r => setTimeout(r, 250));   // (Trivia's questions, the physics engine)
  if (!dealable(sbx.type)) return halt('bad', 'This mini-game could not load.');
  sbx.status = 'on';
  restart();
  setInterval(watchEnd, 250);
}
function halt(status, msg) { sbx.status = status; sbx.msg = msg; state.screen = 'sandbox'; render(); paintBar(); }
// A fresh game: Practice's (the centre square alone, the side drawn), the computer on Hard.
const stopTimers = () => {
  clearTimeout(cpuTimer); setCpuTimer(null); setCpuPlan(null); clearTimeout(spotTimer); setSpotTimer(null);
  clearTimeout(flashTimer); setFlashTimer(null); clearTimeout(holdTimer); setHoldTimer(null); repStop();
};
export function restart() {
  stopTimers(); sbx.endAt = 0;
  const st = newState(RNG);
  if (!startPractice(st, RNG, sbx.type, '', 'hard')) return halt('bad', 'This mini-game could not be dealt.');
  st.practice.test = true;                                       // (the header's Back to admin, the end card's Play again and Back to admin: ui/explainer.js)
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, st);
  state.draft = ''; state.sel = []; state.pick = null;
  commit(); paintBar();
}
// Back to the admin page: this tab was opened by the dashboard (its Test play), so it closes and the dashboard is
// there as it was, unsaved edits and all; a tab that cannot close (opened another way) opens the game's admin page.
export function leave() {
  stopTimers(); sbx.status = 'left';
  try { window.close(); } catch (e) { /* (it cannot: below) */ }
  setTimeout(() => { location.replace(new URL('admin.html#games/' + encodeURIComponent(sbx.type || ''), location.href).href); }, 300);
}
// The game's end: the result held in the square, then the end card (Practice's flow); a moment on the end card, then
// back to the admin page by itself (Play again first stays).
export const TEST_END_MS = 3500;
function watchEnd() {
  if (sbx.status !== 'on' || state.screen !== 'win' || !state.winner) { sbx.endAt = 0; return; }
  if (!sbx.endAt) { sbx.endAt = performance.now(); return; }
  if (performance.now() - sbx.endAt >= TEST_END_MS) leave();
}
// The screen while it checks or when it cannot run (state.screen 'sandbox', from render.js).
export function renderSandbox() {
  const name = sbx.type ? esc(INFO[sbx.type].name) : 'Test play';
  const msg = sbx.status === 'checking' ? 'Checking the admin sign-in…' : esc(sbx.msg || '');
  return `<main class="scr sbxwait"><div class="card"><h2>${name}</h2><p>${msg}</p></div></main>`;
}
// The bar: fixed under the game (the page is that much shorter: nothing is covered).
let bar = null;
function mountBar() {
  bar = document.createElement('div');
  bar.className = 'sbxbar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Test play');
  bar.addEventListener('click', e => {
    const b = e.target.closest('button[data-sbx]');
    if (!b || b.disabled || sbx.status !== 'on') return;
    if (b.dataset.sbx === 'back') leave(); else restart();
  });
  document.body.appendChild(bar);
  paintBar();
}
function paintBar() {
  if (!bar) return;
  const t = sbx.type, on = sbx.status === 'on';
  bar.innerHTML = `<span class="sbxname"><b>Test play</b>${t ? esc(INFO[t].name) : ''} · vs Hard${sbx.cfg ? ' · editor settings' : ''}</span>`
    + `<button class="btn" data-sbx="restart"${on ? '' : ' disabled'}>Restart</button>`
    + `<button class="btn" data-sbx="back">Back to admin</button>`;
}
