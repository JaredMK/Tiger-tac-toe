// "Please update": this client is older than the admin's minimum for its platform (config/clients: core/client.js
// needsUpdate), or the server said so when asked for a match. Nothing of the game shows until the player updates:
// the app sends them to the App Store, the web page loads the latest (net/platform.js openUpdate).
import { needsUpdate } from '../core/client.js';
import { clientInfo, NATIVE } from '../net/platform.js';
import { toon } from './art.js';

let mins = null, told = false;
export function setClientMins(v) { mins = v && typeof v === 'object' ? v : null; }
export function mustUpdate() { told = true; }                 // the server refused a match: { update: true }
export const updateNeeded = () => told || needsUpdate(clientInfo(), mins);
export function renderUpdate() {
  return `<main class="scr setup acct-scr update-scr">
    <div class="bar"><div class="ttl"><b>Please update</b><small>A newer version of Tic Tac Chaos is out</small></div></div>
    <div class="setup-box"><div class="searching" role="status"><div class="spinner still" aria-hidden="true">${toon('X')}${toon('O')}</div>
      <h2>Update to keep playing</h2><p class="hint">This version can no longer play online with everyone else.</p></div>
      <button class="primary" data-act="update-app">${NATIVE ? 'Open the App Store' : 'Load the latest version'}</button></div></main>`;
}
