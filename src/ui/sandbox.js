// Admin test play: the admin dashboard's "Test play" opens the page in a new tab as
// ?sandbox=<type>&cfg=<the editor's settings, JSON in base64url>[&cpu=0|1][&sc=0|1]. One mini-game alone
// (the square in the middle; the player is held to it), with the settings from the editor, saved or not:
// they are set in this tab only (the live config is never read or written, nothing is saved, no stats or
// device events go out). Admin only: the page checks the signed-in account first. A bar at the bottom:
// Restart, the computer opponent on or off, normal or Super Chaos rules.
import { startChaos } from '../core/chaos.js';
import { setTune } from '../core/tune.js';
import { dealable, newState, seatLocal, startMatch } from '../core/match.js';
import { setBowlConfig } from '../games/bowling/rules.js';
import { setBullsConfig } from '../games/bullseye/rules.js';
import { setFlashConfig } from '../games/flash/rules.js';
import { setHeadConfig } from '../games/headcount/rules.js';
import { GAMES, INFO, TYPES } from '../games/index.js';
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
import { RNG, commit, esc, sbx, state } from './app.js';
import { render } from './render.js';

const SQ = 4;                                                // the square the game is played in
// Each tuned game's setter (the admin's cards: config/<name>); a game without settings plays as dealt.
const APPLY = Object.assign(Object.fromEntries(RUN_TYPES.map(t => [t, c => setRunConfig({ [t]: c })])), {
  bullseye: setBullsConfig, plinko: setPlinkoConfig, pig: setPigConfig, roads: setRoadsConfig, oddone: setOddConfig, wheels: setWheelsConfig,
  headcount: setHeadConfig, flash: setFlashConfig, snapshot: setSnapConfig, skyhop: setHopConfig, scoop: setScoopConfig, pinball: setPinConfig, bowling: setBowlConfig,
});
const scOk = t => !!GAMES[t].meta.superChaos, scOnly = t => !!GAMES[t].meta.scOnly;
const b64 = raw => { try { return JSON.parse(decodeURIComponent(escape(atob(raw.replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return null; } };

// The address asks for a test play: read it (the type must be a game). Returns whether this is one.
export function sandboxParams() {
  const q = new URLSearchParams(location.search), t = q.get('sandbox');
  if (t == null) return false;
  sbx.on = true;
  sbx.type = TYPES.includes(t) ? t : null;
  sbx.cfg = q.get('cfg') ? b64(q.get('cfg')) : null;
  sbx.cpu = q.get('cpu') !== '0';
  sbx.sc = sbx.type ? (scOnly(sbx.type) || (q.get('sc') === '1' && scOk(sbx.type))) : false;
  return true;
}
// The page's start in a test play: the settings, then the admin check, then the game.
export async function sandboxBoot() {
  document.body.classList.add('sbx');
  mountBar();
  if (!sbx.type) return halt('bad', 'No such mini-game.');
  if (sbx.cfg && APPLY[sbx.type]) APPLY[sbx.type](sbx.cfg);
  if (sbx.cfg && sbx.cfg.tune) setTune(sbx.type, sbx.cfg.tune);   // the game's Mini-game Settings, as the editor has them
  state.screen = 'sandbox'; render();
  await connectQuiet();
  for (let k = 0; k < 40 && !acct.admin; k++) await new Promise(r => setTimeout(r, 250));   // (the admin flag comes with the sign-in's token)
  if (!acct.admin) return halt('denied', 'Test play is for the admin only. Sign in as the admin on this device, then open it again from the dashboard.');
  for (let k = 0; k < 60 && !dealable(sbx.type, sbx.sc); k++) await new Promise(r => setTimeout(r, 250));   // (Trivia's questions, the physics engine)
  if (!dealable(sbx.type, sbx.sc)) return halt('bad', 'This mini-game could not load.');
  sbx.status = 'on';
  restart();
  setInterval(keep, 150);
}
function halt(status, msg) { sbx.status = status; sbx.msg = msg; state.screen = 'sandbox'; render(); paintBar(); }
// A fresh game: the square in the middle, X the player, O the computer (or a second player).
export function restart() {
  const st = newState(RNG);
  st.setup.local = { pick: 'X', p2: sbx.cpu || sbx.sc ? 'cpu' : 'human', n1: '', n2: '' };   // (Super Chaos needs a computer seat: without it, it simply never moves)
  seatLocal(st.setup, RNG);
  for (const t of TYPES) st.setup.games[t] = t === sbx.type;
  st.only = SQ; st.solo = sbx.sc && !sbx.cpu;
  if (!(sbx.sc ? startChaos(st, RNG) : startMatch(st, RNG))) return halt('bad', 'This mini-game could not be dealt.');
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, st);
  state.screen = 'mini'; state.zoom = SQ; state.draft = ''; state.sel = []; state.pick = null;
  sbx.at = 0;
  commit(); paintBar();
}
// Held to the one square: whenever the board comes back with the player to move (the computer's turn
// and the round's recap play on the board as ever), the square opens again a moment later.
function keep() {
  const s = state;
  if (sbx.status !== 'on' || s.screen !== 'board' || s.winner || s.spot || s.flash || s.done || s.confirm) { sbx.at = 0; return; }
  const waiting = s.sc ? (s.sc.recap || s.sc.me) : (s.cpu && s.cpu.includes(s.turn));
  if (waiting) { sbx.at = 0; return; }
  if (!sbx.at) { sbx.at = performance.now(); return; }
  if (performance.now() - sbx.at < 1200) return;            // (the board's own moment first: a stamp, the turn passing)
  sbx.at = 0;
  s.screen = 'mini'; s.zoom = SQ; s.draft = ''; s.sel = []; s.pick = null; s.notice = null;
  commit();
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
    const k = b.dataset.sbx;
    if (k === 'cpu') sbx.cpu = !sbx.cpu;
    if (k === 'sc') sbx.sc = !sbx.sc;
    if (k !== 'restart') {
      try { const u = new URL(location.href); u.searchParams.set('cpu', sbx.cpu ? '1' : '0'); u.searchParams.set('sc', sbx.sc ? '1' : '0'); history.replaceState(null, '', u); } catch (err) { /* (kept as it was) */ }
    }
    restart();
  });
  document.body.appendChild(bar);
  paintBar();
}
function paintBar() {
  if (!bar) return;
  const t = sbx.type, on = sbx.status === 'on', scLock = t && (scOnly(t) || !scOk(t));
  bar.innerHTML = `<span class="sbxname"><b>Test play</b>${t ? esc(INFO[t].name) : ''}${sbx.cfg ? ' · editor settings' : ''}</span>`
    + `<button class="btn" data-sbx="restart"${on ? '' : ' disabled'}>Restart</button>`
    + `<button class="btn" data-sbx="cpu" aria-pressed="${sbx.cpu}"${on ? '' : ' disabled'}>Computer: ${sbx.cpu ? 'On' : 'Off'}</button>`
    + `<button class="btn" data-sbx="sc" aria-pressed="${sbx.sc}"${on && !scLock ? '' : ' disabled'}${scLock && t ? ` title="${scOnly(t) ? 'Super Chaos only' : 'Not in Super Chaos'}"` : ''}>Rules: ${sbx.sc ? 'Super Chaos' : 'Normal'}</button>`;
}
