// Owner devices (December 2026): the admin's own devices are left out of every stat by default (functions/index.js markDevice,
// statsRules.js metaFor: devmeta/). This device marks itself as the owner's three ways: by signing in to an admin account
// (ownerAuto, once per device; the server's devlog does it too), by Settings' "Mark this device as mine" (admin only:
// markMine) and by the owner link (?owner=<token>, the token the admin set on the Devices page: ownerLink, no login needed).
// Settings shows the device's short ID (devShort: the first 8 hex of the server's own hash of this device's id, the ID the
// admin's Devices page shows), so a tester can say which device is theirs.
import { dropParam, startLink } from './platform.js';
import { connectQuiet } from './accounts.js';
import { call, configured, fb } from './connect.js';
import { devIdAny } from './tracking.js';
import { KEY } from '../ui/config.js';

const OWN_KEY = KEY + '.owner';
let short = null, shortBusy = null;
// The short device ID: sha256('ttc-dev:' + id), its first 8 hex (statsRules.js devHash takes 20). Null until worked out
// (a moment after the page starts); never shown where the browser cannot hash.
export function devShort() { if (short === null && !shortBusy) shortBusy = workShort(); return short; }
export async function workShort() {
  try {
    const bytes = new TextEncoder().encode('ttc-dev:' + devIdAny());
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    short = Array.from(d.slice(0, 4), b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) { short = ''; }
  return short;
}
// Marked as the owner's on this device already (by any of the three ways).
export function markedMine() { try { return localStorage.getItem(OWN_KEY) === '1'; } catch (e) { return false; } }
function remember() { try { localStorage.setItem(OWN_KEY, '1'); } catch (e) { /* no storage: the server has it */ } }
async function mark(why, token) {
  if (!configured()) return false;
  try {
    if (!(fb && fb.fns && fb.uid) && !(await connectQuiet())) return false;
    const r = await call('markDevice', Object.assign({ dev: devIdAny(), why }, token ? { token } : {}));
    if (r && r.ok) { remember(); return true; }
  } catch (e) { /* refused or offline: false */ }
  return false;
}
// An admin account on this device: marked once (the server keeps it for good, logged out or a guest later).
export function ownerAuto() { if (!markedMine()) mark('admin'); }
// Settings' button (admin only): true once the server has it.
export const markMine = () => mark('self');
// The owner link's token, read once from the address it was opened with (then taken out of it).
export function linkToken(url) {
  try { const v = new URL(url, 'https://tictacchaos.com/').searchParams.get('owner'); return v && /^[A-Za-z0-9_-]{16,64}$/.test(v) ? v : null; } catch (e) { return null; }
}
export async function ownerLink(done) {
  const tok = linkToken(startLink());
  dropParam('owner');
  if (!tok) return false;
  const ok = await mark('link', tok);
  if (done) done(ok);
  return ok;
}
