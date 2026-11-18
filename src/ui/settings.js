// The player's Settings: Sound (on or off, and its volume), Animation (Normal | Speed: ui/pace.js) and Vibration (on or
// off: shown only where the device can buzz, net/platform.js canVibrate). One screen from the main menu ('settings'), and
// the same controls in the in-game menu (its Settings step). Each is kept on the device (audio/sound.js, ui/pace.js,
// net/platform.js) and, logged in, on the account (prefs/{uid}: sound 'on'|'off', vol 0-100, anim, vib true|false;
// net/accounts.js), whose value wins when it says something; a setting the account lacks gets this device's.
import { SND } from '../audio/sound.js';
import { ANIM } from '../core/timer.js';
import { acct, loggedIn, savePref } from '../net/accounts.js';
import { devShort, markedMine } from '../net/owner.js';
import { accountRow, deleteDialog } from './screens/account-row.js';
import { canVibrate, setVibOn, vibOn } from '../net/platform.js';
import { app, esc } from './app.js';
import { APP_VERSION, SUPPORT_EMAIL } from './config.js';
import { setPace } from './pace.js';
import { render } from './render.js';
import { CHEV } from './art.js';

const pick = (act, v, on, label) => `<button class="pk${on ? ' on' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${on}">${label}</button>`;
const row = (name, body, cls) => `<div class="setrow${cls ? ' ' + cls : ''}" role="group" aria-label="${name}"><span class="setname">${name}</span><span class="setctl">${body}</span></div>`;
const volPct = () => Math.round(SND.volume * 100);
// The controls themselves (the Settings screen, and the in-game menu's Settings step).
// Help (December 2026): Report a problem (ui/report.js: from anywhere, the screen it came from noted; the in-game menu has
// its own button) and Contact support (an email to SUPPORT_EMAIL; the app hands mailto: links to Mail).
const supportHref = () => `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Tic Tac Chaos support')}&body=${encodeURIComponent(`\n\n(Build ${APP_VERSION})`)}`;
export function settingsBody(o) {
  const help = `<div class="sethelp">${o && o.report ? '<button class="btn repset" data-act="set-report">Report a problem</button>' : ''}<a class="btn support" href="${supportHref()}" aria-label="Contact support by email">Contact support</a></div>`;
  return `<div class="settings">${row('Sound', pick('set-sound', 'on', !SND.muted, 'On') + pick('set-sound', 'off', SND.muted, 'Off'))}
    ${row('Volume', `<input id="setvol" class="setvol" type="range" min="0" max="100" step="5" value="${volPct()}" aria-label="Volume"${SND.muted ? ' disabled' : ''}><b class="volnum" aria-hidden="true">${volPct()}</b>`, 'vol')}
    ${row('Animation', pick('anim-set', 'normal', ANIM.mode !== 'speed', 'Normal') + pick('anim-set', 'speed', ANIM.mode === 'speed', 'Speed'))}
    ${canVibrate() ? row('Vibration', pick('set-vib', 'on', vibOn, 'On') + pick('set-vib', 'off', !vibOn, 'Off')) : ''}
    ${help}
    ${o && o.account && loggedIn() ? accountRow() : ''}
    ${buildLine(o)}</div>`;   // (the build on this phone: a stale page is seen for what it is)
}
// The foot: the build, this device's short ID (net/owner.js devShort: the ID the admin's Devices page shows, so a tester can
// say which device is theirs) and, for an admin on the Settings screen, "Mark this device as mine" (its stats left out by
// default: functions/index.js markDevice), or a tick once it is.
let markNote = '';
export function setMarkNote(v) { markNote = v; }
function buildLine(o) {
  const id = devShort();
  const mine = o && o.account && acct.admin ? (markedMine() || markNote === 'ok' ? '<span class="devmine">Marked as yours ✓</span>' : `<button class="link devmark" data-act="set-mine"${markNote === 'busy' ? ' disabled' : ''}>${markNote === 'fail' ? 'Not marked: try again' : 'Mark this device as mine'}</button>`) : '';
  return `<p class="build" aria-label="Build ${esc(APP_VERSION)}${id ? `, device ${esc(id)}` : ''}">Build ${esc(APP_VERSION)}${id ? ` · Device <b class="devid">${esc(id)}</b>` : ''}</p>${mine ? `<p class="build devown">${mine}</p>` : ''}`;
}
// The Settings screen, from the main menu.
export function renderSettings() {
  return `<main class="scr setup settings-scr cc calm">
    <div class="bar"><button class="back" data-act="menu" aria-label="Back to the main menu">${CHEV}Menu</button>
      <div class="ttl"><b>Settings</b></div></div>
    <div class="setup-box">${settingsBody({ report: true, account: true })}</div>${loggedIn() ? deleteDialog() : ''}</main>`;
}
// A choice made here: on this device at once, on the account too (fromAccount: the account's own, arriving).
export function setSound(on, fromAccount) {
  SND.setMuted(!on);
  if (on && !fromAccount) SND.play('toggle');
  if (!fromAccount) savePref('sound', on ? 'on' : 'off');
  render();
}
export function setVolume(pct, fromAccount, save) {
  SND.setVolume(pct);
  if (!fromAccount && save) savePref('vol', volPct());
  const n = app && app.querySelector ? app.querySelector('.volnum') : null;   // (while dragging: the number only, so the slider keeps the finger)
  if (n) n.textContent = String(volPct());
  if (fromAccount) render();
}
export function setVibration(on, fromAccount) {
  setVibOn(on);
  if (!fromAccount) savePref('vib', !!on);
  render();
}
// The account's settings arriving (prefs/{uid}, net/accounts.js): each it holds is applied here; each it lacks is filled
// from this device, so a new account starts with what this phone had.
export function applyAccountPrefs(p) {
  p = p && typeof p === 'object' ? p : {};
  if (p.anim === 'normal' || p.anim === 'speed') { if (p.anim !== ANIM.mode) setPace(p.anim, true); } else savePref('anim', ANIM.mode === 'speed' ? 'speed' : 'normal');
  if (p.sound === 'on' || p.sound === 'off') { if ((p.sound === 'off') !== SND.muted) setSound(p.sound === 'on', true); } else savePref('sound', SND.muted ? 'off' : 'on');
  if (Number.isInteger(p.vol) && p.vol >= 0 && p.vol <= 100) { if (p.vol !== volPct()) setVolume(p.vol, true); } else savePref('vol', volPct());
  if (typeof p.vib === 'boolean') { if (p.vib !== vibOn) setVibration(p.vib, true); } else savePref('vib', vibOn);
}
// Its listener: main.js calls this once. The volume slider (no click to take): the sound follows the drag; the account
// is written once the finger lets go.
export function init() {
  document.addEventListener('input', e => { if (e.target && e.target.id === 'setvol') setVolume(e.target.value, false, false); });
  document.addEventListener('change', e => { if (e.target && e.target.id === 'setvol') { setVolume(e.target.value, false, true); SND.play('toggle'); } });
}
