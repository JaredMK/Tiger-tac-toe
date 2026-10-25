// Which mini-games are released (the admin's switches), and whether this player is an admin.
import { SUPER_CHAOS_ENABLED } from '../core/config.js';
import { allowedTypes, isReleased } from '../core/games.js';
import { acct } from './accounts.js';
import { FIREBASE_CONFIG, configured } from './connect.js';
import { state } from '../ui/app.js';
import { KEY } from '../ui/config.js';
import { render } from '../ui/render.js';

// Release control (engine.js: isReleased): which mini-games are released, as the database last said
// (releases/{type}, read at every start and followed live once online; kept for the next visit). An
// admin-only game exists only for the admin: in their local matches and the friend games they host.
const REL_KEY = KEY + '.releases';
export let releases = (() => { try { const v = JSON.parse(localStorage.getItem(REL_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } })();
export function setReleases(v) {
  const next = v && typeof v === 'object' ? v : {};
  if (JSON.stringify(next) === JSON.stringify(releases)) return;
  releases = next;
  try { localStorage.setItem(REL_KEY, JSON.stringify(releases)); } catch (e) { /* no storage: read again next visit */ }
  if (['setup', 'howto', 'join'].includes(state.screen)) render();
}
export function fetchReleases() {                                     // a plain read of the public node, SDK or no SDK
  if (!configured()) return;
  const hook = window.TTT_FIREBASE, c = (hook && hook.config) || FIREBASE_CONFIG;
  const url = hook && hook.emulator ? `http://${hook.emulator.host}:${hook.emulator.port}/releases.json?ns=${c.projectId}-default-rtdb` : `${c.databaseURL}/releases.json`;
  try { fetch(url).then(r => (r.ok ? r.json() : undefined)).then(v => { if (v !== undefined) setReleases(v || {}); }).catch(() => {}); } catch (e) { /* offline: as last known */ }   // (an empty node, null: nothing released any more)
}
const isAdmin = () => !!(acct && acct.admin);
export const visibleTypes = () => allowedTypes(releases, isAdmin());     // the games this player may see and play
export const testBadge = t => (isReleased(t, releases) ? '' : '<i class="tst">Testing</i>');   // (only the admin ever sees one)
// Super Chaos (simultaneous rounds) is off everywhere for now, admins included (core/config.js SUPER_CHAOS_ENABLED):
// every match is Classic and no mode is offered anywhere. Its code stays: with the switch back on, it is always open
// against the computer, and online (a friend room's host; Find Match is the server's) it has its own release switch,
// releases/superchaos, admin only until the admin's dashboard releases it (true). (Each environment has its own
// database, so that switch is set per environment.)
export const chaosReleased = () => SUPER_CHAOS_ENABLED && releases.superchaos === true;
export const chaosVisible = () => SUPER_CHAOS_ENABLED && (isAdmin() || chaosReleased());
// The game mode, Super Chaos or Classic: one choice for Play Local and the host's room, kept on this device. Super
// Chaos by default; in Play Local always offered (scPicked), in a host's room only where it is open (scMode).
const MODE_KEY = KEY + '.mode';
let modePick = (() => { try { return localStorage.getItem(MODE_KEY); } catch (e) { return null; } })();
export const scPicked = () => SUPER_CHAOS_ENABLED && modePick !== 'classic';
export const scMode = () => chaosVisible() && scPicked();
export function setMode(m) { modePick = m === 'classic' ? 'classic' : 'chaos'; try { localStorage.setItem(MODE_KEY, modePick); } catch (e) { /* this visit only */ } }
export const chaosBadge = () => (chaosReleased() ? '' : '<i class="tst">Testing</i>');
