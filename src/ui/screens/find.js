// The Find Match screen and its intro.
import { acct } from '../../net/accounts.js';
import { isMM, mmIntro, search } from '../../net/matchmaking.js';
import { net } from '../../net/room.js';
import { esc, state } from '../app.js';
import { CHEV, toon } from '../art.js';
import { fmtClock } from '../clock.js';
import { RATINGS_ENABLED } from '../config.js';
import { record } from './profile.js';

export function renderIntro() {
  if (!mmIntro || !isMM() || state.screen !== 'board') return '';
  const side = s => { const p = mmIntro.players[s] || {}; return `<div class="vsp ${s}">${toon(s)}<b>${esc(p.name || s)}</b><small>${record(p.record)}</small>${mmIntro.me === s ? '<i>You</i>' : ''}</div>`; };
  return `<div class="vsintro" data-act="intro-close" role="dialog" aria-label="Your match"><div class="vscard">${side('X')}<div class="vsmid">VS</div>${side('O')}
    <p class="hint">${mmIntro.me === 'X' ? 'You go first' : `${esc((mmIntro.players.X || {}).name || 'X')} goes first`} · tap to start</p></div></div>`;
}
export function renderFind() {
  const p = acct.profile || {};
  // While searching, the way out is the Cancel under the timer: the one screen with no back button at the top left.
  const back = `<div class="bar">${search.on ? '' : `<button class="back" data-act="online-go" aria-label="Back to Play Online">${CHEV}Back</button>`}
      <div class="ttl"><b>Find Match</b><small>${esc(p.username || '')} · Super Chaos · ${RATINGS_ENABLED ? `rating ${p.rating || 1200}` : `record ${record(p)}`}</small></div></div>`;
  if (search.found) {
    return `<main class="scr setup acct-scr">${back}<div class="setup-box"><div class="searching found" role="status"><div class="big-g">${toon('X')}${toon('O')}</div><h2>Match found!</h2><p class="hint">${esc(net.msg || 'Loading the match…')}</p></div></div></main>`;
  }
  if (search.on) {
    return `<main class="scr setup acct-scr">${back}<div class="setup-box"><div class="searching" role="status" aria-live="polite">
      <div class="spinner" aria-hidden="true">${toon('X')}${toon('O')}</div><h2>Searching…</h2>
      <p class="hint"><span id="mmwait">${fmtClock(Date.now() - search.since)}</span></p>
      ${search.msg ? `<div class="warn">${esc(search.msg)}</div>` : ''}
      <button class="btn" data-act="search-cancel">Cancel</button></div></div></main>`;
  }
  // (not searching: only if a search could not start; Search tries again)
  return `<main class="scr setup acct-scr">${back}<div class="setup-box"><div class="searching" role="status">
      <div class="spinner" aria-hidden="true">${toon('X')}${toon('O')}</div>
      ${search.msg ? `<div class="warn">${esc(search.msg)}</div>` : ''}
      <button class="primary" data-act="search-go">Search</button></div></div></main>`;
}
