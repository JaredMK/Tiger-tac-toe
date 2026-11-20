// The Game lineup (December 2026): a small panel on the main menu's top row, beside the account chip (so Play stays
// where it is), opening a sheet over the menu: "In rotation now", the games released for this platform (the admin's
// release switches: core/games.js releasedOn), and "Coming soon", the games the admin has marked so (releases/soon/{type},
// never one released on this platform), each with its board icon (art.js gameIcon) and name, a "Coming soon" sticker on
// the second list and no dates. Hidden until this device has finished a match (ui/onboard.js matchesDone), so never on a
// first visit. A NEW burst on the panel while a game is in either list that this device has not seen there since it last
// opened the sheet (kept on the device, KEY + '.lineup': the lists as last seen; never opened: NEW).
import { clientHas } from '../core/client.js';
import { lineup } from '../core/games.js';
import { INFO } from '../games/index.js';
import { PLATFORM, clientInfo } from '../net/platform.js';
import { releases } from '../net/releases.js';
import { esc } from './app.js';
import { gameIcon } from './art.js';
import { softName } from './board.js';
import { KEY } from './config.js';
import { fxAttr } from './fx.js';
import { matchesDone } from './onboard.js';

const LU_KEY = KEY + '.lineup';
const lu = (() => { try { const v = JSON.parse(localStorage.getItem(LU_KEY) || 'null'); if (v && typeof v === 'object' && v.seen && typeof v.seen === 'object') return { seen: v.seen }; } catch (e) { /* none kept */ } return { seen: null }; })();
const save = () => { try { localStorage.setItem(LU_KEY, JSON.stringify(lu)); } catch (e) { /* no storage: NEW again next visit */ } };
export const luState = lu;

// The lists for this platform and client (an older app leaves out the games it does not have).
export const lineupNow = () => lineup(releases, PLATFORM, t => clientHas(clientInfo(), t));
const keysOf = L => L.now.map(t => 'r:' + t).concat(L.soon.map(t => 's:' + t));
// Shown on the menu: once this device has finished a match.
export const lineupShown = () => matchesDone() >= 1;
// NEW: never opened, or a game in a list it was not in when the sheet was last opened.
export function lineupNew(L = lineupNow()) {
  if (!lu.seen) return true;
  return keysOf(L).some(k => !lu.seen[k]);
}
export function markSeen(L = lineupNow()) { lu.seen = Object.fromEntries(keysOf(L).map(k => [k, 1])); save(); }

// The sheet: open or shut (the menu's panel and the sheet's Done; a tap on the dimmed menu too).
export let lineupOpen = false;
let openAt = 0;
export function setLineupOpen(v) { lineupOpen = !!v; if (lineupOpen) { openAt = performance.now(); markSeen(); } }
const tile = (t, soon) => `<li class="lut${soon ? ' soon' : ''}">${gameIcon(t)}<b>${softName(esc(INFO[t].name))}</b>${soon ? '<i class="lusoon">Coming soon</i>' : ''}</li>`;
export function renderLineup(screen) {
  if (screen !== 'menu') lineupOpen = false;          // (shut once the menu is left)
  if (!lineupOpen) return '';
  const L = lineupNow();
  return `<div class="gsheet-root lineup cc calm"${fxAttr(Math.round(openAt))}><div class="gsheet-dim" data-act="lineup" aria-hidden="true"></div><div class="gsheet in" role="dialog" aria-modal="true" aria-label="Game lineup"><div class="gsh-bar"><b>Lineup</b><small class="gsh-n">${L.now.length} in rotation</small><button class="pn y gdone" data-act="lineup"><b>Done</b></button></div>
    <div class="gsh-body" data-keep-scroll="lineup"><h2 class="cap luh">In rotation now</h2><ul class="lulist">${L.now.map(t => tile(t, false)).join('')}</ul>
      ${L.soon.length ? `<h2 class="cap luh">Coming soon</h2><ul class="lulist">${L.soon.map(t => tile(t, true)).join('')}</ul>` : ''}</div></div></div>`;
}
// The menu's panel (its top row, left, the account chip's twin: a small skewed panel), a NEW burst on its corner while
// something is new.
export function lineupButton() {
  if (!lineupShown()) return '';
  const isNew = lineupNew();
  return `<button class="btn lubtn" data-act="lineup" aria-haspopup="dialog" aria-label="Game lineup${isNew ? ': new games' : ''}"><span>Lineup</span>${isNew ? '<i class="lunew" aria-hidden="true">NEW</i>' : ''}</button>`;
}
