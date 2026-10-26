// "This match uses a mini-game this version doesn't have": an online match (Find Match's or a friend room's) holding a
// mini-game this client lacks, unknown to it or newer than it (core/client.js lackedTypes), which happens only to a client
// older than it was (the app reinstalled older, an old page from a cache) back in a match dealt for the newer one. Nothing
// of the match is drawn or played here (its view could not draw that game): this screen instead, on every way in (Find
// Match, a room's match, Resume match, a reload: net/matchmaking.js onGameValue) with Update (net/platform.js openUpdate)
// and Leave match, which resigns by the usual path (a loss on the record, as leaving a match always is; never by itself).
// The match over meanwhile (the leaving, a forfeit): its result in words and Main menu.
import { lackedTypes } from '../../core/client.js';
import { playerName } from '../../core/match.js';
import { other } from '../../core/util.js';
import { clientInfo, NATIVE } from '../../net/platform.js';
import { moveWait } from '../../net/room.js';
import { esc, state } from '../app.js';
import { toon } from '../art.js';

export let staleConfirm = false;                                   // Leave match tapped: asked once more before the loss
export function setStaleConfirm(v) { staleConfirm = !!v; }
// This phone is in an online match with a mini-game this client lacks (read from the match's state: the record as taken).
export function matchStale() { return !!(state.online && state.online.kind === 'mm' && lackedTypes(clientInfo(), state).length); }
export function renderStale() {
  const me = state.online.me, over = !!state.winner, busy = !!moveWait, dis = busy ? ' disabled' : '';
  const result = !over ? '' : state.resigned === me ? 'You left the match: it counts as a loss.' : state.winner === 'draw' ? 'The match ended in a draw.'
    : state.winner === me ? `You won: ${esc(playerName(state, other(me)))} left the match or ran out of time.` : 'The match ended as a loss for you.';
  const buttons = over ? `<p class="hint center">${result}</p><button class="primary" data-act="stale-menu">Main menu</button>`
    : staleConfirm ? `<p class="hint center"><b>Leave and take the loss?</b></p><div class="row2"><button class="btn" data-act="stale-stay"${dis}>Stay</button><button class="btn go" data-act="stale-leave-yes"${dis}>${busy ? 'Leaving…' : 'Leave match'}</button></div>`
    : `<button class="primary" data-act="stale-update"${dis}>Update</button><p class="hint">${NATIVE ? 'Update opens the App Store.' : 'Update loads the latest version of the page.'} The match waits for you: its clock keeps running.</p>
      <button class="btn" data-act="stale-leave"${dis}>Leave match</button><p class="hint">Leaving counts as a loss, as leaving a match always does.</p>`;
  return `<main class="scr setup acct-scr stale-scr">
    <div class="bar"><div class="ttl"><b>${over ? 'Match over' : 'Please update'}</b><small>${over ? 'This match has ended' : 'This version cannot play this match'}</small></div></div>
    <div class="setup-box"><div class="searching" role="status"><div class="spinner still" aria-hidden="true">${toon('X')}${toon('O')}</div>
      <h2>${over ? 'Match over' : 'Update to play on'}</h2><p class="hint">This match uses a mini-game this version doesn't have.</p></div>
      ${buttons}</div></main>`;
}
